/**
 * The optional training timer, as plain functions of time.
 *
 * It counts from timestamps rather than ticks, so a phone that locks, a tab
 * that is backgrounded or a timer callback that is throttled can never make
 * it drift: whatever the screen last drew, the next draw computes the true
 * elapsed time from `Date.now()`.
 *
 * Nothing reads the timer to decide anything. It never completes the habit,
 * never awards XP, and is not required — finishing a session is always the
 * person's own confirmation, with or without it.
 */

export const IDLE_TIMER = Object.freeze({ running: false, startedAt: null, accumulatedMs: 0 });

/** Start, or resume after a pause. */
export function startTimer(state, now = Date.now()) {
  if (state?.running) return state;
  return { running: true, startedAt: now, accumulatedMs: state?.accumulatedMs || 0 };
}

/** Pause, banking the time run so far. */
export function pauseTimer(state, now = Date.now()) {
  if (!state?.running) return state || IDLE_TIMER;
  return { running: false, startedAt: null, accumulatedMs: elapsedMs(state, now) };
}

/** Back to zero. */
export function resetTimer() {
  return IDLE_TIMER;
}

/** Time run so far, in milliseconds. A clock set backwards never makes it negative. */
export function elapsedMs(state, now = Date.now()) {
  if (!state) return 0;
  const banked = Math.max(0, Number(state.accumulatedMs) || 0);
  if (!state.running || state.startedAt == null) return banked;
  return banked + Math.max(0, now - state.startedAt);
}

/** Time left to the target, never below zero. */
export function remainingMs(state, targetMs, now = Date.now()) {
  return Math.max(0, targetMs - elapsedMs(state, now));
}

/** Whether the target has been reached. */
export function timerFinished(state, targetMs, now = Date.now()) {
  return targetMs > 0 && elapsedMs(state, now) >= targetMs;
}

/**
 * "20:00", "4:05", "0:00". Rounded UP, so a countdown shows "0:01" for its
 * final second rather than reading zero while time remains.
 */
export function formatClock(ms) {
  const total = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Whole minutes run so far, for the confirmation's honesty note. */
export function minutesRun(state, now = Date.now()) {
  return Math.floor(elapsedMs(state, now) / 60000);
}
