import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { scheduledHeading, startsInWords, dateOffsetFromToday } from '../utils/challengeSchedule';
import { formatDateLong, getTodayStr } from '../utils/dateUtils';
import { FutureSelfLetterView } from './FutureSelfLetter';

/**
 * The pre-start state of a SCHEDULED challenge attempt.
 *
 * Rendered wherever the challenge day would normally appear (Home, Today,
 * Challenges) while `challengeStart` is still in the future. It deliberately
 * shows NO day number, no task list and no score — Day 1 does not exist yet.
 *
 * Rescheduling and "Start Now" both go through the context's single scheduling
 * path, so nothing here can start the clock on its own.
 */
export default function ScheduledStartCard({ compact = false, onChangeChallenge = null }) {
  const {
    profile, getChallengeMeta, rescheduleChallenge, startChallengeNow, getDaysUntilStart,
  } = useApp();

  const [editing, setEditing] = useState(false);
  const [dateInput, setDateInput] = useState(profile?.challengeStart || '');
  const [msg, setMsg] = useState('');
  const [showLetter, setShowLetter] = useState(false);

  const meta = getChallengeMeta();
  const start = profile?.challengeStart;
  if (!start) return null;

  const days = getDaysUntilStart();
  const letter = meta?.futureSelfLetter || null;

  function save() {
    if (!dateInput) return;
    if (dateInput < getTodayStr()) {
      setMsg('Pick today or a future date.');
      return;
    }
    rescheduleChallenge(dateInput);
    setEditing(false);
    setMsg(dateInput === getTodayStr()
      ? 'Challenge started — today is Day 1.'
      : `Challenge scheduled for ${formatDateLong(dateInput)}.`);
  }

  return (
    <div className={`scheduled-card${compact ? ' compact' : ''}`}>
      <div className="sched-heading">🗓 {scheduledHeading(start)}</div>
      {meta?.name && (
        <div className="sched-challenge">{meta.emoji ? `${meta.emoji} ` : ''}{meta.name}</div>
      )}
      <div className="sched-day1">Day 1 begins {formatDateLong(start)}</div>
      <div className="sched-countdown">
        {days === 1 ? 'Starts tomorrow' : `Starts in ${days} days`}
      </div>
      <p className="sched-note">
        Your setup is saved. Tasks, XP, streaks, and scoring begin on Day 1 —
        nothing counts against you until then.
      </p>

      {msg && <div className="sched-msg">{msg}</div>}

      {editing ? (
        <div className="sched-edit">
          <input
            type="date"
            className="sched-date-input"
            min={getTodayStr()}
            value={dateInput}
            onChange={e => { setDateInput(e.target.value); setMsg(''); }}
          />
          <div className="sched-edit-quick">
            <button className="btn btn-secondary btn-sm" onClick={() => setDateInput(getTodayStr())}>Today</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setDateInput(dateOffsetFromToday(1))}>Tomorrow</button>
          </div>
          <div className="sched-actions">
            <button className="btn btn-primary" onClick={save}>Save Date</button>
            <button className="btn btn-secondary" onClick={() => { setEditing(false); setDateInput(start); setMsg(''); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="sched-actions">
          <button className="btn btn-secondary" onClick={() => { setEditing(true); setDateInput(start); setMsg(''); }}>
            Change Start Date
          </button>
          <button
            className="btn btn-primary"
            onClick={() => { startChallengeNow(); setMsg('Challenge started — today is Day 1.'); }}
          >
            Start Now
          </button>
        </div>
      )}

      {letter && !editing && (
        <button className="sched-switch" onClick={() => setShowLetter(true)}>
          📖 Read My Why
        </button>
      )}
      {showLetter && <FutureSelfLetterView letter={letter} onClose={() => setShowLetter(false)} />}

      {onChangeChallenge && !editing && (
        <button className="sched-switch" onClick={onChangeChallenge}>
          Choose a different challenge
        </button>
      )}

      <p className="sched-prep">
        Meanwhile you can still edit your My Why, Future Self Letter, tasks and
        challenge settings — {startsInWords(start) === 'tomorrow' ? 'it all carries into tomorrow' : 'it all carries into Day 1'}.
      </p>
    </div>
  );
}
