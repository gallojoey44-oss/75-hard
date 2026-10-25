import { useState } from 'react';
import { useApp } from '../context/AppContext';
import BuildBanner from './BuildBanner';
import HabitLibrary from './HabitLibrary';
import SupportChallengePicker from './SupportChallengePicker';
import ScheduledStartCard from './ScheduledStart';
import ChallengesHome from './challenges/ChallengesHome';
import ChallengeDetails from './challenges/ChallengeDetails';
import ChallengeSetup from './challenges/ChallengeSetup';
import ChallengeHistory from './challenges/ChallengeHistory';
import { getTemplateById, getDefaultDuration, isColdExposureEnabled, MENTAL_TRAINING_TEMPLATE_ID } from '../data/challengeTemplates';
import { formatDateLong } from '../utils/dateUtils';

/**
 * "End Support Challenge?" — the one confirmation used everywhere the action is
 * offered, so the promise made to the user is identical in each place.
 *
 * A SCHEDULED support challenge has not reached Day 1, so there is no progress
 * to archive and nothing to end: it says "Cancel" and does not promise an
 * archive that will not be written.
 *
 * Exported because TaskManager offers the same action from the task list.
 */
export function EndSupportModal({ supportName, primaryName, scheduled, onCancel, onConfirm }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card end-support-modal" onClick={e => e.stopPropagation()}>
        <h3>{scheduled ? 'Cancel' : 'End'} {supportName}?</h3>
        {scheduled ? (
          <p>
            This will cancel <strong>{supportName}</strong> before it begins and remove its
            Support-only tasks from your daily plan.
            {' '}It has not started, so there is no progress to archive.
          </p>
        ) : (
          <p>
            This will stop <strong>{supportName}</strong> and remove its Support-only tasks
            from your daily plan.
          </p>
        )}
        <p className="end-support-safe">
          Your Primary Challenge{primaryName ? <> — <strong>{primaryName}</strong></> : null} will
          continue unchanged.
        </p>
        {!scheduled && <p>Your Support Challenge progress will be archived.</p>}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-secondary" onClick={onConfirm}>
            {scheduled ? 'Cancel Support Challenge' : 'End Support Challenge'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The Challenges tab.
 *
 * One screen at a time rather than one page containing everything. The tab
 * holds a small navigation stack — home, a challenge's page, its setup flow,
 * the history — so each screen is the size of its own job and the hardware back
 * gesture has something to go back TO.
 *
 * What this component does NOT do is own any challenge logic. Starting,
 * stacking, ending and scheduling all still go through AppContext, and the
 * screens below build their attempts through `buildAttemptPayload` exactly as
 * before.
 */
export default function ChallengesView({ setView }) {
  const {
    profile, getChallengeMeta, isChallengeScheduled, getSupportMeta, isSupportScheduled,
    endSupportChallenge, isChallengeTemplateOutdated, syncActiveChallengeWithTemplate,
    addColdExposureUpgrade,
  } = useApp();

  // { name: 'home' | 'details' | 'setup' | 'history' | 'manage', ... }
  const [screen, setScreen] = useState({ name: 'home' });
  const [showHabitLibrary, setShowHabitLibrary] = useState(false);
  const [showSupportPicker, setShowSupportPicker] = useState(false);
  const [showEndSupport, setShowEndSupport] = useState(false);
  const [showSync, setShowSync] = useState(false);
  const [showCold, setShowCold] = useState(false);

  const meta = getChallengeMeta();
  const supportMeta = getSupportMeta?.();
  const home = () => setScreen({ name: 'home' });

  function openTemplate(templateId) {
    const t = getTemplateById(templateId);
    if (t) setScreen({ name: 'details', template: t });
    else home();          // Forge Daily and legacy descriptors have no page
  }

  return (
    <div className="challenges-view f4c">
      <BuildBanner />

      {screen.name === 'home' && (
        <ChallengesHome
          setView={setView}
          onOpenTemplate={openTemplate}
          onAddSupport={() => setShowSupportPicker(true)}
          onManagePrimary={() => setScreen({ name: 'manage' })}
          onManageSupport={() => setShowEndSupport(true)}
          onHistory={() => setScreen({ name: 'history' })}
          onBrowseHabits={() => setShowHabitLibrary(true)}
        />
      )}

      {screen.name === 'details' && (
        <ChallengeDetails
          template={screen.template}
          activeTemplateId={profile?.challengeStart ? meta.templateId : null}
          supportTemplateId={supportMeta?.templateId || null}
          onBack={home}
          onOpenActive={() => setScreen({ name: 'manage' })}
          onStart={(start) => setScreen({ name: 'setup', start })}
        />
      )}

      {screen.name === 'setup' && (
        <ChallengeSetup
          start={screen.start}
          onCancel={() => setScreen({ name: 'details', template: screen.start.template })}
          onStarted={() => { home(); setView('today'); }}
        />
      )}

      {screen.name === 'history' && (
        <ChallengeHistory onBack={home} onOpenActive={() => setScreen({ name: 'manage' })} />
      )}

      {screen.name === 'manage' && (
        <ManageChallenge
          onBack={home}
          setView={setView}
          onEndSupport={() => setShowEndSupport(true)}
          onAddSupport={() => setShowSupportPicker(true)}
          onSync={() => setShowSync(true)}
          onCold={() => setShowCold(true)}
        />
      )}

      {showHabitLibrary && <HabitLibrary onClose={() => setShowHabitLibrary(false)} />}

      {showSupportPicker && (
        <SupportChallengePicker
          onClose={() => setShowSupportPicker(false)}
          onSwitchPrimary={(template) => {
            setShowSupportPicker(false);
            setScreen({
              name: 'setup',
              start: { template, variant: 'standard', durationDays: getDefaultDuration(template) },
            });
          }}
        />
      )}

      {showEndSupport && supportMeta && (
        <EndSupportModal
          supportName={supportMeta.name}
          primaryName={meta.name}
          scheduled={isSupportScheduled?.()}
          onCancel={() => setShowEndSupport(false)}
          onConfirm={() => { endSupportChallenge(); setShowEndSupport(false); home(); }}
        />
      )}

      {showSync && (
        <div className="modal-overlay" onClick={() => setShowSync(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>Update Active Challenge?</h3>
            <p>This will refresh challenge template tasks while preserving your custom tasks and saved progress.</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowSync(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => { syncActiveChallengeWithTemplate(); setShowSync(false); }}>
                Update Template Tasks
              </button>
            </div>
          </div>
        </div>
      )}

      {showCold && (
        <div className="modal-overlay" onClick={() => setShowCold(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>Add Cold Exposure Upgrade?</h3>
            <p>
              Cold Shower becomes a required task starting today. It joins the same daily budget, so
              every requirement is repriced rather than the day getting bigger — and it affects your
              daily score, challenge grade and XP for the remaining days.
            </p>
            <p><strong>This change cannot be undone for the current challenge.</strong></p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowCold(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => { addColdExposureUpgrade(); setShowCold(false); }}>
                Confirm Upgrade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Managing what is already running: the scheduled-start controls, the template
 * update, the Cold Exposure Upgrade, and ending a Support Challenge.
 *
 * These are the actions that act on an EXISTING attempt, so they are kept
 * together and away from the browsing screens — nothing here can start
 * anything, and the only destructive action goes through its own confirmation.
 */
function ManageChallenge({ onBack, setView, onEndSupport, onAddSupport, onSync, onCold }) {
  const {
    profile, getChallengeMeta, getDayNumber, isChallengeScheduled, isForgeDaily,
    getSupportMeta, getSupportDayNumber, getSupportStart, isSupportScheduled,
    isChallengeTemplateOutdated, supportEraCheck,
  } = useApp();

  const meta = getChallengeMeta();
  const scheduled = isChallengeScheduled();
  const supportMeta = getSupportMeta?.();
  const dayNum = getDayNumber();
  const era = supportEraCheck?.() ?? { ok: true };
  const isMT = meta.templateId === MENTAL_TRAINING_TEMPLATE_ID;

  return (
    <div className="f4c-manage">
      <header className="f4c-subhead">
        <button type="button" className="f4c-back" onClick={onBack} aria-label="Back to Challenges">‹</button>
        <span className="f4c-subhead-title">Manage</span>
      </header>

      {scheduled && <ScheduledStartCard />}

      {!isForgeDaily() && profile?.challengeStart && (
        <section className="f4c-card">
          <div className="f4c-review-id">
            <span className="f4c-active-emoji" aria-hidden="true">{meta.emoji}</span>
            <span className="f4c-active-id">
              <span className="f4c-active-name">{meta.name}</span>
              <span className="f4c-active-meta">
                {scheduled
                  ? `Starts ${formatDateLong(profile.challengeStart)}`
                  : `Day ${dayNum}${meta.durationDays ? ` of ${meta.durationDays}` : ''}`}
                {' · Primary Challenge'}
              </span>
            </span>
          </div>
          <button type="button" className="f4c-btn primary wide" onClick={() => setView('today')}>
            Go to today&apos;s tasks →
          </button>
        </section>
      )}

      {supportMeta ? (
        <section className="f4c-card">
          <h3 className="f4c-card-h">Support Challenge</h3>
          <div className="f4c-review-id">
            <span className="f4c-active-emoji" aria-hidden="true">{supportMeta.emoji}</span>
            <span className="f4c-active-id">
              <span className="f4c-active-name">{supportMeta.name}</span>
              <span className="f4c-active-meta">
                {isSupportScheduled?.()
                  ? `Starts ${formatDateLong(getSupportStart?.())}`
                  : `Day ${getSupportDayNumber?.()} of ${supportMeta.durationDays}`}
              </span>
            </span>
          </div>
          <p className="f4c-note">
            Ending this stops only the Support Challenge and archives its progress. Your Primary
            Challenge continues unchanged.
          </p>
          <button type="button" className="f4c-btn danger wide" onClick={onEndSupport}>
            {isSupportScheduled?.() ? 'Cancel Support Challenge' : 'End Support Challenge'}
          </button>
        </section>
      ) : profile?.challengeStart && !isForgeDaily() && (
        <section className="f4c-card">
          <h3 className="f4c-card-h">Support Challenge</h3>
          {era.ok ? (
            <>
              <p className="f4c-note">
                Run a second, compatible challenge alongside this one. A habit both require appears
                once and is logged once.
              </p>
              <button type="button" className="f4c-btn wide" onClick={onAddSupport}>
                Add a Support Challenge
              </button>
            </>
          ) : (
            <p className="f4c-note">{era.reason}</p>
          )}
        </section>
      )}

      {isChallengeTemplateOutdated?.() && (
        <section className="f4c-card">
          <h3 className="f4c-card-h">Template update available</h3>
          <p className="f4c-note">
            A newer version of this challenge&apos;s template exists. Updating refreshes its template
            tasks and keeps your custom tasks and saved progress.
          </p>
          <button type="button" className="f4c-btn wide" onClick={onSync}>Update template tasks</button>
        </section>
      )}

      {isMT && !scheduled && (
        <section className="f4c-card">
          <h3 className="f4c-card-h">Cold Exposure Upgrade</h3>
          {isColdExposureEnabled(meta) ? (
            <p className="f4c-note">
              Active{meta.coldExposureUpgradeStartDate
                ? ` — required since ${formatDateLong(meta.coldExposureUpgradeStartDate)}`
                : ''}.
            </p>
          ) : (
            <>
              <p className="f4c-note">
                Add a 30–60 second cold finish to the remaining days. Once added it becomes a
                required task and cannot be removed from this attempt.
              </p>
              <p className="f4c-warn">
                ⚠️ Skip cold exposure if you feel dizzy, hypoglycemic, sick or unusually weak.
              </p>
              <button type="button" className="f4c-btn wide" onClick={onCold}>
                Add to current challenge
              </button>
            </>
          )}
        </section>
      )}
    </div>
  );
}
