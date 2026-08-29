import { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  visibleChallenges, getDefaultDuration, getDurationOptions, getDurationLabel,
  getCompletionBonusForDuration, applyColdExposureUpgrade, MENTAL_TRAINING_TEMPLATE_ID,
} from '../data/challengeTemplates';
import { COMPATIBILITY, groupByCompatibility } from '../data/challengeCompatibility';
import { DEFAULT_PASSING_SCORE, DEFAULT_KEYSTONE_REQUIREMENT } from '../utils/gamification';
import { HABIT_LABELS } from '../data/habitKeys';
import { dateOffsetFromToday } from '../utils/challengeSchedule';
import { getTodayStr, formatDateLong } from '../utils/dateUtils';

/**
 * "Add a Support Challenge" — pick a second challenge to run alongside the
 * primary, grouped by how well the pairing works.
 *
 * Every rating, reason and rule shown here comes from the compatibility table
 * (src/data/challengeCompatibility.js). This component never decides whether a
 * pairing is a good idea; it only renders what the data says.
 */
export default function SupportChallengePicker({ onClose, onSwitchPrimary }) {
  const {
    activeProfile, profile, getChallengeMeta, addSupportChallenge, previewSupportChallenge,
  } = useApp();

  const [pick, setPick] = useState(null);   // { template, compatibility }
  const [variant, setVariant] = useState('standard');
  const [duration, setDuration] = useState(null);
  const [startDate, setStartDate] = useState(getTodayStr());
  const [step, setStep] = useState('list'); // list → warn (conditional) → confirm
  const [error, setError] = useState('');

  const primaryMeta = getChallengeMeta();
  const primaryId = primaryMeta?.templateId;

  // Only challenges that can actually be started are offered, and never the one
  // already running as primary.
  const candidates = visibleChallenges(activeProfile)
    .filter(t => t.startable && t.variants && t.id !== primaryId);
  const groups = groupByCompatibility(primaryId, candidates);

  function choose(item) {
    setError('');
    setPick(item);
    setVariant('standard');
    setDuration(getDefaultDuration(item.template));
    if (item.compatibility.rating === COMPATIBILITY.CONFLICTING) setStep('conflict');
    else if (item.compatibility.rating === COMPATIBILITY.CONDITIONAL) setStep('warn');
    else setStep('confirm');
  }

  function tasksFor() {
    const def = pick?.template?.variants?.[variant];
    return def?.start_tasks || [];
  }

  const preview = step === 'confirm' && pick ? previewSupportChallenge(tasksFor()) : null;

  function confirm() {
    const tpl = pick.template;
    const ok = addSupportChallenge({
      challenge: {
        templateId: tpl.id,
        name: tpl.challenge_name,
        emoji: tpl.emoji,
        variant,
        durationDays: duration,
        templateVersion: tpl.template_version || 1,
        rewardXP: tpl.rewards?.xp || 0,
        completionBonusXP: getCompletionBonusForDuration(tpl, duration),
        passingScore: tpl.passing_score ?? DEFAULT_PASSING_SCORE,
        keystoneRequirement: tpl.keystone_requirement ?? DEFAULT_KEYSTONE_REQUIREMENT,
        badgeId: tpl.rewards?.badge_id || null,
        coldExposureUpgradeEnabled: false,
      },
      tasks: applyColdExposureUpgrade(tasksFor(), false),
      startDate,
    });
    if (!ok) { setError('That challenge cannot be added as a support challenge right now.'); return; }
    onClose?.();
  }

  // ── Step: the grouped list ────────────────────────────────────────────────
  if (step === 'list') {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-card sup-picker" onClick={e => e.stopPropagation()}>
          <h3>Add a Support Challenge</h3>
          <p className="sup-lead">
            A support challenge runs alongside <strong>{primaryMeta?.name}</strong> without
            taking it over. Shared habits are merged into one task — you never log the
            same behaviour twice.
          </p>
          {groups.map(g => (
            <div key={g.rating} className="sup-group">
              <div className="sup-group-title" style={{ color: g.meta.color }}>
                {g.meta.dot} {g.meta.label}
              </div>
              <div className="sup-group-blurb">{g.meta.blurb}</div>
              {g.items.map(item => (
                <button
                  key={item.template.id}
                  className={`sup-option ${g.rating.toLowerCase()}`}
                  onClick={() => choose(item)}
                >
                  <span className="sup-option-head">
                    <span className="sup-option-emoji">{item.template.emoji}</span>
                    <span className="sup-option-name">{item.template.challenge_name}</span>
                    <span className="sup-option-dot">{g.meta.dot}</span>
                  </span>
                  <span className="sup-option-why">{item.compatibility.reason}</span>
                </button>
              ))}
            </div>
          ))}
          {!groups.length && <p className="sup-empty">No other startable challenges are available yet.</p>}
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step: conflicting — not allowed to stack ──────────────────────────────
  if (step === 'conflict') {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-card sup-conflict" onClick={e => e.stopPropagation()}>
          <h3>🔴 These challenges conflict</h3>
          <p className="sup-conflict-pair">
            {primaryMeta?.emoji} {primaryMeta?.name} <span className="sup-vs">vs</span> {pick.template.emoji} {pick.template.challenge_name}
          </p>
          <p className="sup-conflict-why">{pick.compatibility.reason}</p>
          <p className="sup-conflict-note">
            Forge will not run these together. You can keep your current primary
            challenge, or switch to {pick.template.challenge_name} as your new primary
            — which ends {primaryMeta?.name} and archives its progress.
          </p>
          <div className="sup-conflict-actions">
            <button className="btn btn-primary btn-full" onClick={() => setStep('list')}>
              Keep {primaryMeta?.name}
            </button>
            <button
              className="btn btn-secondary btn-full"
              onClick={() => { onClose?.(); onSwitchPrimary?.(pick.template); }}
            >
              Switch primary to {pick.template.challenge_name}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step: conditional warning ─────────────────────────────────────────────
  if (step === 'warn') {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-card sup-warn" onClick={e => e.stopPropagation()}>
          <h3>🟡 Worth knowing first</h3>
          <p className="sup-conflict-pair">
            {primaryMeta?.emoji} {primaryMeta?.name} <span className="sup-vs">+</span> {pick.template.emoji} {pick.template.challenge_name}
          </p>
          <p className="sup-conflict-why">{pick.compatibility.reason}</p>
          <p className="sup-conflict-note">
            You can still run these together — {primaryMeta?.name} stays your primary
            goal and keeps priority.
          </p>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setStep('list')}>← Back</button>
            <button className="btn btn-primary" onClick={() => setStep('confirm')}>
              I understand — continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step: configure + confirm ─────────────────────────────────────────────
  const durations = getDurationOptions(pick.template);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card sup-confirm" onClick={e => e.stopPropagation()}>
        <h3>{pick.template.emoji} {pick.template.challenge_name}</h3>
        <div className="sup-role-note">
          Adding as your <strong>Support Challenge</strong>. {primaryMeta?.name} stays primary.
        </div>

        <div className="sup-field">
          <label className="sup-label">Difficulty</label>
          <div className="sup-chips">
            {Object.keys(pick.template.variants).map(v => (
              <button
                key={v}
                className={`sup-chip${variant === v ? ' active' : ''}`}
                onClick={() => setVariant(v)}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {durations.length > 1 && (
          <div className="sup-field">
            <label className="sup-label">Duration</label>
            <div className="sup-chips">
              {durations.map(d => (
                <button
                  key={d}
                  className={`sup-chip${duration === d ? ' active' : ''}`}
                  onClick={() => setDuration(d)}
                >
                  {d} days{getDurationLabel(pick.template, d) ? ` · ${getDurationLabel(pick.template, d)}` : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="sup-field">
          <label className="sup-label">Day 1</label>
          <div className="sup-chips">
            <button className={`sup-chip${startDate === getTodayStr() ? ' active' : ''}`} onClick={() => setStartDate(getTodayStr())}>Today</button>
            <button className={`sup-chip${startDate === dateOffsetFromToday(1) ? ' active' : ''}`} onClick={() => setStartDate(dateOffsetFromToday(1))}>Tomorrow</button>
          </div>
          <input
            type="date"
            className="inline-input sup-date"
            min={getTodayStr()}
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
          <div className="sup-hint">
            Its Day 1 is independent of {primaryMeta?.name} — {formatDateLong(startDate)}.
          </div>
        </div>

        {preview && (
          <div className="sup-merge">
            <div className="sup-merge-title">Your daily list</div>
            <div className="sup-merge-line">
              +{preview.addedCount} new {preview.addedCount === 1 ? 'task' : 'tasks'} · {preview.totalCount} total
            </div>
            {preview.sharedCount > 0 ? (
              <>
                <div className="sup-merge-line shared">
                  {preview.sharedCount} shared {preview.sharedCount === 1 ? 'habit' : 'habits'} merged — logged once, counted for both challenges, XP paid once.
                </div>
                <ul className="sup-merge-list">
                  {preview.merges.map(m => (
                    <li key={m.habitKey}>
                      <strong>{HABIT_LABELS[m.habitKey] || m.label}</strong>: {m.kept}
                      {m.dropped !== m.kept && (
                        <span className="sup-merge-drop">
                          {m.targetConflict
                            ? ` — also covers “${m.dropped}”`
                            : ` — stricter of the two (was “${m.dropped}”)`}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="sup-merge-line">No overlapping habits — every task is distinct.</div>
            )}
          </div>
        )}

        {error && <div className="sup-error">{error}</div>}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setStep('list')}>← Back</button>
          <button className="btn btn-primary" onClick={confirm}>Add Support Challenge</button>
        </div>
      </div>
    </div>
  );
}
