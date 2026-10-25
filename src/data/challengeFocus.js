import { CHALLENGE_TEMPLATES } from './challengeTemplates';

/**
 * What each challenge is FOR, as a short filter.
 *
 * The library needed a way to narrow eleven challenges down to the two or three
 * worth reading, and the registry had no field for it: exactly one template
 * carried a `category`, and `metrics_targeted` describes what a challenge
 * MEASURES rather than what it is for — Fat Loss and Mental Training share four
 * of their five metrics.
 *
 * So the tags are stated explicitly, here, next to a list of every template
 * they apply to. They classify challenges that already exist; they do not
 * create, rename or hide any. A challenge may carry more than one, because
 * several genuinely do two things: LOCK IN is a focus challenge and a
 * productivity one, and 75-Day Discipline is physical and a test of follow-
 * through.
 *
 * `challengeFocusCoverage()` exists so a test can assert that every template in
 * the registry is tagged — the one way this file can rot is by a new challenge
 * being added and silently falling out of every filter.
 */

export const FOCUS = {
  MENTAL: 'mental',
  FITNESS: 'fitness',
  PRODUCTIVITY: 'productivity',
  RECOVERY: 'recovery',
  DISCIPLINE: 'discipline',
};

/** The filter chips, in the order they are shown. `all` is not a tag. */
export const FOCUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: FOCUS.MENTAL, label: 'Mental' },
  { key: FOCUS.FITNESS, label: 'Fitness' },
  { key: FOCUS.PRODUCTIVITY, label: 'Productivity' },
  { key: FOCUS.RECOVERY, label: 'Recovery' },
  { key: FOCUS.DISCIPLINE, label: 'Discipline' },
];

const FOCUS_LABEL = Object.fromEntries(FOCUS_FILTERS.map(f => [f.key, f.label]));

/** Template id → the tags that honestly describe it. */
const FOCUS_BY_TEMPLATE = {
  // Trains attention, stress tolerance and self-control through daily practice.
  mental_training_phase: [FOCUS.MENTAL, FOCUS.DISCIPLINE],
  // Protected attention and real output, with recovery built in so it lasts.
  lock_in_14_day: [FOCUS.PRODUCTIVITY, FOCUS.MENTAL],
  // Training, nutrition and recovery aimed at body composition.
  fat_loss_phase: [FOCUS.FITNESS],
  muscle_building_phase: [FOCUS.FITNESS],
  strength_phase: [FOCUS.FITNESS],
  // Rebuilding energy, sleep and recovery capacity.
  sleep_reset_challenge: [FOCUS.RECOVERY],
  recovery_phase: [FOCUS.RECOVERY],
  energy_reset_10_day: [FOCUS.RECOVERY],
  womens_hormone_health: [FOCUS.RECOVERY, FOCUS.FITNESS],
  // Physical work plus reading and diet, over a length that tests follow-through.
  '75_day_discipline_challenge': [FOCUS.FITNESS, FOCUS.DISCIPLINE],
  // Whatever the user builds, so it claims nothing in particular.
  custom_challenge_framework: [FOCUS.DISCIPLINE],
};

/** The focus tags for one template. Empty when untagged. */
export function focusTagsOf(template) {
  const id = typeof template === 'string' ? template : template?.id;
  return FOCUS_BY_TEMPLATE[id] || [];
}

/** A tag's display label. */
export function focusLabel(tag) {
  return FOCUS_LABEL[tag] || tag;
}

/** Does this template belong under this filter key? `all` always matches. */
export function matchesFocus(template, filterKey) {
  if (!filterKey || filterKey === 'all') return true;
  return focusTagsOf(template).includes(filterKey);
}

/**
 * Only the filters that would actually show something for this set of
 * templates, so the library never offers a chip that leads to an empty list.
 */
export function availableFilters(templates) {
  const present = new Set((templates || []).flatMap(t => focusTagsOf(t)));
  return FOCUS_FILTERS.filter(f => f.key === 'all' || present.has(f.key));
}

/**
 * Which registry templates carry no tag. Used by the test suite — a new
 * challenge that nobody tagged would otherwise vanish from every filter except
 * "All" without anything failing.
 */
export function challengeFocusCoverage() {
  const untagged = CHALLENGE_TEMPLATES.filter(t => focusTagsOf(t).length === 0).map(t => t.id);
  const unknown = Object.keys(FOCUS_BY_TEMPLATE)
    .filter(id => !CHALLENGE_TEMPLATES.some(t => t.id === id));
  return { untagged, unknown, total: CHALLENGE_TEMPLATES.length };
}
