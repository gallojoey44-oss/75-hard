import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  readPastSelf, resolveReveal, lettersNewestFirst, formatWritten, ago, todayLocalDate,
} from '../../utils/pastSelf';

/**
 * Opening a message from your past self.
 *
 * This is the moment the feature exists for, so it gets the whole screen and
 * nothing else on it: the words, who they are from, and when they were written.
 * No streak, no XP, no checkbox. Reading it completes nothing and awards
 * nothing — it is not a habit, and this component has no access to anything
 * that could make it one.
 *
 * `target` says which message to show:
 *   { msg }      the message the server chose (lock-screen display was on)
 *   { date }     the local date the notification was sent for — the app then
 *                picks by the same rule the server uses
 *   { profile }  whose message it is. On a phone two people share, a
 *                notification for one profile may be tapped while the other is
 *                open. Their words are never shown in the wrong profile: the
 *                screen says whose it is and offers to switch.
 *   { letterId } open a specific letter directly
 */
export default function PastSelfReveal({ target, onClose, onOpenSpace }) {
  const { activeProfile, profile, profiles, setActiveProfile } = useApp();
  const dialogRef = useRef(null);
  const [reading, setReading] = useState(null);     // a letter opened from here

  useEffect(() => {
    // Focus moves to the dialog itself, not to a button inside it: a screen
    // reader announces the dialog, a keyboard reaches its controls with Tab,
    // and nobody who simply tapped a notification is greeted by a focus ring
    // around the close button.
    dialogRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const wrongProfile = !!(target?.profile && target.profile !== activeProfile && profiles?.[target.profile]);
  const state = useMemo(() => readPastSelf(profile), [profile]);
  const shown = useMemo(() => {
    if (wrongProfile) return { kind: 'other' };
    if (target?.letterId) {
      const letter = state.letters.find(l => l.id === target.letterId);
      if (letter) return { kind: 'letter', letter };
    }
    return resolveReveal(state, { date: target?.date || todayLocalDate(), msg: target?.msg || null });
  }, [state, target, wrongProfile]);

  const latestLetter = lettersNewestFirst(state)[0] || null;
  const letter = reading || (shown.kind === 'letter' ? shown.letter : null);

  return (
    <div ref={dialogRef} tabIndex={-1} className="ps-reveal" role="dialog" aria-modal="true" aria-label="A message from your past self" data-testid="past-self-reveal">
      <div className="ps-reveal-glow" aria-hidden="true" />
      <button type="button" className="ps-reveal-close" onClick={onClose} aria-label="Close">✕</button>

      <div className="ps-reveal-inner">
        {shown.kind === 'other' && (
          <div className="ps-reveal-block">
            <div className="ps-reveal-eyebrow">A message is waiting</div>
            <p className="ps-reveal-quiet">
              This one was written by {profiles[target.profile].name || 'the other profile'}, for themselves.
            </p>
            <div className="ps-reveal-actions">
              <button type="button" className="btn btn-primary" onClick={() => setActiveProfile(target.profile)}>
                Switch to {profiles[target.profile].name || 'that profile'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={onClose}>Not now</button>
            </div>
          </div>
        )}

        {shown.kind === 'message' && !reading && (
          <div className="ps-reveal-block">
            <div className="ps-reveal-eyebrow">A message from your past self</div>
            <div className="ps-reveal-mark" aria-hidden="true">“</div>
            <blockquote className="ps-reveal-words" data-testid="reveal-words">{shown.message.text}</blockquote>
            <div className="ps-reveal-sign">
              <span className="ps-reveal-rule" aria-hidden="true" />
              You wrote this {ago(shown.message.createdAt) || 'a while ago'}
              <span className="ps-reveal-date">{formatWritten(shown.message.createdAt)}</span>
            </div>
            <div className="ps-reveal-actions">
              {latestLetter && (
                <button type="button" className="btn btn-ghost" onClick={() => setReading(latestLetter)}>
                  Read my letter
                </button>
              )}
              <button type="button" className="btn btn-primary" onClick={onClose}>Carry on</button>
            </div>
          </div>
        )}

        {letter && (
          <div className="ps-reveal-block letter">
            <div className="ps-reveal-eyebrow">A letter from your past self</div>
            <h2 className="ps-reveal-letter-title">{letter.title || 'To my future self'}</h2>
            <div className="ps-reveal-letter-body" data-testid="reveal-letter">{letter.body}</div>
            <div className="ps-reveal-sign">
              <span className="ps-reveal-rule" aria-hidden="true" />
              You wrote this {ago(letter.createdAt) || 'a while ago'}
              <span className="ps-reveal-date">{formatWritten(letter.createdAt)}</span>
            </div>
            <div className="ps-reveal-actions">
              {reading && <button type="button" className="btn btn-ghost" onClick={() => setReading(null)}>Back to the message</button>}
              <button type="button" className="btn btn-primary" onClick={onClose}>Carry on</button>
            </div>
          </div>
        )}

        {shown.kind === 'none' && (
          <div className="ps-reveal-block">
            <div className="ps-reveal-eyebrow">A message from your past self</div>
            <p className="ps-reveal-quiet">
              There is nothing here to show — your messages may have been removed since this was sent.
            </p>
            <div className="ps-reveal-actions">
              <button type="button" className="btn btn-primary" onClick={() => { onClose(); onOpenSpace?.('messages'); }}>
                Write one now
              </button>
              <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
