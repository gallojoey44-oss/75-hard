import { useMemo, useState } from 'react';
import { useApp, DISCIPLINE_75_META, discipline75Tasks } from '../../context/AppContext';
import { previewAttempt, buildAttemptPayload } from '../../data/challengeAttempt';
import {
  getDefaultDuration, getDurationLabel, isRecommendedDuration,
  MENTAL_TRAINING_TEMPLATE_ID, COLD_SHOWER_TASK,
} from '../../data/challengeTemplates';
import { CONFIGURED_SETUPS } from '../../data/configuredSetups';
import * as FLH from '../../data/fatLossHardConfig';
import { HARD_CONFIRM } from '../../data/challengeContent';
import { FutureSelfLetterForm } from '../FutureSelfLetter';
import FatLossHardSetup from '../FatLossHardSetup';
import { getTodayStr, formatDateLong } from '../../utils/dateUtils';
import { dateOffsetFromToday } from '../../utils/challengeSchedule';
import { displayXP } from '../../utils/xpDisplay';

const MODES = [
  { key: 'beginner', label: 'Beginner', blurb: 'A lighter way in. Same habits, gentler targets.' },
  { key: 'standard', label: 'Standard', blurb: 'The balanced version, and the one most people want.' },
  { key: 'hard', label: 'Hard', blurb: 'Maximum commitment. Confirmed before it begins.' },
];

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * Starting a challenge.
 *
 * The old flow was a chain of modals stacked on top of a library card —
 * hard-mode warning, a configured setup screen, the letter, then the date —
 * with no sense of how far through you were, no way back except cancelling,
 * and the full commitment never shown in one place before it was made.
 *
 * This is the same steps, in the same order, as one screen with a progress bar
 * and a working Back. Two things are deliberate:
 *
 *   • NOTHING is created until Confirm. Every step writes to local state only;
 *     `startChallenge` is called once, from one place, at the end. Backing out
 *     at any point leaves the profile exactly as it was.
 *   • The attempt is still built by `buildAttemptPayload` — the same function
 *     the preview runs through — so the review screen and the thing that gets
 *     installed cannot drift apart.
 */
export default function ChallengeSetup({ start, onCancel, onStarted }) {
  const { activeProfile, startChallenge } = useApp();
  const template = start?.template;
  const isLegacy75 = !!start?.legacy75;
  const isVariant = template?.start_flow === 'variant';
  const isConfigured = template?.start_flow === 'configured';
  const isMT = template?.id === MENTAL_TRAINING_TEMPLATE_ID;

  const [mode, setMode] = useState(start?.variant || 'standard');
  const [duration, setDuration] = useState(start?.durationDays ?? getDefaultDuration(template));
  const [coldUpgrade, setColdUpgrade] = useState(false);
  const [configuredSetup, setConfiguredSetup] = useState(null);
  const [hardSetup, setHardSetup] = useState(null);
  const [letter, setLetter] = useState(null);
  const [startDate, setStartDate] = useState(getTodayStr());
  const [customDate, setCustomDate] = useState('');
  const [stepIndex, setStepIndex] = useState(0);

  const modes = isVariant ? MODES.filter(m => template.variants?.[m.key]) : [];

  // The steps this particular challenge actually needs. A configured challenge
  // has no mode or duration chips of its own — its setup screen owns both — so
  // offering them would ask the same question twice and let the answers differ.
  const steps = useMemo(() => {
    const out = [];
    if (modes.length > 1) out.push('mode');
    if (!isConfigured && (template?.duration_options_days?.length || 0) > 1) out.push('duration');
    if (isConfigured) out.push('configure');
    if (isMT) out.push('cold');
    if (isVariant && mode === 'hard') out.push('hardWarn');
    if (template?.id === FLH.FAT_LOSS_TEMPLATE_ID && mode === 'hard') out.push('hardSetup');
    out.push('review');
    out.push('letter');
    out.push('when');
    return out;
  }, [modes.length, isConfigured, isMT, isVariant, mode, template]);

  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const total = steps.length;

  const preview = useMemo(() => previewAttempt({
    template,
    variant: isVariant ? mode : 'standard',
    durationDays: configuredSetup?.durationDays || duration,
    // Before the configure step runs there is no setup object yet, so the
    // chosen length is carried in one — otherwise the review would price the
    // challenge at its default length whatever was picked.
    configuredSetup: configuredSetup || (isConfigured && duration ? { durationDays: duration } : null),
    coldExposureUpgradeEnabled: isMT ? coldUpgrade : false,
    hardSetup,
    legacy: isLegacy75 ? { meta: DISCIPLINE_75_META, tasks: discipline75Tasks(activeProfile) } : null,
  }), [template, mode, duration, configuredSetup, coldUpgrade, hardSetup, isVariant, isConfigured, isMT, isLegacy75, activeProfile]);

  const scale = preview?.displayScale ?? 1;
  const xp = (v) => displayXP(v || 0, scale).toLocaleString();

  function back() {
    if (stepIndex === 0) onCancel();
    else setStepIndex(i => i - 1);
  }
  function next() {
    setStepIndex(i => Math.min(i + 1, steps.length - 1));
  }

  /** The one place an attempt is created. Reached only from Confirm. */
  function confirm(date) {
    const payload = buildAttemptPayload({
      template,
      variant: isVariant ? mode : 'standard',
      durationDays: configuredSetup?.durationDays || duration,
      configuredSetup: configuredSetup || (isConfigured && duration ? { durationDays: duration } : null),
      coldExposureUpgradeEnabled: isMT ? coldUpgrade : false,
      hardSetup,
      legacy: isLegacy75 ? { meta: DISCIPLINE_75_META, tasks: discipline75Tasks(activeProfile) } : null,
    });
    if (!payload) return;
    startChallenge(undefined, { ...payload, futureSelfLetter: letter, startDate: date });
    onStarted();
  }

  if (!template) return null;

  // A configured challenge's own setup screen and the Fat Loss Hard screen are
  // existing, tested components. They are shown as themselves rather than
  // rebuilt — the flow just treats each as one of its steps.
  if (step === 'configure' && CONFIGURED_SETUPS[template.id]) {
    const { Setup } = CONFIGURED_SETUPS[template.id];
    return (
      <Setup
        initialSetup={configuredSetup || (duration ? { durationDays: duration } : null)}
        onCancel={back}
        onSubmit={(setup) => {
          setConfiguredSetup(setup);
          if (setup?.durationDays) setDuration(setup.durationDays);
          next();
        }}
      />
    );
  }
  if (step === 'hardSetup') {
    return (
      <FatLossHardSetup
        onCancel={back}
        onSubmit={(hs) => { setHardSetup(hs); next(); }}
      />
    );
  }
  if (step === 'letter') {
    return (
      <FutureSelfLetterForm
        challengeName={template.challenge_name}
        onCancel={back}
        onSubmit={(l) => { setLetter(l); next(); }}
      />
    );
  }

  return (
    <div className="f4c-setup">
      <header className="f4c-subhead">
        <button type="button" className="f4c-back" onClick={back} aria-label="Back">‹</button>
        <span className="f4c-subhead-title">Start {template.challenge_name}</span>
      </header>

      <div className="f4c-steps">
        <div className="f4c-steps-bar" role="progressbar"
          aria-valuenow={stepIndex + 1} aria-valuemin={1} aria-valuemax={total}
          aria-label={`Step ${stepIndex + 1} of ${total}`}>
          <div className="f4c-steps-fill" style={{ width: `${((stepIndex + 1) / total) * 100}%` }} />
        </div>
        <span className="f4c-steps-label">Step {stepIndex + 1} of {total}</span>
      </div>

      {step === 'mode' && (
        <section className="f4c-card">
          <h3 className="f4c-card-h">Choose your difficulty</h3>
          <p className="f4c-note">Every requirement and XP figure updates with this choice.</p>
          <div className="f4c-modes col" role="radiogroup" aria-label="Difficulty">
            {modes.map(m => (
              <button
                key={m.key}
                type="button"
                role="radio"
                aria-checked={mode === m.key}
                className={`f4c-mode tpl-variant-tab${mode === m.key ? ' on active' : ''}`}
                onClick={() => setMode(m.key)}
              >
                <span className="f4c-mode-l">{m.label}</span>
                <span className="f4c-mode-s">
                  {template.variants?.[m.key]?.progression || m.blurb}
                </span>
              </button>
            ))}
          </div>
          <RequirementPeek preview={preview} xp={xp} />
        </section>
      )}

      {step === 'duration' && (
        <section className="f4c-card">
          <h3 className="f4c-card-h">Choose your length</h3>
          <p className="f4c-note">You can end early at any point. Nothing locks you in.</p>
          <div className="f4c-durations col" role="radiogroup" aria-label="Length">
            {template.duration_options_days.map(d => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={duration === d}
                className={`f4c-dur wide tpl-duration-card${duration === d ? ' on active' : ''}`}
                onClick={() => setDuration(d)}
              >
                <span className="f4c-dur-n">{d} days</span>
                <span className="f4c-dur-l">
                  {getDurationLabel(template, d) || ''}
                  {isRecommendedDuration(template, d) ? ' · Recommended' : ''}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 'cold' && (
        <section className="f4c-card">
          <h3 className="f4c-card-h">Cold Exposure Upgrade</h3>
          <p className="f4c-note">
            Optional. Adds a 30–60 second cold finish as a <strong>required</strong> daily habit, which
            then counts toward your grade and XP like any other. It joins the same daily budget, so
            every requirement is repriced rather than the day getting bigger.
          </p>
          <div className="f4c-toggle-row">
            <span>Add it to this attempt</span>
            <button
              type="button"
              role="switch"
              aria-checked={coldUpgrade}
              className={`f4c-switch${coldUpgrade ? ' on' : ''}`}
              onClick={() => setColdUpgrade(v => !v)}
            >
              {coldUpgrade ? 'On' : 'Off'}
            </button>
          </div>
          <p className="f4c-warn">
            ⚠️ Skip cold exposure if you feel dizzy, hypoglycemic, sick or unusually weak. Once the
            challenge starts it cannot be removed from this attempt.
          </p>
          {coldUpgrade && (
            <div className="f4c-xp-row">
              <span>{COLD_SHOWER_TASK.icon} Cold Shower</span>
              <strong>{xp(preview?.tasks.find(t => t.id === COLD_SHOWER_TASK.id)?.xp)} XP</strong>
            </div>
          )}
        </section>
      )}

      {step === 'hardWarn' && (
        <section className="f4c-card">
          <h3 className="f4c-card-h">{HARD_CONFIRM.title}</h3>
          {HARD_CONFIRM.body.split('\n\n').map((p, i) => <p key={i} className="f4c-note">{p}</p>)}
        </section>
      )}

      {step === 'review' && preview && (
        <section className="f4c-card">
          <h3 className="f4c-card-h">Review your commitment</h3>
          <div className="f4c-review-id">
            <span className="f4c-active-emoji" aria-hidden="true">{template.emoji}</span>
            <span className="f4c-active-id">
              <span className="f4c-active-name">{template.challenge_name}</span>
              <span className="f4c-active-meta">
                {preview.durationDays} days
                {isVariant && mode ? ` · ${capitalize(mode)}` : ''}
                {' · Primary Challenge'}
              </span>
            </span>
          </div>

          <div className="f4c-review-sec">Every day</div>
          <ul className="f4c-reqs tight">
            {preview.tasks.map(t => (
              <li key={t.id} className="f4c-req">
                <span className="f4c-req-icon" aria-hidden="true">{t.icon || '•'}</span>
                <span className="f4c-req-body">
                  <span className="f4c-req-name">
                    {t.name}
                    {t.keystone > 0 && <span className="f4c-stars">{'⭐'.repeat(t.keystone)}</span>}
                  </span>
                </span>
                <span className="f4c-req-xp">{xp(t.xp)} XP</span>
              </li>
            ))}
          </ul>

          {preview.weekly?.length > 0 && (
            <>
              <div className="f4c-review-sec">Every week</div>
              <ul className="f4c-reqs tight">
                {preview.weekly.map(w => (
                  <li key={w.id} className="f4c-req">
                    <span className="f4c-req-icon" aria-hidden="true">{w.icon || '•'}</span>
                    <span className="f4c-req-body">
                      <span className="f4c-req-name">{w.label} — {w.perWeek}× per week</span>
                    </span>
                    <span className="f4c-req-xp">{xp(w.xp)} XP each</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="f4c-review-sec">To pass</div>
          <div className="f4c-xp-rows">
            <div className="f4c-xp-row">
              <span>Challenge score needed</span><strong>{preview.meta.passingScore}%</strong>
            </div>
            {preview.meta.keystoneRequirement > 0 && (
              <div className="f4c-xp-row">
                <span>Keystone habits kept</span><strong>{preview.meta.keystoneRequirement}%</strong>
              </div>
            )}
          </div>

          <div className="f4c-review-sec">XP</div>
          <div className="f4c-xp-rows">
            <div className="f4c-xp-row">
              <span>Daily habits</span><strong>{xp(preview.dailyTaskXP)} XP</strong>
            </div>
            <div className="f4c-xp-row">
              <span>Perfect day bonus</span><strong>+{xp(preview.perfectDayBonus)} XP</strong>
            </div>
            {preview.completionBonus > 0 && (
              <div className="f4c-xp-row">
                <span>Completion bonus</span><strong>+{xp(preview.completionBonus)} XP</strong>
              </div>
            )}
            <div className="f4c-xp-row muted">
              <span>Each missed day</span><strong>−{xp(preview.missedDayPenalty)} XP</strong>
            </div>
            {preview.projectedPerfectTotal != null && (
              <div className="f4c-xp-row total">
                <span>A perfect {preview.durationDays} days</span>
                <strong>{xp(preview.projectedPerfectTotal)} XP</strong>
              </div>
            )}
          </div>
          <p className="f4c-note">
            Nothing has started yet. The next two steps are your Future Self Letter and when Day 1
            begins.
          </p>
        </section>
      )}

      {step === 'when' && (
        <section className="f4c-card">
          <h3 className="f4c-card-h">When does Day 1 begin?</h3>
          <p className="f4c-note">
            Tasks, XP, streaks and scoring all start then. A future date counts no missed days
            before it arrives.
          </p>
          <div className="f4c-durations col start-when-options" role="radiogroup" aria-label="Start date">
            <button
              type="button" role="radio" aria-checked={startDate === getTodayStr()}
              className={`f4c-dur wide start-when-btn${startDate === getTodayStr() ? ' on' : ''}`}
              onClick={() => { setStartDate(getTodayStr()); setCustomDate(''); }}
            >
              <span className="f4c-dur-n">Start Today</span>
              <span className="f4c-dur-l">Day 1 is {formatDateLong(getTodayStr())}</span>
            </button>
            <button
              type="button" role="radio" aria-checked={startDate === dateOffsetFromToday(1)}
              className={`f4c-dur wide start-when-btn${startDate === dateOffsetFromToday(1) ? ' on' : ''}`}
              onClick={() => { setStartDate(dateOffsetFromToday(1)); setCustomDate(''); }}
            >
              <span className="f4c-dur-n">Start Tomorrow</span>
              <span className="f4c-dur-l">Day 1 is {formatDateLong(dateOffsetFromToday(1))}</span>
            </button>
            <label className={`f4c-dur wide choose start-when-btn${customDate && startDate === customDate ? ' on' : ''}`}>
              <span className="f4c-dur-n">Choose Date</span>
              <input
                type="date"
                className="f4c-date"
                min={getTodayStr()}
                value={customDate}
                onChange={e => {
                  setCustomDate(e.target.value);
                  if (e.target.value >= getTodayStr()) setStartDate(e.target.value);
                }}
              />
            </label>
          </div>
        </section>
      )}

      <div className="f4c-cta row">
        <button type="button" className="f4c-btn ghost" onClick={back}>
          {stepIndex === 0 ? 'Cancel' : '← Back'}
        </button>
        {step === 'when' ? (
          <button type="button" className="f4c-btn primary" onClick={() => confirm(startDate)}>
            {startDate === getTodayStr() ? 'Start now' : `Schedule for ${formatDateLong(startDate)}`}
          </button>
        ) : (
          <button type="button" className="f4c-btn primary" onClick={next}>
            {step === 'review' ? 'Looks right →' : 'Next →'}
          </button>
        )}
      </div>
    </div>
  );
}

/** A glance at what the current choices mean, without leaving the step. */
function RequirementPeek({ preview, xp }) {
  if (!preview?.tasks?.length) return null;
  return (
    <div className="f4c-peek">
      <div className="f4c-peek-h">
        {preview.tasks.length} daily habits · {xp(preview.dailyTaskXP)} XP a day
      </div>
      <ul className="f4c-peek-list">
        {preview.tasks.slice(0, 4).map(t => (
          <li key={t.id}>{t.icon || '•'} {t.name}</li>
        ))}
        {preview.tasks.length > 4 && <li className="f4c-dim">+{preview.tasks.length - 4} more</li>}
      </ul>
    </div>
  );
}
