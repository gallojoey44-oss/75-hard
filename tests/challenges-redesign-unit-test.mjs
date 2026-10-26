/**
 * The Challenges redesign's data layer.
 *
 * Three things the new screens depend on that nothing else would catch:
 *
 *   CATEGORY COVERAGE   A challenge nobody tagged still appears under "All"
 *                       and nowhere else, so it quietly stops being findable.
 *                       The registry is the source of truth; the tag table has
 *                       to keep up with it.
 *   ERA SAFETY          An era-2 Support Challenge beside an era-1 Primary is
 *                       worth ten times its own XP, because the engine applies
 *                       one rate card and one display scale per segment. The
 *                       pairing is refused; this proves the refusal and proves
 *                       it does not refuse anything else.
 *   ONE CONSTRUCTION    What a details page advertises and what starting it
 *                       installs both come from `buildAttemptPayload`. The two
 *                       must agree task-for-task and figure-for-figure.
 *   REAL DIFFICULTIES   The chooser describes Beginner, Standard and Hard from
 *                       each template's own configuration. If the modes ever
 *                       read alike, or the figures drift from the preview the
 *                       attempt is built from, the chooser is lying.
 */
import {
  challengeFocusCoverage, focusTagsOf, matchesFocus, availableFilters, FOCUS, FOCUS_FILTERS,
} from '../src/data/challengeFocus.js';
import {
  CHALLENGE_TEMPLATES, visibleChallenges, durationRangeText, getDefaultDuration,
  getTemplateById,
} from '../src/data/challengeTemplates.js';
import { checkStackEras, canStackEra } from '../src/utils/eraSafety.js';
import { previewAttempt, buildAttemptPayload } from '../src/data/challengeAttempt.js';
import { stampAttempt } from '../src/utils/xpAttempt.js';
import { CURRENT_ECONOMY_VERSION, dayRules } from '../src/data/xpEconomy.js';
import { isStartableTemplate } from '../src/data/configuredChallenges.js';
import { modeComparison, modeChoiceLine } from '../src/data/challengeModes.js';
import { CONFIGURED_SETUPS } from '../src/data/configuredSetups.jsx';

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}
function eq(name, got, want) {
  check(name, got === want, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}

// ── 1. Every challenge is findable ──────────────────────────────────────────

const coverage = challengeFocusCoverage();
eq('every registry template carries a focus tag', coverage.untagged.join(',') || 'none', 'none');
eq('no tag names a template that does not exist', coverage.unknown.join(',') || 'none', 'none');
check('the registry still holds every challenge', coverage.total === CHALLENGE_TEMPLATES.length);

for (const profile of ['me', 'girlfriend']) {
  const vis = visibleChallenges(profile);
  check(`${profile}: the library is non-empty`, vis.length > 0, `${vis.length}`);
  check(`${profile}: every visible challenge matches at least one filter`,
    vis.every(t => focusTagsOf(t).length > 0),
    vis.filter(t => !focusTagsOf(t).length).map(t => t.id).join(','));
  const filters = availableFilters(vis);
  check(`${profile}: no filter leads to an empty list`,
    filters.every(f => vis.some(t => matchesFocus(t, f.key))),
    filters.map(f => f.key).join(','));
  check(`${profile}: "All" shows everything`,
    vis.filter(t => matchesFocus(t, 'all')).length === vis.length);
}

// The female-only challenge is the one real audience difference, and it must
// not leak into the other profile's library.
const male = visibleChallenges('me').map(t => t.id);
const female = visibleChallenges('girlfriend').map(t => t.id);
check('a female-only challenge is absent from the male library',
  !male.includes('womens_hormone_health') && female.includes('womens_hormone_health'));

eq('LOCK IN reads as a productivity challenge',
  focusTagsOf(getTemplateById('lock_in_14_day')).includes(FOCUS.PRODUCTIVITY), true);
eq('Fat Loss reads as fitness',
  focusTagsOf(getTemplateById('fat_loss_phase')).includes(FOCUS.FITNESS), true);
check('the filter list leads with All', FOCUS_FILTERS[0].key === 'all');

// ── 2. Duration copy is read from the registry ──────────────────────────────

eq('a single-length challenge states one number',
  durationRangeText(getTemplateById('75_day_discipline_challenge')), '75 days');
eq('a multi-length challenge states its range',
  durationRangeText(getTemplateById('lock_in_14_day')), '7–90 days');
check('every startable challenge has a default length',
  visibleChallenges('girlfriend').filter(isStartableTemplate)
    .every(t => getDefaultDuration(t) != null));

// ── 3. Stacking across an economy boundary is refused ───────────────────────

const ERA1 = { templateId: 'lock_in_14_day', name: 'LOCK IN', durationDays: 14 };   // unstamped
const ERA1_EXPLICIT = { ...ERA1, xpEconomyVersion: 1 };
const ERA2 = { ...ERA1, xpEconomyVersion: 2, effortTier: 'medium_hard', dailyBudget: 180 };

check('an era-2 primary accepts a new support challenge', canStackEra(ERA2));
check('an era-1 primary does not', !canStackEra(ERA1));
check('an explicitly stamped era-1 primary does not either', !canStackEra(ERA1_EXPLICIT));
const refusal = checkStackEras(ERA1, CURRENT_ECONOMY_VERSION);
check('the refusal says why, in words a person can act on',
  /previous XP system/i.test(refusal.reason) && /unaffected/i.test(refusal.reason),
  refusal.reason?.slice(0, 60));
eq('and reports how far out the pairing would be', refusal.scale, 10);
check('a same-era pairing carries no reason at all', checkStackEras(ERA2, 2).reason === null);

// The factor in the refusal is the real one: an era-2 habit stored at 40 would
// be read through the era-1 primary's scale.
const era1Scale = dayRules(ERA1).displayScale;
const era2Scale = dayRules(ERA2).displayScale;
eq('which is the ratio of the two display scales', era1Scale / era2Scale, refusal.scale);

// ── 4. One construction path ────────────────────────────────────────────────

const startable = visibleChallenges('girlfriend').filter(isStartableTemplate);
check('there is more than one startable challenge to check', startable.length >= 4, `${startable.length}`);

// 75-Day Discipline is the one challenge whose task list is a PER-PROFILE
// default rather than template data, so it is built by handing that list in.
// Asserted explicitly rather than skipped: without the list it must refuse to
// build, which is what stops an empty attempt being previewed as a real one.
const legacy75 = getTemplateById('75_day_discipline_challenge');
check('75-Day refuses to build without its per-profile task list',
  previewAttempt({ template: legacy75, variant: null, durationDays: 75 }) === null);
check('and builds once that list is supplied',
  !!previewAttempt({
    template: legacy75,
    legacy: { meta: { templateId: legacy75.id, name: legacy75.challenge_name, durationDays: 75 },
      tasks: [{ id: 'd75_workout', name: 'Workout', xp: 20, keystone: 3 }] },
  }));

for (const t of startable.filter(x => x.id !== legacy75.id)) {
  const variant = t.start_flow === 'variant'
    ? (t.variants?.standard ? 'standard' : Object.keys(t.variants || {})[0])
    : 'standard';
  const days = getDefaultDuration(t);
  const args = { template: t, variant, durationDays: days };

  const preview = previewAttempt(args);
  const payload = buildAttemptPayload(args);
  if (!preview || !payload) {
    check(`${t.id}: previews and builds`, false, `preview ${!!preview}, payload ${!!payload}`);
    continue;
  }
  // The attempt the payload becomes, stamped exactly as startChallenge stamps it.
  const stamped = stampAttempt({ meta: payload.challenge, tasks: payload.tasks, template: t });

  check(`${t.id}: the advertised habits are the habits installed`,
    preview.tasks.map(x => x.id).join(',') === stamped.tasks.map(x => x.id).join(','),
    `${preview.tasks.length} vs ${stamped.tasks.length}`);
  check(`${t.id}: each advertised XP figure is the one installed`,
    preview.tasks.every((x, i) => x.xp === stamped.tasks[i].xp),
    preview.tasks.map((x, i) => `${x.xp}/${stamped.tasks[i]?.xp}`).join(' '));
  check(`${t.id}: the completion bonus matches`,
    preview.completionBonus === (stamped.meta.completionBonusXP || 0),
    `${preview.completionBonus} vs ${stamped.meta.completionBonusXP}`);
  check(`${t.id}: a new attempt is stamped with the current economy`,
    stamped.meta.xpEconomyVersion === CURRENT_ECONOMY_VERSION);
  check(`${t.id}: so its figures need no conversion`, preview.displayScale === 1);
  check(`${t.id}: the daily figures add up to its budget`,
    preview.tasks.reduce((s, x) => s + x.xp, 0) === preview.dailyBudget,
    `${preview.tasks.reduce((s, x) => s + x.xp, 0)} vs ${preview.dailyBudget}`);
  check(`${t.id}: it states a passing score`, preview.meta.passingScore > 0);
}

// Changing the chosen mode or length really re-prices the attempt, which is
// what the details page and the setup flow both rely on.
const mt = getTemplateById('mental_training_phase');
const beg = previewAttempt({ template: mt, variant: 'beginner', durationDays: 14 });
const std = previewAttempt({ template: mt, variant: 'standard', durationDays: 14 });
check('a harder mode is worth more per day', std.dailyBudget > beg.dailyBudget,
  `${beg.dailyBudget} vs ${std.dailyBudget}`);
const short = previewAttempt({ template: mt, variant: 'standard', durationDays: 7 });
const long = previewAttempt({ template: mt, variant: 'standard', durationDays: 21 });
check('a longer attempt is worth more in total',
  long.projectedPerfectTotal > short.projectedPerfectTotal,
  `${short.projectedPerfectTotal} vs ${long.projectedPerfectTotal}`);
check('but a day of it is worth the same', long.dailyBudget === short.dailyBudget);

// ── 5. Configured challenges still have their own setup screen ─────────────

const configured = CHALLENGE_TEMPLATES.filter(t => t.start_flow === 'configured');
check('every configured challenge has a setup screen registered',
  configured.every(t => CONFIGURED_SETUPS[t.id]?.Setup),
  configured.filter(t => !CONFIGURED_SETUPS[t.id]?.Setup).map(t => t.id).join(','));
check('and its builders, so the support lane can construct it too',
  configured.every(t => CONFIGURED_SETUPS[t.id]?.buildTasks && CONFIGURED_SETUPS[t.id]?.buildMeta));

// ── 6. The difficulty chooser explains a real difference ───────────────────
//
// The modes used to be described as "Build / Strengthen / Optimize the habit",
// which is three ways of saying "harder". What is shown now is read from the
// templates, so these checks guard the reading rather than any wording: that a
// mode's figures come from its own preview, that the promoted line genuinely
// tells the modes apart, and that nothing generic creeps back in.

const variantTemplates = CHALLENGE_TEMPLATES.filter(t => t.start_flow === 'variant' && t.variants);
check('there are difficulty-mode challenges to describe', variantTemplates.length > 0);

for (const t of variantTemplates) {
  const cmp = modeComparison(t);
  const name = t.challenge_name;
  check(`${name}: every mode is compared`, cmp.length === Object.keys(t.variants).length,
    `${cmp.length} of ${Object.keys(t.variants).length}`);

  // Each mode's figures are its own preview's, not another mode's.
  for (const m of cmp) {
    const p = previewAttempt({ template: t, variant: m.key, durationDays: getDefaultDuration(t) });
    check(`${name}/${m.key}: the habit count is this mode's own`, m.habits === p.tasks.length,
      `${m.habits} vs ${p.tasks.length}`);
    check(`${name}/${m.key}: the day's worth is this mode's own`, m.dailyXP === p.dailyBudget,
      `${m.dailyXP} vs ${p.dailyBudget}`);
    check(`${name}/${m.key}: the miss cost is this mode's own`,
      m.missPenalty === p.missedDayPenalty);
  }

  // A harder mode is never cheaper than an easier one.
  const order = ['beginner', 'standard', 'hard'].filter(k => cmp.some(m => m.key === k));
  const xps = order.map(k => cmp.find(m => m.key === k).dailyXP);
  check(`${name}: a day is worth more at each step up`,
    xps.every((v, i) => i === 0 || v >= xps[i - 1]), xps.join(' → '));

  // The promoted line is the point of the whole refinement: it has to differ.
  const heads = cmp.map(m => m.headline);
  check(`${name}: a differing requirement is promoted`, heads.every(h => !!h), heads.join(' | '));
  check(`${name}: and it reads differently in every mode`,
    new Set(heads).size === heads.length, heads.join(' | '));

  const lines = cmp.map(m => modeChoiceLine(m, v => v));
  check(`${name}: no two modes read the same in the chooser`,
    new Set(lines).size === lines.length, lines.join(' | '));
  check(`${name}: and none of them is a generic phrase`,
    lines.every(l => !/build the habit|strengthen the habit|optimi[sz]e the habit/i.test(l)),
    lines.join(' | '));
  // Short enough that three of them can be compared on a phone.
  check(`${name}: each chooser line stays on a line or two`,
    lines.every(l => l.length <= 60), lines.map(l => `${l.length}`).join(','));

  // The scale is the caller's: the data layer never converts XP itself.
  const m0 = cmp[0];
  check(`${name}: the chooser line takes its XP through the caller's scale`,
    modeChoiceLine(m0, v => v * 10).includes((m0.dailyXP * 10).toLocaleString())
    || modeChoiceLine(m0, v => v * 10).includes(String(m0.dailyXP * 10)),
    modeChoiceLine(m0, v => v * 10));
}

// A challenge without modes has nothing to compare, and says so by returning
// nothing rather than by inventing a distinction.
for (const t of CHALLENGE_TEMPLATES.filter(t => t.start_flow !== 'variant')) {
  eq(`${t.challenge_name}: no mode comparison is invented`, modeComparison(t).length, 0);
}

// ── 7. An unstartable challenge cannot be started ──────────────────────────

const unstartable = CHALLENGE_TEMPLATES.filter(t => !t.startable);
check('there are Coming Soon challenges to protect', unstartable.length > 0);
check('none of them is treated as startable',
  unstartable.every(t => !isStartableTemplate(t)),
  unstartable.filter(t => isStartableTemplate(t)).map(t => t.id).join(','));

// ── Summary ────────────────────────────────────────────────────────────────

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('\nFailures:');
  for (const f of failed) console.log(`  - ${f.name}`);
  process.exit(1);
}
