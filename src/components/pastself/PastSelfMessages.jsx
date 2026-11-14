import { useState } from 'react';
import {
  saveMessage, deleteMessage, setMessageEnabled, messageProblem, charCount,
  MAX_MESSAGES, MAX_MESSAGE_CHARS,
} from '../../utils/pastSelf';

/**
 * The short messages Forge sends back.
 *
 * A message is the user's sentence, kept as typed. Forge never completes it,
 * corrects it or shortens it: text over the limit is refused with the reason
 * rather than cut, because a clipped sentence is not what they wrote. The
 * examples below are shown as examples and are never saved unless tapped.
 */

const EXAMPLES = [
  'Remember why you started.',
  'Don’t let fear make your decisions.',
  'Become the person you promised yourself you’d become.',
];

function Composer({ state, initial = '', editingId = null, onSave, onCancel, autoFocus = false }) {
  const [text, setText] = useState(initial);
  const count = charCount(text.trim());
  const over = count > MAX_MESSAGE_CHARS;
  const problem = text.trim() ? messageProblem(state, text, editingId) : null;
  const canSave = text.trim().length > 0 && !problem;

  return (
    <div className="ps-composer">
      <textarea
        className="ps-msg-input"
        value={text}
        rows={2}
        autoFocus={autoFocus}
        onChange={e => setText(e.target.value)}
        placeholder="Write it the way you would say it to yourself."
        aria-label={editingId ? 'Edit message' : 'New message'}
      />
      <div className="ps-composer-foot">
        <span className={`ps-count${over ? ' over' : ''}`} aria-live="polite">{count}/{MAX_MESSAGE_CHARS}</span>
        <div className="ps-row-actions tight">
          {onCancel && <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>}
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canSave}
            onClick={() => { onSave(text); if (!editingId) setText(''); }}
          >
            {editingId ? 'Save' : 'Add message'}
          </button>
        </div>
      </div>
      {problem && <p className="ps-problem" role="alert">{problem}</p>}
    </div>
  );
}

export default function PastSelfMessages({ state, update, onPreview }) {
  const [editing, setEditing] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const full = state.messages.length >= MAX_MESSAGES;
  const onCount = state.messages.filter(m => m.enabled !== false).length;

  return (
    <div className="ps-pane" data-testid="past-self-messages">
      <p className="ps-intro">
        Short lines Forge can send back to you. They are sent exactly as you write them.
      </p>

      {!full && (
        <Composer state={state} onSave={(text) => update(s => saveMessage(s, { text }))} />
      )}
      {full && <p className="ps-note">You have {MAX_MESSAGES} messages, which is the most Forge keeps. Delete one to add another.</p>}

      {state.messages.length === 0 ? (
        <div className="ps-examples">
          <div className="ps-section-title">For example</div>
          <ul className="ps-example-list">
            {EXAMPLES.map(e => (
              <li key={e}>
                <button type="button" className="ps-example" onClick={() => update(s => saveMessage(s, { text: e }))}>
                  <span className="ps-example-text">“{e}”</span>
                  <span className="ps-example-add">Use this</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="ps-note">These are only examples. Your own words will mean more.</p>
        </div>
      ) : (
        <>
          <div className="ps-list-head">
            <span className="ps-section-title">Your messages</span>
            <span className="ps-note">{onCount} of {state.messages.length} switched on</span>
          </div>
          <ul className="ps-list">
            {state.messages.map(m => {
              const on = m.enabled !== false;
              if (editing === m.id) {
                return (
                  <li key={m.id} className="ps-msg editing">
                    <Composer
                      state={state}
                      initial={m.text}
                      editingId={m.id}
                      autoFocus
                      onSave={(text) => { update(s => saveMessage(s, { id: m.id, text })); setEditing(null); }}
                      onCancel={() => setEditing(null)}
                    />
                  </li>
                );
              }
              return (
                <li key={m.id} className={`ps-msg${on ? '' : ' off'}`}>
                  <div className="ps-msg-main">
                    <p className="ps-msg-text">{m.text}</p>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      aria-label={`${on ? 'Switch off' : 'Switch on'}: ${m.text}`}
                      className={`toggle-btn${on ? ' on' : ''}`}
                      onClick={() => update(s => setMessageEnabled(s, m.id, !on))}
                    >
                      {on ? 'On' : 'Off'}
                    </button>
                  </div>
                  {confirming === m.id ? (
                    <div className="ps-msg-actions">
                      <span className="ps-note">Delete this message?</span>
                      <button type="button" className="ps-link" onClick={() => setConfirming(null)}>Keep</button>
                      <button
                        type="button"
                        className="ps-link danger"
                        onClick={() => { update(s => deleteMessage(s, m.id)); setConfirming(null); }}
                      >
                        Delete
                      </button>
                    </div>
                  ) : (
                    <div className="ps-msg-actions">
                      <button type="button" className="ps-link" onClick={() => onPreview?.(m.id)}>Preview</button>
                      <button type="button" className="ps-link" onClick={() => setEditing(m.id)}>Edit</button>
                      <button type="button" className="ps-link danger" onClick={() => setConfirming(m.id)}>Delete</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="ps-note">
            A message that is switched off is kept but never sent. Choose when they arrive under Delivery.
          </p>
        </>
      )}
    </div>
  );
}
