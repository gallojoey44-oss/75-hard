import { CHALLENGE_TEMPLATES } from '../src/data/challengeTemplates.js';
import { HABIT_GUIDES, getGuide, guideForTask, hasGuide, EVIDENCE, EVIDENCE_META, EVIDENCE_LEGEND } from '../src/data/habitGuides.js';
import * as FLH from '../src/data/fatLossHardConfig.js';
import * as MB from '../src/data/muscleBuildingConfig.js';
import * as HH from '../src/data/hormoneHealthConfig.js';
import * as ER from '../src/data/energyResetConfig.js';
import * as LI from '../src/data/lockInConfig.js';

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

const nulls = tasks.filter(t => t.task.guideId === null);
check('1: a guideRef that returns null is a typo, not a design',
  nulls.length === 0, nulls.map(t => `${t.where}:${t.task.id}`).join(' ') || 'none');

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
  sources.size >= 4, [...sources].sort().join(', '));

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

// ── 6: the helpers behave ──────────────────────────────────────────────────
check('6: guideForTask and hasGuide agree with the registry', (() => {
  const guided = tasks.find(t => t.task.guideId)?.task;
  const bare = tasks.find(t => !t.task.guideId)?.task;
  return !!guided && !!bare &&
    hasGuide(guided) && !!guideForTask(guided) &&
    !hasGuide(bare) && guideForTask(bare) === null &&
    getGuide('nope:nothing') === null && getGuide(null) === null;
})());

// ── 7: the Daily Log guide reaches every challenge that has the habit ─────
// It is the one habit every challenge includes, and the habit people most often
// take for the bookkeeping it is not.
const logTasks = tasks.filter(t => t.task.id === 'daily_log');
const logWithout = logTasks.filter(t => t.task.guideId !== 'forge:dailyLog');
check('7: every Daily Log row points at the shared Daily Log guide',
  logTasks.length > 0 && logWithout.length === 0,
  logWithout.map(t => `${t.where}:${t.task.guideId}`).join(' ') || `${logTasks.length} rows`);

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
