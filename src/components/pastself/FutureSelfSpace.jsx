import { useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { FutureSelfLetterView } from '../FutureSelfLetter';
import {
  readPastSelf, saveLetter, deleteLetter, lettersNewestFirst,
  LETTER_PROMPTS, MAX_LETTERS, MAX_LETTER_CHARS, MAX_TITLE_CHARS,
  formatWritten,
} from '../../utils/pastSelf';
import PastSelfMessages from './PastSelfMessages';
import PastSelfDelivery from './PastSelfDelivery';

/**
 * Letters to My Future Self — the place a person writes to themselves.
 *
 * Three parts, in the order they are used: write a letter, write the short
 * lines you want sent back, choose when they arrive. It is reached from Home
 * and from Settings → Notifications and is deliberately not a bottom-bar tab:
 * this is somewhere you go on purpose, a few times, not a daily screen.
 *
 * The letters a challenge asked for when it started are listed here too, read
 * with the same viewer "Read My Why" uses. They are not copied or converted —
 * they stay on the challenge they belong to — but a person looking for
 * something they once wrote to themselves should find it in one place.
 */

const TABS = [
  { id: 'letters', label: 'Letters' },
  { id: 'messages', label: 'Messages' },
  { id: 'delivery', label: 'Delivery' },
];

export default function FutureSelfSpace({ initialTab = 'letters', onBack, onPreviewMessage }) {
  const { activeProfile, profile, updatePastSelf, getChallengeMeta, archives } = useApp();
  const state = useMemo(() => readPastSelf(profile), [profile]);
  const [tab, setTab] = useState(TABS.some(t => t.id === initialTab) ? initialTab : 'letters');

  return (
    <div className="ps-space" data-testid="future-self-space">
      <header className="ps-head">
        <button type="button" className="ps-back" onClick={onBack} aria-label="Back">
          <span aria-hidden="true">‹</span> Back
        </button>
        <h1 className="ps-title">Letters to My Future Self</h1>
        <p className="ps-lede">Your own words, kept here and sent back to you when you need them.</p>
      </header>

      <div className="ps-tabs" role="tablist" aria-label="Letters to My Future Self">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`ps-tab${tab === t.id ? ' on' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'letters' && state.letters.length > 0 && <span className="ps-tab-n">{state.letters.length}</span>}
            {t.id === 'messages' && state.messages.length > 0 && <span className="ps-tab-n">{state.messages.length}</span>}
          </button>
        ))}
      </div>

      {tab === 'letters' && (
        <LettersTab
          state={state}
          update={updatePastSelf}
          challengeLetters={collectChallengeLetters(getChallengeMeta(), archives?.[activeProfile] || [])}
        />
      )}
      {tab === 'messages' && (
        <PastSelfMessages state={state} update={updatePastSelf} onPreview={onPreviewMessage} />
      )}
      {tab === 'delivery' && (
        <PastSelfDelivery state={state} update={updatePastSelf} onGoToMessages={() => setTab('messages')} />
      )}
    </div>
  );
}

/**
 * Every Future Self Letter written at the start of a challenge — the running
 * one first, then archived ones, newest first. Read-only: each is part of the
 * attempt it was written for.
 */
function collectChallengeLetters(meta, archiveList) {
  const out = [];
  const has = (l) => l && Object.keys(l).some(k => k !== 'writtenAt' && String(l[k] || '').trim());
  if (has(meta?.futureSelfLetter)) {
    out.push({ key: 'active', name: meta.name || 'Current challenge', letter: meta.futureSelfLetter, current: true });
  }
  [...archiveList].reverse().forEach((a, i) => {
    const l = a?.challenge?.futureSelfLetter;
    if (has(l)) out.push({ key: a.id || `arch-${i}`, name: a.challenge?.name || 'Past challenge', letter: l, current: false });
  });
  return out;
}

function LettersTab({ state, update, challengeLetters }) {
  // null = the list; 'new' = composing; an id = reading or editing that letter.
  const [open, setOpen] = useState(null);
  const [editing, setEditing] = useState(false);
  const [viewChallenge, setViewChallenge] = useState(null);
  const letters = lettersNewestFirst(state);
  const current = open && open !== 'new' ? state.letters.find(l => l.id === open) : null;

  if (open === 'new' || (current && editing)) {
    return (
      <LetterEditor
        letter={current}
        onCancel={() => { setEditing(false); if (open === 'new') setOpen(null); }}
        onSave={(draft) => {
          update(s => saveLetter(s, { id: current?.id || null, ...draft }));
          setEditing(false);
          setOpen(null);
        }}
        onDelete={current ? () => { update(s => deleteLetter(s, current.id)); setEditing(false); setOpen(null); } : null}
      />
    );
  }

  if (current) {
    return (
      <article className="ps-reader" data-testid="letter-reader">
        <button type="button" className="ps-link" onClick={() => setOpen(null)}>‹ All letters</button>
        <h2 className="ps-reader-title">{current.title || 'A letter to my future self'}</h2>
        <div className="ps-reader-date">
          Written {formatWritten(current.createdAt)}
          {current.updatedAt && current.updatedAt.slice(0, 10) !== current.createdAt.slice(0, 10)
            && ` · edited ${formatWritten(current.updatedAt)}`}
        </div>
        <div className="ps-reader-body">{current.body}</div>
        <div className="ps-row-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setEditing(true)}>Edit letter</button>
        </div>
      </article>
    );
  }

  return (
    <div className="ps-pane">
      {letters.length === 0 ? (
        <div className="ps-empty">
          <div className="ps-empty-mark" aria-hidden="true">✉️</div>
          <h2 className="ps-empty-title">Write to the person you are becoming</h2>
          <p className="ps-empty-text">
            Say why you started, what you are afraid of, and what you want to remember on the day
            you feel like quitting. Only you can read it.
          </p>
        </div>
      ) : (
        <ul className="ps-list">
          {letters.map(l => (
            <li key={l.id}>
              <button type="button" className="ps-letter-card" onClick={() => { setEditing(false); setOpen(l.id); }}>
                <span className="ps-letter-card-title">{l.title || 'A letter to my future self'}</span>
                <span className="ps-letter-card-date">{formatWritten(l.createdAt)}</span>
                <span className="ps-letter-card-excerpt">{l.body}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className="btn btn-primary btn-full"
        onClick={() => setOpen('new')}
        disabled={state.letters.length >= MAX_LETTERS}
      >
        {letters.length === 0 ? 'Write my first letter' : 'Write another letter'}
      </button>

      {challengeLetters.length > 0 && (
        <section className="ps-section">
          <h3 className="ps-section-title">From your challenges</h3>
          <p className="ps-note">
            Written when you started a challenge. Each one stays with that challenge, exactly as
            you wrote it.
          </p>
          <ul className="ps-list">
            {challengeLetters.map(c => (
              <li key={c.key}>
                <button type="button" className="ps-letter-card compact" onClick={() => setViewChallenge(c)}>
                  <span className="ps-letter-card-title">{c.name}</span>
                  <span className="ps-letter-card-date">
                    {c.current ? 'Current challenge' : 'Completed challenge'}
                    {c.letter.writtenAt ? ` · written ${formatWritten(c.letter.writtenAt)}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {viewChallenge && (
        <FutureSelfLetterView letter={viewChallenge.letter} onClose={() => setViewChallenge(null)} />
      )}
    </div>
  );
}

/**
 * The letter editor: one page to write on.
 *
 * The prompts are a list of questions, not a form. Tapping one puts the
 * question into the letter on its own line, so the page stays a single piece
 * of writing and nothing has to be answered. A question already in the letter
 * is not added twice.
 */
function LetterEditor({ letter, onSave, onCancel, onDelete }) {
  const [title, setTitle] = useState(letter?.title || '');
  const [body, setBody] = useState(letter?.body || '');
  const [showPrompts, setShowPrompts] = useState(!letter);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const areaRef = useRef(null);
  const canSave = body.trim().length > 0;
  const dirty = title !== (letter?.title || '') || body !== (letter?.body || '');

  function addPrompt(question) {
    if (body.includes(question)) { areaRef.current?.focus(); return; }
    const lead = body.trim().length === 0 ? '' : (body.endsWith('\n\n') ? '' : body.endsWith('\n') ? '\n' : '\n\n');
    const next = `${body}${lead}${question}\n`;
    if (next.length > MAX_LETTER_CHARS) return;
    // Committed synchronously so the cursor can be placed in the same tap.
    // Doing this a frame later left a gap in which a keystroke landed at the
    // start of the letter — and iOS only raises the keyboard for a focus()
    // made inside the tap itself.
    flushSync(() => setBody(next));
    const el = areaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(next.length, next.length);   // the empty line under the question
    el.scrollTop = el.scrollHeight;
  }

  return (
    <div className="ps-editor" data-testid="letter-editor">
      <div className="ps-editor-bar">
        <button
          type="button"
          className="ps-link"
          onClick={() => { if (!dirty || window.confirm('Discard what you have written?')) onCancel(); }}
        >
          Cancel
        </button>
        <span className="ps-editor-kicker">{letter ? 'Editing your letter' : 'A new letter'}</span>
        <button type="button" className="ps-save" disabled={!canSave} onClick={() => onSave({ title, body })}>
          Save
        </button>
      </div>

      <input
        className="ps-title-input"
        type="text"
        value={title}
        maxLength={MAX_TITLE_CHARS}
        onChange={e => setTitle(e.target.value)}
        placeholder="Title (optional)"
        aria-label="Letter title, optional"
      />

      <textarea
        ref={areaRef}
        className="ps-paper"
        value={body}
        maxLength={MAX_LETTER_CHARS}
        onChange={e => setBody(e.target.value)}
        placeholder={'Dear future me,\n\nWrite freely. Nobody else reads this.'}
        aria-label="Your letter"
        rows={12}
      />

      <div className="ps-prompts">
        <button
          type="button"
          className="ps-prompts-toggle"
          aria-expanded={showPrompts}
          onClick={() => setShowPrompts(v => !v)}
        >
          <span>Need somewhere to start?</span>
          <span aria-hidden="true">{showPrompts ? '▾' : '▸'}</span>
        </button>
        {showPrompts && (
          <>
            <p className="ps-note">All optional. Tap one to add it to your letter.</p>
            <ul className="ps-prompt-list">
              {LETTER_PROMPTS.map(q => (
                <li key={q}>
                  <button
                    type="button"
                    className={`ps-prompt${body.includes(q) ? ' used' : ''}`}
                    onClick={() => addPrompt(q)}
                  >
                    {q}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {onDelete && (
        <div className="ps-danger">
          {confirmDelete ? (
            <>
              <span className="ps-note">Delete this letter for good?</span>
              <div className="ps-row-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>Keep it</button>
                <button type="button" className="btn btn-danger" onClick={onDelete}>Delete letter</button>
              </div>
            </>
          ) : (
            <button type="button" className="ps-link danger" onClick={() => setConfirmDelete(true)}>Delete this letter</button>
          )}
        </div>
      )}
    </div>
  );
}
