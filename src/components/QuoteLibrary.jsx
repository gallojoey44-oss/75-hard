import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { SOURCES, THEMES, DEFAULT_QUOTES } from '../data/defaultQuotes';
import { SOURCE_EMOJI } from '../utils/quoteUtils';

const BLANK_FORM = { text: '', source: 'Custom', reference: '', theme: 'Discipline', isInspired: true };

function QuoteForm({ initial = BLANK_FORM, onSave, onCancel, saveLabel = 'Add Quote' }) {
  const [form, setForm] = useState({ ...BLANK_FORM, ...initial });

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  function submit(e) {
    e.preventDefault();
    if (!form.text.trim()) return;
    onSave({ ...form, text: form.text.trim(), reference: form.reference.trim() });
  }

  return (
    <form className="quote-form" onSubmit={submit}>
      <div className="quote-form-field">
        <label className="quote-form-label">Quote / Reflection</label>
        <textarea
          className="mental-notes"
          rows={3}
          placeholder="Enter quote or inspired reflection…"
          value={form.text}
          onChange={e => set('text', e.target.value)}
          required
        />
      </div>

      <div className="quote-form-row">
        <div className="quote-form-field" style={{ flex: 1 }}>
          <label className="quote-form-label">Source</label>
          <select className="quote-select" value={form.source} onChange={e => set('source', e.target.value)}>
            {SOURCES.map(s => <option key={s} value={s}>{SOURCE_EMOJI[s]} {s}</option>)}
          </select>
        </div>
        <div className="quote-form-field" style={{ flex: 1 }}>
          <label className="quote-form-label">Theme</label>
          <select className="quote-select" value={form.theme} onChange={e => set('theme', e.target.value)}>
            {THEMES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="quote-form-field">
        <label className="quote-form-label">Character / Book / Reference <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(optional)</span></label>
        <input
          className="inline-input"
          style={{ width: '100%' }}
          placeholder="e.g. Musashi, Chapter 12, John 3:16"
          value={form.reference}
          onChange={e => set('reference', e.target.value)}
        />
      </div>

      <div className="quote-form-field">
        <label className="quote-form-toggle">
          <input
            type="checkbox"
            checked={form.isInspired}
            onChange={e => set('isInspired', e.target.checked)}
          />
          <span>Mark as inspired reflection (not exact quote)</span>
        </label>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
          {saveLabel}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function QuoteLibrary() {
  const {
    profile,
    updateQuoteSettings,
    addCustomQuote,
    updateCustomQuote,
    deleteCustomQuote,
    toggleFavoriteQuote,
  } = useApp();

  const [showAdd, setShowAdd]   = useState(false);
  const [editId, setEditId]     = useState(null);
  const [showDefaults, setShowDefaults] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const settings     = profile?.quoteSettings || {};
  const enabled      = settings.enabledSources ?? [...SOURCES];
  const favorites    = settings.favorites || [];
  const showTask     = settings.showReflectionTask || false;
  const customQuotes = profile?.customQuotes || [];

  function toggleSource(src) {
    const next = enabled.includes(src)
      ? enabled.filter(s => s !== src)
      : [...enabled, src];
    updateQuoteSettings({ enabledSources: next });
  }

  function handleAdd(data) {
    addCustomQuote(data);
    setShowAdd(false);
  }

  function handleEdit(data) {
    updateCustomQuote(editId, data);
    setEditId(null);
  }

  function handleDelete(id) {
    deleteCustomQuote(id);
    setDeleteConfirm(null);
  }

  const favQuotes = [
    ...DEFAULT_QUOTES,
    ...customQuotes,
  ].filter(q => favorites.includes(q.id));

  return (
    <div>
      <div className="section-title">💬 Quote Library</div>

      {/* Source toggles */}
      <div className="ql-section-label">Active Sources</div>
      <div className="ql-source-grid">
        {SOURCES.filter(s => s !== 'Custom').map(src => (
          <button
            key={src}
            className={`ql-source-chip${enabled.includes(src) ? ' on' : ''}`}
            onClick={() => toggleSource(src)}
          >
            <span>{SOURCE_EMOJI[src]}</span>
            <span>{src}</span>
          </button>
        ))}
      </div>

      {/* Reflection task toggle */}
      <div className="settings-row" style={{ marginTop: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Reflection Task</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
            Show "Mark Reflection Complete" on each quote
          </div>
        </div>
        <button
          className={`toggle-btn${showTask ? ' on' : ''}`}
          onClick={() => updateQuoteSettings({ showReflectionTask: !showTask })}
        >
          {showTask ? 'On' : 'Off'}
        </button>
      </div>

      {/* Favorites */}
      {favQuotes.length > 0 && (
        <>
          <div className="ql-section-label" style={{ marginTop: 20 }}>
            ♥ Saved Favorites ({favQuotes.length})
          </div>
          <div className="ql-quote-list">
            {favQuotes.map(q => (
              <div key={q.id} className="ql-quote-row">
                <div className="ql-quote-text">"{q.text}"</div>
                <div className="ql-quote-sub">
                  {SOURCE_EMOJI[q.source]} {q.source} · {q.theme}
                  {q.reference && ` · ${q.reference}`}
                </div>
                <button
                  className="ql-unfav-btn"
                  onClick={() => toggleFavoriteQuote(q.id)}
                >
                  ♥ Remove
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Custom quotes */}
      <div className="ql-section-label" style={{ marginTop: 20 }}>
        ✏️ My Custom Quotes ({customQuotes.length})
      </div>

      {customQuotes.length === 0 && !showAdd && (
        <p className="text-muted" style={{ fontSize: 13, marginBottom: 12 }}>
          No custom quotes yet. Add one below.
        </p>
      )}

      <div className="ql-quote-list">
        {customQuotes.map(q => (
          <div key={q.id} className="ql-quote-row">
            {editId === q.id ? (
              <QuoteForm
                initial={q}
                onSave={handleEdit}
                onCancel={() => setEditId(null)}
                saveLabel="Save Changes"
              />
            ) : (
              <>
                <div className="ql-quote-text">"{q.text}"</div>
                <div className="ql-quote-sub">
                  {SOURCE_EMOJI[q.source]} {q.source} · {q.theme}
                  {q.reference && ` · ${q.reference}`}
                  {q.isInspired && ' · ✨ inspired'}
                </div>
                <div className="ql-quote-actions">
                  <button className="btn btn-ghost ql-action-btn" onClick={() => setEditId(q.id)}>
                    Edit
                  </button>
                  {deleteConfirm === q.id ? (
                    <>
                      <button className="btn btn-danger ql-action-btn" onClick={() => handleDelete(q.id)}>
                        Confirm
                      </button>
                      <button className="btn btn-ghost ql-action-btn" onClick={() => setDeleteConfirm(null)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button className="btn btn-danger ql-action-btn" onClick={() => setDeleteConfirm(q.id)}>
                      Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {showAdd ? (
        <QuoteForm onSave={handleAdd} onCancel={() => setShowAdd(false)} />
      ) : (
        <button className="btn btn-ghost btn-full" style={{ marginTop: 8 }} onClick={() => setShowAdd(true)}>
          + Add Custom Quote
        </button>
      )}

      {/* Default quotes browser */}
      <button
        className="btn btn-ghost btn-full"
        style={{ marginTop: 12, fontSize: 13 }}
        onClick={() => setShowDefaults(v => !v)}
      >
        {showDefaults ? '▲ Hide' : '▼ Browse'} Starter Library ({DEFAULT_QUOTES.length} entries)
      </button>

      {showDefaults && (
        <div className="ql-quote-list" style={{ marginTop: 8 }}>
          {DEFAULT_QUOTES.map(q => {
            const isFav = favorites.includes(q.id);
            return (
              <div key={q.id} className="ql-quote-row">
                <div className="ql-quote-text">"{q.text}"</div>
                <div className="ql-quote-sub">
                  {SOURCE_EMOJI[q.source]} {q.source} · {q.theme}
                  {q.reference && ` · ${q.reference}`}
                  {q.isInspired && ' · ✨ inspired'}
                </div>
                <button
                  className={`ql-unfav-btn${isFav ? ' active' : ''}`}
                  onClick={() => toggleFavoriteQuote(q.id)}
                >
                  {isFav ? '♥ Saved' : '♡ Save'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
