import { useState, useId } from 'react';

/**
 * A labelled expandable section.
 *
 * Today carries a lot of genuinely useful detail — grading, weekly targets,
 * per-challenge panels — and all of it competing for attention is what made the
 * page hard to use daily. None of it is removed: it moves behind one of these,
 * named plainly enough that it is obvious what is inside.
 *
 * Closed by default, open remembered for the session only (never persisted, so
 * it cannot disagree with stored data). Uses a real <button> with
 * aria-expanded, so VoiceOver announces the state and the whole header is one
 * large touch target.
 */
export default function Collapsible({
  title,
  icon = null,
  summary = null,
  defaultOpen = false,
  children,
  className = '',
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const id = useId();

  return (
    <section className={`f4-collapse${open ? ' open' : ''}${className ? ' ' + className : ''}`}>
      <button
        type="button"
        className="f4-collapse-head"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(v => !v)}
      >
        {icon && <span className="f4-collapse-icon" aria-hidden="true">{icon}</span>}
        <span className="f4-collapse-title">{title}</span>
        {summary != null && <span className="f4-collapse-summary">{summary}</span>}
        <span className="f4-collapse-chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>
      {/* Mounted only when open: the panels inside do real work (scoring,
          weekly requirement resolution), so keeping them unmounted is what
          keeps the first paint of Today fast on a phone. */}
      {open && <div className="f4-collapse-body" id={id}>{children}</div>}
    </section>
  );
}
