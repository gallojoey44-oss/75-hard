import { useState } from 'react';
import { EVIDENCE_META, EVIDENCE_LEGEND } from '../data/habitGuides';

/**
 * A habit's strategy guide — the detail view behind a daily task row.
 *
 * Built so the main dashboard stays uncluttered: the task row shows only the
 * name, description, XP and checkbox, and everything educational lives in here.
 * Inside, Quick Start and "How to complete it" are open by default because they
 * are what someone opening this mid-challenge actually needs; the four longer
 * sections are collapsed until asked for.
 *
 * Entirely data-driven — it renders whatever guide it is handed and knows
 * nothing about any particular challenge. See data/habitGuides.js for the shape.
 */

function EvidenceTag({ level }) {
  const meta = EVIDENCE_META[level];
  if (!meta) return null;
  return (
    <span className="hg-ev" style={{ color: meta.color }} title={meta.blurb}>
      {meta.dot} {meta.label}
    </span>
  );
}

function Section({ id, title, meta, open, onToggle, children }) {
  return (
    <div className="hg-section">
      <button className="hg-section-toggle" onClick={() => onToggle(id)} aria-expanded={open}>
        <span className="hg-section-title">{title}</span>
        {meta && <span className="hg-section-meta">{meta}</span>}
        <span className="hg-caret">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="hg-section-body">{children}</div>}
    </div>
  );
}

/** Strategy list used by both Optimization and Advanced. */
function Strategies({ items }) {
  return (
    <>
      {items.map((s, i) => (
        <div key={i} className="hg-strategy">
          <div className="hg-strategy-head">
            <span className="hg-strategy-title">{s.title}</span>
            <EvidenceTag level={s.evidence} />
          </div>
          <p className="hg-strategy-body">{s.body}</p>
        </div>
      ))}
      <p className="hg-note">{EVIDENCE_LEGEND}</p>
    </>
  );
}

export default function HabitGuide({ guide, xp, checked, onToggle, onClose, rowRequirement = null }) {
  // Quick Start and the completion rules are what a user needs mid-challenge;
  // the long-form sections stay shut until opened.
  const [open, setOpen] = useState({ how: true });
  const toggle = (id) => setOpen(o => ({ ...o, [id]: !o[id] }));

  if (!guide) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card hg-card" onClick={e => e.stopPropagation()}>
        <div className="hg-head">
          <span className="hg-icon">{guide.icon}</span>
          <div className="hg-head-text">
            <h3 className="hg-title">{guide.title}</h3>
            <p className="hg-tagline">{guide.tagline}</p>
          </div>
          <button className="hg-close" onClick={onClose} aria-label="Close guide">✕</button>
        </div>

        {/* Quick Start — always visible, always first. Someone who opens this
            while standing in their kitchen should be able to act on it without
            reading anything else. */}
        <div className="hg-quick">
          <div className="hg-quick-title">⚡ Quick start</div>
          <ol className="hg-quick-list">
            {guide.quickStart.map((q, i) => <li key={i}>{q}</li>)}
          </ol>
        </div>

        {/* The checkbox is repeated here so the guide is somewhere you can act,
            not just read. Same task, same XP — this is the dashboard's state. */}
        {onToggle && (
          <button
            className={`hg-check${checked ? ' done' : ''}`}
            onClick={onToggle}
          >
            <span className={`hg-check-box${checked ? ' checked' : ''}`}>{checked ? '✓' : ''}</span>
            <span className="hg-check-label">
              {checked ? 'Completed today' : 'Mark complete for today'}
            </span>
            {typeof xp === 'number' && <span className="hg-check-xp">{xp.toLocaleString()} XP</span>}
          </button>
        )}

        <Section
          id="how" title="How to complete it" meta={typeof xp === 'number' ? `${xp.toLocaleString()} XP` : null}
          open={!!open.how} onToggle={toggle}
        >
          {/* The sentence from the habit's own row, in full. The row clamps it
              to two lines and offers no expand control when a guide exists,
              because two 44px controls do not fit in the row's right-hand
              column — so this is where the rest of it lives. Skipped when the
              guide's own requirement already says the same thing. */}
          {rowRequirement && rowRequirement.trim() !== guide.how.requirement.trim() && (
            <p className="hg-row-req">{rowRequirement}</p>
          )}
          <p className="hg-req">{guide.how.requirement}</p>
          <ul className="hg-list">
            {guide.how.earns.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
          {guide.how.notes && <p className="hg-note">{guide.how.notes}</p>}
        </Section>

        <Section id="why" title="Why it matters" open={!!open.why} onToggle={toggle}>
          <p className="hg-blurb">{guide.why.blurb}</p>
          <ul className="hg-list">
            {guide.why.points.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </Section>

        <Section
          id="optimize" title="Optimization strategies" meta={`${guide.optimize.length}`}
          open={!!open.optimize} onToggle={toggle}
        >
          <Strategies items={guide.optimize} />
        </Section>

        <Section
          id="advanced" title="Advanced strategies" meta="optional"
          open={!!open.advanced} onToggle={toggle}
        >
          <p className="hg-note">
            Optional. None of these is required by the challenge, and skipping all of them costs you nothing.
          </p>
          <Strategies items={guide.advanced} />
        </Section>

        <Section
          id="mistakes" title="Common mistakes" meta={`${guide.mistakes.length}`}
          open={!!open.mistakes} onToggle={toggle}
        >
          {guide.mistakes.map((m, i) => (
            <div key={i} className="hg-mistake">
              <span className="hg-mistake-title">{m.title}</span>
              <p className="hg-strategy-body">{m.body}</p>
            </div>
          ))}
        </Section>

        <Section id="examples" title="Practical examples" open={!!open.examples} onToggle={toggle}>
          {guide.examples.map((ex, i) => (
            <div key={i} className="hg-example">
              <div className="hg-example-label">{ex.label}</div>
              <ul className="hg-example-list">
                {ex.lines.map((l, n) => <li key={n}>{l}</li>)}
              </ul>
            </div>
          ))}
        </Section>

        <button className="btn btn-ghost btn-full hg-done" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
