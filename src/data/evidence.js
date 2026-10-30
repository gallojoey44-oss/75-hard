/**
 * How good the evidence is — the shared vocabulary for every strategy guide.
 *
 * This started inside LOCK IN, which was the only challenge with guides. Now
 * that other challenges have them too, the labels live here so a 🟢 means the
 * same thing in a Fat Loss guide as it does in a LOCK IN one. `lockInConfig`
 * re-exports these under their original names, so nothing that already reads
 * them from there has to change.
 *
 * The point of labelling at all: a guide that states everything with equal
 * confidence teaches you nothing about which parts to trust. Only the optional
 * strategies carry a label — what the challenge actually requires is in each
 * guide's "How to complete it", and that is not a suggestion.
 */

export const EVIDENCE = {
  ESTABLISHED: 'established',
  PROMISING: 'promising',
  EXPERIMENTAL: 'experimental',
};

export const EVIDENCE_META = {
  [EVIDENCE.ESTABLISHED]: {
    key: EVIDENCE.ESTABLISHED, label: 'Well supported', dot: '🟢', color: '#10B981',
    blurb: 'Consistent evidence, or a direct consequence of something well established.',
  },
  [EVIDENCE.PROMISING]: {
    key: EVIDENCE.PROMISING, label: 'Some support', dot: '🟡', color: '#F59E0B',
    blurb: 'Real evidence, but limited, mixed, or mostly from small studies. Worth trying; do not treat as settled.',
  },
  [EVIDENCE.EXPERIMENTAL]: {
    key: EVIDENCE.EXPERIMENTAL, label: 'Experimental', dot: '🔵', color: '#60A5FA',
    blurb: 'Mostly practice and plausible reasoning rather than good evidence. Harmless to try, but no promises.',
  },
};

export const EVIDENCE_LEGEND =
  'Optimization and advanced strategies are labelled by how good the evidence is. Everything required by the challenge is in “How to complete it” — the labelled strategies are all optional.';
