import { computeTotalXP, requiredTasksForDay } from '../src/utils/gamification.js';
import { promotionBasis, promotedDescriptor, finishedPrimaryArchive } from '../src/utils/supportPromotion.js';
import { stampAttempt, archiveEraOf } from '../src/utils/xpAttempt.js';
import { dayRules, economyVersionOf } from '../src/data/xpEconomy.js';
import { getTemplateById, getCompletionBonusForDuration } from '../src/data/challengeTemplates.js';
import { buildAttemptPayload } from '../src/data/challengeAttempt.js';

/**
 * Promoting a Support Challenge to primary — future promotions only.
 *
 *   1. The promoted attempt keeps the economy its support ran under: the
 *      current one for a support that ran beside a current-economy primary,
 *      the pre-October one for a support that legitimately ran beside an
 *      older attempt. An unstamped promotion used to be read as the old
 *      economy whatever it was — ten times over.
 *   2. On the current economy it gets exactly the stamp a new attempt of its
 *      template, mode and length gets. Its habit rows are not repriced.
 *   3. The days its finished primary already banked are not counted again.
 *   4. A choice left waiting from before this release is read from the
 *      finished primary's archive.
 */

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const offset = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

// A Mental Training support descriptor exactly as the support picker builds it:
// raw template fields, no economy stamp.
const MT = getTemplateById('mental_training_phase');
const SUPPORT = {
  templateId: MT.id, name: MT.challenge_name, emoji: MT.emoji, variant: 'standard', durationDays: 21,
  templateVersion: MT.template_version || 1, rewardXP: MT.rewards?.xp || 0,
  completionBonusXP: getCompletionBonusForDuration(MT, 21), passingScore: 70, keystoneRequirement: 65,
  badgeId: null, coldExposureUpgradeEnabled: false,
};
// The support's rows after its primary finished, as the app leaves them.
const ROWS = [['fd_mind', 12, 1], ['fd_read', 6, 0], ['mt_physical', 30, 1], ['daily_log', 20, 1], ['mt_focus', 20, 1]]
  .map(([id, xp, keystone], i) => ({ id, name: id, xp, keystone, source: 'template', order: i, challenges: ['primary'] }));
const ROW_XP = ROWS.reduce((s, t) => s + t.xp, 0);

// ══ 1: the stamp ════════════════════════════════════════════════════════════
{
  const before = JSON.stringify(SUPPORT);
  const stamped = promotedDescriptor(SUPPORT, 2);
  const reference = stampAttempt({ meta: { ...SUPPORT }, tasks: [], template: MT }).meta;
  check('1: a current-economy promotion is stamped with the current economy', stamped.xpEconomyVersion === 2);
  check('1: …with exactly the stamp a new attempt of the same template, mode and length gets',
    stamped.effortTier === reference.effortTier && stamped.dailyBudget === reference.dailyBudget
      && stamped.completionBonusXP === reference.completionBonusXP,
    `${stamped.effortTier} ${stamped.dailyBudget} ${stamped.completionBonusXP}`);
  const normal = buildAttemptPayload({ template: MT, variant: 'standard', durationDays: 21 });
  const normalStamp = stampAttempt({ meta: normal.challenge, tasks: normal.tasks, template: MT }).meta;
  check('1: …the same budget and tier as a Mental Training started from the library',
    stamped.dailyBudget === normalStamp.dailyBudget && stamped.effortTier === normalStamp.effortTier);
  check('1: the support descriptor itself is not modified', JSON.stringify(SUPPORT) === before);
  check('1: its identity and settings are kept', ['templateId', 'name', 'variant', 'durationDays', 'passingScore', 'keystoneRequirement']
    .every(k => stamped[k] === SUPPORT[k]));

  const old = promotedDescriptor(SUPPORT, 1);
  check('1: an old-economy promotion stays on the old economy, explicitly stamped', old.xpEconomyVersion === 1);
  check('1: …and is otherwise exactly the support descriptor, as it always was',
    JSON.stringify({ ...old, xpEconomyVersion: undefined }) === JSON.stringify({ ...SUPPORT, xpEconomyVersion: undefined }));
  check('1: …so it plays by exactly the rules an unstamped promotion did before',
    JSON.stringify(dayRules(old)) === JSON.stringify(dayRules({ ...SUPPORT })));
}

// ══ 2: what a promoted day pays ═════════════════════════════════════════════
function promotedSegment(meta, { days, today, xpStartDay = 1 }) {
  const start = offset(-(today - 1));
  const profile = { challengeStart: start, activeChallenge: meta, tasks: ROWS, xpPenalties: true, xpStartDay, xpOffset: 0 };
  const completion = (n) => {
    const d = days[n]; if (!d) return 0;
    const ts = requiredTasksForDay(ROWS, meta, start, n);
    return Math.round(ts.filter(t => d.tasks?.[t.id]).length / ts.length * 100);
  };
  const seg = computeTotalXP({ p: days }, { p: profile }, 'p', completion, today, today);
  const scale = dayRules(meta).displayScale;
  return { gained: seg.gained * scale, lost: seg.lost * scale, net: (seg.gained - seg.lost) * scale };
}
const ALL = Object.fromEntries(ROWS.map(t => [t.id, true]));
{
  const now = promotedDescriptor(SUPPORT, 2);
  const unstamped = { ...SUPPORT };                       // what promotion produced before
  const day = (meta) => promotedSegment(meta, { days: { 1: { tasks: ALL } }, today: 1 }).gained;
  const fixedDay = day(now);
  const oldDay = day(unstamped);
  const rules = dayRules(now);
  check('2: a fully logged promoted day pays its habits at face value plus the normal bonus',
    fixedDay === ROW_XP + rules.perfectDay, `${fixedDay} = ${ROW_XP} + ${rules.perfectDay}`);
  check('2: …where the unstamped promotion paid about ten times that', oldDay >= 9 * fixedDay, `${oldDay} vs ${fixedDay}`);
  const missed = promotedSegment(now, { days: {}, today: 2 }).lost;
  check('2: a missed promoted day costs what any challenge of its budget costs', missed === rules.missedDay && missed === Math.round(rules.dailyBudget * 0.5),
    `${missed}`);
  const oldMissed = promotedSegment(unstamped, { days: {}, today: 2 }).lost;
  check('2: …not the old economy\'s 250', oldMissed === 250 && missed < oldMissed, `${oldMissed}`);
  const legit = promotedDescriptor(SUPPORT, 1);
  check('2: an old-economy promotion pays exactly what it always paid', day(legit) === oldDay);
}

// ══ 3: shared days are counted once ═════════════════════════════════════════
{
  // The support began 4 days before its primary's final day: support days 1–5
  // are banked in the primary's archive. Today is support day 7.
  const supportStart = offset(-6);
  const bankedThrough = offset(-2);
  const profile = {
    supportChallengeStart: supportStart, activeChallenge: { templateId: 'forge_daily', xpEconomyVersion: 2 },
    pendingPrimaryChoice: { supportEconomyVersion: 2, bankedThrough },
  };
  const basis = promotionBasis(profile, []);
  check('3: the first unbanked day is the day after the primary\'s last', basis.firstUnbanked === 6 && basis.bankedThrough === bankedThrough,
    JSON.stringify(basis));
  const days = Object.fromEntries([1, 2, 3, 4, 5, 6].map(n => [n, { tasks: ALL }]));
  const meta = promotedDescriptor(SUPPORT, basis.era);
  const once = promotedSegment(meta, { days, today: 7, xpStartDay: basis.firstUnbanked }).gained;
  const twice = promotedSegment(meta, { days, today: 7, xpStartDay: 1 }).gained;
  const oneDay = promotedSegment(meta, { days: { 1: { tasks: ALL } }, today: 1 }).gained;
  check('3: the promoted challenge counts only the unbanked day', once === oneDay, `${once} vs ${oneDay}`);
  check('3: …where starting at day 1 counted the five banked days again', twice > once * 5, `${twice}`);
  check('3: nothing banked means nothing skipped',
    promotionBasis({ ...profile, pendingPrimaryChoice: { supportEconomyVersion: 2, bankedThrough: null } }, []).firstUnbanked === 1);
  check('3: a primary that ended before the support began banked none of its days',
    promotionBasis({ ...profile, pendingPrimaryChoice: { supportEconomyVersion: 2, bankedThrough: offset(-9) } }, []).firstUnbanked === 1);
}

// ══ 4: the economy the support ran under ════════════════════════════════════
{
  const supportStart = offset(-6);
  const prim = (era, extra = {}) => ({ id: `p${era}`, challenge: { templateId: 'fat_loss_phase', name: 'Fat Loss', ...(era ? { xpEconomyVersion: era } : {}) },
    challengeStart: offset(-30), endDate: offset(-2), endDayNum: 29, xpEarned: 100, ...extra });
  const baseline = { templateId: 'forge_daily', xpEconomyVersion: 2 };
  const recorded = promotionBasis({ supportChallengeStart: supportStart, activeChallenge: baseline,
    pendingPrimaryChoice: { supportEconomyVersion: 1, bankedThrough: offset(-2) } }, [prim(2)]);
  check('4: the economy recorded when the primary finished wins', recorded.era === 1);

  // A choice left waiting from before this release records neither.
  const waiting = (archives) => promotionBasis({ supportChallengeStart: supportStart, activeChallenge: baseline,
    pendingPrimaryChoice: { finishedName: 'Fat Loss', supportName: 'Mental Training Phase' } }, archives);
  const fromNew = waiting([prim(2)]);
  check('4: an older waiting choice reads the finished primary\'s archive — current economy',
    fromNew.era === 2 && fromNew.bankedThrough === offset(-2) && fromNew.firstUnbanked === 6, JSON.stringify(fromNew));
  const fromOld = waiting([prim(1)]);
  check('4: …or the old economy, when that is what the primary ran under', fromOld.era === 1 && fromOld.firstUnbanked === 6);
  check('4: an unstamped primary archive counts as the old economy, as everywhere else', waiting([prim(null)]).era === 1);
  const noArchive = waiting([]);
  check('4: with no record of the primary, the economy its rows are counted under now', noArchive.era === 2 && noArchive.firstUnbanked === 1);

  const fd = { id: 'fd', challenge: { templateId: 'forge_daily', xpEconomyVersion: 2 }, challengeStart: offset(-40), endDate: offset(-6) };
  const sup = { id: 'sup', lane: 'support', challenge: { templateId: 'energy_reset' }, challengeStart: offset(-20), endDate: offset(-1) };
  const earlier = { id: 'earlier', challenge: { templateId: 'lock_in_14_day', xpEconomyVersion: 1 }, challengeStart: offset(-80), endDate: offset(-50) };
  const p2 = prim(2);
  check('4: the finished primary is found among Forge Daily, support and older archives',
    finishedPrimaryArchive([earlier, fd, sup, p2], supportStart)?.id === 'p2');
  check('4: Forge Daily, support and earlier archives are never mistaken for it',
    finishedPrimaryArchive([earlier, fd, sup], supportStart) === null);
  check('4: archiveEraOf agrees with the basis', archiveEraOf(p2) === 2 && economyVersionOf(baseline) === 2);
}

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
