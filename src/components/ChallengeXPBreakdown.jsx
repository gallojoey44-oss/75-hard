import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { TIER_LABELS } from '../data/xpEconomy';

/**
 * Where one challenge's XP came from.
 *
 * XP History could say what a period banked but not why. This answers the
 * question directly: the daily habits, the perfect days, the streaks, the
 * weekly sessions, the optional missions, and each kind of deduction, with the
 * arithmetic visible so it can be checked by hand.
 *
 * Two things it will not do:
 *   • show a breakdown that disagrees with the balance. If the parts do not
 *     reconcile with what the XP engine says the period is worth, it says the
 *     detail is unavailable and shows the banked figure instead.
 *   • explain an old period with today's rates. Each segment is broken down
 *     under the economy it actually ran under, and labelled with it.
 */
export default function ChallengeXPBreakdown({ which = 'current', onClose = null }) {
  const { activeProfile, getChallengeXPBreakdown } = useApp();
  const b = getChallengeXPBreakdown(which, activeProfile);
  if (!b) return null;

  const n = (x) => Math.round(Math.abs(Number(x) || 0)).toLocaleString();
  const fmt = (d) => {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return d; }
  };

  const earnings = [
    ['Daily habits', b.taskXP, `${b.days} ${b.days === 1 ? 'day' : 'days'}`],
    ['Perfect days', b.perfectDayXP, b.perfectDays ? `${b.perfectDays} complete` : null],
    ['Streak milestones', b.streakXP, null],
    ['Weekly sessions', b.weeklyXP, null],
    ['Completion bonus', b.completionXP, null],
    ['Recovery days', b.recoveryXP, b.recoveryDays ? `${b.recoveryDays} logged` : null],
    ['Faith reflections', b.faithXP, null],
    ['Bonus Missions (optional)', b.optionalXP, null],
    ['Comeback bonuses', b.comebackXP, null],
    // Era-1 only: both were removed in era 2 as duplicate payments.
    ['Wellness ratings', b.ratingsXP, b.era === 1 ? 'legacy award' : null],
    ['Mental training section', b.mentalSectionXP, b.era === 1 ? 'legacy award' : null],
  ].filter(([, v]) => v > 0);

  const deductions = [
    ['Missed days', b.missedDayPenalty, b.missedDays ? `${b.missedDays} ${b.missedDays === 1 ? 'day' : 'days'}` : null],
    ['Unfinished days', b.taskMissPenalty, null],
    ['Missed weekly sessions', b.weeklyMissPenalty, null],
    ['Broken streaks', b.streakBreakPenalty, b.era === 1 ? 'legacy charge' : null],
  ].filter(([, v]) => v > 0);

  return (
    <div className="cxb">
      <div className="cxb-head">
        <div>
          <div className="cxb-name">{b.name}</div>
          <div className="cxb-dates">
            {b.startDate ? fmt(b.startDate) : ''}
            {b.endDate ? ` – ${fmt(b.endDate)}` : b.archived ? '' : ' – now'}
          </div>
        </div>
        {onClose && (
          <button className="cxb-close" onClick={onClose} aria-label="Close">✕</button>
        )}
      </div>

      <div className="cxb-tags">
        {b.effortTier && <span className="cxb-tag">{TIER_LABELS[b.effortTier] || b.effortTier}</span>}
        {b.mode && <span className="cxb-tag">{b.mode}</span>}
        {b.dailyBudget > 0 && <span className="cxb-tag">{n(b.dailyBudget)} XP/day budget</span>}
        <span className="cxb-tag era">XP rules v{b.era}</span>
      </div>

      {!b.reconciles ? (
        <div className="cxb-rows">
          <div className="cxb-row net">
            <span>Banked</span><span>{n(b.banked ?? b.net)} XP</span>
          </div>
          <p className="cxb-note">
            Forge could not reproduce this challenge&apos;s day-by-day records exactly,
            so the breakdown below would not add up. The XP above is unaffected.
          </p>
        </div>
      ) : (
        <>
          <div className="cxb-group">Earned</div>
          <div className="cxb-rows">
            {earnings.map(([label, value, meta]) => (
              <div className="cxb-row" key={label}>
                <span className="cxb-label">
                  {label}
                  {meta && <span className="cxb-sub"> · {meta}</span>}
                </span>
                <span className="cxb-value">+{n(value)}</span>
              </div>
            ))}
            <div className="cxb-row subtotal">
              <span>Total earned</span><span>+{n(b.earned)}</span>
            </div>
          </div>

          {deductions.length > 0 && (
            <>
              <div className="cxb-group">Deducted</div>
              <div className="cxb-rows">
                {deductions.map(([label, value, meta]) => (
                  <div className="cxb-row deduct" key={label}>
                    <span className="cxb-label">
                      {label}
                      {meta && <span className="cxb-sub"> · {meta}</span>}
                    </span>
                    <span className="cxb-value">−{n(value)}</span>
                  </div>
                ))}
                <div className="cxb-row subtotal deduct">
                  <span>Total deducted</span><span>−{n(b.deducted)}</span>
                </div>
              </div>
            </>
          )}

          <div className="cxb-rows">
            <div className="cxb-row net">
              <span>{b.archived ? 'Banked' : 'So far'}</span>
              <span>{n(b.net)} XP</span>
            </div>
          </div>
          {b.era === 1 && (
            <p className="cxb-note">
              This challenge ran under Forge&apos;s earlier XP rules. Its figures are
              shown converted onto the current scale, and the original record is
              unchanged.
            </p>
          )}
        </>
      )}
    </div>
  );
}
