import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { getTodayStr } from '../utils/dateUtils';
import { getAvailableQuotes, getDailyQuote, getDailyReflectionPrompt, SOURCE_EMOJI } from '../utils/quoteUtils';

export default function QuoteOfTheDay() {
  const {
    profile,
    toggleFavoriteQuote,
    getQuoteDataForDate,
    updateQuoteDataForDate,
  } = useApp();

  const [open, setOpen] = useState(false);

  const today = getTodayStr();
  const dayData = getQuoteDataForDate(today) || { cycleOffset: 0, reflectionNotes: '', reflectionComplete: false };

  const settings  = profile?.quoteSettings || {};
  const enabled   = settings.enabledSources ?? [];
  const favorites = settings.favorites || [];
  const showTask  = settings.showReflectionTask || false;

  const quotes  = getAvailableQuotes(profile?.customQuotes || [], enabled);
  const quote   = getDailyQuote(today, quotes, dayData.cycleOffset);
  const prompt  = getDailyReflectionPrompt(today);

  if (!quote) {
    return (
      <div className="quote-card">
        <div className="quote-card-header" onClick={() => setOpen(o => !o)}>
          <span className="quote-card-icon">💬</span>
          <span className="quote-card-title">Quote of the Day</span>
          <span className="quote-card-chevron">No sources enabled</span>
        </div>
      </div>
    );
  }

  const isFav = favorites.includes(quote.id);

  function cycleQuote() {
    updateQuoteDataForDate(today, { cycleOffset: (dayData.cycleOffset || 0) + 1 });
  }

  function toggleFav() {
    toggleFavoriteQuote(quote.id);
  }

  function setNotes(reflectionNotes) {
    updateQuoteDataForDate(today, { reflectionNotes });
  }

  function toggleReflectionComplete() {
    updateQuoteDataForDate(today, { reflectionComplete: !dayData.reflectionComplete });
  }

  const sourceEmoji = SOURCE_EMOJI[quote.source] || '💬';
  const preview = quote.text.length > 55 ? quote.text.slice(0, 55).trimEnd() + '…' : quote.text;

  return (
    <div className={`quote-card${open ? ' open' : ''}`}>
      {/* Collapsed header — always visible */}
      <button className="quote-card-header" onClick={() => setOpen(o => !o)}>
        <span className="quote-card-icon">💬</span>
        <div className="quote-card-preview">
          <span className="quote-card-title">Quote of the Day</span>
          {!open && <span className="quote-card-snippet">"{preview}"</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {dayData.reflectionComplete && <span className="quote-done-badge">✓</span>}
          <span className={`mental-chevron${open ? ' open' : ''}`}>⌄</span>
        </div>
      </button>

      {/* Expanded body */}
      {open && (
        <div className="quote-card-body">
          {/* Quote text */}
          <div className="quote-text-wrap">
            <blockquote className="quote-text">"{quote.text}"</blockquote>
          </div>

          {/* Attribution row */}
          <div className="quote-attribution">
            <span className="quote-source-badge">
              {sourceEmoji} {quote.source}
            </span>
            {quote.reference && (
              <span className="quote-reference">· {quote.reference}</span>
            )}
          </div>

          {/* Metadata row */}
          <div className="quote-meta-row">
            <span className="quote-theme-pill">{quote.theme}</span>
            {quote.isInspired && (
              <span className="quote-inspired-pill">✨ Inspired reflection</span>
            )}
          </div>

          {/* Action buttons */}
          <div className="quote-actions">
            <button
              className={`btn btn-icon quote-fav-btn${isFav ? ' active' : ''}`}
              onClick={toggleFav}
              title={isFav ? 'Remove from favorites' : 'Save to favorites'}
            >
              {isFav ? '♥' : '♡'}
            </button>
            <button
              className="btn btn-ghost quote-cycle-btn"
              onClick={cycleQuote}
              title="New quote"
            >
              ↻ New quote
            </button>
          </div>

          {/* Divider */}
          <div className="quote-divider" />

          {/* Reflection prompt */}
          <div className="quote-prompt">
            <span className="quote-prompt-icon">💭</span>
            <span className="quote-prompt-text">{prompt}</span>
          </div>

          {/* Reflection notes */}
          <textarea
            className="mental-notes quote-notes"
            rows={3}
            placeholder="Write your reflection here…"
            value={dayData.reflectionNotes || ''}
            onChange={e => setNotes(e.target.value)}
          />

          {/* Optional reflection complete button */}
          {showTask && (
            dayData.reflectionComplete ? (
              <button className="btn btn-ghost btn-full" onClick={toggleReflectionComplete}>
                Unmark Reflection Complete
              </button>
            ) : (
              <button className="btn btn-success btn-full" onClick={toggleReflectionComplete}>
                ✓ Mark Reflection Complete
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
