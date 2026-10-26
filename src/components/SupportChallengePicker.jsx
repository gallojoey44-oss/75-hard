import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  visibleChallenges, getDefaultDuration, getDurationOptions, getDurationLabel,
  getCompletionBonusForDuration, applyColdExposureUpgrade, MENTAL_TRAINING_TEMPLATE_ID,
} from '../data/challengeTemplates';
import { COMPATIBILITY, groupByCompatibility } from '../data/challengeCompatibility';
import { buildersFor, isConfigured, isStartableTemplate } from '../data/configuredChallenges';
import { DEFAULT_PASSING_SCORE, DEFAULT_KEYSTONE_REQUIREMENT } from '../utils/gamification';
import { HABIT_LABELS } from '../data/habitKeys';
import { dateOffsetFromToday } from '../utils/challengeSchedule';
import { getTodayStr, formatDateLong } from '../utils/dateUtils';
import { previewAttempt } from '../data/challengeAttempt';
import { displayXP } from '../utils/xpDisplay';

/**
 * "Add a Support Challenge" — pick a second challenge to run alongside the
 * primary, grouped by how well the pairing works.
 *
 * Every rating, reason and rule shown here comes from the compatibility table
 * (src/data/challengeCompatibility.js). This component never decides whether a
 * pairing is a good idea; it only renders what the data says.
 */
/**
 * One candidate in the list.
 *
 * The compatibility table's reasons are a paragraph each, and five of them
 * stacked turned the picker into a wall of text you had to read before you
 * could find the challenge you wanted. The verdict is what you compare on, so
 * that leads; the reasoning is one tap away for the one you are weighing.
 */
function SupportOption({ item, dot, rating, expanded, onToggleWhy, onChoose }) {
  return (
    <div className={`sup-option-wrap ${rating.toLowerCase()}`}>
      <button type="button" className={`sup-option ${rating.toLowerCase()}`} onClick={onChoose}>
        <span className="sup-option-head">
          <span className="sup-option-emoji">{item.template.emoji}</span>
          <span className="sup-option-name">{item.template.challenge_name}</span>
          <span className="sup-option-dot">{dot}</span>
        </span>
        <span className="sup-option-sub">{item.template.tagline || item.template.purpose}</span>
      </button>
      <button
        type="button"
        className="sup-why-toggle"
        aria-expanded={expanded}
        onClick={onToggleWhy}
      >
        {expanded ? 'Hide why' : 'Why this rating?'}
      </button>
      {expanded && <p className="sup-option-why">{item.compatibility.reason}</p>}
    </div>
  );
}

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
  // Which option is showing its full compatibility reasoning. One at a time:
  // the list is for comparing challenges, not for reading all of them at once.
  const [expandedWhy, setExpandedWhy] = useState(null);

  // The sheet is one scroller across its steps, so without this you choose a
  // challenge from halfway down the list and land halfway down its confirm
  // screen — past its own title and the date you are about to agree to.
  const sheet = useRef(null);
  useEffect(() => { sheet.current?.scrollTo?.(0, 0); }, [step]);

  const primaryMeta = getChallengeMeta();
  const primaryId = primaryMeta?.templateId;

  // Only challenges that can actually be started are offered, and never the one
  // already running as primary.
  // A configured challenge (one that builds its own attempt) is just as
  // stackable as a variant-based one — isStartableTemplate covers both, so
  // adding a challenge to the configured registry makes it available here too.
  const candidates = visibleChallenges(activeProfile)
    .filter(t => isStartableTemplate(t) && t.id !== primaryId);
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

  const configured = pick ? buildersFor(pick.template) : null;

  function tasksFor() {
    // A configured challenge builds its own task list from its config module,
    // using that challenge's own defaults — the support lane never invents one.
    if (configured) return configured.buildTasks();
    const def = pick?.template?.variants?.[variant];
    return def?.start_tasks || [];
  }

  const preview = step === 'confirm' && pick ? previewSupportChallenge(tasksFor()) : null;

  /**
   * What this addition really costs and pays.
   *
   * The merge preview says how many rows the day grows by; this says what
   * those rows ARE, roughly how much more there is to do, and how much more XP
   * a day is worth. Every figure comes from the attempt that would be created
   * — `previewAttempt` through the same path `addSupportChallenge` uses — so
   * nothing here is an estimate of the app's own behaviour.
   *
   * Shared habits are excluded from the added XP on purpose: they are already
   * on the list and are paid once, which is the whole point of merging them.
   */
  const addition = (() => {
    if (step !== 'confirm' || !pick || !preview) return null;
    const attempt = previewAttempt({
      template: pick.template,
      variant,
      durationDays: duration,
      configuredSetup: configured ? { durationDays: duration } : null,
    });
    if (!attempt) return null;
    const sharedIds = new Set(preview.merges.map(m => m.habitKey));
    const newTasks = attempt.tasks.filter(t => !sharedIds.has(t.habitKey || t.id));
    return {
      scale: attempt.displayScale,
      tasks: newTasks,
      addedXP: newTasks.reduce((sum, t) => sum + (Number(t.xp) || 0), 0),
      weeklyPerWeek: attempt.weekly.reduce((sum, w) => sum + (Number(w.perWeek) || 0), 0),
      completionBonus: attempt.completionBonus,
    };
  })();

  function confirm() {
    const tpl = pick.template;
    // A configured challenge supplies its whole descriptor — including its
    // per-attempt config block and weekly requirement defs — so nothing about it
    // is reassembled here.
    const challenge = configured
      ? {
        ...configured.buildMeta(),
        passingScore: tpl.passing_score ?? DEFAULT_PASSING_SCORE,
        keystoneRequirement: tpl.keystone_requirement ?? DEFAULT_KEYSTONE_REQUIREMENT,
        rewardXP: tpl.rewards?.xp || 0,
        badgeId: tpl.rewards?.badge_id || null,
      }
      : {
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
      };
    const ok = addSupportChallenge({
      challenge,
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
        <div ref={sheet} className="modal-card sup-picker" onClick={e => e.stopPropagation()}>
          <h3>Add a Support Challenge</h3>
          <p className="sup-lead">
            Runs alongside <strong>{primaryMeta?.name}</strong>. Shared habits merge into one
            task, so you never log the same thing twice.
          </p>
          {groups.map(g => (
            <div key={g.rating} className="sup-group">
              <div className="sup-group-title" style={{ color: g.meta.color }}>
                {g.meta.dot} {g.meta.label}
              </div>
              <div className="sup-group-blurb">{g.meta.blurb}</div>
              {g.items.map(item => (
                <SupportOption
                  key={item.template.id}
                  item={item}
                  dot={g.meta.dot}
                  rating={g.rating}
                  expanded={expandedWhy === item.template.id}
                  onToggleWhy={() => setExpandedWhy(
                    expandedWhy === item.template.id ? null : item.template.id)}
                  onChoose={() => choose(item)}
                />
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
        <div ref={sheet} className="modal-card sup-conflict" onClick={e => e.stopPropagation()}>
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
        <div ref={sheet} className="modal-card sup-warn" onClick={e => e.stopPropagation()}>
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
  // A configured challenge fixes its own length in its descriptor.
  const durations = configured ? [] : getDurationOptions(pick.template);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={sheet} className="modal-card sup-confirm" onClick={e => e.stopPropagation()}>
        <h3>{pick.template.emoji} {pick.template.challenge_name}</h3>
        <div className="sup-role-note">
          Adding as your <strong>Support Challenge</strong>. {primaryMeta?.name} stays primary.
        </div>

        {/* A configured challenge has no difficulty modes — it is defined by its
            own config, so the chooser is simply not shown for one. */}
        {!configured && pick.template.variants && (
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
        )}

        {!configured && durations.length > 1 && (
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

        {addition && (
          <div className="sup-add">
            <div className="sup-merge-title">What this adds</div>
            <div className="sup-add-figures">
              <span>
                <strong>+{addition.tasks.length}</strong>
                <span className="sup-add-label">
                  daily {addition.tasks.length === 1 ? 'habit' : 'habits'}
                </span>
              </span>
              {addition.weeklyPerWeek > 0 && (
                <span>
                  <strong>+{addition.weeklyPerWeek}</strong>
                  <span className="sup-add-label">sessions a week</span>
                </span>
              )}
              <span>
                <strong>+{displayXP(addition.addedXP, addition.scale).toLocaleString()}</strong>
                <span className="sup-add-label">XP a day</span>
              </span>
            </div>
            {addition.tasks.length > 0 && (
              <ul className="sup-add-list">
                {addition.tasks.map(t => (
                  <li key={t.id}>
                    <span className="sup-add-icon" aria-hidden="true">{t.icon || '•'}</span>
                    <span className="sup-add-name">{t.name}</span>
                    <span className="sup-add-xp">
                      {displayXP(t.xp, addition.scale).toLocaleString()} XP
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {addition.completionBonus > 0 && (
              <div className="sup-merge-line">
                Finishing it pays a further{' '}
                {displayXP(addition.completionBonus, addition.scale).toLocaleString()} XP.
              </div>
            )}
            <div className="sup-merge-line">
              Shared habits are not counted twice — they stay one task, paid once.
            </div>
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
