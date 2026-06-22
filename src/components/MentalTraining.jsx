import { useState } from 'react';
import { useApp } from '../context/AppContext';

export default function MentalTraining({ dayNumber, dayData, onUpdate, mentalTaskId = 'mental' }) {
  const { MENTAL_OPTIONS } = useApp();
  const [open, setOpen] = useState(false);

  const mt = dayData?.mentalTraining || { selected: null, completed: false, notes: '' };

  function selectOption(id) {
    onUpdate({
      mentalTraining: { ...mt, selected: id === mt.selected ? null : id },
    });
  }

  function markComplete() {
    if (!mt.selected) return;
    onUpdate({
      mentalTraining: { ...mt, completed: true },
      tasks: { ...(dayData?.tasks || {}), [mentalTaskId]: true },
    });
  }

  function unmark() {
    onUpdate({
      mentalTraining: { ...mt, completed: false },
      tasks: { ...(dayData?.tasks || {}), [mentalTaskId]: false },
    });
  }

  function updateNotes(notes) {
    onUpdate({ mentalTraining: { ...mt, notes } });
  }

  return (
    <div className="mental-section">
      <div className="mental-card">
        <button className="mental-toggle" onClick={() => setOpen(o => !o)}>
          <div className="mental-toggle-left">
            <span style={{ fontSize: '1.3rem' }}>🧠</span>
            <div>
              <div className="mental-toggle-label">Mental Training</div>
              <div className="mental-toggle-sub">
                {mt.completed
                  ? `Done · ${MENTAL_OPTIONS.find(o => o.id === mt.selected)?.label || ''}`
                  : mt.selected
                    ? 'Selected · tap to expand'
                    : 'Choose a practice'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {mt.completed && <span className="mental-badge">✓</span>}
            <span className={`mental-chevron${open ? ' open' : ''}`}>⌄</span>
          </div>
        </button>

        {open && (
          <div className="mental-body">
            <div className="section-title">Choose today's practice</div>
            <div className="mental-options">
              {MENTAL_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  className={`mental-opt${mt.selected === opt.id ? ' selected' : ''}`}
                  onClick={() => selectOption(opt.id)}
                  disabled={mt.completed}
                >
                  <span>{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>

            <textarea
              className="mental-notes"
              rows={3}
              placeholder="Mental notes (optional)…"
              value={mt.notes}
              onChange={e => updateNotes(e.target.value)}
            />

            {mt.completed ? (
              <button className="btn btn-ghost btn-full" onClick={unmark}>
                Unmark Complete
              </button>
            ) : (
              <button
                className="btn btn-success btn-full"
                onClick={markComplete}
                disabled={!mt.selected}
                style={{ opacity: mt.selected ? 1 : 0.4 }}
              >
                ✓ Mark Mental Training Complete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
