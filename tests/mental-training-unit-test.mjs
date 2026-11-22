import { CHALLENGE_TEMPLATES, getTemplateById, applyColdExposureUpgrade } from '../src/data/challengeTemplates.js';
import {
  PRACTICES_V1, PRACTICE_SETS, TRAINING_TASK_ID, TRAINING_DESC, TRAINING_GUIDE_ID, TRAINING_VERSION,
  TRAINING_MINUTE_OPTIONS, TRAINING_MINUTES_BY_MODE, MENTAL_TRAINING_TEMPLATE,
  allowedMinutes, recommendedMinutes, resolveMinutes, buildTrainingConfig, trainingConfigOf,
  applyTrainingSetup, trainingFor, practicesFor, getPractice, overlappingTasks, separateHabits,
  practiceOfDay, PRACTICE_FIELD, trainingTaskName,
  MINUTES_SOURCE, minutesSourceOf, retryTrainingConfig, LENGTH_CHOICE, needsLengthChoice,
  answerLengthChoice, lengthChoiceLane, profileWithLengthChoice,
} from '../src/data/mentalPractices.js';
import { computeTotalXP } from '../src/utils/gamification.js';
import { buildAttemptPayload, previewAttempt, NEW_ATTEMPT_DEFAULTS } from '../src/data/challengeAttempt.js';
import { stampAttempt } from '../src/utils/xpAttempt.js';
import { presentTasks, presentationFor } from '../src/data/habitPresentation.js';
import { HABIT_GUIDES, getGuide } from '../src/data/habitGuides.js';
import { modeComparison } from '../src/data/challengeModes.js';
import { computeDayXP } from '../src/utils/gamification.js';
import { dayRules } from '../src/data/xpEconomy.js';
import { mergeSupportTasks } from '../src/utils/challengeStack.js';
import {
  IDLE_TIMER, startTimer, pauseTimer, resetTimer, elapsedMs, remainingMs, timerFinished, formatClock, minutesRun,
} from '../src/utils/sessionTimer.js';

/**
 * Mental Training — one habit, six practices.
 *
 * What this suite holds the overhaul to, in the order the brief states it:
 *
 *   1. One task. The six practices are ways to complete ONE habit, `mt_mind`,
 *      which keeps its id, keystone weight and XP. No new habits, no new XP.
 *   2. The six practices exist, each with the content the session screen
 *      needs, and none of them promises an outcome.
 *   3. Duration is chosen at setup from 5 / 10 / 15 / 30, never below the
 *      mode's own minimum (Beginner 5, Standard 10, Hard 30), fixed for the
 *      attempt — and it never changes the XP. An attempt already running keeps
 *      the length stamped on it, whatever the options are now.
 *   4. Versioning: the practices are stamped onto an attempt when it starts.
 *      An attempt without the stamp keeps exactly the habit it started with,
 *      the template is not bumped, and a template sync preserves both.
 *   5. Completion is a checkbox; the recorded practice is not XP.
 *   6. One practice, one habit: the overlaps are named, never ticked.
 *   7. The timer is arithmetic on timestamps and decides nothing.
 *   8. Every new attempt records whether its length was the recommendation or
 *      a choice, and Retry follows that: a default gets today's recommendation,
 *      a choice (or an unrecorded length) is kept.
 *   9. A Standard attempt saved at 15 with nothing recorded is asked once —
 *      switch to 10 or keep 15 — and the answer moves no XP, no completed
 *      day and no other habit, lane or attempt.
 */

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

const MT = getTemplateById(MENTAL_TRAINING_TEMPLATE);
const MODES = ['beginner', 'standard', 'hard'];
const TEMPLATE_MINUTES = { beginner: 2, standard: 5, hard: 10 };

// ══ 1: one habit ════════════════════════════════════════════════════════════
check('1: the training habit is the Mental Training template\'s core habit',
  TRAINING_TASK_ID === 'mt_mind' && MODES.every(m => MT.variants[m].start_tasks.some(t => t.id === 'mt_mind')));

for (const mode of MODES) {
  const tpl = MT.variants[mode].start_tasks;
  const payload = buildAttemptPayload({ template: MT, variant: mode });
  const ids = payload.tasks.map(t => t.id);
  check(`1: ${mode} — the attempt has exactly the template's habits, no more`,
    JSON.stringify(ids) === JSON.stringify(tpl.map(t => t.id)), ids.join(','));
  const mind = payload.tasks.find(t => t.id === 'mt_mind');
  const tplMind = tpl.find(t => t.id === 'mt_mind');
  check(`1: ${mode} — the habit keeps its id, keystone weight, habit key and XP`,
    mind.keystone === tplMind.keystone && mind.habitKey === tplMind.habitKey && mind.xp === tplMind.xp
      && mind.icon === tplMind.icon);
  // Every other habit is byte-for-byte the template's.
  const others = payload.tasks.filter(t => t.id !== 'mt_mind');
  check(`1: ${mode} — every other habit is untouched`,
    others.every(t => JSON.stringify(t) === JSON.stringify(tpl.find(x => x.id === t.id))));
}

// ══ 2: the six practices ════════════════════════════════════════════════════
const EXPECTED = [
  ['dead_calm', 'Dead Calm', 'Meditation & Breathwork'],
  ['open_sky', 'Open Sky', 'Mindful Nature Observation'],
  ['moving_stillness', 'Moving Stillness', 'Mindful Stretching & Mobility'],
  ['pursuit_of_wisdom', 'Pursuit of Wisdom', 'Reflective Reading'],
  ['inner_vision', 'Inner Vision', 'Visualization & Mental Rehearsal'],
  ['inner_mirror', 'Inner Mirror', 'Journaling & Introspection'],
];
check('2: there are exactly six practices in version 1', PRACTICES_V1.length === 6);
check('2: names and plain-English subtitles are exactly as specified, in order',
  EXPECTED.every(([id, name, sub], i) => PRACTICES_V1[i].id === id && PRACTICES_V1[i].name === name && PRACTICES_V1[i].subtitle === sub));
check('2: ids are unique', new Set(PRACTICES_V1.map(p => p.id)).size === 6);
for (const p of PRACTICES_V1) {
  check(`2: ${p.name} — has what the session screen needs`,
    p.develops && p.pitch && p.scene && p.steps.length >= 4 && p.counts.length >= 2 && p.doesntCount.length >= 2
      && p.steps.every(s => s.length < 160), `${p.steps.length} steps`);
}
// Device-free: the three the brief names, plus journaling on paper.
const deviceFree = PRACTICES_V1.filter(p => p.deviceFree).map(p => p.id).sort();
check('2: Open Sky, Moving Stillness and Pursuit of Wisdom are device-free',
  ['open_sky', 'moving_stillness', 'pursuit_of_wisdom'].every(id => deviceFree.includes(id)), deviceFree.join(','));
check('2: device-free practices say to put the phone away in their steps',
  PRACTICES_V1.filter(p => p.deviceFree).every(p => p.steps.some(s => /phone/i.test(s))));
const sky = getPractice('open_sky');
check('2: Open Sky says walking while scrolling does not count',
  sky.doesntCount.some(s => /scroll/i.test(s)));
const still = getPractice('moving_stillness');
check('2: Moving Stillness says distracted ordinary exercise does not count',
  still.doesntCount.some(s => /autopilot|workout/i.test(s)));
const wisdom = getPractice('pursuit_of_wisdom');
check('2: Pursuit of Wisdom names philosophy and Scripture, and offers reflection prompts',
  wisdom.steps.some(s => /philosophy/i.test(s) && /Scripture/.test(s)) && wisdom.prompts.length >= 3
    && wisdom.steps.some(s => /act on it|apply/i.test(s)));
check('2: Pursuit of Wisdom says skimming pages does not count', wisdom.doesntCount.some(s => /skim/i.test(s)));
const vision = getPractice('inner_vision');
check('2: Inner Vision has worked examples, including fear, adversity and distraction',
  vision.examples.length >= 4 && ['Fear', 'distraction', 'conversation'].every(w => vision.examples.some(x => new RegExp(w, 'i').test(`${x.label} ${x.text}`))));
const mirror = getPractice('inner_mirror');
check('2: Inner Mirror has optional prompts and stores nothing', mirror.prompts.length >= 3 && /never/i.test(mirror.tip));

// Nothing promises an outcome. These are the phrasings a wellness app reaches
// for, and every one of them is a claim this one does not make.
const PROMISES = /\b(cure|cures|heal|heals|treat|treats|treatment for|guarantee|guaranteed|proven to|will (reduce|lower|eliminate|fix|make you)|rewire|clinically)\b/i;
const allCopy = PRACTICES_V1.flatMap(p => [p.develops, p.pitch, p.tip, ...p.steps, ...p.counts, ...p.doesntCount,
  ...(p.prompts || []), ...(p.examples || []).flatMap(x => [x.label, x.text])]);
const promising = allCopy.filter(s => PROMISES.test(s));
check('2: no practice copy promises a psychological or medical outcome', promising.length === 0, promising.join(' | '));

// ══ 3: duration ═════════════════════════════════════════════════════════════
check('3: the lengths on offer are 5, 10, 15 and 30 minutes', JSON.stringify(TRAINING_MINUTE_OPTIONS) === '[5,10,15,30]');
check('3: Beginner recommends 5 and allows all four',
  recommendedMinutes('beginner') === 5 && JSON.stringify(allowedMinutes('beginner')) === '[5,10,15,30]');
check('3: Standard recommends 10 and allows 10, 15 or 30',
  recommendedMinutes('standard') === 10 && JSON.stringify(allowedMinutes('standard')) === '[10,15,30]');
check('3: Hard recommends and requires 30', recommendedMinutes('hard') === 30 && JSON.stringify(allowedMinutes('hard')) === '[30]');
check('3: no mode allows less than its own recommendation',
  MODES.every(m => allowedMinutes(m).every(x => x >= recommendedMinutes(m))));
check('3: a harder mode never recommends less than an easier one',
  recommendedMinutes('beginner') <= recommendedMinutes('standard') && recommendedMinutes('standard') <= recommendedMinutes('hard'));
check('3: a length below the mode\'s minimum falls back to the recommendation',
  resolveMinutes('hard', 5) === 30 && resolveMinutes('hard', 10) === 30 && resolveMinutes('hard', 15) === 30
    && resolveMinutes('standard', 5) === 10 && resolveMinutes('beginner', 30) === 30);
check('3: every length a mode allows is kept as chosen',
  resolveMinutes('beginner', 10) === 10 && resolveMinutes('beginner', 15) === 15
    && resolveMinutes('standard', 10) === 10 && resolveMinutes('standard', 15) === 15 && resolveMinutes('standard', 30) === 30);
check('3: lengths that were never offered fall back too',
  resolveMinutes('standard', 20) === 10 && resolveMinutes('beginner', 20) === 5 && resolveMinutes('standard', 45) === 10
    && resolveMinutes('standard', '30') === 30 && resolveMinutes('standard', null) === 10 && resolveMinutes('nonsense', 5) === 10);
check('3: a new Standard attempt is set to 10 minutes unless another length is chosen',
  buildAttemptPayload({ template: MT, variant: 'standard' }).challenge.mentalTraining?.minutes === 10
    && buildAttemptPayload({ template: MT, variant: 'standard' }).tasks.find(t => t.id === 'mt_mind').name === 'Mental Training — 10 minutes');
check('3: allowedMinutes hands back a copy, so a caller cannot change the rules',
  (() => { const a = allowedMinutes('hard'); a.push(5); return JSON.stringify(allowedMinutes('hard')) === '[30]'; })());

for (const mode of MODES) {
  for (const m of TRAINING_MINUTE_OPTIONS) {
    const payload = buildAttemptPayload({ template: MT, variant: mode, trainingMinutes: m });
    const expect = resolveMinutes(mode, m);
    const mind = payload.tasks.find(t => t.id === 'mt_mind');
    check(`3: ${mode} at ${m} — stamped ${expect} minutes, row says so`,
      payload.challenge.mentalTraining?.minutes === expect && payload.challenge.mentalTraining?.version === TRAINING_VERSION
        && mind.name === `Mental Training — ${expect} minutes`
        && mind.target?.value === expect && mind.target?.unit === 'minutes' && mind.desc === TRAINING_DESC);
  }
}

// XP: every allowed length within a mode pays the same, and the whole day is
// priced exactly as it was before the practices existed.
for (const mode of MODES) {
  const prices = allowedMinutes(mode).map(m => {
    const p = previewAttempt({ template: MT, variant: mode, trainingMinutes: m });
    return { mind: p.tasks.find(t => t.id === 'mt_mind').xp, daily: p.dailyTaskXP, budget: p.dailyBudget, bonus: p.completionBonus };
  });
  check(`3: ${mode} — every length pays the same XP for the habit and the day`,
    prices.every(x => JSON.stringify(x) === JSON.stringify(prices[0])), JSON.stringify(prices[0]));

  // The same template list, stamped without any training setup — what this
  // mode was worth before the overhaul.
  const before = stampAttempt({
    meta: { ...NEW_ATTEMPT_DEFAULTS, templateId: MT.id, variant: mode, durationDays: 14 },
    tasks: MT.variants[mode].start_tasks,
    template: MT,
  });
  const after = previewAttempt({ template: MT, variant: mode, durationDays: 14 });
  const xpOf = (list) => Object.fromEntries(list.map(t => [t.id, t.xp]));
  check(`3: ${mode} — every habit is priced exactly as before the overhaul`,
    JSON.stringify(xpOf(before.tasks)) === JSON.stringify(xpOf(after.tasks)) && before.meta.dailyBudget === after.dailyBudget,
    `budget ${after.dailyBudget}`);
}
check('3: the cold upgrade still applies alongside the training setup',
  (() => {
    const p = buildAttemptPayload({ template: MT, variant: 'standard', coldExposureUpgradeEnabled: true, trainingMinutes: 30 });
    return p.tasks.some(t => t.id === 'mt_cold_shower') && p.tasks.find(t => t.id === 'mt_mind').name.includes('30');
  })());

// ══ 4: versioning ═══════════════════════════════════════════════════════════
check('4: the template version is not bumped, so no running attempt is offered an update',
  MT.template_version === 6);
check('4: the template still describes the attempts started before the practices',
  MODES.every(m => MT.variants[m].start_tasks.find(t => t.id === 'mt_mind').name === `Mental Training — ${TEMPLATE_MINUTES[m]} minutes`));
check('4: only Mental Training is stamped',
  CHALLENGE_TEMPLATES.filter(t => t.start_flow === 'variant' && t.id !== MT.id).every(t => {
    const p = buildAttemptPayload({ template: t, variant: Object.keys(t.variants || {})[0], trainingMinutes: 30 });
    return !p || p.challenge.mentalTraining === undefined;
  }));

const legacyMeta = { templateId: MT.id, variant: 'standard', durationDays: 21 };
const legacyV2Meta = { ...legacyMeta, habitRulesVersion: 2 };
const newMeta = { ...legacyMeta, habitRulesVersion: 2, mentalTraining: { version: 1, minutes: 15 } };
const legacyTasks = MT.variants.standard.start_tasks.map(t => ({ ...t, source: 'template' }));
const legacyMind = legacyTasks.find(t => t.id === 'mt_mind');

check('4: an unstamped attempt has no training rules', trainingConfigOf(legacyMeta) === null && trainingFor(legacyMind, legacyMeta) === null);
check('4: a habit-rules-v2 attempt without the stamp has none either', trainingFor(legacyMind, legacyV2Meta) === null);
check('4: a stamped attempt does', JSON.stringify(trainingConfigOf(newMeta)) === JSON.stringify({ version: 1, minutes: 15 })
  && trainingFor(legacyMind, newMeta)?.practices?.length === 6);
check('4: only the training habit is a training habit',
  legacyTasks.filter(t => trainingFor(t, newMeta)).map(t => t.id).join() === 'mt_mind');
check('4: a stamp on another challenge is ignored',
  trainingConfigOf({ templateId: 'fat_loss_phase', mentalTraining: { version: 1, minutes: 15 } }) === null);
check('4: a malformed stamp is ignored',
  trainingConfigOf({ templateId: MT.id, mentalTraining: { minutes: 'x' } }) === null
    && trainingConfigOf({ templateId: MT.id, mentalTraining: 20 }) === null
    && trainingConfigOf({ templateId: MT.id, mentalTraining: null }) === null);

const v1Row = presentationFor(legacyMind, legacyMeta);
check('4: a version-1 attempt keeps its original wording and no guide',
  /prayer/i.test(v1Row.desc) && v1Row.guideId === null, v1Row.desc);
const v2Row = presentationFor(legacyMind, legacyV2Meta);
check('4: a version-2 attempt without the practices keeps its own wording, and no guide',
  v2Row.desc === 'Meditation, mindfulness, breathwork or visualization.' && v2Row.guideId === null);
check('4: the interim version-2 guide is retired, so the library shows one Mental Training guide',
  getGuide('mental:mind') === null
    && Object.values(HABIT_GUIDES).filter(g => g.source === 'mental' && /Mental Training/.test(g.title)).length === 1);
const newRow = presentationFor(legacyMind, newMeta);
check('4: a stamped attempt reads "Choose an intentional practice…" with the training guide',
  newRow.desc === TRAINING_DESC && newRow.guideId === TRAINING_GUIDE_ID);
check('4: the training guide exists and is complete',
  (() => {
    const g = getGuide(TRAINING_GUIDE_ID);
    return g && g.title && g.quickStart.length && g.why?.blurb && g.how?.requirement && g.optimize.length
      && g.advanced.length && g.mistakes.length && g.examples.length;
  })());
check('4: the training guide\'s rule names all six practices',
  EXPECTED.every(([, name, sub]) => getGuide(TRAINING_GUIDE_ID).how.requirement.includes(name)
    && getGuide(TRAINING_GUIDE_ID).how.requirement.toLowerCase().includes(sub.toLowerCase())));
check('4: the guide says opening, reading or timing earns nothing',
  getGuide(TRAINING_GUIDE_ID).how.earns.some(s => /earns nothing/i.test(s) && /timer/i.test(s)));

// presentTasks: rows of a legacy attempt are untouched by any of this.
const shownLegacy = presentTasks(legacyTasks, legacyMeta);
check('4: presenting a legacy attempt never shows the training sentence',
  !shownLegacy.some(t => t.desc === TRAINING_DESC));
check('4: presenting never renames a habit', presentTasks(legacyTasks, newMeta).every((t, i) => t.name === legacyTasks[i].name));

// Support lane: the row follows its own attempt.
const fatLoss = { templateId: 'fat_loss_phase', variant: 'standard', durationDays: 30, habitRulesVersion: 2 };
const supportMind = { ...legacyMind, challenges: ['support'] };
check('4: a support-lane Mental Training row follows the support attempt\'s stamp',
  trainingFor(supportMind, fatLoss, newMeta)?.minutes === 15 && trainingFor(supportMind, fatLoss, legacyMeta) === null);
check('4: …and its wording follows it too',
  presentTasks([supportMind], fatLoss, newMeta)[0].desc === TRAINING_DESC
    && presentTasks([supportMind], fatLoss, legacyMeta)[0].desc !== TRAINING_DESC);
check('4: merging a support Mental Training keeps the training habit as one row',
  (() => {
    const primary = buildAttemptPayload({ template: getTemplateById('fat_loss_phase'), variant: 'standard' }).tasks.map(t => ({ ...t, challenges: ['primary'] }));
    const support = buildAttemptPayload({ template: MT, variant: 'standard', trainingMinutes: 30 }).tasks;
    const { tasks } = mergeSupportTasks(primary, support);
    const minds = tasks.filter(t => t.id === 'mt_mind');
    return minds.length === 1 && minds[0].name === 'Mental Training — 30 minutes';
  })());

// Template sync: re-applying the setup keeps an attempt's minutes; with no
// stamp, the sync is exactly what it always was.
const sync = (meta, cold = false) => applyTrainingSetup(applyColdExposureUpgrade(MT.variants[meta.variant].start_tasks, cold), trainingConfigOf(meta));
check('4: a sync keeps a stamped attempt\'s minutes',
  sync({ ...newMeta, mentalTraining: { version: 1, minutes: 30 } }).find(t => t.id === 'mt_mind').name === 'Mental Training — 30 minutes');
check('4: a sync of an unstamped attempt is the template list, unchanged',
  JSON.stringify(sync(legacyMeta)) === JSON.stringify(applyColdExposureUpgrade(MT.variants.standard.start_tasks, false)));
check('4: applyTrainingSetup with no config hands back the same list',
  (() => { const l = MT.variants.hard.start_tasks; return applyTrainingSetup(l, null) === l; })());
check('4: applyTrainingSetup never mutates the template',
  MT.variants.standard.start_tasks.find(t => t.id === 'mt_mind').name === 'Mental Training — 5 minutes'
    && MT.variants.standard.start_tasks.find(t => t.id === 'mt_mind').target === undefined);

// An attempt already running at Standard's previous minimum. Its stamp is the
// only thing read, so the new options cannot reach it: same rule, same row,
// same XP, same length through a sync and through Retry.
{
  const running = { ...legacyMeta, habitRulesVersion: 2, mentalTraining: { version: 1, minutes: 15 } };
  const runningTasks = applyTrainingSetup(MT.variants.standard.start_tasks, trainingConfigOf(running));
  check('4: a Standard attempt started at 15 minutes still reads 15',
    trainingConfigOf(running)?.minutes === 15 && trainingFor(runningTasks.find(t => t.id === 'mt_mind'), running)?.minutes === 15);
  check('4: …its habit row still says 15 and targets 15',
    runningTasks.find(t => t.id === 'mt_mind').name === 'Mental Training — 15 minutes'
      && runningTasks.find(t => t.id === 'mt_mind').target?.value === 15);
  check('4: …a template sync keeps it at 15', sync(running).find(t => t.id === 'mt_mind').name === 'Mental Training — 15 minutes');
  check('4: …and Retry keeps 15, which Standard still allows',
    retryTrainingConfig('standard', 15, null).minutes === 15);
  const at15 = previewAttempt({ template: MT, variant: 'standard', trainingMinutes: 15 });
  const at10 = previewAttempt({ template: MT, variant: 'standard', trainingMinutes: 10 });
  check('4: …and it is worth exactly what a 10-minute Standard attempt is worth',
    at15.tasks.find(t => t.id === 'mt_mind').xp === at10.tasks.find(t => t.id === 'mt_mind').xp
      && at15.dailyBudget === at10.dailyBudget && at15.completionBonus === at10.completionBonus);
  const beginnerOld = { ...running, variant: 'beginner', mentalTraining: { version: 1, minutes: 15 } };
  check('4: a Beginner attempt at 15 is untouched as well', trainingConfigOf(beginnerOld)?.minutes === 15);
}

// Practice sets are versioned and never edited.
check('4: version 1 is the set new attempts get', practicesFor({ version: TRAINING_VERSION }) === PRACTICE_SETS[1]);
check('4: an unknown later version falls back to the newest known set, not to nothing',
  practicesFor({ version: 99 }).length === 6);

// Mode comparison (the chooser and the library) describes the new lengths.
const cmp = modeComparison(MT, 14);
const labels = cmp.map(c => `${c.key}:${c.changes.map(x => x.label).join('/')}`).join(' | ');
check('4: the mode chooser describes each mode at its recommended length',
  ['beginner', 'standard', 'hard'].every((k) => cmp.find(c => c.key === k)?.changes.some(x => x.label.includes(`${recommendedMinutes(k)} min`))),
  labels);

// ══ 5: completion is a checkbox; the practice is not XP ════════════════════
const meta = previewAttempt({ template: MT, variant: 'standard', durationDays: 14 }).meta;
const tasks = previewAttempt({ template: MT, variant: 'standard', durationDays: 14 }).tasks;
const rules = dayRules(meta);
const xpFor = (day) => computeDayXP(day, tasks, 'me', 3, 3, true, 3, rules);
const ticked = { tasks: { mt_mind: true } };
const withPractice = { tasks: { mt_mind: true }, [PRACTICE_FIELD]: 'open_sky' };
const practiceOnly = { tasks: { mt_mind: false }, [PRACTICE_FIELD]: 'open_sky' };
const mindXP = tasks.find(t => t.id === 'mt_mind').xp;
check('5: the habit pays its XP once it is ticked', xpFor(ticked).gained === mindXP, `${mindXP} XP`);
check('5: recording which practice it was adds nothing', xpFor(withPractice).gained === xpFor(ticked).gained);
check('5: a recorded practice without the tick pays nothing', xpFor(practiceOnly).gained === 0);
check('5: every practice pays the same', PRACTICES_V1.every(p => xpFor({ tasks: { mt_mind: true }, [PRACTICE_FIELD]: p.id }).gained === mindXP));
check('5: the practice field holds a known id or nothing',
  practiceOfDay({ [PRACTICE_FIELD]: 'dead_calm' }) === 'dead_calm' && practiceOfDay({ [PRACTICE_FIELD]: 'made_up' }) === null
    && practiceOfDay({ [PRACTICE_FIELD]: { text: 'journal' } }) === null && practiceOfDay(null) === null);
check('5: the task name helper matches the stored name', trainingTaskName(15) === 'Mental Training — 15 minutes');

// ══ 6: one practice, one habit ══════════════════════════════════════════════
const dayTasks = buildAttemptPayload({ template: MT, variant: 'standard' }).tasks;
const named = (id) => overlappingTasks(getPractice(id), dayTasks).map(t => t.id).join(',');
check('6: Pursuit of Wisdom is kept apart from the Reading habit', named('pursuit_of_wisdom') === 'mt_reading');
check('6: Inner Mirror is kept apart from Gratitude', named('inner_mirror') === 'mt_gratitude');
check('6: Moving Stillness and Open Sky are kept apart from the Physical Reset',
  named('moving_stillness') === 'mt_physical' && named('open_sky') === 'mt_physical');
check('6: Dead Calm is kept apart from Prayer', named('dead_calm') === 'mt_prayer');
check('6: Inner Vision overlaps with nothing', named('inner_vision') === '');
check('6: the general rule names Reading, Prayer, Gratitude and the Physical Reset',
  separateHabits(dayTasks).map(t => t.id).sort().join(',') === 'mt_gratitude,mt_physical,mt_prayer,mt_reading');
check('6: the training habit is never listed as its own overlap',
  PRACTICES_V1.every(p => !overlappingTasks(p, dayTasks).some(t => t.id === 'mt_mind')));
check('6: a habit missing from the day is not named',
  overlappingTasks(getPractice('pursuit_of_wisdom'), dayTasks.filter(t => t.id !== 'mt_reading')).length === 0);

// ══ 7: the timer ════════════════════════════════════════════════════════════
const T0 = 1_000_000;
let t = startTimer(IDLE_TIMER, T0);
check('7: a started timer counts from its start', elapsedMs(t, T0 + 5000) === 5000 && t.running);
t = pauseTimer(t, T0 + 5000);
check('7: pausing banks the time and stops the count', elapsedMs(t, T0 + 60000) === 5000 && !t.running);
t = startTimer(t, T0 + 60000);
check('7: resuming carries on from the banked time', elapsedMs(t, T0 + 63000) === 8000);
check('7: a backgrounded app catches up from timestamps', elapsedMs(t, T0 + 60000 + 10 * 60000) === 5000 + 10 * 60000);
check('7: a clock set backwards never makes elapsed time negative', elapsedMs(startTimer(IDLE_TIMER, T0), T0 - 5000) === 0);
check('7: remaining time never goes below zero', remainingMs(t, 60000, T0 + 10 * 3600000) === 0);
check('7: finished only at the target', !timerFinished(t, 20 * 60000, T0 + 63000) && timerFinished(t, 8000, T0 + 63000));
check('7: reset returns to idle', JSON.stringify(resetTimer()) === JSON.stringify(IDLE_TIMER));
check('7: starting a running timer changes nothing', startTimer(t, T0 + 99999) === t);
check('7: the clock reads mm:ss and rounds up',
  formatClock(20 * 60000) === '20:00' && formatClock(65000) === '1:05' && formatClock(400) === '0:01' && formatClock(0) === '0:00' && formatClock(-5) === '0:00');
check('7: whole minutes run', minutesRun(t, T0 + 63000) === 0 && minutesRun(startTimer(IDLE_TIMER, T0), T0 + 125000) === 2);

// ══ 8: default or customized ═════════════════════════════════════════════════
// Every new attempt records whether its length was the mode's recommendation.
for (const mode of MODES) {
  for (const m of allowedMinutes(mode)) {
    const c = buildTrainingConfig(mode, m);
    const want = m === recommendedMinutes(mode) ? MINUTES_SOURCE.DEFAULT : MINUTES_SOURCE.CUSTOMIZED;
    check(`8: ${mode} at ${m} — recorded as ${want}`, c.minutes === m && c.minutesSource === want && c.version === TRAINING_VERSION);
  }
}
check('8: no choice at all is the recommendation, recorded as default',
  MODES.every(m => buildTrainingConfig(m).minutesSource === 'default' && buildTrainingConfig(m, null).minutes === recommendedMinutes(m)));
check('8: a length the mode does not allow falls back to the recommendation, recorded as default',
  buildTrainingConfig('hard', 5).minutes === 30 && buildTrainingConfig('hard', 5).minutesSource === 'default'
    && buildTrainingConfig('standard', 5).minutesSource === 'default');
check('8: a new attempt carries it — Standard with no choice is 10 by default',
  JSON.stringify(buildAttemptPayload({ template: MT, variant: 'standard' }).challenge.mentalTraining)
    === JSON.stringify({ version: 1, minutes: 10, minutesSource: 'default' }));
check('8: …Standard at 15 or 30 is customized',
  buildAttemptPayload({ template: MT, variant: 'standard', trainingMinutes: 15 }).challenge.mentalTraining.minutesSource === 'customized'
    && buildAttemptPayload({ template: MT, variant: 'standard', trainingMinutes: 30 }).challenge.mentalTraining.minutesSource === 'customized');
check('8: …and the source never changes what the attempt is worth',
  (() => {
    const d = previewAttempt({ template: MT, variant: 'standard' });
    const c = previewAttempt({ template: MT, variant: 'standard', trainingMinutes: 15 });
    return d.dailyBudget === c.dailyBudget && d.completionBonus === c.completionBonus
      && d.tasks.find(t => t.id === 'mt_mind').xp === c.tasks.find(t => t.id === 'mt_mind').xp;
  })());
check('8: an attempt from before lengths were recorded has no source',
  minutesSourceOf({ templateId: MT.id, mentalTraining: { version: 1, minutes: 15 } }) === null
    && minutesSourceOf({ templateId: MT.id, mentalTraining: { version: 1, minutes: 15, minutesSource: 'guess' } }) === null
    && minutesSourceOf(null) === null);
check('8: trainingConfigOf still reads only the version and the length',
  JSON.stringify(trainingConfigOf({ templateId: MT.id, mentalTraining: { version: 1, minutes: 10, minutesSource: 'default', lengthChoice: { decision: 'switched' } } }))
    === JSON.stringify({ version: 1, minutes: 10 }));

// Retry follows what the finished attempt recorded.
const json = (x) => JSON.stringify(x);
check('8: Retry of a default length gets today\'s recommendation',
  json(retryTrainingConfig('standard', 10, 'default')) === json({ version: 1, minutes: 10, minutesSource: 'default' })
    && json(retryTrainingConfig('beginner', 5, 'default')) === json({ version: 1, minutes: 5, minutesSource: 'default' }));
check('8: …so an improved recommendation reaches it (one taken at 15 retries at 10)',
  json(retryTrainingConfig('standard', 15, 'default')) === json({ version: 1, minutes: 10, minutesSource: 'default' }));
check('8: Retry of a customized length keeps it',
  json(retryTrainingConfig('standard', 15, 'customized')) === json({ version: 1, minutes: 15, minutesSource: 'customized' })
    && json(retryTrainingConfig('standard', 30, 'customized')) === json({ version: 1, minutes: 30, minutesSource: 'customized' })
    && json(retryTrainingConfig('beginner', 10, 'customized')) === json({ version: 1, minutes: 10, minutesSource: 'customized' }));
check('8: …unless the mode no longer allows it, when it takes the recommendation',
  json(retryTrainingConfig('hard', 15, 'customized')) === json({ version: 1, minutes: 30, minutesSource: 'default' }));
check('8: Retry of an unrecorded length keeps it and leaves it unrecorded',
  json(retryTrainingConfig('standard', 15, null)) === json({ version: 1, minutes: 15 })
    && json(retryTrainingConfig('standard', 30, null)) === json({ version: 1, minutes: 30 })
    && json(retryTrainingConfig('beginner', 15, undefined)) === json({ version: 1, minutes: 15 }));
check('8: …and a missing or disallowed one takes the recommendation',
  json(retryTrainingConfig('standard', null, null)) === json({ version: 1, minutes: 10, minutesSource: 'default' })
    && json(retryTrainingConfig('standard', 5, null)) === json({ version: 1, minutes: 10, minutesSource: 'default' }));

// ══ 9: the Standard length choice ════════════════════════════════════════════
const TODAY = '2026-11-22';
const mtMeta = (variant, mentalTraining) => ({ templateId: MT.id, name: 'Mental Training Phase', variant, durationDays: 21, habitRulesVersion: 2, ...(mentalTraining ? { mentalTraining } : {}) });
const old15 = mtMeta('standard', { version: 1, minutes: 15 });
check('9: a Standard attempt saved at 15 with no recorded source is asked', needsLengthChoice(old15));
check('9: the choice is 15 → 10, in Standard', LENGTH_CHOICE.mode === 'standard' && LENGTH_CHOICE.from === 15 && LENGTH_CHOICE.to === 10);
check('9: nothing else is asked',
  [
    mtMeta('standard', { version: 1, minutes: 10 }),
    mtMeta('standard', { version: 1, minutes: 30 }),
    mtMeta('beginner', { version: 1, minutes: 15 }),
    mtMeta('beginner', { version: 1, minutes: 5 }),
    mtMeta('hard', { version: 1, minutes: 30 }),
    mtMeta('standard', null),                                                     // before the six practices
    mtMeta('standard', { version: 1, minutes: 15, minutesSource: 'customized' }), // a new attempt at 15
    mtMeta('standard', { version: 1, minutes: 10, minutesSource: 'default' }),
    mtMeta('standard', { version: 1, minutes: 15, lengthChoice: { decision: 'kept', on: TODAY } }),
    { ...old15, templateId: 'fat_loss_phase' },
    null,
  ].every(m => !needsLengthChoice(m)));
check('9: a Retry of an unanswered 15 is asked again — it is a new attempt that was never asked',
  needsLengthChoice(mtMeta('standard', retryTrainingConfig('standard', 15, null))));
check('9: a Retry of an answered one is not',
  !needsLengthChoice(mtMeta('standard', retryTrainingConfig('standard', 10, 'default')))
    && !needsLengthChoice(mtMeta('standard', retryTrainingConfig('standard', 15, 'customized'))));

// A real profile: a stamped Standard attempt saved at 15 (the shape v4.3.0 and
// v4.3.1 wrote), seven days in, with a mix of finished days.
const saved = previewAttempt({ template: MT, variant: 'standard', durationDays: 21, trainingMinutes: 15 });
const savedMeta = { ...saved.meta, mentalTraining: { version: 1, minutes: 15 } };
const isoDaysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const profile15 = {
  name: 'Me', challengeStart: isoDaysAgo(7), xpStartDay: 1, xpPenalties: true,
  activeChallenge: savedMeta,
  tasks: saved.tasks.map((t, i) => ({ ...t, source: 'template', order: i })),
  supportChallenge: null, supportChallengeStart: null,
  rankHistory: [{ rank: 1 }],
};
const ids = profile15.tasks.map(t => t.id);
const days = {
  1: { tasks: Object.fromEntries(ids.map(id => [id, true])) },
  2: { tasks: Object.fromEntries(ids.map(id => [id, true])), [PRACTICE_FIELD]: 'dead_calm' },
  3: { tasks: Object.fromEntries(ids.map(id => [id, id !== 'mt_mind'])) },
  4: { tasks: { mt_mind: true } },
  5: {},
  6: { tasks: Object.fromEntries(ids.map(id => [id, true])) },
  7: { tasks: Object.fromEntries(ids.map(id => [id, true])) },
  8: { tasks: { mt_mind: true } },
};
const allDays = { me: days };
const completion = (prof) => (n) => {
  const d = days[n]; const list = prof.tasks;
  return d ? Math.round(100 * list.filter(t => d.tasks?.[t.id]).length / list.length) : 0;
};
const totalOf = (prof) => computeTotalXP(allDays, { me: prof }, 'me', completion(prof), 7, 8);
const perDay = (prof) => Object.keys(days).map(n => computeDayXP(days[n], prof.tasks, 'me', Number(n), 8, true, 8, dayRules(prof.activeChallenge)));
const streakOf = (prof) => Object.keys(days).map(n => completion(prof)(Number(n))).join(',');
const rowsExceptMind = (prof) => json(prof.tasks.filter(t => t.id !== 'mt_mind'));
const metaExceptTraining = (meta) => { const { mentalTraining, ...rest } = meta; return json(rest); };

check('9: the profile waits on the primary lane', lengthChoiceLane(profile15) === 'primary');
check('9: …and the XP it holds is real', totalOf(profile15).gained > 0, `gained ${totalOf(profile15).gained}`);

const switched = profileWithLengthChoice(profile15, 'primary', 'switch', TODAY);
const mindAfter = switched.tasks.find(t => t.id === 'mt_mind');
const mindBefore = profile15.tasks.find(t => t.id === 'mt_mind');
check('9: Switch — the attempt now trains for 10 minutes, recorded as the default',
  json(switched.activeChallenge.mentalTraining)
    === json({ version: 1, minutes: 10, minutesSource: 'default', lengthChoice: { decision: 'switched', from: 15, on: TODAY } }));
check('9: …its habit row reads 10 and targets 10',
  mindAfter.name === 'Mental Training — 10 minutes' && mindAfter.target?.value === 10 && mindAfter.target?.unit === 'minutes'
    && mindAfter.desc === TRAINING_DESC);
check('9: …with the same id, XP, weight, habit, order and source',
  ['id', 'xp', 'keystone', 'habitKey', 'icon', 'color', 'order', 'source'].every(k => json(mindAfter[k]) === json(mindBefore[k])));
check('9: …every other habit is exactly as it was', rowsExceptMind(switched) === rowsExceptMind(profile15));
check('9: …and so is the rest of the attempt and the profile',
  metaExceptTraining(switched.activeChallenge) === metaExceptTraining(profile15.activeChallenge)
    && json({ ...switched, tasks: null, activeChallenge: null }) === json({ ...profile15, tasks: null, activeChallenge: null }));
check('9: …Lifetime XP is identical, gained and lost',
  json(totalOf(switched)) === json(totalOf(profile15)), json(totalOf(switched)));
check('9: …every finished day pays exactly what it paid', json(perDay(switched)) === json(perDay(profile15)));
check('9: …completion and streak days are identical', streakOf(switched) === streakOf(profile15), streakOf(switched));
check('9: …a day trained at 15 stays complete, a day not trained stays incomplete',
  computeDayXP(days[4], switched.tasks, 'me', 4, 8, true, 8, dayRules(switched.activeChallenge)).gained > 0
    && computeDayXP(days[3], switched.tasks, 'me', 3, 8, true, 8, dayRules(switched.activeChallenge)).gained
      === computeDayXP(days[3], profile15.tasks, 'me', 3, 8, true, 8, dayRules(profile15.activeChallenge)).gained);
check('9: …the training screen asks for 10 from now on', trainingFor(mindAfter, switched.activeChallenge)?.minutes === 10);
check('9: …a template sync keeps 10', sync(switched.activeChallenge).find(t => t.id === 'mt_mind').name === 'Mental Training — 10 minutes');
check('9: …and it is never asked again',
  !needsLengthChoice(switched.activeChallenge) && lengthChoiceLane(switched) === null
    && profileWithLengthChoice(switched, 'primary', 'switch', TODAY) === null
    && profileWithLengthChoice(switched, 'primary', 'keep', TODAY) === null);
check('9: …the original profile object is not mutated',
  profile15.activeChallenge.mentalTraining.minutes === 15 && !('minutesSource' in profile15.activeChallenge.mentalTraining)
    && profile15.tasks.find(t => t.id === 'mt_mind').name === 'Mental Training — 15 minutes');
check('9: …and a Retry of it starts at today\'s recommendation',
  json(retryTrainingConfig('standard', switched.activeChallenge.mentalTraining.minutes, switched.activeChallenge.mentalTraining.minutesSource))
    === json({ version: 1, minutes: 10, minutesSource: 'default' }));

const kept = profileWithLengthChoice(profile15, 'primary', 'keep', TODAY);
check('9: Keep — the attempt stays at 15, recorded as customized',
  json(kept.activeChallenge.mentalTraining) === json({ version: 1, minutes: 15, minutesSource: 'customized', lengthChoice: { decision: 'kept', on: TODAY } }));
check('9: …no habit row changes at all', kept.tasks === profile15.tasks);
check('9: …XP is identical', json(totalOf(kept)) === json(totalOf(profile15)));
check('9: …and it is never asked again',
  !needsLengthChoice(kept.activeChallenge) && lengthChoiceLane(kept) === null
    && profileWithLengthChoice(kept, 'primary', 'switch', TODAY) === null);
check('9: …a Retry keeps 15',
  json(retryTrainingConfig('standard', kept.activeChallenge.mentalTraining.minutes, kept.activeChallenge.mentalTraining.minutesSource))
    === json({ version: 1, minutes: 15, minutesSource: 'customized' }));

check('9: an unknown answer or lane changes nothing',
  profileWithLengthChoice(profile15, 'primary', 'later', TODAY) === null
    && profileWithLengthChoice(profile15, 'elsewhere', 'switch', TODAY) === null
    && profileWithLengthChoice(profile15, 'support', 'switch', TODAY) === null
    && profileWithLengthChoice(null, 'primary', 'switch', TODAY) === null);
check('9: an attempt that has not begun yet is asked too',
  lengthChoiceLane({ ...profile15, challengeStart: isoDaysAgo(-3) }) === 'primary');
check('9: a profile with no running challenge is not',
  lengthChoiceLane({ ...profile15, challengeStart: null }) === null);

// The support lane: Mental Training added beside a Fat Loss primary.
{
  const primary = previewAttempt({ template: getTemplateById('fat_loss_phase'), variant: 'standard', durationDays: 30 });
  const support = previewAttempt({ template: MT, variant: 'standard', durationDays: 21, trainingMinutes: 15 });
  const supportMeta = { ...support.meta, mentalTraining: { version: 1, minutes: 15 } };
  const { tasks } = mergeSupportTasks(primary.tasks.map(t => ({ ...t, challenges: ['primary'] })), support.tasks);
  const prof = {
    challengeStart: isoDaysAgo(10), activeChallenge: primary.meta, tasks,
    supportChallenge: supportMeta, supportChallengeStart: isoDaysAgo(4),
  };
  check('9: a support Mental Training attempt saved at 15 is asked on the support lane', lengthChoiceLane(prof) === 'support');
  check('9: …but not without its start date', lengthChoiceLane({ ...prof, supportChallengeStart: null }) === null);
  const after = profileWithLengthChoice(prof, 'support', 'switch', TODAY);
  const mind = after.tasks.find(t => t.id === 'mt_mind');
  check('9: …Switch moves the support attempt and its support row to 10',
    after.supportChallenge.mentalTraining.minutes === 10 && mind.name === 'Mental Training — 10 minutes'
      && json(mind.challenges) === json(['support']));
  check('9: …the primary attempt and every other row are untouched',
    json(after.activeChallenge) === json(prof.activeChallenge)
      && json(after.tasks.filter(t => t.id !== 'mt_mind')) === json(prof.tasks.filter(t => t.id !== 'mt_mind')));
  check('9: …the primary lane is never asked about it', profileWithLengthChoice(prof, 'primary', 'switch', TODAY) === null);
  check('9: …and the training screen for the support row asks for 10',
    trainingFor(mind, after.activeChallenge, after.supportChallenge)?.minutes === 10);
}

// A Mental Training primary with a support beside it: only the primary's row.
{
  const support = previewAttempt({ template: getTemplateById('fat_loss_phase'), variant: 'standard', durationDays: 30 });
  const { tasks } = mergeSupportTasks(profile15.tasks, support.tasks);
  const prof = { ...profile15, tasks, supportChallenge: support.meta, supportChallengeStart: isoDaysAgo(2) };
  const after = profileWithLengthChoice(prof, 'primary', 'switch', TODAY);
  check('9: with a support running, Switch changes only the primary\'s training row',
    after.tasks.filter((t, i) => json(t) !== json(prof.tasks[i])).map(t => t.id).join() === 'mt_mind'
      && json(after.supportChallenge) === json(prof.supportChallenge));
}

// ══ summary ═════════════════════════════════════════════════════════════════
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
