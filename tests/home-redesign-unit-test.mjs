/**
 * Home's data layer.
 *
 * Home is the screen most tempted to flatter: a streak that counts days nobody
 * promised, a win with a made-up date, an XP figure quoted in the wrong
 * economy. These checks pin the three places that could go wrong:
 *
 *   TRACKED vs MISSED   A day between two challenges is not a missed day.
 *                       Nobody promised anything then, and charging it would
 *                       make the week read as failure for taking a break.
 *   DATED OR ABSENT     A milestone appears in the feed only if Forge stored
 *                       when it happened. A backfilled rank and every badge
 *                       have no date, so neither is dated here.
 *   ONE SCALE PER       An era-1 archive stores XP a tenth the size of era 2.
 *   SEGMENT             Each segment is converted by ITS own scale, once.
 */
import {
  buildSegments, recentConsistency, recentWins, nextMilestones, badgeCollection,
} from '../src/utils/homeSummary.js';
import { resolveRankState } from '../src/utils/rank.js';
import { BADGE_DEFS, RANKS, detectSetback } from '../src/utils/gamification.js';

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}
function eq(name, got, want) {
  check(name, JSON.stringify(got) === JSON.stringify(want),
    `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}

const iso = (d) => d.toISOString().slice(0, 10);
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const TODAY = iso(new Date());

const TASKS = [
  { id: 'a', name: 'A', xp: 90, keystone: 3, source: 'template', order: 0 },
  { id: 'b', name: 'B', xp: 60, keystone: 2, source: 'template', order: 1 },
  { id: 'c', name: 'C', xp: 30, keystone: 0, source: 'template', order: 2 },
];
const ALL = { a: true, b: true, c: true };

const META2 = {
  templateId: 'lock_in_14_day', name: 'LOCK IN', emoji: '🎯', variant: 'standard',
  durationDays: 14, xpEconomyVersion: 2, effortTier: 'medium_hard', dailyBudget: 200,
};

/** A profile with a challenge that started four days ago. */
const profile = {
  challengeStart: day(-4),
  activeChallenge: META2,
  tasks: TASKS,
  xpPenalties: true,
  rankHistory: [
    // Backfilled: Forge never knew when this happened.
    { rank: 6, name: 'Elite Warrior', philosophy: 'You protect your standards.', date: null, lifetimeXP: 50000 },
    { rank: 7, name: 'True Warrior', philosophy: 'You act from principle, not mood.', date: day(-9), lifetimeXP: 75120 },
  ],
};
const activeDays = {
  1: { date: day(-4), tasks: { ...ALL } },
  2: { date: day(-3), tasks: { ...ALL } },
  3: { date: day(-2), tasks: { a: true } },
  4: { date: day(-1), tasks: {} },
  5: { date: TODAY, tasks: { a: true } },
};
// One archive per era, ended well before the current attempt began.
const archives = [
  { id: 'arch_e2', challengeStart: day(-120), endDate: day(-80), archivedAt: day(-80), endDayNum: 30,
    challenge: { templateId: 'fat_loss_phase', name: 'Fat Loss Challenge', emoji: '⚡', durationDays: 30, xpEconomyVersion: 2 },
    days: {}, tasks: [], xpEarned: 6420, completed: true, passed: true, finalScore: 88, scoreAvailable: true },
  { id: 'arch_e1', challengeStart: day(-200), endDate: day(-160), archivedAt: day(-160), endDayNum: 14,
    challenge: { templateId: 'lock_in_14_day', name: 'LOCK IN', emoji: '🎯', durationDays: 14, xpEconomyVersion: 1 },
    days: {}, tasks: [], xpEarned: 420, completed: true, passed: true, finalScore: 91, scoreAvailable: true },
];

// ── 1. Segments carry their own economy ─────────────────────────────────────

const segments = buildSegments(profile, activeDays, archives);
eq('every period becomes a segment', segments.length, 3);
check('they are ordered oldest first',
  segments[0].start < segments[1].start && segments[1].start < segments[2].start,
  segments.map(s => s.start).join(' → '));
eq('the live attempt is last and not archived', segments[segments.length - 1].id, 'current');

const e1 = segments.find(s => s.id === 'arch_e1');
const e2 = segments.find(s => s.id === 'arch_e2');
eq('an era-1 archive is read on the x10 display scale', e1.scale, 10);
eq('an era-2 archive is read on the x1 scale', e2.scale, 1);
eq('and so is the live era-2 attempt', segments.find(s => s.id === 'current').scale, 1);

const noneSeg = buildSegments({ challengeStart: null }, {}, []);
eq('a profile with nothing running has no segments', noneSeg.length, 0);

// ── 2. Consistency tells tracked days from missed ones ──────────────────────

const con = recentConsistency(segments, TODAY);
eq('seven days are reported', con.days.length, 7);
eq('the last of them is today', con.days[6].date, TODAY);
eq('the first is six days back', con.days[0].date, day(-6));
check('they run forward in time',
  con.days.every((d, i) => i === 0 || d.date > con.days[i - 1].date));

const byDate = Object.fromEntries(con.days.map(d => [d.date, d]));
eq('a day before this attempt, with no challenge running, is untracked',
  byDate[day(-6)].state, 'none');
eq('a fully completed day is done', byDate[day(-4)].state, 'done');
eq('a partly completed day is partial', byDate[day(-2)].state, 'partial');
eq('a day inside the attempt with nothing logged is missed', byDate[day(-1)].state, 'missed');
// Today is still in progress, whatever is or is not ticked.
eq('today is never reported as missed', byDate[TODAY].state === 'missed', false);
check('today is flagged as today', byDate[TODAY].isToday === true);

eq('perfect days are counted', con.perfect, 2);
eq('and counted only against days that were tracked', con.counted, 5);
check('the untracked days are excluded from the denominator',
  con.counted === con.days.filter(d => d.state !== 'none').length,
  `${con.counted} vs ${con.days.filter(d => d.state !== 'none').length}`);

// A gap BETWEEN two challenges is untracked, not failure.
const gapSegs = buildSegments(
  { challengeStart: day(-1), activeChallenge: META2, tasks: TASKS },
  { 1: { date: day(-1), tasks: { ...ALL } }, 2: { date: TODAY, tasks: {} } },
  [{ id: 'old', challengeStart: day(-10), endDate: day(-6), archivedAt: day(-6), endDayNum: 5,
     challenge: { ...META2, name: 'Old' }, days: {}, tasks: [], xpEarned: 100 }],
);
const gap = recentConsistency(gapSegs, TODAY);
const gapDays = Object.fromEntries(gap.days.map(d => [d.date, d.state]));
eq('a day in the gap between two challenges is untracked', gapDays[day(-4)], 'none');
eq('a day inside the older challenge is still judged', gapDays[day(-6)], 'missed');

// ── 3. Recent wins are dated, or they are not wins ──────────────────────────

const wins = recentWins({ segments, rankHistory: profile.rankHistory, todayStr: TODAY, limit: 10 });
check('wins run newest first',
  wins.every((w, i) => i === 0 || w.date <= wins[i - 1].date),
  wins.map(w => w.date).join(' '));

eq('the dated rank unlock is included',
  wins.filter(w => w.kind === 'rank').length, 1);
check('the backfilled rank, which has no date, is not',
  !wins.some(w => /Elite Warrior/.test(w.title)),
  wins.map(w => w.title).join(' | '));

const archWins = wins.filter(w => w.kind === 'challenge');
eq('both finished challenges are included', archWins.length, 2);
const e1Win = archWins.find(w => /LOCK IN/.test(w.title));
eq('an era-1 challenge quotes its XP on the lifetime ladder', e1Win.xp, 4200);
const e2Win = archWins.find(w => /Fat Loss/.test(w.title));
eq('an era-2 challenge is quoted unchanged', e2Win.xp, 6420);

// A run the user stopped is not an accomplishment, and Home does not present
// it as one. It stays safe in the archive and in XP History; it simply is not
// a win. This is also what keeps an ended Support Challenge from reappearing
// on Home seconds after it was ended.
const withEarlyEnd = buildSegments(profile, activeDays, [
  ...archives,
  { id: 'arch_quit', challengeStart: day(-60), endDate: day(-40), archivedAt: day(-40), endDayNum: 9,
    challenge: { templateId: 'energy_reset_10_day', name: 'Energy Reset', emoji: '⚡', durationDays: 21, xpEconomyVersion: 2 },
    days: {}, tasks: [], xpEarned: 980, endedEarly: true, completed: false, passed: null,
    finalScore: 54, scoreAvailable: true },
]);
const earlyWins = recentWins({ segments: withEarlyEnd, rankHistory: [], todayStr: TODAY, limit: 20 });
check('a challenge that was ended early is not listed as a win',
  !earlyWins.some(w => /Energy Reset/.test(w.title)),
  earlyWins.map(w => w.title).join(' | '));
check('while the challenges that were finished still are',
  earlyWins.filter(w => w.kind === 'challenge').length === 2,
  earlyWins.filter(w => w.kind === 'challenge').map(w => w.title).join(' | '));

const perfect = wins.filter(w => w.kind === 'perfect');
eq('every perfect day is a win', perfect.length, 2);
check('and each is worth real XP', perfect.every(w => w.xp > 0), perfect.map(w => w.xp).join(','));
check('no win is dated in the future', wins.every(w => w.date <= TODAY));
check('no badge is dated, because Forge never stored when one was earned',
  !wins.some(w => w.kind === 'badge'));

eq('the limit is honoured',
  recentWins({ segments, rankHistory: profile.rankHistory, todayStr: TODAY, limit: 3 }).length, 3);

// Perfect days are the common case. Left alone they fill the card and push out
// the rank unlock and the finished challenge — the things actually worth
// remembering — so they are capped while rarer events are waiting.
const manyPerfect = {};
for (let i = 1; i <= 7; i++) manyPerfect[i] = { date: day(-(7 - i)), tasks: { ...ALL } };
const busy = buildSegments(
  { ...profile, challengeStart: day(-6) }, manyPerfect, archives);
const busyWins = recentWins({ segments: busy, rankHistory: profile.rankHistory, todayStr: TODAY, limit: 5 });
eq('the card is filled', busyWins.length, 5);
check('perfect days do not crowd out the rarer milestones',
  busyWins.filter(w => w.kind === 'perfect').length <= 3,
  busyWins.map(w => w.kind).join(','));
check('so the rank unlock still gets in',
  busyWins.some(w => w.kind === 'rank'), busyWins.map(w => w.kind).join(','));
check('and so does a finished challenge',
  busyWins.some(w => w.kind === 'challenge'), busyWins.map(w => w.kind).join(','));
check('the list is still newest first',
  busyWins.every((w, i) => i === 0 || w.date <= busyWins[i - 1].date),
  busyWins.map(w => w.date).join(' '));

// With nothing rarer to make room for, the cap does not leave the card half
// empty — the remaining perfect days come back.
const onlyPerfect = recentWins({
  segments: buildSegments({ ...profile, rankHistory: [], challengeStart: day(-6) }, manyPerfect, []),
  rankHistory: [], todayStr: TODAY, limit: 5,
});
eq('a profile with only perfect days still fills the card', onlyPerfect.length, 5);
check('and every one of them is a perfect day',
  onlyPerfect.every(w => w.kind === 'perfect'), onlyPerfect.map(w => w.kind).join(','));
eq('a profile with no history has no wins',
  recentWins({ segments: [], rankHistory: [], todayStr: TODAY }).length, 0);

// ── 4. Milestones ahead ─────────────────────────────────────────────────────

const rankState = resolveRankState({ rawLifetimeXP: 84670, highestRank: 7 });
eq('the rank state matches the ladder', rankState.current.name, 'True Warrior');
eq('and names the next rank', rankState.next.name, 'Unbreakable');

const miles = nextMilestones({ rankState, earnedBadgeIds: new Set(['streak_3']), streak: 5 });
eq('the next rank always leads', miles[0].kind, 'rank');
eq('and names it', miles[0].label, 'Unbreakable');
check('an already-earned badge is not offered again',
  !miles.some(m => m.id === 'streak_3'), miles.map(m => m.id).join(','));
check('progress is a real fraction of a real target',
  miles.every(m => m.pct >= 0 && m.pct <= 100 && m.need > 0),
  JSON.stringify(miles.map(m => [m.id, m.pct, m.need])));
const s7 = miles.find(m => m.id === 'streak_7');
check('a streak badge counts the real streak', !s7 || /5 of 7/.test(s7.detail), s7?.detail);

// At the top of the ladder there is no next rank to promise.
const maxed = resolveRankState({ rawLifetimeXP: 120000, highestRank: 8 });
eq('a maxed profile is offered no next rank',
  nextMilestones({ rankState: maxed, earnedBadgeIds: new Set(), streak: 0 })
    .filter(m => m.kind === 'rank').length, 0);

// Nothing invents progress for a badge Forge cannot measure.
const measurable = new Set(['streak_3', 'streak_7', 'streak_14', 'streak_30']);
const everyMile = nextMilestones({ rankState, earnedBadgeIds: new Set(), streak: 0, limit: 99 });
check('only badges with a countable criterion are given a bar',
  everyMile.every(m => m.kind === 'rank' || measurable.has(m.id)),
  everyMile.map(m => m.id).join(','));

// ── 4b. The comeback offer does not contradict the screen it sits on ────────
//
// `detectSetback` decides whether Home offers a comeback plan. It feeds no
// penalty and no XP — it is a visibility rule — and these checks pin the two
// ways it was contradicting the evidence beside it.

const SB_TASKS = [{ id: 'x', xp: 50, keystone: 2, source: 'template', order: 0 }];
/** `pattern` is oldest-first: true is a completed day. */
function setbackFor(pattern, { rawDay = null } = {}) {
  const daysObj = {};
  pattern.forEach((done, i) => { daysObj[i + 1] = { date: day(-(pattern.length - 1 - i)), tasks: { x: !!done } }; });
  const completion = (n) => (daysObj[n]?.tasks?.x ? 100 : 0);
  return detectSetback({ p: daysObj }, 'p', completion, pattern.length, rawDay ?? pattern.length + 1);
}

// Two genuinely missed days out of the last finalised seven.
eq('two missed finalised days are a setback',
  setbackFor([true, false, true, false, true]).hasSetback, true);
eq('one missed day is not', setbackFor([true, true, true, false, true]).hasSetback, false);

// The day in progress is not evidence. Reading Home at breakfast with nothing
// ticked yet must not be counted as an incomplete day.
const breakfast = setbackFor([true, true, true, false, false], { rawDay: 5 });
eq('the day in progress is excluded from the window', breakfast.incompleteDays, 1);
eq('so a single real miss plus an unstarted today is not a setback',
  breakfast.hasSetback, false);
// Without that boundary the same history would read as two incomplete days.
eq('counting today would have said otherwise',
  setbackFor([true, true, true, false, false], { rawDay: 6 }).incompleteDays, 2);

// Having already strung three days together IS the comeback.
const recovered = setbackFor([false, false, true, true, true]);
eq('three complete days in a row are recognised', recovered.recoveredDays, 3);
eq('and the offer is withdrawn once they are', recovered.hasSetback, false);
eq('two days back is not yet a recovery',
  setbackFor([false, false, false, true, true]).hasSetback, true);

// A real slump still offers the plan.
const slump = setbackFor([true, true, false, false, false]);
eq('a run of missed days is still a setback', slump.hasSetback, true);
eq('and reports how many were consecutive', slump.consecutiveMissed, 3);
eq('with nothing recovered yet', slump.recoveredDays, 0);

// ── 5. The collection accounts for every badge ──────────────────────────────

const col = badgeCollection(new Set(['streak_3', 'first_task']));
eq('the collection is the whole badge table', col.total, BADGE_DEFS.length);
eq('every badge is on exactly one side', col.earned.length + col.locked.length, BADGE_DEFS.length);
eq('held badges are reported as held', col.earned.map(b => b.id).sort(), ['first_task', 'streak_3']);
check('and none of them is also listed as locked',
  !col.locked.some(b => ['first_task', 'streak_3'].includes(b.id)));
eq('an empty profile holds nothing', badgeCollection(new Set()).earned.length, 0);

// The rank ladder itself is untouched by any of this.
eq('the rank ladder still has eight ranks', RANKS.length, 8);
eq('and Unbreakable is still 100,000 XP', RANKS[7].minXP, 100000);

// ── Summary ─────────────────────────────────────────────────────────────────

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('\nFailures:');
  for (const f of failed) console.log(`  - ${f.name}`);
  process.exit(1);
}
