import { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { challengeOf, isSharedTask, LANE } from '../utils/challengeStack';
import {
  makeDefaultNotifPrefs,
  getNotificationSupport, permissionLabel,
  requestNotificationPermission, subscribeToPush, unsubscribeFromPush,
  showTestNotification, backgroundTestPush, getPushStatus,
  scheduledTestPush, localSubscriptionState, timeInQuietHours, minutesOf,
} from '../utils/notificationUtils';
import {
  buildReminderPlan, CATEGORY, CATEGORY_META, PERSONAL_HABITS,
  BUSY_DAILY_THRESHOLD, TARGET_DAILY_MIN, TARGET_DAILY_MAX, CUSTOM_PREFIX,
} from '../data/reminderPlan';
import { reminderPreview } from '../data/reminderCopy';

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
  const {
    activeProfile, profile, notifPrefs, updateNotifPrefs,
    getChallengeMeta, getRawDayNumber, getDayData,
  } = useApp();
  const prefs = notifPrefs[activeProfile] || makeDefaultNotifPrefs();

  const [support, setSupport] = useState(() => getNotificationSupport());
  const [testStatus, setTestStatus] = useState(null); // 'sent' | 'failed' | null
  const [bgStatus, setBgStatus] = useState(null);      // { kind, msg }
  const [schedStatus, setSchedStatus] = useState(null); // { kind, msg }
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

  // The reminder catalogue is derived, not fixed: what exists depends on the
  // challenge this profile is actually running right now.
  const ctx = useMemo(() => {
    const meta = getChallengeMeta();
    const dayNum = getRawDayNumber?.() ?? null;
    return {
      profileId: activeProfile,
      tasks: profile?.tasks || [],
      dayData: dayNum ? (getDayData?.(dayNum) || null) : null,
      dayNumber: dayNum,
      challengeName: meta?.name || null,
      // A challenge contributes reminders only while it is genuinely running:
      // not on Forge Daily, not before a scheduled start date, not after it
      // has finished.
      challengeActive: !!dayNum && !!meta?.templateId && meta.templateId !== 'forge_daily',
      supportChallengeName: challengeOf(profile, LANE.SUPPORT)?.name || null,
      isSharedTask,
    };
  }, [activeProfile, profile, getChallengeMeta, getRawDayNumber, getDayData]);

  const plan = useMemo(() => buildReminderPlan(prefs, ctx), [prefs, ctx]);

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
          {/* ── Reminders, organised by where they come from ── */}
          <ReminderSections
            plan={plan}
            prefs={prefs}
            ctx={ctx}
            onChange={updateNotifPrefs}
          />

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


/**
 * The four-section reminder list.
 *
 * Replaces one long generic list with sections that say where each reminder
 * comes from: general ones that work with or without a challenge, ones derived
 * from the challenge actually running, and opt-in personal habits. Every row
 * shows the habit, the time, the toggle, and what requirement it supports.
 */
function ReminderSections({ plan, prefs, ctx, onChange }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [adding, setAdding] = useState(false);

  const setReminder = (id, patch) => onChange({ reminders: { [id]: patch } });
  const busy = plan.enabledCount > BUSY_DAILY_THRESHOLD;

  return (
    <div className="nr">
      {/* Live volume, so "roughly two or three a day" is visible rather than
          an invisible design intention. */}
      <div className={`nr-volume${busy ? ' busy' : ''}`}>
        <span className="nr-volume-count">{plan.enabledCount}</span>
        <span className="nr-volume-text">
          {plan.enabledCount === 1 ? 'reminder a day' : 'reminders a day'}
          {busy
            ? ' — more than most people want. Turn a few off below.'
            : ` · Forge aims for ${TARGET_DAILY_MIN}–${TARGET_DAILY_MAX}.`}
        </span>
      </div>

      <Section meta={CATEGORY_META[CATEGORY.UNIVERSAL]}>
        {plan.universal.map(r => (
          <ReminderRow key={r.id} r={r} prefs={prefs} ctx={ctx} onChange={setReminder} />
        ))}
      </Section>

      <Section
        meta={CATEGORY_META[CATEGORY.CHALLENGE]}
        subtitle={plan.hasChallenge ? plan.challengeName : null}
      >
        {plan.hasChallenge ? (
          plan.challenge.length > 0 ? (
            plan.challenge.map(r => (
              <ReminderRow key={r.id} r={r} prefs={prefs} ctx={ctx} onChange={setReminder} />
            ))
          ) : (
            <div className="nr-empty">
              This challenge has no daily habits to remind you about.
            </div>
          )
        ) : (
          /* No challenge: say so, and point at what still works rather than
             showing reminders for habits the user does not have. */
          <div className="nr-empty">
            <strong>No challenge running.</strong> Challenge reminders appear here automatically
            when you start one, built from its actual habits.
            <div className="nr-empty-alt">
              In the meantime, the General Reminders above still work on Forge Daily — and you can
              add any habit you like under Personal Habits.
            </div>
          </div>
        )}
      </Section>

      <Section meta={CATEGORY_META[CATEGORY.PERSONAL]}>
        {plan.personal.map(r => (
          <ReminderRow key={r.id} r={r} prefs={prefs} ctx={ctx} onChange={setReminder} />
        ))}
        {adding ? (
          <CustomHabitForm
            onCancel={() => setAdding(false)}
            onAdd={(habit) => {
              onChange({ customHabits: [...(prefs.customHabits || []), habit] });
              setAdding(false);
            }}
          />
        ) : (
          <button className="btn btn-ghost btn-full nr-add" onClick={() => setAdding(true)}>
            ➕ Add your own habit
          </button>
        )}
      </Section>

      {/* ── 4. Advanced ── */}
      <div className="nr-section">
        <button className="nr-head" onClick={() => setShowAdvanced(v => !v)}>
          <span className="nr-head-title">⚙️ Advanced Notification Settings</span>
          <span className="nr-caret">{showAdvanced ? '▾' : '▸'}</span>
        </button>
        {showAdvanced && (
          <div className="nr-advanced">
            <p className="nr-note">
              Reminders are sent by Forge&apos;s server from a schedule your device syncs. The
              server is told the reminder times and the wording — never your Daily Log notes and
              never your mood, energy or other ratings.
            </p>
            <p className="nr-note">
              When the server&apos;s copy of your day is from an earlier date, it sends a general
              version of the reminder instead of one that claims something is unfinished. It can
              only know what your device last synced.
            </p>
            <DiagRow label="Reminders enabled" value={String(plan.enabledCount)} />
            <DiagRow label="Challenge reminders" value={plan.hasChallenge ? String(plan.challenge.length) : 'none — no challenge running'} />
            <DiagRow
              label="Personal habits on"
              value={String(plan.personal.filter(r => r.enabled && !r.superseded).length)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ meta, subtitle, children }) {
  return (
    <div className="nr-section">
      <div className="nr-head static">
        <span className="nr-head-title">{meta.icon} {meta.title}</span>
        {subtitle && <span className="nr-head-sub">{subtitle}</span>}
      </div>
      <p className="nr-blurb">{meta.blurb}</p>
      {children}
    </div>
  );
}

/**
 * One reminder. Shows the habit, what requirement it supports, a preview of
 * the actual wording, its time and its toggle.
 */
function ReminderRow({ r, prefs, ctx, onChange }) {
  const superseded = !!r.superseded;
  // A reminder whose own time sits inside quiet hours can never be delivered.
  // Unflagged, that is indistinguishable from broken push.
  const mutedByQuiet = r.enabled && !superseded &&
    timeInQuietHours(prefs.quietHours, minutesOf(r.time));
  const preview = r.enabled && !superseded ? reminderPreview(r, ctx) : null;

  return (
    <div className={`nr-row${superseded ? ' superseded' : ''}`}>
      <span className="nr-row-icon">{r.icon}</span>
      <span className="nr-row-text">
        <span className="nr-row-label">
          {r.label}
          {r.keystone >= 3 && <span className="nr-key">keystone</span>}
        </span>
        <span className="nr-row-supports">{r.supports}</span>
        {preview && <span className="nr-row-preview">“{preview}”</span>}
        {mutedByQuiet && (
          <span className="notif-quiet-warn">😴 inside quiet hours — won&apos;t send</span>
        )}
      </span>
      <div className="nr-row-controls">
        {r.enabled && !superseded && (
          <input
            type="time"
            className="inline-input notif-time-input"
            value={r.time}
            onChange={e => onChange(r.id, { time: e.target.value })}
            aria-label={`${r.label} reminder time`}
          />
        )}
        <button
          className={`toggle-btn${r.enabled && !superseded ? ' on' : ''}`}
          disabled={superseded}
          title={superseded ? 'Your challenge already covers this habit' : undefined}
          onClick={() => onChange(r.id, { enabled: !r.enabled })}
        >
          {superseded ? 'Covered' : r.enabled ? 'On' : 'Off'}
        </button>
      </div>
    </div>
  );
}

function CustomHabitForm({ onAdd, onCancel }) {
  const [label, setLabel] = useState('');
  const [time, setTime] = useState('18:00');
  const valid = label.trim().length > 1;
  return (
    <div className="nr-custom">
      <input
        className="inline-input nr-custom-input"
        placeholder="Habit name (e.g. Stretch)"
        value={label}
        maxLength={40}
        onChange={e => setLabel(e.target.value)}
      />
      <input
        type="time"
        className="inline-input notif-time-input"
        value={time}
        onChange={e => setTime(e.target.value)}
      />
      <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={onCancel}>
        Cancel
      </button>
      <button
        className="btn btn-primary"
        style={{ padding: '6px 12px', fontSize: 12 }}
        disabled={!valid}
        onClick={() => onAdd({
          id: `${CUSTOM_PREFIX}${Date.now().toString(36)}`,
          label: label.trim(),
          icon: '✨',
          time,
          enabled: true,
          body: `Time for ${label.trim()}.`,
        })}
      >
        Add
      </button>
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
