import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { getTemplateById } from '../data/challengeTemplates';

// 🎯 Bonus Missions — an optional, interactive section shown below the required
// daily tasks. Bonus Missions award bonus XP but never count toward required
// progress, streaks, challenge completion, or MWD. Completion is stored per
// profile and date (dayData.bonusDone), so it resets daily and never
// double-awards XP after reopening.

const ICON_CHOICES = ['🎯', '🚿', '📵', '🧱', '🌤️', '📚', '🤝', '💧', '🧘', '🏃', '🌙', '✍️', '🍎', '☀️'];

export default function BonusMissions({ dayNumber, isEditable = true }) {
  const {
    activeProfile, profile, allDays, getChallengeMeta,
    toggleBonusMission, addBonusMission, removeBonusMission, reorderBonusMissions,
  } = useApp();

  const [showAdd, setShowAdd] = useState(false);
  const [manage, setManage] = useState(false);

  // Bonus state is read live from the store (not a snapshot) so toggles,
  // adds and removes re-render the card immediately.
  const dayData = (allDays[activeProfile] || {})[dayNumber] || {};
  const recurring = [...(profile?.bonusMissions || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const oneTime = dayData?.bonusOneTime || [];
  const missions = [...recurring, ...oneTime];
  const bonusDone = dayData?.bonusDone || {};

  const completedCount = missions.filter(m => bonusDone[m.id] != null).length;
  const bonusXP = Object.values(bonusDone).reduce((s, v) => s + (Number(v) || 0), 0);

  // Challenge-specific suggestions not already in the list.
  const meta = getChallengeMeta();
  const template = getTemplateById(meta.templateId);
  const presentIds = new Set(missions.map(m => m.id));
  const suggestions = (template?.bonus_missions || []).filter(s => !presentIds.has(s.id));

  function moveRecurring(index, dir) {
    const next = [...recurring];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    reorderBonusMissions(next);
  }

  return (
    <div className="section-card bonus-card">
      <div className="section-title" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <span>🎯 Bonus Missions</span>
        <span className="bonus-summary">
          {completedCount} completed · <span className="bonus-xp-label">+{bonusXP} Bonus XP</span>
        </span>
      </div>
      <p className="bonus-subtitle">Optional ways to go beyond today&apos;s mission.</p>

      {missions.length === 0 && (
        <p className="bonus-empty">No bonus missions yet. Add one to earn extra XP — never required.</p>
      )}

      <div className="bonus-list">
        {missions.map((m, i) => {
          const done = bonusDone[m.id] != null;
          const isRecurring = i < recurring.length;
          return (
            <div key={m.id} className={`bonus-item${done ? ' done' : ''}`}>
              <div
                className={`check-box${done ? ' checked' : ''}`}
                onClick={isEditable ? () => toggleBonusMission(dayNumber, m) : undefined}
                role="checkbox"
                aria-checked={done}
              >
                {done && <span className="check-tick">✓</span>}
              </div>
              <span className="bonus-item-icon">{m.icon || '🎯'}</span>
              <div className="bonus-item-body" onClick={isEditable ? () => toggleBonusMission(dayNumber, m) : undefined}>
                <span className={`bonus-item-name${done ? ' done' : ''}`}>{m.name}</span>
                {m.desc && <span className="bonus-item-desc">{m.desc}</span>}
              </div>
              <span className="bonus-item-xp">+{m.xp}</span>
              {manage && (
                <div className="bonus-item-manage">
                  {isRecurring && (
                    <>
                      <button className="bonus-mini-btn" onClick={() => moveRecurring(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                      <button className="bonus-mini-btn" onClick={() => moveRecurring(i, 1)} disabled={i === recurring.length - 1} aria-label="Move down">↓</button>
                    </>
                  )}
                  <button
                    className="bonus-mini-btn remove"
                    onClick={() => removeBonusMission(m.id, { recurring: isRecurring, dayNumber })}
                    aria-label="Remove"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bonus-actions">
        <button className="btn btn-ghost bonus-action-btn" onClick={() => { setShowAdd(v => !v); setManage(false); }}>
          {showAdd ? '× Close' : '+ Add Bonus Mission'}
        </button>
        {missions.length > 0 && (
          <button className="btn btn-ghost bonus-action-btn" onClick={() => { setManage(v => !v); setShowAdd(false); }}>
            {manage ? 'Done' : '✏️ Manage'}
          </button>
        )}
      </div>

      {showAdd && (
        <AddBonusMission
          suggestions={suggestions}
          onAddSuggestion={(s) => addBonusMission(s, { recurring: true })}
          onAddCustom={(def, recurring) => addBonusMission(def, recurring ? { recurring: true } : { dayNumber })}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}

function AddBonusMission({ suggestions, onAddSuggestion, onAddCustom, onClose }) {
  const [name, setName] = useState('');
  const [xp, setXp] = useState(15);
  const [icon, setIcon] = useState('🎯');
  const [recurring, setRecurring] = useState(true);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAddCustom({ name: trimmed, xp: Math.max(0, Math.min(100, Number(xp) || 0)), icon }, recurring);
    setName('');
    setXp(15);
    setIcon('🎯');
    onClose();
  }

  return (
    <div className="bonus-add">
      {suggestions.length > 0 && (
        <>
          <div className="bonus-add-label">Suggestions for this challenge</div>
          <div className="bonus-suggestions">
            {suggestions.map(s => (
              <button key={s.id} className="bonus-suggestion-chip" onClick={() => onAddSuggestion(s)}>
                {s.icon} {s.name} <span className="bonus-suggestion-xp">+{s.xp}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="bonus-add-label">Create your own</div>
      <div className="bonus-add-form">
        <div className="bonus-icon-row">
          {ICON_CHOICES.map(ic => (
            <button
              key={ic}
              className={`bonus-icon-choice${icon === ic ? ' active' : ''}`}
              onClick={() => setIcon(ic)}
              aria-label={`Icon ${ic}`}
            >
              {ic}
            </button>
          ))}
        </div>
        <input
          className="form-input"
          placeholder="Bonus mission name"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={60}
        />
        <div className="bonus-add-row">
          <label className="bonus-add-xp">
            <span>Bonus XP</span>
            <input
              type="number"
              className="inline-input"
              min={0}
              max={100}
              value={xp}
              onChange={e => setXp(e.target.value)}
            />
          </label>
          <div className="bonus-recurring-toggle">
            <button
              className={`bonus-seg${recurring ? ' active' : ''}`}
              onClick={() => setRecurring(true)}
            >
              Recurring
            </button>
            <button
              className={`bonus-seg${!recurring ? ' active' : ''}`}
              onClick={() => setRecurring(false)}
            >
              Just today
            </button>
          </div>
        </div>
        <button className="btn btn-primary btn-full" onClick={submit} disabled={!name.trim()}>
          Add Bonus Mission
        </button>
      </div>
    </div>
  );
}
