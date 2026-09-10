import { habitKeyOf, isSameHabit, stricterOf, HABIT_LABELS } from '../data/habitKeys';
import { getTodayStr, dayNumberForDate, getDateForDayNumber } from './dateUtils';
import { challengeDayNumber } from './challengeSchedule';

/**
 * Challenge Combination — the single source of truth for the challenge stack.
 *
 * Forge runs at most TWO challenges at once, in two named LANES:
 *
 *   PRIMARY — the user's main goal. Stored exactly where a single challenge has
 *             always been stored: profile.activeChallenge + profile.challengeStart.
 *   SUPPORT — an optional complementary goal, in profile.supportChallenge +
 *             profile.supportChallengeStart. Absent (null) means one challenge,
 *             which behaves precisely as it always has.
 *
 * ── Why the task list is not split ──────────────────────────────────────────
 * profile.tasks remains the ONE daily task list the user sees and checks off,
 * exactly as before. Adding a support challenge appends only its NON-duplicate
 * tasks; a requirement both challenges share stays a single row. Each task
 * carries provenance:
 *
 *   task.challenges : ['primary'] | ['support'] | ['primary','support']
 *
 * An absent `challenges` field means primary (that is every task written before
 * this feature, and every task the user adds by hand), so the migration is a
 * no-op and single-challenge behaviour is bit-for-bit unchanged.
 *
 * Because one behaviour is one row in one list, XP deduplication is structural
 * rather than a rule that has to be enforced: there is simply no second entry to
 * pay out. Per-challenge adherence is then a FILTER over that list, so a shared
 * task counts toward both challenges while paying XP once.
 */

export const LANE = { PRIMARY: 'primary', SUPPORT: 'support' };

// ── Lane accessors ──────────────────────────────────────────────────────────

/** The challenge descriptor for a lane, or null. */
export function challengeOf(profile, lane) {
  if (!profile) return null;
  return lane === LANE.SUPPORT ? (profile.supportChallenge || null) : (profile.activeChallenge || null);
}

/** The Day 1 date for a lane, or null. */
export function startOf(profile, lane) {
  if (!profile) return null;
  return lane === LANE.SUPPORT ? (profile.supportChallengeStart || null) : (profile.challengeStart || null);
}

/** True when a support challenge is configured at all. */
export function hasSupportChallenge(profile) {
  return !!(profile?.supportChallenge && profile?.supportChallengeStart);
}

/**
 * The lane's current day number, or null when it has not begun (a scheduled
 * future start) or does not exist. Reuses the scheduled-start rules so a support
 * challenge can be scheduled ahead exactly like a primary one.
 */
export function laneDayNumber(profile, lane, todayStr = getTodayStr()) {
  const start = startOf(profile, lane);
  if (!start || !challengeOf(profile, lane)) return null;
  return challengeDayNumber(start, todayStr);
}

/** True once a lane has run past its final day. */
export function laneIsComplete(profile, lane, todayStr = getTodayStr()) {
  const meta = challengeOf(profile, lane);
  const n = laneDayNumber(profile, lane, todayStr);
  if (!meta?.durationDays || n == null) return false;
  return n > meta.durationDays;
}

/**
 * Map a lane's day number onto the day-record key used by `allDays`.
 *
 * Day records are keyed by the PRIMARY day number and always have been. A
 * support challenge with its own start date therefore resolves through the
 * shared calendar date: support day N → date → primary day number. That keeps
 * every stored day record exactly where it is — no re-keying, no migration.
 *
 * Returns null when there is no primary anchor or the date falls before it.
 */
export function recordKeyForLaneDay(profile, lane, laneDay) {
  if (lane === LANE.PRIMARY) return laneDay;
  const supportStart = startOf(profile, LANE.SUPPORT);
  const primaryStart = startOf(profile, LANE.PRIMARY);
  if (!supportStart || !primaryStart || !laneDay) return null;
  const date = getDateForDayNumber(supportStart, laneDay);
  if (!date || date < primaryStart) return null;
  return dayNumberForDate(primaryStart, date);
}

// ── Task provenance ─────────────────────────────────────────────────────────

/**
 * Lanes a task belongs to. An absent field means primary — the pre-feature
 * default, and what a user-added custom task gets.
 */
export function lanesOfTask(task) {
  const list = Array.isArray(task?.challenges) ? task.challenges.filter(Boolean) : null;
  return list && list.length ? list : [LANE.PRIMARY];
}

/** True when a task counts toward the given lane. */
export function taskInLane(task, lane) {
  return lanesOfTask(task).includes(lane);
}

/** True when one row satisfies both challenges at once. */
export function isSharedTask(task) {
  const lanes = lanesOfTask(task);
  return lanes.includes(LANE.PRIMARY) && lanes.includes(LANE.SUPPORT);
}

/** The subset of the daily task list that counts toward one lane. */
export function tasksForLane(tasks, lane) {
  return (tasks || []).filter(t => taskInLane(t, lane));
}

/**
 * "Supports: Muscle Building + Mental Training" for a shared row, else null.
 * Derived from the two challenge descriptors, so nothing extra is stored.
 */
export function supportsLabel(task, profile) {
  if (!isSharedTask(task)) return null;
  const p = challengeOf(profile, LANE.PRIMARY)?.name;
  const s = challengeOf(profile, LANE.SUPPORT)?.name;
  if (!p || !s) return null;
  return `Supports: ${p} + ${s}`;
}

/**
 * "Also supports Fat Loss" for a shared row, else null.
 *
 * The short form used inside the Today list, where the enclosing section header
 * already names the primary challenge — so only the OTHER challenge needs
 * naming. Derived from the descriptors; nothing extra is stored.
 */
export function alsoSupportsLabel(task, profile) {
  if (!isSharedTask(task)) return null;
  const support = challengeOf(profile, LANE.SUPPORT)?.name;
  return support ? `Also supports ${support}` : null;
}

/** How Manage Tasks labels a row's ownership. */
export const OWNERSHIP = { PRIMARY: 'primary', SUPPORT: 'support', SHARED: 'shared' };
export const OWNERSHIP_LABEL = {
  [OWNERSHIP.PRIMARY]: 'Primary',
  [OWNERSHIP.SUPPORT]: 'Support',
  [OWNERSHIP.SHARED]: 'Shared',
};

/**
 * A task's ownership, derived from its lane provenance — never from its name.
 * A row in both lanes is SHARED; otherwise it belongs to the single lane it
 * declares, defaulting to primary for every pre-feature and user-added task.
 */
export function ownershipOf(task) {
  if (isSharedTask(task)) return OWNERSHIP.SHARED;
  return taskInLane(task, LANE.SUPPORT) ? OWNERSHIP.SUPPORT : OWNERSHIP.PRIMARY;
}

/**
 * The daily list grouped into its two lanes for DISPLAY.
 *
 * Purely a view over the one stored list — it reorders and partitions, and never
 * adds, removes or rewrites a row. A shared habit appears in the PRIMARY group
 * and nowhere else, so it renders exactly once and can never be checked or paid
 * for twice; `shared` is returned separately only so callers can label it.
 *
 * Order matches the product spec: primary-only by importance, then the shared
 * rows, then support-only by importance. `sort` is the caller's existing
 * importance sort, applied WITHIN each group so the established ordering rules
 * are preserved rather than replaced.
 */
export function groupTasksForDisplay(tasks, sort = (x) => x) {
  const list = tasks || [];
  const primaryOnly = sort(list.filter(t => taskInLane(t, LANE.PRIMARY) && !isSharedTask(t)));
  const shared = sort(list.filter(isSharedTask));
  const supportOnly = sort(list.filter(t => taskInLane(t, LANE.SUPPORT) && !isSharedTask(t)));
  return {
    primary: [...primaryOnly, ...shared],
    support: supportOnly,
    shared,
    primaryOnly,
    supportOnly,
  };
}

// ── Merging a support challenge into the daily list ─────────────────────────

/**
 * Merge a support challenge's tasks into the existing daily list.
 *
 * Returns { tasks, merges } where `merges` describes every deduplicated habit
 * (for the confirmation screen and for tests). Rules:
 *
 *   • Same habit (matching habitKey, or the same task id) → ONE row, tagged for
 *     both lanes. It is never duplicated, so it never pays XP twice.
 *   • Differing targets → the STRICTER requirement wins, and the row keeps that
 *     wording. Meeting the stricter target necessarily meets the looser one, so
 *     both challenges are genuinely satisfied.
 *   • Targets that cannot be compared (missing or different units) → the primary
 *     wording is kept and the merge is flagged `targetConflict`, so the UI can
 *     say so rather than pretending a choice was made on the merits.
 *   • The merged row keeps the PRIMARY's id and XP value. Keeping the id means
 *     every stored completion for that task still resolves; keeping the XP means
 *     adding a support challenge can never re-price the primary's economy.
 *   • Support-only tasks are appended with their own id and XP — genuinely new
 *     work, genuinely new XP.
 */
export function mergeSupportTasks(primaryTasks, supportTasks) {
  const out = (primaryTasks || []).map(t => ({ ...t, challenges: lanesOfTask(t) }));
  const merges = [];

  for (const st of supportTasks || []) {
    const idx = out.findIndex(pt => isSameHabit(pt, st));
    if (idx === -1) {
      out.push({ ...st, challenges: [LANE.SUPPORT] });
      continue;
    }
    const pt = out[idx];
    const stricter = stricterOf(pt, st);
    const useSupportWording = stricter === 'b';
    const targetConflict = stricter === null && (pt.name !== st.name);

    out[idx] = {
      ...pt,
      // Stricter wording (and its target/description) wins; the id and XP stay
      // the primary's so history and the XP economy are untouched.
      name: useSupportWording ? st.name : pt.name,
      desc: useSupportWording ? (st.desc || pt.desc) : pt.desc,
      target: useSupportWording ? st.target : pt.target,
      habitKey: habitKeyOf(pt),
      challenges: [LANE.PRIMARY, LANE.SUPPORT],
      // Enough metadata to explain the merge without re-deriving it.
      mergedFrom: { primary: pt.id, support: st.id },
      targetConflict: targetConflict || undefined,
    };
    merges.push({
      habitKey: habitKeyOf(pt),
      label: HABIT_LABELS[habitKeyOf(pt)] || pt.name,
      kept: useSupportWording ? st.name : pt.name,
      dropped: useSupportWording ? pt.name : st.name,
      stricter: useSupportWording ? LANE.SUPPORT : LANE.PRIMARY,
      targetConflict,
      xp: pt.xp,
    });
  }
  return { tasks: out.map((t, i) => ({ ...t, order: i })), merges };
}

/**
 * Remove a support challenge's contribution from the daily list.
 *
 * Support-only rows are dropped; shared rows revert to primary-only and keep
 * their id, so every completion already recorded against them survives. The
 * primary challenge is untouched in every respect.
 */
export function stripSupportTasks(tasks) {
  const out = [];
  for (const t of tasks || []) {
    const lanes = lanesOfTask(t);
    if (!lanes.includes(LANE.PRIMARY)) continue;      // support-only → gone
    if (!lanes.includes(LANE.SUPPORT)) { out.push(t); continue; }
    const { mergedFrom, targetConflict, ...rest } = t;
    out.push({ ...rest, challenges: [LANE.PRIMARY] });
  }
  return out.map((t, i) => ({ ...t, order: i }));
}

/**
 * Preview the merge without applying it — used by the confirmation screen to
 * say exactly how many rows will be added and which habits will be shared.
 */
export function previewMerge(primaryTasks, supportTasks) {
  const { tasks, merges } = mergeSupportTasks(primaryTasks, supportTasks);
  return {
    merges,
    addedCount: tasks.length - (primaryTasks || []).length,
    sharedCount: merges.length,
    totalCount: tasks.length,
  };
}
