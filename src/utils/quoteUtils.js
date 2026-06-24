import { DEFAULT_QUOTES } from '../data/defaultQuotes';

export const REFLECTION_PROMPTS = [
  "How can I live this today?",
  "What is this challenging me to do?",
  "Where do I need more discipline today?",
];

// Convert '2024-01-15' → stable integer 20240115 for deterministic selection
function dateToNum(dateStr) {
  return parseInt((dateStr || '').replace(/-/g, ''), 10) || 0;
}

/**
 * Merge default quotes with any custom quotes the profile has added,
 * then filter to only enabled sources.
 */
export function getAvailableQuotes(customQuotes = [], enabledSources = []) {
  const all = [...DEFAULT_QUOTES, ...customQuotes];
  if (!enabledSources.length) return all;
  return all.filter(q => enabledSources.includes(q.source));
}

/**
 * Select the quote for a given date.
 * cycleOffset allows the user to manually advance past today's default pick.
 */
export function getDailyQuote(dateStr, quotes, cycleOffset = 0) {
  if (!quotes || quotes.length === 0) return null;
  const base = dateToNum(dateStr) % quotes.length;
  const idx  = ((base + cycleOffset) % quotes.length + quotes.length) % quotes.length;
  return quotes[idx];
}

/** Returns one of three reflection prompts deterministically for the date. */
export function getDailyReflectionPrompt(dateStr) {
  const idx = dateToNum(dateStr) % REFLECTION_PROMPTS.length;
  return REFLECTION_PROMPTS[idx];
}

/** Source emoji map for visual display */
export const SOURCE_EMOJI = {
  'Bible':          '✝️',
  'Vinland Saga':   '⚔️',
  'Vagabond':       '🗡️',
  'Berserk':        '🔥',
  'Naruto':         '🍃',
  'Star Wars':      '⚡',
  'Attack on Titan':'🏰',
  'Custom':         '✏️',
};
