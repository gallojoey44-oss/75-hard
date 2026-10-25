import { CATEGORY, PERSONAL_BY_ID, shortTaskName } from './reminderPlan';
import { HABIT_KEYS, habitKeyOf } from './habitKeys';
import { getTaskXP, topIncompleteKeystone } from '../utils/gamification';
import { displayXP } from '../utils/xpDisplay';

/**
 * What each reminder actually says.
 *
 * Two kinds of copy, and the difference matters:
 *
 *   payload   Rendered from REAL, CURRENT state — it may say "still open",
 *             "3 tasks left", name a specific habit. Returns null when the
 *             reminder should not fire at all (task already done, day
 *             complete, nothing to log).
 *
 *   fallback  Date-independent. No counts, no completion claims, no day
 *             numbers. The server sends this instead when its snapshot of the
 *             day is stale, so a background reminder can never tell someone
 *             they have three tasks left on information from yesterday.
 *
 * The server never composes either one. It stores what the app rendered and
 * sends it back, which is why it can be specific without inventing anything.
 */

const tagFor = (profileId, id) => `forge-${profileId}-${id}`;

/** True when the day's required work is finished. */
function dayComplete(ctx) {
  const tasks = ctx.tasks || [];
  if (ctx.isMWD) return false;
  if (!tasks.length) return false;
  return tasks.every(t => ctx.dayData?.tasks?.[t.id]);
}

/** Incomplete tasks, keystones first. */
function remaining(ctx) {
  return (ctx.tasks || [])
    .filter(t => !ctx.dayData?.tasks?.[t.id])
    .sort((a, b) => (b.keystone || 0) - (a.keystone || 0));
}

// ── Universal ───────────────────────────────────────────────────────────────

function universalPayload(reminder, ctx) {
  const tag = tagFor(ctx.profileId, reminder.id);
  const left = remaining(ctx);

  switch (reminder.id) {
    case 'u_morning': {
      if (dayComplete(ctx)) return null;
      const top = topIncompleteKeystone(ctx.tasks || [], ctx.dayData) || left[0];
      if (!ctx.challengeActive || !left.length) {
        return {
          title: '⚔️ Daily Mission', tag, view: 'today',
          body: 'Open Forge and set today up while it is still yours.',
        };
      }
      const n = left.length;
      return {
        title: '⚔️ Daily Mission', tag, view: 'today',
        body: top
          ? `${n} ${n === 1 ? 'habit' : 'habits'} today. Start with ${shortTaskName(top)}.`
          : `${n} ${n === 1 ? 'habit' : 'habits'} to go today.`,
      };
    }
    case 'u_evening': {
      if (dayComplete(ctx)) return null;
      const n = left.length;
      if (!n) {
        return {
          title: '🌆 Evening check-in', tag, view: 'today',
          body: 'Take two minutes to look back at the day.',
        };
      }
      const top = left[0];
      return {
        title: '🌆 Evening check-in', tag, view: 'today',
        body: n === 1
          ? `One left: ${shortTaskName(top)}. There is still time.`
          : `${n} habits still open, starting with ${shortTaskName(top)}.`,
      };
    }
    case 'u_dailylog': {
      // Only when a Daily Log is part of the day AND it is genuinely still
      // open. Anything less certain and this does not fire.
      const logTask = (ctx.tasks || []).find(t => habitKeyOf(t) === HABIT_KEYS.DAILY_LOG);
      if (!logTask) return null;
      if (ctx.dayData?.tasks?.[logTask.id]) return null;
      return {
        title: '📊 Daily Log', tag, view: 'today',
        body: `Log how today went — one rating is enough. +${displayXP(getTaskXP(logTask), ctx.xpScale).toLocaleString()} XP.`,
      };
    }
    case 'u_encouragement': {
      if (dayComplete(ctx)) {
        return {
          title: '💪 Day closed', tag, view: 'home',
          body: ctx.challengeName
            ? `${ctx.challengeName} — done for today. That is the whole method.`
            : 'Done for today. That is the whole method.',
        };
      }
      return {
        title: '💪 Still yours', tag, view: 'today',
        body: ctx.challengeName && ctx.dayNumber
          ? `Day ${ctx.dayNumber} of ${ctx.challengeName}. Half a day left to spend well.`
          : 'Half the day is still ahead of you.',
      };
    }
    default:
      return null;
  }
}

function universalFallback(reminder) {
  const base = { view: 'today' };
  switch (reminder.id) {
    case 'u_morning':
      return { ...base, title: '⚔️ Daily Mission', body: 'Open Forge and set today up while it is still yours.' };
    case 'u_evening':
      return { ...base, title: '🌆 Evening check-in', body: 'Take a moment to close out the day in Forge.' };
    case 'u_dailylog':
      return { ...base, title: '📊 Daily Log', body: 'Log how today went — one rating is enough.' };
    case 'u_encouragement':
      return { ...base, title: '💪 Forge', body: 'Small things, done repeatedly. Open Forge when you get a moment.' };
    default:
      return null;
  }
}

// ── Challenge ───────────────────────────────────────────────────────────────

function challengePayload(reminder, ctx) {
  const task = reminder.task;
  if (!task) return null;
  // Never remind someone about something they have already done.
  if (ctx.dayData?.tasks?.[task.id]) return null;

  // The attempt's stored XP on the lifetime ladder, so a notification and the
  // task row it is about never quote two different numbers.
  const xp = displayXP(getTaskXP(task), ctx.xpScale).toLocaleString();
  const keystone = (task.keystone || 0) >= 3;
  const name = shortTaskName(task);
  // The target lives in the part of the name after the colon, which is the
  // specific, actionable half: "8+ hours", "2 focused sessions".
  const target = String(task.name || '').includes(':')
    ? String(task.name).split(':').slice(1).join(':').trim()
    : null;

  const body = target
    ? `${target} — still open today. +${xp} XP.`
    : `Still open today. +${xp} XP.`;

  return {
    title: `${task.icon || '⚔️'} ${name}${keystone ? ' · keystone' : ''}`,
    body,
    tag: tagFor(ctx.profileId, reminder.id),
    view: 'today',
  };
}

function challengeFallback(reminder) {
  const task = reminder.task;
  if (!task) return null;
  return {
    title: `${task.icon || '⚔️'} ${shortTaskName(task)}`,
    // No completion claim and no count: true on any day.
    body: 'Time for this one.',
    view: 'today',
  };
}

// ── Personal ────────────────────────────────────────────────────────────────

function personalPayload(reminder, ctx) {
  // A habit the challenge already covers is never delivered twice.
  if (reminder.superseded) return null;
  const def = PERSONAL_BY_ID[reminder.id];
  const body = reminder.custom ? reminder.body : def?.body;
  if (!body) return null;
  return {
    title: `${reminder.icon} ${reminder.label}`,
    // Forge tracks no completion for a personal habit, so this never claims
    // one way or the other.
    body,
    tag: tagFor(ctx.profileId, reminder.id),
    view: 'today',
  };
}

function personalFallback(reminder) {
  if (reminder.superseded) return null;
  const def = PERSONAL_BY_ID[reminder.id];
  const body = reminder.custom ? reminder.body : def?.body;
  if (!body) return null;
  return { title: `${reminder.icon} ${reminder.label}`, body, view: 'today' };
}

// ── Public ──────────────────────────────────────────────────────────────────

/**
 * The live payload for a planned reminder, or null when it should not fire.
 * Null is a real answer: it is how "you already did this" is expressed.
 */
export function reminderPayload(reminder, ctx) {
  switch (reminder.category) {
    case CATEGORY.UNIVERSAL: return universalPayload(reminder, ctx);
    case CATEGORY.CHALLENGE: return challengePayload(reminder, ctx);
    case CATEGORY.PERSONAL:  return personalPayload(reminder, ctx);
    default: return null;
  }
}

/** Date-independent copy, safe to send from a stale server snapshot. */
export function reminderFallbackFor(reminder) {
  const out = (() => {
    switch (reminder.category) {
      case CATEGORY.UNIVERSAL: return universalFallback(reminder);
      case CATEGORY.CHALLENGE: return challengeFallback(reminder);
      case CATEGORY.PERSONAL:  return personalFallback(reminder);
      default: return null;
    }
  })();
  return out ? { ...out, tag: `forge-${reminder.id}` } : null;
}

/**
 * A short preview of what a reminder will say, for the settings screen, so the
 * user can see the actual copy rather than a category name.
 */
export function reminderPreview(reminder, ctx) {
  const live = reminderPayload(reminder, ctx);
  if (live) return live.body;
  const fb = reminderFallbackFor(reminder);
  return fb ? fb.body : null;
}
