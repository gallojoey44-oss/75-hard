import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  REMINDER_DEFS, makeDefaultNotifPrefs,
  getNotificationSupport, permissionLabel,
  requestNotificationPermission, subscribeToPush, unsubscribeFromPush,
  showTestNotification, backgroundTestPush, getPushStatus, isBackgroundReminder,
  scheduledTestPush, localSubscriptionState, timeInQuietHours, minutesOf,
} from '../utils/notificationUtils';

// VITE_VAPID_PUBLIC_KEY is inlined at BUILD time. If it was missing when the
// production bundle was built, this is false and no push subscription can ever
// be created — while the local "Send Test Notification" button still works,
// because that path needs only permission. That combination is exactly what
// "notifications work in the app but never arrive in the background" looks
// like, so it is reported loudly rather than silently.
const PUSH_BACKEND_CONFIGURED = !!import.meta.env.VITE_VAPID_PUBLIC_KEY;

function fmtTime(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

/** "in 3 min" / "2 min ago" — for queued pushes and scheduler freshness. */
function fmtRelative(iso) {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  const mins = Math.round((t - Date.now()) / 60000);
  if (mins > 0) return `in ${mins} min`;
  if (mins === 0) return 'any moment';
  return `${Math.abs(mins)} min ago`;
}

export default function NotificationSettings() {
  const { activeProfile, profile, notifPrefs, updateNotifPrefs } = useApp();
  const prefs = notifPrefs[activeProfile] || makeDefaultNotifPrefs();

  const [support, setSupport] = useState(() => getNotificationSupport());
  const [testStatus, setTestStatus] = useState(null); // 'sent' | 'failed' | null
  const [bgStatus, setBgStatus] = useState(null);      // { kind, msg }
  const [schedStatus, setSchedStatus] = useState(null); // { kind, msg }
  const [showAll, setShowAll] = useState(false);
  const [diag, setDiag] = useState(null);
  const [diagLoading, setDiagLoading] = useState(false);
  // Read from the browser itself rather than from our server records — this is
  // the only source that can say whether a genuine Push API subscription exists
  // for THIS installation.
  const [local, setLocal] = useState(null);

  const status = permissionLabel(support);
  const statusColor = {
    'Enabled':       '#10B981',
    'Denied':        '#EF4444',
    'Unsupported':   '#9090B8',
    'Not requested': 'var(--text2)',
  }[status];

  const refreshDiag = useCallback(async () => {
    setDiagLoading(true);
    // The local half is always read, even with no build-time key: when the key
    // is missing it is the evidence of *why* there is no subscription.
    const l = await localSubscriptionState();
    setLocal(l);
    if (PUSH_BACKEND_CONFIGURED) {
      const s = await getPushStatus(activeProfile);
      setDiag(s);
    }
    setDiagLoading(false);
  }, [activeProfile]);

  useEffect(() => { refreshDiag(); }, [refreshDiag]);

  async function handleEnable() {
    // Permission is requested ONLY here, from an explicit user tap
    const result = await requestNotificationPermission();
    setSupport(getNotificationSupport());
    if (result === 'granted') {
      updateNotifPrefs({ masterEnabled: true });
      // Create + persist the push subscription so the server can deliver
      await subscribeToPush(activeProfile);
      setTimeout(refreshDiag, 800);
    }
  }

  async function handleMasterToggle() {
    const next = !prefs.masterEnabled;
    updateNotifPrefs({ masterEnabled: next });
    if (!next) await unsubscribeFromPush(activeProfile).catch(() => {});
    else if (support.permission === 'granted') await subscribeToPush(activeProfile);
    setTimeout(refreshDiag, 800);
  }

  async function handleTest() {
    const ok = await showTestNotification(profile?.name || 'you');
    setTestStatus(ok ? 'sent' : 'failed');
    setTimeout(() => setTestStatus(null), 3500);
  }

  async function handleBackgroundTest() {
    setBgStatus({ kind: 'pending', msg: 'Sending background push from the server…' });
    // Make sure the current subscription is persisted before asking the server
    // to send to it (no-op if already stored).
    await subscribeToPush(activeProfile).catch(() => {});
    const res = await backgroundTestPush(activeProfile);
    if (res.ok) {
      setBgStatus({ kind: 'ok', msg: `Server push sent to ${res.delivered} device(s). It should arrive even with Forge closed.` });
    } else if (res.status === 404) {
      setBgStatus({ kind: 'warn', msg: 'No subscription stored yet. Enable notifications, then try again.' });
    } else if (res.status === 503) {
      setBgStatus({ kind: 'warn', msg: 'Server not fully configured yet (VAPID keys / KV store). See setup notes.' });
    } else {
      setBgStatus({ kind: 'warn', msg: `Background push failed${res.detail ? `: ${res.detail}` : ''}.` });
    }
    setTimeout(refreshDiag, 800);
  }

  async function handleScheduledTest() {
    setSchedStatus({ kind: 'pending', msg: 'Queueing a server-sent push for 3 minutes from now…' });
    await subscribeToPush(activeProfile).catch(() => {});
    const res = await scheduledTestPush(activeProfile, 3);

    if (res.ok && res.queued) {
      const sched = res.scheduler || {};
      if (sched.looksLive) {
        setSchedStatus({
          kind: 'ok',
          msg: `Queued for ${new Date(res.dueAt).toLocaleTimeString()}. Close Forge completely and lock your phone — `
            + `it should arrive within about ${res.expectedWithinMinutes} minutes. `
            + `Reopen Forge afterwards and check “Confirmed on device” below.`,
        });
      } else {
        // The push will not be sent if nothing is running the dispatcher. Say
        // that, rather than reporting a reassuring "queued".
        setSchedStatus({
          kind: 'warn',
          msg: `Queued, but the scheduled dispatcher has not run recently${
            sched.lastRunAgeMinutes != null ? ` (last run ${sched.lastRunAgeMinutes} min ago)` : ' (never)'
          }, so this will NOT arrive on time. The external scheduler still needs setting up — see SETUP-PUSH.md.`,
        });
      }
    } else if (res.status === 404) {
      setSchedStatus({
        kind: 'warn',
        msg: 'No push subscription is stored for this install, so there is nothing to send to. '
          + 'On iPhone, Forge must be opened from the Home Screen icon (not Safari) before a subscription can be created.',
      });
    } else if (res.status === 503) {
      setSchedStatus({ kind: 'warn', msg: `Server not configured: ${res.fix || res.error || 'missing VAPID keys or KV store'}.` });
    } else {
      setSchedStatus({ kind: 'warn', msg: `Couldn’t queue the test${res.detail || res.error ? `: ${res.detail || res.error}` : ''}.` });
    }
    setTimeout(refreshDiag, 1000);
  }

  const canUse = support.supported && support.permission === 'granted';
  const visibleReminders = showAll ? REMINDER_DEFS : REMINDER_DEFS.slice(0, 4);

  return (
    <div>
      <div className="section-title">
        🔔 Notifications
        <span className="notif-status-chip" style={{ color: statusColor }}>{status}</span>
      </div>

      <p className="text-muted" style={{ lineHeight: 1.6, marginBottom: 12 }}>
        Install Forge on your Home Screen and enable notifications to receive reminders.
      </p>

      {/* iOS not-installed guidance */}
      {support.iosNeedsInstall && (
        <div className="notif-banner warn">
          📱 Open the installed Forge app to enable iPhone notifications.
          On iPhone, notifications only work from the Home Screen app.
        </div>
      )}

      {/* Unsupported */}
      {!support.supported && !support.iosNeedsInstall && (
        <div className="notif-banner">
          ℹ️ Notifications aren&apos;t available in this browser. Reminders will appear here once you
          use a browser that supports them.
        </div>
      )}

      {/* Denied */}
      {support.supported && support.permission === 'denied' && (
        <div className="notif-banner warn">
          Notifications are blocked for Forge in your device settings. Re-enable them there, then return here.
        </div>
      )}

      {/* Enable button — the only place permission is requested */}
      {support.supported && support.permission === 'default' && !support.iosNeedsInstall && (
        <button className="btn btn-primary btn-full" style={{ marginBottom: 12 }} onClick={handleEnable}>
          🔔 Enable Notifications
        </button>
      )}

      {/* Master toggle */}
      <div className="settings-row">
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Notifications</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
            Master switch for all {profile?.name} reminders
          </div>
        </div>
        <button
          className={`toggle-btn${prefs.masterEnabled ? ' on' : ''}`}
          onClick={handleMasterToggle}
        >
          {prefs.masterEnabled ? 'On' : 'Off'}
        </button>
      </div>

      {/* Delivery status */}
      <div className="notif-banner" style={{ marginTop: 10 }}>
        {PUSH_BACKEND_CONFIGURED
          ? '📡 Timed reminders are sent by the server, so they can arrive with Forge closed. A few reminders depend on live task state and stay in-app (labelled below). Use the 3-minute test to confirm background delivery actually reaches this phone.'
          : '⏳ Background push cannot work in this build. The VAPID public key was missing when this version was built, so no push subscription can be created — only in-app notifications will appear. See SETUP-PUSH.md, then redeploy.'}
      </div>

      {/* Background-push preconditions, read from the device itself. iOS grants
          the Push API only to a Home Screen install, and permission alone is
          not enough — so each precondition is shown separately instead of one
          misleading "enabled". */}
      {local && (
        <div className="notif-diag" style={{ marginTop: 10 }}>
          <div className="notif-diag-head">
            <span className="notif-reminder-label">📲 This device</span>
            <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={refreshDiag}>
              {diagLoading ? '…' : '↻ Refresh'}
            </button>
          </div>
          <DiagRow
            label="Installed to Home Screen"
            value={local.installed ? 'Yes' : local.ios ? 'No — required on iPhone' : 'No (browser tab)'}
            ok={local.installed ? true : local.ios ? false : undefined}
          />
          <DiagRow label="Notification permission" value={permissionLabel(support)} ok={support.permission === 'granted'} />
          <DiagRow label="Push API available" value={local.pushSupported ? 'Yes' : 'No'} ok={local.pushSupported} />
          <DiagRow
            label="Push subscription on device"
            value={local.hasSubscription ? 'Active' : 'None'}
            ok={local.hasSubscription}
          />
          {local.endpointHost && <DiagRow label="Push service" value={local.endpointHost} />}
          {local.ios && !local.installed && (
            <p style={{ fontSize: 11, color: '#F59E0B', marginTop: 8, lineHeight: 1.5 }}>
              You&apos;re in Safari, not the installed app. iPhone only allows background push from the Home Screen
              app: tap Share → Add to Home Screen, then open Forge from that icon and enable notifications there.
            </p>
          )}
          {local.installed && local.pushSupported && !local.hasSubscription && support.permission === 'granted' && (
            <p style={{ fontSize: 11, color: '#F59E0B', marginTop: 8, lineHeight: 1.5 }}>
              Permission is granted but no push subscription exists, so the server has nowhere to send to.
              {PUSH_BACKEND_CONFIGURED
                ? ' Toggle Notifications off and on again to recreate it.'
                : ' This build has no VAPID public key — the key must be set in Vercel and the app redeployed.'}
            </p>
          )}
        </div>
      )}

      {prefs.masterEnabled && (
        <>
          {/* Reminder list */}
          <div className="notif-reminder-list">
            {visibleReminders.map(def => {
              const setting = prefs.reminders?.[def.id] || { enabled: false, time: def.defaultTime };
              const bg = isBackgroundReminder(def.id);
              // A reminder whose own time sits inside quiet hours can never be
              // delivered. Unflagged, that is indistinguishable from broken push.
              const mutedByQuiet = bg && setting.enabled &&
                timeInQuietHours(prefs.quietHours, minutesOf(setting.time || def.defaultTime));
              return (
                <div key={def.id} className="notif-reminder-row">
                  <span className="notif-reminder-label">
                    {def.label}
                    {mutedByQuiet && (
                      <span className="notif-quiet-warn" title="This time is inside your quiet hours, so it will never be sent.">
                        😴 inside quiet hours — won&apos;t send
                      </span>
                    )}
                    <span
                      className="notif-delivery-tag"
                      style={{
                        marginLeft: 6, fontSize: 10, fontWeight: 700, padding: '1px 6px',
                        borderRadius: 10, whiteSpace: 'nowrap',
                        color: bg ? '#10B981' : '#F59E0B',
                        background: bg ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                      }}
                    >
                      {bg ? 'Background' : 'In-app only'}
                    </span>
                  </span>
                  <div className="notif-reminder-controls">
                    {def.hasTime && setting.enabled && (
                      <input
                        type="time"
                        className="inline-input notif-time-input"
                        value={setting.time || def.defaultTime}
                        onChange={e => updateNotifPrefs({ reminders: { [def.id]: { time: e.target.value } } })}
                      />
                    )}
                    <button
                      className={`toggle-btn${setting.enabled ? ' on' : ''}`}
                      onClick={() => updateNotifPrefs({ reminders: { [def.id]: { enabled: !setting.enabled } } })}
                    >
                      {setting.enabled ? 'On' : 'Off'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <button className="btn btn-ghost btn-full" style={{ marginTop: 8 }} onClick={() => setShowAll(v => !v)}>
            {showAll ? '▲ Show fewer reminders' : `▼ Show all reminders (${REMINDER_DEFS.length})`}
          </button>

          {/* Quiet hours */}
          <div className="notif-quiet-row">
            <span className="notif-reminder-label">😴 Quiet hours</span>
            <div className="notif-reminder-controls">
              <input
                type="time"
                className="inline-input notif-time-input"
                value={prefs.quietHours?.start || '22:30'}
                onChange={e => updateNotifPrefs({ quietHours: { start: e.target.value } })}
              />
              <span style={{ color: 'var(--text3)', fontSize: 12 }}>to</span>
              <input
                type="time"
                className="inline-input notif-time-input"
                value={prefs.quietHours?.end || '07:00'}
                onChange={e => updateNotifPrefs({ quietHours: { end: e.target.value } })}
              />
            </div>
          </div>

          {/* Tests */}
          <button
            className="btn btn-ghost btn-full"
            style={{ marginTop: 10 }}
            onClick={handleTest}
            disabled={!canUse}
          >
            📨 Send Test Notification
          </button>
          <button
            className="btn btn-ghost btn-full"
            style={{ marginTop: 8 }}
            onClick={handleBackgroundTest}
            disabled={!canUse || !PUSH_BACKEND_CONFIGURED}
          >
            📡 Send Background Test Push
          </button>
          <button
            className="btn btn-primary btn-full"
            style={{ marginTop: 8 }}
            onClick={handleScheduledTest}
            disabled={!canUse || !PUSH_BACKEND_CONFIGURED}
          >
            ⏱️ Test Background Push in 3 Minutes
          </button>
          <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, lineHeight: 1.5 }}>
            The 3-minute test is the real one: the server sends it later, so close Forge and lock your phone
            after tapping. The immediate test above only proves the server was reachable while the app was open.
          </p>
          {!canUse && (
            <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, textAlign: 'center' }}>
              Enable notifications above to send a test.
            </p>
          )}
          {canUse && !PUSH_BACKEND_CONFIGURED && (
            <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, textAlign: 'center' }}>
              Background push needs server VAPID keys + a KV store (see setup notes).
            </p>
          )}
          {testStatus === 'sent' && (
            <div className="update-status-row success" style={{ marginTop: 8 }}>
              <span>✅</span><span>Test notification sent.</span>
            </div>
          )}
          {testStatus === 'failed' && (
            <div className="update-status-row warn" style={{ marginTop: 8 }}>
              <span>⚠️</span><span>Couldn&apos;t show the notification — check permission and try again.</span>
            </div>
          )}
          {bgStatus && (
            <div className={`update-status-row ${bgStatus.kind === 'ok' ? 'success' : 'warn'}`} style={{ marginTop: 8 }}>
              <span>{bgStatus.kind === 'ok' ? '✅' : bgStatus.kind === 'pending' ? '⏳' : '⚠️'}</span>
              <span>{bgStatus.msg}</span>
            </div>
          )}
          {schedStatus && (
            <div className={`update-status-row ${schedStatus.kind === 'ok' ? 'success' : 'warn'}`} style={{ marginTop: 8 }}>
              <span>{schedStatus.kind === 'ok' ? '⏱️' : schedStatus.kind === 'pending' ? '⏳' : '⚠️'}</span>
              <span>{schedStatus.msg}</span>
            </div>
          )}

          {/* Diagnostics */}
          {PUSH_BACKEND_CONFIGURED && (
            <div className="notif-diag">
              <div className="notif-diag-head">
                <span className="notif-reminder-label">🩺 Push diagnostics</span>
                <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={refreshDiag}>
                  {diagLoading ? '…' : '↻ Refresh'}
                </button>
              </div>
              <DiagRow label="Server VAPID configured" value={diag?.vapidConfigured ? 'Yes' : 'No'} ok={diag?.vapidConfigured} />
              <DiagRow label="Subscription store" value={diag?.storeConfigured ? 'Connected' : 'Not connected'} ok={diag?.storeConfigured} />
              <DiagRow label="Subscription active" value={diag?.subscriptionActive ? `Yes (${diag?.subscriptionCount || 0})` : 'No'} ok={diag?.subscriptionActive} />
              <DiagRow label="Schedule synced" value={diag?.scheduleSynced ? `Yes (${diag?.scheduledReminderCount || 0} reminders)` : 'No'} ok={diag?.scheduleSynced} />
              <DiagRow label="Timezone" value={diag?.timezone || '—'} />
              <DiagRow label="Schedule local date" value={diag?.scheduleLocalDate || '—'} />
              <DiagRow label="Last synced" value={fmtTime(diag?.syncedAt)} />

              {/* Scheduler — nothing else matters if this is not running. */}
              <div className="notif-diag-sub">Scheduler</div>
              <DiagRow
                label="Dispatcher running"
                value={diag?.schedulerLive
                  ? `Yes (${diag.schedulerLastRunAgeMinutes} min ago)`
                  : diag?.schedulerLastRun ? `Stale — ${diag.schedulerLastRunAgeMinutes} min ago` : 'Never run'}
                ok={diag?.schedulerLive}
              />
              <DiagRow
                label="Observed interval"
                value={diag?.schedulerCadenceMinutes != null ? `~${diag.schedulerCadenceMinutes} min` : 'Not enough runs yet'}
              />
              <DiagRow label="Last run" value={fmtTime(diag?.schedulerLastRun)} />
              <DiagRow label="Last check for this profile" value={fmtTime(diag?.lastServerCheck)} />

              {/* Why nothing fired, in the server's own terms. */}
              <div className="notif-diag-sub">Right now, server-side</div>
              <DiagRow label="Server local date" value={diag?.evaluation?.localDate || '—'} />
              <DiagRow
                label="In quiet hours"
                value={diag?.evaluation ? (diag.evaluation.inQuietHours ? 'Yes — reminders suppressed' : 'No') : '—'}
                ok={diag?.evaluation ? !diag.evaluation.inQuietHours : undefined}
              />
              <DiagRow
                label="Schedule is for an earlier day"
                value={diag?.evaluation ? (diag.evaluation.staleDay ? 'Yes — generic copy will be used' : 'No') : '—'}
              />
              <DiagRow
                label="Due now"
                value={diag?.evaluation
                  ? (diag.evaluation.dueNow.length ? diag.evaluation.dueNow.join(', ') : 'Nothing due')
                  : '—'}
              />

              {/* Queued one-shot tests. */}
              {(diag?.queuedCount || diag?.lastQueuedDueAt) && (
                <>
                  <div className="notif-diag-sub">Queued test</div>
                  <DiagRow label="Waiting to send" value={diag?.queuedCount ? `${diag.queuedCount}` : 'None'} />
                  <DiagRow
                    label="Due"
                    value={diag?.queuedDueAt
                      ? `${fmtTime(diag.queuedDueAt)} (${fmtRelative(diag.queuedDueAt)})`
                      : diag?.lastQueuedDueAt ? `${fmtTime(diag.lastQueuedDueAt)} — sent or expired` : '—'}
                  />
                </>
              )}

              {/* Acceptance and delivery are deliberately separate rows. A 201
                  from Apple means the push service took the request; it is not
                  evidence that the phone received or displayed anything. */}
              <div className="notif-diag-sub">Push attempts</div>
              <DiagRow label="Last attempt" value={fmtTime(diag?.lastPushAttempt)} />
              <DiagRow
                label="Accepted by push service"
                value={diag?.lastPushAccepted
                  ? `${fmtTime(diag.lastPushAccepted)}${diag.lastPushType ? ` (${diag.lastPushType})` : ''}`
                  : diag?.lastPushResult === 'accepted' ? 'Yes' : '—'}
                ok={diag?.lastPushAccepted ? true : undefined}
              />
              <DiagRow
                label="Confirmed on device"
                value={diag?.lastConfirmedDelivery
                  ? `${fmtTime(diag.lastConfirmedDelivery)}${diag.lastConfirmedLabel ? ` (${diag.lastConfirmedLabel})` : ''}`
                  : 'Never'}
                ok={diag?.lastConfirmedDelivery ? true : false}
              />
              <DiagRow label="Confirmations recorded" value={String(diag?.confirmedCount ?? 0)} />
              {diag?.failureReason && <DiagRow label="Last error" value={diag.failureReason} ok={false} />}

              <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8, lineHeight: 1.5 }}>
                “Accepted by push service” means Apple took the request — it is <strong>not</strong> proof your
                phone received anything. Only “Confirmed on device” is, because Forge&apos;s service worker reports
                it after the push actually arrives. Reminders labelled “In-app only” depend on live task state and
                fire while Forge is open.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DiagRow({ label, value, ok }) {
  const color = ok === true ? '#10B981' : ok === false ? '#EF4444' : 'var(--text)';
  return (
    <div className="notif-diag-row" style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '3px 0', fontSize: 12 }}>
      <span style={{ color: 'var(--text2)' }}>{label}</span>
      <span style={{ color, fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}
