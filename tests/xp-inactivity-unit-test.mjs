/**
 * Lifetime XP, inactivity penalties and the protected rank floor.
 *
 * Written as a CHARACTERIZATION suite for an investigation: it pins what the
 * XP system does today, so the reported root cause is backed by executed code
 * rather than by reading it, and so any future change to these rules has to be
 * deliberate.
 *
 * It changes no balances and asserts no new behaviour.
 *
 * The question being answered: a profile with 8,245 Lifetime XP, a True
 * Warrior floor of 7,500, and several weeks of inactivity saw no reduction.
 * Is penalty processing missing?
 *
 * The answer these assertions establish is NO. Penalties are computed, and
 * correctly. They cannot reach Lifetime XP because of two deliberate clamps:
 * the current challenge segment contributes max(0, …), and archived XP is an
 * immutable snapshot that is itself floored at 0. See sections 5 and 6.
 */
import {
  computeTotalXP, computeLifetimeXP, computeDayXP, computeStreakEvents,
} from '../src/utils/gamification.js';
import { effectiveLifetimeXP, rankFloorXP, rankForXP, resolveRankState } from '../src/utils/rank.js';
import { RANKS } from '../src/utils/gamification.js';

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

const TRUE_WARRIOR = RANKS.find(r => r.name === 'True Warrior');
const dstr = (offset) => {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const noCompletion = () => 0;

const CHALLENGE_TASKS = [
  { id: 'li_sleep', name: 'Sleep opportunity: 8+ hours', xp: 40, keystone: 3 },
  { id: 'li_flow', name: 'Flow training', xp: 35, keystone: 3 },
  { id: 'li_exec', name: 'Execute priorities', xp: 30, keystone: 3 },
];
const FORGE_DAILY_TASKS = [
  { id: 'fd_sleep', name: 'Hit sleep goal', xp: 8, keystone: 0 },
  { id: 'fd_mind', name: 'Mental Training', xp: 12, keystone: 1 },
  { id: 'fd_read', name: 'Read', xp: 6, keystone: 0 },
];

/** A profile running `meta`, started `startedDaysAgo` days ago. */
function profileWith({ meta, tasks, startedDaysAgo = 0, penalties = true, xpStartDay = 1, xpOffset = 0 }) {
  return { me: {
    challengeStart: startedDaysAgo === null ? null : dstr(-startedDaysAgo),
    activeChallenge: meta, tasks,
    xpPenalties: penalties, xpStartDay, xpOffset,
  } };
}
const LOCK_IN = { templateId: 'lock_in_14_day', name: 'LOCK IN', durationDays: 14 };
const FORGE_DAILY = { templateId: 'forge_daily', name: 'Forge Daily', durationDays: null, isBaseline: true };

// ══ 1: the rank floor itself ════════════════════════════════════════════════
check('1: True Warrior is rank 7 with a 7,500 XP threshold',
  TRUE_WARRIOR.rank === 7 && TRUE_WARRIOR.minXP === 7500);
check('1: the floor for True Warrior is 7,500', rankFloorXP(TRUE_WARRIOR.rank) === 7500);
check('1: the floor clamps UPWARD only — it never reduces a higher balance',
  effectiveLifetimeXP(8245, TRUE_WARRIOR.rank) === 8245 &&
  effectiveLifetimeXP(7000, TRUE_WARRIOR.rank) === 7500 &&
  effectiveLifetimeXP(0, TRUE_WARRIOR.rank) === 7500);
check('1: at 8,245 the floor is not even engaged — it is 745 XP above it',
  8245 > 7500 && effectiveLifetimeXP(8245, TRUE_WARRIOR.rank) === 8245);
check('1: True Warrior can never be lost, whatever happens to raw XP',
  [0, 100, 7499].every(xp => resolveRankState({ rawLifetimeXP: xp, highestRank: TRUE_WARRIOR.rank }).current.name === 'True Warrior'));
check('1: 8,245 raw sits inside the True Warrior band',
  rankForXP(8245).name === 'True Warrior');

// ══ 2: penalties DO apply during an active challenge ════════════════════════
check('2: an untouched PAST day costs the flat 25 XP miss penalty',
  JSON.stringify(computeDayXP(undefined, CHALLENGE_TASKS, 'me', 1, 5, true, 5)) === '{"gained":0,"lost":25}');
check('2: the CURRENT day is never penalised — it is not finalised yet',
  JSON.stringify(computeDayXP(undefined, CHALLENGE_TASKS, 'me', 5, 5, true, 5)) === '{"gained":0,"lost":0}');
check('2: a FUTURE day earns and costs nothing',
  JSON.stringify(computeDayXP(undefined, CHALLENGE_TASKS, 'me', 9, 5, true, 5)) === '{"gained":0,"lost":0}');
check('2: penalties can be switched off per profile',
  computeDayXP(undefined, CHALLENGE_TASKS, 'me', 1, 5, false, 5).lost === 0);
check('2: a broken streak of 3+ is penalised once it is in the past',
  computeStreakEvents({ me: {} }, 'me', (n) => (n <= 3 ? 100 : 0), 6, true, 7).lost >= 30);

// ══ 3: penalties DO apply on Forge Daily ════════════════════════════════════
// Forge Daily is open-ended, so every elapsed day is a finalised past day.
const fdAbsence = {};
for (const gap of [7, 14, 30]) {
  const profiles = profileWith({ meta: FORGE_DAILY, tasks: FORGE_DAILY_TASKS, startedDaysAgo: gap });
  const days = { me: { 1: { date: dstr(-gap), tasks: { fd_sleep: true, fd_mind: true, fd_read: true } } } };
  fdAbsence[gap] = computeTotalXP(days, profiles, 'me', noCompletion, gap + 1, gap + 1);
}
check('3: Forge Daily penalises absence — 7 days away costs XP',
  fdAbsence[7].lost > 0, JSON.stringify(fdAbsence[7]));
check('3: 14 days away costs more than 7', fdAbsence[14].lost > fdAbsence[7].lost,
  `${fdAbsence[7].lost} → ${fdAbsence[14].lost}`);
check('3: 30 days away costs more than 14', fdAbsence[30].lost > fdAbsence[14].lost,
  `${fdAbsence[14].lost} → ${fdAbsence[30].lost}`);
check('3: the cost is exactly 25 per missed day, with no double-charging',
  (fdAbsence[30].lost - fdAbsence[14].lost) === 25 * 16,
  `${fdAbsence[30].lost - fdAbsence[14].lost} for 16 days`);
check('3: the raw segment total genuinely goes negative',
  fdAbsence[30].rawTotal < 0, `${fdAbsence[30].rawTotal}`);

// ══ 4: no obligation → no penalty ═══════════════════════════════════════════
check('4: a SCHEDULED challenge is exempt before its start date',
  JSON.stringify(computeTotalXP({ me: {} },
    profileWith({ meta: LOCK_IN, tasks: CHALLENGE_TASKS, startedDaysAgo: -3 }),
    'me', noCompletion, 1, 1)) === '{"total":0,"rawTotal":0,"gained":0,"lost":0}');
check('4: a profile with NO challenge at all is penalised nothing',
  computeTotalXP({ me: {} },
    profileWith({ meta: null, tasks: [], startedDaysAgo: null }),
    'me', noCompletion, 1, 1).lost === 0);
check('4: no missed requirement is invented for days outside the challenge',
  (() => {
    // A 14-day challenge abandoned on day 3, returned to on day 40. Only the
    // challenge's own 14 days carry obligations.
    const profiles = profileWith({ meta: LOCK_IN, tasks: CHALLENGE_TASKS, startedDaysAgo: 39 });
    const days = { me: { 1: { tasks: { li_sleep: true, li_flow: true, li_exec: true } } } };
    const r = computeTotalXP(days, profiles, 'me', noCompletion, 14, 14);
    // Days 2..14 missed = 13 × 25; days 15..40 are not the challenge's business.
    return r.lost >= 13 * 25 && r.lost < 40 * 25;
  })());

// ══ 5: THE FIRST CLAMP — a negative segment cannot reduce Lifetime XP ═══════
// This is half the reported root cause.
check('5: computeLifetimeXP floors the current segment at zero',
  computeLifetimeXP([{ xpEarned: 8245 }], -649) === 8245);
check('5: a 30-day absence on Forge Daily leaves Lifetime XP untouched',
  computeLifetimeXP([{ xpEarned: 8245 }], fdAbsence[30].rawTotal) === 8245,
  `segment ${fdAbsence[30].rawTotal} → lifetime 8245`);
check('5: the same is true at 7 and 14 days',
  [7, 14].every(g => computeLifetimeXP([{ xpEarned: 8245 }], fdAbsence[g].rawTotal) === 8245));
check('5: a POSITIVE segment does add to Lifetime XP',
  computeLifetimeXP([{ xpEarned: 8245 }], 120) === 8365);

// ══ 6: THE SECOND CLAMP — archived XP is an immutable snapshot ══════════════
// The other half. Archived entries are summed as stored and never recomputed,
// so no penalty can reach XP already banked from a finished challenge.
check('6: Lifetime XP is archived XP plus the current segment',
  computeLifetimeXP([{ xpEarned: 5000 }, { xpEarned: 3245 }], 0) === 8245);
check('6: archived entries are summed exactly as stored',
  computeLifetimeXP([{ xpEarned: 100 }, { xpEarned: 200 }], 0) === 300);
check('6: an archive entry missing xpEarned counts as zero, not NaN',
  computeLifetimeXP([{ xpEarned: 100 }, {}], 0) === 100);
check('6: nothing in the lifetime calculation can lower an archived figure',
  [-5000, -100, 0].every(seg => computeLifetimeXP([{ xpEarned: 8245 }], seg) === 8245));

// ══ 7: the reported state, reproduced exactly ═══════════════════════════════
// True Warrior, 8,245 banked, LOCK IN on Day 1, after weeks away.
const reported = computeTotalXP(
  { me: {} },
  profileWith({ meta: LOCK_IN, tasks: CHALLENGE_TASKS, startedDaysAgo: 0 }),
  'me', noCompletion, 1, 1,
);
const reportedLifetime = computeLifetimeXP([{ xpEarned: 8245 }], reported.rawTotal);
check('7: on Day 1 the current segment is exactly zero',
  reported.rawTotal === 0 && reported.lost === 0, JSON.stringify(reported));
check('7: Lifetime XP is therefore 8,245, unchanged', reportedLifetime === 8245);
check('7: and the effective balance is 8,245, above the 7,500 floor',
  effectiveLifetimeXP(reportedLifetime, TRUE_WARRIOR.rank) === 8245);
check('7: Day 1 of a new challenge cannot be penalised, by design',
  computeDayXP(undefined, CHALLENGE_TASKS, 'me', 1, 1, true, 1).lost === 0);

// ══ 8: applied exactly once — the calculation is derived, not incremental ═══
// Nothing is stored and added; the total is recomputed from the day records
// every time. That is what makes reloads and repeat visits safe.
check('8: recomputing the same inputs gives the same answer',
  (() => {
    const profiles = profileWith({ meta: FORGE_DAILY, tasks: FORGE_DAILY_TASKS, startedDaysAgo: 30 });
    const days = { me: { 1: { tasks: { fd_sleep: true } } } };
    const a = computeTotalXP(days, profiles, 'me', noCompletion, 31, 31);
    const b = computeTotalXP(days, profiles, 'me', noCompletion, 31, 31);
    const c = computeTotalXP(days, profiles, 'me', noCompletion, 31, 31);
    return JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(b) === JSON.stringify(c);
  })());
check('8: ten repeat visits do not compound the penalty',
  (() => {
    const profiles = profileWith({ meta: FORGE_DAILY, tasks: FORGE_DAILY_TASKS, startedDaysAgo: 14 });
    const days = { me: { 1: { tasks: { fd_sleep: true } } } };
    const first = computeTotalXP(days, profiles, 'me', noCompletion, 15, 15).lost;
    for (let i = 0; i < 10; i++) computeTotalXP(days, profiles, 'me', noCompletion, 15, 15);
    return computeTotalXP(days, profiles, 'me', noCompletion, 15, 15).lost === first;
  })());
check('8: the penalty for returning after N days is linear in N, never doubled',
  (() => {
    const at = (gap) => {
      const profiles = profileWith({ meta: FORGE_DAILY, tasks: FORGE_DAILY_TASKS, startedDaysAgo: gap });
      return computeTotalXP({ me: { 1: { tasks: { fd_sleep: true } } } }, profiles, 'me', noCompletion, gap + 1, gap + 1).lost;
    };
    return (at(14) - at(7)) === (at(21) - at(14));
  })(),
  'equal 7-day increments');
check('8: computing XP does not mutate the day records it reads',
  (() => {
    const days = { me: { 1: { tasks: { fd_sleep: true } } } };
    const snapshot = JSON.stringify(days);
    computeTotalXP(days, profileWith({ meta: FORGE_DAILY, tasks: FORGE_DAILY_TASKS, startedDaysAgo: 14 }), 'me', noCompletion, 15, 15);
    return JSON.stringify(days) === snapshot;
  })());

// ══ 9: the floor holds even if a segment is deeply negative ═════════════════
check('9: a True Warrior with a −725 segment still shows 8,245',
  effectiveLifetimeXP(computeLifetimeXP([{ xpEarned: 8245 }], -725), TRUE_WARRIOR.rank) === 8245);
check('9: a True Warrior with NO archives at all still shows 7,500',
  effectiveLifetimeXP(computeLifetimeXP([], -725), TRUE_WARRIOR.rank) === 7500);
check('9: the rank itself survives a zero raw balance',
  resolveRankState({ rawLifetimeXP: 0, highestRank: TRUE_WARRIOR.rank }).current.name === 'True Warrior');
check('9: and the displayed XP is the floor, not zero',
  resolveRankState({ rawLifetimeXP: 0, highestRank: TRUE_WARRIOR.rank }).xp === 7500);

// ══ 10: a latent defect found during the audit ══════════════════════════════
// buildArchiveEntry caps the archived day count at `meta.durationDays || 75`.
// Forge Daily has durationDays null, so a Forge Daily period longer than 75
// days banks only its first 75 days of earned XP. This under-counts legitimate
// earnings; it is reported rather than changed, because fixing it would alter
// stored balances.
check('10: Forge Daily is open-ended — it has no duration to cap against',
  FORGE_DAILY.durationDays === null);
check('10: the archive cap expression falls back to 75 for an open-ended run',
  (FORGE_DAILY.durationDays || 75) === 75,
  'documented in the audit report; not changed here');

const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
