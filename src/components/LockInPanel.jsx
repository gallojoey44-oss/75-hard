import { useState } from 'react';
import { useApp } from '../context/AppContext';
import * as LI from '../data/lockInConfig';
import { guideForTask } from '../data/habitGuides';

/**
 * 🎯 The LOCK IN daily panel.
 *
 * Deliberately small. The dashboard above it already lists the eight habits
 * with their XP and checkboxes, so this panel exists only for the things that
 * CHANGE day to day and cannot be read off a task row:
 *
 *   • today's flow target, which ramps across the fortnight
 *   • whether today is a planned lighter day
 *   • where the ramp goes next
 *
 * Everything educational lives in the strategy guides, reachable from the task
 * rows and from the index at the bottom of this panel. Both collapsed sections
 * are shut by default.
 *
 * All copy comes from lockInConfig; this component holds no challenge constants.
 */
export default function LockInPanel({ dayNum, onOpenGuide }) {
  const { profile, getChallengeMeta, getRawDayNumber } = useApp();

  const [openRamp, setOpenRamp] = useState(false);
  const [openGuides, setOpenGuides] = useState(false);
  const [openRecovery, setOpenRecovery] = useState(false);

  const meta = getChallengeMeta();
  const cfg = LI.lockInConfig(meta);
  if (!cfg) return null;                        // not a LOCK IN attempt
  if (!getRawDayNumber()) return null;          // scheduled, not begun

  const duration = meta.durationDays || cfg.durationDays || LI.DURATION_DAYS;
  // The day being VIEWED, so looking back at Day 3 shows Day 3's flow target
  // rather than today's.
  const day = Number(dayNum) || 1;
  const req = LI.flowRequirement(day);

  // The habits that carry guides, in teaching order, resolved against the
  // attempt's own task list so an archived or edited task list still matches.
  const tasks = profile?.tasks || [];
  const guided = LI.GUIDE_ORDER
    .map(id => {
      const ref = LI.guideRef(id);
      const task = tasks.find(t => t.guideId === ref);
      return task ? { task, guide: guideForTask(task) } : null;
    })
    .filter(Boolean);

  return (
    <div className="li-panel">
      <div className="li-panel-head">
        <span className="li-panel-title">{LI.IDENTITY.emoji} {LI.IDENTITY.shortName}</span>
        <span className="li-panel-sub">Day {day} of {duration}</span>
      </div>

      {/* ── Today's flow target — the one thing that changes daily ── */}
      <div className={`li-target${req.lighter ? ' lighter' : ''}`}>
        <div className="li-target-head">
          <span className="li-target-label">🌊 Today&apos;s flow target</span>
          <span className="li-target-stage">{req.stage.label}</span>
        </div>
        <div className="li-target-value">{req.label}</div>
        <div className="li-target-note">{req.stage.note}</div>
        {req.lighter && <div className="li-lighter">{LI.LIGHTER_DAY_NOTE}</div>}
      </div>

      {/* ── The ramp ── */}
      <div className="li-block">
        <button className="li-block-toggle" onClick={() => setOpenRamp(v => !v)}>
          <span className="li-block-title">📈 The ramp</span>
          <span className="li-block-meta">
            {LI.FLOW_STAGES.map(s => s.minutes).join(' → ')} min
          </span>
          <span className="li-caret">{openRamp ? '▾' : '▸'}</span>
        </button>
        {openRamp && (
          <>
            {LI.FLOW_STAGES.map(s => (
              <div
                key={s.minutes}
                className={`li-stage${day >= s.fromDay && day <= s.toDay ? ' active' : ''}${day > s.toDay ? ' done' : ''}`}
              >
                <span className="li-stage-days">Days {s.fromDay}–{s.toDay}</span>
                <span className="li-stage-min">{s.minutes} min</span>
                <span className="li-stage-label">{s.label}</span>
              </div>
            ))}
            <div className="li-note">
              Planned lighter days: Day {LI.LIGHTER_DAYS.join(' and Day ')} — one session instead
              of {LI.FLOW_SESSIONS_PER_DAY}, same XP. Sleep is unchanged on those days.
            </div>
          </>
        )}
      </div>

      {/* ── Recovery Mode ── */}
      <div className="li-block">
        <button className="li-block-toggle" onClick={() => setOpenRecovery(v => !v)}>
          <span className="li-block-title">🔋 {LI.RECOVERY_MODE.title}</span>
          <span className="li-block-meta">when the day has gone</span>
          <span className="li-caret">{openRecovery ? '▾' : '▸'}</span>
        </button>
        {openRecovery && (
          <>
            <p className="li-blurb">{LI.RECOVERY_MODE.blurb}</p>
            <ul className="li-list">
              {LI.RECOVERY_MODE.whenToUse.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
            <div className="li-note">{LI.RECOVERY_MODE.note}</div>
            <div className="li-rule">{LI.RECOVERY_MODE.sleepRule}</div>
          </>
        )}
      </div>

      {/* ── Guide index. The guides are primarily reached from the task rows;
             this is the place to browse them all, which is what someone
             revisiting mid-challenge actually wants. ── */}
      {guided.length > 0 && (
        <div className="li-block">
          <button className="li-block-toggle" onClick={() => setOpenGuides(v => !v)}>
            <span className="li-block-title">📖 Strategy guides</span>
            <span className="li-block-meta">{guided.length} habits</span>
            <span className="li-caret">{openGuides ? '▾' : '▸'}</span>
          </button>
          {openGuides && (
            <>
              {guided.map(({ task, guide }, i) => (
                <button
                  key={task.id}
                  className="li-guide-row"
                  onClick={() => onOpenGuide?.(task.id)}
                >
                  <span className="li-guide-num">{i + 1}</span>
                  <span className="li-guide-icon">{guide.icon}</span>
                  <span className="li-guide-text">
                    <span className="li-guide-title">{guide.title}</span>
                    <span className="li-guide-tagline">{guide.tagline}</span>
                  </span>
                  <span className="li-guide-caret">→</span>
                </button>
              ))}
              <div className="li-note">
                Each guide covers why the habit matters, exactly what earns its XP, optimization and
                advanced strategies, common mistakes, and how it fits a real school or work day.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
