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
import { getDueReminders, getNotificationSupport, showNotification, markFired, syncPushSchedule } from './utils/notificationUtils';
import { getTimezone } from './utils/installId';
import { computeTotalXP, computeLifetimeXP, getMWDComplete } from './utils/gamification';
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
    getChallengeMeta, getDayNumber, getDayCompletion,
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
      const lifetimeXP = computeLifetimeXP(archives[activeProfile], xpData.rawTotal || 0);
      const timeline = buildTimeline(profile, allDays[activeProfile] || {}, archives[activeProfile] || []);
      const avg7 = computeAveragesFromEntries(entriesInLastNDays(timeline, 7));
      const bottleneck = getPriorityBottleneck(avg7, profile?.sleepTarget ?? 8);

      const ctx = {
        profileId: activeProfile,
        tasks: profile?.tasks || [],
        dayData,
        isMWD: !!dayData?.isMWD && !getMWDComplete(dayData),
        comebackActive: !!profile?.comebackMode?.active,
        hasSetback: false,
        challengeName: meta.name,
        lifetimeXP,
        challengeXP: xpData.total,
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
  }, [activeProfile, profile, profiles, allDays, archives, notifPrefs, getChallengeMeta, getDayNumber, getDayCompletion]);

  return null;
}

// Challenge lifecycle: when a fixed-duration challenge has run past its final
// day, auto-complete it (archive + return to Forge Daily) so the app never
// stays frozen on "Day N of N". Checks on mount and every minute (to catch a
// date rollover while the app is open).
function ChallengeLifecycle() {
  const { activeProfile, profile, getRawDayNumber, getChallengeMeta, completeChallenge } = useApp();

  useEffect(() => {
    if (!activeProfile || !profile?.challengeStart) return undefined;

    function check() {
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
  }, [activeProfile, profile?.challengeStart, profile?.activeChallenge, getRawDayNumber, getChallengeMeta, completeChallenge]);

  return null;
}

function AppContent() {
  const { activeProfile } = useApp();
  const [view, setView] = useState('home');

  // Notification taps: the service worker posts FORGE_NAVIGATE with the
  // target view (also honors a ?view= param when opened cold).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const target = params.get('view');
    if (target && ['home', 'today', 'insights', 'challenges', 'settings'].includes(target)) {
      setView(target);
      window.history.replaceState({}, '', '/');
    }
    if (!('serviceWorker' in navigator)) return undefined;
    const handler = (e) => {
      if (e.data?.type === 'FORGE_NAVIGATE' && e.data.view) {
        setView(e.data.view === 'calendar' ? 'today' : e.data.view);
      }
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

  return (
    <div className="app" data-profile={activeProfile}>
      <main className="main-content">
        {view === 'home' && <Dashboard setView={navigate} />}
        {view === 'today' && <DailyView editDayNum={null} setView={navigate} />}
        {view === 'insights'   && <InsightsView />}
        {view === 'challenges' && <ChallengesView setView={navigate} />}
        {view === 'settings'   && <SettingsView setView={navigate} />}
      </main>
      <BottomNav view={view} setView={navigate} />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      {/* Banner lives outside AppContent so it renders on every screen */}
      <UpdateBanner />
      <NotificationScheduler />
      <ChallengeLifecycle />
      <AppContent />
    </AppProvider>
  );
}
