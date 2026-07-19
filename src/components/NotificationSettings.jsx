import { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  REMINDER_DEFS, makeDefaultNotifPrefs,
  getNotificationSupport, permissionLabel,
  requestNotificationPermission, subscribeToPush, unsubscribeFromPush,
  showTestNotification,
} from '../utils/notificationUtils';

const PUSH_BACKEND_CONFIGURED = !!import.meta.env.VITE_VAPID_PUBLIC_KEY;

export default function NotificationSettings() {
  const { activeProfile, profile, notifPrefs, updateNotifPrefs } = useApp();
  const prefs = notifPrefs[activeProfile] || makeDefaultNotifPrefs();

  const [support, setSupport] = useState(() => getNotificationSupport());
  const [testStatus, setTestStatus] = useState(null); // 'sent' | 'failed' | null
  const [showAll, setShowAll] = useState(false);

  const status = permissionLabel(support);
  const statusColor = {
    'Enabled':       '#10B981',
    'Denied':        '#EF4444',
    'Unsupported':   '#9090B8',
    'Not requested': 'var(--text2)',
  }[status];

  async function handleEnable() {
    // Permission is requested ONLY here, from an explicit user tap
    const result = await requestNotificationPermission();
    setSupport(getNotificationSupport());
    if (result === 'granted') {
      updateNotifPrefs({ masterEnabled: true });
      // Create the push subscription now so the future backend can use it
      await subscribeToPush(activeProfile);
    }
  }

  async function handleMasterToggle() {
    const next = !prefs.masterEnabled;
    updateNotifPrefs({ masterEnabled: next });
    if (!next) await unsubscribeFromPush(activeProfile).catch(() => {});
    else if (support.permission === 'granted') await subscribeToPush(activeProfile);
  }

  async function handleTest() {
    const ok = await showTestNotification(profile?.name || 'you');
    setTestStatus(ok ? 'sent' : 'failed');
    setTimeout(() => setTestStatus(null), 3500);
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

      {/* Honest delivery status */}
      <div className="notif-banner" style={{ marginTop: 10 }}>
        {PUSH_BACKEND_CONFIGURED
          ? '📡 Push service configured — background reminders can be delivered by the server.'
          : '⏳ Scheduled background reminders require Push Service setup. Until then, reminders fire while the app is open.'}
      </div>

      {prefs.masterEnabled && (
        <>
          {/* Reminder list */}
          <div className="notif-reminder-list">
            {visibleReminders.map(def => {
              const setting = prefs.reminders?.[def.id] || { enabled: false, time: def.defaultTime };
              return (
                <div key={def.id} className="notif-reminder-row">
                  <span className="notif-reminder-label">{def.label}</span>
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

          {/* Test */}
          <button
            className="btn btn-ghost btn-full"
            style={{ marginTop: 10 }}
            onClick={handleTest}
            disabled={!canUse}
          >
            📨 Send Test Notification
          </button>
          {!canUse && (
            <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, textAlign: 'center' }}>
              Enable notifications above to send a test.
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
        </>
      )}
    </div>
  );
}
