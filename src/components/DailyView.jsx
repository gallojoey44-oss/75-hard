import { useState, useEffect, useRef } from 'react';
import { useApp, dayHasLoggedMetric } from '../context/AppContext';
import { formatDateLong, getDateForDayNumber } from '../utils/dateUtils';
import CheckItem from './CheckItem';
import BonusMissions from './BonusMissions';
import WeeklyRequirements from './WeeklyRequirements';
import ChallengePerformance from './ChallengePerformance';
import SupportProgress from './SupportProgress';
import MuscleBuildingPanel from './MuscleBuildingPanel';
import HormoneHealthPanel from './HormoneHealthPanel';
import EnergyResetPanel from './EnergyResetPanel';
import FatLossHardPanel from './FatLossHardPanel';
import MentalTraining from './MentalTraining';
import FaithReflection from './FaithReflection';
import BuildBanner from './BuildBanner';
import { FutureSelfLetterView } from './FutureSelfLetter';
import {
  MWD_TASKS, getMWDComplete, getWarriorMessage,
  sortTasksByKeystone, getTaskKeystone, getTaskXP, isKeystone, requiredTasksForDay,
  computeChallengeScore,
} from '../utils/gamification';
import { KEYSTONE_EXPLAINER, WEEKLY_REFLECTION_PROMPTS } from '../data/challengeContent';
import { getTemplateById } from '../data/challengeTemplates';
import { dayRules } from '../data/xpEconomy';
import ScheduledStartCard from './ScheduledStart';
import {
  alsoSupportsLabel, groupTasksForDisplay, hasSupportChallenge,
  challengeOf, LANE,
} from '../utils/challengeStack';
import * as MB from '../data/muscleBuildingConfig';
import * as HH from '../data/hormoneHealthConfig';
import * as ER from '../data/energyResetConfig';
import * as LI from '../data/lockInConfig';
import * as FLH from '../data/fatLossHardConfig';
import HabitGuide from './HabitGuide';
import LockInPanel from './LockInPanel';
import { guideForTask } from '../data/habitGuides';
import ChallengeHeaderCard from './today/ChallengeHeaderCard';
import TodayProgress from './today/TodayProgress';
import QuickLog from './today/QuickLog';
import Collapsible from './today/Collapsible';

function DaySelector({ selected, current, onChange, duration = 75 }) {
  const isOtherDay = current && selected !== current;
  // Forge Daily (duration null) is open-ended — no fixed max, can't plan ahead
  // past today, and shows no "of N" so Today never reads "Day N of N" frozen.
  const openEnded = duration == null;
  const maxDay = openEnded ? (current || selected) : duration;
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
          Day {selected}{!openEnded && <span className="day-sel-of"> of {duration}</span>}
        </span>
        {isOtherDay && (
          <button className="day-sel-today-link" onClick={() => onChange(current)}>
            → Back to Day {current}
          </button>
        )}
      </div>
      <button
        className="day-sel-btn"
        onClick={() => onChange(Math.min(maxDay, selected + 1))}
        disabled={selected >= maxDay}
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
      <div className="section-title">🙏 Gratitude</div>
      <p className="grat-tone">
        Gratitude trains perspective. A strong mind starts with humility.
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
        {completed ? '✓ Gratitude Complete' : 'Mark Gratitude Complete'}
      </button>
      <p className="grat-footnote">Train the mind before the world tests it.</p>
    </div>
  );
}

// ── Body metrics (Fat Loss Challenge) ────────────────────────────────────────

function BodyMetrics({ dayData, dayNumber, onUpdate, extraMeasurements = [] }) {
  const isWaistDay = dayNumber % 7 === 1; // days 1, 8, 15, 22, 29
  return (
    <div className="section-card body-metrics-card">
      <div className="section-title">📷 Progress Tracking</div>
      <p className="body-metrics-hint">
        Photos are your before/after. Weigh-ins are optional but encouraged — trends matter, single days don&apos;t.
        {isWaistDay ? ' Today is a waist measurement day.' : ''}
      </p>
      <div className="body-metrics-row">
        <label className="body-metric-field">
          <span className="body-metric-label">⚖️ Weight (lb)</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            className="inline-input"
            placeholder="optional"
            value={dayData?.weight || ''}
            onChange={e => onUpdate({ weight: parseFloat(e.target.value) || 0 })}
          />
        </label>
        <label className="body-metric-field">
          <span className="body-metric-label">📏 Waist (in){isWaistDay ? ' · due' : ''}</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            className="inline-input"
            placeholder={isWaistDay ? 'measure today' : 'weekly'}
            value={dayData?.waist || ''}
            onChange={e => onUpdate({ waist: parseFloat(e.target.value) || 0 })}
          />
        </label>
        {/* Extra measurements the user opted into at challenge setup. Nothing is
            required — an unselected measurement never renders a field. */}
        {extraMeasurements.map(m => (
          <label key={m.id} className="body-metric-field">
            <span className="body-metric-label">{m.icon} {m.label} ({m.unit})</span>
            <input
              type="number" inputMode="decimal" step="0.1" min="0" className="inline-input"
              placeholder="optional"
              value={dayData?.[m.field] || ''}
              onChange={e => onUpdate({ [m.field]: parseFloat(e.target.value) || 0 })}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

// ── Read My Why / I'm struggling ─────────────────────────────────────────────

function WhyBar({ letter, onReadWhy, onStruggling }) {
  return (
    <div className="why-bar">
      {letter && (
        <button className="btn btn-ghost why-btn" onClick={onReadWhy}>📖 Read My Why</button>
      )}
      <button className="btn btn-ghost why-btn" onClick={onStruggling}>🫂 I&apos;m struggling</button>
    </div>
  );
}

// ── Challenge coaching: repeatedly skipped keystone ─────────────────────────

function CoachingCard({ keystone, whyText, onReduce, onReadWhy, isCurrentDay, canReduce }) {
  const [showWhy, setShowWhy] = useState(false);
  return (
    <div className="coaching-card">
      <div className="coaching-title">🧭 A gentle nudge</div>
      <p className="coaching-body">
        We&apos;ve noticed you&apos;ve consistently skipped <strong>{keystone.name.replace(/ —.*$/, '')}</strong>.
        This habit is the foundation of this challenge. Would you like to:
      </p>
      <div className="coaching-actions">
        {isCurrentDay && canReduce && (
          <button className="btn btn-ghost coaching-action" onClick={onReduce}>Reduce today&apos;s duration</button>
        )}
        <button className="btn btn-ghost coaching-action" onClick={onReadWhy}>Read your Why</button>
        <button className="btn btn-ghost coaching-action" onClick={() => setShowWhy(v => !v)}>
          {showWhy ? 'Hide' : 'Learn why this habit matters'}
        </button>
      </div>
      {showWhy && whyText && <div className="coaching-why">{whyText}</div>}
    </div>
  );
}

// ── Weekly reflection ────────────────────────────────────────────────────────

function WeeklyReflection({ weekNumber, existing, onSave }) {
  const [answers, setAnswers] = useState(existing || {});
  const [saved, setSaved] = useState(!!existing);
  if (saved && existing) {
    return (
      <div className="section-card reflection-card">
        <div className="section-title">🪞 Week {weekNumber} reflection saved</div>
        <p className="reflection-hint">Thanks for reflecting — Forge uses this to tune future recommendations.</p>
      </div>
    );
  }
  return (
    <div className="section-card reflection-card">
      <div className="section-title">🪞 Week {weekNumber} reflection</div>
      <p className="reflection-hint">A quick check-in helps you (and Forge) learn what&apos;s working.</p>
      {WEEKLY_REFLECTION_PROMPTS.map(p => (
        <label key={p.key} className="letter-field">
          <span className="letter-field-label">{p.label}</span>
          <textarea
            className="letter-textarea"
            rows={2}
            value={answers[p.key] || ''}
            onChange={e => setAnswers(a => ({ ...a, [p.key]: e.target.value }))}
          />
        </label>
      ))}
      <button
        className="btn btn-primary btn-full"
        style={{ marginTop: 8 }}
        onClick={() => { onSave(weekNumber, answers); setSaved(true); }}
      >
        Save Reflection
      </button>
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

/**
 * The daily task list, split into its two challenge lanes when a support
 * challenge is running.
 *
 * With no support challenge this renders exactly the flat list it always has —
 * same rows, same order, same components — so single-challenge Today is
 * untouched. The lane split is purely presentational: it partitions the ONE
 * stored list, and a shared habit appears once, under Primary, carrying a badge
 * naming the other challenge it also satisfies.
 */
function TaskList({ tasks, profile, renderTask, hasKeystones, keystoneExplainer }) {
  const stacked = hasSupportChallenge(profile);
  const groups = groupTasksForDisplay(tasks, sortTasksByKeystone);

  // A footnote, placed after the habits it explains. Above them it pushed the
  // first habit further down the phone than the thing it was annotating.
  const explainer = hasKeystones
    ? <div className="keystone-explainer">⭐ {keystoneExplainer}</div>
    : null;

  if (!stacked) {
    return (
      <>
        {groups.primary.map(t => renderTask(t, null))}
        {explainer}
      </>
    );
  }

  const primaryName = challengeOf(profile, LANE.PRIMARY)?.name || 'Primary Challenge';
  const supportName = challengeOf(profile, LANE.SUPPORT)?.name || 'Support Challenge';
  const primaryEmoji = challengeOf(profile, LANE.PRIMARY)?.emoji || '';
  const supportEmoji = challengeOf(profile, LANE.SUPPORT)?.emoji || '';

  return (
    <div className="lane-list">
      <div className="lane-section primary">
        <div className="lane-header">
          <span className="lane-kicker">⚔️ Primary Challenge</span>
          <span className="lane-name">{primaryEmoji} {primaryName}</span>
        </div>
        {groups.primary.map(t => renderTask(t, alsoSupportsLabel(t, profile)))}
        {explainer}
      </div>

      <div className="lane-section support">
        <div className="lane-header">
          <span className="lane-kicker">🛡️ Support Challenge</span>
          <span className="lane-name">{supportEmoji} {supportName}</span>
        </div>
        {groups.support.length > 0 ? (
          groups.support.map(t => renderTask(t, null))
        ) : (
          <div className="lane-empty">
            Every {supportName} habit is already covered by a {primaryName} task above —
            nothing extra to check.
          </div>
        )}
      </div>
    </div>
  );
}

export default function DailyView({ editDayNum, setView }) {
  const {
    activeProfile, profile, profiles, allDays, todayStr,
    getChallengeMeta, getDayNumber, getRawDayNumber, getDayData, isChallengeScheduled,
    updateDay, toggleTask, getWeeklyRequirements,
    weeklyReflections, saveWeeklyReflection,
  } = useApp();

  const [showLetter, setShowLetter] = useState(false);
  const logRef = useRef(null);
  const scrollToLog = () => logRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

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
  // The task whose strategy guide is open, if any. Held as the task id so the
  // guide always reads live completion state rather than a snapshot.
  const [guideTaskId, setGuideTaskId] = useState(null);

  useEffect(() => {
    if (editDayNum != null) setSelectedDayNum(editDayNum);
  }, [editDayNum]);

  useEffect(() => {
    const n = editDayNum != null ? editDayNum : (getDayNumber() || 1);
    setSelectedDayNum(n);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfile]);

  // Midnight rollover: when the local date changes while the app is open, if the
  // user is viewing what WAS "today" (not reviewing a past/future day and not in
  // an explicit edit), advance to the new current day. The selected-day effect
  // below then loads a fresh, unchecked set for the new date. Users who have
  // navigated to another day are left where they are.
  const lastDayRef = useRef(currentDayNum);
  useEffect(() => {
    const cur = getDayNumber();
    const prev = lastDayRef.current;
    lastDayRef.current = cur;
    if (cur == null || cur === prev) return;
    if (editDayNum == null && selectedDayNum === prev) setSelectedDayNum(cur);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayStr]);

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
    // Date-aware: the Cold Shower only belongs to days on/after its activation.
    // Only the challenge's required tasks count — matches getDayCompletion and
    // the visible "x/y tasks" count, so all-required-done reads exactly 100%.
    const tasks = requiredTasksForDay(profile.tasks || [], profile.activeChallenge, profile.challengeStart, data?.dayNumber ?? selectedDayNum);
    if (!tasks.length) return 0;
    const done = tasks.filter(t => data.tasks?.[t.id]).length;
    return Math.round((done / tasks.length) * 100);
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

    // Unified Daily Log: saving at least one valid metric completes the Daily
    // Log task exactly once for the day (never per-metric). Completion persists.
    const hasDailyLogTask = (profile?.tasks || []).some(t => t.id === 'daily_log');
    if (hasDailyLogTask && !merged.tasks?.daily_log && dayHasLoggedMetric(merged)) {
      merged.tasks = { ...merged.tasks, daily_log: true };
    }

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
  const tasks   = [...requiredTasksForDay(profile.tasks || [], profile.activeChallenge, profile.challengeStart, selectedDayNum)].sort((a, b) => a.order - b.order);
  const dateStr = dayData?.date || getDateForDayNumber(profile?.challengeStart, selectedDayNum);
  const isMe    = activeProfile === 'me';
  const isMWD   = !!dayData?.isMWD;

  const mentalTaskId = isMe ? 'mental' : 'gf_mental';
  const faithEnabled = profile?.faithEnabled || false;
  const hasGratitudeTask = tasks.some(t => t.id === 'mt_gratitude');
  const meta = getChallengeMeta();
  // This attempt's own rate card: an era-1 attempt still shows era-1 task XP.
  const rules = dayRules(meta);
  const isFatLoss = meta.templateId === 'fat_loss_phase';
  // Muscle Building shows the same progress-tracking card, plus whichever extra
  // measurements the user opted into at setup. Nothing is required.
  const mbCfg = MB.mbConfig(meta);
  const mbExtraMeasurements = mbCfg
    ? MB.MEASUREMENTS.filter(m => m.field && m.id !== 'weight' && m.id !== 'waist' && mbCfg.measurements?.[m.id])
    : [];
  const showBodyMetrics = isFatLoss || !!mbCfg;

  // Keystone display: keystones pinned to the top of the checklist.
  const displayTasks = sortTasksByKeystone(tasks);
  const hasKeystones = tasks.some(isKeystone);

  // Future Self Letter for the active challenge (archived per challenge).
  const letter = meta.futureSelfLetter || null;

  // Weekly reflection: prompt on each 7-day boundary if not yet answered.
  const weekNumber = currentDayNum && currentDayNum % 7 === 0 ? currentDayNum / 7 : null;
  const reflectionDue = weekNumber && !(weeklyReflections?.[activeProfile]?.[weekNumber]);

  // Challenge coaching: the top keystone repeatedly skipped in recent days.
  const coachingKeystone = (() => {
    if (!hasKeystones || !currentDayNum || currentDayNum < 3) return null;
    const profDays = allDays[activeProfile] || {};
    const top = displayTasks.find(isKeystone);
    if (!top) return null;
    let skipped = 0;
    for (let i = Math.max(1, currentDayNum - 6); i <= currentDayNum; i++) {
      const d = profDays[i];
      const logged = d && (Object.values(d.tasks || {}).some(Boolean) || (d.notes || '').trim());
      if (logged && !d.tasks?.[top.id]) skipped++;
    }
    return skipped >= 3 ? top : null;
  })();
  const keystoneWhy = coachingKeystone
    ? getTemplateById(meta.templateId)?.keystone_why?.[coachingKeystone.id]
    : null;

  const isCurrentDay = selectedDayNum === currentDayNum;
  const comebackMode = profile?.comebackMode || {};

  // ── Disclosure summary ──────────────────────────────────────────────────
  // A collapsed section still has to be worth opening, so it states its
  // headline on the closed header — from the same scorer the card inside
  // uses, and null rather than a guess when there is no data yet.
  const scoreSummary = (() => {
    const rawDay = getRawDayNumber?.() || currentDayNum || selectedDayNum;
    const score = computeChallengeScore(allDays, profiles, activeProfile, rawDay);
    return score?.hasData ? `${score.score}%` : null;
  })();

  const displayPct = isMWD ? mwdPct : pct;

  // SCHEDULED attempt: Day 1 has not arrived, so there is no day to show. Never
  // render a task list (which would look like — and could be checked off as —
  // a real Day 1) before the scheduled start date.
  if (isChallengeScheduled()) {
    return (
      <div className="daily-view">
        <BuildBanner />
        <ScheduledStartCard />
      </div>
    );
  }

  const mwdDoneCount = MWD_TASKS.filter(t => dayData?.mwdTasks?.[t.id]).length;

  return (
    <div className="daily-view f4-today">
      <BuildBanner />

      {/* Page header — what day this is, before anything else. */}
      <header className="f4-page-head">
        <div>
          <h1 className="f4-page-title">{isCurrentDay ? 'Today' : `Day ${selectedDayNum}`}</h1>
          <div className="f4-page-date">{formatDateLong(dateStr)}</div>
        </div>
        {/* Day navigation lives in the header rather than between the summary
            and the work. It is how another day is corrected — worth one row of
            the page, not a band across it: on an iPhone that band was most of
            the reason the first habit started below the fold. */}
        <div className="f4-page-aside">
          <DaySelector
            selected={selectedDayNum}
            current={currentDayNum}
            onChange={setSelectedDayNum}
            duration={getChallengeMeta().durationDays}
          />
          <div className="daily-header-meta f4-page-flag">
            {currentDayNum && selectedDayNum < currentDayNum ? (
              <>
                <span className="edit-other-label">✏️ Editing past day</span>
                <span className="logged-late-badge">Logged late</span>
              </>
            ) : selectedDayNum > (currentDayNum || 0) ? (
              <span className="edit-other-label">📋 Planning ahead</span>
            ) : null}
          </div>
        </div>
      </header>

      {/* 1 — Understand today's challenge. */}
      <ChallengeHeaderCard onOpenChallenge={setView ? () => setView('challenges') : null} />

      {/* Comeback banner */}
      {isMe && isCurrentDay && (
        <MWDBanner comebackMode={comebackMode} dayNum={selectedDayNum} />
      )}

      {/* 2 — See daily progress. */}
      <TodayProgress
        tasks={tasks}
        dayData={dayData}
        dayNum={selectedDayNum}
        isMWD={isMWD}
        mwdDone={mwdDoneCount}
        mwdTotal={MWD_TASKS.length}
        isPast={!!currentDayNum && selectedDayNum < currentDayNum}
        isFuture={selectedDayNum > (currentDayNum || 0)}
      />


      {/* Challenge coaching — repeatedly skipped keystone */}
      {isCurrentDay && coachingKeystone && (
        <CoachingCard
          keystone={coachingKeystone}
          whyText={keystoneWhy}
          isCurrentDay={isCurrentDay}
          canReduce={!isMWD}
          onReduce={() => { if (!isMWD) handleToggleMWD(); }}
          onReadWhy={() => setShowLetter(true)}
        />
      )}

      {/* Weekly reflection */}
      {isCurrentDay && reflectionDue && (
        <WeeklyReflection
          weekNumber={weekNumber}
          existing={weeklyReflections?.[activeProfile]?.[weekNumber]}
          onSave={saveWeeklyReflection}
        />
      )}

      {/* ── Joey: standard checklist ── */}
      {isMe && (
        <div className="section-card f4-tasks-card">
          <div className="section-title f4-tasks-head">
            <span className="f4-card-title">{isMWD ? '🛡️ Minimum Warrior Day' : 'Daily Tasks'}</span>
            <span className="f4-tasks-tools">
              {isCurrentDay && (
                <button
                  className={`mwd-toggle-btn${isMWD ? ' active' : ''}`}
                  onClick={handleToggleMWD}
                  title={isMWD ? 'Switch to full challenge' : 'Switch to Minimum Warrior Day'}
                >
                  {isMWD ? '↩ Full' : '🛡️ MWD'}
                </button>
              )}
              {setView && (
                <button className="manage-tasks-link" onClick={() => setView('settings')} title="Manage tasks">
                  ✏️ Manage
                </button>
              )}
            </span>
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
            <div className="f4-task-list">
            <TaskList
              tasks={tasks}
              profile={profile}
              hasKeystones={hasKeystones}
              keystoneExplainer={KEYSTONE_EXPLAINER}
              renderTask={(task, supports) => (
                <CheckItem
                  key={task.id}
                  task={task}
                  checked={!!dayData?.tasks?.[task.id]}
                  onToggle={() => task.id === 'daily_log' ? scrollToLog() : handleToggleTask(task.id)}
                  keystone={getTaskKeystone(task)}
                  xp={getTaskXP(task, rules)}
                  supports={supports}
                  onOpenGuide={guideForTask(task) ? () => setGuideTaskId(task.id) : null}
                />
              )}
            />
            </div>
          )}
        </div>
      )}

      {/* Future Self Letter viewer */}
      {showLetter && (
        <FutureSelfLetterView letter={letter} onClose={() => setShowLetter(false)} />
      )}

      {/* Habit strategy guide. Opened from a task row (either layout) or from a
          challenge panel; reads live completion state so the checkbox inside it
          is the same checkbox as the one on the dashboard. */}
      {guideTaskId && (() => {
        const task = tasks.find(t => t.id === guideTaskId);
        const g = guideForTask(task);
        if (!g) return null;
        return (
          <HabitGuide
            guide={g}
            xp={getTaskXP(task, rules)}
            checked={!!dayData?.tasks?.[task.id]}
            onToggle={() => task.id === 'daily_log' ? scrollToLog() : handleToggleTask(task.id)}
            onClose={() => setGuideTaskId(null)}
          />
        );
      })()}

      {/* ── Girlfriend: colored task cards ── */}
      {!isMe && (
        <>
          {/* The same card the other profile gets — heading, count and tools.
              One design means one of these, not a bare list on one profile and
              a titled card on the other. */}
          <div className="section-card f4-tasks-card">
          <div className="section-title f4-tasks-head">
            <span className="f4-card-title">Daily Tasks</span>
            <span className="f4-tasks-tools">
              {setView && (
                <button className="manage-tasks-link" onClick={() => setView('settings')} title="Manage tasks">
                  ✏️ Manage
                </button>
              )}
            </span>
          </div>

          <div className="gf-tasks f4-task-list">
            <TaskList
              tasks={tasks}
              profile={profile}
              hasKeystones={hasKeystones}
              keystoneExplainer={KEYSTONE_EXPLAINER}
              renderTask={(task, supports) => (
                <CheckItem
                  key={task.id}
                  task={task}
                  variant="card"
                  checked={!!dayData?.tasks?.[task.id]}
                  onToggle={() => task.id === 'daily_log' ? scrollToLog() : handleToggleTask(task.id)}
                  keystone={getTaskKeystone(task)}
                  xp={getTaskXP(task, rules)}
                  supports={supports}
                  onOpenGuide={guideForTask(task) ? () => setGuideTaskId(task.id) : null}
                />
              )}
            />
          </div>
          </div>

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

      {/* 4 — Record the Daily Log. DIRECTLY under the habits: nothing, not even
          the other logging cards, comes between doing the day and recording
          it. Both profiles. */}
      <QuickLog
        dayData={dayData}
        onUpdate={handleUpdate}
        profile={profile}
        activeProfile={activeProfile}
        logRef={logRef}
        meta={meta}
      />

      {/* The remaining LOGGING surfaces. These complete real tasks, so they
          stay on the page rather than moving behind a disclosure — they are
          actions, not analytics. */}
      {showBodyMetrics && !isMWD && (
        <BodyMetrics
          dayData={dayData}
          dayNumber={selectedDayNum}
          onUpdate={handleUpdate}
          extraMeasurements={mbExtraMeasurements}
        />
      )}
      {hasGratitudeTask && !isMWD && (
        <GratitudePrayer
          dayData={dayData}
          onUpdate={handleUpdate}
          onToggleComplete={() => handleToggleTask('mt_gratitude')}
        />
      )}
      {!isMWD && (
        <MentalTraining
          dayNumber={selectedDayNum}
          dayData={dayData}
          onUpdate={handleUpdate}
          mentalTaskId={mentalTaskId}
        />
      )}
      {faithEnabled && !isMWD && (
        <FaithReflection
          dayNumber={selectedDayNum}
          dayData={dayData}
          onUpdate={handleUpdate}
        />
      )}

      {/* Optional extras — never required, never part of the challenge score. */}
      <BonusMissions dayNumber={selectedDayNum} isEditable />

      {/* Support, kept within reach but out of the way of the work itself. */}
      <WhyBar
        letter={letter}
        onReadWhy={() => setShowLetter(true)}
        onStruggling={() => setShowLetter(true)}
      />

      {/* 5 — Explore deeper detail if desired.

          Everything below is kept, in full, behind named disclosures. It is
          the material that made Today hard to read daily: scoring breakdowns,
          weekly targets and the per-challenge analytics panels. Closed by
          default, so the daily flow above is the whole page until someone asks
          for more. */}
      {/* The challenge's own daily tooling — today's flow target, this week's
          sessions, the energy ratings. These are things to DO today, so they
          stay on the page; only the scoring moves behind a disclosure. */}
      {isCurrentDay && <WeeklyRequirements />}
      <MuscleBuildingPanel />
      <HormoneHealthPanel />
      <EnergyResetPanel />
      <FatLossHardPanel />
      <LockInPanel dayNum={selectedDayNum} onOpenGuide={setGuideTaskId} />

      {/* 5 — Explore deeper detail if desired.

          The grading breakdown is the part that competed hardest with the
          daily work: a scorecard, keystone adherence, pass thresholds and
          projections, none of which change what to do today. It is kept in
          full, behind a named disclosure that states the current score so it
          is obvious whether opening it is worthwhile. */}
      <Collapsible title="Performance & grading" icon="📊" summary={scoreSummary}>
        <ChallengePerformance />
        <SupportProgress />
      </Collapsible>


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
