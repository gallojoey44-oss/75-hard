import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { formatDateShort, getTodayStr } from '../utils/dateUtils';
import TaskManager from './TaskManager';
import QuoteLibrary from './QuoteLibrary';
import NotificationSettings from './NotificationSettings';
import { checkForUpdate, applyUpdate } from '../utils/swUtils.js';
import BuildBanner, { BUILD_VERSION } from './BuildBanner';
import { computeTotalXP, computeLifetimeXP, getRankInfo, BADGE_DEFS } from '../utils/gamification';

const LS_KEYS = ['profiles', 'allDays', 'activeProfile', 'quoteData', 'experiments', 'dismissedHints', 'archives', 'notifPrefs', 'weeklyReflections'];

function exportData() {
  const data = {};
  for (const key of LS_KEYS) {
    const val = localStorage.getItem(key);
    if (val != null) data[key] = JSON.parse(val);
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `75hard-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SettingsView({ setView }) {
  const {
    activeProfile, profile, profiles, allDays,
    updateProfile, startChallenge, setChallengeStart,
    getChallengeMeta, getDayNumber, getDayCompletion,
    setActiveProfile,
    resetXP,
    archives, restoreArchive, deleteArchive, deleteAllProfileData,
    isChallengeTemplateOutdated, syncActiveChallengeWithTemplate,
  } = useApp();

  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(profile?.name || '');
  const [showStartNew, setShowStartNew] = useState(false);
  const [showResetXP, setShowResetXP] = useState(false);
  const [expandedArchive, setExpandedArchive] = useState(null);
  const [restoreTarget, setRestoreTarget] = useState(null);   // archive entry pending restore
  const [deleteArchTarget, setDeleteArchTarget] = useState(null); // archive entry pending delete
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [deleteAllConfirmText, setDeleteAllConfirmText] = useState('');
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [importStatus, setImportStatus] = useState('idle'); // 'idle'|'success'|'error'
  const importRef = useRef(null);

  // Challenge start date controls
  const [startDateInput, setStartDateInput] = useState('');
  const [todayAsDayInput, setTodayAsDayInput] = useState('');
  const [startMsg, setStartMsg] = useState(null); // { ok: bool, text: string }

  // Update check state
  // 'idle' | 'checking' | 'up-to-date' | 'update-available' | 'unavailable' | 'error'
  const [updateStatus, setUpdateStatus] = useState('idle');

  // If the banner fires while Settings is open, reflect it here too
  useEffect(() => {
    const handler = () => setUpdateStatus('update-available');
    window.addEventListener('sw-update-available', handler);
    return () => window.removeEventListener('sw-update-available', handler);
  }, []);

  async function handleCheckUpdate() {
    setUpdateStatus('checking');
    const result = await checkForUpdate();
    setUpdateStatus(result);
  }

  function saveName() {
    if (nameVal.trim()) updateProfile({ name: nameVal.trim() });
    setEditingName(false);
  }

  function handleStartNew() {
    startChallenge();
    setShowStartNew(false);
  }

  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        for (const key of LS_KEYS) {
          if (data[key] !== undefined) localStorage.setItem(key, JSON.stringify(data[key]));
        }
        setImportStatus('success');
        setTimeout(() => window.location.reload(), 1200);
      } catch {
        setImportStatus('error');
        setTimeout(() => setImportStatus('idle'), 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function dayNumToStartDate(n) {
    const d = new Date(getTodayStr() + 'T00:00:00');
    d.setDate(d.getDate() - n + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function flash(ok, text) {
    setStartMsg({ ok, text });
    setTimeout(() => setStartMsg(null), 3500);
  }

  function handleSetStartDate() {
    if (!startDateInput) return;
    if (startDateInput > getTodayStr()) { flash(false, 'Start date cannot be in the future.'); return; }
    setChallengeStart(startDateInput);
    flash(true, `Start date set to ${formatDateShort(startDateInput)}.`);
    setStartDateInput('');
  }

  function handleSetTodayAsDay() {
    const n = parseInt(todayAsDayInput, 10);
    const maxDay = getChallengeMeta().durationDays || 75;
    if (!n || n < 1 || n > maxDay) { flash(false, `Enter a number from 1 to ${maxDay}.`); return; }
    const startStr = dayNumToStartDate(n);
    setChallengeStart(startStr);
    flash(true, `Today is now Day ${n}. Day 1 = ${formatDateShort(startStr)}.`);
    setTodayAsDayInput('');
  }

  const otherProfile = activeProfile === 'me' ? 'girlfriend' : 'me';
  const challengeMeta = getChallengeMeta();
  const challengeDuration = challengeMeta.durationDays || 75;

  return (
    <div className="settings-view">
      <BuildBanner />
      <div className="page-header">
        <h2>⚙️ Settings</h2>
      </div>

      {/* Profile */}
      <div className="settings-section">
        <div className="section-title">👤 Profile</div>
        <div className="settings-row">
          <span className="settings-row-label">Name</span>
          {editingName ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                className="inline-input"
                value={nameVal}
                onChange={e => setNameVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveName()}
                autoFocus
                style={{ width: 120 }}
              />
              <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 13 }} onClick={saveName}>Save</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="settings-row-value">{profile?.name}</span>
              <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => { setEditingName(true); setNameVal(profile?.name || ''); }}>Edit</button>
            </div>
          )}
        </div>
        <div className="settings-row">
          <span className="settings-row-label">Emoji</span>
          <span className="settings-row-value" style={{ fontSize: '1.3rem' }}>{profile?.emoji}</span>
        </div>
        <div className="settings-row">
          <span className="settings-row-label">Challenge Started</span>
          <span className="settings-row-value">
            {profile?.challengeStart ? formatDateShort(profile.challengeStart) : 'Not started'}
          </span>
        </div>
      </div>

      {/* Switch Profile */}
      <div className="settings-section">
        <div className="section-title">🔄 Switch Profile</div>
        <button
          className="btn btn-ghost btn-full"
          onClick={() => setActiveProfile(otherProfile)}
        >
          {profiles[otherProfile]?.emoji} Switch to {profiles[otherProfile]?.name}
        </button>
      </div>

      {/* Tasks */}
      <div className="settings-section">
        <TaskManager />
      </div>

      {/* Faith & Reflection */}
      <div className="settings-section">
        <div className="section-title">✝️ Faith &amp; Reflection</div>
        <div className="settings-row">
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Enable Faith / Reflection</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
              Adds a Bible verse, virtue tracker, and journal inside Mental Training
            </div>
          </div>
          <button
            className={`toggle-btn${profile?.faithEnabled ? ' on' : ''}`}
            onClick={() => updateProfile({ faithEnabled: !profile?.faithEnabled })}
          >
            {profile?.faithEnabled ? 'On' : 'Off'}
          </button>
        </div>
        {profile?.faithEnabled && (
          <div className="settings-row" style={{ marginTop: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Count toward daily completion</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                Adds 1 task slot; completing faith reflection raises the % bar
              </div>
            </div>
            <button
              className={`toggle-btn${profile?.faithCountsToward ? ' on' : ''}`}
              onClick={() => updateProfile({ faithCountsToward: !profile?.faithCountsToward })}
            >
              {profile?.faithCountsToward ? 'On' : 'Off'}
            </button>
          </div>
        )}
      </div>

      {/* Sleep Settings */}
      <div className="settings-section">
        <div className="section-title">😴 Sleep Settings</div>
        <div className="settings-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Nightly sleep target</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: -4 }}>
            Used to determine when sleep is a bottleneck in Insights
          </div>
          <div className="sleep-target-btns">
            {[7, 7.5, 8, 8.5].map(h => (
              <button
                key={h}
                className={`sleep-target-btn${(profile?.sleepTarget ?? 8) === h ? ' active' : ''}`}
                onClick={() => updateProfile({ sleepTarget: h })}
              >
                {h}h
              </button>
            ))}
          </div>
        </div>
        <div className="settings-row" style={{ marginTop: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Auto-complete sleep task</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
              Marks "Sleep target met" when hours logged ≥ target
            </div>
          </div>
          <button
            className={`toggle-btn${profile?.sleepAutoComplete !== false ? ' on' : ''}`}
            onClick={() => updateProfile({ sleepAutoComplete: profile?.sleepAutoComplete === false ? true : false })}
          >
            {profile?.sleepAutoComplete !== false ? 'On' : 'Off'}
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div className="settings-section">
        <NotificationSettings />
      </div>

      {/* Quote Library */}
      <div className="settings-section">
        <QuoteLibrary />
      </div>

      {/* Challenge management + start date */}
      <div className="settings-section">
        <div className="section-title">
          {profile?.challengeStart ? `${challengeMeta.emoji} ${challengeMeta.name}` : '🎯 Challenge'}
          {profile?.challengeStart && challengeMeta.variant
            ? ` · ${challengeMeta.variant.charAt(0).toUpperCase() + challengeMeta.variant.slice(1)}`
            : ''}
        </div>

        {/* Current state row */}
        {profile?.challengeStart ? (
          <div className="settings-row" style={{ marginBottom: 4 }}>
            <span className="settings-row-label">Day 1 was</span>
            <span className="settings-row-value">{formatDateShort(profile.challengeStart)}</span>
          </div>
        ) : null}
        {profile?.challengeStart && getDayNumber() ? (
          <div className="settings-row" style={{ marginBottom: 12 }}>
            <span className="settings-row-label">Today is</span>
            <span className="settings-row-value" style={{ color: 'var(--accent2)', fontWeight: 700 }}>
              Day {getDayNumber()} of {challengeDuration}
            </span>
          </div>
        ) : null}

        {/* Template sync */}
        {isChallengeTemplateOutdated() && (
          <div className="tpl-update-box" style={{ marginBottom: 12 }}>
            <div className="tpl-update-notice">🆕 A newer version of this challenge template is available.</div>
            <button className="btn btn-primary btn-full" onClick={() => setShowSyncConfirm(true)}>
              Sync Active Challenge with Latest Template
            </button>
            <p className="tpl-update-hint">
              Updating the challenge will refresh template tasks but keep your custom tasks.
            </p>
          </div>
        )}

        {/* Challenge Start Date controls */}
        <div className="start-date-box">
          <div className="start-date-title">📅 Challenge Start Date</div>
          <p className="start-date-hint">
            Use this if you started before today and need to backfill earlier days. Your saved day data is preserved.
          </p>

          {/* Set by exact date */}
          <div className="start-date-row">
            <label className="start-date-label">Set start date</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="date"
                className="inline-input"
                value={startDateInput}
                max={getTodayStr()}
                onChange={e => setStartDateInput(e.target.value)}
                style={{ flex: 1, minWidth: 0 }}
              />
              <button
                className="btn btn-primary"
                style={{ padding: '6px 12px', fontSize: 13, flexShrink: 0 }}
                onClick={handleSetStartDate}
                disabled={!startDateInput}
              >
                Save
              </button>
            </div>
          </div>

          {/* Set by current day number */}
          <div className="start-date-divider">or</div>
          <div className="start-date-row">
            <label className="start-date-label">Set today as Day</label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="number"
                className="inline-input"
                value={todayAsDayInput}
                min="1"
                max={challengeDuration}
                placeholder={`1–${challengeDuration}`}
                onChange={e => setTodayAsDayInput(e.target.value)}
                style={{ width: 70 }}
              />
              <button
                className="btn btn-primary"
                style={{ padding: '6px 12px', fontSize: 13, flexShrink: 0 }}
                onClick={handleSetTodayAsDay}
                disabled={!todayAsDayInput}
              >
                Set
              </button>
            </div>
            {todayAsDayInput && +todayAsDayInput >= 1 && +todayAsDayInput <= challengeDuration && (
              <div className="start-date-preview">
                → Day 1 = {formatDateShort(dayNumToStartDate(+todayAsDayInput))}
              </div>
            )}
          </div>

          {startMsg && (
            <div className={`update-status-row${startMsg.ok ? ' success' : ' warn'}`} style={{ marginTop: 10 }}>
              <span>{startMsg.ok ? '✅' : '⚠️'}</span>
              <span>{startMsg.text}</span>
            </div>
          )}
        </div>

        {/* Start challenge / Start new challenge */}
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!profile?.challengeStart ? (
            <button className="btn btn-primary btn-full" onClick={() => startChallenge()}>
              Start Challenge Today
            </button>
          ) : (
            <>
              <button className="btn btn-primary btn-full" onClick={() => setShowStartNew(true)}>
                🔄 Start New Challenge
              </button>
              <p style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>
                Your current challenge is archived first — no data is deleted.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Challenge Archives */}
      <div className="settings-section">
        <div className="section-title">🗂 Challenge Archives</div>
        {(archives[activeProfile] || []).length === 0 ? (
          <p className="text-muted" style={{ lineHeight: 1.6 }}>
            No archived challenges yet. When you start a new challenge, the current one is saved here —
            its data keeps powering lifetime trends and Insights.
          </p>
        ) : (
          <div className="archive-list">
            {[...(archives[activeProfile] || [])].reverse().map(arch => {
              const daysLogged = Object.keys(arch.days || {}).length;
              const isOpen = expandedArchive === arch.id;
              return (
                <div key={arch.id} className="archive-row">
                  <button className="archive-row-header" onClick={() => setExpandedArchive(isOpen ? null : arch.id)}>
                    <span className="archive-row-emoji">{arch.challenge?.emoji || '🔥'}</span>
                    <div className="archive-row-info">
                      <div className="archive-row-title">
                        {arch.challenge?.name || '75-Day Discipline Challenge'} · {formatDateShort(arch.challengeStart)} – {formatDateShort(arch.endDate || arch.archivedAt)}
                      </div>
                      <div className="archive-row-meta">
                        Day {arch.endDayNum} of {arch.challenge?.durationDays || 75} · {daysLogged} days logged · {(arch.xpEarned || 0).toLocaleString()} XP
                      </div>
                    </div>
                    <span className="archive-row-arrow">{isOpen ? '▲' : '▼'}</span>
                  </button>
                  {isOpen && (
                    <div className="archive-row-body">
                      <div className="archive-detail-grid">
                        <div className="archive-detail"><span>Started</span><strong>{formatDateShort(arch.challengeStart)}</strong></div>
                        <div className="archive-detail"><span>Archived</span><strong>{formatDateShort(arch.archivedAt)}</strong></div>
                        <div className="archive-detail"><span>Days logged</span><strong>{daysLogged}</strong></div>
                        <div className="archive-detail"><span>XP earned</span><strong>{(arch.xpEarned || 0).toLocaleString()}</strong></div>
                        <div className="archive-detail"><span>Tasks</span><strong>{(arch.tasks || []).length}</strong></div>
                        <div className="archive-detail"><span>Badges</span><strong>{(arch.badges || []).length}</strong></div>
                      </div>
                      {(arch.badges || []).length > 0 && (
                        <div className="archive-badges">
                          {arch.badges.map(id => {
                            const b = BADGE_DEFS.find(bd => bd.id === id);
                            return b ? <span key={id} className="archive-badge-chip" title={b.label}>{b.emoji} {b.label}</span> : null;
                          })}
                        </div>
                      )}
                      <div className="archive-actions">
                        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setRestoreTarget(arch)}>
                          ↩️ Restore
                        </button>
                        <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => setDeleteArchTarget(arch)}>
                          Delete Archive
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* XP System */}
      <div className="settings-section">
        <div className="section-title">⚡ XP System</div>
        {(() => {
          const dayNum = getDayNumber();
          const xpData = dayNum ? computeTotalXP(allDays, profiles, activeProfile, getDayCompletion, dayNum, dayNum) : { total: 0, rawTotal: 0 };
          const lifetimeXP = computeLifetimeXP(archives[activeProfile], xpData.rawTotal || 0);
          const rankInfo = getRankInfo(lifetimeXP);
          return (
            <>
              <div className="settings-row">
                <span className="settings-row-label">Rank (Lifetime)</span>
                <span className="settings-row-value" style={{ color: 'var(--accent2)', fontWeight: 700 }}>
                  {rankInfo.current.name}
                </span>
              </div>
              <div className="settings-row">
                <span className="settings-row-label">Challenge XP</span>
                <span className="settings-row-value">{xpData.total.toLocaleString()} XP</span>
              </div>
              <div className="settings-row" style={{ marginBottom: 12 }}>
                <span className="settings-row-label">Lifetime XP</span>
                <span className="settings-row-value">{lifetimeXP.toLocaleString()} XP</span>
              </div>
            </>
          );
        })()}
        <div className="settings-row">
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>XP Penalties</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
              Lose XP for missed tasks and broken streaks. Kept low — MWD reduces penalties by 70%.
            </div>
          </div>
          <button
            className={`toggle-btn${profile?.xpPenalties !== false ? ' on' : ''}`}
            onClick={() => updateProfile({ xpPenalties: profile?.xpPenalties === false ? true : false })}
          >
            {profile?.xpPenalties !== false ? 'On' : 'Off'}
          </button>
        </div>
        <div style={{ marginTop: 14 }}>
          <button
            className="btn btn-danger btn-full"
            onClick={() => setShowResetXP(true)}
          >
            Reset Challenge XP to Zero
          </button>
          <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, textAlign: 'center' }}>
            Only affects the current challenge's XP. Lifetime XP, rank, progress, and day data are not affected.
          </p>
        </div>
      </div>

      {/* Install instructions */}
      <div className="settings-section">
        <div className="section-title">📱 Add to iPhone Home Screen</div>
        <div className="install-steps">
          <div className="install-step">
            <div className="install-step-num">1</div>
            <span>Tap the <strong>Share</strong> button at the bottom of Safari (the box with an arrow pointing up).</span>
          </div>
          <div className="install-step">
            <div className="install-step-num">2</div>
            <span>Scroll down and tap <strong>"Add to Home Screen"</strong>.</span>
          </div>
          <div className="install-step">
            <div className="install-step-num">3</div>
            <span>Tap <strong>"Add"</strong> in the top-right corner.</span>
          </div>
          <div className="install-step">
            <div className="install-step-num">4</div>
            <span>The app will appear on your home screen and open fullscreen like a native app.</span>
          </div>
        </div>
      </div>

      {/* Backup & Restore */}
      <div className="settings-section">
        <div className="section-title">💾 Backup &amp; Restore</div>
        <p className="text-muted" style={{ marginBottom: 12, lineHeight: 1.6 }}>
          Export saves all your progress to a file. Import restores it — the app will reload after importing.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="btn btn-ghost btn-full" onClick={exportData}>
            ⬇️ Export / Backup Data
          </button>
          <button className="btn btn-ghost btn-full" onClick={() => importRef.current?.click()}>
            ⬆️ Import / Restore Data
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleImport}
          />
          {importStatus === 'success' && (
            <div className="update-status-row success">
              <span>✅</span><span>Restored! Reloading…</span>
            </div>
          )}
          {importStatus === 'error' && (
            <div className="update-status-row warn">
              <span>⚠️</span><span>Invalid file — use a backup exported from this app.</span>
            </div>
          )}
        </div>
      </div>

      {/* App version */}
      <div className="settings-section">
        <div className="section-title">📦 App Version</div>
        <div className="settings-row">
          <span className="settings-row-label">Version</span>
          <span className="settings-row-value" style={{ fontFamily: 'monospace', fontSize: 13 }}>{BUILD_VERSION}</span>
        </div>
      </div>

      {/* App updates */}
      <div className="settings-section">
        <div className="section-title">🔄 App Updates</div>
        <p className="text-muted" style={{ marginBottom: 12, lineHeight: 1.6 }}>
          Your data is always saved locally. Checking for updates only refreshes the app code — it never deletes your progress.
        </p>

        {updateStatus === 'idle' && (
          <button className="btn btn-ghost btn-full" onClick={handleCheckUpdate}>
            Check for Updates
          </button>
        )}

        {updateStatus === 'checking' && (
          <div className="update-status-row">
            <span className="update-status-spinner">⏳</span>
            <span>Checking…</span>
          </div>
        )}

        {updateStatus === 'up-to-date' && (
          <div className="update-status-row success">
            <span>✅</span>
            <span>You're on the latest version.</span>
            <button className="btn btn-ghost" style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: 12 }} onClick={() => setUpdateStatus('idle')}>
              Check again
            </button>
          </div>
        )}

        {updateStatus === 'update-available' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="update-status-row accent">
              <span>🆕</span>
              <span>A new version is ready!</span>
            </div>
            <button className="btn btn-primary btn-full" onClick={applyUpdate}>
              Apply Update &amp; Restart
            </button>
          </div>
        )}

        {updateStatus === 'unavailable' && (
          <div className="update-status-row">
            <span>ℹ️</span>
            <span>Service worker unavailable (only works when deployed).</span>
          </div>
        )}

        {updateStatus === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="update-status-row warn">
              <span>⚠️</span>
              <span>Couldn't check — are you online?</span>
            </div>
            <button className="btn btn-ghost btn-full" onClick={handleCheckUpdate}>Retry</button>
          </div>
        )}
      </div>

      {/* Advanced Danger Zone (hidden behind a collapsed section) */}
      <details className="settings-section danger-zone">
        <summary className="danger-zone-summary">⚠️ Advanced Danger Zone</summary>
        <div className="danger-zone-body">
          <p className="text-muted" style={{ lineHeight: 1.6, marginBottom: 12 }}>
            These actions permanently wipe data and cannot be undone. Export a backup first.
            Only <strong>{profile?.name}</strong>'s data is affected — {profiles[otherProfile]?.name}'s data stays untouched.
          </p>
          <button className="btn btn-danger btn-full" onClick={() => { setDeleteAllConfirmText(''); setShowDeleteAll(true); }}>
            🗑 Delete All Data for {profile?.name}
          </button>
          <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, textAlign: 'center' }}>
            Wipes the active challenge, all archives, lifetime XP, badges, quotes, and experiments for this profile.
          </p>
        </div>
      </details>

      {/* Sync active challenge confirmation */}
      {showSyncConfirm && (
        <div className="modal-overlay" onClick={() => setShowSyncConfirm(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>Update Active Challenge?</h3>
            <p>This will refresh challenge template tasks while preserving your custom tasks and saved progress.</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowSyncConfirm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => { syncActiveChallengeWithTemplate(); setShowSyncConfirm(false); }}>
                Update Template Tasks
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Start New Challenge confirmation */}
      {showStartNew && (
        <div className="modal-overlay" onClick={() => setShowStartNew(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>Start New Challenge?</h3>
            <p>Your current challenge will be archived before starting fresh. Your historical data will still be used for lifetime trends and Insights.</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowStartNew(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleStartNew}>Archive &amp; Start Fresh</button>
            </div>
          </div>
        </div>
      )}

      {/* Restore archive confirmation */}
      {restoreTarget && (
        <div className="modal-overlay" onClick={() => setRestoreTarget(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>Restore This Challenge?</h3>
            <p>
              The challenge from {formatDateShort(restoreTarget.challengeStart)} will become your active challenge again.
              {profile?.challengeStart ? ' Your current challenge will be archived first — nothing is lost.' : ''}
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setRestoreTarget(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => { restoreArchive(restoreTarget.id); setRestoreTarget(null); setExpandedArchive(null); }}>
                Yes, Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete archive confirmation */}
      {deleteArchTarget && (
        <div className="modal-overlay" onClick={() => setDeleteArchTarget(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>Delete This Archive?</h3>
            <p>
              The archived challenge from {formatDateShort(deleteArchTarget.challengeStart)} — including its
              {' '}{(deleteArchTarget.xpEarned || 0).toLocaleString()} XP toward your lifetime total — will be permanently removed.
              This cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setDeleteArchTarget(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => { deleteArchive(deleteArchTarget.id); setDeleteArchTarget(null); setExpandedArchive(null); }}>
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete-all-data confirmation (danger zone) */}
      {showDeleteAll && (
        <div className="modal-overlay" onClick={() => setShowDeleteAll(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>Wipe All Data for {profile?.name}?</h3>
            <p>
              This permanently deletes the active challenge, every archived challenge, lifetime XP, badges,
              quotes, and experiments for this profile. This cannot be undone. Type <strong>DELETE</strong> to confirm.
            </p>
            <input
              className="inline-input"
              value={deleteAllConfirmText}
              onChange={e => setDeleteAllConfirmText(e.target.value)}
              placeholder="Type DELETE"
              style={{ width: '100%', marginBottom: 16 }}
            />
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowDeleteAll(false)}>Cancel</button>
              <button
                className="btn btn-danger"
                disabled={deleteAllConfirmText !== 'DELETE'}
                style={deleteAllConfirmText !== 'DELETE' ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
                onClick={() => { deleteAllProfileData(); setShowDeleteAll(false); }}
              >
                Wipe Everything
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset XP confirmation */}
      {showResetXP && (
        <div className="modal-overlay" onClick={() => setShowResetXP(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>Reset Challenge XP?</h3>
            <p>This sets your current challenge's XP back to 0. Lifetime XP, rank, day data, streaks, and badges are not changed.</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowResetXP(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => { resetXP(); setShowResetXP(false); }}>
                Yes, Reset XP
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
