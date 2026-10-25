/**
 * One daily requirement.
 *
 * The single task row for BOTH profiles. It used to be this component for one
 * profile and a separate colour-blocked card for the other, which meant two
 * layouts to keep premium, two sets of affordances, and no shared idea of what
 * a habit row is. The profile's identity now comes from the accent colour it
 * already sets, not from a different component.
 *
 * The outer contract is deliberately unchanged — `.check-item`, `.check-box`,
 * `.check-name`, `.check-xp`, `role="checkbox"` — because that is what the
 * suite drives the app through, and a redesign has no business moving the
 * handle every test and every muscle memory reaches for. `variant="card"` adds
 * the legacy `gf-*` class names so the card layout's own assertions still
 * describe the rows they were written for.
 *
 * `target` renders a requirement that carries a quantity, duration or
 * measurement ("8,000+ steps", "7.5+ hours") so the row states what qualifies
 * without opening the guide.
 */

const DIRECTION_PREFIX = {
  atLeast: '≥',
  atMost: '≤',
  exactly: '',
};

/** A task's own completion condition, as a short readable chip. */
function targetLabel(target) {
  if (!target || target.value == null) return null;
  const prefix = DIRECTION_PREFIX[target.direction] ?? '';
  const unit = String(target.unit || '')
    .replace(/_/g, ' ')
    .replace(/^g protein$/, 'g protein');
  const value = Number(target.value);
  const shown = Number.isFinite(value) ? value.toLocaleString() : target.value;
  return `${prefix}${prefix ? ' ' : ''}${shown}${unit ? ' ' + unit : ''}`;
}

import { useState, useRef, useLayoutEffect } from 'react';

export default function CheckItem({
  task, checked, onToggle, disabled, keystone = 0, xp, supports = null,
  onOpenGuide = null, variant = 'row',
}) {
  // The WHOLE of the habit's guidance, clamped by CSS rather than cut here.
  // Taking only the first sentence read tidily and quietly dropped the point:
  // Hormone Health's hydration habit says "Your normal daily hydration target"
  // and then, in the sentence that actually matters, that no special salt or
  // electrolyte product is required. A row that answers "what counts?" cannot
  // throw away the half that answers it.
  const desc = task.desc;
  const card = variant === 'card';
  // A target badge beside "Sleep opportunity: 8+ hours" or "Attention
  // training: 10+ minutes" says the same thing twice. It is shown only when
  // the row does not already state the figure.
  const rawTarget = targetLabel(task.target);
  const stated = rawTarget
    ? new RegExp(`\\b${String(task.target.value).replace('.', '\\.')}\\b`)
      .test(`${task.name || ''} ${desc || ''}`)
    : false;
  const target = stated ? null : rawTarget;

  // ── Reading the rest of a clamped description ───────────────────────────
  //
  // The row shows two lines. Habits that carry a strategy guide have the full
  // text one tap away, but a habit WITHOUT a guide had its requirement cut off
  // with nowhere to read the remainder — and whether a line is cut depends on
  // the device's width, not on anything knowable here. So it is measured: when
  // the text does not fit, the row offers to expand it in place.
  const descRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  useLayoutEffect(() => {
    const el = descRef.current;
    if (!el) { setClamped(false); return; }
    // Measured against the clamped box, so expanding does not immediately
    // report itself as un-clamped and hide the control.
    if (expanded) return;
    setClamped(el.scrollHeight > el.clientHeight + 1);
  }, [desc, expanded]);

  return (
    <div
      className={
        'check-item f4-task' +
        (card ? ' gf-task-card' : '') +
        (checked ? ' done' : '') +
        (supports ? ' shared-habit' : '') +
        (disabled ? ' disabled' : '') +
        (keystone ? ` keystone keystone-${keystone}` : '')
      }
      onClick={disabled ? undefined : onToggle}
      role="checkbox"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onToggle?.(); }
      }}
    >
      <div className={`check-box${checked ? ' checked' : ''}`} aria-hidden="true">
        <span className="check-tick">✓</span>
      </div>

      <span className="f4-task-mark">
        <span className="check-icon" aria-hidden="true">{task.icon || '•'}</span>
        {keystone > 0 && (
          <span className="keystone-stars" title={`Keystone habit (${keystone} of 3)`}>
            {'⭐'.repeat(keystone)}
          </span>
        )}
      </span>

      <span className={`check-name${checked ? ' done' : ''}`}>
        <span className="f4-task-title">{task.name}</span>
        {/* What actually qualifies, so the guide is optional. */}
        {desc && (
          <span
            className={`check-desc${expanded ? ' expanded' : ''}`}
            ref={descRef}
          >
            {desc}
          </span>
        )}
        {desc && (clamped || expanded) && (
          <button
            type="button"
            className="check-desc-more"
            aria-expanded={expanded}
            onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
          >
            {expanded ? 'Show less' : 'Show full requirement'}
          </button>
        )}
        {/* Chips and the guide share one line under the habit, so the row
            stays three columns wide. Giving the guide a column of its own
            squeezed the name into a word-per-line column on a phone. */}
        <span className="f4-task-chips">
          {target && <span className="f4-chip f4-chip-target">{target}</span>}
          {/* One behaviour, two challenges: this row satisfies both and pays XP once. */}
          {supports && (
            <span className={`check-supports f4-chip${card ? ' gf-task-supports' : ''}`}>🔗 {supports}</span>
          )}
        </span>
      </span>

      {/* The XP a habit is worth and the way into its guide share the right
          column. The guide used to sit in the chip row, which cost every habit
          without a target an entire extra line. */}
      <span className="f4-task-aside">
        {typeof xp === 'number' && (
          <span className={`check-xp${checked ? ' earned' : ''}`}>{xp.toLocaleString()} XP</span>
        )}
        {/* Stops propagation so opening the guide never toggles the task. */}
        {onOpenGuide && (
          <button
            className={`check-guide${card ? ' gf-task-guide' : ''}`}
            onClick={(e) => { e.stopPropagation(); onOpenGuide(); }}
            aria-label={`Open the ${task.name} strategy guide`}
            title="Strategy guide"
          >
            Guide
          </button>
        )}
      </span>
    </div>
  );
}
