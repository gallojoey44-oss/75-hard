import {
  MAX_MESSAGES, MAX_MESSAGE_CHARS, PRIVATE_TITLE, PRIVATE_BODY, REVEALED_TITLE,
  pickForDate, normalizeDays, isScheduledDay, buildPayload,
} from '../../api/_lib/pastSelf.js';

/**
 * Letters to my future self, and the short messages Forge sends back.
 *
 * Everything a person writes here lives on their own profile, on their own
 * device: `profiles[profileId].pastSelf`. That one choice does most of the
 * work —
 *
 *   • the two profiles are separate because they are separate objects;
 *   • it is in the backup file already, because `profiles` is;
 *   • "delete all my data" removes it, because that resets the profile;
 *   • and there is nothing to migrate: a profile without the field simply
 *     reads as an empty collection.
 *
 * This is a DIFFERENT thing from the Future Self Letter a challenge asks for
 * before it starts. That letter belongs to one attempt, is sealed when the
 * challenge begins and is archived with it. These are standing letters that
 * can be rewritten as a person changes, and they outlive any challenge. Both
 * are shown together in the same place; neither replaces the other.
 *
 * The functions below are pure: each takes the stored value and returns a new
 * one. Nothing here touches day records, tasks, XP or rank — reading or
 * receiving a message is not a habit and awards nothing.
 */

export { MAX_MESSAGES, MAX_MESSAGE_CHARS, PRIVATE_TITLE, PRIVATE_BODY, REVEALED_TITLE };

export const MAX_LETTERS = 40;
export const MAX_LETTER_CHARS = 20000;
export const MAX_TITLE_CHARS = 80;

/**
 * Optional places to start. Tapping one drops the question into the letter as
 * a line of its own; nothing requires any of them to be answered.
 */
export const LETTER_PROMPTS = [
  'Why am I beginning this journey?',
  'Who do I want to become?',
  'What am I afraid of?',
  'What weaknesses am I trying to overcome?',
  'What should I remember when I feel like quitting?',
  'What would make me proud of myself a year from now?',
];

export const WEEKDAYS = [
  { n: 1, short: 'Mon', letter: 'M' },
  { n: 2, short: 'Tue', letter: 'T' },
  { n: 3, short: 'Wed', letter: 'W' },
  { n: 4, short: 'Thu', letter: 'T' },
  { n: 5, short: 'Fri', letter: 'F' },
  { n: 6, short: 'Sat', letter: 'S' },
  { n: 0, short: 'Sun', letter: 'S' },
];

/** Delivery is OFF until the user turns it on, and private until they say otherwise. */
export function defaultDelivery() {
  return {
    enabled: false,
    mode: 'daily',              // 'daily' | 'days'
    days: [1, 2, 3, 4, 5],      // used when mode is 'days'; 0 = Sunday
    time: '07:30',
    pick: 'rotate',             // 'rotate' | 'specific'
    messageId: null,            // used when pick is 'specific'
    showContent: false,         // show my own words on the lock screen
  };
}

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * The profile's past-self data with every default filled in.
 *
 * Tolerant by design: it is read on every render from whatever is in storage,
 * including a profile that has never used the feature and a backup from before
 * it existed.
 */
export function readPastSelf(profile) {
  const raw = profile?.pastSelf || {};
  const letters = Array.isArray(raw.letters)
    ? raw.letters.filter(l => l && typeof l.id === 'string' && typeof l.body === 'string')
    : [];
  const messages = Array.isArray(raw.messages)
    ? raw.messages.filter(m => m && typeof m.id === 'string' && typeof m.text === 'string')
    : [];
  const d = { ...defaultDelivery(), ...(raw.delivery || {}) };
  const delivery = {
    enabled: d.enabled === true,
    mode: d.mode === 'days' ? 'days' : 'daily',
    days: Array.isArray(d.days) ? [...new Set(d.days.map(Number).filter(n => n >= 0 && n <= 6))] : [1, 2, 3, 4, 5],
    time: HHMM.test(String(d.time)) ? d.time : '07:30',
    pick: d.pick === 'specific' ? 'specific' : 'rotate',
    messageId: typeof d.messageId === 'string' ? d.messageId : null,
    showContent: d.showContent === true,
  };
  return { v: 1, letters, messages, delivery };
}

// ── Letters ──────────────────────────────────────────────────────────────────

/** Add a letter, or replace the one with the same id. Returns the new state. */
export function saveLetter(state, { id = null, title = '', body = '' }, now = new Date().toISOString()) {
  const cleanBody = String(body).slice(0, MAX_LETTER_CHARS);
  const cleanTitle = String(title).trim().slice(0, MAX_TITLE_CHARS);
  if (!cleanBody.trim()) return state;
  const existing = id ? state.letters.find(l => l.id === id) : null;
  if (existing) {
    return {
      ...state,
      letters: state.letters.map(l => (l.id === id
        ? { ...l, title: cleanTitle, body: cleanBody, updatedAt: now }
        : l)),
    };
  }
  if (state.letters.length >= MAX_LETTERS) return state;
  const letter = { id: newId('ltr'), title: cleanTitle, body: cleanBody, createdAt: now, updatedAt: now };
  return { ...state, letters: [...state.letters, letter] };
}

export function deleteLetter(state, id) {
  return { ...state, letters: state.letters.filter(l => l.id !== id) };
}

/** Newest first — the order they are listed in. */
export function lettersNewestFirst(state) {
  return [...state.letters].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

// ── Short messages ───────────────────────────────────────────────────────────

/** Length in characters as a person counts them, so an emoji is one. */
export function charCount(text) {
  return [...String(text || '')].length;
}

/**
 * Why a piece of text cannot be saved as a message, or null when it can.
 * Over-long text is refused, never trimmed: a shortened sentence is no longer
 * the one they wrote.
 */
export function messageProblem(state, text, editingId = null) {
  const t = String(text || '').trim();
  if (!t) return 'Write something first.';
  if (charCount(t) > MAX_MESSAGE_CHARS) return `Keep it to ${MAX_MESSAGE_CHARS} characters so the whole message fits in a notification.`;
  if (!editingId && state.messages.length >= MAX_MESSAGES) return `You can keep up to ${MAX_MESSAGES} messages.`;
  return null;
}

/** Add a message, or replace the text of an existing one. Words are kept exactly. */
export function saveMessage(state, { id = null, text = '' }, now = new Date().toISOString()) {
  if (messageProblem(state, text, id)) return state;
  const clean = String(text).trim();
  if (id && state.messages.some(m => m.id === id)) {
    return {
      ...state,
      messages: state.messages.map(m => (m.id === id ? { ...m, text: clean, updatedAt: now } : m)),
    };
  }
  const message = { id: newId('msg'), text: clean, enabled: true, createdAt: now, updatedAt: now };
  return { ...state, messages: [...state.messages, message] };
}

export function deleteMessage(state, id) {
  const delivery = state.delivery.messageId === id
    ? { ...state.delivery, pick: 'rotate', messageId: null }
    : state.delivery;
  return { ...state, messages: state.messages.filter(m => m.id !== id), delivery };
}

export function setMessageEnabled(state, id, enabled) {
  // Switching off the one message delivery was pinned to cannot leave delivery
  // pointing at something that will never be sent.
  const delivery = !enabled && state.delivery.messageId === id
    ? { ...state.delivery, pick: 'rotate', messageId: null }
    : state.delivery;
  return {
    ...state,
    messages: state.messages.map(m => (m.id === id ? { ...m, enabled: !!enabled } : m)),
    delivery,
  };
}

// ── Delivery ─────────────────────────────────────────────────────────────────

export function updateDelivery(state, patch) {
  const next = readPastSelf({ pastSelf: { ...state, delivery: { ...state.delivery, ...patch } } }).delivery;
  // "Specific days" with no day chosen would be a schedule that never fires
  // while still reading as on; keep the last sensible selection instead.
  if (next.mode === 'days' && next.days.length === 0) next.days = state.delivery.days.length ? state.delivery.days : [1, 2, 3, 4, 5];
  return { ...state, delivery: next };
}

/** The weekday list the schedule actually uses: null means every day. */
export function scheduledDays(delivery) {
  return delivery.mode === 'days' ? normalizeDays(delivery.days) : null;
}

/**
 * The messages a delivery may be drawn from, in the user's own order.
 * One message when delivery is pinned to it; otherwise every message that is
 * switched on.
 */
export function eligibleMessages(state) {
  const on = state.messages.filter(m => m.enabled !== false);
  if (state.delivery.pick === 'specific') {
    const chosen = on.find(m => m.id === state.delivery.messageId);
    if (chosen) return [chosen];
  }
  return on;
}

/** A notification needs something to open: a message, or failing that a letter. */
export function hasSomethingToSend(state) {
  return eligibleMessages(state).length > 0 || state.letters.length > 0;
}

/** True when notifications are on AND there is something for them to deliver. */
export function deliveryActive(state) {
  return state.delivery.enabled && hasSomethingToSend(state);
}

/**
 * Whether anything on this device still sends through its push subscription.
 *
 * There is ONE subscription per device. Both profiles share it — in the
 * browser, and on the server, where it is stored once under its endpoint — so
 * dropping it on behalf of one profile silences the other as well. Anything
 * that is about to unsubscribe asks this first, naming in `ignore` the one
 * thing being switched off right now:
 *
 *   pushStillNeeded(profiles, notifPrefs, { pastSelf: 'me' })     // me's messages going off
 *   pushStillNeeded(profiles, notifPrefs, { reminders: 'me' })    // me's reminders going off
 */
export function pushStillNeeded(profiles, notifPrefs, ignore = {}) {
  return ['me', 'girlfriend'].some(id =>
    (notifPrefs?.[id]?.masterEnabled === true && ignore.reminders !== id)
    || (ignore.pastSelf !== id && deliveryActive(readPastSelf(profiles?.[id]))));
}

/**
 * Exactly what is sent to the server for this profile.
 *
 * This function is the privacy boundary, and it is short on purpose. With
 * `showContent` off — the default — the body carries a time, the weekdays, the
 * time zone and quiet hours, and NOT ONE WORD the user wrote. With it on, it
 * carries the short messages that are switched on and nothing else. A letter
 * is never included under any setting: there is no code path that reads one
 * into this object.
 */
export function buildSyncBody(state, { timezone, quietHours } = {}) {
  if (!deliveryActive(state)) return { kind: 'pastSelf', enabled: false };
  const messages = eligibleMessages(state);
  const reveal = state.delivery.showContent && messages.length > 0;
  return {
    kind: 'pastSelf',
    enabled: true,
    timezone,
    time: state.delivery.time,
    days: scheduledDays(state.delivery),
    quietHours: quietHours || null,
    showContent: reveal,
    rotation: reveal ? messages.map(m => ({ id: m.id, text: m.text })) : [],
  };
}

/** The notification as the phone would show it for a given local date. */
export function previewNotification(state, localDate, { reveal = state.delivery.showContent } = {}) {
  const messages = eligibleMessages(state);
  const record = {
    showContent: reveal && messages.length > 0,
    rotation: messages.map(m => ({ id: m.id, text: m.text })),
    days: scheduledDays(state.delivery),
  };
  const p = buildPayload(record, localDate, 'me');
  return { title: p.title, body: p.body, messageId: p.msg || null };
}

/**
 * What to show when a notification is opened.
 *
 * `msg` is present when the server chose the message (lock-screen display was
 * on). Otherwise the app chooses, by the same rule and for the same date the
 * notification was sent for — which is what lets the private mode work without
 * the server ever knowing a message id. If the messages have all gone since,
 * the most recent letter is shown instead of an empty screen.
 */
export function resolveReveal(state, { date, msg = null } = {}) {
  if (msg) {
    const exact = state.messages.find(m => m.id === msg);
    if (exact) return { kind: 'message', message: exact };
  }
  const picked = pickForDate(eligibleMessages(state), date, scheduledDays(state.delivery));
  if (picked) return { kind: 'message', message: picked };
  const letter = lettersNewestFirst(state)[0];
  if (letter) return { kind: 'letter', letter };
  return { kind: 'none' };
}

// ── Describing the schedule ──────────────────────────────────────────────────

/** "Every day" / "Weekdays" / "Mon, Wed, Fri". */
export function describeDays(delivery) {
  const days = scheduledDays(delivery);
  if (!days) return 'Every day';
  const key = days.join(',');
  if (key === '1,2,3,4,5') return 'Weekdays';
  if (key === '0,6') return 'Weekends';
  return WEEKDAYS.filter(w => days.includes(w.n)).map(w => w.short).join(', ');
}

/** '07:30' → '7:30 AM', in the device's own convention. */
export function formatTime(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return String(hhmm);
  try {
    return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return hhmm;
  }
}

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * The next local date and time a message is scheduled for, or null when
 * delivery is off. Used only to tell the user what to expect.
 */
export function nextDelivery(state, now = new Date()) {
  if (!deliveryActive(state)) return null;
  const [h, m] = state.delivery.time.split(':').map(Number);
  const days = scheduledDays(state.delivery);
  for (let i = 0; i < 8; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, h, m, 0, 0);
    if (d <= now) continue;
    if (!isScheduledDay(localDateStr(d), days)) continue;
    return { at: d, localDate: localDateStr(d), daysAway: i };
  }
  return null;
}

/** "Today", "Tomorrow" or a weekday name, for nextDelivery's result. */
export function describeNext(next) {
  if (!next) return '';
  if (next.daysAway === 0) return 'Today';
  if (next.daysAway === 1) return 'Tomorrow';
  return next.at.toLocaleDateString([], { weekday: 'long' });
}

/**
 * A date the way a letter is dated: "November 14, 2026" in the device's own
 * convention. Takes a full timestamp or a bare 'YYYY-MM-DD'.
 */
export function formatWritten(iso) {
  if (!iso) return '';
  try {
    // A bare date is a calendar day, not an instant. Parsed as it stands it
    // means midnight UTC — the evening BEFORE, anywhere west of Greenwich.
    const d = /^\d{4}-\d{2}-\d{2}$/.test(String(iso)) ? new Date(`${iso}T00:00:00`) : new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

/** "today", "3 days ago", "5 weeks ago" — how long since something was written. */
export function ago(iso, now = new Date()) {
  if (!iso) return '';
  const then = new Date(iso);
  const days = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate())
    - new Date(then.getFullYear(), then.getMonth(), then.getDate())) / 86400000);
  if (!Number.isFinite(days) || days < 0) return '';
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? 'a year ago' : `${years} years ago`;
}

/** The local date string for "now", matching what the server computes. */
export function todayLocalDate(now = new Date()) {
  return localDateStr(now);
}
