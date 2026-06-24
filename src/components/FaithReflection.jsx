import { useState } from 'react';
import { FAITH_VIRTUES, MENTAL_BATTLES, FAITH_PROMPTS, DAILY_VERSES } from '../data/faithData';

const EMPTY_FAITH = { completed: false, journal: '', virtue: null, mentalBattle: null, win: '' };

export default function FaithReflection({ dayNumber, dayData, onUpdate, countsToward }) {
  const [open, setOpen] = useState(false);

  const faith = { ...EMPTY_FAITH, ...(dayData?.faithReflection || {}) };

  // Deterministic rotation by day number
  const verse  = DAILY_VERSES[((dayNumber - 1) % DAILY_VERSES.length + DAILY_VERSES.length) % DAILY_VERSES.length];
  const prompt = FAITH_PROMPTS[((dayNumber - 1) % FAITH_PROMPTS.length + FAITH_PROMPTS.length) % FAITH_PROMPTS.length];

  function update(updates) {
    onUpdate({ faithReflection: { ...faith, ...updates } });
  }

  const subLabel = faith.completed
    ? `Complete${faith.virtue ? ` · ${faith.virtue}` : ''}`
    : `${verse.reference} · ${verse.virtue}`;

  return (
    <div className="faith-section">
      <div className="faith-card">
        <button className="faith-toggle" onClick={() => setOpen(o => !o)}>
          <div className="faith-toggle-left">
            <span style={{ fontSize: '1.3rem' }}>✝️</span>
            <div>
              <div className="faith-toggle-label">Faith / Reflection</div>
              <div className="faith-toggle-sub">{subLabel}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {faith.completed && <span className="mental-badge">✓</span>}
            <span className={`mental-chevron${open ? ' open' : ''}`}>⌄</span>
          </div>
        </button>

        {open && (
          <div className="faith-body">

            {/* Daily verse */}
            <div className="faith-verse-card">
              <div className="faith-verse-header">
                <span className="faith-verse-ref">📖 {verse.reference}</span>
                <span className="faith-virtue-chip">{verse.virtue}</span>
              </div>
              <blockquote className="faith-verse-text">"{verse.text}"</blockquote>
              <div className="faith-verse-theme">{verse.theme}</div>
            </div>

            {/* Virtue of the Day */}
            <div>
              <div className="section-title" style={{ marginBottom: 8 }}>✨ Virtue of the Day</div>
              <div className="faith-pills">
                {FAITH_VIRTUES.map(v => (
                  <button
                    key={v}
                    className={`faith-pill${faith.virtue === v ? ' selected' : ''}`}
                    onClick={() => update({ virtue: faith.virtue === v ? null : v })}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Mental Battle */}
            <div>
              <div className="section-title" style={{ marginBottom: 8 }}>⚔️ Mental Battle Today</div>
              <div className="faith-pills">
                {MENTAL_BATTLES.map(b => (
                  <button
                    key={b}
                    className={`faith-pill battle${faith.mentalBattle === b ? ' selected' : ''}`}
                    onClick={() => update({ mentalBattle: faith.mentalBattle === b ? null : b })}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* Reflection prompt + journal */}
            <div>
              <div className="faith-prompt-label">💭 {prompt}</div>
              <textarea
                className="mental-notes"
                rows={3}
                placeholder="Write your reflection here…"
                value={faith.journal}
                onChange={e => update({ journal: e.target.value })}
              />
            </div>

            {/* Win of the day */}
            <div>
              <div className="section-title" style={{ marginBottom: 8 }}>🏆 Win of the Day</div>
              <input
                className="inline-input"
                style={{ width: '100%' }}
                placeholder="One thing you're proud of today…"
                value={faith.win}
                onChange={e => update({ win: e.target.value })}
              />
            </div>

            {countsToward && (
              <div className="faith-counts-note">
                ℹ️ Counts toward daily completion
              </div>
            )}

            {/* Complete button */}
            {faith.completed ? (
              <button className="btn btn-ghost btn-full" onClick={() => update({ completed: false })}>
                Unmark Faith Reflection
              </button>
            ) : (
              <button className="btn btn-success btn-full" onClick={() => update({ completed: true })}>
                ✓ Mark Faith Reflection Complete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
