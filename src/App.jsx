import { useState, useEffect, useRef } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import ProfileSelector from './components/ProfileSelector';
import Dashboard from './components/Dashboard';
import DailyView from './components/DailyView';
import InsightsView from './components/InsightsView';
import ChallengesView from './components/ChallengesView';
import SettingsView from './components/SettingsView';
import BottomNav from './components/BottomNav';
import { applyUpdate } from './utils/swUtils.js';
import { getTodayStr } from './utils/dateUtils';
import {
  getDueReminders, getNotificationSupport, showNotification, markFired, syncPushSchedule,
  syncPastSelf, subscribeToPush, localSubscriptionState, alreadyFiredToday, inQuietHours,
  PUSH_BACKEND_CONFIGURED,
} from './utils/notificationUtils';
import FutureSelfSpace from './components/pastself/FutureSelfSpace';
import PastSelfReveal from './components/pastself/PastSelfReveal';
import { readPastSelf, buildSyncBody, deliveryActive, eligibleMessages, scheduledDays, todayLocalDate } from './utils/pastSelf';
import { buildPayload, isScheduledDay, PAST_SELF_TYPE, PAST_SELF_VIEW } from '../api/_lib/pastSelf.js';
import { CATCH_UP_MINUTES } from '../api/_lib/schedule.js';
import { setPastSelfStatus, onPastSelfSyncRequested } from './utils/pastSelfStatus';
import { challengeOf, isSharedTask, LANE } from './utils/challengeStack';
import { getTimezone } from './utils/installId';
import { computeTotalXP, getMWDComplete } from './utils/gamification';
import { displayXP, scaleOfMeta } from './utils/xpDisplay';
import { buildTimeline, entriesInLastNDays } from './utils/archiveUtils';
import { computeAveragesFromEntries, getPriorityBottleneck } from './utils/insightsUtils';

// Listens for the 'sw-update-available' event dispatched by swUtils
// and shows a fixed top banner. Rendered outside AppContent so it
// appears regardless of which screen is active.
function UpdateBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = () => setVisible(true);
    window.addEventListener('sw-update-available', handler);
    return () => window.removeEventListener('sw-update-available', handler);
  }, []);

  if (!visible) return null;

  return (
    <div className="update-banner" role="alert">
      <span>🆕 New version available</span>
      <button
        className="update-banner-btn"
        onClick={applyUpdate}
      >
        Tap to update →
      </button>
    </div>
  );
}

// In-app reminder scheduler. Runs a minute tick while the app is OPEN and
// shows due reminders through the service worker. Background delivery while
// the app is closed is the job of the (prepared, not yet configured) Web Push
// backend — this scheduler makes no such claim.
function NotificationScheduler() {
  const {
    activeProfile, profile, profiles, allDays, archives, notifPrefs,
    getChallengeMeta, getDayNumber, getDayCompletion, getRankState,
  } = useApp();

  // Signature of the last schedule pushed to the server — avoids redundant
  // /api/push/sync calls when nothing relevant changed between ticks.
  const lastSyncSig = useRef('');

  useEffect(() => {
    if (!activeProfile) return undefined;

    function tick() {
      const prefs = notifPrefs[activeProfile];
      if (!prefs) return;

      const dayNum = getDayNumber();
      if (!dayNum) return;
      const todayStr0 = getTodayStr();

      // When notifications are off there is nothing to deliver and no dynamic
      // content to render. Still push a "cleared" schedule once (so the server
      // stops considering this profile), then skip the heavier computation.
      if (!prefs.masterEnabled) {
        const sig = JSON.stringify({ off: true, tz: getTimezone(), date: todayStr0 });
        if (sig !== lastSyncSig.current) {
          lastSyncSig.current = sig;
          syncPushSchedule(activeProfile, prefs, { profileId: activeProfile, tasks: [] }, todayStr0);
        }
        return;
      }

      const dayData = (allDays[activeProfile] || {})[dayNum] || null;
      const meta = getChallengeMeta();
      const xpData = computeTotalXP(allDays, profiles, activeProfile, getDayCompletion, dayNum, dayNum);
      // Effective Lifetime XP from the shared rank state — notifications quote
      // the same figure the app displays, floor included.
      const rankState = getRankState();
      const lifetimeXP = rankState.xp;
      const timeline = buildTimeline(profile, allDays[activeProfile] || {}, archives[activeProfile] || []);
      const avg7 = computeAveragesFromEntries(entriesInLastNDays(timeline, 7));
      const bottleneck = getPriorityBottleneck(avg7, profile?.sleepTarget ?? 8);

      const ctx = {
        profileId: activeProfile,
        tasks: profile?.tasks || [],
        dayData,
        dayNumber: dayNum,
        // A challenge contributes reminders only while it is genuinely
        // running: not on Forge Daily, not before a scheduled start date, and
        // not once it has finished. getDayNumber() returning a day is what
        // "has begun" means here.
        challengeActive: !!dayNum && !!meta?.templateId && meta.templateId !== 'forge_daily',
        supportChallengeName: challengeOf(profile, LANE.SUPPORT)?.name || null,
        // Shared habits appear once in the merged task list, so this only
        // labels them — it is not what prevents duplicate reminders.
        isSharedTask,
        isMWD: !!dayData?.isMWD && !getMWDComplete(dayData),
        comebackActive: !!profile?.comebackMode?.active,
        hasSetback: false,
        challengeName: meta.name,
        lifetimeXP,
        rankState,
        // Display units, like lifetimeXP beside it: a notification quotes the
        // same figures the app shows, on the one ladder.
        xpScale: scaleOfMeta(meta),
        challengeXP: displayXP(xpData.total, scaleOfMeta(meta)),
        bottleneckLabel: bottleneck?.bottleneck ? bottleneck.label : null,
      };

      const todayStr = todayStr0;

      // Keep the server's background schedule in step with fresh local state.
      // Task completion only changes from inside the app, so re-syncing here
      // means the server's pre-rendered reminder copy is never staler than the
      // user's last in-app action. Throttled by a change signature.
      const sig = JSON.stringify({
        prefs,
        tz: getTimezone(),
        date: todayStr,
        done: (profile?.tasks || []).filter(t => dayData?.tasks?.[t.id]).map(t => t.id),
        // The reminder plan is derived from the task list, so a challenge
        // change has to re-sync even when the challenge name happens to match.
        tsig: (profile?.tasks || []).map(t => `${t.id}:${t.name}:${t.keystone || 0}`).join('|'),
        act: !!dayNum && !!meta?.templateId && meta.templateId !== 'forge_daily',
        mwd: ctx.isMWD,
        cn: ctx.challengeName,
        cb: ctx.comebackActive,
        bl: ctx.bottleneckLabel,
        // bucket lifetime XP so only meaningful milestone changes re-sync
        xpB: Math.floor((lifetimeXP || 0) / 50),
      });
      if (sig !== lastSyncSig.current) {
        lastSyncSig.current = sig;
        syncPushSchedule(activeProfile, prefs, ctx, todayStr);
      }

      // In-app delivery (while the app is open). Background delivery of the
      // time-based reminders is handled by the server from the synced schedule.
      const support = getNotificationSupport();
      if (!support.supported || support.permission !== 'granted') return;
      for (const reminder of getDueReminders(prefs, ctx, todayStr)) {
        showNotification(reminder);
        markFired(activeProfile, reminder.type, todayStr);
      }
    }

    tick();
    const id = setInterval(tick, 60 * 1000);
    return () => clearInterval(id);
  }, [activeProfile, profile, profiles, allDays, archives, notifPrefs, getChallengeMeta, getDayNumber, getDayCompletion, getRankState]);

  return null;
}

// Messages from your past self: keeps the server in step, and delivers in-app
// when the server cannot.
//
// A separate component from NotificationScheduler on purpose. The reminder
// scheduler replaces the whole reminder schedule on every sync and returns
// early when reminders are off or no challenge day exists; none of that should
// decide whether somebody receives their own words, and none of this should be
// able to disturb a reminder. They share nothing but the send-once log.
//
// ONE notification per scheduled message is guaranteed in two layers. The
// server claims a slot per profile per local date before it sends. And the
// in-app path below runs only when there is NO background push for this device
// to deliver through — so the two can never both fire for the same day.
// (PUSH_BACKEND_CONFIGURED comes from notificationUtils; it is never true in
// the iPhone app.)

function PastSelfScheduler() {
  const { activeProfile, profile, notifPrefs } = useApp();
  const lastSig = useRef({});            // profileId → signature last accepted by the server
  const ensuredSub = useRef({});         // profileId → subscription registered this session
  const [retry, setRetry] = useState(0);

  useEffect(() => onPastSelfSyncRequested(() => {
    lastSig.current = {};
    setRetry(n => n + 1);
  }), []);

  useEffect(() => {
    if (!activeProfile || !profile) return undefined;
    let cancelled = false;
    // The same default the reminders and the Delivery screen use, so what the
    // screen warns about and what the server honours cannot differ.
    const quietHours = notifPrefs?.[activeProfile]?.quietHours || { start: '22:30', end: '07:00' };

    async function sync() {
      const state = readPastSelf(profile);
      // A device that cannot show a notification has no use for a schedule on
      // the server, and certainly none for the user's words. So when permission
      // is missing — never granted, or taken away in the phone's settings —
      // whatever was stored for this device is removed rather than kept.
      const support = getNotificationSupport();
      const canReceive = support.supported && support.permission === 'granted';
      const body = canReceive
        ? buildSyncBody(state, { timezone: getTimezone(), quietHours })
        : { kind: 'pastSelf', enabled: false };
      // The date is part of the signature so an app opened on a new day syncs
      // once, which is what keeps the server record from expiring.
      const sig = JSON.stringify({ body, day: getTodayStr() });
      if (lastSig.current[activeProfile] === sig) return;

      if (!PUSH_BACKEND_CONFIGURED) {
        lastSig.current[activeProfile] = sig;
        setPastSelfStatus(activeProfile, { state: 'unavailable', stored: false, contentStored: 0 });
        return;
      }
      setPastSelfStatus(activeProfile, { state: 'syncing' });
      // Switched off: the subscription may be dropped, so it is not assumed
      // to be there the next time this is switched on.
      if (!body.enabled) ensuredSub.current[activeProfile] = false;
      if (body.enabled && !ensuredSub.current[activeProfile]) {
        // The server needs somewhere to send to, so make sure this device's
        // subscription is registered for this profile — once per session, and
        // NOT awaited: it waits on the service worker and the browser's push
        // service, either of which can stall, and the schedule must not be
        // held hostage to them. The two requests are independent server-side.
        ensuredSub.current[activeProfile] = true;
        subscribeToPush(activeProfile)
          .then(r => { if (!r?.ok) ensuredSub.current[activeProfile] = false; })
          .catch(() => { ensuredSub.current[activeProfile] = false; });
      }
      const res = await syncPastSelf(activeProfile, body);
      if (cancelled) return;
      if (res.ok) {
        lastSig.current[activeProfile] = sig;
        setPastSelfStatus(activeProfile, { state: 'ok', stored: res.stored, contentStored: res.contentStored });
      } else {
        // Not recorded as synced, so the next tick tries again. Until it
        // succeeds the screen says the server's state is unknown.
        setPastSelfStatus(activeProfile, { state: 'error' });
      }
    }

    async function deliverInApp() {
      const state = readPastSelf(profile);
      if (!deliveryActive(state)) return;
      const support = getNotificationSupport();
      if (!support.supported || support.permission !== 'granted') return;

      const now = new Date();
      const today = todayLocalDate(now);
      const d = state.delivery;
      const days = scheduledDays(d);
      if (!isScheduledDay(today, days)) return;
      if (inQuietHours(quietHours, now)) return;
      const [h, m] = d.time.split(':').map(Number);
      const late = now.getHours() * 60 + now.getMinutes() - (h * 60 + m);
      if (late < 0 || late > CATCH_UP_MINUTES) return;
      if (alreadyFiredToday(activeProfile, PAST_SELF_TYPE, today)) return;

      // Background push exists for this device: the server delivers, not us.
      // Asked fresh every time rather than remembered, because a subscription
      // created or dropped mid-session would otherwise leave both senders, or
      // neither, believing the message was theirs to send.
      if (PUSH_BACKEND_CONFIGURED) {
        const hasSub = !!(await localSubscriptionState()).hasSubscription;
        if (cancelled || hasSub) return;
        // Checked again: another tick may have sent while this one waited.
        if (alreadyFiredToday(activeProfile, PAST_SELF_TYPE, today)) return;
      }

      const messages = eligibleMessages(state);
      const payload = buildPayload({
        showContent: d.showContent && messages.length > 0,
        rotation: messages.map(x => ({ id: x.id, text: x.text })),
        days,
      }, today, activeProfile);
      markFired(activeProfile, PAST_SELF_TYPE, today);
      showNotification({
        title: payload.title, body: payload.body, tag: payload.tag, renotify: true, view: payload.view,
        data: { profile: activeProfile, date: today, ...(payload.msg ? { msg: payload.msg } : {}) },
      });
    }

    // Debounced: a change to the time picker fires on every step.
    const first = setTimeout(() => { sync(); deliverInApp(); }, 700);
    const id = setInterval(() => { sync(); deliverInApp(); }, 60 * 1000);
    return () => { cancelled = true; clearTimeout(first); clearInterval(id); };
  }, [activeProfile, profile, notifPrefs, retry]);

  return null;
}

// Challenge lifecycle: when a fixed-duration challenge has run past its final
// day, auto-complete it (archive + return to Forge Daily) so the app never
// stays frozen on "Day N of N". Checks on mount and every minute (to catch a
// date rollover while the app is open).
function ChallengeLifecycle() {
  const {
    activeProfile, profile, getRawDayNumber, getChallengeMeta, completeChallenge,
    getSupportDayNumber, getSupportMeta, completeSupportChallenge,
  } = useApp();

  useEffect(() => {
    if (!activeProfile || !profile?.challengeStart) return undefined;

    function check() {
      // The two lanes finish INDEPENDENTLY. The support challenge is checked
      // first and completed on its own terms — archiving it and clearing the
      // support slot — which never touches the primary's descriptor, start date,
      // day records, XP or score.
      const sMeta = getSupportMeta();
      if (sMeta?.durationDays != null) {
        const sDay = getSupportDayNumber();
        if (sDay != null && sDay > sMeta.durationDays) completeSupportChallenge();
      }

      const meta = getChallengeMeta();
      const duration = meta.durationDays;
      if (duration == null) return;                 // Forge Daily never completes
      if (meta.templateId === 'forge_daily') return;
      const raw = getRawDayNumber();
      if (raw != null && raw > duration) completeChallenge();
    }

    check();
    const id = setInterval(check, 60 * 1000);
    return () => clearInterval(id);
  }, [activeProfile, profile?.challengeStart, profile?.activeChallenge, profile?.supportChallenge,
      getRawDayNumber, getChallengeMeta, completeChallenge,
      getSupportDayNumber, getSupportMeta, completeSupportChallenge]);

  return null;
}

function AppContent() {
  const { activeProfile } = useApp();
  const [view, setView] = useState('home');
  // Letters to My Future Self is a place, not a tab: it remembers which screen
  // it was opened from so Back returns there, and which of its parts to show.
  const [space, setSpace] = useState({ from: 'home', tab: 'letters' });
  // A message from a past self being read. Held here, above the views, so a
  // notification can open it whatever screen the app happens to be on.
  const [reveal, setReveal] = useState(null);

  // Notification taps: the service worker posts FORGE_NAVIGATE with the
  // target view (also honors a ?view= param when opened cold).
  useEffect(() => {
    // A past-self message is not a screen to switch to. It opens over whatever
    // is showing, carrying the identifiers the notification was sent with.
    const openMessage = (src) => setReveal({
      msg: src.msg || null, profile: src.profile || null, date: src.date || null,
    });

    const params = new URLSearchParams(window.location.search);
    const target = params.get('view');
    if (target === PAST_SELF_VIEW) {
      openMessage({ msg: params.get('msg'), profile: params.get('profile'), date: params.get('date') });
      window.history.replaceState({}, '', '/');
    } else if (target && ['home', 'today', 'insights', 'challenges', 'settings'].includes(target)) {
      setView(target);
      window.history.replaceState({}, '', '/');
    }
    if (!('serviceWorker' in navigator)) return undefined;
    const handler = (e) => {
      if (e.data?.type !== 'FORGE_NAVIGATE' || !e.data.view) return;
      if (e.data.view === PAST_SELF_VIEW) { openMessage(e.data); return; }
      setView(e.data.view === 'calendar' ? 'today' : e.data.view);
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []);

  if (!activeProfile) {
    return <ProfileSelector />;
  }

  // The Calendar tab was removed — day editing happens through the Today
  // page's Day Selector, so any leftover navigation to it lands on Today.
  function navigate(v) {
    setView(v === 'calendar' ? 'today' : v);
  }

  function openFutureSelf(tab) {
    setSpace({ from: view === 'futureself' ? space.from : view, tab: tab || 'letters' });
    setView('futureself');
  }

  return (
    <div className="app" data-profile={activeProfile}>
      <main className="main-content">
        {view === 'home' && (
          <Dashboard
            setView={navigate}
            onOpenFutureSelf={openFutureSelf}
            onReadPastSelf={() => setReveal({ profile: activeProfile, date: null, msg: null })}
          />
        )}
        {view === 'today' && <DailyView editDayNum={null} setView={navigate} />}
        {view === 'insights'   && <InsightsView />}
        {view === 'challenges' && <ChallengesView setView={navigate} />}
        {view === 'settings'   && <SettingsView setView={navigate} onOpenFutureSelf={openFutureSelf} />}
        {view === 'futureself' && (
          <FutureSelfSpace
            key={`${activeProfile}:${space.tab}`}
            initialTab={space.tab}
            onBack={() => setView(space.from || 'home')}
            onPreviewMessage={(id) => setReveal({ profile: activeProfile, msg: id, date: null })}
          />
        )}
      </main>
      {/* The bottom bar has no tab for it; the screen it was opened from stays lit. */}
      <BottomNav view={view === 'futureself' ? (space.from || 'home') : view} setView={navigate} />
      {reveal && (
        <PastSelfReveal
          target={reveal}
          onClose={() => setReveal(null)}
          onOpenSpace={openFutureSelf}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      {/* Banner lives outside AppContent so it renders on every screen */}
      <UpdateBanner />
      <NotificationScheduler />
      <PastSelfScheduler />
      <ChallengeLifecycle />
      <AppContent />
    </AppProvider>
  );
}
