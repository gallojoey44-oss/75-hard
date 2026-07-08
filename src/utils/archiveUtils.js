import { getDateForDayNumber, getTodayStr } from './dateUtils';

/**
 * Build a unified, date-keyed timeline of logged days across all archived
 * challenges plus the active challenge. Each entry:
 *   { date: 'YYYY-MM-DD', data: dayData, tasks: [...], source: 'active'|'archive' }
 *
 * Tasks are the task list that was in effect for that challenge, so completion
 * percentages stay accurate even if the task list changed between challenges.
 * When the same calendar date exists in both an archive and the active
 * challenge, the active entry wins.
 */
export function buildTimeline(profile, activeDays, archiveList) {
  const byDate = new Map();

  for (const arch of archiveList || []) {
    const tasks = arch.tasks || [];
    for (const [n, data] of Object.entries(arch.days || {})) {
      if (!data) continue;
      const date = data.date || getDateForDayNumber(arch.challengeStart, +n);
      if (date) byDate.set(date, { date, data, tasks, source: 'archive' });
    }
  }

  if (profile?.challengeStart) {
    const tasks = profile.tasks || [];
    for (const [n, data] of Object.entries(activeDays || {})) {
      if (!data) continue;
      const date = getDateForDayNumber(profile.challengeStart, +n);
      if (date) byDate.set(date, { date, data, tasks, source: 'active' });
    }
  }

  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/**
 * Entries from the last N calendar days (inclusive of today), regardless of
 * which challenge they belong to.
 */
export function entriesInLastNDays(timeline, n, todayStr = getTodayStr()) {
  const cutoff = new Date(todayStr + 'T00:00:00');
  cutoff.setDate(cutoff.getDate() - (n - 1));
  const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
  return timeline.filter(e => e.date >= cutoffStr && e.date <= todayStr);
}

/** Entries belonging to the active challenge only. */
export function activeChallengeEntries(timeline) {
  return timeline.filter(e => e.source === 'active');
}
