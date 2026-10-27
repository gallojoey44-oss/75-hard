import { RANKS } from '../../utils/gamification';

/**
 * Where you stand on the ladder.
 *
 * The old widget stated the same number three times — a rank badge, an XP
 * figure, and a split row repeating that figure as "Lifetime" — then put the
 * one fact people actually come to Home for, how far it is to the next rank,
 * in small grey text under a bar. This leads with the rank, gives the distance
 * to the next one its own line, and keeps Challenge XP beside Lifetime XP
 * where the difference between them is legible.
 *
 * Every figure comes from the one normalized rank state (utils/rank.js), so
 * Home can never disagree with Settings, the ladder or a notification. The
 * legacy class names are kept exactly where they were: they are how the suite
 * reads the rank, the balance, the bar and the next-rank line, and a redesign
 * has no business moving the handle every test reaches for.
 */
export default function RankCard({
  rankInfo, challengeXP, todayXP, onToggleLadder, onToggleDetails, showLadder, showDetails,
}) {
  const { current, next, xp, xpToNext, progress, floored, floorXP, atFloor } = rankInfo;
  const tierIndex = RANKS.findIndex(r => r.rank === current.rank);
  const moved = todayXP.gained > 0 || todayXP.lost > 0;

  return (
    <section className="f41-rank xp-widget">
      {/* Rank, and what it means. The philosophy line is the rank ladder's own
          words, not a slogan written for this screen. */}
      <div className="f41-rank-top">
        <span className="f41-rank-badge xp-rank-badge">{current.name}</span>
        <div className="f41-rank-tools">
          <button type="button" className="f41-rank-tool xp-details-btn" onClick={onToggleLadder}>
            {showLadder ? '▲ Ladder' : '🪜 Ladder'}
          </button>
          <button type="button" className="f41-rank-tool xp-details-btn" onClick={onToggleDetails}>
            {showDetails ? '▲ Details' : '▼ Details'}
          </button>
        </div>
      </div>

      <p className="f41-rank-phil">{current.philosophy}</p>

      <div className="f41-rank-xp">
        <span className="f41-rank-xp-num xp-value">{xp.toLocaleString()}</span>
        <span className="f41-rank-xp-unit">XP</span>
        {moved && (
          <span className="f41-rank-today">
            {todayXP.gained > 0 && <span className="f41-up">+{todayXP.gained.toLocaleString()}</span>}
            {todayXP.lost > 0 && <span className="f41-down">−{todayXP.lost.toLocaleString()}</span>}
            <span className="f41-rank-today-label">today</span>
          </span>
        )}
      </div>

      {/* Progress runs from this tier's floor to the next tier's threshold, so
          0% is standing on the floor and 100% is arriving at the next rank. */}
      <div className="f41-rank-bar" role="progressbar"
        aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}
        aria-label={next ? `${progress}% of the way to ${next.name}` : 'Highest rank reached'}>
        <div className="f41-rank-bar-fill xp-bar-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="f41-rank-next">
        {next ? (
          <>
            {/* Sitting exactly on the floor is the START of a rank already
                held, not the brink of earning it again — and it belongs in
                this label, where the suite reads the next-rank copy, rather
                than in a paragraph of its own. It is a block so it drops to
                its own line instead of being crushed against the percentage. */}
            <span className="f41-rank-next-label xp-next-label">
              {xpToNext.toLocaleString()} XP to {next.name}
              {atFloor && (
                <span className="f41-rank-atfloor xp-floor-note">
                  You are at the start of {current.name}.
                </span>
              )}
            </span>
            <span className="f41-rank-next-pct">{progress}%</span>
          </>
        ) : (
          <span className="f41-rank-next-label xp-next-label">Max rank — {current.name}</span>
        )}
      </div>

      {/* Sitting exactly on the floor is the START of a rank already held, not
          the brink of earning it again. It gets its own line rather than being
          crushed against the percentage. */}
      {/* The ladder, as eight dots. Small, but it is the only place Home says
          how far along the whole thing you are rather than the current tier. */}
      <div className="f41-rank-dots" aria-hidden="true">
        {RANKS.map((r, i) => (
          <span
            key={r.rank}
            className={`f41-rank-dot${i < tierIndex ? ' done' : i === tierIndex ? ' here' : ''}`}
            title={`${r.name} · ${r.minXP.toLocaleString()} XP`}
          />
        ))}
      </div>

      {/* The two figures people actually compare: what this attempt has earned
          against what it has all added up to. `xp-split-row` and the
          "Challenge:"/"Lifetime:" wording are the handle eleven suites read
          these numbers by, so both stay exactly as they were. */}
      <div className="f41-rank-split xp-split-row">
        <div className="f41-rank-stat xp-split-item">
          <span className="f41-rank-stat-label">🔥 Challenge:</span>
          <strong className="f41-rank-stat-value">{challengeXP.toLocaleString()}</strong>
        </div>
        <div className="f41-rank-stat xp-split-item">
          <span className="f41-rank-stat-label">🏛 Lifetime:</span>
          <strong className="f41-rank-stat-value">{xp.toLocaleString()}</strong>
        </div>
      </div>

      {/* The full floor explanation lives behind Details. It is a paragraph
          about a rule, and a rule only matters on the day it bites — whereas
          the card is read every day. What stays here is the one-word fact that
          the rank is locked in; `.xp-floor-row` and its wording move with the
          explanation, so the suite still reads them where they are shown. */}
      {floored && (
        <p className="f41-rank-locked">
          🔒 {current.name} is locked in.
          <button type="button" className="f41-rank-why" onClick={onToggleDetails}>
            What that means
          </button>
        </p>
      )}
    </section>
  );
}
