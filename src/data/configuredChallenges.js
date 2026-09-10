import * as MB from './muscleBuildingConfig';
import * as HH from './hormoneHealthConfig';
import * as ER from './energyResetConfig';

/**
 * Challenges whose whole attempt — descriptor, task list and weekly
 * requirements — is built by their own config module rather than assembled from
 * a template's `variants` block (`start_flow: 'configured'`).
 *
 * This registry is the pure-data half: the two builders every caller needs. The
 * setup COMPONENT for each challenge is registered separately in ChallengesView,
 * because a data module has no business importing React.
 *
 * Both the primary start flow and the support-challenge picker resolve a
 * configured challenge through here, so a challenge added to this map works in
 * both lanes without either component learning anything about it.
 */
export const CONFIGURED_BUILDERS = {
  [MB.MUSCLE_BUILDING_TEMPLATE_ID]: { buildMeta: MB.buildChallengeMeta, buildTasks: MB.buildStartTasks },
  [HH.HORMONE_HEALTH_TEMPLATE_ID]: { buildMeta: HH.buildChallengeMeta, buildTasks: HH.buildStartTasks },
  [ER.ENERGY_RESET_TEMPLATE_ID]: { buildMeta: ER.buildChallengeMeta, buildTasks: ER.buildStartTasks },
};

/** True when a template builds its own attempt rather than using variants. */
export function isConfigured(template) {
  return !!template && (template.start_flow === 'configured' || !!CONFIGURED_BUILDERS[template.id]);
}

/** The builders for a template, or null. */
export function buildersFor(template) {
  return CONFIGURED_BUILDERS[template?.id] || null;
}

/**
 * True when a template can be STARTED at all — either it defines difficulty
 * variants with their own task lists, or it is a configured challenge that
 * builds its own. Used to decide what may appear in the challenge library and
 * in the support-challenge picker.
 */
export function isStartableTemplate(template) {
  if (!template?.startable) return false;
  return !!template.variants || isConfigured(template);
}
