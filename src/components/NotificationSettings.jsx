import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  REMINDER_DEFS, makeDefaultNotifPrefs,
  getNotificationSupport, permissionLabel,
  requestNotificationPermission, subscribeToPush, unsubscribeFromPush,
  showTestNotification, backgroundTestPush, getPushStatus, isBackgroundReminder,
} from '../utils/notificationUtils';

const PUSH_BACKEND_CONFIGURED = !!import.meta.env.VITE_VAPID_PUBLIC_KEY;

function fmtTime(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export default function NotificationSettings() {
  const { activeProfile, profile, notifPrefs, updateNotifPrefs } = useApp();
  const prefs = notifPrefs[activeProfile] || makeDefaultNotifPrefs();

  const [support, setSupport] = useState(() => getNotificationSupport());
  const [testStatus, setTestStatus] = useState(null); // 'sent' | 'failed' | null
  const [bgStatus, setBgStatus] = useState(null);      // { kind, msg }
  const [showAll, setShowAll] = useState(false);
  const [diag, setDiag] = useState(null);
  const [diagLoading, setDiagLoading] = useState(false);

  const status = permissionLabel(support);
  const statusColor = {
    'Enabled':       '#10B981',
    'Denied':        '#EF4444',
    'Unsupported':   '#9090B8',
    'Not requested': 'var(--text2)',
  }[status];

  const refreshDiag = useCallback(async () => {
    if (!PUSH_BACKEND_CONFIGURED) return;
    setDiagLoading(true);
    const s = await getPushStatus(activeProfile);
    setDiag(s);
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
          ? '📡 Background push is active. Timed reminders are delivered by the server even when Forge is closed. A few reminders that depend on live task state stay in-app (labelled below).'
          : '⏳ Background push is not configured on the server yet. Until VAPID keys + a KV store are added, reminders fire only while the app is open.'}
      </div>

      {prefs.masterEnabled && (
        <>
          {/* Reminder list */}
          <div className="notif-reminder-list">
            {visibleReminders.map(def => {
              const setting = prefs.reminders?.[def.id] || { enabled: false, time: def.defaultTime };
              const bg = isBackgroundReminder(def.id);
              return (
                <div key={def.id} className="notif-reminder-row">
                  <span className="notif-reminder-label">
                    {def.label}
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
              <DiagRow label="Last server check" value={fmtTime(diag?.lastServerCheck)} />
              <DiagRow label="Global cron last run" value={fmtTime(diag?.globalCronLastRun)} />
              <DiagRow label="Last push attempted" value={fmtTime(diag?.lastPushAttempt)} />
              <DiagRow
                label="Last push result"
                value={diag?.lastPushResult ? `${diag.lastPushResult}${diag.lastPushType ? ` (${diag.lastPushType})` : ''}` : '—'}
                ok={diag?.lastPushResult === 'delivered'}
              />
              <DiagRow label="Last delivered" value={fmtTime(diag?.lastPushDelivered)} />
              {diag?.failureReason && <DiagRow label="Failure reason" value={diag.failureReason} ok={false} />}
              <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8, lineHeight: 1.5 }}>
                Background reminders are delivered by a server cron. Reminders labelled
                “In-app only” depend on live task state and fire while Forge is open.
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
