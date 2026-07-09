import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { formatDateLong, getDateForDayNumber } from '../utils/dateUtils';
import CheckItem from './CheckItem';
import MentalTraining from './MentalTraining';
import FaithReflection from './FaithReflection';
import RatingSlider from './RatingSlider';
import BuildBanner from './BuildBanner';
import { MWD_TASKS, getMWDComplete, getWarriorMessage } from '../utils/gamification';

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

function DaySelector({ selected, current, onChange, duration = 75 }) {
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
          Day {selected} <span className="day-sel-of">of {duration}</span>
        </span>
        {isOtherDay && (
          <button className="day-sel-today-link" onClick={() => onChange(current)}>
            → Back to Day {current}
          </button>
        )}
      </div>
      <button
        className="day-sel-btn"
        onClick={() => onChange(Math.min(duration, selected + 1))}
        disabled={selected >= duration}
        aria-label="Next day"
      >›</button>
    </div>
  );
}

// ── Gratitude / Prayer (Mental Training Phase) ──────────────────────────────

const GRATITUDE_PROMPTS = [
  'What am I grateful for today?',
  'Who should I pray for today?',
  'What did I receive that I did not earn?',
  'Where do I need humility today?',
  'What is one thing I need to surrender?',
];

function GratitudePrayer({ dayData, onUpdate, onToggleComplete }) {
  const grat      = dayData?.gratitude || { promptIndex: null, notes: '' };
  const completed = !!dayData?.tasks?.mt_gratitude;

  return (
    <div className="section-card grat-card">
      <div className="section-title">🙏 Gratitude / Prayer</div>
      <p className="grat-tone">
        Gratitude trains perspective. Prayer lowers ego and restores focus.
        A strong mind starts with humility.
      </p>

      <div className="grat-prompt-label">Optional prompt — pick one, or just take the moment:</div>
      <div className="grat-prompts">
        {GRATITUDE_PROMPTS.map((p, i) => (
          <button
            key={i}
            className={`grat-prompt-chip${grat.promptIndex === i ? ' active' : ''}`}
            onClick={() => onUpdate({ gratitude: { promptIndex: grat.promptIndex === i ? null : i } })}
          >
            {p}
          </button>
        ))}
      </div>

      <textarea
        className="grat-notes"
        placeholder="Optional — a few words is enough."
        value={grat.notes || ''}
        onChange={e => onUpdate({ gratitude: { notes: e.target.value } })}
        rows={2}
      />

      <button
        className={`btn btn-full ${completed ? 'btn-success' : 'btn-primary'}`}
        onClick={onToggleComplete}
      >
        {completed ? '✓ Gratitude / Prayer Complete' : 'Mark Gratitude / Prayer Complete'}
      </button>
      <p className="grat-footnote">Train the mind before the world tests it.</p>
    </div>
  );
}

function MWDBanner({ comebackMode, dayNum }) {
  if (!comebackMode?.active) return null;
  const elapsed = dayNum - (comebackMode.dayStart || dayNum);
  if (elapsed === 0) {
    return (
      <div className="comeback-day-banner">
        ↩️ <strong>Comeback Day 1</strong> — Minimum Warrior Day is enough today.
      </div>
    );
  }
  if (elapsed === 1) {
    return (
      <div className="comeback-day-banner">
        ↩️ <strong>Comeback Day 2</strong> — Normal tasks, lower intensity. Keep going.
      </div>
    );
  }
  if (elapsed === 2) {
    return (
      <div className="comeback-day-banner">
        ↩️ <strong>Comeback Day 3</strong> — Full challenge. You&apos;re back.
      </div>
    );
  }
  return null;
}

export default function DailyView({ editDayNum, setView }) {
  const {
    activeProfile, profile,
    getChallengeMeta, getDayNumber, getDayData,
    updateDay, toggleTask,
  } = useApp();

  const currentDayNum = getDayNumber();

  const [selectedDayNum, setSelectedDayNum] = useState(
    editDayNum != null ? editDayNum : (currentDayNum || 1)
  );
  const [dayData, setDayData] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationMsg, setCelebrationMsg] = useState('');
  const [celebrationIsMWD, setCelebrationIsMWD] = useState(false);
  const [prevPct, setPrevPct] = useState(0);
  const [prevMWDDone, setPrevMWDDone] = useState(false);

  useEffect(() => {
    if (editDayNum != null) setSelectedDayNum(editDayNum);
  }, [editDayNum]);

  useEffect(() => {
    const n = editDayNum != null ? editDayNum : (getDayNumber() || 1);
    setSelectedDayNum(n);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfile]);

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
      isMWD: false, mwdTasks: {},
    };
    setDayData(data);
    setPrevPct(calcPct(data));
    setPrevMWDDone(getMWDComplete(data));
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

  function calcMWDPct(data) {
    if (!data?.isMWD) return 0;
    const done = MWD_TASKS.filter(t => data.mwdTasks?.[t.id]).length;
    return Math.round((done / MWD_TASKS.length) * 100);
  }

  function triggerCelebration(merged, newPct, newMWDDone) {
    const wasNotComplete = prevPct < 100 && !prevMWDDone;
    const justCompleted = (newPct === 100 && prevPct < 100) || (newMWDDone && !prevMWDDone);
    if (!justCompleted) return;
    if (!wasNotComplete) return;

    const isMWD = merged.isMWD && newMWDDone;
    const isComeback = !!(profile?.comebackMode?.active);
    const stressHigh = (merged.stress || 0) >= 7;
    const msg = getWarriorMessage({ isMWD, isComeback, stressHigh });
    setCelebrationMsg(msg);
    setCelebrationIsMWD(isMWD);
    setShowCelebration(true);
    setPrevPct(newPct);
    setPrevMWDDone(newMWDDone);
  }

  function handleUpdate(updates) {
    if (!selectedDayNum) return;
    const merged = { ...dayData, ...updates };
    if (updates.tasks)           merged.tasks           = { ...dayData?.tasks,           ...updates.tasks };
    if (updates.mentalTraining)  merged.mentalTraining  = { ...dayData?.mentalTraining,  ...updates.mentalTraining };
    if (updates.faithReflection) merged.faithReflection = { ...dayData?.faithReflection, ...updates.faithReflection };
    if (updates.mwdTasks)        merged.mwdTasks        = { ...dayData?.mwdTasks,        ...updates.mwdTasks };
    if (updates.gratitude)       merged.gratitude       = { ...dayData?.gratitude,       ...updates.gratitude };
    setDayData(merged);
    updateDay(selectedDayNum, merged);

    const newPct = calcPct(merged);
    const newMWDDone = getMWDComplete(merged);
    triggerCelebration(merged, newPct, newMWDDone);
    setPrevPct(newPct);
    setPrevMWDDone(newMWDDone);
  }

  function handleToggleTask(taskId) {
    const newTasks = { ...dayData?.tasks, [taskId]: !dayData?.tasks?.[taskId] };
    const merged = { ...dayData, tasks: newTasks };
    setDayData(merged);
    toggleTask(selectedDayNum, taskId);

    const newPct = calcPct(merged);
    const newMWDDone = getMWDComplete(merged);
    triggerCelebration(merged, newPct, newMWDDone);
    setPrevPct(newPct);
    setPrevMWDDone(newMWDDone);
  }

  function handleToggleMWDTask(taskId) {
    const newMwdTasks = { ...dayData?.mwdTasks, [taskId]: !dayData?.mwdTasks?.[taskId] };
    handleUpdate({ mwdTasks: newMwdTasks });
  }

  function handleToggleMWD() {
    const newIsMWD = !dayData?.isMWD;
    handleUpdate({ isMWD: newIsMWD });
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
  const mwdPct  = calcMWDPct(dayData);
  const tasks   = [...(profile.tasks || [])].sort((a, b) => a.order - b.order);
  const dateStr = dayData?.date || getDateForDayNumber(profile?.challengeStart, selectedDayNum);
  const isMe    = activeProfile === 'me';
  const isMWD   = !!dayData?.isMWD;

  const mentalTaskId = isMe ? 'mental' : 'gf_mental';
  const faithEnabled = profile?.faithEnabled || false;
  const faithCounts  = profile?.faithCountsToward || false;
  const hasGratitudeTask = tasks.some(t => t.id === 'mt_gratitude');

  const isCurrentDay = selectedDayNum === currentDayNum;
  const comebackMode = profile?.comebackMode || {};

  const displayPct = isMWD ? mwdPct : pct;
  const taskCount  = isMWD ? `${MWD_TASKS.filter(t => dayData?.mwdTasks?.[t.id]).length}/${MWD_TASKS.length} MWD tasks` : `${tasks.filter(t => dayData?.tasks?.[t.id]).length}/${tasks.length} tasks`;

  return (
    <div className="daily-view">
      <BuildBanner />

      {/* Day Selector */}
      <DaySelector
        selected={selectedDayNum}
        current={currentDayNum}
        onChange={setSelectedDayNum}
        duration={getChallengeMeta().durationDays || 75}
      />

      {/* Comeback banner */}
      {isMe && isCurrentDay && (
        <MWDBanner comebackMode={comebackMode} dayNum={selectedDayNum} />
      )}

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
            <span>{isMWD ? '🛡️ MWD progress' : "Today's progress"}</span>
            <span>{taskCount}</span>
          </div>
          <div className="prog-bar-track">
            <div
              className={`prog-bar-fill${displayPct === 100 ? ' success' : ''}${isMWD ? ' mwd' : ''}`}
              style={{ width: `${displayPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Joey: standard checklist ── */}
      {isMe && (
        <div className="section-card">
          <div className="section-title" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span>{isMWD ? '🛡️ Minimum Warrior Day' : '✅ Daily Tasks'}</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {isCurrentDay && (
                <button
                  className={`mwd-toggle-btn${isMWD ? ' active' : ''}`}
                  onClick={handleToggleMWD}
                  title={isMWD ? 'Switch to full challenge' : 'Switch to Minimum Warrior Day'}
                >
                  {isMWD ? '↩ Full Mode' : '🛡️ MWD'}
                </button>
              )}
              {setView && (
                <button
                  className="manage-tasks-link"
                  onClick={() => setView('settings')}
                >
                  ✏️ Manage Tasks
                </button>
              )}
            </div>
          </div>

          {isMWD ? (
            <>
              <div className="mwd-banner">
                Today is about not breaking completely. Do the minimum and return tomorrow.
              </div>
              <div className="mwd-task-list">
                {MWD_TASKS.map(task => (
                  <div
                    key={task.id}
                    className={`mwd-task${dayData?.mwdTasks?.[task.id] ? ' done' : ''}`}
                    onClick={() => handleToggleMWDTask(task.id)}
                  >
                    <span className="mwd-task-icon">{task.icon}</span>
                    <span className="mwd-task-label">{task.label}</span>
                    <span className={`mwd-task-check${dayData?.mwdTasks?.[task.id] ? ' checked' : ''}`}>
                      {dayData?.mwdTasks?.[task.id] ? '✓' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            tasks.map(task => (
              <CheckItem
                key={task.id}
                task={task}
                checked={!!dayData?.tasks?.[task.id]}
                onToggle={() => handleToggleTask(task.id)}
              />
            ))
          )}
        </div>
      )}

      {/* ── Joey: Gratitude / Prayer (Mental Training Phase) ── */}
      {isMe && hasGratitudeTask && !isMWD && (
        <GratitudePrayer
          dayData={dayData}
          onUpdate={handleUpdate}
          onToggleComplete={() => handleToggleTask('mt_gratitude')}
        />
      )}

      {/* ── Joey: mental training ── */}
      {isMe && !isMWD && (
        <MentalTraining
          dayNumber={selectedDayNum}
          dayData={dayData}
          onUpdate={handleUpdate}
          mentalTaskId={mentalTaskId}
        />
      )}

      {/* ── Joey: faith reflection (optional) ── */}
      {isMe && faithEnabled && !isMWD && (
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

          {hasGratitudeTask && (
            <GratitudePrayer
              dayData={dayData}
              onUpdate={handleUpdate}
              onToggleComplete={() => handleToggleTask('mt_gratitude')}
            />
          )}

          <MentalTraining
            dayNumber={selectedDayNum}
            dayData={dayData}
            onUpdate={handleUpdate}
            mentalTaskId={mentalTaskId}
          />

          {faithEnabled && (
            <FaithReflection
              dayNumber={selectedDayNum}
              dayData={dayData}
              onUpdate={handleUpdate}
              countsToward={faithCounts}
            />
          )}

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
            <div className="celebration-emoji">{celebrationIsMWD ? '🛡️' : '🎉'}</div>
            <h2>{celebrationIsMWD ? `MWD Complete — Day ${selectedDayNum}` : `Day ${selectedDayNum} Complete!`}</h2>
            <div className="warrior-msg">{celebrationMsg}</div>
            {celebrationIsMWD && (
              <p className="mwd-complete-note">Chain kept. Come back stronger tomorrow.</p>
            )}
            <button className="btn btn-primary btn-full" onClick={() => setShowCelebration(false)}>
              {celebrationIsMWD ? 'Keep going 🛡️' : "Let's go! 💪"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
