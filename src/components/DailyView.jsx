import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { formatDateLong, getDateForDayNumber } from '../utils/dateUtils';
import CheckItem from './CheckItem';
import MentalTraining from './MentalTraining';
import FaithReflection from './FaithReflection';
import RatingSlider from './RatingSlider';
import BuildBanner from './BuildBanner';

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

function DaySelector({ selected, current, onChange }) {
  const isOtherDay = current && selected !== current;
  return (
    <div className="day-selector">
      <button
        className="day-sel-btn"
        onClick={() => onChange(Math.max(1, selected - 1))}
        disabled={selected <= 1}
        aria-label="Previous day"
      >‹</button>
      <div className="day-sel-center">
        <span className="day-sel-num">
          Day {selected} <span className="day-sel-of">of 75</span>
        </span>
        {isOtherDay && (
          <button className="day-sel-today-link" onClick={() => onChange(current)}>
            → Back to Day {current}
          </button>
        )}
      </div>
      <button
        className="day-sel-btn"
        onClick={() => onChange(Math.min(75, selected + 1))}
        disabled={selected >= 75}
        aria-label="Next day"
      >›</button>
    </div>
  );
}

export default function DailyView({ editDayNum, setView }) {
  const {
    activeProfile, profile,
    getDayNumber, getDayData,
    updateDay, toggleTask,
  } = useApp();

  const currentDayNum = getDayNumber();

  const [selectedDayNum, setSelectedDayNum] = useState(
    editDayNum != null ? editDayNum : (currentDayNum || 1)
  );
  const [dayData, setDayData] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [prevPct, setPrevPct] = useState(0);

  // Sync when Calendar passes a specific day to edit
  useEffect(() => {
    if (editDayNum != null) setSelectedDayNum(editDayNum);
  }, [editDayNum]);

  // Reset to current day when active profile changes
  useEffect(() => {
    const n = editDayNum != null ? editDayNum : (getDayNumber() || 1);
    setSelectedDayNum(n);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfile]);

  // Load day data whenever selected day or profile changes
  useEffect(() => {
    if (!selectedDayNum) return;
    const data = getDayData(selectedDayNum) || {
      date: getDateForDayNumber(profile?.challengeStart, selectedDayNum),
      dayNumber: selectedDayNum,
      tasks: {},
      mentalTraining: { selected: null, completed: false, notes: '' },
      mood: 0, confidence: 0, sleep: 0, energy: 0,
      recovery: 0, workoutEffort: 0, stress: 0,
      notes: '', glucoseNotes: '', validated: false,
    };
    setDayData(data);
    setPrevPct(calcPct(data));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDayNum, activeProfile]);

  function calcPct(data) {
    if (!data || !profile) return 0;
    const tasks = profile.tasks || [];
    if (!tasks.length) return 0;
    const done           = tasks.filter(t => data.tasks?.[t.id]).length;
    const faithEnabled   = profile?.faithEnabled;
    const faithCounts    = profile?.faithCountsToward;
    const faithComplete  = data.faithReflection?.completed;
    const extra     = (faithEnabled && faithCounts) ? 1 : 0;
    const extraDone = (faithEnabled && faithCounts && faithComplete) ? 1 : 0;
    return Math.round(((done + extraDone) / (tasks.length + extra)) * 100);
  }

  function handleUpdate(updates) {
    if (!selectedDayNum) return;
    const merged = { ...dayData, ...updates };
    if (updates.tasks)           merged.tasks           = { ...dayData?.tasks,           ...updates.tasks };
    if (updates.mentalTraining)  merged.mentalTraining  = { ...dayData?.mentalTraining,  ...updates.mentalTraining };
    if (updates.faithReflection) merged.faithReflection = { ...dayData?.faithReflection, ...updates.faithReflection };
    setDayData(merged);
    updateDay(selectedDayNum, merged);

    const newPct = calcPct(merged);
    if (newPct === 100 && prevPct < 100) setShowCelebration(true);
    setPrevPct(newPct);
  }

  function handleToggleTask(taskId) {
    const newTasks = { ...dayData?.tasks, [taskId]: !dayData?.tasks?.[taskId] };
    const merged = { ...dayData, tasks: newTasks };
    setDayData(merged);
    toggleTask(selectedDayNum, taskId);

    const newPct = calcPct(merged);
    if (newPct === 100 && prevPct < 100) setShowCelebration(true);
    setPrevPct(newPct);
  }

  function handleValidate() {
    handleUpdate({ validated: !dayData?.validated });
  }

  if (!profile?.challengeStart) {
    return (
      <div className="daily-view">
        <BuildBanner />
        <div className="start-challenge" style={{ paddingTop: 60 }}>
          <div className="start-challenge-emoji">📅</div>
          <h2>No Active Challenge</h2>
          <p>Go to Home and start your challenge first.</p>
        </div>
      </div>
    );
  }

  const isEditingOtherDay = currentDayNum && selectedDayNum !== currentDayNum;
  const pct     = calcPct(dayData);
  const tasks   = [...(profile.tasks || [])].sort((a, b) => a.order - b.order);
  const dateStr = dayData?.date || getDateForDayNumber(profile?.challengeStart, selectedDayNum);
  const isMe    = activeProfile === 'me';

  const mentalTaskId = isMe ? 'mental' : 'gf_mental';
  const faithEnabled = profile?.faithEnabled || false;
  const faithCounts  = profile?.faithCountsToward || false;

  return (
    <div className="daily-view">
      <BuildBanner />

      {/* Day Selector */}
      <DaySelector
        selected={selectedDayNum}
        current={currentDayNum}
        onChange={setSelectedDayNum}
      />

      <div className="daily-header">
        <div className="daily-header-left">
          <h2>{formatDateLong(dateStr)}</h2>
          <div className="daily-header-meta">
            {currentDayNum && selectedDayNum < currentDayNum ? (
              <>
                <span className="edit-other-label">✏️ Editing past day</span>
                <span className="logged-late-badge">Logged late</span>
              </>
            ) : selectedDayNum > (currentDayNum || 0) ? (
              <span className="edit-other-label">📋 Planning ahead</span>
            ) : (
              <span className="text-muted-sm">Log your day</span>
            )}
          </div>
        </div>
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
          dayNumber={selectedDayNum}
          dayData={dayData}
          onUpdate={handleUpdate}
          mentalTaskId={mentalTaskId}
        />
      )}

      {/* ── Joey: faith reflection (optional) ── */}
      {isMe && faithEnabled && (
        <FaithReflection
          dayNumber={selectedDayNum}
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
            dayNumber={selectedDayNum}
            dayData={dayData}
            onUpdate={handleUpdate}
            mentalTaskId={mentalTaskId}
          />

          {/* Girlfriend: faith reflection (optional) */}
          {faithEnabled && (
            <FaithReflection
              dayNumber={selectedDayNum}
              dayData={dayData}
              onUpdate={handleUpdate}
              countsToward={faithCounts}
            />
          )}

          {/* Validate Day */}
          <div className="validate-btn-wrap">
            {dayData?.validated ? (
              <div className="validated-badge">
                🎉 Day {selectedDayNum} Validated!
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
        <div className="sleep-hours-row">
          <div style={{ flex: 1 }}>
            <div className="sleep-hours-label">😴 Hours Slept</div>
            {profile?.sleepAutoComplete !== false && (
              <div className="sleep-target-hint">≥ {profile?.sleepTarget ?? 8}h auto-completes sleep task</div>
            )}
          </div>
          <input
            type="number"
            className="sleep-hours-input"
            value={dayData?.hoursSlept || ''}
            min={0}
            max={16}
            step={0.5}
            placeholder="0"
            onChange={e => {
              const hrs = parseFloat(e.target.value) || 0;
              const updates = { hoursSlept: hrs };
              const target = profile?.sleepTarget ?? 8;
              const autoComplete = profile?.sleepAutoComplete !== false;
              const sleepTaskId = activeProfile === 'me' ? 'sleep_target' : 'gf_sleep_target';
              if (autoComplete) {
                updates.tasks = { ...dayData?.tasks, [sleepTaskId]: hrs >= target };
              }
              handleUpdate(updates);
            }}
          />
          <span className="sleep-hours-unit">hrs</span>
        </div>
        <RatingSlider
          label="Sleep Quality" emoji="⭐"
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


      </div>

      {/* Celebration modal */}
      {showCelebration && (
        <div className="celebration-overlay" onClick={() => setShowCelebration(false)}>
          <div className="celebration-card" onClick={e => e.stopPropagation()}>
            <div className="celebration-emoji">🎉</div>
            <h2>Day {selectedDayNum} Complete!</h2>
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
