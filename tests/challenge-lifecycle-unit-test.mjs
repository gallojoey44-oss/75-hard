/**
 * Challenge lifecycle — no auto-started challenge, no hybrid states.
 *
 * The bug: startChallenge() treated a missing descriptor as "the default
 * challenge" (75-Day Discipline) and a missing task list as "keep whatever is
 * already there", so archiving one challenge and starting a new one produced a
 * 75-Day attempt sitting on the previous challenge's tasks.
 *
 * These checks cover the pure half of the fix: that 75-Day is an ordinary
 * library challenge with no privileged status, that "no active challenge" is a
 * first-class state, that each challenge owns a distinct task set, and that the
 * repair migration only ever touches attempts the data proves were auto-created.
 */
import {
  DISCIPLINE_75_ID, DISCIPLINE_75_META, discipline75Tasks, migrateProfiles,
} from '../src/context/AppContext.jsx';
import {
  FORGE_DAILY_META, FORGE_DAILY_TASKS, CHALLENGE_TEMPLATES, getTemplateById,
} from '../src/data/challengeTemplates.js';
import { getChallengeState, CHALLENGE_STATE } from '../src/utils/challengeSchedule.js';

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

const MT_TASKS = [
  { id: 'mt_meditate', name: 'Meditate 10 minutes', icon: '🧘', xp: 25, source: 'template', order: 0 },
  { id: 'mt_read',     name: 'Read 5 pages',        icon: '📚', xp: 15, source: 'template', order: 1 },
  { id: 'daily_log',   name: 'Complete Daily Log',  icon: '📊', xp: 10, source: 'template', order: 2 },
];

// ══ 4/5/24: 75-Day Discipline is one library option, never a default ════════
check('4: 75-Day Discipline exists in the challenge library',
  !!getTemplateById(DISCIPLINE_75_ID));
check('24: its descriptor carries a real identity (not a stand-in for "none")',
  DISCIPLINE_75_META.templateId === DISCIPLINE_75_ID && DISCIPLINE_75_META.durationDays === 75);
check('5: the library has many startable challenges — no single privileged one',
  CHALLENGE_TEMPLATES.filter(t => t.startable !== false).length > 3);
check('24: the no-challenge baseline is NOT 75-Day',
  FORGE_DAILY_META.templateId !== DISCIPLINE_75_ID);

// ══ 6: Forge Daily is the between-challenges state ══════════════════════════
check('6: Forge Daily is open-ended — it can never read "Day 1 of N"',
  FORGE_DAILY_META.durationDays === null);
check('6: Forge Daily has its own loggable task set',
  FORGE_DAILY_TASKS.length > 0 && FORGE_DAILY_TASKS.every(t => t.id && t.id !== undefined));
check('6: Forge Daily is flagged as the baseline, not a challenge',
  FORGE_DAILY_META.isBaseline === true);
check('2: a profile with no start date derives as NONE',
  getChallengeState({ activeChallenge: null, challengeStart: null }) === CHALLENGE_STATE.NONE);

// ══ 10/11: challenges own distinct task sets, so a leak is detectable ═══════
const d75 = discipline75Tasks('me');
const d75gf = discipline75Tasks('girlfriend');
check('9: 75-Day has its own task set for the Male profile', d75.length > 0);
check('9: and a separate one for the Female profile', d75gf.length > 0 && d75gf[0].id !== d75[0].id);
check('discipline75Tasks returns copies (callers cannot mutate the source)',
  discipline75Tasks('me')[0] !== discipline75Tasks('me')[0]);
const d75ids = new Set(d75.map(t => t.id));
check('10: Mental Training task ids are foreign to the 75-Day set',
  MT_TASKS.filter(t => t.id !== 'daily_log').every(t => !d75ids.has(t.id)));
check('11: Forge Daily task ids are foreign to the 75-Day set',
  FORGE_DAILY_TASKS.filter(t => t.id !== 'daily_log').every(t => !d75ids.has(t.id)));

// ══ Repair migration: the accidental auto-created 75-Day attempt ════════════
// The corrupted state from the report: 75-Day metadata, Mental Training tasks,
// nothing ever logged, and no Future Self Letter (nobody chose it).
function corruptProfile(extra = {}) {
  return {
    id: 'me', name: 'Male', emoji: '💪',
    challengeStart: '2026-09-09',
    activeChallenge: { ...DISCIPLINE_75_META },
    tasks: MT_TASKS.map(t => ({ ...t, challenges: ['primary'] })),
    rankHistory: [], bonusMissions: [],
    ...extra,
  };
}
const base = () => ({
  me: corruptProfile(),
  girlfriend: { id: 'girlfriend', name: 'Female', emoji: '🌸', challengeStart: null, activeChallenge: null, tasks: [], rankHistory: [], bonusMissions: [] },
});

const repaired = migrateProfiles(base(), { me: {}, girlfriend: {} });
check('1/2: the auto-created 75-Day attempt is cleared', repaired.me.activeChallenge === null);
check('2: its start date is cleared too — no "Day 1 of 75"', repaired.me.challengeStart === null);
check('4: 75-Day is NOT left active after the repair',
  repaired.me.activeChallenge?.templateId !== DISCIPLINE_75_ID);
check('5: nothing else is activated in its place',
  !repaired.me.activeChallenge);
check('6: the profile is left with Forge Daily tasks it can log',
  repaired.me.tasks.length === FORGE_DAILY_TASKS.length &&
  repaired.me.tasks.every(t => FORGE_DAILY_TASKS.some(f => f.id === t.id)));
check('10: the leaked Mental Training tasks are gone',
  !repaired.me.tasks.some(t => t.id === 'mt_meditate'));
check('23: the other profile is untouched by the repair',
  repaired.girlfriend.activeChallenge === null && repaired.girlfriend.challengeStart === null);

// ── The repair is conservative: each signal alone protects a real attempt ───
const withLetter = migrateProfiles(
  { ...base(), me: corruptProfile({ activeChallenge: { ...DISCIPLINE_75_META, futureSelfLetter: { why: 'I chose this', writtenAt: '2026-09-09' } } }) },
  { me: {}, girlfriend: {} },
);
check('a 75-Day attempt WITH a Future Self Letter is intentional and is kept',
  withLetter.me.activeChallenge?.templateId === DISCIPLINE_75_ID && withLetter.me.challengeStart === '2026-09-09');

const withHistory = migrateProfiles(base(), { me: { 1: { date: '2026-09-09', dayNumber: 1, tasks: { mt_meditate: true } } }, girlfriend: {} });
check('a 75-Day attempt with logged days is real history and is kept',
  withHistory.me.activeChallenge?.templateId === DISCIPLINE_75_ID);
check('16/25: an attempt with history keeps its task list untouched',
  withHistory.me.tasks.some(t => t.id === 'mt_meditate'));

const consistent = migrateProfiles(
  { ...base(), me: corruptProfile({ tasks: d75.map(t => ({ ...t, source: 'template' })) }) },
  { me: {}, girlfriend: {} },
);
check('a consistent 75-Day attempt (its own tasks) is kept',
  consistent.me.activeChallenge?.templateId === DISCIPLINE_75_ID);

const customised = migrateProfiles(
  { ...base(), me: corruptProfile({ tasks: [...d75.map(t => ({ ...t, source: 'template' })), { id: 'my_own', name: 'My own habit', source: 'custom', order: 9 }] }) },
  { me: {}, girlfriend: {} },
);
check('a user-customised 75-Day list is never mistaken for a leak',
  customised.me.activeChallenge?.templateId === DISCIPLINE_75_ID &&
  customised.me.tasks.some(t => t.id === 'my_own'));

const otherChallenge = migrateProfiles(
  { ...base(), me: corruptProfile({ activeChallenge: { templateId: 'mental_training_phase', name: 'Mental Training Phase', durationDays: 14 } }) },
  { me: {}, girlfriend: {} },
);
check('a non-75-Day attempt is outside the repair entirely',
  otherChallenge.me.activeChallenge?.templateId === 'mental_training_phase');

// ── Idempotence: re-running the migration changes nothing further ───────────
const once = migrateProfiles(base(), { me: {}, girlfriend: {} });
const twice = migrateProfiles(JSON.parse(JSON.stringify(once)), { me: {}, girlfriend: {} });
check('the repair is idempotent — a second load changes nothing',
  JSON.stringify(once.me.activeChallenge) === JSON.stringify(twice.me.activeChallenge) &&
  once.me.tasks.length === twice.me.tasks.length);

// ── 25: archives are never read or written by the repair ───────────────────
const profWithArchiveField = base();
profWithArchiveField.me.xpOffset = 1234;
const afterRepair = migrateProfiles(profWithArchiveField, { me: {}, girlfriend: {} });
check('25: the repair resets only the dead attempt slate, leaving the profile object intact',
  afterRepair.me.name === 'Male' && afterRepair.me.emoji === '💪');
check('19: challenge XP offset resets with the cleared attempt (existing behaviour)',
  afterRepair.me.xpOffset === 0);

// ── A legacy profile (start date, no descriptor) is still 75-Day ───────────
const legacy = migrateProfiles(
  { ...base(), me: { ...corruptProfile(), activeChallenge: undefined, tasks: d75 } },
  { me: {}, girlfriend: {} },
);
check('a legacy pre-descriptor profile is left alone (no descriptor invented)',
  legacy.me.activeChallenge === undefined && legacy.me.challengeStart === '2026-09-09');

const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
