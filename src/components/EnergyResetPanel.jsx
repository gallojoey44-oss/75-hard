import { useState } from 'react';
import { useApp } from '../context/AppContext';
import * as ER from '../data/energyResetConfig';
import { energyComparison, ratedDays, ENERGY_FIELDS } from '../utils/energyTracking';

/**
 * ⚡ The 10-Day Energy Reset daily panel.
 *
 * The energy ratings are the first thing on the screen and the only thing open
 * by default — three taps, no scrolling, no questionnaire. Everything else (the
 * running trend, the guidance, the micronutrient list) is collapsed until asked
 * for.
 *
 * All copy comes from energyResetConfig; this component holds no challenge
 * constants.
 */
export default function EnergyResetPanel() {
  const { profile, getChallengeMeta, getRawDayNumber, getDayNumber, getDayData, updateDay, allDays, activeProfile } = useApp();

  const [openTrend, setOpenTrend] = useState(false);
  const [openGuide, setOpenGuide] = useState(false);
  const [openNutrients, setOpenNutrients] = useState(false);

  const meta = getChallengeMeta();
  const cfg = ER.erConfig(meta);
  if (!cfg) return null;                       // not an Energy Reset attempt

  const dayNum = getRawDayNumber();
  if (!dayNum) return null;                    // scheduled, not begun

  const capped = getDayNumber();
  const today = getDayData(capped) || {};
  const days = (allDays[activeProfile] || {});
  const rated = ratedDays(days, capped);
  const trend = energyComparison({ days, endDayNum: capped, baseline: cfg.baseline });

  const setRating = (key, value) =>
    updateDay(capped, { [key]: today[key] === value ? 0 : value });

  const ratedToday = ENERGY_FIELDS.filter(f => today[f.key] > 0).length;

  return (
    <div className="er-panel">
      <div className="er-panel-head">
        <span className="er-panel-title">{ER.IDENTITY.emoji} {ER.IDENTITY.shortName}</span>
        <span className="er-panel-sub">Day {capped} of {ER.DURATION_DAYS}</span>
      </div>

      {/* ── The ratings — always open, three taps ── */}
      <div className="er-block er-ratings">
        <div className="er-block-title">
          {ER.ENERGY_PROMPT.title}
          <span className="er-block-meta">{ratedToday}/{ENERGY_FIELDS.length} rated today</span>
        </div>
        {ENERGY_FIELDS.map(f => (
          <div key={f.key} className="er-scale">
            <div className="er-scale-head">
              <span className="er-scale-label">{f.icon} {f.short}</span>
              <span className="er-scale-value">{today[f.key] > 0 ? `${today[f.key]}/10` : '—'}</span>
            </div>
            <div className="er-scale-row">
              {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                <button
                  key={n}
                  className={`er-dot${today[f.key] === n ? ' active' : ''}`}
                  onClick={() => setRating(f.key, n)}
                  aria-label={`${f.label} ${n}`}
                >{n}</button>
              ))}
            </div>
          </div>
        ))}
        <div className="er-note">{ER.ENERGY_PROMPT.missingNote}</div>
      </div>

      {/* ── Running trend ── */}
      <div className="er-block">
        <button className="er-block-toggle" onClick={() => setOpenTrend(v => !v)}>
          <span className="er-block-title">📈 Your energy so far</span>
          <span className="er-block-meta">
            {rated.length ? `${rated.length} ${rated.length === 1 ? 'day' : 'days'} rated` : 'no ratings yet'}
          </span>
          <span className="er-caret">{openTrend ? '▾' : '▸'}</span>
        </button>
        {openTrend && (
          trend.enoughData ? (
            <>
              <div className="er-compare">
                <div className="er-compare-col">
                  <span className="er-compare-label">{trend.source === 'baseline' ? 'Your baseline' : 'Early days'}</span>
                  <span className="er-compare-value">{trend.average.before}/10</span>
                </div>
                <div className="er-compare-arrow">→</div>
                <div className="er-compare-col">
                  <span className="er-compare-label">Recent days</span>
                  <span className="er-compare-value">{trend.average.after}/10</span>
                </div>
                {trend.average.pct != null && (
                  <div className={`er-compare-pct ${trend.average.pct >= 0 ? 'up' : 'down'}`}>
                    {trend.average.pct >= 0 ? '↑' : '↓'} {Math.abs(trend.average.pct)}%
                  </div>
                )}
              </div>
              {trend.dimensions.filter(d => d.pct != null).map(d => (
                <div key={d.key} className="er-dim-row">
                  <span className="er-dim-label">{d.icon} {d.short}</span>
                  <span className="er-dim-values">{d.before} → {d.after}</span>
                  <span className={`er-dim-pct ${d.pct >= 0 ? 'up' : 'down'}`}>
                    {d.pct >= 0 ? '+' : ''}{d.pct}%
                  </span>
                </div>
              ))}
              <div className="er-note">Still in progress — the full result comes on Day {ER.DURATION_DAYS}.</div>
            </>
          ) : (
            <div className="er-note">
              Keep rating each day. A comparison needs a few days on each side — nothing is estimated
              until there is real data to compare.
            </div>
          )
        )}
      </div>

      {/* ── Guidance ── */}
      <div className="er-block">
        <button className="er-block-toggle" onClick={() => setOpenGuide(v => !v)}>
          <span className="er-block-title">💡 How to actually do this</span>
          <span className="er-block-meta">light · sleep · caffeine · wind-down</span>
          <span className="er-caret">{openGuide ? '▾' : '▸'}</span>
        </button>
        {openGuide && (
          <>
            {[ER.MORNING_LIGHT_GUIDE, ER.SLEEP_GUIDE, ER.WIND_DOWN].map(g => (
              <div key={g.title} className="er-guide">
                <div className="er-sub-title">{g.title}</div>
                <div className="er-guide-blurb">{g.blurb}</div>
                <ul className="er-list">{g.items.map((i, n) => <li key={n}>{i}</li>)}</ul>
                {g.notice && <div className="er-note">{g.notice}</div>}
              </div>
            ))}
            <div className="er-guide">
              <div className="er-sub-title">{ER.CAFFEINE.title}</div>
              <div className="er-guide-blurb">{ER.CAFFEINE.principle}</div>
              <ul className="er-list">{ER.CAFFEINE.items.map((i, n) => <li key={n}>{i}</li>)}</ul>
              <div className="er-note">{ER.CAFFEINE.notice}</div>
            </div>
            <div className="er-guide">
              <div className="er-sub-title">Exercise</div>
              <div className="er-guide-blurb">{ER.EXERCISE_GUIDE.principle}</div>
              <ul className="er-list">{ER.EXERCISE_GUIDE.items.map((i, n) => <li key={n}>{i}</li>)}</ul>
              <div className="er-note">{ER.EXERCISE_GUIDE.notice}</div>
            </div>
          </>
        )}
      </div>

      {/* ── Nutrient education ── */}
      <div className="er-block">
        <button className="er-block-toggle" onClick={() => setOpenNutrients(v => !v)}>
          <span className="er-block-title">🥗 Nutrient-dense, concretely</span>
          <span className="er-block-meta">nothing to track</span>
          <span className="er-caret">{openNutrients ? '▾' : '▸'}</span>
        </button>
        {openNutrients && (
          <>
            <div className="er-note">{ER.MICRONUTRIENT_NOTE}</div>
            {ER.MICRONUTRIENTS.map(n => (
              <div key={n.id} className="er-nutrient"><strong>{n.name}</strong> — {n.sources}</div>
            ))}
            <div className="er-caution">{ER.MICRONUTRIENT_CAUTION}</div>
          </>
        )}
      </div>
    </div>
  );
}
