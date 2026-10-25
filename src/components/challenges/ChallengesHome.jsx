import { useApp } from '../../context/AppContext';
import ActiveChallengeCard from './ActiveChallengeCard';
import ChallengeLibrary from './ChallengeLibrary';
import { HABIT_GUIDES } from '../../data/habitGuides';
import { formatDateLong } from '../../utils/dateUtils';

/**
 * The Challenges tab's front page.
 *
 * It answers four questions in the order people ask them: what am I doing, how
 * far in am I, what else could I do, and what have I done before. The old page
 * answered the first two with a card most of a screen tall — four stat tiles,
 * a progress bar, an upgrade panel and two buttons — so the third question was
 * below the fold and the fourth had no answer at all.
 *
 * The active section is deliberately small. Today owns the detail of today;
 * this tab owns the challenge.
 */
export default function ChallengesHome({
  onOpenTemplate, onAddSupport, onManagePrimary, onManageSupport, onHistory, onBrowseHabits, setView,
}) {
  const {
    profile, getChallengeMeta, getDayNumber, getDayCompletion, isForgeDaily,
    isChallengeScheduled, getSupportMeta, getSupportDayNumber, getSupportStart,
    isSupportScheduled, supportEraCheck, archives, activeProfile, allDays,
  } = useApp();

  const meta = getChallengeMeta();
  const baseline = isForgeDaily();
  const scheduled = isChallengeScheduled();
  const dayNum = getDayNumber();
  const supportMeta = getSupportMeta?.();
  const hasPrimary = !!profile?.challengeStart && !baseline;
  const era = supportEraCheck?.() ?? { ok: true };
  const archiveCount = (archives?.[activeProfile] || []).length;

  // Today's habit count, split by lane so each card reports its own. Read from
  // the same task list and day record Today reads — a habit shared by both
  // lanes counts for both, because one tap really does satisfy both.
  const tasks = profile?.tasks || [];
  const today = dayNum ? ((allDays?.[activeProfile] || {})[dayNum] || null) : null;
  const laneCount = (lane) => {
    if (!dayNum || scheduled) return null;
    const list = tasks.filter(t => !Array.isArray(t.challenges) || t.challenges.includes(lane));
    if (!list.length) return null;
    return { total: list.length, done: list.filter(t => today?.tasks?.[t.id]).length };
  };
  const primaryCount = laneCount('primary');
  const supportCount = laneCount('support');

  return (
    <div className="f4c-home">
      <header className="f4c-page-head">
        <div>
          <h2 className="f4c-page-title">Challenges</h2>
          <p className="f4c-page-sub">Choose your next mission.</p>
        </div>
        <button type="button" className="f4c-icon-btn" onClick={onHistory} aria-label="Challenge history">
          <span aria-hidden="true">🗂️</span>
        </button>
      </header>

      {/* ── What's running ───────────────────────────────────────────── */}
      {hasPrimary ? (
        <>
          <div className="f4c-section-h">Your active challenges</div>
          <ActiveChallengeCard
            meta={meta}
            dayNum={dayNum}
            scheduled={scheduled}
            startDate={profile.challengeStart}
            habitsTotal={primaryCount?.total ?? null}
            habitsDone={primaryCount?.done ?? null}
            onOpen={() => onOpenTemplate(meta.templateId)}
            onManage={onManagePrimary}
          />

          {supportMeta ? (
            <ActiveChallengeCard
              meta={supportMeta}
              lane="support"
              dayNum={getSupportDayNumber?.()}
              scheduled={isSupportScheduled?.()}
              startDate={getSupportStart?.()}
              habitsTotal={supportCount?.total ?? null}
              habitsDone={supportCount?.done ?? null}
              onOpen={() => onOpenTemplate(supportMeta.templateId)}
              onManage={onManageSupport}
              manageLabel={isSupportScheduled?.() ? 'Cancel Support Challenge' : 'End Support Challenge'}
            />
          ) : era.ok ? (
            <button type="button" className="f4c-add-support acc-add-support" onClick={onAddSupport}>
              <span className="f4c-add-icon" aria-hidden="true">＋</span>
              <span className="f4c-add-body">
                <span className="f4c-add-title">Add a Support Challenge</span>
                <span className="f4c-add-sub">
                  Run a second, compatible challenge alongside this one. Shared habits are logged once.
                </span>
              </span>
              <span className="f4c-chevron" aria-hidden="true">›</span>
            </button>
          ) : (
            // Refused rather than offered-then-refused: the reason is stated
            // where the button would have been.
            <div className="f4c-blocked">
              <span className="f4c-blocked-title">Support Challenges are unavailable for this attempt</span>
              <p className="f4c-note">{era.reason}</p>
            </div>
          )}

          {/* One route to the day's work, not one per lane. */}
          <button type="button" className="f4c-btn primary wide" onClick={() => setView('today')}>
            Go to today&apos;s tasks →
          </button>
        </>
      ) : (
        <section className="f4c-empty no-active-challenge">
          <span className="f4c-empty-icon" aria-hidden="true">{baseline ? '🔥' : '🎯'}</span>
          <h3 className="f4c-empty-title">
            {baseline ? 'You’re on Forge Daily' : 'No active challenge'}
          </h3>
          <p className="f4c-note">
            {baseline
              ? 'Your daily habits and streak keep running on their own. Pick a challenge below when you want a bigger commitment — nothing you already track is affected.'
              : 'Pick a challenge below. Your daily tasks, XP and progress start tracking from the day you choose.'}
          </p>
        </section>
      )}

      {/* ── Discovery ────────────────────────────────────────────────── */}
      <div className="f4c-section-h">Explore challenges</div>
      <ChallengeLibrary
        onOpen={(t) => onOpenTemplate(t.id)}
        activeTemplateId={hasPrimary ? meta.templateId : null}
        supportTemplateId={supportMeta?.templateId || null}
      />

      {/* ── The two permanent reference sections ─────────────────────── */}
      <button type="button" className="f4c-row-link habit-library-entry" onClick={onBrowseHabits}>
        <span className="f4c-add-icon" aria-hidden="true">📖</span>
        <span className="f4c-add-body">
          <span className="f4c-add-title">Explore Habits &amp; Strategies</span>
          <span className="f4c-add-sub">
            {Object.keys(HABIT_GUIDES).length} habit guides — why each one matters and how to do it
            well. No challenge required.
          </span>
        </span>
        <span className="f4c-chevron" aria-hidden="true">›</span>
      </button>

      <button type="button" className="f4c-row-link" onClick={onHistory}>
        <span className="f4c-add-icon" aria-hidden="true">🗂️</span>
        <span className="f4c-add-body">
          <span className="f4c-add-title">Challenge history</span>
          <span className="f4c-add-sub">
            {archiveCount > 0
              ? `${archiveCount} past ${archiveCount === 1 ? 'challenge' : 'challenges'}, with what each one scored and earned.`
              : 'Everything you run is recorded here — scores, dates and XP.'}
          </span>
        </span>
        <span className="f4c-chevron" aria-hidden="true">›</span>
      </button>

      {scheduled && (
        <p className="f4c-note">
          {meta.name} is scheduled for {formatDateLong(profile.challengeStart)}. No days count as
          missed before then.
        </p>
      )}
    </div>
  );
}
