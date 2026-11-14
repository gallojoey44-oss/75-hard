import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useApp } from '../../context/AppContext';
import {
  getNotificationSupport, requestNotificationPermission, subscribeToPush, unsubscribeFromPush,
  localSubscriptionState, showNotification, timeInQuietHours, minutesOf,
  makeDefaultNotifPrefs,
} from '../../utils/notificationUtils';
import {
  updateDelivery, eligibleMessages, hasSomethingToSend, deliveryActive,
  previewNotification, nextDelivery, describeNext, describeDays, formatTime,
  todayLocalDate, WEEKDAYS, readPastSelf,
} from '../../utils/pastSelf';
import { buildPayload } from '../../../api/_lib/pastSelf.js';
import {
  getPastSelfStatus, subscribePastSelfStatus, requestPastSelfSync,
} from '../../utils/pastSelfStatus';
import LockScreenPreview from './LockScreenPreview';

const PUSH_BACKEND_CONFIGURED = !!import.meta.env.VITE_VAPID_PUBLIC_KEY;

/**
 * When the messages arrive, which one, and what the lock screen shows.
 *
 * Two things this screen is careful to be honest about:
 *
 *   • Timing. The server checks every few minutes, so a message arrives shortly
 *     AFTER the chosen time rather than on the minute, and one that would be
 *     more than an hour and a half late is skipped rather than turning up at a
 *     strange hour. The screen says so instead of implying precision.
 *   • What is stored. By default nothing the user wrote leaves the device. If
 *     they choose to show their words on the lock screen, the short messages
 *     have to be held on the server to be sent while Forge is closed — and the
 *     screen reports what the server SAID it is holding, including when it
 *     could not be reached and the answer is therefore unknown.
 */
export default function PastSelfDelivery({ state, update, onGoToMessages }) {
  const { activeProfile, profiles, notifPrefs, updateNotifPrefs } = useApp();
  const prefs = notifPrefs?.[activeProfile] || makeDefaultNotifPrefs();
  const quiet = prefs.quietHours || { start: '22:30', end: '07:00' };
  const d = state.delivery;

  const [support, setSupport] = useState(() => getNotificationSupport());
  const [local, setLocal] = useState(null);
  const [notice, setNotice] = useState(null);
  const [testStatus, setTestStatus] = useState(null);
  const [editQuiet, setEditQuiet] = useState(false);
  const server = useSyncExternalStore(subscribePastSelfStatus, () => getPastSelfStatus(activeProfile));

  const refreshLocal = useCallback(async () => {
    setSupport(getNotificationSupport());
    setLocal(await localSubscriptionState());
  }, []);
  useEffect(() => { refreshLocal(); }, [refreshLocal]);

  const messages = eligibleMessages(state);
  const onMessages = state.messages.filter(m => m.enabled !== false);
  const sendable = hasSomethingToSend(state);
  const active = deliveryActive(state);
  const next = nextDelivery(state);
  const inQuiet = timeInQuietHours(quiet, minutesOf(d.time));
  const set = (patch) => update(s => updateDelivery(s, patch));

  async function turnOn() {
    setNotice(null);
    if (!sendable) return;
    let s = getNotificationSupport();
    if (s.iosNeedsInstall) { setNotice('On iPhone, notifications only work from the installed app. Add Forge to your Home Screen, open it from there, then switch this on.'); return; }
    if (!s.supported) { setNotice('This browser cannot show notifications, so there is nothing to switch on here.'); return; }
    if (s.permission === 'default') {
      // Asked only here, from the user's own tap.
      await requestNotificationPermission();
      s = getNotificationSupport();
      setSupport(s);
    }
    if (s.permission !== 'granted') {
      setNotice('Notifications are blocked for Forge in your device settings. Allow them there, then come back and switch this on.');
      return;
    }
    set({ enabled: true });
    // Make sure the server has somewhere to send to. A no-op when it already
    // does. Not awaited: the switch must not appear stuck while the browser
    // talks to its push service.
    subscribeToPush(activeProfile).catch(() => {}).finally(refreshLocal);
  }

  function turnOff() {
    setNotice(null);
    set({ enabled: false });
    // The schedule and any stored words are deleted by the sync that follows.
    // The push subscription itself is dropped too when nothing else on this
    // device still needs it — it is one subscription per device, shared by
    // both profiles, so it stays if either profile has anything switched on.
    if (!pushStillNeeded(activeProfile, profiles, notifPrefs)) {
      unsubscribeFromPush(activeProfile).catch(() => {}).finally(refreshLocal);
    }
  }

  async function sendTest() {
    const payload = buildPayload({
      showContent: d.showContent && messages.length > 0,
      rotation: messages.map(m => ({ id: m.id, text: m.text })),
      days: d.mode === 'days' ? d.days : null,
    }, todayLocalDate(), activeProfile);
    const ok = await showNotification({
      title: payload.title, body: payload.body, tag: payload.tag, renotify: true, view: payload.view,
      data: { profile: activeProfile, date: payload.date, ...(payload.msg ? { msg: payload.msg } : {}) },
    });
    setTestStatus(ok ? 'sent' : 'failed');
    setTimeout(() => setTestStatus(null), 4000);
  }

  const background = PUSH_BACKEND_CONFIGURED && local?.hasSubscription && support.permission === 'granted';
  const preview = previewNotification(state, next?.localDate || todayLocalDate());

  return (
    <div className="ps-pane" data-testid="past-self-delivery">
      {/* ── On / off ── */}
      <section className="ps-card">
        <div className="ps-switch-row">
          <div className="ps-switch-text">
            <div className="ps-switch-title">Send me messages from my past self</div>
            <div className="ps-switch-sub">
              {!sendable
                ? 'Write a message or a letter first.'
                : active && next
                  ? `Next: ${describeNext(next)}, around ${formatTime(d.time)}`
                  : 'Off'}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={d.enabled}
            aria-label="Send me messages from my past self"
            className={`toggle-btn${d.enabled ? ' on' : ''}`}
            disabled={!sendable && !d.enabled}
            onClick={() => (d.enabled ? turnOff() : turnOn())}
          >
            {d.enabled ? 'On' : 'Off'}
          </button>
        </div>

        {!sendable && (
          <button type="button" className="ps-link" onClick={onGoToMessages}>Write a message ›</button>
        )}
        {notice && <div className="notif-banner warn" role="alert">{notice}</div>}
        {support.supported && support.permission === 'denied' && !notice && (
          <div className="notif-banner warn">
            Notifications are blocked for Forge in your device settings, so nothing can be delivered. Allow them there to use this.
          </div>
        )}
        {support.iosNeedsInstall && !notice && (
          <div className="notif-banner warn">
            On iPhone, notifications only work from the installed Home Screen app.
          </div>
        )}
      </section>

      {/* ── When ── */}
      <section className={`ps-card${d.enabled ? '' : ' dim'}`}>
        <h3 className="ps-card-title">When</h3>
        <div className="ps-seg" role="radiogroup" aria-label="How often">
          <button type="button" role="radio" aria-checked={d.mode === 'daily'} className={`ps-seg-btn${d.mode === 'daily' ? ' on' : ''}`} onClick={() => set({ mode: 'daily' })}>
            Every day
          </button>
          <button type="button" role="radio" aria-checked={d.mode === 'days'} className={`ps-seg-btn${d.mode === 'days' ? ' on' : ''}`} onClick={() => set({ mode: 'days' })}>
            Specific days
          </button>
        </div>

        {d.mode === 'days' && (
          <div className="ps-days" role="group" aria-label="Days of the week">
            {WEEKDAYS.map(w => {
              const on = d.days.includes(w.n);
              return (
                <button
                  key={w.n}
                  type="button"
                  aria-pressed={on}
                  aria-label={w.short}
                  className={`ps-day${on ? ' on' : ''}`}
                  onClick={() => {
                    const nextDays = on ? d.days.filter(x => x !== w.n) : [...d.days, w.n];
                    // The last remaining day cannot be removed: a schedule with
                    // no days would read as on and never send.
                    if (nextDays.length > 0) set({ days: nextDays });
                  }}
                >
                  {w.short}
                </button>
              );
            })}
          </div>
        )}

        <label className="ps-time-row">
          <span>Preferred time</span>
          <input
            type="time"
            className="inline-input notif-time-input"
            value={d.time}
            onChange={e => e.target.value && set({ time: e.target.value })}
            aria-label="Preferred time"
          />
        </label>
        <p className="ps-note">
          {describeDays(d)}, shortly after {formatTime(d.time)}. Forge checks every few minutes, so it
          usually arrives within a few minutes of this time, not on the exact minute. If it would be
          more than 90 minutes late it is skipped for that day.
        </p>

        {inQuiet && (
          <div className="notif-banner warn" data-testid="quiet-warning">
            😴 {formatTime(d.time)} is inside your quiet hours ({formatTime(quiet.start)}–{formatTime(quiet.end)}),
            so it will not be sent. Choose another time, or{' '}
            <button type="button" className="ps-inline-link" onClick={() => setEditQuiet(v => !v)}>change quiet hours</button>.
          </div>
        )}
        {(editQuiet || inQuiet) && editQuiet && (
          <div className="notif-quiet-row">
            <span className="notif-reminder-label">😴 Quiet hours</span>
            <div className="notif-reminder-controls">
              <input type="time" className="inline-input notif-time-input" value={quiet.start} aria-label="Quiet hours start"
                onChange={e => e.target.value && updateNotifPrefs({ quietHours: { start: e.target.value } })} />
              <span style={{ color: 'var(--text3)', fontSize: 12 }}>to</span>
              <input type="time" className="inline-input notif-time-input" value={quiet.end} aria-label="Quiet hours end"
                onChange={e => e.target.value && updateNotifPrefs({ quietHours: { end: e.target.value } })} />
            </div>
          </div>
        )}
      </section>

      {/* ── Which message ── */}
      <section className={`ps-card${d.enabled ? '' : ' dim'}`}>
        <h3 className="ps-card-title">Which message</h3>
        {onMessages.length === 0 ? (
          <p className="ps-note">
            You have no short messages switched on, so the notification will open your most recent letter.{' '}
            <button type="button" className="ps-inline-link" onClick={onGoToMessages}>Add a message</button>
          </p>
        ) : (
          <>
            <div className="ps-seg" role="radiogroup" aria-label="Which message is sent">
              <button type="button" role="radio" aria-checked={d.pick === 'rotate'} className={`ps-seg-btn${d.pick === 'rotate' ? ' on' : ''}`} onClick={() => set({ pick: 'rotate', messageId: null })}>
                Rotate
              </button>
              <button
                type="button" role="radio" aria-checked={d.pick === 'specific'}
                className={`ps-seg-btn${d.pick === 'specific' ? ' on' : ''}`}
                onClick={() => set({ pick: 'specific', messageId: d.messageId && onMessages.some(m => m.id === d.messageId) ? d.messageId : onMessages[0].id })}
              >
                One message
              </button>
            </div>
            {d.pick === 'rotate' ? (
              <p className="ps-note">
                Takes turns through your {onMessages.length} switched-on message{onMessages.length === 1 ? '' : 's'}, in order, one per delivery.
              </p>
            ) : (
              <ul className="ps-pick-list" role="radiogroup" aria-label="Message to send">
                {onMessages.map(m => (
                  <li key={m.id}>
                    <button
                      type="button" role="radio" aria-checked={d.messageId === m.id}
                      className={`ps-pick${d.messageId === m.id ? ' on' : ''}`}
                      onClick={() => set({ pick: 'specific', messageId: m.id })}
                    >
                      <span className="ps-pick-dot" aria-hidden="true" />
                      <span className="ps-pick-text">{m.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {/* ── Privacy ── */}
      <section className={`ps-card${d.enabled ? '' : ' dim'}`}>
        <h3 className="ps-card-title">On the lock screen</h3>
        <LockScreenPreview title={preview.title} body={preview.body} />
        <div className="ps-switch-row">
          <div className="ps-switch-text">
            <div className="ps-switch-title">Show my message in the notification</div>
            <div className="ps-switch-sub">
              {d.showContent
                ? 'Your own words appear on the lock screen.'
                : 'Private: the notification only says a message is ready.'}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={d.showContent}
            aria-label="Show my message in the notification"
            className={`toggle-btn${d.showContent ? ' on' : ''}`}
            disabled={onMessages.length === 0 && !d.showContent}
            onClick={() => set({ showContent: !d.showContent })}
          >
            {d.showContent ? 'On' : 'Off'}
          </button>
        </div>
        <p className="ps-note">
          {!d.showContent
            ? 'Nothing you have written leaves this device. Tap the notification to read your message inside Forge.'
            : d.pick === 'specific' && messages.length === 1
              ? 'To show your words while Forge is closed, the one message you chose is kept on Forge’s server. Your other messages and your letters are never uploaded. Switch this off to delete it from the server.'
              : `To show your words while Forge is closed, your ${messages.length} switched-on short message${messages.length === 1 ? ' is' : 's are'} kept on Forge’s server. Your letters are never uploaded. Switch this off to delete ${messages.length === 1 ? 'it' : 'them'} from the server.`}
        </p>
        <ServerLine server={server} delivery={d} active={active} />
      </section>

      {/* ── Try it ── */}
      <section className="ps-card">
        <h3 className="ps-card-title">Try it</h3>
        <p className="ps-note" data-testid="delivery-capability">
          {!support.supported
            ? 'This browser cannot show notifications.'
            : support.permission !== 'granted'
              ? 'Notifications are not allowed for Forge on this device yet.'
              : background
                ? 'On this device, messages arrive even when Forge is closed.'
                : 'On this device, messages arrive only while Forge is open — background delivery is not set up here.'}
        </p>
        <button
          type="button"
          className="btn btn-ghost btn-full"
          disabled={support.permission !== 'granted' || !sendable}
          onClick={sendTest}
        >
          Send a test notification now
        </button>
        {testStatus === 'sent' && <div className="update-status-row success"><span>✅</span><span>Sent. Tap it to see how your message opens.</span></div>}
        {testStatus === 'failed' && <div className="update-status-row warn"><span>⚠️</span><span>Couldn’t show a notification — check that they are allowed for Forge.</span></div>}
      </section>
    </div>
  );
}

/**
 * Whether anything on this device still sends through the push subscription
 * once `leaving` has switched past-self messages off: that profile's own
 * reminders, or the other profile's reminders or past-self messages.
 */
function pushStillNeeded(leaving, profiles, notifPrefs) {
  return ['me', 'girlfriend'].some(id =>
    notifPrefs?.[id]?.masterEnabled
    || (id !== leaving && deliveryActive(readPastSelf(profiles?.[id]))));
}

/** What the server says it is holding, said plainly — including "unknown". */
function ServerLine({ server, delivery, active }) {
  if (!PUSH_BACKEND_CONFIGURED || server.state === 'unavailable') {
    return (
      <p className="ps-server" data-testid="server-line">
        Nothing is stored on a server: this build cannot send while Forge is closed.
      </p>
    );
  }
  if (server.state === 'error') {
    return (
      <p className="ps-server warn" data-testid="server-line" role="alert">
        Couldn’t reach Forge’s server, so it may still be holding what it held before.{' '}
        <button type="button" className="ps-inline-link" onClick={requestPastSelfSync}>Retry</button>
      </p>
    );
  }
  if (server.state === 'idle' || server.state === 'syncing') {
    return <p className="ps-server" data-testid="server-line">Checking what Forge’s server is holding…</p>;
  }
  if (!active || !server.stored) {
    return <p className="ps-server" data-testid="server-line">On Forge’s server now: nothing.</p>;
  }
  if (server.contentStored > 0) {
    return (
      <p className="ps-server" data-testid="server-line">
        On Forge’s server now: your schedule and {server.contentStored} short message{server.contentStored === 1 ? '' : 's'}.
        {!delivery.showContent && ' Removing them…'}
      </p>
    );
  }
  return <p className="ps-server" data-testid="server-line">On Forge’s server now: your schedule only. None of your words.</p>;
}
