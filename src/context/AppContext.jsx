import { createContext, useContext, useState, useCallback } from 'react';
import { getTodayStr, getDayNumberFromStart, getDateForDayNumber } from '../utils/dateUtils';
import { SOURCES } from '../data/defaultQuotes';
import { computeAverages } from '../utils/insightsUtils';

export const MENTAL_OPTIONS = [
  { id: 'breathwork',    label: '5 min breathwork',             icon: '🫁' },
  { id: 'meditation',    label: '5 min meditation',             icon: '🧘' },
  { id: 'journaling',    label: '5 min journaling',             icon: '📝' },
  { id: 'visualization', label: 'Visualization',                icon: '🎯' },
  { id: 'reframe',       label: 'Reframe one negative thought', icon: '💭' },
  { id: 'do_avoided',    label: 'Do one thing I was avoiding',  icon: '⚡' },
  { id: 'no_phone',      label: '30 min no phone before bed',   icon: '📵' },
];

const DEFAULT_TASKS_ME = [
  { id: 'workout',   name: '45-minute workout complete', icon: '🏋️', order: 0 },
  { id: 'diet',      name: 'Diet followed',              icon: '🥗',  order: 1 },
  { id: 'water',     name: 'Water goal hit',             icon: '💧',  order: 2 },
  { id: 'reading',   name: '10 pages read',              icon: '📚',  order: 3 },
  { id: 'photo',     name: 'Progress photo taken',       icon: '📸',  order: 4 },
  { id: 'sleep_log', name: 'Sleep/energy logged',        icon: '😴',  order: 5 },
  { id: 'mental',    name: 'Mental training complete',   icon: '🧠',  order: 6 },
];

const DEFAULT_TASKS_GF = [
  { id: 'gf_workout', name: '45-minute workout complete',            color: '#FF6B6B', order: 0  },
  { id: 'gf_diet',    name: 'Eat clean / diet followed',             color: '#6BCB77', order: 1  },
  { id: 'gf_photo',   name: 'Progress photo taken',                  color: '#74B9FF', order: 2  },
  { id: 'gf_mental',  name: 'Mental training complete',              color: '#A78BFA', order: 3  },
  { id: 'gf_bed',     name: 'Make my bed',                           color: '#FF8FAB', order: 4  },
  { id: 'gf_room',    name: 'Tidy up my room',                       color: '#4ECDC4', order: 5  },
  { id: 'gf_skin',    name: 'Take care of my skin',                  color: '#45B7D1', order: 6  },
  { id: 'gf_walk',    name: 'Walk 10,000 steps',                     color: '#FFB347', order: 7  },
  { id: 'gf_water',   name: 'Drink water',                           color: '#74B9FF', order: 8  },
  { id: 'gf_read',    name: 'Read a few pages or listen to a podcast', color: '#DDA0DD', order: 9 },
  { id: 'gf_meals',   name: 'Prep meals for tomorrow',               color: '#F9E04B', order: 10 },
  { id: 'gf_screen',  name: 'Limit screen time 30 min before bed',   color: '#A8E6CF', order: 11 },
];

const DEFAULT_QUOTE_SETTINGS = {
  enabledSources: [...SOURCES],
  favorites: [],
  showReflectionTask: false,
};

function makeDefaultProfiles() {
  return {
    me: {
      id: 'me',
      name: 'Joey',
      emoji: '💪',
      challengeStart: null,
      tasks: DEFAULT_TASKS_ME,
      quoteSettings: { ...DEFAULT_QUOTE_SETTINGS },
      customQuotes: [],
    },
    girlfriend: {
      id: 'girlfriend',
      name: 'Girlfriend',
      emoji: '🌸',
      challengeStart: null,
      tasks: DEFAULT_TASKS_GF,
      quoteSettings: { ...DEFAULT_QUOTE_SETTINGS },
      customQuotes: [],
    },
  };
}

function emptyDay(date, dayNumber) {
  return {
    date,
    dayNumber,
    tasks: {},
    mentalTraining: { selected: null, completed: false, notes: '' },
    mood: 0,
    confidence: 0,
    sleep: 0,
    energy: 0,
    recovery: 0,
    workoutEffort: 0,
    stress: 0,
    notes: '',
    glucoseNotes: '',
    hoursSlept: 0,
    validated: false,
    isMWD: false,
    mwdTasks: {},
  };
}

function loadLS(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function saveLS(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

/**
 * Safe migration — never removes or overwrites user data.
 * Runs once at startup.
 */
function migrateProfiles(stored) {
  const profiles = { ...stored };
  let changed = false;

  // Ensure both profile slots always exist
  if (!profiles.me) { profiles.me = makeDefaultProfiles().me; changed = true; }
  if (!profiles.girlfriend) { profiles.girlfriend = makeDefaultProfiles().girlfriend; changed = true; }

  // Joey — rename old 'workout' task name (preserves ID so history is intact)
  {
    const tasks = profiles.me.tasks || [];
    const w = tasks.find(t => t.id === 'workout');
    if (w && w.name === 'Workout complete') {
      profiles.me = {
        ...profiles.me,
        tasks: tasks.map(t =>
          t.id === 'workout' ? { ...t, name: '45-minute workout complete' } : t
        ),
      };
      changed = true;
    }
  }

  // Girlfriend — add any missing required tasks (appended at end, stable IDs)
  {
    const tasks = profiles.girlfriend.tasks || [];
    const required = [
      { id: 'gf_workout', name: '45-minute workout complete', color: '#FF6B6B' },
      { id: 'gf_diet',    name: 'Eat clean / diet followed',  color: '#6BCB77' },
      { id: 'gf_photo',   name: 'Progress photo taken',       color: '#74B9FF' },
      { id: 'gf_mental',  name: 'Mental training complete',   color: '#A78BFA' },
    ];
    let newTasks = [...tasks];
    let maxOrder = tasks.length > 0 ? Math.max(...tasks.map(t => t.order ?? 0)) : -1;
    let addedAny = false;
    for (const req of required) {
      if (!tasks.find(t => t.id === req.id)) {
        maxOrder++;
        newTasks.push({ ...req, order: maxOrder });
        addedAny = true;
      }
    }
    if (addedAny) {
      profiles.girlfriend = { ...profiles.girlfriend, tasks: newTasks };
      changed = true;
    }
  }

  // Both profiles — add quoteSettings, customQuotes, and faith flags if missing
  for (const profId of ['me', 'girlfriend']) {
    if (!profiles[profId].quoteSettings) {
      profiles[profId] = {
        ...profiles[profId],
        quoteSettings: { ...DEFAULT_QUOTE_SETTINGS },
      };
      changed = true;
    } else if (!profiles[profId].quoteSettings.enabledSources) {
      profiles[profId] = {
        ...profiles[profId],
        quoteSettings: { ...DEFAULT_QUOTE_SETTINGS, ...profiles[profId].quoteSettings },
      };
      changed = true;
    }
    if (!profiles[profId].customQuotes) {
      profiles[profId] = { ...profiles[profId], customQuotes: [] };
      changed = true;
    }
    if (profiles[profId].faithEnabled === undefined) {
      profiles[profId] = { ...profiles[profId], faithEnabled: false };
      changed = true;
    }
    if (profiles[profId].faithCountsToward === undefined) {
      profiles[profId] = { ...profiles[profId], faithCountsToward: false };
      changed = true;
    }
    if (profiles[profId].sleepTarget === undefined) {
      profiles[profId] = { ...profiles[profId], sleepTarget: 8 };
      changed = true;
    }
    if (profiles[profId].sleepAutoComplete === undefined) {
      profiles[profId] = { ...profiles[profId], sleepAutoComplete: true };
      changed = true;
    }
  }

  // Joey — add sleep_target task if missing
  {
    const tasks = profiles.me.tasks || [];
    if (!tasks.find(t => t.id === 'sleep_target')) {
      const maxOrder = tasks.length > 0 ? Math.max(...tasks.map(t => t.order ?? 0)) : -1;
      profiles.me = {
        ...profiles.me,
        tasks: [...tasks, { id: 'sleep_target', name: 'Sleep target met', icon: '😴', order: maxOrder + 1 }],
      };
      changed = true;
    }
  }

  // Girlfriend — add gf_sleep_target task if missing
  {
    const tasks = profiles.girlfriend.tasks || [];
    if (!tasks.find(t => t.id === 'gf_sleep_target')) {
      const maxOrder = tasks.length > 0 ? Math.max(...tasks.map(t => t.order ?? 0)) : -1;
      profiles.girlfriend = {
        ...profiles.girlfriend,
        tasks: [...tasks, { id: 'gf_sleep_target', name: 'Sleep target met', color: '#DDA0DD', order: maxOrder + 1 }],
      };
      changed = true;
    }
  }

  // Both profiles — add comebackMode and comebackHistory if missing
  for (const profId of ['me', 'girlfriend']) {
    if (!profiles[profId].comebackMode) {
      profiles[profId] = {
        ...profiles[profId],
        comebackMode: { active: false, dayStart: null, dismissedAt: null },
      };
      changed = true;
    }
    if (!profiles[profId].comebackHistory) {
      profiles[profId] = { ...profiles[profId], comebackHistory: [] };
      changed = true;
    }
  }

  if (changed) saveLS('profiles', profiles);
  return profiles;
}

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [activeProfile, setActiveProfileState] = useState(() => loadLS('activeProfile', null));
  const [profiles, setProfilesState] = useState(() =>
    migrateProfiles(loadLS('profiles', makeDefaultProfiles()))
  );
  const [allDays, setAllDaysState] = useState(() => loadLS('allDays', { me: {}, girlfriend: {} }));
  // Per-date quote data: { me: { '2024-01-15': { cycleOffset, reflectionNotes, reflectionComplete } }, girlfriend: {} }
  const [quoteData, setQuoteDataState] = useState(() => loadLS('quoteData', { me: {}, girlfriend: {} }));
  // Experiments: { me: [...], girlfriend: [...] }
  const [experiments, setExperimentsState] = useState(() => loadLS('experiments', { me: [], girlfriend: [] }));
  // Dismissed hints: { me: { habitId: expiryDateStr }, girlfriend: {} }
  const [dismissedHints, setDismissedHintsState] = useState(() => loadLS('dismissedHints', { me: {}, girlfriend: {} }));

  const setActiveProfile = useCallback((id) => {
    setActiveProfileState(id);
    saveLS('activeProfile', id);
  }, []);

  const setProfiles = useCallback((updater) => {
    setProfilesState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveLS('profiles', next);
      return next;
    });
  }, []);

  const setAllDays = useCallback((updater) => {
    setAllDaysState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveLS('allDays', next);
      return next;
    });
  }, []);

  const setQuoteData = useCallback((updater) => {
    setQuoteDataState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveLS('quoteData', next);
      return next;
    });
  }, []);

  const setExperiments = useCallback((updater) => {
    setExperimentsState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveLS('experiments', next);
      return next;
    });
  }, []);

  const setDismissedHints = useCallback((updater) => {
    setDismissedHintsState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveLS('dismissedHints', next);
      return next;
    });
  }, []);

  const profile = profiles[activeProfile] || null;
  const days = (activeProfile && allDays[activeProfile]) || {};

  const getDayNumber = useCallback((profId = activeProfile) => {
    const start = profiles[profId]?.challengeStart;
    if (!start) return null;
    const n = getDayNumberFromStart(start);
    return Math.min(n, 75);
  }, [activeProfile, profiles]);

  const getDayData = useCallback((dayNumber) => {
    return days[dayNumber] || null;
  }, [days]);

  const getTodayData = useCallback(() => {
    const n = getDayNumber();
    if (!n) return null;
    const start = profile?.challengeStart;
    const date = getDateForDayNumber(start, n);
    return days[n] || emptyDay(date, n);
  }, [getDayNumber, days, profile]);

  const updateDay = useCallback((dayNumber, updates) => {
    if (!activeProfile) return;
    setAllDays(prev => {
      const profDays = prev[activeProfile] || {};
      const existing = profDays[dayNumber] || emptyDay(null, dayNumber);
      return {
        ...prev,
        [activeProfile]: {
          ...profDays,
          [dayNumber]: { ...existing, ...updates },
        },
      };
    });
  }, [activeProfile, setAllDays]);

  const toggleTask = useCallback((dayNumber, taskId) => {
    if (!activeProfile) return;
    setAllDays(prev => {
      const profDays = prev[activeProfile] || {};
      const existing = profDays[dayNumber] || emptyDay(null, dayNumber);
      return {
        ...prev,
        [activeProfile]: {
          ...profDays,
          [dayNumber]: {
            ...existing,
            tasks: { ...existing.tasks, [taskId]: !existing.tasks[taskId] },
          },
        },
      };
    });
  }, [activeProfile, setAllDays]);

  const getDayCompletion = useCallback((dayNumber, profId = activeProfile) => {
    const tasks = profiles[profId]?.tasks || [];
    if (!tasks.length) return 0;
    const dayData = (allDays[profId] || {})[dayNumber];
    if (!dayData) return 0;
    const done = tasks.filter(t => dayData.tasks[t.id]).length;
    const faithEnabled    = profiles[profId]?.faithEnabled;
    const faithCounts     = profiles[profId]?.faithCountsToward;
    const faithCompleted  = dayData.faithReflection?.completed;
    const extra     = (faithEnabled && faithCounts) ? 1 : 0;
    const extraDone = (faithEnabled && faithCounts && faithCompleted) ? 1 : 0;
    return Math.round(((done + extraDone) / (tasks.length + extra)) * 100);
  }, [activeProfile, profiles, allDays]);

  const getStreak = useCallback((profId = activeProfile) => {
    const dayNum = getDayNumber(profId);
    if (!dayNum) return 0;
    const profDays = allDays[profId] || {};
    const tasks = profiles[profId]?.tasks || [];
    if (!tasks.length) return 0;
    let streak = 0;
    for (let i = dayNum; i >= 1; i--) {
      const d = profDays[i];
      if (!d) break;
      const done = tasks.filter(t => d.tasks[t.id]).length;
      if (done === tasks.length) streak++;
      else break;
    }
    return streak;
  }, [activeProfile, allDays, profiles, getDayNumber]);

  const getLongestStreak = useCallback((profId = activeProfile) => {
    const dayNum = getDayNumber(profId);
    if (!dayNum) return 0;
    const profDays = allDays[profId] || {};
    const tasks = profiles[profId]?.tasks || [];
    if (!tasks.length) return 0;
    let max = 0, cur = 0;
    for (let i = 1; i <= dayNum; i++) {
      const d = profDays[i];
      const done = d ? tasks.filter(t => d.tasks[t.id]).length : 0;
      if (done === tasks.length) { cur++; max = Math.max(max, cur); }
      else cur = 0;
    }
    return max;
  }, [activeProfile, allDays, profiles, getDayNumber]);

  const startChallenge = useCallback((profId = activeProfile) => {
    setProfiles(prev => ({
      ...prev,
      [profId]: { ...prev[profId], challengeStart: getTodayStr() },
    }));
    setAllDays(prev => ({ ...prev, [profId]: {} }));
  }, [activeProfile, setProfiles, setAllDays]);

  // Update start date without wiping saved day data — used for backfilling
  const setChallengeStart = useCallback((dateStr, profId = activeProfile) => {
    if (!dateStr) return;
    setProfiles(prev => ({
      ...prev,
      [profId]: { ...prev[profId], challengeStart: dateStr },
    }));
  }, [activeProfile, setProfiles]);

  const resetChallenge = useCallback((profId = activeProfile) => {
    setProfiles(prev => ({
      ...prev,
      [profId]: { ...prev[profId], challengeStart: null },
    }));
    setAllDays(prev => ({ ...prev, [profId]: {} }));
  }, [activeProfile, setProfiles, setAllDays]);

  const updateProfile = useCallback((updates) => {
    if (!activeProfile) return;
    setProfiles(prev => ({
      ...prev,
      [activeProfile]: { ...prev[activeProfile], ...updates },
    }));
  }, [activeProfile, setProfiles]);

  const addTask = useCallback((taskData) => {
    if (!activeProfile) return;
    const tasks = profile?.tasks || [];
    const newTask = { id: `task_${Date.now()}`, order: tasks.length, ...taskData };
    updateProfile({ tasks: [...tasks, newTask] });
  }, [activeProfile, profile, updateProfile]);

  const updateTask = useCallback((taskId, updates) => {
    if (!activeProfile) return;
    const tasks = profile?.tasks || [];
    updateProfile({ tasks: tasks.map(t => t.id === taskId ? { ...t, ...updates } : t) });
  }, [activeProfile, profile, updateProfile]);

  const deleteTask = useCallback((taskId) => {
    if (!activeProfile) return;
    const tasks = profile?.tasks || [];
    updateProfile({ tasks: tasks.filter(t => t.id !== taskId).map((t, i) => ({ ...t, order: i })) });
  }, [activeProfile, profile, updateProfile]);

  const reorderTasks = useCallback((newTasks) => {
    updateProfile({ tasks: newTasks.map((t, i) => ({ ...t, order: i })) });
  }, [updateProfile]);

  // ── Quote actions ──────────────────────────────────────────────────────

  const updateQuoteSettings = useCallback((updates) => {
    if (!activeProfile) return;
    setProfiles(prev => ({
      ...prev,
      [activeProfile]: {
        ...prev[activeProfile],
        quoteSettings: { ...prev[activeProfile].quoteSettings, ...updates },
      },
    }));
  }, [activeProfile, setProfiles]);

  const addCustomQuote = useCallback((quoteData) => {
    if (!activeProfile) return;
    const quotes = profile?.customQuotes || [];
    const newQ = { id: `q_custom_${Date.now()}`, isInspired: true, ...quoteData };
    updateProfile({ customQuotes: [...quotes, newQ] });
  }, [activeProfile, profile, updateProfile]);

  const updateCustomQuote = useCallback((id, updates) => {
    if (!activeProfile) return;
    const quotes = profile?.customQuotes || [];
    updateProfile({ customQuotes: quotes.map(q => q.id === id ? { ...q, ...updates } : q) });
  }, [activeProfile, profile, updateProfile]);

  const deleteCustomQuote = useCallback((id) => {
    if (!activeProfile) return;
    const quotes = profile?.customQuotes || [];
    const qs = profile?.quoteSettings || {};
    updateProfile({
      customQuotes: quotes.filter(q => q.id !== id),
      quoteSettings: { ...qs, favorites: (qs.favorites || []).filter(fid => fid !== id) },
    });
  }, [activeProfile, profile, updateProfile]);

  const toggleFavoriteQuote = useCallback((quoteId) => {
    if (!activeProfile) return;
    const favs = profile?.quoteSettings?.favorites || [];
    const next = favs.includes(quoteId)
      ? favs.filter(id => id !== quoteId)
      : [...favs, quoteId];
    updateQuoteSettings({ favorites: next });
  }, [activeProfile, profile, updateQuoteSettings]);

  const getQuoteDataForDate = useCallback((dateStr) => {
    if (!activeProfile) return null;
    return (quoteData[activeProfile] || {})[dateStr] || null;
  }, [activeProfile, quoteData]);

  const updateQuoteDataForDate = useCallback((dateStr, updates) => {
    if (!activeProfile) return;
    setQuoteData(prev => {
      const profData = prev[activeProfile] || {};
      const existing = profData[dateStr] || { cycleOffset: 0, reflectionNotes: '', reflectionComplete: false };
      return {
        ...prev,
        [activeProfile]: {
          ...profData,
          [dateStr]: { ...existing, ...updates },
        },
      };
    });
  }, [activeProfile, setQuoteData]);

  // ── Insights / Experiment actions ──────────────────────────────────────

  const startExperiment = useCallback((habitId, habitName, baselineDayNums, startDayNum) => {
    if (!activeProfile) return;
    const tasks = profiles[activeProfile]?.tasks || [];
    const profDays = allDays[activeProfile] || {};
    const baseline = computeAverages(baselineDayNums, profDays, tasks);
    const exp = {
      id: `exp_${Date.now()}`,
      habitId,
      habitName,
      startDayNum,
      endDayNum: startDayNum + 6,
      status: 'active',
      baseline,
      result: null,
      startedAt: getTodayStr(),
    };
    setExperiments(prev => ({
      ...prev,
      [activeProfile]: [...(prev[activeProfile] || []), exp],
    }));
  }, [activeProfile, profiles, allDays, setExperiments]);

  const updateExperiment = useCallback((expId, updates) => {
    if (!activeProfile) return;
    setExperiments(prev => ({
      ...prev,
      [activeProfile]: (prev[activeProfile] || []).map(e =>
        e.id === expId ? { ...e, ...updates } : e
      ),
    }));
  }, [activeProfile, setExperiments]);

  const dismissHint = useCallback((habitId) => {
    if (!activeProfile) return;
    // Expires 7 days from today
    const today = getTodayStr();
    const expiry = new Date(today);
    expiry.setDate(expiry.getDate() + 7);
    const expiryStr = expiry.toISOString().slice(0, 10);
    setDismissedHints(prev => ({
      ...prev,
      [activeProfile]: {
        ...(prev[activeProfile] || {}),
        [habitId]: expiryStr,
      },
    }));
  }, [activeProfile, setDismissedHints]);

  // ── Comeback Mode actions ──────────────────────────────────────────────────

  const startComeback = useCallback((dayNumber) => {
    if (!activeProfile) return;
    setProfiles(prev => ({
      ...prev,
      [activeProfile]: {
        ...prev[activeProfile],
        comebackMode: { active: true, dayStart: dayNumber, dismissedAt: null },
      },
    }));
  }, [activeProfile, setProfiles]);

  const dismissComeback = useCallback((dayNumber) => {
    if (!activeProfile) return;
    setProfiles(prev => ({
      ...prev,
      [activeProfile]: {
        ...prev[activeProfile],
        comebackMode: { active: false, dayStart: null, dismissedAt: dayNumber },
      },
    }));
  }, [activeProfile, setProfiles]);

  const completeComeback = useCallback((startDay) => {
    if (!activeProfile) return;
    setProfiles(prev => {
      const p = prev[activeProfile];
      return {
        ...prev,
        [activeProfile]: {
          ...p,
          comebackMode: { active: false, dayStart: null, dismissedAt: null },
          comebackHistory: [...(p.comebackHistory || []), { startDay, completed: true }],
        },
      };
    });
  }, [activeProfile, setProfiles]);

  return (
    <AppContext.Provider value={{
      activeProfile, profile, profiles, days, allDays,
      setActiveProfile,
      getDayNumber, getDayData, getTodayData,
      getDayCompletion, getStreak, getLongestStreak,
      updateDay, toggleTask,
      startChallenge, resetChallenge, setChallengeStart, updateProfile,
      addTask, updateTask, deleteTask, reorderTasks,
      MENTAL_OPTIONS,
      // Quote
      quoteData,
      updateQuoteSettings,
      addCustomQuote, updateCustomQuote, deleteCustomQuote,
      toggleFavoriteQuote,
      getQuoteDataForDate, updateQuoteDataForDate,
      // Insights
      experiments, dismissedHints,
      startExperiment, updateExperiment, dismissHint,
      // Comeback
      startComeback, dismissComeback, completeComeback,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}
