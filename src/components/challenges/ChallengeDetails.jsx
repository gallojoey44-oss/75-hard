import { useMemo, useState } from 'react';
import { useApp, DISCIPLINE_75_META, discipline75Tasks } from '../../context/AppContext';
import { previewAttempt } from '../../data/challengeAttempt';
import {
  difficultyLabel, difficultyRange, getDefaultDuration, durationRangeText,
  getProgramForDuration, getDurationLabel, isRecommendedDuration, METRIC_LABELS,
} from '../../data/challengeTemplates';
import { focusTagsOf, focusLabel } from '../../data/challengeFocus';
import { TIER_LABELS } from '../../data/xpEconomy';
import { guideForTask } from '../../data/habitGuides';
import HabitGuide from '../HabitGuide';
import { displayXP } from '../../utils/xpDisplay';

const DIFFICULTY_COLOR = {
  Easy: '#6fcf97', Medium: '#f5b23a', 'Medium-Hard': '#f58a3a', Hard: '#ff7a7a',
};
const MODES = [
  { key: 'beginner', label: 'Beginner' },
  { key: 'standard', label: 'Standard' },
  { key: 'hard', label: 'Hard' },
];

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * One challenge, as a page.
 *
 * This replaces the expanding library card. The thing that made the old panel
 * unreadable was not its length but its order: it opened with programme prose
 * and difficulty philosophy, and the requirements — the only part that tells
 * you what you would actually be doing every day — were most of a screen down.
 *
 * So the requirements lead, priced from the real attempt. Everything
 * educational is still here and is still complete; it sits under a disclosure,
 * one tap away, instead of in front of the thing it explains.
 *
 * Mode and duration are LIVE here. Changing either re-prices the whole page
 * from `previewAttempt`, which is the same function that builds the attempt on
 * start — so what this page advertises is what starting installs, and the
 * choices made here carry into the setup flow rather than being asked twice.
 */
export default function ChallengeDetails({
  template, onBack, onStart, onOpenActive, activeTemplateId, supportTemplateId,
}) {
  const { activeProfile } = useApp();
  const [mode, setMode] = useState(() => {
    const vs = template?.variants;
    return vs?.standard ? 'standard' : (Object.keys(vs || {})[0] || 'standard');
  });
  const [duration, setDuration] = useState(() => getDefaultDuration(template));
  const [guideTask, setGuideTask] = useState(null);
  const [showProgram, setShowProgram] = useState(false);

  const isLegacy75 = template?.id === DISCIPLINE_75_META.templateId;
  const isConfigured = template?.start_flow === 'configured';
  const isVariant = template?.start_flow === 'variant';
  const isActive = template?.id === activeTemplateId;
  const isSupport = template?.id === supportTemplateId;
  const soon = !template?.startable;
  // A configured challenge builds its own attempt from its setup screen, so the
  // modes here would be decoration. Only a variant challenge really has them.
  const modes = isVariant ? MODES.filter(m => template.variants?.[m.key]) : [];

  // The attempt these choices would create, stamped exactly as starting it
  // would be. Every figure below reads from it.
  const preview = useMemo(() => previewAttempt({
    template,
    variant: isVariant ? mode : 'standard',
    durationDays: duration,
    // A configured challenge builds its own descriptor from a setup object, so
    // the length has to be handed to the BUILDER — `durationDays` alone never
    // reaches it, and the page would price every length identically.
    configuredSetup: isConfigured ? { durationDays: duration } : null,
    legacy: isLegacy75 ? { meta: DISCIPLINE_75_META, tasks: discipline75Tasks(activeProfile) } : null,
  }), [template, mode, duration, isVariant, isConfigured, isLegacy75, activeProfile]);

  if (!template) return null;

  const range = difficultyRange(template);
  const rating = difficultyLabel(template, isVariant && template.effort_tier_by_variant ? mode : null);
  const tags = focusTagsOf(template);
  const scale = preview?.displayScale ?? 1;
  const xp = (v) => displayXP(v || 0, scale).toLocaleString();
  const program = getProgramForDuration(template, duration);
  // Named lengths get the roomier row; a bare list of numbers stays compact.
  const labelled = !!template.duration_labels
    || template.duration_options_days?.some(d => isRecommendedDuration(template, d));

  return (
    <div className="f4c-details">
      <header className="f4c-subhead">
        <button type="button" className="f4c-back" onClick={onBack} aria-label="Back to Challenges">‹</button>
        <span className="f4c-subhead-title">{template.challenge_name}</span>
      </header>

      {/* ── Identity ─────────────────────────────────────────────────── */}
      <section className="f4c-hero">
        <span className="f4c-hero-emoji" aria-hidden="true">{template.emoji}</span>
        <h2 className="f4c-hero-name">{template.challenge_name}</h2>
        {template.tagline && <p className="f4c-hero-tag">{template.tagline}</p>}
        <p className="f4c-hero-purpose">{template.purpose}</p>

        <div className="f4c-hero-tags">
          {tags.map(t => <span key={t} className="f4c-tag">{focusLabel(t)}</span>)}
        </div>

        <div className="f4c-facts">
          <div className="f4c-fact">
            <span className="f4c-fact-v" style={{ color: DIFFICULTY_COLOR[TIER_LABELS[range.tier]] }}>
              {rating}
            </span>
            <span className="f4c-fact-l">Difficulty</span>
          </div>
          <div className="f4c-fact">
            <span className="f4c-fact-v">{durationRangeText(template)}</span>
            <span className="f4c-fact-l">Length</span>
          </div>
          {preview && (
            <div className="f4c-fact">
              <span className="f4c-fact-v">{xp(preview.dailyTaskXP + preview.perfectDayBonus)}</span>
              <span className="f4c-fact-l">XP per day</span>
            </div>
          )}
        </div>

        {(isActive || isSupport) && (
          <div className="f4c-running-note">
            You are running this as your {isActive ? 'Primary' : 'Support'} Challenge.
            <button type="button" className="f4c-link" onClick={onOpenActive}>Open it →</button>
          </div>
        )}
      </section>

      {/* ── What you'll work on ──────────────────────────────────────── */}
      {template.metrics_targeted?.length > 0 && (
        <section className="f4c-card">
          <h3 className="f4c-card-h">What you&apos;ll work on</h3>
          <ul className="f4c-work">
            {template.metrics_targeted
              .map(m => METRIC_LABELS[m])
              .filter(Boolean)
              .slice(0, 5)
              .map(label => <li key={label}>{label}</li>)}
          </ul>
          <p className="f4c-note">
            These are the measures Forge tracks for this challenge, so progress is read from
            what you log rather than claimed in advance.
          </p>
        </section>
      )}

      {/* ── Difficulty ───────────────────────────────────────────────── */}
      {modes.length > 1 && (
        <section className="f4c-card">
          <h3 className="f4c-card-h">Difficulty</h3>
          <div className="f4c-modes" role="radiogroup" aria-label="Difficulty mode">
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
                {template.variants?.[m.key]?.progression && (
                  <span className="f4c-mode-s">{template.variants[m.key].progression}</span>
                )}
              </button>
            ))}
          </div>
          <p className="f4c-note">
            The requirements and XP below update as you change this — every figure is read from
            the attempt this choice would create.
          </p>
        </section>
      )}

      {/* ── Duration ─────────────────────────────────────────────────── */}
      {(template.duration_options_days?.length > 1) && (
        <section className="f4c-card">
          <h3 className="f4c-card-h">Length</h3>
          {/* A template that names its lengths ("Kickstart", "Transformation")
              or recommends one says so here. That naming is real template data
              and is most of what makes the choice meaningful. */}
          <div
            className={`f4c-durations${labelled ? ' col' : ''}`}
            role="radiogroup"
            aria-label="Challenge length"
          >
            {template.duration_options_days.map(d => {
              const label = getDurationLabel(template, d);
              const rec = isRecommendedDuration(template, d);
              return (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={duration === d}
                  className={`f4c-dur tpl-duration-card${labelled ? ' wide' : ''}${duration === d ? ' on active' : ''}`}
                  onClick={() => setDuration(d)}
                >
                  <span className="f4c-dur-n">{d}{labelled ? ' DAYS' : ''}</span>
                  <span className="f4c-dur-l">
                    {labelled ? (label || 'days') : 'days'}
                    {rec ? ' · Recommended' : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Daily requirements — the section that matters most ───────── */}
      <section className="f4c-card">
        <h3 className="f4c-card-h">Every day</h3>
        {preview?.tasks?.length ? (
          <>
            <ul className="f4c-reqs tpl-task-list">
              {preview.tasks.map(t => {
                const g = guideForTask(t);
                return (
                  <li key={t.id} className={`f4c-req${g ? ' tpl-task-guided' : ''}`}>
                    <span className="f4c-req-icon" aria-hidden="true">{t.icon || '•'}</span>
                    <span className="f4c-req-body">
                      <span className="f4c-req-name">
                        {t.name}
                        {t.keystone > 0 && (
                          <span className="f4c-stars" title={`Keystone habit (${t.keystone} of 3)`}>
                            {'⭐'.repeat(t.keystone)}
                          </span>
                        )}
                      </span>
                      {t.desc && <span className="f4c-req-desc">{t.desc}</span>}
                      {g && (
                        <button type="button" className="f4c-link sm tpl-task-link" onClick={() => setGuideTask(t)}>
                          Strategy guide
                        </button>
                      )}
                    </span>
                    <span className="f4c-req-xp">{xp(t.xp)} XP</span>
                  </li>
                );
              })}
            </ul>
            <p className="f4c-note">
              Each requirement states what counts, so a guide is optional reading rather than
              something you need in order to know whether you finished. Opening one never
              completes a habit or awards XP.
            </p>
          </>
        ) : (
          <p className="f4c-note">
            This challenge&apos;s daily habits are not built yet, so there is nothing to price.
          </p>
        )}
      </section>

      {/* ── Weekly requirements, kept separate from the daily list ───── */}
      {preview?.weekly?.length > 0 && (
        <section className="f4c-card">
          <h3 className="f4c-card-h">Every week</h3>
          <ul className="f4c-reqs weekly tpl-task-list">
            {preview.weekly.map(w => (
              <li key={w.id} className="f4c-req">
                <span className="f4c-req-icon" aria-hidden="true">{w.icon || '•'}</span>
                <span className="f4c-req-body">
                  <span className="f4c-req-name">{w.label} — {w.perWeek}× per week</span>
                  {w.note && <span className="f4c-req-desc">{w.note}</span>}
                </span>
                <span className="f4c-req-xp">{xp(w.xp)} XP each</span>
              </li>
            ))}
          </ul>
          <p className="f4c-note">
            Weekly requirements are counted across the whole week, not day by day — a missed
            session can still be made up before the week ends.
          </p>
        </section>
      )}

      {/* ── How to approach it ───────────────────────────────────────── */}
      {(template.training_quality || template.exercise_guidance || template.physical_examples?.length > 0) && (
        <section className="f4c-card">
          <h3 className="f4c-card-h">How to approach it</h3>
          {template.training_quality && (
            <p className="f4c-note">
              <strong>{template.training_quality.headline}.</strong> {template.training_quality.body}
            </p>
          )}
          {template.exercise_guidance && (
            <p className="f4c-note">
              <strong>{template.exercise_guidance.principle}</strong> {template.exercise_guidance.notice}
            </p>
          )}
          {template.physical_examples?.length > 0 && (
            <p className="f4c-note">
              Any intentional movement counts, even a walk — {template.physical_examples.join(', ').toLowerCase()}.
              No hard workout required.
            </p>
          )}
        </section>
      )}

      {/* ── XP ───────────────────────────────────────────────────────── */}
      {preview && (
        <section className="f4c-card">
          <h3 className="f4c-card-h">XP for this setup</h3>
          <div className="f4c-xp-rows">
            <div className="f4c-xp-row">
              <span>Daily habits ({preview.tasks.length})</span><strong>{xp(preview.dailyTaskXP)} XP</strong>
            </div>
            <div className="f4c-xp-row">
              <span>Perfect day bonus</span><strong>+{xp(preview.perfectDayBonus)} XP</strong>
            </div>
            {preview.weeklyPerWeek > 0 && (
              <div className="f4c-xp-row">
                <span>Weekly requirements</span><strong>{xp(preview.weeklyPerWeek)} XP / week</strong>
              </div>
            )}
            {preview.streakXP > 0 && (
              <div className="f4c-xp-row">
                <span>Streak milestones</span><strong>+{xp(preview.streakXP)} XP</strong>
              </div>
            )}
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
        </section>
      )}

      {/* ── What the programme expects, under a disclosure ──────────── */}
      {(program?.expected_results?.length > 0 || program?.timeline || program?.why_it_works
        || template.inspiration_sources?.length > 0) && (
        <section className="f4c-card">
          <button
            type="button"
            className="f4c-disclose"
            aria-expanded={showProgram}
            onClick={() => setShowProgram(v => !v)}
          >
            <span>What {duration} days typically looks like</span>
            <span className="f4c-chevron" aria-hidden="true">{showProgram ? '▾' : '▸'}</span>
          </button>
          {showProgram && (
            <div className="f4c-disclose-body">
              {program?.why_it_works && <p className="f4c-phase-b">{program.why_it_works}</p>}
              {program?.expected_results?.length > 0 && (
                <>
                  <div className="f4c-phase-h">Expected Results ({duration} Days)</div>
                  <ul className="f4c-work">
                    {program.expected_results.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </>
              )}
              {/* Shown with the results, never apart from them — the figures
                  above are typical, not promised. */}
              {program?.results_disclaimer && (
                <p className="f4c-note">{program.results_disclaimer}</p>
              )}
              {template.inspiration_sources?.length > 0
                && template.inspiration_sources[0] !== 'User-defined' && (
                <p className="f4c-note">Informed by: {template.inspiration_sources.join(', ')}</p>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Start ────────────────────────────────────────────────────── */}
      <div className="f4c-cta">
        {soon ? (
          <>
            <button type="button" className="f4c-btn" disabled>Coming Soon</button>
            <p className="f4c-note">
              This challenge is designed but its daily habits are not built yet, so it cannot be
              started or earn XP.
            </p>
          </>
        ) : isActive || isSupport ? (
          <button type="button" className="f4c-btn ghost" onClick={onOpenActive}>
            Already running — open it
          </button>
        ) : (
          <button
            type="button"
            className="f4c-btn primary"
            onClick={() => onStart({
              template,
              variant: isVariant ? mode : (isConfigured ? 'standard' : null),
              durationDays: duration,
              legacy75: isLegacy75,
            })}
          >
            Start {template.challenge_name}
          </button>
        )}
      </div>

      {/* Read-only: no xp, no checked state, no toggle, so nothing opened here
          can complete a habit or award XP. */}
      {guideTask && (
        <HabitGuide guide={guideForTask(guideTask)} onClose={() => setGuideTask(null)} />
      )}
    </div>
  );
}
