import { CHALLENGE_TEMPLATES } from '../src/data/challengeTemplates.js';
import { HABIT_GUIDES, getGuide, guideForTask, hasGuide, EVIDENCE, EVIDENCE_META, EVIDENCE_LEGEND } from '../src/data/habitGuides.js';
import * as FLH from '../src/data/fatLossHardConfig.js';
import * as MB from '../src/data/muscleBuildingConfig.js';
import * as HH from '../src/data/hormoneHealthConfig.js';
import * as ER from '../src/data/energyResetConfig.js';
import * as LI from '../src/data/lockInConfig.js';
import { HABIT_RULES_VERSION, VERSIONED_HABITS, versionedRule, rulesVersionOf } from '../src/data/habitRules.js';
import { presentTasks, presentationFor, guideIdMap } from '../src/data/habitPresentation.js';
import { NEW_ATTEMPT_DEFAULTS } from '../src/data/challengeAttempt.js';

/**
 * The guide registry, across every challenge that now has one.
 *
 * Guides used to exist only for LOCK IN, which attached them through a
 * `guideRef` helper that returns null for an id it does not have — so a typo
 * produced a habit with no Guide button and nothing else. Two challenges now
 * attach guides by LITERAL id string instead (Fat Loss Hard Mode must, because
 * its fullness copy is what the fullness guide quotes, and importing the helper
 * back would make the two modules circular). A literal cannot be validated by
 * the helper, so it is validated here: every guideId any challenge puts on a
 * task has to resolve to a real, complete guide.
 *
 * The second thing this guards is the rule the guide modules are written under.
 * A guide's "How to complete it" IS the challenge's contract with the person
 * reading it — so a habit whose requirement Forge has never actually defined
 * must NOT have a guide, because writing one would silently settle the rule.
 * Those habits are listed below by name, and the test fails if one of them
 * acquires a guide without the list being changed on purpose.
 */

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

// ── Every task, from every source a challenge can build one ────────────────
function allTasks() {
  const out = [];
  for (const t of CHALLENGE_TEMPLATES) {
    for (const [variant, v] of Object.entries(t.variants || {})) {
      for (const task of v.start_tasks || []) {
        out.push({ where: `${t.id}/${variant}`, task });
      }
    }
  }
  const builders = [
    ['fatLossHard', FLH], ['muscleBuilding', MB],
    ['hormoneHealth', HH], ['energyReset', ER], ['lockIn', LI],
  ];
  for (const [label, mod] of builders) {
    if (typeof mod.buildStartTasks !== 'function') continue;
    for (const task of mod.buildStartTasks(mod.defaultSetup?.())) {
      out.push({ where: label, task });
    }
  }
  return out;
}

const tasks = allTasks();
check('every challenge source yields tasks', tasks.length > 40, `${tasks.length} task instances`);

// ── 1: no dangling guide reference ─────────────────────────────────────────
const referenced = [...new Set(tasks.map(t => t.task.guideId).filter(Boolean))];
const dangling = referenced.filter(id => !getGuide(id));
check('1: every guideId on every task resolves to a real guide',
  dangling.length === 0, dangling.join(', ') || `${referenced.length} distinct ids, all resolve`);

// An explicit `guideId: null` is how a task says "no guide on purpose", and
// the Daily Log is the one habit that says it. Anywhere else it is a guideRef
// that found nothing — a typo that silently removes a Guide button.
const nulls = tasks.filter(t => t.task.guideId === null && t.task.id !== 'daily_log');
check('1: a guideRef that returns null is a typo, not a design',
  nulls.length === 0, nulls.map(t => `${t.where}:${t.task.id}`).join(' ') || 'only the Daily Log, deliberately');

// ── 2: every guide is complete enough to render ────────────────────────────
// HabitGuide dereferences all of these unconditionally. A guide missing one of
// them does not degrade — it throws while someone is reading it.
const REQUIRED = ['id', 'title', 'icon', 'tagline', 'quickStart', 'why', 'how', 'optimize', 'advanced', 'mistakes', 'examples'];
const incomplete = [];
for (const [id, g] of Object.entries(HABIT_GUIDES)) {
  const missing = REQUIRED.filter(k => g[k] == null);
  if (missing.length) incomplete.push(`${id}:${missing.join('/')}`);
  if (!Array.isArray(g.quickStart) || !g.quickStart.length) incomplete.push(`${id}:quickStart empty`);
  if (!g.why?.blurb || !Array.isArray(g.why?.points) || !g.why.points.length) incomplete.push(`${id}:why`);
  if (!g.how?.requirement || !Array.isArray(g.how?.earns) || !g.how.earns.length) incomplete.push(`${id}:how`);
  for (const key of ['optimize', 'advanced']) {
    for (const s of g[key] || []) {
      if (!s.title || !s.body) incomplete.push(`${id}:${key} incomplete strategy`);
      if (!EVIDENCE_META[s.evidence]) incomplete.push(`${id}:${key} "${s.title}" unlabelled`);
    }
  }
  for (const m of g.mistakes || []) if (!m.title || !m.body) incomplete.push(`${id}:mistakes incomplete`);
  for (const e of g.examples || []) {
    if (!e.label || !Array.isArray(e.lines) || !e.lines.length) incomplete.push(`${id}:examples incomplete`);
  }
}
check('2: every registered guide has every field HabitGuide renders',
  incomplete.length === 0, incomplete.slice(0, 4).join(' · ') || `${Object.keys(HABIT_GUIDES).length} guides complete`);

check('2: every strategy carries an evidence label from the shared vocabulary',
  Object.values(EVIDENCE).every(l => !!EVIDENCE_META[l]?.label && !!EVIDENCE_META[l]?.dot) &&
  /optional/i.test(EVIDENCE_LEGEND));

// The vocabulary moved out of lockInConfig into its own module. LOCK IN still
// re-exports it, and the two must be the same objects — a copy would drift.
check('2: LOCK IN re-exports the one shared evidence vocabulary',
  LI.EVIDENCE === EVIDENCE && LI.EVIDENCE_META === EVIDENCE_META && LI.EVIDENCE_LEGEND === EVIDENCE_LEGEND);

// ── 3: guides are namespaced, so two challenges can both have a "sleep" ────
const unnamespaced = Object.keys(HABIT_GUIDES).filter(k => !k.includes(':'));
check('3: every registry key is namespaced by its source module',
  unnamespaced.length === 0, unnamespaced.join(', ') || 'all namespaced');
const sources = new Set(Object.values(HABIT_GUIDES).map(g => g.source));
check('3: guides come from more than one challenge now',
  sources.size >= 3, [...sources].sort().join(', '));

// ── 4: the undefined-rule habits have NO guide ────────────────────────────
// Each of these carries a requirement Forge has never stated anywhere: "80%+"
// of an unnamed quantity, a water goal that does not exist as a field, and a
// sleep figure that never says in bed or asleep. Attaching a guide would make
// its "How to complete it" the rule by default. Removing a name from this list
// is a decision about the challenge, which is why it has to be made here.
const RULE_UNDEFINED = ['fl_whole', 'fl_water', 'fl_sleep', 'mb_sleep', 'mt_mind'];
const guidedAnyway = RULE_UNDEFINED.filter(id => tasks.some(t => t.task.id === id && t.task.guideId));
check('4: no habit with an undefined rule has been given a guide',
  guidedAnyway.length === 0, guidedAnyway.join(', ') || RULE_UNDEFINED.join(', ') + ' all still open');

// ── 5: a guide's stated requirement never invents a figure ────────────────
// Reading is 2/5/10 pages, the focus block is 30/60/90 minutes and steps are
// 6/8/10k, all by mode. A guide that names one of them is wrong for the other
// two thirds of its readers, so these guides point at the habit row instead.
const MODE_DEPENDENT = ['fatloss:steps', 'mental:reading', 'mental:focus', 'mental:physical'];
const hardcoded = MODE_DEPENDENT.filter(id => {
  const req = getGuide(id)?.how?.requirement || '';
  return /\b(6,?000|8,?000|10,?000|30|60|90)\b/.test(req) || !/row/.test(req);
});
check('5: mode-dependent guides point at the habit row, not a fixed number',
  hardcoded.length === 0, hardcoded.join(', ') || MODE_DEPENDENT.join(', '));

// A habit whose figure comes from the SETUP FORM rather than the mode cannot
// have its rule stated here at all — Hard Mode's protein can be a ratio of
// your goal weight or a fixed number of grams, depending on what you chose,
// and Muscle Building's calorie and carb figures are personal. These guides
// have to send you to the row.
const SETUP_DEPENDENT = [
  'fatloss:protein', 'fatloss:whole', 'muscle:protein', 'muscle:nutrition',
  'muscle:carbs', 'muscle:sleep', 'muscle:recovery', 'fatloss:sleep',
  'energy:sleep', 'energy:light', 'energy:caffeine', 'energy:stress',
  'hormone:sleep', 'hormone:stress',
];
const notDeferring = SETUP_DEPENDENT.filter(id => !/\brow\b/i.test(getGuide(id)?.how?.requirement || ''));
check('5: setup-dependent guides send you to the habit row for the figure',
  notDeferring.length === 0, notDeferring.join(', ') || `${SETUP_DEPENDENT.length} checked`);

// ── 6: the helpers behave ──────────────────────────────────────────────────
check('6: guideForTask and hasGuide agree with the registry', (() => {
  const guided = tasks.find(t => t.task.guideId)?.task;
  const bare = tasks.find(t => !t.task.guideId)?.task;
  return !!guided && !!bare &&
    hasGuide(guided) && !!guideForTask(guided) &&
    !hasGuide(bare) && guideForTask(bare) === null &&
    getGuide('nope:nothing') === null && getGuide(null) === null;
})());

// ── 7: the Daily Log has no guide, in any challenge ───────────────────────
// Forge's standing decision: the Daily Log is tracking, not something to
// teach. It is kept out of the Habit Library, its row is not tappable into a
// guide, and the LOCK IN suites assert both. It is the one habit every
// challenge includes, so giving it a guide would have put a Guide button on
// every challenge at once — which is why this is asserted here too.
const logTasks = tasks.filter(t => t.task.id === 'daily_log');
const logGuided = logTasks.filter(t => t.task.guideId);
check('7: no challenge gives the Daily Log a guide',
  logTasks.length > 0 && logGuided.length === 0,
  logGuided.map(t => `${t.where}:${t.task.guideId}`).join(' ') || `${logTasks.length} rows, none guided`);
check('7: and no guide in the registry is about logging',
  !Object.keys(HABIT_GUIDES).some(k => /log$/i.test(k)),
  Object.keys(HABIT_GUIDES).filter(k => /log$/i.test(k)).join(', ') || 'none');

// ── 8: versioned rules, and the attempts each applies to ──────────────────
// A rule that changed is attached to the ATTEMPT, not to the app. These checks
// are the contract: an attempt started before a rule was settled keeps the old
// reading for life, and nothing in this file can reach XP or completion.
check('8: a new attempt is stamped with the current rules version',
  NEW_ATTEMPT_DEFAULTS.habitRulesVersion === HABIT_RULES_VERSION,
  `${NEW_ATTEMPT_DEFAULTS.habitRulesVersion}`);
check('8: an attempt with no stamp is version 1, for life',
  rulesVersionOf({}) === 1 && rulesVersionOf(null) === 1 &&
  rulesVersionOf({ habitRulesVersion: 'nonsense' }) === 1);
check('8: every versioned guide id resolves to a real guide', (() => {
  for (const byVersion of Object.values(VERSIONED_HABITS)) {
    for (const rule of Object.values(byVersion)) {
      if (rule.guideId && !getGuide(rule.guideId)) return false;
    }
  }
  return true;
})(), Object.keys(VERSIONED_HABITS).join(', '));
check('8: version 1 of every versioned habit offers no guide',
  Object.keys(VERSIONED_HABITS).every(id => versionedRule(id, 1)?.guideId == null),
  Object.keys(VERSIONED_HABITS).filter(id => versionedRule(id, 1)?.guideId).join(', ') || 'none');
check('8: the whole-foods wording follows the mode, not a fixed percentage',
  /eight meals/.test(versionedRule('fl_whole', 2, 'beginner').desc) &&
  /nine meals/.test(versionedRule('fl_whole', 2, 'standard').desc));
check('8: an unversioned habit has no versioned rule',
  versionedRule('fl_protein', 2) === null && versionedRule('nope', 2) === null);

// ── 9: presentation refreshes what a row SAYS and nothing else ────────────
// This is what replaced bumping template_version to deliver a better sentence.
// If it ever touched a field that decides completion or XP, an improved
// explanation would silently rewrite a running attempt.
const STORED = [
  { id: 'fl_protein', name: 'Hit protein goal (0.8–1 g/lb goal weight)', xp: 25, keystone: 2,
    keystoneHabit: true, order: 1, source: 'template', desc: 'stale text', guideId: null,
    target: { value: 1, unit: 'g', direction: 'atLeast' } },
  { id: 'fl_sleep', name: 'Sleep 7.5+ hours', xp: 25, keystone: 2, order: 2, source: 'template' },
  { id: 'my_own_thing', name: 'Custom', xp: 10, keystone: 0, order: 3, source: 'custom' },
];
const META_V1 = { templateId: 'fat_loss_phase', variant: 'standard' };
const META_V2 = { ...META_V1, habitRulesVersion: 2 };

const shownV1 = presentTasks(STORED, META_V1);
const shownV2 = presentTasks(STORED, META_V2);
check('9: the stale description is replaced from the live definition',
  shownV1[0].desc !== 'stale text' && /0\.8–1/.test(shownV1[0].desc), shownV1[0].desc);
check('9: and the guide the habit now has is offered',
  shownV1[0].guideId === 'fatloss:protein' && !!getGuide(shownV1[0].guideId));
check('9: nothing but desc and guideId is ever touched', (() => {
  for (const [i, before] of STORED.entries()) {
    for (const shown of [shownV1[i], shownV2[i]]) {
      for (const key of Object.keys({ ...before, ...shown })) {
        if (key === 'desc' || key === 'guideId') continue;
        if (JSON.stringify(shown[key]) !== JSON.stringify(before[key])) return false;
      }
    }
  }
  return true;
})());
check('9: the stored list itself is never mutated',
  STORED[0].desc === 'stale text' && STORED[0].guideId === null && STORED[1].desc === undefined);
check('9: a custom task is left entirely alone',
  shownV1[2] === STORED[2] && shownV2[2] === STORED[2]);
check('9: an attempt on version 1 is NOT given the new sleep rule',
  (shownV1[1].desc ?? null) === null && (shownV1[1].guideId ?? null) === null);
check('9: an attempt on version 2 is',
  /set aside to sleep/.test(shownV2[1].desc) && shownV2[1].guideId === 'fatloss:sleep',
  shownV2[1].desc);
// A version states a DIFFERENCE. Where it changes nothing for a given mode —
// Hard Mode already says "roughly nine meals in ten" — the challenge's own
// sentence has to survive, or settling a rule would blank a better one.
const HARD = { templateId: 'fat_loss_phase', variant: 'hard', habitRulesVersion: 2 };
const hardWhole = presentationFor({ id: 'fl_whole', desc: 'stored' }, HARD);
check('9: a version with nothing to say for a mode leaves its wording alone',
  /nine meals in ten/i.test(hardWhole.desc) && hardWhole.guideId === 'fatloss:whole', hardWhole.desc);
check('9: an unchanged list comes back as the same array, not a copy',
  presentTasks(shownV2, META_V2) === shownV2);
check('9: no meta, or no tasks, changes nothing',
  presentTasks(STORED, null) === STORED && presentTasks([], META_V2).length === 0);
check('9: a habit from a challenge this build does not define is left alone',
  presentationFor({ id: 'whatever' }, { templateId: 'no_such_challenge' }) === null);

// A support-lane habit follows ITS OWN attempt's rules, not the primary's.
const STACKED = [
  { id: 'fl_sleep', name: 'Sleep 7.5+ hours', order: 1, challenges: ['primary'] },
  { id: 'mt_mind', name: 'Mental Training — 5 minutes', order: 2, challenges: ['support'] },
];
const laned = presentTasks(STACKED, META_V1, { templateId: 'mental_training_phase', variant: 'standard', habitRulesVersion: 2 });
check('9: a support habit is resolved against the support attempt',
  /visualization/.test(laned[1].desc) && laned[1].guideId === 'mental:mind', laned[1].desc);
check('9: while the primary lane keeps the primary attempt\'s rules',
  (laned[0].desc ?? null) === null);

// ── 9b: a legacy attempt is never shown a rule it was not started under ──
// Three ways that could happen, each guarded here.
//
// First, a version could inject new text at version 1, which would reach every
// attempt ever started. A version 1 entry must therefore state nothing of its
// own: it exists only to say "this habit is versioned, and version 1 is
// whatever the challenge already said".
//
// One habit is listed as an exception, with its reason, rather than the check
// being softened: mt_mind had NO description at all, and its version 1 text
// restates the rule exactly as the challenge's own rationale copy already
// stated it — breathwork, meditation or prayer. That is informational, and
// adding another name here has to be an argued decision, not an edit nobody
// noticed.
const V1_STATES_AN_EXISTING_RULE = ['mt_mind'];
const v1Injected = Object.keys(VERSIONED_HABITS)
  .filter(id => !V1_STATES_AN_EXISTING_RULE.includes(id))
  .filter(id => versionedRule(id, 1)?.desc != null || versionedRule(id, 1)?.guideId != null);
check('9b: version 1 of a versioned habit adds no wording of its own',
  v1Injected.length === 0, v1Injected.join(', ') || `all but ${V1_STATES_AN_EXISTING_RULE.join(', ')}, deliberately`);
check('9b: and the one exception offers no guide either — only the existing rule, restated',
  V1_STATES_AN_EXISTING_RULE.every(id => versionedRule(id, 1)?.guideId == null));

// Second, a version entry that changes nothing is a version that is not doing
// its job — the new rule would be reaching version 1 attempts by some other
// route, or not reaching anyone.
const inert = Object.keys(VERSIONED_HABITS).filter((id) => {
  const modes = [null, 'beginner', 'standard', 'hard'];
  return !modes.some((m) => {
    const a = versionedRule(id, 1, m), b = versionedRule(id, HABIT_RULES_VERSION, m);
    return (a?.desc ?? null) !== (b?.desc ?? null) || (a?.guideId ?? null) !== (b?.guideId ?? null);
  });
});
check('9b: every versioned habit actually differs between versions',
  inert.length === 0, inert.join(', ') || 'all differ');

// Third, a guide written for a new rule is readable in the Habit Library by
// somebody whose attempt is on the old one — the library is deliberately
// independent of enrolment. So a guide a version introduces has to say, in its
// own completion rules, which attempts it describes.
const unlabelled = [];
for (const [habit, byVersion] of Object.entries(VERSIONED_HABITS)) {
  for (const [version, rule] of Object.entries(byVersion)) {
    if (!rule.guideId || Number(version) <= 1) continue;
    const notes = getGuide(rule.guideId)?.how?.notes || '';
    if (!/attempt/i.test(notes) || !/(started after|already running|earlier|before)/i.test(notes)) {
      unlabelled.push(`${habit}→${rule.guideId}`);
    }
  }
}
check('9b: a guide a new rule introduces says which attempts it applies to',
  unlabelled.length === 0, unlabelled.join(', ') || 'all labelled');

// Fourth, a guide must not state a figure that contradicts the row it is
// attached to. Where the habits pointing at one guide disagree about the
// number — 2/5/10 pages, 6/8/10k steps, every per-setup target in Muscle
// Building — the guide has to defer to the row rather than pick one.
const byGuide = new Map();
for (const { task } of tasks) {
  if (!task.guideId) continue;
  if (!byGuide.has(task.guideId)) byGuide.set(task.guideId, new Set());
  if (task.target?.value != null) byGuide.get(task.guideId).add(String(task.target.value));
}
// Only the genuinely dangerous case is checked: a guide shared by rows that
// disagree about the number. A single-target guide is left alone, because a
// figure in its requirement is usually a different quantity entirely — the
// protein guide's "0.8–1 g per pound" is a ratio, not the gram target beside
// it, and the morning-light guide's "within 60 minutes of waking" is not the
// ten minutes outdoors. A textual check cannot tell those apart, and one that
// cried wolf would be deleted by the third person who tripped it.
const contradicting = [];
for (const [id, values] of byGuide) {
  if (values.size <= 1) continue;
  const req = getGuide(id)?.how?.requirement || '';
  const named = (req.match(/\b\d[\d,.]*\b/g) || [])
    .map(x => x.replace(/,/g, ''))
    .filter(x => values.has(x) || values.has(Number(x).toLocaleString()));
  if (named.length) contradicting.push(`${id} names ${named.join('/')} though its rows differ: ${[...values].join('/')}`);
}
check('9b: no guide states a figure that contradicts the habit row it is on',
  contradicting.length === 0, contradicting.join(' · ') || `${byGuide.size} guides checked against their rows`);

// ── 10: every challenge that can be started has guidance ──────────────────
const byChallenge = new Map();
for (const { where, task } of tasks) {
  const key = where.split('/')[0];
  if (!byChallenge.has(key)) byChallenge.set(key, []);
  byChallenge.get(key).push(task);
}
const bare = [...byChallenge.entries()].filter(([, list]) => !list.some(t => t.guideId));
check('10: every startable challenge offers at least one guide',
  bare.length === 0, bare.map(([k]) => k).join(', ') || [...byChallenge.keys()].join(', '));
const guidedCount = guideIdMap().size;
check('10: the guide map covers every habit that has one',
  guidedCount >= 20, `${guidedCount} habits map to a guide`);

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
