/**
 * Challenge Combination — compatibility metadata.
 *
 * Forge allows at most TWO simultaneous challenges: one PRIMARY (the main goal)
 * and one SUPPORT (a complementary goal). Whether a given pairing is a good idea
 * is DATA, not logic: everything below is a lookup table, so adding a challenge
 * later means adding rows here — no component ever branches on template ids.
 *
 * Pairings are unordered: Fat Loss + Sleep Reset is the same row as Sleep Reset
 * + Fat Loss. `getCompatibility` normalises the order before looking up.
 */

export const COMPATIBILITY = {
  HIGHLY_COMPATIBLE: 'HIGHLY_COMPATIBLE',
  CONDITIONAL: 'CONDITIONAL',
  CONFLICTING: 'CONFLICTING',
};

/** Display metadata per rating — the single place the dot/label/colour lives. */
export const COMPATIBILITY_META = {
  [COMPATIBILITY.HIGHLY_COMPATIBLE]: {
    key: COMPATIBILITY.HIGHLY_COMPATIBLE,
    label: 'Highly Compatible',
    dot: '🟢',
    color: '#10B981',
    rank: 0,
    selectable: true,
    warn: false,
    blurb: 'These goals reinforce each other. Safe to run together.',
  },
  [COMPATIBILITY.CONDITIONAL]: {
    key: COMPATIBILITY.CONDITIONAL,
    label: 'Conditional',
    dot: '🟡',
    color: '#F59E0B',
    rank: 1,
    selectable: true,
    warn: true,
    blurb: 'Workable, but there is a real trade-off to accept before you start.',
  },
  [COMPATIBILITY.CONFLICTING]: {
    key: COMPATIBILITY.CONFLICTING,
    label: 'Conflicting',
    dot: '🔴',
    color: '#EF4444',
    rank: 2,
    selectable: false,
    warn: true,
    blurb: 'These goals pull against each other. Run one at a time.',
  },
};

/**
 * Stable challenge ids used by the table. Several of these are Forge templates
 * today; the rest are reserved ids for challenges that are planned but not yet
 * built. Rows for a challenge that does not exist yet are simply never reached —
 * they cost nothing and make the pairing correct the day the template lands.
 */
export const CHALLENGE_IDS = {
  FAT_LOSS: 'fat_loss_phase',
  MENTAL_TRAINING: 'mental_training_phase',
  SLEEP_RESET: 'sleep_reset_challenge',
  STRENGTH: 'strength_phase',
  RECOVERY: 'recovery_phase',
  DISCIPLINE_75: '75_day_discipline_challenge',
  // Reserved — no template exists yet.
  MUSCLE_BUILDING: 'muscle_building_phase',
  HORMONE_HEALTH: 'womens_hormone_health',
};

const C = CHALLENGE_IDS;

/**
 * The pairing table. Each row: two challenge ids, a rating, and a short
 * human-readable reason shown directly in the picker.
 */
export const COMPATIBILITY_PAIRS = [
  // ── Highly compatible ────────────────────────────────────────────────────
  {
    a: C.FAT_LOSS, b: C.MENTAL_TRAINING, rating: COMPATIBILITY.HIGHLY_COMPATIBLE,
    reason: 'Mental training adds no physical load, and better focus and stress control directly protect eating consistency.',
  },
  {
    a: C.FAT_LOSS, b: C.SLEEP_RESET, rating: COMPATIBILITY.HIGHLY_COMPATIBLE,
    reason: 'Sleep drives appetite and recovery. Fixing sleep makes a fat loss phase easier, not harder.',
  },
  {
    a: C.MUSCLE_BUILDING, b: C.MENTAL_TRAINING, rating: COMPATIBILITY.HIGHLY_COMPATIBLE,
    reason: 'Mental training costs no recovery capacity and supports the consistency muscle gain depends on.',
  },
  {
    a: C.MUSCLE_BUILDING, b: C.SLEEP_RESET, rating: COMPATIBILITY.HIGHLY_COMPATIBLE,
    reason: 'Sleep is where training adaptation happens. These two goals point the same direction.',
  },
  {
    a: C.MUSCLE_BUILDING, b: C.HORMONE_HEALTH, rating: COMPATIBILITY.HIGHLY_COMPATIBLE,
    reason: 'Resistance training and adequate fuelling support hormone health rather than competing with it.',
  },

  {
    a: C.MUSCLE_BUILDING, b: C.RECOVERY, rating: COMPATIBILITY.HIGHLY_COMPATIBLE,
    reason: 'Recovery work is exactly what a hypertrophy block needs alongside it — it protects the training quality that drives growth.',
  },

  // ── Conditional ──────────────────────────────────────────────────────────
  {
    a: C.FAT_LOSS, b: C.HORMONE_HEALTH, rating: COMPATIBILITY.CONDITIONAL,
    reason: 'An aggressive energy deficit can work against hormone health. Workable with a modest deficit and enough food, but not alongside a hard cut.',
  },
  {
    a: C.STRENGTH, b: C.MUSCLE_BUILDING, rating: COMPATIBILITY.CONDITIONAL,
    reason: 'Both compete for the same recovery budget. Doable if total weekly training volume stays realistic.',
  },
  {
    a: C.STRENGTH, b: C.FAT_LOSS, rating: COMPATIBILITY.CONDITIONAL,
    reason: 'Strength gains are slower in a deficit. Expect maintenance rather than progress on the bar.',
  },

  // ── Conflicting ──────────────────────────────────────────────────────────
  {
    a: C.FAT_LOSS, b: C.MUSCLE_BUILDING, rating: COMPATIBILITY.CONFLICTING,
    reason: 'These require opposite energy balances — a deficit and a surplus. Running both at once means doing neither properly.',
  },
  // The 75-Day Discipline Challenge is already an all-day, all-domain programme:
  // training, nutrition, reading, hydration and daily photos. Anything stacked on
  // top competes with it for the same hours rather than complementing it, so it
  // is deliberately a solo challenge.
  ...[C.FAT_LOSS, C.MENTAL_TRAINING, C.SLEEP_RESET, C.STRENGTH, C.RECOVERY, C.MUSCLE_BUILDING, C.HORMONE_HEALTH]
    .map(other => ({
      a: C.DISCIPLINE_75, b: other, rating: COMPATIBILITY.CONFLICTING,
      reason: 'The 75-Day Discipline Challenge already covers training, nutrition, reading and hydration every single day. Stacking a second challenge on top competes for the same hours instead of supporting it — run it on its own.',
    })),
];

/** Same challenge on both sides — never a valid stack. */
const SAME_CHALLENGE = {
  rating: COMPATIBILITY.CONFLICTING,
  reason: 'This challenge is already running. Pick a different one to stack alongside it.',
};

/**
 * Pairings with no row yet. Deliberately CONDITIONAL rather than compatible:
 * an unrated combination is unknown, not endorsed, so the user gets the warning
 * step instead of a silent green light.
 */
const UNRATED = {
  rating: COMPATIBILITY.CONDITIONAL,
  reason: 'This combination has not been rated yet. It is allowed, but watch that the second challenge does not crowd out your main goal.',
};

const index = new Map();
for (const p of COMPATIBILITY_PAIRS) {
  index.set(pairKey(p.a, p.b), p);
}

function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Compatibility for a pairing. Returns { rating, reason, meta } — never null, so
 * callers never need a fallback branch.
 */
export function getCompatibility(idA, idB) {
  if (!idA || !idB) return { ...UNRATED, meta: COMPATIBILITY_META[UNRATED.rating] };
  const row = idA === idB ? SAME_CHALLENGE : (index.get(pairKey(idA, idB)) || UNRATED);
  return { rating: row.rating, reason: row.reason, meta: COMPATIBILITY_META[row.rating] };
}

/** True when the pairing may run simultaneously at all. */
export function canStack(idA, idB) {
  return getCompatibility(idA, idB).rating !== COMPATIBILITY.CONFLICTING;
}

/** True when selecting the pairing must show a warning before confirmation. */
export function needsWarning(idA, idB) {
  return getCompatibility(idA, idB).rating === COMPATIBILITY.CONDITIONAL;
}

/**
 * Group candidate challenges by their compatibility with `primaryId`, ordered
 * best-first. Returns [{ rating, meta, items: [{ template, compatibility }] }].
 */
export function groupByCompatibility(primaryId, templates) {
  const groups = new Map();
  for (const template of templates || []) {
    const compatibility = getCompatibility(primaryId, template.id);
    const list = groups.get(compatibility.rating) || [];
    list.push({ template, compatibility });
    groups.set(compatibility.rating, list);
  }
  return [COMPATIBILITY.HIGHLY_COMPATIBLE, COMPATIBILITY.CONDITIONAL, COMPATIBILITY.CONFLICTING]
    .filter(r => groups.has(r))
    .map(r => ({ rating: r, meta: COMPATIBILITY_META[r], items: groups.get(r) }));
}
