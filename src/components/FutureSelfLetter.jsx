import { useState } from 'react';
import { FUTURE_SELF_PROMPTS } from '../data/challengeContent';

// Modal form shown before a challenge begins. Requires the "why" prompt;
// the rest are strongly encouraged. Calls onSubmit(letter) / onCancel.
export function FutureSelfLetterForm({ challengeName, onSubmit, onCancel }) {
  const [answers, setAnswers] = useState({});
  const canBegin = (answers.why || '').trim().length > 0;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card letter-modal" onClick={e => e.stopPropagation()}>
        <h3>✍️ Your Future Self Letter</h3>
        <p style={{ marginBottom: 8 }}>
          Before you start {challengeName || 'this challenge'}, write to your future self. You&apos;ll be able
          to read this any time you need it — especially on the hard days.
        </p>
        <div className="letter-fields">
          {FUTURE_SELF_PROMPTS.map(p => (
            <label key={p.key} className="letter-field">
              <span className="letter-field-label">
                {p.label}{p.required ? ' *' : ''}
              </span>
              <textarea
                className="letter-textarea"
                rows={2}
                value={answers[p.key] || ''}
                onChange={e => setAnswers(a => ({ ...a, [p.key]: e.target.value }))}
                placeholder={p.required ? 'Required' : 'Optional, but worth it'}
              />
            </label>
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!canBegin}
            style={!canBegin ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
            onClick={() => onSubmit(answers)}
          >
            Save &amp; Begin
          </button>
        </div>
      </div>
    </div>
  );
}

// Read-only viewer used by the "Read My Why" button and struggling flows.
export function FutureSelfLetterView({ letter, onClose }) {
  const answered = FUTURE_SELF_PROMPTS.filter(p => (letter?.[p.key] || '').trim());
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card letter-modal" onClick={e => e.stopPropagation()}>
        <h3>📖 Your Why</h3>
        {!letter || answered.length === 0 ? (
          <p>No letter was saved for this challenge.</p>
        ) : (
          <div className="letter-read">
            {answered.map(p => (
              <div key={p.key} className="letter-read-item">
                <div className="letter-read-q">{p.label}</div>
                <div className="letter-read-a">{letter[p.key]}</div>
              </div>
            ))}
            {letter.writtenAt && (
              <div className="letter-read-date">Written {letter.writtenAt}</div>
            )}
          </div>
        )}
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
