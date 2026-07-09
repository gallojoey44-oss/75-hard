import { createContext, useContext, useState, useCallback } from 'react';
import { getTodayStr, getDayNumberFromStart, getDateForDayNumber } from '../utils/dateUtils';
import { SOURCES } from '../data/defaultQuotes';
import { computeAverages } from '../utils/insightsUtils';
import { computeTotalXP, computeBadges } from '../utils/gamification';
import { getTemplateById } from '../data/challengeTemplates';

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

// Legacy profiles (before v3.4.0) have no activeChallenge descriptor —
// they are always the original 75-day discipline challenge.
export const DEFAULT_CHALLENGE_META = {
  templateId: '75_day_discipline_challenge',
  name: '75-Day Discipline Challenge',
  emoji: '🔥',
  variant: null,
  durationDays: 75,
};

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

  // Task-list migrations only apply to the original 75-day challenge —
  // profiles running a template challenge (e.g. Mental Training Phase) manage
  // their task list through the template, not these defaults.
  const onDefaultChallenge = (profId) => {
    const meta = profiles[profId]?.activeChallenge;
    return !meta || meta.templateId === '75_day_discipline_challenge';
  };

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
  if (onDefaultChallenge('girlfriend')) {
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
  if (onDefaultChallenge('me')) {
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
  if (onDefaultChallenge('girlfriend')) {
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
    if (profiles[profId].xpPenalties === undefined) {
      profiles[profId] = { ...profiles[profId], xpPenalties: true };
      changed = true;
    }
    if (profiles[profId].xpOffset === undefined) {
      profiles[profId] = { ...profiles[profId], xpOffset: 0 };
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
  // Challenge archives: { me: [archiveEntry], girlfriend: [] } — never wiped by
  // starting a new challenge; feeds lifetime XP and long-term Insights trends.
  const [archives, setArchivesState] = useState(() => loadLS('archives', { me: [], girlfriend: [] }));

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

  const setArchives = useCallback((updater) => {
    setArchivesState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveLS('archives', next);
      return next;
    });
  }, []);

  const profile = profiles[activeProfile] || null;
  const days = (activeProfile && allDays[activeProfile]) || {};

  const getChallengeMeta = useCallback((profId = activeProfile) => {
    return profiles[profId]?.activeChallenge || DEFAULT_CHALLENGE_META;
  }, [activeProfile, profiles]);

  const getDayNumber = useCallback((profId = activeProfile) => {
    const start = profiles[profId]?.challengeStart;
    if (!start) return null;
    const n = getDayNumberFromStart(start);
    const duration = (profiles[profId]?.activeChallenge?.durationDays) || 75;
    return Math.min(n, duration);
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

  /**
   * Snapshot everything about the current challenge into an archive entry:
   * tasks, full day history (completions, ratings, notes, sleep, recovery,
   * workout effort, stress, mental training, faith reflection), quote
   * reflections, XP earned, badges earned, and comeback history.
   * Returns null when there is nothing worth archiving.
   */
  const buildArchiveEntry = useCallback((profId) => {
    const prof = profiles[profId];
    const profDays = allDays[profId] || {};
    if (!prof?.challengeStart || Object.keys(profDays).length === 0) return null;

    const meta = prof.activeChallenge || DEFAULT_CHALLENGE_META;
    const dayNum = Math.min(getDayNumberFromStart(prof.challengeStart) || 1, meta.durationDays || 75);
    const xpData = computeTotalXP(allDays, profiles, profId, getDayCompletion, dayNum, dayNum);
    const badges = computeBadges(allDays, profiles, profId, getDayCompletion, dayNum).map(b => b.id);

    // Quote reflections logged during this challenge's date range
    const endDate = getDateForDayNumber(prof.challengeStart, dayNum);
    const profQuotes = quoteData[profId] || {};
    const challengeQuotes = {};
    for (const [date, q] of Object.entries(profQuotes)) {
      if (date >= prof.challengeStart && date <= endDate) challengeQuotes[date] = q;
    }

    return {
      id: `arch_${Date.now()}`,
      archivedAt: getTodayStr(),
      challenge: { ...meta },
      challengeStart: prof.challengeStart,
      endDayNum: dayNum,
      endDate,
      tasks: prof.tasks || [],
      days: profDays,
      quoteData: challengeQuotes,
      xpEarned: Math.max(0, xpData.rawTotal),
      badges,
      comebackHistory: prof.comebackHistory || [],
      xpOffset: prof.xpOffset ?? 0,
      xpStartDay: prof.xpStartDay ?? 1,
    };
  }, [profiles, allDays, quoteData, getDayCompletion]);

  /**
   * Start a new challenge. The current challenge (if any) is archived first —
   * nothing is deleted. Only active-challenge progress resets: day data,
   * challenge XP, and comeback state. Lifetime data (archives, quote
   * reflections, experiments, profile settings) is preserved.
   *
   * options (all optional):
   *   challenge — { templateId, name, emoji, variant, durationDays } descriptor
   *   tasks     — task list for the new challenge; replaces the profile's daily
   *               tasks (the outgoing list is preserved in the archive entry)
   */
  const startChallenge = useCallback((profId = activeProfile, options = null) => {
    const entry = buildArchiveEntry(profId);
    if (entry) {
      setArchives(prev => ({ ...prev, [profId]: [...(prev[profId] || []), entry] }));
    }
    const meta = options?.challenge ? { ...DEFAULT_CHALLENGE_META, ...options.challenge } : { ...DEFAULT_CHALLENGE_META };
    setProfiles(prev => ({
      ...prev,
      [profId]: {
        ...prev[profId],
        challengeStart: getTodayStr(),
        activeChallenge: meta,
        ...(options?.tasks ? { tasks: options.tasks.map((t, i) => ({ ...t, source: 'template', order: i })) } : {}),
        xpOffset: 0,
        xpStartDay: 1,
        comebackMode: { active: false, dayStart: null, dismissedAt: null },
        comebackHistory: [],
      },
    }));
    setAllDays(prev => ({ ...prev, [profId]: {} }));
  }, [activeProfile, buildArchiveEntry, setArchives, setProfiles, setAllDays]);

  /**
   * Restore an archived challenge as the active one. If a challenge is
   * currently running with logged data, it is archived first — no data loss.
   */
  const restoreArchive = useCallback((archiveId, profId = activeProfile) => {
    const list = archives[profId] || [];
    const entry = list.find(a => a.id === archiveId);
    if (!entry) return;

    let newList = list.filter(a => a.id !== archiveId);
    const activeEntry = buildArchiveEntry(profId);
    if (activeEntry) newList = [...newList, activeEntry];

    setArchives(prev => ({ ...prev, [profId]: newList }));
    setProfiles(prev => ({
      ...prev,
      [profId]: {
        ...prev[profId],
        challengeStart: entry.challengeStart,
        activeChallenge: entry.challenge ? { ...entry.challenge } : { ...DEFAULT_CHALLENGE_META },
        tasks: entry.tasks?.length ? entry.tasks : prev[profId].tasks,
        comebackMode: { active: false, dayStart: null, dismissedAt: null },
        comebackHistory: entry.comebackHistory || [],
        xpOffset: entry.xpOffset ?? 0,
        xpStartDay: entry.xpStartDay ?? 1,
      },
    }));
    setAllDays(prev => ({ ...prev, [profId]: entry.days || {} }));
  }, [activeProfile, archives, buildArchiveEntry, setArchives, setProfiles, setAllDays]);

  /**
   * True when the active challenge was started from an older version of its
   * template (only variant-based templates carry a version).
   */
  const isChallengeTemplateOutdated = useCallback((profId = activeProfile) => {
    const prof = profiles[profId];
    const meta = prof?.activeChallenge;
    if (!prof?.challengeStart || !meta) return false;
    const tpl = getTemplateById(meta.templateId);
    if (!tpl || tpl.start_flow !== 'variant' || !meta.variant) return false;
    if (!tpl.variants?.[meta.variant]?.start_tasks) return false;
    return (meta.templateVersion || 1) < (tpl.template_version || 1);
  }, [activeProfile, profiles]);

  /**
   * Resolve whether a task is template-owned or user-added. Tasks saved
   * before the source field existed are inferred safely: an id that belongs
   * to the active template (any variant, or its id prefix) is template-owned;
   * anything else — including tasks added via Manage Tasks — is custom.
   */
  const getTaskSource = useCallback((task, profId = activeProfile) => {
    if (task?.source === 'template' || task?.source === 'custom') return task.source;
    const meta = profiles[profId]?.activeChallenge;
    const tpl = meta ? getTemplateById(meta.templateId) : null;
    if (!tpl || tpl.start_flow !== 'variant') return 'custom';
    for (const v of Object.values(tpl.variants || {})) {
      if ((v.start_tasks || []).some(t => t.id === task.id)) return 'template';
    }
    if (tpl.task_id_prefix && task.id?.startsWith(tpl.task_id_prefix)) return 'template';
    return 'custom';
  }, [activeProfile, profiles]);

  /**
   * Sync the active challenge's task list with the latest version of its
   * template (same variant). Only template-owned tasks are refreshed:
   * new template tasks are added, outdated template tasks are removed, and
   * user-added custom tasks are always preserved (appended after the
   * template tasks, keeping their relative order).
   *
   * Nothing resets: challenge start date, day data, XP history, and archives
   * are untouched. Task IDs are stable across template versions, so saved
   * completion for matching tasks (template and custom) is preserved; flags
   * for removed tasks stay in the day records (ignored, never deleted) and
   * new tasks simply start unchecked going forward.
   */
  const syncActiveChallengeWithTemplate = useCallback((profId = activeProfile) => {
    const prof = profiles[profId];
    const meta = prof?.activeChallenge;
    if (!prof?.challengeStart || !meta) return;
    const tpl = getTemplateById(meta.templateId);
    const variantDef = tpl?.variants?.[meta.variant];
    if (!variantDef?.start_tasks) return;

    const templateTasks = variantDef.start_tasks.map(t => ({ ...t, source: 'template' }));
    const customTasks = [...(prof.tasks || [])]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .filter(t => getTaskSource(t, profId) === 'custom')
      .map(t => ({ ...t, source: 'custom' }));

    setProfiles(prev => ({
      ...prev,
      [profId]: {
        ...prev[profId],
        tasks: [...templateTasks, ...customTasks].map((t, i) => ({ ...t, order: i })),
        activeChallenge: { ...prev[profId].activeChallenge, templateVersion: tpl.template_version || 1 },
      },
    }));
  }, [activeProfile, profiles, getTaskSource, setProfiles]);

  const deleteArchive = useCallback((archiveId, profId = activeProfile) => {
    setArchives(prev => ({
      ...prev,
      [profId]: (prev[profId] || []).filter(a => a.id !== archiveId),
    }));
  }, [activeProfile, setArchives]);

  /**
   * Advanced danger-zone option: permanently delete ALL data for one profile —
   * active challenge, archives, lifetime XP, quotes, experiments. The other
   * profile's data is untouched.
   */
  const deleteAllProfileData = useCallback((profId = activeProfile) => {
    const defaults = makeDefaultProfiles()[profId];
    setProfiles(prev => ({ ...prev, [profId]: defaults }));
    setAllDays(prev => ({ ...prev, [profId]: {} }));
    setArchives(prev => ({ ...prev, [profId]: [] }));
    setQuoteData(prev => ({ ...prev, [profId]: {} }));
    setExperiments(prev => ({ ...prev, [profId]: [] }));
    setDismissedHints(prev => ({ ...prev, [profId]: {} }));
  }, [activeProfile, setProfiles, setAllDays, setArchives, setQuoteData, setExperiments, setDismissedHints]);

  // Update start date without wiping saved day data — used for backfilling
  const setChallengeStart = useCallback((dateStr, profId = activeProfile) => {
    if (!dateStr) return;
    setProfiles(prev => ({
      ...prev,
      [profId]: { ...prev[profId], challengeStart: dateStr },
    }));
  }, [activeProfile, setProfiles]);

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
    // Tasks added through Manage Tasks (or Insights) are user-owned:
    // template syncs must never remove them.
    const newTask = { id: `task_${Date.now()}`, order: tasks.length, source: 'custom', ...taskData };
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

  // ── XP actions ────────────────────────────────────────────────────────────

  const resetXP = useCallback(() => {
    if (!activeProfile) return;
    const dayNum = getDayNumber();
    if (!dayNum) return;
    const { total } = computeTotalXP(allDays, profiles, activeProfile, getDayCompletion, dayNum, dayNum);
    setProfiles(prev => ({
      ...prev,
      [activeProfile]: {
        ...prev[activeProfile],
        xpOffset: (prev[activeProfile].xpOffset || 0) - total,
      },
    }));
  }, [activeProfile, allDays, profiles, getDayCompletion, getDayNumber, setProfiles]);

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
      getChallengeMeta, getDayNumber, getDayData, getTodayData,
      getDayCompletion, getStreak, getLongestStreak,
      updateDay, toggleTask,
      startChallenge, setChallengeStart, updateProfile,
      // Archives
      archives, restoreArchive, deleteArchive, deleteAllProfileData,
      // Template sync
      isChallengeTemplateOutdated, syncActiveChallengeWithTemplate, getTaskSource,
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
      // XP
      resetXP,
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
