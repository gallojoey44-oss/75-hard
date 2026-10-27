import { useState } from 'react';
import { badgeCollection } from '../../utils/homeSummary';

/**
 * What you have earned, and what is next.
 *
 * The old row showed held badges and nothing else, so the card got quieter the
 * longer someone used Forge — the opposite of what it is for. Here the held
 * ones lead, the closest milestones follow with their real distance, and the
 * whole collection is one tap away rather than absent.
 *
 * A milestone only shows a progress bar when Forge can actually count toward
 * it. Streak badges can be counted and the rank ladder can be counted; "Sleep
 * Rebuilt" is measured from rating patterns and cannot be reduced to x-of-y,
 * so it appears in the collection as a locked achievement with its real
 * criterion and no invented number.
 */
export default function AchievementsCard({ badges, milestones }) {
  const [open, setOpen] = useState(false);
  const earnedIds = new Set(badges.map(b => b.id));
  const { earned, locked, total } = badgeCollection(earnedIds);

  return (
    <section className="f41-card f41-ach">
      <div className="f41-card-head">
        <h3 className="f41-card-title">Achievements</h3>
        <span className="f41-card-meta">{earned.length} of {total}</span>
      </div>

      {earned.length > 0 ? (
        // Emblems rather than chips: five to a row, each one the achievement's
        // own emoji on a crest in the profile's accent. Nothing here is
        // decorative data — the crest marks that it is HELD, the label is the
        // badge's real name, and the count beside the heading is the real
        // tally. When more are held than fit, the last slot says how many
        // rather than silently dropping them.
        <ul className="f41-badges badge-row">
          {earned.slice(0, earned.length > 5 ? 4 : 5).map(b => (
            <li key={b.id} className="f41-badge badge-chip" title={`${b.label} — ${b.desc}`}>
              <span className="f41-crest" aria-hidden="true">
                <span className="f41-crest-emoji badge-chip-emoji">{b.emoji}</span>
              </span>
              <span className="f41-badge-label badge-chip-label">{b.label}</span>
            </li>
          ))}
          {earned.length > 5 && (
            <li className="f41-badge more" title={`${earned.length - 4} more earned`}>
              <span className="f41-crest more" aria-hidden="true">
                <span className="f41-crest-more">+{earned.length - 4}</span>
              </span>
              <span className="f41-badge-label">more</span>
            </li>
          )}
        </ul>
      ) : (
        <p className="f41-empty">
          Your first achievement is one completed task away.
        </p>
      )}

      {milestones.length > 0 && (
        <>
          <div className="f41-sub">Closest milestones</div>
          <ul className="f41-miles">
            {milestones.map(m => (
              <li key={m.id} className="f41-mile">
                <span className="f41-mile-icon" aria-hidden="true">{m.icon}</span>
                <span className="f41-mile-body">
                  <span className="f41-mile-top">
                    <span className="f41-mile-label">{m.label}</span>
                    <span className="f41-mile-detail">{m.detail}</span>
                  </span>
                  <span className="f41-mile-bar">
                    <span className="f41-mile-bar-fill" style={{ width: `${m.pct}%` }} />
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <button
        type="button"
        className="f41-expand"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        {open ? '▲ Hide the collection' : `▼ All ${total} achievements`}
      </button>

      {open && (
        <div className="f41-collection">
          {earned.length > 0 && (
            <>
              <div className="f41-sub">Earned</div>
              <ul className="f41-col-list">
                {earned.map(b => (
                  <li key={b.id} className="f41-col-row">
                    <span className="f41-col-emoji" aria-hidden="true">{b.emoji}</span>
                    <span className="f41-col-info">
                      <span className="f41-col-label">{b.label}</span>
                      <span className="f41-col-desc">{b.desc}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {locked.length > 0 && (
            <>
              <div className="f41-sub">Not yet</div>
              <ul className="f41-col-list">
                {locked.map(b => (
                  <li key={b.id} className="f41-col-row locked">
                    <span className="f41-col-emoji" aria-hidden="true">🔒</span>
                    <span className="f41-col-info">
                      <span className="f41-col-label">{b.label}</span>
                      <span className="f41-col-desc">{b.desc}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
