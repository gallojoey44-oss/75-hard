import { useState, useMemo, useEffect } from 'react';
import { RANKS } from '../utils/gamification';

// Full-screen Lifetime Rank ceremony. Phased: rank-up → growth summary →
// future-self message. Purple/gold forge embers + sparks (no confetti), smooth
// GPU-friendly transforms, tap-to-skip, and reduced-motion aware. It only ever
// renders when the app has already recorded a genuinely new rank, so it never
// replays a previously earned rank.

const PHASES = ['rankup', 'growth', 'futureself'];

function useParticles(reduced) {
  return useMemo(() => {
    if (reduced) return { embers: [], sparks: [] };
    const embers = Array.from({ length: 14 }, () => ({
      left: Math.random() * 100,
      delay: (Math.random() * 2.4).toFixed(2),
      dur: (2.6 + Math.random() * 2.4).toFixed(2),
      size: (4 + Math.random() * 9).toFixed(1),
      gold: Math.random() > 0.5,
    }));
    const sparks = Array.from({ length: 10 }, () => ({
      left: Math.random() * 100,
      top: 20 + Math.random() * 55,
      delay: (Math.random() * 1.8).toFixed(2),
      dur: (0.6 + Math.random() * 0.9).toFixed(2),
    }));
    return { embers, sparks };
  }, [reduced]);
}

export default function RankUpCeremony({ fromRank, toRank, growth = [], futureSelf, reward, onClose }) {
  const [phase, setPhase] = useState('rankup');
  const reduced = typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const { embers, sparks } = useParticles(reduced);

  const from = RANKS[fromRank - 1] || null;
  const to = RANKS[toRank - 1] || RANKS[RANKS.length - 1];

  // Prevent background scroll while the ceremony is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  function next() {
    const i = PHASES.indexOf(phase);
    if (i < PHASES.length - 1) setPhase(PHASES[i + 1]);
    else onClose();
  }

  return (
    <div className="rankup-overlay" role="dialog" aria-label="Rank up" onClick={onClose}>
      <div className="rankup-particles" aria-hidden="true">
        {embers.map((e, i) => (
          <span
            key={`e${i}`}
            className={`rankup-ember${e.gold ? ' gold' : ''}`}
            style={{
              left: `${e.left}%`,
              width: `${e.size}px`,
              height: `${e.size}px`,
              animationDelay: `${e.delay}s`,
              animationDuration: `${e.dur}s`,
            }}
          />
        ))}
        {sparks.map((s, i) => (
          <span
            key={`s${i}`}
            className="rankup-spark"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.dur}s`,
            }}
          />
        ))}
      </div>

      <button className="rankup-skip" onClick={onClose} aria-label="Skip celebration">Skip ✕</button>

      <div className="rankup-content" onClick={e => e.stopPropagation()}>
        {phase === 'rankup' && (
          <div className="rankup-phase">
            <div className="rankup-title">⚔️ RANK UP!</div>

            <div className="rankup-transition">
              {from && <div className="rankup-oldrank">{from.name}</div>}
              <div className="rankup-arrow">↓</div>
              <div className="rankup-badge">
                <span className="rankup-badge-num">{toRank}</span>
              </div>
              <div className="rankup-newrank">{to.name}</div>
            </div>

            <div className="rankup-philosophy">{to.philosophy}</div>

            <div className="rankup-xpbar"><div className="rankup-xpbar-fill" /></div>

            {reward && (
              <div className="rankup-reward">
                <div className="rankup-reward-head">🎁 Reward Unlocked</div>
                <div className="rankup-reward-item">
                  <span className="rankup-reward-icon">{reward.icon}</span>
                  <span className="rankup-reward-text">
                    <strong>{reward.label}</strong>
                    <span className="rankup-reward-desc">{reward.desc}</span>
                  </span>
                </div>
              </div>
            )}

            <p className="rankup-quote">
              You are becoming the type of person who keeps promises to yourself.
            </p>

            <button className="btn btn-primary rankup-btn" onClick={next}>Continue Journey</button>
          </div>
        )}

        {phase === 'growth' && (
          <div className="rankup-phase">
            <div className="rankup-heading">📈 You Have Grown</div>
            {growth.length > 0 ? (
              <div className="rankup-growth-grid">
                {growth.map((g, i) => (
                  <div key={i} className="rankup-growth-item">
                    <div className="rankup-growth-label">{g.icon} {g.label}</div>
                    {g.before != null && g.after != null ? (
                      <div className="rankup-growth-value">
                        <span className="rankup-growth-before">{g.before}</span>
                        <span className="rankup-growth-arrow">→</span>
                        <span className="rankup-growth-after">{g.after}</span>
                      </div>
                    ) : (
                      <div className="rankup-growth-value"><span className="rankup-growth-after">{g.value}</span></div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="rankup-growth-empty">Keep logging your days — your growth will show here as evidence of change.</p>
            )}
            <button className="btn btn-primary rankup-btn" onClick={next}>Continue</button>
          </div>
        )}

        {phase === 'futureself' && (
          <div className="rankup-phase">
            <div className="rankup-heading">✉️ {futureSelf?.title || 'A word from Forge'}</div>
            <div className="rankup-futureself">
              {(futureSelf?.lines || []).map((line, i) => <p key={i}>{line}</p>)}
            </div>
            <button className="btn btn-primary rankup-btn" onClick={next}>Continue Journey</button>
          </div>
        )}
      </div>
    </div>
  );
}
