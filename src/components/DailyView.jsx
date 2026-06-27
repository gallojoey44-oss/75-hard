import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { formatDateLong, getDateForDayNumber } from '../utils/dateUtils';
import CheckItem from './CheckItem';
import MentalTraining from './MentalTraining';
import FaithReflection from './FaithReflection';
import RatingSlider from './RatingSlider';

const TASK_COLORS = ['#FF6B6B','#4ECDC4','#74B9FF','#6BCB77','#FFB347','#DDA0DD','#F9E04B','#FF8FAB','#A8E6CF','#FFA07A'];

function GfTaskCard({ task, checked, onToggle, index }) {
  const color = task.color || TASK_COLORS[index % TASK_COLORS.length];
  return (
    <div className={`gf-task-card${checked ? ' done-card' : ''}`}>
      <div className="gf-task-top" style={{ background: color }} />
      <div className="gf-task-body">
        <div className="gf-task-num" style={{ background: color + 'CC' }}>
          {index + 1}
        </div>
        <span className={`gf-task-name${checked ? ' done' : ''}`}>{task.name}</span>
        <button
          className={`gf-task-check${checked ? ' done' : ''}`}
          style={checked ? {} : { borderColor: color + '80' }}
          onClick={onToggle}
          aria-label={checked ? 'Uncheck' : 'Check'}
        >
          {checked ? '✓' : ''}
        </button>
      </div>
    </div>
  );
}

export default function DailyView({ editDayNum, onBack, setView }) {
  const {
    activeProfile, profile,
    getDayNumber, getDayData, getTodayData,
    updateDay, toggleTask,
  } = useApp();

  const isEditing = editDayNum != null;
  const dayNum = isEditing ? editDayNum : getDayNumber();

  const [dayData, setDayData] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [prevPct, setPrevPct] = useState(0);

  useEffect(() => {
    if (!dayNum) return;
    const data = isEditing
      ? (getDayData(dayNum) || {
          date: getDateForDayNumber(profile?.challengeStart, dayNum),
          dayNumber: dayNum,
          tasks: {}, mentalTraining: { selected: null, completed: false, notes: '' },
          mood: 0, confidence: 0, sleep: 0, energy: 0,
          recovery: 0, workoutEffort: 0, stress: 0,
          notes: '', glucoseNotes: '', validated: false,
        })
      : getTodayData();
    setDayData(data);
    setPrevPct(calcPct(data));
  }, [dayNum, activeProfile]);

  function calcPct(data) {
    if (!data || !profile) return 0;
    const tasks = profile.tasks || [];
    if (!tasks.length) return 0;
    const done        = tasks.filter(t => data.tasks?.[t.id]).length;
    const faithEnabled  = profile?.faithEnabled;
    const faithCounts   = profile?.faithCountsToward;
    const faithComplete = data.faithReflection?.completed;
    const extra     = (faithEnabled && faithCounts) ? 1 : 0;
    const extraDone = (faithEnabled && faithCounts && faithComplete) ? 1 : 0;
    return Math.round(((done + extraDone) / (tasks.length + extra)) * 100);
  }

  function handleUpdate(updates) {
    if (!dayNum) return;
    const merged = { ...dayData, ...updates };
    if (updates.tasks)          merged.tasks          = { ...dayData?.tasks,          ...updates.tasks };
    if (updates.mentalTraining) merged.mentalTraining = { ...dayData?.mentalTraining, ...updates.mentalTraining };
    if (updates.faithReflection) merged.faithReflection = { ...dayData?.faithReflection, ...updates.faithReflection };
    setDayData(merged);
    updateDay(dayNum, merged);

    const newPct = calcPct(merged);
    if (newPct === 100 && prevPct < 100) setShowCelebration(true);
    setPrevPct(newPct);
  }

  function handleToggleTask(taskId) {
    const newTasks = { ...dayData?.tasks, [taskId]: !dayData?.tasks?.[taskId] };
    const merged = { ...dayData, tasks: newTasks };
    setDayData(merged);
    toggleTask(dayNum, taskId);

    const newPct = calcPct(merged);
    if (newPct === 100 && prevPct < 100) setShowCelebration(true);
    setPrevPct(newPct);
  }

  function handleValidate() {
    handleUpdate({ validated: !dayData?.validated });
  }

  if (!dayNum || !profile) {
    return (
      <div className="daily-view">
        <div className="start-challenge" style={{ paddingTop: 60 }}>
          <div className="start-challenge-emoji">📅</div>
          <h2>No Active Challenge</h2>
          <p>Go to Home and start your challenge first.</p>
        </div>
      </div>
    );
  }

  const pct     = calcPct(dayData);
  const tasks   = [...(profile.tasks || [])].sort((a, b) => a.order - b.order);
  const dateStr = dayData?.date || getDateForDayNumber(profile?.challengeStart, dayNum);
  const isMe    = activeProfile === 'me';

  // The task ID used by MentalTraining to auto-check when marking complete
  const mentalTaskId = isMe ? 'mental' : 'gf_mental';

  const faithEnabled   = profile?.faithEnabled || false;
  const faithCounts    = profile?.faithCountsToward || false;

  return (
    <div className="daily-view">
      {isEditing && onBack && (
        <div className="edit-mode-banner">
          <span>✏️ Editing Day {dayNum}</span>
          <button
            className="btn btn-ghost"
            style={{ padding: '4px 10px', fontSize: 13 }}
            onClick={onBack}
          >
            Done
          </button>
        </div>
      )}

      <div className="daily-header">
        <div className="daily-header-left">
          <h2>{formatDateLong(dateStr)}</h2>
          <p>{isEditing ? 'Editing past day' : 'Log your day'}</p>
        </div>
        <span className="daily-day-badge">Day {dayNum}</span>
      </div>

      {/* Progress bar */}
      <div className="section-card">
        <div className="prog-bar-wrap">
          <div className="prog-bar-label">
            <span>Today's progress</span>
            <span>{tasks.filter(t => dayData?.tasks?.[t.id]).length}/{tasks.length} tasks</span>
          </div>
          <div className="prog-bar-track">
            <div
              className={`prog-bar-fill${pct === 100 ? ' success' : ''}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Joey: standard checklist ── */}
      {isMe && (
        <div className="section-card">
          <div className="section-title" style={{ justifyContent: 'space-between' }}>
            <span>✅ Daily Tasks</span>
            {setView && (
              <button
                className="manage-tasks-link"
                onClick={() => setView('settings')}
              >
                ✏️ Manage Tasks
              </button>
            )}
          </div>
          {tasks.map(task => (
            <CheckItem
              key={task.id}
              task={task}
              checked={!!dayData?.tasks?.[task.id]}
              onToggle={() => handleToggleTask(task.id)}
            />
          ))}
        </div>
      )}

      {/* ── Joey: mental training ── */}
      {isMe && (
        <MentalTraining
          dayNumber={dayNum}
          dayData={dayData}
          onUpdate={handleUpdate}
          mentalTaskId={mentalTaskId}
        />
      )}

      {/* ── Joey: faith reflection (optional) ── */}
      {isMe && faithEnabled && (
        <FaithReflection
          dayNumber={dayNum}
          dayData={dayData}
          onUpdate={handleUpdate}
          countsToward={faithCounts}
        />
      )}

      {/* ── Girlfriend: colored task cards ── */}
      {!isMe && (
        <>
          {setView && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
              <button
                className="manage-tasks-link"
                onClick={() => setView('settings')}
              >
                ✏️ Manage Tasks
              </button>
            </div>
          )}

          <div className="gf-tasks">
            {tasks.map((task, i) => (
              <GfTaskCard
                key={task.id}
                task={task}
                index={i}
                checked={!!dayData?.tasks?.[task.id]}
                onToggle={() => handleToggleTask(task.id)}
              />
            ))}
          </div>

          {/* Girlfriend mental training section */}
          <MentalTraining
            dayNumber={dayNum}
            dayData={dayData}
            onUpdate={handleUpdate}
            mentalTaskId={mentalTaskId}
          />

          {/* Girlfriend: faith reflection (optional) */}
          {faithEnabled && (
            <FaithReflection
              dayNumber={dayNum}
              dayData={dayData}
              onUpdate={handleUpdate}
              countsToward={faithCounts}
            />
          )}

          {/* Validate Day */}
          <div className="validate-btn-wrap">
            {dayData?.validated ? (
              <div className="validated-badge">
                🎉 Day {dayNum} Validated!
                <button
                  className="btn btn-ghost"
                  style={{ marginLeft: 'auto', padding: '4px 12px', fontSize: 13 }}
                  onClick={handleValidate}
                >
                  Undo
                </button>
              </div>
            ) : (
              <button
                className="btn btn-success btn-full"
                onClick={handleValidate}
                style={{ opacity: pct === 100 ? 1 : 0.5 }}
              >
                ✓ Validate Day
              </button>
            )}
          </div>
        </>
      )}

      {/* Daily Log — both profiles */}
      <div className="section-card">
        <div className="section-title">📓 Daily Log</div>
        <textarea
          className="log-textarea"
          rows={3}
          placeholder="How did today go? Any notes…"
          value={dayData?.notes || ''}
          onChange={e => handleUpdate({ notes: e.target.value })}
        />

        <RatingSlider
          label="Mood" emoji="😊"
          value={dayData?.mood || 0}
          onChange={v => handleUpdate({ mood: v })}
        />
        <RatingSlider
          label="Confidence" emoji="💪"
          value={dayData?.confidence || 0}
          onChange={v => handleUpdate({ confidence: v })}
        />
        <RatingSlider
          label="Sleep Quality" emoji="😴"
          value={dayData?.sleep || 0}
          onChange={v => handleUpdate({ sleep: v })}
        />
        <RatingSlider
          label="Energy" emoji="⚡"
          value={dayData?.energy || 0}
          onChange={v => handleUpdate({ energy: v })}
        />
        <RatingSlider
          label="Recovery / Soreness" emoji="🔋"
          value={dayData?.recovery || 0}
          onChange={v => handleUpdate({ recovery: v })}
          hint="1 = very sore · 10 = fully recovered"
        />
        <RatingSlider
          label="Workout Effort" emoji="🏋️"
          value={dayData?.workoutEffort || 0}
          onChange={v => handleUpdate({ workoutEffort: v })}
          hint="1 = very easy · 10 = extremely hard"
        />
        <RatingSlider
          label="Stress" emoji="🌡️"
          value={dayData?.stress || 0}
          onChange={v => handleUpdate({ stress: v })}
          hint="1 = very calm · 10 = very stressed"
        />

        {/* Glucose/Dexcom — Joey only */}
        {isMe && (
          <div style={{ marginTop: 8 }}>
            <div className="section-title" style={{ marginBottom: 8 }}>📊 Glucose / Dexcom Notes</div>
            <textarea
              className="log-textarea"
              rows={2}
              style={{ marginBottom: 0 }}
              placeholder="Blood sugar readings, Dexcom trends…"
              value={dayData?.glucoseNotes || ''}
              onChange={e => handleUpdate({ glucoseNotes: e.target.value })}
            />
          </div>
        )}
      </div>

      {/* Celebration modal */}
      {showCelebration && (
        <div className="celebration-overlay" onClick={() => setShowCelebration(false)}>
          <div className="celebration-card" onClick={e => e.stopPropagation()}>
            <div className="celebration-emoji">🎉</div>
            <h2>Day {dayNum} Complete!</h2>
            <p>Every task done. You're building something real — keep going!</p>
            <button className="btn btn-primary btn-full" onClick={() => setShowCelebration(false)}>
              Let's go! 💪
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
