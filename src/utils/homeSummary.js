import { getTodayStr, getDateForDayNumber, formatDateShort } from './dateUtils';
import { computeDayXP, requiredTasksForDay, RANKS, BADGE_DEFS } from './gamification';
import { dayRules } from '../data/xpEconomy';
import { displayXP, scaleOfMeta, scaleOfArchive } from './xpDisplay';

/**
 * What Home says about you, derived from what Forge actually stored.
 *
 * Home is the screen most tempted to invent things — a streak that looks good,
 * a "global rank", a win that never happened. Nothing here is written by hand:
 * every figure is read from a day record, an archive, the rank ladder or the
 * badge table, and anything that cannot be read is left out rather than
 * estimated. A milestone with no stored date does not appear in a dated feed;
 * a badge whose criterion Forge cannot measure shows no progress bar.
 *
 * Everything is pure. It takes state and returns plain objects, so the whole
 * surface is unit-testable without a browser.
 */

// ── Segments ────────────────────────────────────────────────────────────────

/**
 * Every period that has day records, newest last, each with its OWN rate card.
 *
 * XP is not comparable across segments until it is scaled: an era-1 attempt
 * stored a day worth 25 where era 2 stores 250, and the lifetime balance
 * counts each segment on its own scale. Carrying the meta with the days is
 * what lets a figure be priced by the rules it was earned under and then shown
 * on the ladder the balance moves on.
 */
export function buildSegments(profile, activeDays, archiveList) {
  const segments = [];

  for (const arch of archiveList || []) {
    if (!arch?.challengeStart) continue;
    segments.push({
      id: arch.id || `arch_${arch.challengeStart}`,
      archived: true,
      meta: arch.challenge || null,
      start: arch.challengeStart,
      endDate: arch.endDate || arch.archivedAt || null,
      days: arch.days || {},
      tasks: arch.tasks || [],
      scale: scaleOfArchive(arch),
      archive: arch,
    });
  }

  if (profile?.challengeStart) {
    segments.push({
      id: 'current',
      archived: false,
      meta: profile.activeChallenge || null,
      start: profile.challengeStart,
      endDate: null,
      days: activeDays || {},
      tasks: profile.tasks || [],
      scale: scaleOfMeta(profile.activeChallenge),
      archive: null,
    });
  }

  return segments.sort((a, b) => (a.start < b.start ? -1 : 1));
}

/**
 * One date's record, from whichever segment owns it.
 *
 * Later segments win, which matters only where an archive and the live attempt
 * overlap a date — and there the live attempt is the one the user is looking
 * at. Returns null for a date nothing was logged under.
 */
function recordsByDate(segments) {
  const byDate = new Map();
  for (const seg of segments) {
    for (const [n, data] of Object.entries(seg.days || {})) {
      if (!data) continue;
      const date = data.date || getDateForDayNumber(seg.start, Number(n));
      if (!date) continue;
      byDate.set(date, { date, dayNum: Number(n), data, seg });
    }
  }
  return byDate;
}

/** The share of a day's REQUIRED habits that were ticked, 0–100. */
function completionOf(entry) {
  if (!entry) return null;
  const { seg, dayNum, data } = entry;
  const tasks = requiredTasksForDay(seg.tasks, seg.meta, seg.start, dayNum);
  if (!tasks.length) return null;
  const done = tasks.filter(t => data?.tasks?.[t.id]).length;
  return Math.round((done / tasks.length) * 100);
}

// ── Consistency ─────────────────────────────────────────────────────────────

const DOW_LABEL = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function shiftDate(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * The last seven days, ending today, as they really went.
 *
 * Rolling rather than Monday-to-Sunday: this is an ADHERENCE read, and on a
 * Tuesday a calendar week is five empty circles that say nothing about how
 * someone is doing. Seven real days always carry seven real answers, and the
 * row still reads as weekdays because each day keeps its own letter.
 *
 * Days before any challenge began are `none`, not missed — Forge does not
 * charge someone for the days before they started. `perfect` counts only 100%
 * days, out of the days that actually count, so the ratio never flatters or
 * punishes by counting days that were never in play.
 */
export function recentConsistency(segments, todayStr = getTodayStr(), span = 7) {
  const byDate = recordsByDate(segments);
  // A day only counts if a challenge was actually running on it. The gap
  // between one attempt ending and the next beginning is not a missed day —
  // nobody promised anything then — so it reads as untracked, not as failure.
  const ranges = segments.map(s => ({
    from: s.start,
    to: s.archived ? (s.endDate ? String(s.endDate).slice(0, 10) : s.start) : todayStr,
  }));
  const tracked = (date) => ranges.some(r => date >= r.from && date <= r.to);

  const days = [];
  let perfect = 0;
  let counted = 0;
  let logged = 0;

  for (let i = span - 1; i >= 0; i--) {
    const date = shiftDate(todayStr, -i);
    const isToday = date === todayStr;
    const untracked = !tracked(date);
    const entry = byDate.get(date) || null;
    const pct = completionOf(entry);

    let state;
    if (untracked) state = 'none';
    else if (pct === 100) state = 'done';
    else if (pct > 0) state = 'partial';
    // Today is not a missed day — it is not over yet.
    else if (isToday) state = 'today';
    else state = 'missed';

    if (!untracked) {
      counted += 1;
      if (pct === 100) perfect += 1;
      if (pct > 0) logged += 1;
    }

    days.push({
      date,
      dow: new Date(date + 'T00:00:00').getDay(),
      label: DOW_LABEL[new Date(date + 'T00:00:00').getDay()],
      pct: pct ?? 0,
      state,
      isToday,
    });
  }

  return { days, perfect, counted, logged, span };
}

// ── Recent wins ─────────────────────────────────────────────────────────────

/**
 * What a day was worth, on the ladder the lifetime balance moves on.
 *
 * Priced with the segment's own rate card, then scaled once at this display
 * edge — the same two steps every other XP figure in Forge takes.
 */
function dayXPFor(entry, { penaltiesOn = true } = {}) {
  if (!entry) return 0;
  const { seg, dayNum, data } = entry;
  const tasks = requiredTasksForDay(seg.tasks, seg.meta, seg.start, dayNum);
  if (!tasks.length) return 0;
  const rules = dayRules(seg.meta);
  // A past day, evaluated as finalised: `currentRawDay` sits beyond it so the
  // day is judged complete rather than still in progress.
  const { gained } = computeDayXP(
    data, tasks, null, dayNum, dayNum, penaltiesOn, dayNum + 1, rules,
  );
  return displayXP(gained, seg.scale);
}

/**
 * Milestones worth remembering, newest first — and only ones Forge can date.
 *
 * Three kinds, because these are the three Forge actually records a date for:
 * a rank unlocked, a challenge finished, and a day completed in full. Badges
 * are deliberately absent: Forge stores which ones are held, never when they
 * were earned, and a feed that invents the date of an achievement is worse
 * than one that leaves it out. Comebacks are absent for the same reason —
 * `comebackHistory` records the day it started, not the day it finished.
 */
export function recentWins({ segments, rankHistory = [], todayStr = getTodayStr(), limit = 5, penaltiesOn = true }) {
  const wins = [];

  // A rank is permanent and dated at the moment it was unlocked. A backfilled
  // rank carries `date: null` and is skipped — it was never a moment.
  for (const h of rankHistory) {
    if (!h?.date) continue;
    wins.push({
      kind: 'rank',
      date: h.date,
      icon: '🏅',
      title: `Reached ${h.name}`,
      detail: h.philosophy || RANKS[(h.rank || 1) - 1]?.philosophy || '',
      xp: null,
      // The balance at the moment it unlocked — not XP this event awarded, so
      // it is labelled as a standing total rather than shown as a gain.
      xpLabel: h.lifetimeXP ? `at ${Math.round(h.lifetimeXP).toLocaleString()} XP` : null,
    });
  }

  // A finished challenge carries its own banked total, already in its own era's
  // units, so it is scaled by that archive's scale and no other.
  for (const seg of segments) {
    if (!seg.archived || !seg.archive) continue;
    const a = seg.archive;
    const date = a.endDate || a.archivedAt;
    if (!date) continue;
    const passed = a.passed === true;
    const ended = a.endedEarly === true;
    wins.push({
      kind: 'challenge',
      date: String(date).slice(0, 10),
      icon: ended ? '🎗️' : passed ? '🏆' : '🏁',
      title: ended
        ? `Ended ${a.challenge?.name || 'a challenge'} early`
        : `${passed ? 'Passed' : 'Completed'} ${a.challenge?.name || 'a challenge'}`,
      detail: a.scoreAvailable && a.finalScore != null
        ? `${a.finalScore}% final score${a.endDayNum ? ` · ${a.endDayNum} days` : ''}`
        : (a.endDayNum ? `${a.endDayNum} days` : ''),
      xp: displayXP(a.xpEarned || 0, seg.scale),
      xpLabel: null,
    });
  }

  // Perfect days, from the records themselves. Only completed days count, and
  // only ones on or before today — a future-dated record is not a win yet.
  const byDate = recordsByDate(segments);
  for (const entry of byDate.values()) {
    if (entry.date > todayStr) continue;
    if (completionOf(entry) !== 100) continue;
    wins.push({
      kind: 'perfect',
      date: entry.date,
      icon: '✅',
      title: 'Perfect day',
      detail: entry.seg.meta?.name
        ? `Every habit · ${entry.seg.meta.name}`
        : 'Every habit completed',
      xp: dayXPFor(entry, { penaltiesOn }),
      xpLabel: null,
    });
  }

  wins.sort((a, b) => (a.date === b.date ? rankOfKind(b) - rankOfKind(a) : (a.date < b.date ? 1 : -1)));
  return wins.slice(0, limit).map(w => ({ ...w, when: whenLabel(w.date, todayStr) }));
}

/** On a shared date, the rarer thing leads. */
function rankOfKind(w) {
  return w.kind === 'rank' ? 3 : w.kind === 'challenge' ? 2 : 1;
}

function whenLabel(date, todayStr) {
  if (date === todayStr) return 'Today';
  if (date === shiftDate(todayStr, -1)) return 'Yesterday';
  return formatDateShort(date);
}

// ── Milestones ahead ────────────────────────────────────────────────────────

/**
 * Streak badges are the only ones with a number Forge can count toward.
 *
 * The rest of the table is measured from rating patterns and challenge
 * completions — real criteria, but not ones that reduce to "x of y". Those
 * appear as locked achievements with their description and no invented
 * progress.
 */
const STREAK_BADGE_TARGET = {
  streak_3: 3, streak_7: 7, streak_14: 14, streak_30: 30,
};

/**
 * What is close, in order of closeness.
 *
 * The next rank is always included when one exists, because it is the one
 * milestone that is always measurable and always moving. Streak badges follow
 * with real progress; everything else unearned is offered as a locked
 * achievement without a figure.
 */
export function nextMilestones({ rankState, earnedBadgeIds = new Set(), streak = 0, limit = 3 }) {
  const out = [];
  const badges = [];

  for (const [id, target] of Object.entries(STREAK_BADGE_TARGET)) {
    if (earnedBadgeIds.has(id)) continue;
    const def = BADGE_DEFS.find(b => b.id === id);
    if (!def) continue;
    badges.push({
      id,
      kind: 'badge',
      icon: def.emoji,
      label: def.label,
      detail: `${Math.min(streak, target)} of ${target} days`,
      pct: Math.max(0, Math.min(100, Math.round((streak / target) * 100))),
      have: Math.min(streak, target),
      need: target,
    });
  }

  // The next rank always leads, however far off it is. It is the one milestone
  // that never stops being relevant, and sorting it by closeness buries it on
  // the very day someone arrives at a new tier — exactly when they want to see
  // where the next one is. The badges that follow are sorted by closeness.
  if (rankState?.next) {
    out.push({
      id: `rank_${rankState.next.rank}`,
      kind: 'rank',
      icon: '🏛',
      label: rankState.next.name,
      detail: `${Math.round(rankState.xpToNext).toLocaleString()} XP to go`,
      pct: rankState.progress,
      have: Math.round(rankState.xpIntoTier),
      need: Math.round(rankState.tierSpan),
    });
  }

  badges.sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
  return [...out, ...badges].slice(0, limit);
}

/** Every badge, split into held and not held, for the full collection. */
export function badgeCollection(earnedBadgeIds = new Set()) {
  const earned = [];
  const locked = [];
  for (const def of BADGE_DEFS) {
    (earnedBadgeIds.has(def.id) ? earned : locked).push(def);
  }
  return { earned, locked, total: BADGE_DEFS.length };
}
