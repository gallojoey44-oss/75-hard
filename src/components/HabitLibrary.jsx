import { useState } from 'react';
import { HABIT_GUIDES, EVIDENCE_LEGEND } from '../data/habitGuides';
import HabitGuide from './HabitGuide';

/**
 * 📖 The Habit Library — every strategy guide, permanently.
 *
 * The guides are EDUCATION, and education should not be gated behind
 * enrolment. This screen reads the same shared registry the challenge screens
 * read, so there is exactly one copy of every guide, reachable whether a
 * challenge is running, has never been started, or ended months ago.
 *
 * Nothing here can complete a habit or award XP: guides open in read-only mode
 * (HabitGuide draws no checkbox without an `onToggle`), and this component has
 * no access to the day store at all. That separation is the point — browsing
 * what a good night's sleep looks like is not the same as having slept.
 */
export default function HabitLibrary({ onClose }) {
  const [openId, setOpenId] = useState(null);

  // Grouped by the module that supplied them, so a second challenge's guides
  // land in their own section rather than one undifferentiated list.
  // `key` is the NAMESPACED registry id ("lockin:sleep"), kept separate from
  // the guide's own local `id` ("sleep") — spreading the guide over a field
  // called `id` would overwrite it and nothing would resolve.
  const groups = Object.entries(
    Object.entries(HABIT_GUIDES).reduce((acc, [key, g]) => {
      (acc[g.source] ||= []).push({ ...g, key });
      return acc;
    }, {}),
  );
  const total = Object.keys(HABIT_GUIDES).length;

  return (
    <>
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card hl-card" onClick={e => e.stopPropagation()}>
        <div className="hl-head">
          <span className="hl-icon">📖</span>
          <div className="hl-head-text">
            <h3 className="hl-title">Habits &amp; Strategies</h3>
            <p className="hl-tagline">
              {total} habit {total === 1 ? 'guide' : 'guides'} — read any of them any time,
              challenge or no challenge.
            </p>
          </div>
          <button className="hl-close" onClick={onClose} aria-label="Close the habit library">✕</button>
        </div>

        <div className="hl-note">
          These are reference material. Opening a guide never completes a habit and never awards
          XP — tracking lives on the Today screen while a challenge is running.
        </div>

        {groups.map(([source, items]) => (
          <div key={source} className="hl-group">
            <div className="hl-group-title">{SOURCE_LABELS[source] || source}</div>
            {items.map((g, i) => (
              <button key={g.key} className="hl-row" onClick={() => setOpenId(g.key)}>
                <span className="hl-row-num">{i + 1}</span>
                <span className="hl-row-icon">{g.icon}</span>
                <span className="hl-row-text">
                  <span className="hl-row-title">{g.title}</span>
                  <span className="hl-row-tagline">{g.tagline}</span>
                </span>
                <span className="hl-row-caret">→</span>
              </button>
            ))}
          </div>
        ))}

        <p className="hl-legend">{EVIDENCE_LEGEND}</p>
        <button className="btn btn-ghost btn-full hl-done" onClick={onClose}>Close</button>
      </div>
    </div>

    {/* Rendered as a SIBLING of the library overlay, not inside its card: the
        card is animated with a transform, which would become the containing
        block for a nested fixed-position overlay and break its layout.
        Read-only — no xp, no checked state and no onToggle, so HabitGuide draws
        no checkbox and nothing here can change a day's record. */}
    {openId && (
      <HabitGuide
        guide={HABIT_GUIDES[openId]}
        onClose={() => setOpenId(null)}
      />
    )}
    </>
  );
}

/**
 * Where a group of guides came from. A guide's `source` is its registry
 * namespace; this only ever affects the heading above the list.
 */
const SOURCE_LABELS = {
  lockin: '🎯 LOCK IN habits',
};
