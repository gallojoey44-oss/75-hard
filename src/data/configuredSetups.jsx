import { CONFIGURED_BUILDERS } from './configuredChallenges';
import * as MB from './muscleBuildingConfig';
import * as HH from './hormoneHealthConfig';
import * as ER from './energyResetConfig';
import * as LI from './lockInConfig';
import MuscleBuildingSetup from '../components/MuscleBuildingSetup';
import HormoneHealthSetup from '../components/HormoneHealthSetup';
import EnergyResetSetup from '../components/EnergyResetSetup';
import LockInSetup from '../components/LockInSetup';

/**
 * The setup SCREEN for each configured challenge.
 *
 * A configured challenge builds its own meta and task list from its config
 * module, so it needs a screen of its own to collect the choices that go into
 * them. The builders live in `configuredChallenges.js`, which is imported by
 * non-React code; the components can only be registered somewhere that may
 * import React, which is why this is a separate file rather than part of it.
 *
 * Adding a configured challenge is an entry here and an entry there. Nothing in
 * the start flow branches on a template id.
 */
const SETUP_COMPONENTS = {
  [MB.MUSCLE_BUILDING_TEMPLATE_ID]: MuscleBuildingSetup,
  [HH.HORMONE_HEALTH_TEMPLATE_ID]: HormoneHealthSetup,
  [ER.ENERGY_RESET_TEMPLATE_ID]: EnergyResetSetup,
  [LI.LOCK_IN_TEMPLATE_ID]: LockInSetup,
};

export const CONFIGURED_SETUPS = Object.fromEntries(
  Object.entries(CONFIGURED_BUILDERS).map(([id, b]) => [id, { ...b, Setup: SETUP_COMPONENTS[id] }]),
);

/** The setup screen for a template, or null when it is not a configured one. */
export function setupComponentFor(template) {
  const id = typeof template === 'string' ? template : template?.id;
  return SETUP_COMPONENTS[id] || null;
}
