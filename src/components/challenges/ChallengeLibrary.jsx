import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  visibleChallenges, difficultyRange, durationRangeText,
} from '../../data/challengeTemplates';
import { availableFilters, matchesFocus, focusTagsOf, focusLabel } from '../../data/challengeFocus';
import { TIER_LABELS } from '../../data/xpEconomy';

const DIFFICULTY_COLOR = {
  Easy: '#6fcf97', Medium: '#f5b23a', 'Medium-Hard': '#f58a3a', Hard: '#ff7a7a',
};

/**
 * Explore Challenges.
 *
 * The library was eleven collapsed rows that each expanded into a full page of
 * difficulty tabs, requirement lists, XP tables and a start button. Everything
 * was reachable and nothing was browsable: comparing two challenges meant
 * expanding one, scrolling it, collapsing it and finding the other.
 *
 * Now it is a list of rows that answer the three questions a person actually
 * asks while browsing — what is it, how hard is it, how long is it — and
 * tapping one opens a real page. Every figure still comes from the registry;
 * nothing here is written by hand.
 *
 * The rows were two columns of tiles first. That read well until it was
 * measured: a 175px tile holds about 22 characters a line, so the description
 * of nine of the ten challenges was cut mid-sentence. Full-width rows give
 * that line the ~290px it needs, at almost no cost in scroll.
 */
export default function ChallengeLibrary({ onOpen, activeTemplateId = null, supportTemplateId = null }) {
  const { activeProfile } = useApp();
  const [filter, setFilter] = useState('all');

  const templates = useMemo(() => visibleChallenges(activeProfile), [activeProfile]);
  const filters = useMemo(() => availableFilters(templates), [templates]);
  // Startable challenges lead. A Coming Soon one is still worth reading, but it
  // is not a thing you can do today, so it does not sit between two that are.
  const shown = useMemo(() => {
    const matched = templates.filter(t => matchesFocus(t, filter));
    return [...matched.filter(t => t.startable), ...matched.filter(t => !t.startable)];
  }, [templates, filter]);

  return (
    <div className="f4c-library">
      {/* Filtering is local state over the same list — it never touches an
          attempt, so switching chips cannot disturb a running challenge. */}
      <div className="f4c-filters" role="tablist" aria-label="Filter challenges by focus">
        {filters.map(f => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            className={`f4c-chip${filter === f.key ? ' on' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="f4c-grid challenges-list">
        {shown.map(t => (
          <ChallengeTile
            key={t.id}
            template={t}
            state={t.id === activeTemplateId ? 'primary' : t.id === supportTemplateId ? 'support' : null}
            onOpen={() => onOpen(t)}
          />
        ))}
      </div>

      {shown.length === 0 && (
        <p className="f4c-empty-note">No challenges in this category yet.</p>
      )}
    </div>
  );
}

/**
 * One challenge, as something to browse.
 *
 * A tile is always a way IN — even a Coming Soon challenge opens its page, so
 * the description and the plan can be read. What it never does is start
 * anything: that lives behind the details page and its setup flow.
 */
function ChallengeTile({ template, state, onOpen }) {
  const range = difficultyRange(template);
  const tags = focusTagsOf(template);
  const soon = !template.startable;

  return (
    // `challenge-card` is the same thing it always was — one challenge in the
    // library — so it keeps the name the suite knows it by. The header class
    // sits on a span inside the button, where a click still reaches the row.
    <button type="button" className={`f4c-tile challenge-card${soon ? ' soon' : ''}`} onClick={onOpen}>
      <span className="f4c-tile-emoji" aria-hidden="true">{template.emoji}</span>

      <span className="f4c-tile-body challenge-card-header">
        <span className="f4c-tile-name challenge-card-name">{template.challenge_name}</span>
        <span className="f4c-tile-desc">{template.tagline || template.purpose}</span>

        {/* Status, difficulty, length and focus share one wrapping line. They
            each had to be truncated or stacked to fit a 175px tile; at full
            width they simply fit, which is the point of the wider row. */}
        <span className="f4c-tile-foot challenge-card-meta">
          {state && (
            <span className={`f4c-tile-state ${state}`}>
              {state === 'primary' ? 'Primary' : 'Support'}
            </span>
          )}
          {soon && <span className="f4c-tile-state soon">Coming Soon</span>}
          {/* Difficulty and length travel together, so the dot between them is
              never left hanging at the end of a wrapped line. */}
          <span className="f4c-tile-pair">
            <span
              className="f4c-tile-diff"
              style={{ color: DIFFICULTY_COLOR[TIER_LABELS[range.tier]] || 'var(--text2)' }}
            >
              {range.label}
            </span>
            <span className="f4c-tile-dur">{durationRangeText(template)}</span>
          </span>
          {tags.map(tag => <span key={tag} className="f4c-tag">{focusLabel(tag)}</span>)}
        </span>
      </span>

      <span className="f4c-tile-chev" aria-hidden="true">›</span>
    </button>
  );
}
