import { useEffect, useRef, useState } from 'react';
import TrainingScene from './TrainingScene';
import { getPractice, overlappingTasks, separateHabits, TRAINING_DESC } from '../../data/mentalPractices';
import {
  IDLE_TIMER, startTimer, pauseTimer, resetTimer, elapsedMs, remainingMs, timerFinished,
  formatClock, minutesRun,
} from '../../utils/sessionTimer';

/**
 * Mental Training — the place the habit is actually done.
 *
 * Today's row still ticks the habit directly, exactly as every other row
 * does. This is the other way in: choose one of the six practices, read a
 * handful of steps, do it, come back and confirm. Confirming is the ONLY
 * thing here that changes anything, and it changes exactly one checkbox —
 * the Mental Training habit's, through the same day update the row uses — so
 * there is one completion and one reward however the habit is reached.
 *
 * What does not count, by construction rather than by care:
 *   • opening this screen, choosing a practice, reading it, or starting,
 *     pausing or finishing the timer — none of them call anything outside
 *     this component;
 *   • a second session on a day already ticked — the parent never sets a
 *     checkbox that is already set, so it cannot pay twice;
 *   • any other habit — the parent is handed one habit id and writes no other.
 *
 * Nothing typed is stored, because nothing can be typed: the practice id is
 * the only thing recorded about a session.
 */

/** "A, B and C" */
function joinNames(names) {
  if (names.length <= 1) return names[0] || '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** A habit's name without its length or count suffix: "Short Physical Reset". */
function shortName(task) {
  return String(task?.name || '').split(' — ')[0];
}

/**
 * The row's way in. A separate button below the habit — never inside the
 * checkbox row — so opening training can never tick, untick or otherwise
 * interfere with the row a person taps to complete the habit.
 */
export function TrainingLauncher({ done, practiceId, onOpen }) {
  const practice = practiceId ? getPractice(practiceId) : null;
  return (
    <button
      type="button"
      className={`mt-launch${done ? ' done' : ''}`}
      onClick={onOpen}
      data-testid="begin-training"
    >
      <span className="mt-launch-icon" aria-hidden="true">{done ? '✓' : '▶'}</span>
      <span className="mt-launch-text">
        <span className="mt-launch-title">{done ? 'Trained today' : 'Begin Training'}</span>
        <span className="mt-launch-sub">
          {done
            ? (practice ? `${practice.name} · ${practice.subtitle}` : 'Practise again any time — no extra XP')
            : 'Six practices · choose one for today'}
        </span>
      </span>
      <span className="mt-launch-go" aria-hidden="true">{done ? 'Open' : '›'}</span>
    </button>
  );
}

function TimerControls({ timer, targetMs, now, minutes, onStart, onPause, onReset }) {
  const finished = timerFinished(timer, targetMs, now);
  const used = elapsedMs(timer, now) > 0;
  if (finished) {
    return (
      <div className="mtx-timer finished" data-testid="timer" data-state="finished">
        <span className="mtx-clock" aria-live="polite">✓ {minutes}:00</span>
        <span className="mtx-timer-note">Time’s up</span>
        <button type="button" className="mtx-timer-btn ghost" onClick={onReset} aria-label="Reset timer">↺</button>
      </div>
    );
  }
  if (timer.running) {
    return (
      <div className="mtx-timer running" data-testid="timer" data-state="running">
        <button type="button" className="mtx-timer-btn" onClick={onPause} aria-label="Pause timer">❚❚</button>
        <span className="mtx-clock" role="timer">{formatClock(remainingMs(timer, targetMs, now))}</span>
        <span className="mtx-timer-note">left</span>
      </div>
    );
  }
  if (used) {
    return (
      <div className="mtx-timer paused" data-testid="timer" data-state="paused">
        <button type="button" className="mtx-timer-btn" onClick={onStart} aria-label="Resume timer">▶</button>
        <span className="mtx-clock">{formatClock(remainingMs(timer, targetMs, now))}</span>
        <span className="mtx-timer-note">paused</span>
        <button type="button" className="mtx-timer-btn ghost" onClick={onReset} aria-label="Reset timer">↺</button>
      </div>
    );
  }
  return (
    <div className="mtx-timer idle" data-testid="timer" data-state="idle">
      <button type="button" className="mtx-timer-start" onClick={onStart}>
        <span aria-hidden="true">▶</span> Start a {minutes}-minute timer
      </button>
      <span className="mtx-timer-note">Optional</span>
    </div>
  );
}

export default function MentalTrainingSpace({
  minutes, practices, task, xp = null, done = false, practiceToday = null,
  dayTasks = [], dayProgress = null, onRecord, onClose,
}) {
  const [practiceId, setPracticeId] = useState(null);
  const [view, setView] = useState('choose');          // choose → session → done
  const [confirming, setConfirming] = useState(false);
  const [timer, setTimer] = useState(IDLE_TIMER);
  const [now, setNow] = useState(() => Date.now());
  const [result, setResult] = useState(null);
  const rootRef = useRef(null);
  const sheetRef = useRef(null);

  const practice = practiceId ? (practices.find(p => p.id === practiceId) || getPractice(practiceId)) : null;
  const targetMs = minutes * 60000;

  // The clock is redrawn once a second while it runs, and immediately on
  // returning to the app; the time itself always comes from timestamps.
  useEffect(() => {
    if (!timer.running) return undefined;
    const tick = () => setNow(Date.now());
    const iv = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', tick); };
  }, [timer.running]);

  // Reaching the target stops the timer there. It records nothing.
  useEffect(() => {
    if (timer.running && timerFinished(timer, targetMs, now)) {
      setTimer({ running: false, startedAt: null, accumulatedMs: targetMs });
    }
  }, [timer, targetMs, now]);

  // Each screen starts at its top, with focus on the dialog rather than on a
  // control inside it.
  useEffect(() => {
    rootRef.current?.focus();
    rootRef.current?.scrollTo?.(0, 0);
  }, [view, practiceId]);

  // The question takes focus when it opens, so it is announced and Tab moves
  // through its two answers — without either being pre-selected.
  useEffect(() => {
    if (confirming) sheetRef.current?.focus();
  }, [confirming]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (confirming) setConfirming(false);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirming, onClose]);

  function choose(id) {
    setPracticeId(id);
    setTimer(IDLE_TIMER);
    setNow(Date.now());
    setView('session');
  }

  function backToPractices() {
    setConfirming(false);
    setTimer(IDLE_TIMER);
    setView('choose');
  }

  function record() {
    if (!practice) return;
    const outcome = onRecord?.(practice.id) || {};
    setTimer(t => pauseTimer(t));
    setConfirming(false);
    setResult({ awarded: outcome.awarded === true, practiceId: practice.id });
    setView('done');
  }

  const separate = separateHabits(dayTasks);
  const overlaps = practice ? overlappingTasks(practice, dayTasks) : [];
  const timerUsed = elapsedMs(timer, now) > 0;
  const timerShort = timerUsed && !timerFinished(timer, targetMs, now);
  const todaysPractice = practiceToday ? getPractice(practiceToday) : null;

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className={`mtx${view === 'session' ? ' in-session' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Mental Training"
      data-testid="mental-training"
      data-view={view}
    >
      <header className="mtx-head">
        {view === 'session' ? (
          <button type="button" className="mtx-back" onClick={backToPractices}>
            <span aria-hidden="true">‹</span> Practices
          </button>
        ) : <span className="mtx-head-title">Mental Training</span>}
        <button type="button" className="mtx-close" onClick={onClose} aria-label="Close Mental Training">✕</button>
      </header>

      {view === 'choose' && (
        <div className="mtx-body" data-testid="training-choose">
          <div className="mtx-kicker">Begin Training</div>
          <h2 className="mtx-title">{task?.name}</h2>
          <p className="mtx-lead">{TRAINING_DESC}</p>

          {done && (
            <div className="mtx-note done" data-testid="training-already-done">
              <strong>✓ Today’s training is recorded{todaysPractice ? ` — ${todaysPractice.name}` : ''}.</strong>
              {' '}Practise again if you like; it won’t add XP.
            </div>
          )}

          <ul className="mtx-practices">
            {practices.map(p => (
              <li key={p.id}>
                <button
                  type="button"
                  className="mtx-practice"
                  onClick={() => choose(p.id)}
                  data-practice={p.id}
                >
                  <span className="mtx-thumb"><TrainingScene scene={p.scene} still /></span>
                  <span className="mtx-practice-text">
                    <span className="mtx-practice-top">
                      <span className="mtx-practice-name">{p.name}</span>
                      {p.deviceFree && <span className="mtx-badge">Phone-free</span>}
                    </span>
                    <span className="mtx-practice-sub">{p.subtitle}</span>
                    <span className="mtx-practice-pitch">{p.pitch}</span>
                  </span>
                  <span className="mtx-practice-go" aria-hidden="true">›</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="mtx-rule" data-testid="training-rule">
            <strong>One practice, one habit.</strong> Your {minutes} minutes count for Mental Training
            only{separate.length
              ? ` — ${joinNames(separate.map(shortName))} ${separate.length === 1 ? 'is' : 'are'} still done separately`
              : ''}. Nothing else is ticked for you.
          </div>
          <p className="mtx-aside">
            Already trained away from your phone? Choose the practice you did, then record it.
          </p>
        </div>
      )}

      {view === 'session' && practice && (
        <div className="mtx-body session" data-testid="training-session" data-practice={practice.id}>
          <div className="mtx-hero">
            <TrainingScene scene={practice.scene} />
            <div className="mtx-hero-text">
              <h2 className="mtx-hero-name">{practice.name}</h2>
              <div className="mtx-hero-sub">{practice.subtitle}</div>
            </div>
          </div>

          <div className="mtx-chips">
            <span className="mtx-chip">{minutes} minutes · your daily target</span>
            {practice.deviceFree && <span className="mtx-chip phone">Phone-free</span>}
          </div>
          <p className="mtx-develops"><span className="mtx-label">Develops</span> {practice.develops}</p>

          {practice.deviceFree && (
            <div className="mtx-away" data-testid="phone-away">
              <div className="mtx-away-h">Read, then put your phone away</div>
              <p className="mtx-away-p">
                Do this one without your phone. Come back when you have finished and record it here —
                no timer needed. A watch or kitchen timer works if you want one.
              </p>
            </div>
          )}

          <section className="mtx-sec">
            <h3 className="mtx-sec-h">How to do it</h3>
            <ol className="mtx-steps">
              {practice.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </section>

          {practice.prompts?.length > 0 && (
            <section className="mtx-sec">
              <h3 className="mtx-sec-h">{practice.promptsTitle || 'Prompts'}</h3>
              <ul className="mtx-prompts">
                {practice.prompts.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </section>
          )}

          {practice.examples?.length > 0 && (
            <section className="mtx-sec">
              <h3 className="mtx-sec-h">{practice.promptsTitle || 'Examples'}</h3>
              <ul className="mtx-examples">
                {practice.examples.map((x, i) => (
                  <li key={i}><span className="mtx-ex-label">{x.label}</span> {x.text}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="mtx-sec mtx-split">
            <div>
              <h3 className="mtx-sec-h yes">Counts</h3>
              <ul className="mtx-list yes">{practice.counts.map((c, i) => <li key={i}>{c}</li>)}</ul>
            </div>
            <div>
              <h3 className="mtx-sec-h no">Doesn’t count</h3>
              <ul className="mtx-list no">{practice.doesntCount.map((c, i) => <li key={i}>{c}</li>)}</ul>
            </div>
          </section>

          {overlaps.length > 0 && (
            <p className="mtx-overlap" data-testid="training-overlap">
              This doesn’t also count as {joinNames(overlaps.map(t => `“${shortName(t)}”`))} —{' '}
              {overlaps.length === 1 ? 'that is still its own habit' : 'those are still their own habits'}.
            </p>
          )}
          {practice.tip && <p className="mtx-tip">{practice.tip}</p>}
        </div>
      )}

      {view === 'session' && practice && (
        <div className="mtx-bar">
          <TimerControls
            timer={timer}
            targetMs={targetMs}
            now={now}
            minutes={minutes}
            onStart={() => { const t = Date.now(); setNow(t); setTimer(s => startTimer(s, t)); }}
            onPause={() => { const t = Date.now(); setNow(t); setTimer(s => pauseTimer(s, t)); }}
            onReset={() => setTimer(resetTimer())}
          />
          <button
            type="button"
            className="mtx-primary"
            onClick={() => { setNow(Date.now()); setConfirming(true); }}
            data-testid="training-finish"
          >
            {done ? 'Finish session' : 'I’ve finished — record it'}
          </button>
        </div>
      )}

      {confirming && practice && (
        <div className="mtx-sheet-wrap" onClick={() => setConfirming(false)}>
          <div
            ref={sheetRef}
            tabIndex={-1}
            className="mtx-sheet"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="mtx-sheet-h"
            onClick={e => e.stopPropagation()}
            data-testid="training-confirm"
          >
            {done ? (
              <>
                <h3 id="mtx-sheet-h" className="mtx-sheet-h">Today’s training is already recorded</h3>
                <p className="mtx-sheet-p">
                  Practising again is worthwhile — it just doesn’t add XP. Mental Training counts once a day.
                </p>
                <button type="button" className="mtx-primary" onClick={record} data-testid="training-confirm-yes">
                  Finish session
                </button>
                <button type="button" className="mtx-ghost" onClick={() => setConfirming(false)}>Keep going</button>
              </>
            ) : (
              <>
                <h3 id="mtx-sheet-h" className="mtx-sheet-h">Record today’s Mental Training?</h3>
                <p className="mtx-sheet-p">
                  Confirm you spent {minutes} minutes on <strong>{practice.name}</strong> — {practice.subtitle.toLowerCase()},
                  with your attention on the practice.
                </p>
                {timerShort && (
                  <p className="mtx-sheet-note" data-testid="training-timer-short">
                    Your timer ran {minutesRun(timer, now)} of {minutes} minutes. Record it once you have done
                    the full {minutes}.
                  </p>
                )}
                <button type="button" className="mtx-primary" onClick={record} data-testid="training-confirm-yes">
                  Yes, record it{typeof xp === 'number' ? ` · +${xp.toLocaleString()} XP` : ''}
                </button>
                <button type="button" className="mtx-ghost" onClick={() => setConfirming(false)}>Not yet</button>
              </>
            )}
          </div>
        </div>
      )}

      {view === 'done' && result && (
        <div className="mtx-body done" data-testid="training-done" data-awarded={result.awarded ? 'yes' : 'no'}>
          <div className="mtx-done-scene">
            <TrainingScene scene={getPractice(result.practiceId)?.scene} />
            <span className="mtx-done-mark" aria-hidden="true">✓</span>
          </div>
          {result.awarded ? (
            <>
              <h2 className="mtx-done-h">Mental Training complete</h2>
              {typeof xp === 'number' && (
                <div className="mtx-xp" data-testid="training-xp">+{xp.toLocaleString()} XP</div>
              )}
              <p className="mtx-done-p">{getPractice(result.practiceId)?.name} · {minutes} minutes</p>
              {dayProgress && (
                <p className="mtx-done-progress" data-testid="training-progress">
                  Today: {dayProgress.done} of {dayProgress.total} habits done
                </p>
              )}
            </>
          ) : (
            <>
              <h2 className="mtx-done-h">Session finished</h2>
              <p className="mtx-done-p">Today’s Mental Training was already counted, so no XP was added.</p>
            </>
          )}
          <button type="button" className="mtx-primary" onClick={onClose} data-testid="training-back">
            Back to Today
          </button>
        </div>
      )}
    </div>
  );
}
