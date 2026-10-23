import { guideForTask } from '../data/habitGuides';

/**
 * Priced previews — the one place a challenge's XP is rendered.
 *
 * Every figure here comes from a stamped attempt (`previewAttempt`), never from
 * a hand-written constant, so what the library and the setup screens advertise
 * is what starting the challenge installs. The Challenge Library used to carry
 * its own XP strings, and they went stale the moment the economy changed.
 */

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** ⭐ per keystone tier — the same hierarchy the daily checklist shows. */
function stars(keystone) {
  return '⭐'.repeat(Math.max(0, Math.min(3, Number(keystone) || 0)));
}

/**
 * The daily requirements, priced.
 *
 * Every figure comes from the stamped attempt, so this list IS what starting
 * the challenge installs. It replaced hand-written strings that carried their
 * own XP numbers and went stale the moment the economy was rebalanced.
 */
export function PricedRequirements({ tasks, onGuide }) {
  if (!tasks?.length) return null;
  return (
    <ul className="tpl-task-list priced">
      {tasks.map(t => {
        const label = `${t.icon || '•'} ${t.name}${stars(t.keystone) ? ' ' + stars(t.keystone) : ''} (${t.xp} XP)`;
        return guideForTask(t) ? (
          <li key={t.id} className="tpl-task-guided">
            <button className="tpl-task-link" onClick={() => onGuide?.(t)}>
              {label}
              <span className="tpl-task-link-hint">Guide</span>
            </button>
          </li>
        ) : (
          <li key={t.id}>{label}</li>
        );
      })}
    </ul>
  );
}

/** Weekly requirements, priced from the attempt's repriced definitions. */
export function PricedWeekly({ weekly }) {
  if (!weekly?.length) return null;
  return (
    <ul className="tpl-task-list weekly priced-weekly">
      {weekly.map(d => (
        <li key={d.id}>{d.icon} {d.label} — {d.perWeek}× per week ({d.xp} XP each)</li>
      ))}
    </ul>
  );
}

/**
 * What this exact setup is worth.
 *
 * Difficulty sets a daily XP budget and the tasks divide it, so this card is
 * the only honest way to describe a challenge's rewards: the per-task figures
 * above already add up to the budget named here, and every bonus is derived
 * from it. It re-renders whenever mode, duration or configuration changes,
 * because it is computed from the attempt those choices produce.
 */
export function XPSummaryCard({ preview }) {
  if (!preview) return null;
  const fmt = (n) => Number(n).toLocaleString();
  const cap = (n) => (Number.isFinite(n) ? fmt(n) : 'no limit');
  return (
    <div className="xp-preview-card">
      <div className="xp-preview-head">
        <span className="xp-preview-title">⚡ XP for this setup</span>
        {preview.tierLabel && (
          <span className="xp-preview-tier">
            {preview.tierLabel} tier
            {preview.mode && preview.modeMultiplier !== 1
              ? ` · ${capitalize(preview.mode)} ×${preview.modeMultiplier}`
              : ''}
          </span>
        )}
      </div>
      <div className="xp-preview-rows">
        <div className="xp-preview-row">
          <span>Daily tasks ({preview.tasks.length})</span>
          <strong>{fmt(preview.dailyTaskXP)} XP</strong>
        </div>
        <div className="xp-preview-row">
          <span>Perfect day bonus</span>
          <strong>+{fmt(preview.perfectDayBonus)} XP</strong>
        </div>
        {preview.weeklyPerWeek > 0 && (
          <div className="xp-preview-row">
            <span>Weekly requirements</span>
            <strong>{fmt(preview.weeklyPerWeek)} XP / week</strong>
          </div>
        )}
        {preview.streakXP > 0 && (
          <div className="xp-preview-row">
            <span>Streak milestones</span>
            <strong>+{fmt(preview.streakXP)} XP</strong>
          </div>
        )}
        {preview.completionBonus > 0 && (
          <div className="xp-preview-row">
            <span>Completion bonus</span>
            <strong>+{fmt(preview.completionBonus)} XP</strong>
          </div>
        )}
        <div className="xp-preview-row muted">
          <span>Each missed day</span>
          <strong>−{fmt(preview.missedDayPenalty)} XP</strong>
        </div>
        {preview.projectedPerfectTotal != null && (
          <div className="xp-preview-row total">
            <span>Perfect {preview.durationDays}-day total</span>
            <strong>{fmt(preview.projectedPerfectTotal)} XP</strong>
          </div>
        )}
      </div>
      <div className="xp-preview-note">
        Optional XP is capped at {cap(preview.bonusPerDayCap)} a day
        {Number.isFinite(preview.bonusAttemptCap) ? ` and ${fmt(preview.bonusAttemptCap)} for the whole challenge` : ''},
        so Bonus Missions can add to a day but never outweigh the work itself.
      </div>
    </div>
  );
}
