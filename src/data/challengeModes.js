import { previewAttempt } from './challengeAttempt';
import { getDefaultDuration } from './challengeTemplates';

/**
 * What actually changes between Beginner, Standard and Hard.
 *
 * The difficulty chooser used to describe the modes in the abstract — "Build
 * the habit", "Strengthen the habit", "Optimize the habit" — which is three
 * ways of saying "harder" and tells nobody what they are agreeing to. The real
 * differences are already in the templates and are specific: Mental Training
 * asks for 2, 5 or 10 minutes of practice and a 30, 60 or 90 minute focus
 * block; Fat Loss asks for 6,000, 8,000 or 10,000 steps and adds a fullness
 * habit and three more weekly sessions on Hard.
 *
 * So nothing is written here. Each mode is PREVIEWED through the same
 * `previewAttempt` the setup flow starts from, and the summary is a diff of
 * those previews: how many habits, what a day is worth, which requirements
 * differ and how. A template that changes its wording changes this with it,
 * and a mode that is not really different will honestly say so.
 */

/**
 * A requirement's name, trimmed for a compact line.
 *
 * A trailing qualifier in brackets is KEPT: "(80%+)" versus "(90%)" is often
 * the whole difference between two modes, and stripping it would turn two
 * different commitments into the same sentence.
 */
function shorten(name) {
  return String(name || '').replace(/\s*[.—-]\s*$/, '').trim();
}

/**
 * The requirement that best tells the modes apart in one short line.
 *
 * A chooser only explains the difficulties if the differences are visible
 * WITHOUT selecting each one in turn, and every requirement of every mode does
 * not fit on a button. So one is promoted, by what makes a comparison useful:
 *
 *   1. it exists in every mode (a requirement only Hard has compares to nothing)
 *   2. its wording is different in every mode (Standard and Hard reading alike
 *      makes the step-up invisible, however short the line)
 *   3. it carries a number — "Walk 6,000+ / 8,000+ / 10,000+ steps" is the
 *      step-up made concrete, where "Take progress photo" is not
 *   4. it is short, so three of them can be read side by side
 *
 * Returns null when nothing qualifies, and the callers then fall back to the
 * figures alone rather than promoting something misleading.
 */
function pickHeadline(allIds, present, byMode) {
  const scored = [];
  for (const id of allIds) {
    const names = present.map(k => byMode[k][id]);
    if (names.some(n => n === undefined)) continue;        // 1
    if (new Set(names).size !== names.length) continue;    // 2
    const digits = names.every(n => /\d/.test(n));         // 3
    const len = names.reduce((s, n) => s + n.length, 0);   // 4
    scored.push({ id, digits, len });
  }
  if (!scored.length) return null;
  scored.sort((a, b) => (b.digits - a.digits) || (a.len - b.len));
  return scored[0].id;
}

/**
 * Per-mode figures and differences for one template at one length.
 *
 * Returns `[]` for a challenge without real modes (a configured one builds its
 * whole attempt from its own setup screen, so there is nothing to compare).
 *
 * Each entry: { key, label, habits, dailyXP, weekly, completionBonus,
 * missPenalty, changes: [{ label, from, to }], sameAsOthers }
 */
export function modeComparison(template, durationDays = null) {
  if (!template?.variants || template.start_flow !== 'variant') return [];
  const days = durationDays ?? getDefaultDuration(template);
  const keys = ['beginner', 'standard', 'hard'].filter(k => template.variants[k]);
  if (keys.length < 2) return [];

  const previews = {};
  for (const k of keys) {
    const p = previewAttempt({ template, variant: k, durationDays: days });
    if (p) previews[k] = p;
  }
  const present = keys.filter(k => previews[k]);
  if (present.length < 2) return [];

  // Requirements are matched across modes by id, so a habit whose WORDING
  // changes with the mode ("Walk 6,000+ steps" → "Walk 10,000+ steps") is one
  // requirement that differs rather than two unrelated ones.
  const allIds = [...new Set(present.flatMap(k => previews[k].tasks.map(t => t.id)))];
  const byMode = Object.fromEntries(present.map(k => [
    k, Object.fromEntries(previews[k].tasks.map(t => [t.id, t.name])),
  ]));

  const headlineId = pickHeadline(allIds, present, byMode);
  const habitsDiffer = new Set(present.map(k => previews[k].tasks.length)).size > 1;

  return present.map(key => {
    const p = previews[key];
    const changes = [];
    for (const id of allIds) {
      const mine = byMode[key][id];
      const others = present.filter(k => k !== key).map(k => byMode[k][id]);
      if (!mine) continue;                               // not in this mode at all
      if (others.every(o => o === mine)) continue;       // identical everywhere
      // A requirement this mode ALONE has is worth saying so explicitly.
      const onlyHere = others.every(o => o === undefined);
      changes.push({ label: shorten(mine), onlyHere });
    }
    // A requirement another mode has and this one does not.
    const missing = allIds.filter(id => !byMode[key][id]
      && present.some(k => k !== key && byMode[k][id])).length;

    return {
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1),
      // The one requirement that tells the three modes apart in a few words,
      // so a chooser can be compared without tapping each option in turn.
      headline: headlineId ? shorten(byMode[key][headlineId]) : null,
      habitsDiffer,
      habits: p.tasks.length,
      dailyXP: p.dailyBudget,
      weekly: p.weekly.length,
      weeklyPerWeek: p.weekly.reduce((s, w) => s + (Number(w.perWeek) || 0), 0),
      completionBonus: p.completionBonus,
      missPenalty: p.missedDayPenalty,
      durationDays: p.durationDays,
      displayScale: p.displayScale,
      changes,
      fewerHabits: missing,
      // True when this mode's requirements read identically to every other —
      // then the only honest thing to say is that the pace is the difference.
      sameAsOthers: changes.length === 0 && missing === 0,
    };
  });
}

/**
 * One line summarising a mode, for the chooser.
 *
 * Counts first, because they are the part that is true for every challenge.
 */
export function modeSummary(m) {
  if (!m) return '';
  const bits = [`${m.habits} daily habits`];
  if (m.weeklyPerWeek > 0) bits.push(`${m.weeklyPerWeek} sessions a week`);
  return bits.join(' · ');
}

/**
 * The line under a mode's name in the chooser.
 *
 * The headline difference leads, because it is the part that differs; the
 * habit count appears only when it is itself a difference, and the day's
 * worth closes. `xp` is the caller's display-scale function — this module
 * never converts anything itself.
 */
export function modeChoiceLine(m, xp = (v) => v) {
  if (!m) return '';
  const bits = [];
  if (m.headline) bits.push(m.headline);
  if (m.habitsDiffer) bits.push(`${m.habits} habits`);
  bits.push(`${xp(m.dailyXP)} XP a day`);
  return bits.join(' · ');
}
