import { useId } from 'react';

/**
 * The six training scenes — still water, open sky, a bamboo grove, a lantern
 * over an open book, a peak at first light, a reflecting pool.
 *
 * Original, hand-written SVG: no artwork, characters or motifs from anywhere
 * else, no image downloads, and well under a few kilobytes each. They are
 * tinted from the profile's own accent through CSS (`--accent`, `--accent2`),
 * so the same scene reads purple on one profile and pink on the other with
 * nothing duplicated.
 *
 * Movement is limited to slow, small changes of opacity or position — water
 * shimmering, a cloud drifting, a lantern's glow — and only in the large
 * version. `still` turns it off for thumbnails, and the stylesheet turns it
 * off everywhere for anyone who has asked their device for reduced motion.
 */

const W = 360;
const H = 180;

function Stars({ points, cls = 'mts-star' }) {
  return points.map(([x, y, r = 1], i) => <circle key={i} className={cls} cx={x} cy={y} r={r} />);
}

function Lake({ id }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="mts-stop-night" />
          <stop offset="1" className="mts-stop-accent-soft" />
        </linearGradient>
        <radialGradient id={`${id}glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" className="mts-stop-accent" stopOpacity="0.45" />
          <stop offset="1" className="mts-stop-accent" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}water`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="mts-stop-water" />
          <stop offset="1" className="mts-stop-deep" />
        </linearGradient>
        <radialGradient id={`${id}moonpath`} cx="0.5" cy="0.3" r="0.6">
          <stop offset="0" className="mts-stop-moon" stopOpacity="0.5" />
          <stop offset="1" className="mts-stop-moon" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${id}sky)`} />
      <Stars points={[[40, 22], [92, 40, 0.8], [140, 18], [196, 34, 0.8], [316, 26], [338, 58, 0.8], [62, 64, 0.7]]} />
      <circle cx="252" cy="54" r="46" fill={`url(#${id}glow)`} className="mts-breathe" />
      <circle cx="252" cy="54" r="15" className="mts-moon" />
      <path d="M0 122 L44 92 L78 108 L122 76 L168 112 L206 96 L246 116 L290 88 L330 108 L360 98 L360 124 L0 124 Z" className="mts-far" />
      <path d="M0 124 L30 110 L70 120 L104 104 L150 122 L196 112 L236 124 L282 110 L322 122 L360 114 L360 126 L0 126 Z" className="mts-near" />
      <rect y="124" width={W} height={H - 124} fill={`url(#${id}water)`} />
      <g className="mts-shimmer">
        <ellipse cx="252" cy="146" rx="9" ry="24" fill={`url(#${id}moonpath)`} />
        <path d="M238 134 H266 M243 144 H261 M247 154 H257" className="mts-ripple bright" />
      </g>
      <path d="M20 146 H92 M120 160 H196 M290 168 H344" className="mts-ripple" />
    </>
  );
}

function Sky({ id }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="mts-stop-night" />
          <stop offset="0.75" className="mts-stop-dawn" />
          <stop offset="1" className="mts-stop-accent-soft" />
        </linearGradient>
        <radialGradient id={`${id}sun`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" className="mts-stop-accent2" stopOpacity="0.55" />
          <stop offset="1" className="mts-stop-accent2" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${id}sky)`} />
      <circle cx="112" cy="128" r="70" fill={`url(#${id}sun)`} className="mts-breathe" />
      <circle cx="112" cy="128" r="22" className="mts-sun" />
      <g className="mts-drift">
        <ellipse cx="220" cy="52" rx="34" ry="9" className="mts-cloud" />
        <ellipse cx="244" cy="46" rx="20" ry="9" className="mts-cloud" />
        <ellipse cx="70" cy="40" rx="26" ry="7" className="mts-cloud" opacity="0.7" />
      </g>
      <g className="mts-drift slow">
        <ellipse cx="300" cy="78" rx="28" ry="6" className="mts-cloud" opacity="0.6" />
      </g>
      <path d="M262 68 l6 4 l6 -4 M282 60 l5 3 l5 -3" className="mts-bird" />
      <path d="M0 130 Q 90 104 180 126 T 360 120 V180 H0 Z" className="mts-far" />
      <path d="M0 150 Q 120 126 240 150 T 360 144 V180 H0 Z" className="mts-near" />
      <path d="M40 152 l2 -7 M46 151 l1 -5 M300 150 l-2 -7 M306 150 l1 -6 M180 160 l2 -6" className="mts-grass" />
    </>
  );
}

function Bamboo({ id }) {
  const stalk = (x, w, cls, nodes) => (
    <g key={x}>
      <rect x={x} y="0" width={w} height={H} rx={w / 2} className={cls} />
      {nodes.map(y => <rect key={y} x={x - 1} y={y} width={w + 2} height="2" rx="1" className="mts-node" />)}
    </g>
  );
  return (
    <>
      <defs>
        <linearGradient id={`${id}mist`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="mts-stop-night" />
          <stop offset="1" className="mts-stop-accent-soft" />
        </linearGradient>
        <radialGradient id={`${id}glow`} cx="0.5" cy="0.6" r="0.55">
          <stop offset="0" className="mts-stop-accent" stopOpacity="0.32" />
          <stop offset="1" className="mts-stop-accent" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${id}mist)`} />
      <rect width={W} height={H} fill={`url(#${id}glow)`} />
      {stalk(96, 6, 'mts-stalk far', [30, 84, 140])}
      {stalk(262, 6, 'mts-stalk far', [46, 104, 158])}
      {stalk(36, 10, 'mts-stalk', [22, 76, 128])}
      {stalk(312, 10, 'mts-stalk', [40, 96, 150])}
      <g className="mts-leaves">
        <ellipse cx="58" cy="58" rx="16" ry="3" transform="rotate(-24 58 58)" className="mts-leaf" />
        <ellipse cx="60" cy="70" rx="13" ry="2.5" transform="rotate(-8 60 70)" className="mts-leaf" />
        <ellipse cx="294" cy="84" rx="16" ry="3" transform="rotate(22 294 84)" className="mts-leaf" />
        <ellipse cx="290" cy="96" rx="12" ry="2.5" transform="rotate(8 290 96)" className="mts-leaf" />
      </g>
      <path d="M0 118 C 70 84, 130 150, 196 108 S 300 86, 360 104" className="mts-ribbon mts-flow" />
      <path d="M0 132 C 80 110, 150 160, 220 126 S 310 112, 360 122" className="mts-ribbon faint mts-flow slow" />
      <rect y="156" width={W} height="24" className="mts-near" />
    </>
  );
}

function Lantern({ id }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="mts-stop-night" />
          <stop offset="1" className="mts-stop-dusk" />
        </linearGradient>
        <radialGradient id={`${id}glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" className="mts-stop-accent2" stopOpacity="0.55" />
          <stop offset="1" className="mts-stop-accent2" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${id}sky)`} />
      <Stars points={[[30, 20], [70, 46, 0.8], [118, 24, 0.9], [168, 12, 0.7], [204, 40], [330, 22, 0.8], [348, 54, 0.7], [150, 60, 0.6]]} />
      <path d="M0 120 Q 80 96 160 116 T 360 108 V180 H0 Z" className="mts-far" />
      <circle cx="262" cy="104" r="64" fill={`url(#${id}glow)`} className="mts-flicker" />
      <rect x="40" y="136" width="300" height="44" rx="6" className="mts-ledge" />
      <path d="M104 140 Q 140 128 176 138 L176 160 Q 140 150 104 162 Z" className="mts-page" />
      <path d="M176 138 Q 212 128 248 140 L248 162 Q 212 150 176 160 Z" className="mts-page dim" />
      <path d="M114 144 Q 140 136 168 142 M114 150 Q 140 142 168 148 M184 142 Q 210 136 238 144 M184 148 Q 210 142 238 150" className="mts-lines" />
      <rect x="252" y="94" width="20" height="34" rx="4" className="mts-lantern" />
      <rect x="256" y="100" width="12" height="22" rx="3" className="mts-flame mts-flicker" />
      <rect x="248" y="90" width="28" height="5" rx="2" className="mts-lantern" />
      <path d="M262 90 V80" className="mts-hook" />
    </>
  );
}

function Peak({ id }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="mts-stop-night" />
          <stop offset="1" className="mts-stop-dusk" />
        </linearGradient>
        <radialGradient id={`${id}rise`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" className="mts-stop-accent" stopOpacity="0.6" />
          <stop offset="1" className="mts-stop-accent" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${id}sky)`} />
      <Stars points={[[36, 26], [84, 14, 0.8], [130, 44, 0.7], [312, 30], [340, 62, 0.8], [176, 22, 0.6]]} />
      <circle cx="236" cy="110" r="96" fill={`url(#${id}rise)`} className="mts-breathe" />
      <path d="M118 180 L232 54 L352 180 Z" className="mts-far" />
      <path d="M232 54 L246 70 L238 68 L230 76 L222 68 L214 72 Z" className="mts-snow" />
      <path d="M0 180 L0 150 Q 70 128 130 150 T 250 156 T 360 150 L360 180 Z" className="mts-near" />
      <path d="M60 180 C 96 164, 82 150, 126 142 S 180 128, 196 112 S 222 84, 230 66" className="mts-trail" />
      <path d="M232 26 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3 Z" className="mts-guide-star mts-twinkle" />
    </>
  );
}

function Pool({ id }) {
  const pines = [[18, 30], [44, 40], [70, 28], [98, 44], [126, 34], [234, 36], [262, 46], [290, 30], [318, 42], [344, 32]];
  const tree = ([x, h], i) => <path key={i} d={`M${x - 12} 112 L${x} ${112 - h} L${x + 12} 112 Z`} />;
  return (
    <>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="mts-stop-night" />
          <stop offset="1" className="mts-stop-accent-soft" />
        </linearGradient>
        <radialGradient id={`${id}glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" className="mts-stop-accent" stopOpacity="0.4" />
          <stop offset="1" className="mts-stop-accent" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${id}sky)`} />
      <Stars points={[[150, 18], [196, 30, 0.8], [210, 12, 0.7], [172, 46, 0.6]]} />
      <circle cx="180" cy="44" r="40" fill={`url(#${id}glow)`} className="mts-breathe" />
      <path d="M186 30 a14 14 0 1 0 0 28 a10 12 0 1 1 0 -28 Z" className="mts-moon" />
      <g className="mts-near">{pines.map(tree)}</g>
      <rect y="112" width={W} height={H - 112} className="mts-pool" />
      <g className="mts-mirror" transform="translate(0 224) scale(1 -1)">{pines.map(tree)}</g>
      <ellipse cx="180" cy="150" rx="22" ry="6" className="mts-ring mts-breathe" />
      <g className="mts-fireflies">
        <circle cx="64" cy="96" r="1.6" className="mts-firefly" />
        <circle cx="120" cy="84" r="1.3" className="mts-firefly d2" />
        <circle cx="250" cy="90" r="1.6" className="mts-firefly d3" />
        <circle cx="300" cy="78" r="1.2" className="mts-firefly d4" />
        <circle cx="210" cy="100" r="1.1" className="mts-firefly d2" />
      </g>
    </>
  );
}

const SCENES = { lake: Lake, sky: Sky, bamboo: Bamboo, lantern: Lantern, peak: Peak, pool: Pool };

export default function TrainingScene({ scene, still = false, className = '' }) {
  // Gradient ids must be unique per drawing, and React's ids contain colons,
  // which are awkward inside url(#…) references.
  const id = `mts${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const Scene = SCENES[scene] || Lake;
  return (
    <svg
      className={`mts${still ? ' still' : ''}${className ? ` ${className}` : ''}`}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <Scene id={id} />
    </svg>
  );
}
