/**
 * ⚡ Fat Loss — HARD MODE (30 days).
 *
 * Covers what makes Hard a progression rather than bigger numbers, the removal
 * of calorie counting in favour of the fullness habit, the differentiated cardio
 * week, the four-week arc that never adds restriction, the safety screen — and
 * critically, that Beginner and Standard are completely untouched.
 */
import * as FLH from '../src/data/fatLossHardConfig.js';
import { HABIT_KEYS, habitKeyOf } from '../src/data/habitKeys.js';
import { getTemplateById } from '../src/data/challengeTemplates.js';
import {
  hasWeeklyRequirements, getWeeklyRequirementDefs, challengeWeeks,
  WEEKLY_REQUIREMENT_DEFS, WEEKLY_REQUIREMENT_TEMPLATE_IDS,
} from '../src/utils/weeklyRequirements.js';
import { photoKey, MAX_EDGE, JPEG_QUALITY } from '../src/utils/photoStore.js';

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

const tpl = getTemplateById('fat_loss_phase');
const hard = tpl.variants.hard;
const tasks = FLH.buildStartTasks();
const weekly = FLH.weeklyRequirementDefs();
const taskById = (id) => tasks.find(t => t.id === id);

// ══ It is an addition to the EXISTING challenge ════════════════════════════
check('Hard Mode lives inside the existing Fat Loss Challenge',
  FLH.FAT_LOSS_TEMPLATE_ID === 'fat_loss_phase' && !!tpl && tpl.challenge_name === 'Fat Loss Challenge');
check('Fat Loss still has all three variants',
  ['beginner', 'standard', 'hard'].every(v => !!tpl.variants[v]));
check('it still uses the existing variant start flow', tpl.start_flow === 'variant');
check('it keeps its existing badge and reward', tpl.rewards?.badge_id === 'body_fat_slayer');
check('Hard is a 30-day programme', FLH.HARD_DURATION_DAYS === 30 && hard.recommended_duration_days === 30);
check('the existing duration options are unchanged',
  JSON.stringify(tpl.duration_options_days) === '[14,30,60]');
check('isFatLossHard identifies only the Hard variant',
  FLH.isFatLossHard({ templateId: 'fat_loss_phase', variant: 'hard' }) &&
  !FLH.isFatLossHard({ templateId: 'fat_loss_phase', variant: 'standard' }) &&
  !FLH.isFatLossHard({ templateId: 'energy_reset_10_day', variant: 'hard' }));

// ══ Beginner and Standard are untouched ═══════════════════════════════════
const beg = tpl.variants.beginner.start_tasks;
const std = tpl.variants.standard.start_tasks;
check('Beginner keeps its 6,000-step target',
  beg.find(t => t.id === 'fl_steps').target.value === 6000);
check('Standard keeps its 8,000-step target',
  std.find(t => t.id === 'fl_steps').target.value === 8000);
check('Beginner keeps exactly its original 7 tasks', beg.length === 7);
check('Standard keeps exactly its original 7 tasks', std.length === 7);
check('neither gains a fullness habit',
  !beg.some(t => t.id === 'fl_fullness') && !std.some(t => t.id === 'fl_fullness'));
check('neither gains photo capture',
  !beg.some(t => t.photoCapture) && !std.some(t => t.photoCapture));
check('the legacy Fat Loss weekly requirements are unchanged',
  WEEKLY_REQUIREMENT_DEFS.length === 2 &&
  WEEKLY_REQUIREMENT_DEFS.find(d => d.id === 'lifting').perWeek === 3 &&
  WEEKLY_REQUIREMENT_DEFS.find(d => d.id === 'zone2').perWeek === 2);
check('a Standard attempt still resolves to the legacy weekly defs',
  JSON.stringify(getWeeklyRequirementDefs({ templateId: 'fat_loss_phase', variant: 'standard' }))
    === JSON.stringify(WEEKLY_REQUIREMENT_DEFS));
check('Fat Loss is still in the legacy weekly-requirement set',
  WEEKLY_REQUIREMENT_TEMPLATE_IDS.has('fat_loss_phase'));

// ══ No calorie counting ═══════════════════════════════════════════════════
check('the old "stay in a calorie deficit" task is GONE', !taskById('fl_deficit'));
// "Deficit" may appear in copy EXPLAINING why a habit matters (protein protects
// muscle in a deficit). What must not exist is a requirement to hit, track or
// count a calorie number.
check('no daily task asks the user to hit a calorie target',
  !tasks.some(t => /calorie|kcal|deficit/i.test(t.name)),
  JSON.stringify(tasks.map(t => t.name)));
check('no weekly requirement asks for a calorie target',
  !weekly.some(d => /calorie|kcal|deficit/i.test(d.label)));
check('nothing in Hard Mode asks the user to count or track calories',
  ![...tasks.map(t => `${t.name} ${t.desc || ''}`), ...weekly.map(d => `${d.label} ${d.note || ''}`)]
    .some(txt => /(count|track|log|hit)\s+(your\s+)?(calorie|kcal)/i.test(txt)));
check('the challenge preview lists no calorie requirement',
  !hard.required_daily_tasks.some(t => /calorie|deficit/i.test(t)),
  JSON.stringify(hard.required_daily_tasks.filter(t => /calorie/i.test(t))));
check('the fullness habit replaces it', !!taskById('fl_fullness'));
check('the fullness task uses the specified wording',
  taskById('fl_fullness').name === 'Stop eating at ~90% full — satisfied, not stuffed.');
check('the plain explanation is the specified sentence',
  FLH.FULLNESS.plain === 'Finish meals satisfied, not stuffed. Stop when you feel like you could comfortably eat a little more.');
check('Forge does NOT claim fullness creates a specific deficit',
  /not claiming this creates a specific calorie deficit/i.test(FLH.FULLNESS.honesty));
check('it explains what the combination is intended to do instead',
  /make a moderate deficit more likely/i.test(FLH.FULLNESS.honesty) &&
  /without asking you to track anything/i.test(FLH.FULLNESS.honesty));
check('fullness is framed as a skill, not a pass/fail test',
  /skill, not a test/i.test(FLH.FULLNESS.howTo.join(' ')));

// ══ Daily requirements ════════════════════════════════════════════════════
for (const [id, label] of [
  ['fl_protein', 'protein target'], ['fl_steps', '10,000 steps'], ['fl_fullness', '90% fullness'],
  ['fl_whole', 'mostly whole foods'], ['fl_sleep', 'sleep'], ['fl_photo', 'daily progress photo'],
  ['fl_water', 'water'], ['daily_log', 'daily log'],
]) check(`daily requirement present: ${label}`, !!taskById(id));
check('steps are 10,000 — the Hard differentiator',
  taskById('fl_steps').target.value === 10000 && FLH.STEP_TARGET === 10000);
check('steps are required EVERY day, not on average',
  /every day, not on average/i.test(taskById('fl_steps').desc));
check('protein is the keystone habit', taskById('fl_protein').keystoneHabit === true);
check('protein defaults to 0.8–1.0 g per lb of target weight',
  FLH.PROTEIN.perLbLow === 0.8 && FLH.PROTEIN.perLbHigh === 1.0);
check('a fixed protein number is offered for simplicity',
  FLH.PROTEIN.modes.some(m => m.id === 'fixed'));
check('the fixed mode produces a single gram target',
  FLH.proteinLabel({ proteinMode: 'fixed', proteinFixedGrams: 160 }) === 'Hit 160g protein');
check('the per-lb mode produces a range from target weight',
  FLH.proteinLabel({ proteinMode: 'perLb', targetWeightLb: 180 }) === 'Hit protein: 144–180g');
check('whole foods target ~90%', FLH.WHOLE_FOOD_PCT === 90 && /90%/.test(taskById('fl_whole').name));
check('whole foods is explicitly not a ban list',
  /not a ban list/i.test(taskById('fl_whole').desc));
check('sleep targets 7.5–9 hours',
  FLH.SLEEP_TARGET.min === 7.5 && FLH.SLEEP_TARGET.max === 9 &&
  taskById('fl_sleep').target.value === 7.5);
check('the daily photo is a required task, not optional',
  !!taskById('fl_photo') && taskById('fl_photo').xp > 0);
check('the photo task requests in-app capture', taskById('fl_photo').photoCapture === true);
check('photo standardisation covers every specified condition',
  ['location', 'lighting', 'distance', 'posture', 'clothing', 'time of day']
    .every(k => new RegExp(k, 'i').test(FLH.PHOTO_GUIDE.items.join(' '))));
check('photos are private by default and never uploaded',
  /stay on this device/i.test(FLH.PHOTO_GUIDE.privacy) &&
  /never uploaded/i.test(FLH.PHOTO_GUIDE.privacy) &&
  /excluded from Settings/i.test(FLH.PHOTO_GUIDE.privacy));
check('photo storage downscales rather than storing raw camera files',
  MAX_EDGE <= 1200 && JPEG_QUALITY < 1);
check('photo keys are scoped per profile', photoKey('me', 3) === 'me:3' && photoKey('girlfriend', 3) === 'girlfriend:3');

// ══ XP ladder ═════════════════════════════════════════════════════════════
check('not every habit awards identical XP', new Set(tasks.map(t => t.xp)).size > 1);
const HIGHEST = [FLH.XP.protein, FLH.XP.steps, FLH.XP.fullness, FLH.XP.lifting];
const HIGH = [FLH.XP.zone2, FLH.XP.intervals, FLH.XP.wholeFood, FLH.XP.sleep];
const LOWER = [FLH.XP.photo, FLH.XP.waist, FLH.XP.review];
check('the highest-importance behaviours outrank every lower-XP one',
  Math.min(...HIGHEST) > Math.max(...LOWER), `${Math.min(...HIGHEST)} > ${Math.max(...LOWER)}`);
check('the daily photo, waist and review are the lowest-XP required items',
  Math.max(...LOWER) <= Math.min(...HIGH.filter(v => v > 0)), JSON.stringify(LOWER));
check('resistance training is the highest-XP weekly requirement',
  FLH.XP.lifting === Math.max(...weekly.map(d => d.xp)));
check('steps are weighted above Normal Fat Loss (25 → 30)',
  FLH.XP.steps === 30 && std.find(t => t.id === 'fl_steps').xp === 25);
check('it follows Forge\'s existing Fat Loss hierarchy — keystones stay at 40',
  FLH.XP.protein === 40 && FLH.XP.wholeFood === 40 &&
  std.find(t => t.id === 'fl_protein').xp === 40);
check('Fat Loss still has exactly two daily keystone habits',
  tasks.filter(t => t.keystoneHabit).length === 2);
check('the keystones are still protein and whole foods',
  tasks.filter(t => t.keystoneHabit).map(t => t.id).sort().join(',') === 'fl_protein,fl_whole');

// ══ Weekly training ═══════════════════════════════════════════════════════
const w = (id) => weekly.find(d => d.id === id);
check('resistance training is 3 per week', w('lifting').perWeek === 3);
check('it does NOT require 4 or more lifting sessions', w('lifting').perWeek < 4);
check('an existing lifting programme counts', /existing programme counts/i.test(w('lifting').note));
check('there are exactly three cardio sessions per week',
  w('zone2').perWeek + w('intervals').perWeek === 3);
check('they are NOT three identical sessions',
  w('zone2').perWeek === 2 && w('intervals').perWeek === 1 && w('zone2').label !== w('intervals').label);
check('two sessions are Zone 2–3 at 30 minutes',
  /Zone 2–3/.test(w('zone2').label) && /30 minutes/.test(w('zone2').note));
check('one session is an interval session', /Interval/i.test(w('intervals').label));
check('the interval session is explicitly NOT 30 continuous minutes in Zone 4–5',
  /not 30 continuous minutes/i.test(FLH.CARDIO.intervals.detail));
check('the interval template has a warm-up, hard efforts, recovery and cool-down',
  /warm-up/i.test(FLH.CARDIO.intervals.template.join(' ')) &&
  /4–6 hard intervals/i.test(FLH.CARDIO.intervals.template.join(' ')) &&
  /recovery/i.test(FLH.CARDIO.intervals.template.join(' ')) &&
  /cool-down/i.test(FLH.CARDIO.intervals.template.join(' ')));
check('the interval workout totals roughly 15–25 minutes',
  /15–25 minutes/.test(FLH.CARDIO.intervals.totalTime));
check('maximal all-out sprints are NOT required',
  /Not all-out sprints/i.test(FLH.CARDIO.intervals.caution) && /not maximal/i.test(FLH.CARDIO.intervals.caution));
check('the two easy sessions are explained as low-fatigue aerobic volume',
  /low fatigue/i.test(FLH.CARDIO.blurb) && /higher-end cardiovascular fitness/i.test(FLH.CARDIO.blurb));
check('HIIT is NOT marketed as magically superior for fat loss',
  /not magic for fat loss/i.test(FLH.CARDIO.honesty));
check('the weekly review and waist measurement are required weekly items',
  w('waist').perWeek === 1 && w('review').perWeek === 1);
check('every weekly requirement has a distinct habit key',
  new Set(weekly.map(d => d.habitKey)).size === weekly.length);

// ── Through the existing generic weekly engine ────────────────────────────
const hardMeta = {
  templateId: 'fat_loss_phase', variant: 'hard', durationDays: 30,
  weeklyRequirementDefs: weekly,
};
check('Hard uses the existing weekly engine', hasWeeklyRequirements(hardMeta));
check('the attempt\'s own defs win over the legacy Fat Loss constant',
  getWeeklyRequirementDefs(hardMeta).length === 5);
const wks = challengeWeeks(hardMeta);
check('30 days is four full weeks plus a 2-day week',
  wks.length === 5 && wks[0].days === 7 && wks[4].days === 2);
check('the short final week is prorated by the existing engine',
  wks[4].targets.lifting === 1 && wks[4].partial === true);
check('full weeks use the full targets',
  wks[0].targets.lifting === 3 && wks[0].targets.zone2 === 2 && wks[0].targets.intervals === 1);

// ══ Weekly progress check ═════════════════════════════════════════════════
check('waist measurement is required weekly', !!w('waist'));
check('waist guidance specifies repeatable conditions',
  /same conditions/i.test(w('waist').note) && /not sucked in/i.test(w('waist').note));
check('weight is NOT a required task anywhere',
  !tasks.some(t => /weigh|scale/i.test(t.name)) && !weekly.some(d => /weigh|scale/i.test(d.label)));
check('weigh-in is listed as optional in the variant',
  hard.optional_tasks.some(t => /optional/i.test(t) && /weigh/i.test(t)));
check('the challenge is stated to work fully without a scale',
  hard.optional_tasks.some(t => /works fully without a scale/i.test(t)));

// ══ What you may notice ═══════════════════════════════════════════════════
const notice = FLH.WHAT_YOU_MAY_NOTICE;
check('the section is called "What you may notice"', notice.title === 'What you may notice');
for (const item of ['waist', 'face', 'stomach', 'abdominal', 'shoulder', 'clothes', 'cardiovascular', 'exercise tolerance', 'confidence'])
  check(`it lists a potential change: ${item}`, new RegExp(item, 'i').test(notice.items.join(' ')));
check('the typical target is the exact specified sentence',
  notice.target === 'Typical target: approximately 3–5 lb of body fat over 30 days for an appropriate candidate following the program consistently.');
check('the disclaimer is the exact specified sentence',
  notice.disclaimer === 'Results vary. Starting body composition, energy intake, adherence, activity, genetics, water balance, and other factors affect results.');
check('the target is explicitly framed as an estimate, not a promise',
  /estimate, not a commitment/i.test(notice.framing));
check('Forge does not claim it can measure body fat',
  /cannot measure your body fat and will not pretend to/i.test(notice.framing));
check('the variant\'s expected_results carries the same framing, not a guarantee',
  /Typical target/.test(hard.expected_results) && /Results vary/.test(hard.expected_results));

// ══ The 30-day progression ════════════════════════════════════════════════
check('there are four progression weeks', FLH.WEEKS.length === 4);
check('week 1 is Lock In', FLH.WEEKS[0].title === 'Lock In');
check('week 2 is Build Momentum', FLH.WEEKS[1].title === 'Build Momentum');
check('week 3 is Push', FLH.WEEKS[2].title === 'Push');
check('week 4 is Finish', FLH.WEEKS[3].title === 'Finish');
check('week 1 focuses on establishing perfect execution',
  /perfect execution/i.test(FLH.WEEKS[0].goal));
check('week 2 is about consistency becoming automatic',
  /automatic/i.test(FLH.WEEKS[1].goal));
check('week 3 explicitly does NOT increase restriction',
  /does NOT mean eating less/i.test(FLH.WEEKS[2].coaching));
check('week 3 explicitly does NOT prescribe extra cardio',
  /adding cardio/i.test(FLH.WEEKS[2].coaching) && /Do not reduce calories, add extra cardio/i.test(FLH.WEEKS[2].warning));
check('week 3 says the challenge gets harder through consistency',
  /harder through consistency, not restriction/i.test(FLH.WEEKS[2].goal));
check('week 4 targets the strongest week of adherence',
  /strongest week of adherence/i.test(FLH.WEEKS[3].goal));
check('week 4 covers every specified finishing priority',
  ['keystone', 'lifting', 'cardio', 'Steps', 'Nutrition', 'photo']
    .every(k => new RegExp(k, 'i').test(FLH.WEEKS[3].focus.join(' '))));
check('the week for a day maps correctly',
  FLH.weekFor(1).week === 1 && FLH.weekFor(7).week === 1 && FLH.weekFor(8).week === 2 &&
  FLH.weekFor(21).week === 3 && FLH.weekFor(22).week === 4 && FLH.weekFor(30).week === 4);
check('a day beyond the arc clamps to the final week', FLH.weekFor(99).week === 4);

// ══ Safety ════════════════════════════════════════════════════════════════
check('Hard Mode states what it means',
  ['More structure', 'More consistency', 'More precision', 'Better conditioning']
    .every(v => FLH.SAFETY.meaning.is.includes(v)));
for (const bad of ['Crash dieting', 'Starvation', 'Daily HIIT', 'Excessive cardio', 'entire food groups', 'injury', 'Dehydration'])
  check(`it states it does NOT mean: ${bad}`, new RegExp(bad, 'i').test(FLH.SAFETY.meaning.isNot.join(' ')));
check('the setup screens for very lean / underweight',
  FLH.SAFETY.screen.options.some(o => /very lean|underweight/i.test(o.label)));
check('it screens for pregnancy', FLH.SAFETY.screen.options.some(o => /pregnant/i.test(o.label)));
check('it screens for eating disorders and a history of disordered eating',
  FLH.SAFETY.screen.options.some(o => /eating disorder/i.test(o.label) && /disordered eating/i.test(o.label)));
check('it screens for any other medical reason',
  FLH.SAFETY.screen.options.some(o => o.id === 'medical'));
check('flagging any of them is detected',
  FLH.isContraindicated({ safetyFlags: ['lean'] }) &&
  FLH.isContraindicated({ safetyFlags: ['ed', 'medical'] }));
check('answering "none of these" is not a contraindication',
  !FLH.isContraindicated({ safetyFlags: ['none'] }) && !FLH.isContraindicated({ safetyFlags: [] }));
check('a flagged user is told this is not the right challenge',
  /not the right challenge right now/i.test(FLH.SAFETY.flagged.title));
check('the guidance is not framed as a discipline failure',
  /not a judgement about discipline/i.test(FLH.SAFETY.flagged.body));
check('specific guidance is given for each flagged situation',
  FLH.SAFETY.flagged.guidance.length >= 4 &&
  /very lean or underweight/i.test(FLH.SAFETY.flagged.guidance.join(' ')) &&
  /pregnant/i.test(FLH.SAFETY.flagged.guidance.join(' ')) &&
  /disordered eating/i.test(FLH.SAFETY.flagged.guidance.join(' ')));
check('alternative challenges are offered instead of the fat-loss target',
  /Energy Reset/.test(FLH.SAFETY.flagged.alternatives) &&
  /Muscle Building/.test(FLH.SAFETY.flagged.alternatives) &&
  /Forge Daily/.test(FLH.SAFETY.flagged.alternatives));
check('an in-challenge warning covers restriction creeping in',
  /restriction rather than structure/i.test(FLH.SAFETY.running) &&
  /stop the phase, not to push harder/i.test(FLH.SAFETY.running));

// ══ Attempt config ════════════════════════════════════════════════════════
const cfg = FLH.buildConfig({ proteinMode: 'fixed', proteinFixedGrams: 170, safetyFlags: ['none'], acknowledged: true });
check('the attempt stores its own protein resolution', cfg.proteinGrams === 170);
check('it stores the step and whole-food targets', cfg.stepTarget === 10000 && cfg.wholeFoodPct === 90);
check('"none of these" is not stored as a safety flag', cfg.safetyFlags.length === 0);
check('a real flag is stored on the attempt',
  FLH.buildConfig({ safetyFlags: ['lean'] }).safetyFlags.join(',') === 'lean');
check('hardConfig resolves only for a Hard Fat Loss attempt',
  !!FLH.hardConfig({ templateId: 'fat_loss_phase', variant: 'hard', fatLossHard: cfg }) &&
  FLH.hardConfig({ templateId: 'fat_loss_phase', variant: 'standard', fatLossHard: cfg }) === null);
check('every daily task carries a canonical habit key', tasks.every(t => !!habitKeyOf(t)));
check('shared behaviours reuse existing habit keys',
  taskById('fl_protein').habitKey === HABIT_KEYS.PROTEIN_TARGET &&
  taskById('fl_steps').habitKey === HABIT_KEYS.DAILY_STEPS &&
  taskById('fl_sleep').habitKey === HABIT_KEYS.SLEEP_TARGET);
check('genuinely new behaviours get new keys',
  taskById('fl_fullness').habitKey === HABIT_KEYS.FULLNESS_CONTROL &&
  w('intervals').habitKey === HABIT_KEYS.INTERVAL_TRAINING &&
  w('waist').habitKey === HABIT_KEYS.WAIST_MEASUREMENT);
check('a perfect Hard day is worth more than a perfect Standard day',
  tasks.reduce((s, t) => s + t.xp, 0) > std.reduce((s, t) => s + t.xp, 0),
  `${tasks.reduce((s, t) => s + t.xp, 0)} vs ${std.reduce((s, t) => s + t.xp, 0)}`);

const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
