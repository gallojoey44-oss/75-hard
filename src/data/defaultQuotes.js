export const SOURCES = [
  'Bible', 'Vinland Saga', 'Vagabond', 'Berserk',
  'Naruto', 'Star Wars', 'Attack on Titan', 'Custom',
];

export const THEMES = [
  'Discipline', 'Courage', 'Self-control', 'Suffering', 'Forgiveness',
  'Purpose', 'Hope', 'Humility', 'Anger control', 'Faith', 'Resilience',
  'Letting go', 'Peace',
];

// All Bible text is KJV (public domain).
// All other entries are clearly marked isInspired:true — original reflections
// thematically inspired by the listed works, not verbatim quotes.
export const DEFAULT_QUOTES = [
  // ── Bible ────────────────────────────────────────────────────────────────
  {
    id: 'q_b_01',
    text: "He that is slow to anger is better than the mighty; and he that ruleth his spirit than he that taketh a city.",
    source: 'Bible', reference: 'Proverbs 16:32', theme: 'Anger control', isInspired: false,
  },
  {
    id: 'q_b_02',
    text: "The fruit of the Spirit is love, joy, peace, longsuffering, gentleness, goodness, faith, meekness, temperance: against such there is no law.",
    source: 'Bible', reference: 'Galatians 5:22–23', theme: 'Self-control', isInspired: false,
  },
  {
    id: 'q_b_03',
    text: "I can do all things through Christ which strengtheneth me.",
    source: 'Bible', reference: 'Philippians 4:13', theme: 'Faith', isInspired: false,
  },
  {
    id: 'q_b_04',
    text: "Be strong and of a good courage; be not afraid, neither be thou dismayed: for the Lord thy God is with thee whithersoever thou goest.",
    source: 'Bible', reference: 'Joshua 1:9', theme: 'Courage', isInspired: false,
  },
  {
    id: 'q_b_05',
    text: "They that wait upon the Lord shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary.",
    source: 'Bible', reference: 'Isaiah 40:31', theme: 'Hope', isInspired: false,
  },
  {
    id: 'q_b_06',
    text: "Tribulation worketh patience; and patience, experience; and experience, hope.",
    source: 'Bible', reference: 'Romans 5:3–4', theme: 'Resilience', isInspired: false,
  },
  {
    id: 'q_b_07',
    text: "I keep under my body, and bring it into subjection: lest that by any means, when I have preached to others, I myself should be a castaway.",
    source: 'Bible', reference: '1 Corinthians 9:27', theme: 'Discipline', isInspired: false,
  },
  {
    id: 'q_b_08',
    text: "What doth the Lord require of thee, but to do justly, and to love mercy, and to walk humbly with thy God.",
    source: 'Bible', reference: 'Micah 6:8', theme: 'Humility', isInspired: false,
  },
  {
    id: 'q_b_09',
    text: "The trying of your faith worketh patience. But let patience have her perfect work, that ye may be perfect and entire, wanting nothing.",
    source: 'Bible', reference: 'James 1:3–4', theme: 'Resilience', isInspired: false,
  },
  {
    id: 'q_b_10',
    text: "Seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you.",
    source: 'Bible', reference: 'Matthew 6:33', theme: 'Purpose', isInspired: false,
  },
  // ── Vinland Saga (inspired reflections) ──────────────────────────────────
  {
    id: 'q_vs_01',
    text: "A true warrior needs no hatred to be strong. Real strength is born from purpose, not anger.",
    source: 'Vinland Saga', reference: 'Thors (inspired)', theme: 'Anger control', isInspired: true,
  },
  {
    id: 'q_vs_02',
    text: "Freedom is not something given to you — it is built day by day through discipline and sacrifice.",
    source: 'Vinland Saga', reference: 'Thorfinn (inspired)', theme: 'Discipline', isInspired: true,
  },
  {
    id: 'q_vs_03',
    text: "The things you use to justify your anger will one day become the chains that hold you back.",
    source: 'Vinland Saga', reference: 'Inspired reflection', theme: 'Letting go', isInspired: true,
  },
  {
    id: 'q_vs_04',
    text: "True peace requires more strength than war. Anyone can react — it takes a warrior to choose calm.",
    source: 'Vinland Saga', reference: 'Inspired reflection', theme: 'Self-control', isInspired: true,
  },
  {
    id: 'q_vs_05',
    text: "You are not your worst moment. The person who keeps walking forward is always more than the person who fell.",
    source: 'Vinland Saga', reference: 'Inspired reflection', theme: 'Resilience', isInspired: true,
  },
  // ── Vagabond (inspired reflections) ─────────────────────────────────────
  {
    id: 'q_vg_01',
    text: "Strength without self-mastery is incomplete. The sword must be still before it can be swift.",
    source: 'Vagabond', reference: 'Musashi (inspired)', theme: 'Discipline', isInspired: true,
  },
  {
    id: 'q_vg_02',
    text: "The greatest opponent you will ever face is the part of yourself that wants to stop.",
    source: 'Vagabond', reference: 'Inspired reflection', theme: 'Discipline', isInspired: true,
  },
  {
    id: 'q_vg_03',
    text: "Mastery is not about defeating others. It is about becoming so aligned with your purpose that nothing can stop you.",
    source: 'Vagabond', reference: 'Inspired reflection', theme: 'Purpose', isInspired: true,
  },
  {
    id: 'q_vg_04',
    text: "When the mind is restless, the body cannot find its truth. Still yourself first.",
    source: 'Vagabond', reference: 'Inspired reflection', theme: 'Self-control', isInspired: true,
  },
  {
    id: 'q_vg_05',
    text: "Walk the path with humility. The road itself will teach you more than any teacher.",
    source: 'Vagabond', reference: 'Inspired reflection', theme: 'Humility', isInspired: true,
  },
  // ── Berserk (inspired reflections) ──────────────────────────────────────
  {
    id: 'q_bk_01',
    text: "Keep moving forward even when the path is heavy. The weight you carry today builds the strength you'll need tomorrow.",
    source: 'Berserk', reference: 'Inspired reflection', theme: 'Resilience', isInspired: true,
  },
  {
    id: 'q_bk_02',
    text: "Even in total darkness, the choice to keep moving is its own kind of light.",
    source: 'Berserk', reference: 'Inspired reflection', theme: 'Hope', isInspired: true,
  },
  {
    id: 'q_bk_03',
    text: "To lose everything and still choose to rise — that is what separates the unbreakable from the defeated.",
    source: 'Berserk', reference: 'Inspired reflection', theme: 'Courage', isInspired: true,
  },
  {
    id: 'q_bk_04',
    text: "Fate is not a cage unless you accept it as one.",
    source: 'Berserk', reference: 'Inspired reflection', theme: 'Purpose', isInspired: true,
  },
  {
    id: 'q_bk_05',
    text: "Pain is not the enemy. Staying down is.",
    source: 'Berserk', reference: 'Inspired reflection', theme: 'Resilience', isInspired: true,
  },
  // ── Naruto (inspired reflections) ───────────────────────────────────────
  {
    id: 'q_nr_01',
    text: "Pain can either harden you into bitterness or teach you compassion. That choice is yours alone.",
    source: 'Naruto', reference: 'Inspired reflection', theme: 'Suffering', isInspired: true,
  },
  {
    id: 'q_nr_02',
    text: "Failure is not falling down. Failure is deciding not to get back up.",
    source: 'Naruto', reference: 'Inspired reflection', theme: 'Resilience', isInspired: true,
  },
  {
    id: 'q_nr_03',
    text: "Hard work is not a consolation prize. Consistent effort is the only path that never closes.",
    source: 'Naruto', reference: 'Rock Lee (inspired)', theme: 'Discipline', isInspired: true,
  },
  {
    id: 'q_nr_04',
    text: "When you stop needing others' approval to feel whole, you stop being their prisoner.",
    source: 'Naruto', reference: 'Inspired reflection', theme: 'Purpose', isInspired: true,
  },
  {
    id: 'q_nr_05',
    text: "Forgiveness is not for the other person. It is a weight you choose to put down.",
    source: 'Naruto', reference: 'Inspired reflection', theme: 'Forgiveness', isInspired: true,
  },
  // ── Star Wars (inspired reflections) ────────────────────────────────────
  {
    id: 'q_sw_01',
    text: "Fear leads to anger; anger leads to suffering. Train your mind before you raise your hand.",
    source: 'Star Wars', reference: 'Yoda (inspired)', theme: 'Anger control', isInspired: true,
  },
  {
    id: 'q_sw_02',
    text: "Your greatest power is not what you can do — it is what you choose not to do.",
    source: 'Star Wars', reference: 'Inspired reflection', theme: 'Self-control', isInspired: true,
  },
  {
    id: 'q_sw_03',
    text: "Act from stillness, not impulse. Clarity is the only compass worth trusting.",
    source: 'Star Wars', reference: 'Obi-Wan Kenobi (inspired)', theme: 'Discipline', isInspired: true,
  },
  {
    id: 'q_sw_04',
    text: "Hope is not naivety. In the darkest of times, choosing to hope is an act of courage.",
    source: 'Star Wars', reference: 'Inspired reflection', theme: 'Hope', isInspired: true,
  },
  {
    id: 'q_sw_05',
    text: "The greatest strength is knowing when to hold back. Any fool can strike — only the wise choose peace.",
    source: 'Star Wars', reference: 'Inspired reflection', theme: 'Self-control', isInspired: true,
  },
  // ── Attack on Titan (inspired reflections) ───────────────────────────────
  {
    id: 'q_aot_01',
    text: "Freedom requires sacrifice, courage, and the willingness to carry the full weight of responsibility.",
    source: 'Attack on Titan', reference: 'Inspired reflection', theme: 'Courage', isInspired: true,
  },
  {
    id: 'q_aot_02',
    text: "Every step you take forward, no matter how small, is a strike against the walls that confine you.",
    source: 'Attack on Titan', reference: 'Inspired reflection', theme: 'Discipline', isInspired: true,
  },
  {
    id: 'q_aot_03',
    text: "The greatest chains are the ones we place on ourselves. Break yours one habit at a time.",
    source: 'Attack on Titan', reference: 'Inspired reflection', theme: 'Letting go', isInspired: true,
  },
  {
    id: 'q_aot_04',
    text: "If you give up your integrity to protect something, ask yourself what you are truly protecting it for.",
    source: 'Attack on Titan', reference: 'Inspired reflection', theme: 'Purpose', isInspired: true,
  },
  {
    id: 'q_aot_05',
    text: "When the world gives you no reason to keep going, you must forge your own reason from within.",
    source: 'Attack on Titan', reference: 'Inspired reflection', theme: 'Resilience', isInspired: true,
  },
];
