import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatDateShort } from '../../utils/dateUtils';
import { displayXP, scaleOfArchive, scaleOfMeta } from '../../utils/xpDisplay';
import { LEGACY_PASSING_SCORE } from '../../utils/gamification';

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'completed', label: 'Completed' },
  { key: 'ended', label: 'Ended early' },
];

/**
 * Challenge History — everything that has run, is running, or is about to.
 *
 * The record already existed, split across three places that each told part of
 * it: Settings held the archives, Home held XP History, and whatever was
 * currently running was only visible on the Challenges tab. Reading your own
 * history meant knowing which of the three to look in.
 *
 * This is one list, in one order, with the distinction that matters kept
 * sharp: COMPLETED means the duration ran out, and PASSED means the
 * requirements were met. An attempt can do the first without the second, and
 * the old archive rows blurred them. An attempt the user stopped is neither —
 * it has no verdict, and this says so rather than inventing one.
 *
 * Every figure is read from the stored archive. Nothing is recomputed, graded
 * or estimated here.
 */
export default function ChallengeHistory({ onBack, onOpenActive }) {
  const {
    activeProfile, archives, profile, getChallengeMeta, getDayNumber,
    getSupportMeta, getSupportDayNumber, getSupportStart,
    isChallengeScheduled, isSupportScheduled, isForgeDaily,
  } = useApp();
  const [filter, setFilter] = useState('all');

  const rows = useMemo(() => {
    const out = [];
    const meta = getChallengeMeta();
    const baseline = isForgeDaily();
    const scheduled = isChallengeScheduled();

    // The live primary, unless it is the Forge Daily baseline — that is not a
    // challenge and has no result to report.
    if (profile?.challengeStart && !baseline) {
      out.push({
        key: 'live-primary',
        kind: scheduled ? 'scheduled' : 'active',
        name: meta.name, emoji: meta.emoji, variant: meta.variant,
        lane: 'Primary',
        startDate: profile.challengeStart,
        endDate: null,
        dayNum: scheduled ? null : getDayNumber(),
        durationDays: meta.durationDays ?? null,
        xpEarned: null,
      });
    }
    const sMeta = getSupportMeta?.();
    if (sMeta) {
      out.push({
        key: 'live-support',
        kind: isSupportScheduled?.() ? 'scheduled' : 'active',
        name: sMeta.name, emoji: sMeta.emoji, variant: sMeta.variant,
        lane: 'Support',
        startDate: getSupportStart?.(),
        endDate: null,
        dayNum: isSupportScheduled?.() ? null : getSupportDayNumber?.(),
        durationDays: sMeta.durationDays ?? null,
        xpEarned: null,
      });
    }

    // Archives, newest first. Each keeps its own era, so its XP is converted by
    // the economy it actually ran under.
    for (const a of [...(archives[activeProfile] || [])].reverse()) {
      const endedEarly = !!a.endedEarly;
      out.push({
        key: a.id,
        kind: endedEarly ? 'ended' : 'completed',
        name: a.challenge?.name || 'Challenge',
        emoji: a.challenge?.emoji || '🏅',
        variant: a.challenge?.variant,
        lane: a.lane === 'support' ? 'Support' : 'Primary',
        startDate: a.challengeStart,
        endDate: a.endDate || a.archivedAt,
        dayNum: a.daysActive ?? a.endDayNum,
        durationDays: a.challenge?.durationDays ?? null,
        xpEarned: displayXP(a.xpEarned || 0, scaleOfArchive(a)),
        // Two separate facts, never merged: whether it ran its course, and
        // whether it met the bar.
        ranFullLength: !endedEarly && a.endDayNum >= (a.challenge?.durationDays || a.endDayNum),
        endedEarly,
        finalScore: a.scoreAvailable !== false ? a.finalScore ?? null : null,
        passingScore: a.passingScore ?? LEGACY_PASSING_SCORE,
        passed: endedEarly ? null : (a.passed ?? null),
      });
    }
    return out;
  }, [activeProfile, archives, profile, getChallengeMeta, getDayNumber, getSupportMeta,
    getSupportDayNumber, getSupportStart, isChallengeScheduled, isSupportScheduled, isForgeDaily]);

  const counts = useMemo(() => {
    const c = {};
    for (const r of rows) c[r.kind] = (c[r.kind] || 0) + 1;
    return c;
  }, [rows]);

  const shown = filter === 'all' ? rows : rows.filter(r => r.kind === filter);
  const filters = FILTERS.filter(f => f.key === 'all' || counts[f.key] > 0);

  return (
    <div className="f4c-history">
      <header className="f4c-subhead">
        <button type="button" className="f4c-back" onClick={onBack} aria-label="Back to Challenges">‹</button>
        <span className="f4c-subhead-title">Challenge History</span>
      </header>

      {rows.length === 0 ? (
        <section className="f4c-card">
          <h3 className="f4c-card-h">Nothing here yet</h3>
          <p className="f4c-note">
            Your challenges will appear here once you start one — running, scheduled and finished,
            with what each one earned.
          </p>
        </section>
      ) : (
        <>
          <div className="f4c-filters" role="tablist" aria-label="Filter history">
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
                {f.key !== 'all' && <span className="f4c-chip-n">{counts[f.key]}</span>}
              </button>
            ))}
          </div>

          <div className="f4c-hist-list">
            {shown.map(r => <HistoryRow key={r.key} row={r} onOpenActive={onOpenActive} />)}
          </div>

          <p className="f4c-note">
            Completing a challenge means its days ran out. Passing means you met its requirements.
            An attempt you chose to stop has neither result, and is shown as what it was.
          </p>
        </>
      )}
    </div>
  );
}

function HistoryRow({ row, onOpenActive }) {
  const live = row.kind === 'active' || row.kind === 'scheduled';
  const dates = row.endDate
    ? `${formatDateShort(row.startDate)} – ${formatDateShort(row.endDate)}`
    : `${formatDateShort(row.startDate)} – now`;

  // The verdict, stated as precisely as the record allows.
  let verdict = null;
  if (row.kind === 'ended') verdict = { label: 'Ended early', cls: 'ended' };
  else if (row.kind === 'scheduled') verdict = { label: 'Scheduled', cls: 'scheduled' };
  else if (row.kind === 'active') verdict = { label: 'Active', cls: 'active' };
  else if (row.passed === true) verdict = { label: 'Passed', cls: 'pass' };
  else if (row.passed === false) verdict = { label: 'Did not pass', cls: 'fail' };
  else verdict = { label: 'Completed', cls: 'done' };

  return (
    <div className={`f4c-hist${live ? ' live' : ''}`}>
      <div className="f4c-hist-top">
        <span className="f4c-hist-emoji" aria-hidden="true">{row.emoji}</span>
        <span className="f4c-active-id">
          <span className="f4c-active-name">{row.name}</span>
          <span className="f4c-active-meta">
            {dates}
            {row.variant ? ` · ${capitalize(row.variant)}` : ''}
            {row.lane === 'Support' ? ' · Support' : ''}
          </span>
        </span>
        <span className={`f4c-verdict ${verdict.cls}`}>{verdict.label}</span>
      </div>

      <div className="f4c-hist-stats">
        <span>
          <strong>
            {row.kind === 'scheduled'
              ? '—'
              : `${row.dayNum ?? 0}${row.durationDays ? ` / ${row.durationDays}` : ''}`}
          </strong>
          <span className="f4c-dim">days</span>
        </span>
        <span>
          <strong>{row.finalScore != null ? `${row.finalScore}%` : '—'}</strong>
          <span className="f4c-dim">
            {row.finalScore != null ? `score (need ${row.passingScore}%)` : 'score'}
          </span>
        </span>
        <span>
          <strong>{row.xpEarned != null ? `+${row.xpEarned.toLocaleString()}` : '—'}</strong>
          <span className="f4c-dim">XP earned</span>
        </span>
      </div>

      {live && (
        <button type="button" className="f4c-link sm" onClick={onOpenActive}>
          Manage this challenge →
        </button>
      )}
      {row.kind === 'completed' && !row.ranFullLength && (
        <p className="f4c-note">
          Archived on day {row.dayNum} of {row.durationDays}, before its final day.
        </p>
      )}
    </div>
  );
}
