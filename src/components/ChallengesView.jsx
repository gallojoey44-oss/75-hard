import { useState } from 'react';
import { useApp } from '../context/AppContext';
import BuildBanner from './BuildBanner';
import { METRIC_LABELS, visibleChallenges } from '../data/challengeTemplates';
import { DIFFICULTY_GUIDE, PHILOSOPHY, HARD_CONFIRM } from '../data/challengeContent';
import { FutureSelfLetterForm } from './FutureSelfLetter';

const EVIDENCE_COLOR = {
  strong:       '#10B981',
  moderate:     '#F59E0B',
  anecdotal:    '#9090B8',
  user_defined: '#8B5CF6',
};
// Overall challenge difficulty — fixed per challenge, independent of the
// Beginner/Standard/Hard mode chosen inside it.
const DIFFICULTY_COLOR = {
  'Easy':        '#10B981',
  'Medium':      '#F59E0B',
  'Medium/Hard': '#F97316',
  'Hard':        '#EF4444',
  'You decide':  '#8B5CF6',
};
const LEVEL_LABEL = { user_defined: 'You decide' };

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

const VARIANT_TABS = [
  { key: 'beginner', label: 'Beginner' },
  { key: 'standard', label: 'Standard' },
  { key: 'hard',     label: 'Hard' },
];

function levelText(v) {
  return LEVEL_LABEL[v] || v;
}

function durationText(days) {
  if (!days?.length) return '';
  if (days.length === 1) return `${days[0]} days`;
  if (days.length === 2) return `${days[0]} or ${days[1]} days`;
  return `${days.slice(0, -1).join(', ')}, or ${days[days.length - 1]} days`;
}

function VariantPanel({ variant, template }) {
  if (!variant) return null;
  const hasColdShower = variant.required_daily_tasks.some(t => /cold shower/i.test(t));
  return (
    <div className="tpl-variant-panel">
      <div className="tpl-variant-section-label">Daily tasks</div>
      <ul className="tpl-task-list">
        {variant.required_daily_tasks.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
      {variant.weekly_requirements?.length > 0 && (
        <>
          <div className="tpl-variant-section-label">Weekly requirements</div>
          <ul className="tpl-task-list weekly">
            {variant.weekly_requirements.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </>
      )}
      {variant.optional_tasks?.length > 0 && (
        <>
          <div className="tpl-variant-section-label">Optional</div>
          <ul className="tpl-task-list optional">
            {variant.optional_tasks.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </>
      )}
      {variant.expected_results && (
        <div className="tpl-variant-expected">
          📈 Expected on this mode: <strong>{variant.expected_results}</strong>
        </div>
      )}
      {template.physical_examples?.length > 0 && (
        <div className="tpl-panel-note">
          <strong>Physical discipline block</strong> — short and scalable, not a full workout.
          Pick one: {template.physical_examples.join(', ').toLowerCase()}.
        </div>
      )}
      {hasColdShower && (
        <div className="tpl-panel-note">
          <strong>Cold shower finish</strong> — optional if you have a medical reason, feel
          lightheaded, or react poorly to cold. Keep it brief. It&apos;s a discipline cue, not an endurance test.
        </div>
      )}
    </div>
  );
}

// Transformation-program sections (🎯 Goal, 📈 Expected Results, etc.) for
// templates that ship full program content.
function ProgramSections({ program, category }) {
  if (!program) return null;
  return (
    <div className="tpl-program">
      {category && <div className="tpl-program-category">🏷 {category}</div>}

      {/* Expected results — shown prominently, not collapsed */}
      <div className="tpl-program-block">
        <div className="tpl-program-title">📈 Expected Results (30 Days)</div>
        <ul className="tpl-task-list program">
          {program.expected_results.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
        <div className="tpl-program-disclaimer">{program.results_disclaimer}</div>
      </div>

      <details className="tpl-program-details">
        <summary className="tpl-program-summary">🎯 Goal</summary>
        <p className="tpl-program-text">{program.goal}</p>
      </details>

      <details className="tpl-program-details">
        <summary className="tpl-program-summary">👀 What You&apos;ll Notice</summary>
        <ul className="tpl-task-list program">
          {program.visual_changes.map((v, i) => <li key={i}>{v}</li>)}
        </ul>
      </details>

      <details className="tpl-program-details">
        <summary className="tpl-program-summary">🧠 Why This Works</summary>
        <div className="tpl-program-pillars">
          {program.why_it_works.map((p, i) => (
            <div key={i} className="tpl-program-pillar">
              <div className="tpl-program-pillar-name">{p.pillar}</div>
              <ul className="tpl-task-list program">
                {p.points.map((pt, j) => <li key={j}>{pt}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </details>

      <details className="tpl-program-details">
        <summary className="tpl-program-summary">📅 Transformation Timeline</summary>
        <div className="tpl-program-pillars">
          {program.timeline.map((w, i) => (
            <div key={i} className="tpl-program-pillar">
              <div className="tpl-program-pillar-name">{w.week}</div>
              <ul className="tpl-task-list program">
                {w.points.map((pt, j) => <li key={j}>{pt}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </details>

      <details className="tpl-program-details">
        <summary className="tpl-program-summary">📷 Progress</summary>
        <ul className="tpl-task-list program">
          {program.progress.items.map((p, i) => <li key={i}>{p}</li>)}
        </ul>
        <p className="tpl-program-text">{program.progress.finish}</p>
      </details>
    </div>
  );
}

function ChallengeCard({ template, isActive, activeVariant, onStart, setView }) {
  const [expanded, setExpanded] = useState(false);
  const [variantTab, setVariantTab] = useState('standard');
  const isVariantStart = template.start_flow === 'variant';
  const isCustom = template.id === 'custom_challenge_framework';
  const defaultDuration = template.duration_options_days[Math.floor((template.duration_options_days.length - 1) / 2)];
  const [durationSel, setDurationSel] = useState(defaultDuration);

  return (
    <div className={`challenge-card${isActive ? ' active' : ''}`}>
      <button
        className="challenge-card-header"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
      >
        <span className="challenge-card-emoji">{template.emoji}</span>
        <div className="challenge-card-info">
          <div className="challenge-card-name">{template.challenge_name}</div>
          <div className="challenge-card-meta">
            {isCustom ? (
              <>
                Custom · <span style={{ color: DIFFICULTY_COLOR[template.overall_difficulty] }}>Difficulty: {template.overall_difficulty}</span>
              </>
            ) : (
              <>
                {durationText(template.duration_options_days)}
                {' · '}
                <span style={{ color: DIFFICULTY_COLOR[template.overall_difficulty] }}>
                  {template.overall_difficulty} challenge
                </span>
                {' · '}
                <span style={{ color: EVIDENCE_COLOR[template.evidence_level] }}>
                  {levelText(template.evidence_level)} evidence
                </span>
              </>
            )}
          </div>
        </div>
        <div className="challenge-card-badges">
          {isActive && (
            <span className="challenge-active-badge">
              Active{activeVariant ? ` · ${capitalize(activeVariant)} mode` : ''}
            </span>
          )}
          <span className="challenge-expand-icon">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="challenge-card-body">
          <p className="challenge-card-desc">{template.purpose}</p>
          {template.tagline && (
            <p className="tpl-tagline">{template.tagline}</p>
          )}

          <ProgramSections program={template.program} category={template.category} />

          <div className="tpl-detail-row">
            <span className="tpl-detail-label">Duration</span>
            <div className="tpl-chip-group">
              {template.duration_options_days.map(d => (
                isVariantStart ? (
                  <button
                    key={d}
                    className={`tpl-duration-chip${durationSel === d ? ' active' : ''}`}
                    onClick={() => setDurationSel(d)}
                  >
                    {d} days
                  </button>
                ) : (
                  <span key={d} className="challenge-focus-chip">{d} days</span>
                )
              ))}
            </div>
          </div>

          <div className="tpl-detail-row">
            <span className="tpl-detail-label">Targets</span>
            <div className="tpl-chip-group">
              {template.metrics_targeted.map(m => (
                <span key={m} className="challenge-focus-chip">{METRIC_LABELS[m] || m}</span>
              ))}
            </div>
          </div>

          <div className="tpl-detail-row">
            <span className="tpl-detail-label">Difficulty</span>
            <span className="tpl-level-value" style={{ color: DIFFICULTY_COLOR[template.overall_difficulty] }}>
              {template.overall_difficulty}
            </span>
            <span className="tpl-detail-label" style={{ marginLeft: 14 }}>Evidence</span>
            <span className="tpl-level-value" style={{ color: EVIDENCE_COLOR[template.evidence_level] }}>
              {levelText(template.evidence_level)}
            </span>
          </div>

          {/* Difficulty selector */}
          <div className="tpl-detail-label" style={{ margin: '12px 0 6px' }}>Choose Your Difficulty</div>
          <div className="tpl-variant-tabs" style={{ margin: '0 0 8px' }}>
            {VARIANT_TABS.map(v => {
              const rec = DIFFICULTY_GUIDE[v.key]?.recommended;
              return (
                <button
                  key={v.key}
                  className={`tpl-variant-tab${variantTab === v.key ? ' active' : ''}`}
                  onClick={() => setVariantTab(v.key)}
                >
                  {v.label}{rec ? ' ★' : ''}
                </button>
              );
            })}
          </div>
          {DIFFICULTY_GUIDE[variantTab] && (
            <div className="tpl-difficulty-guide">
              <div className="tpl-difficulty-guide-title">
                {DIFFICULTY_GUIDE[variantTab].label}
                {DIFFICULTY_GUIDE[variantTab].recommended && <span className="tpl-recommended-tag">Recommended</span>}
              </div>
              {template.variants[variantTab]?.progression && (
                <div className="tpl-progression">{template.variants[variantTab].progression}</div>
              )}
              <ul className="tpl-task-list program">
                {DIFFICULTY_GUIDE[variantTab].points.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}
          <div className="tpl-philosophy">
            <strong>{PHILOSOPHY.headline}.</strong> {PHILOSOPHY.body}
          </div>
          <VariantPanel variant={template.variants[variantTab]} template={template} />

          {template.inspiration_sources?.length > 0 && template.inspiration_sources[0] !== 'User-defined' && (
            <div className="tpl-sources">Informed by: {template.inspiration_sources.join(', ')}</div>
          )}

          {isActive && (
            <button className="btn btn-ghost challenge-card-action" onClick={() => setView('today')}>
              Log Today →
            </button>
          )}
          {!isActive && template.startable && isVariantStart && (
            <button
              className="btn btn-primary challenge-card-action"
              onClick={() => onStart({ variant: variantTab, durationDays: durationSel })}
            >
              Start {template.challenge_name}
            </button>
          )}
          {!isActive && template.startable && !isVariantStart && (
            <button className="btn btn-primary challenge-card-action" onClick={() => onStart(null)}>
              Start Challenge
            </button>
          )}
          {!isActive && !template.startable && (
            <div className="tpl-ready-note">Template ready — start flow coming next.</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ChallengesView({ setView }) {
  const {
    activeProfile,
    profile, getChallengeMeta, getDayNumber, getDayCompletion,
    getStreak,
    startChallenge,
    isChallengeTemplateOutdated, syncActiveChallengeWithTemplate, isForgeDaily,
  } = useApp();

  // Challenge library filtered by the active profile (e.g. Women's Hormone
  // Health is female-only). Centralized in visibleChallenges — future
  // profile-specific challenges only need an `audience` tag.
  const libraryChallenges = visibleChallenges(activeProfile);

  const [showStartConfirm, setShowStartConfirm] = useState(false);
  // Start flow: { template, variant, durationDays, step, legacy75 }
  // step: 'hardWarn' → 'letter'. Standard/Beginner skip straight to 'letter'.
  const [pendingStart, setPendingStart] = useState(null);
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);

  const meta      = getChallengeMeta();
  const baseline  = isForgeDaily();
  const duration  = meta.durationDays || 75;
  const dayNum    = getDayNumber();
  const todayPct  = dayNum ? getDayCompletion(dayNum) : 0;
  const streak    = getStreak();
  // Forge Daily is the baseline, not a "challenge" — so the tab shows the
  // no-active-challenge state and the library to start a real one.
  const isRunning = !!profile?.challengeStart && !baseline;

  const totalDone = dayNum
    ? Array.from({ length: dayNum }, (_, i) => i + 1).filter(n => getDayCompletion(n) === 100).length
    : 0;

  // Begin a challenge once difficulty is confirmed and the Future Self Letter
  // is written. Handles both the variant flow and the legacy 75-day flow.
  function beginChallenge(letter) {
    const ps = pendingStart;
    if (!ps) return;
    if (ps.legacy75) {
      startChallenge(undefined, { futureSelfLetter: letter });
    } else {
      const variantDef = ps.template.variants[ps.variant];
      startChallenge(undefined, {
        challenge: {
          templateId: ps.template.id,
          name: ps.template.challenge_name,
          emoji: ps.template.emoji,
          variant: ps.variant,
          durationDays: ps.durationDays,
          templateVersion: ps.template.template_version || 1,
          rewardXP: ps.template.rewards?.xp || 0,
          badgeId: ps.template.rewards?.badge_id || null,
        },
        tasks: variantDef.start_tasks,
        futureSelfLetter: letter,
      });
    }
    setPendingStart(null);
    setView('today');
  }

  return (
    <div className="challenges-view">
      <BuildBanner />
      <div className="page-header">
        <h2>🎯 Challenges</h2>
      </div>

      <div className="challenges-content">

        {/* Active challenge summary */}
        {isRunning ? (
          <div className="active-challenge-card">
            <div className="acc-label-row">
              <span className="acc-dot" />
              <span className="acc-label">Active Challenge</span>
            </div>
            <div className="acc-name">
              {meta.emoji} {meta.name}
              {meta.variant ? ` · ${capitalize(meta.variant)} mode` : ''}
            </div>
            <div className="acc-stats-row">
              <div className="acc-stat">
                <div className="acc-stat-value">Day {dayNum}</div>
                <div className="acc-stat-label">of {duration}</div>
              </div>
              <div className="acc-stat">
                <div className="acc-stat-value">{todayPct}%</div>
                <div className="acc-stat-label">Today</div>
              </div>
              <div className="acc-stat">
                <div className="acc-stat-value">{streak}d</div>
                <div className="acc-stat-label">Streak</div>
              </div>
              <div className="acc-stat">
                <div className="acc-stat-value">{totalDone}</div>
                <div className="acc-stat-label">Perfect</div>
              </div>
            </div>
            <div className="acc-progress-wrap">
              <div className="acc-progress-track">
                <div
                  className="acc-progress-fill"
                  style={{ width: `${((dayNum || 0) / duration) * 100}%` }}
                />
              </div>
              <span className="acc-progress-label">{Math.round(((dayNum || 0) / duration) * 100)}% complete</span>
            </div>
            {isChallengeTemplateOutdated() && (
              <div className="tpl-update-box">
                <div className="tpl-update-notice">🆕 A newer version of this challenge template is available.</div>
                <button className="btn btn-primary btn-full" onClick={() => setShowSyncConfirm(true)}>
                  Update Active Challenge
                </button>
                <p className="tpl-update-hint">
                  Updating the challenge will refresh template tasks but keep your custom tasks.
                </p>
              </div>
            )}
            <div className="acc-actions">
              <button className="btn btn-primary" onClick={() => setView('today')}>Log Today →</button>
              <button className="btn btn-ghost" onClick={() => setView('home')}>Dashboard</button>
            </div>
          </div>
        ) : (
          <div className="no-active-challenge">
            <div className="nac-icon">{baseline ? '🔥' : '🎯'}</div>
            <div className="nac-title">No Active Challenge</div>
            <p className="nac-body">
              {baseline
                ? "You're on Forge Daily — keeping your streak alive with light daily habits. Pick a challenge below when you're ready for the next chapter."
                : 'Pick a challenge below to get started. Your daily tasks, XP, and progress will track automatically.'}
            </p>
          </div>
        )}

        {/* Template library */}
        <div className="challenges-section-title">Challenge Library</div>
        <div className="challenges-list">
          {libraryChallenges.map(t => (
            <ChallengeCard
              key={t.id}
              template={t}
              isActive={isRunning && meta.templateId === t.id}
              activeVariant={isRunning && meta.templateId === t.id ? meta.variant : null}
              setView={setView}
              onStart={(payload) => {
                if (t.start_flow === 'variant' && payload) {
                  setPendingStart({
                    template: t,
                    ...payload,
                    step: payload.variant === 'hard' ? 'hardWarn' : 'letter',
                  });
                } else if (t.id === '75_day_discipline_challenge' && !isRunning) {
                  setShowStartConfirm(true);
                }
              }}
            />
          ))}
        </div>

      </div>

      {/* Sync active challenge with latest template */}
      {showSyncConfirm && (
        <div className="modal-overlay" onClick={() => setShowSyncConfirm(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>Update Active Challenge?</h3>
            <p>This will refresh challenge template tasks while preserving your custom tasks and saved progress.</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowSyncConfirm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => { syncActiveChallengeWithTemplate(); setShowSyncConfirm(false); }}>
                Update Template Tasks
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hard-mode confirmation */}
      {pendingStart?.step === 'hardWarn' && (
        <div className="modal-overlay" onClick={() => setPendingStart(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>{HARD_CONFIRM.title}</h3>
            {HARD_CONFIRM.body.split('\n\n').map((para, i) => (
              <p key={i} style={i > 0 ? { marginTop: -6 } : undefined}>{para}</p>
            ))}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setPendingStart(null)}>{HARD_CONFIRM.backLabel}</button>
              <button className="btn btn-primary" onClick={() => setPendingStart(p => ({ ...p, step: 'letter' }))}>
                {HARD_CONFIRM.continueLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Future Self Letter — required before a challenge begins */}
      {pendingStart?.step === 'letter' && (
        <FutureSelfLetterForm
          challengeName={pendingStart.template?.challenge_name || '75-Day Discipline Challenge'}
          onCancel={() => setPendingStart(null)}
          onSubmit={(letter) => beginChallenge(letter)}
        />
      )}

      {/* 75-day start confirmation → leads into the Future Self Letter */}
      {showStartConfirm && (
        <div className="modal-overlay" onClick={() => setShowStartConfirm(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>Start 75-Day Discipline Challenge?</h3>
            <p>Day 1 begins today. Your daily tasks and progress will be tracked automatically.</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowStartConfirm(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setShowStartConfirm(false);
                  setPendingStart({ template: null, variant: null, durationDays: 75, step: 'letter', legacy75: true });
                }}
              >
                Next: Your Why →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
