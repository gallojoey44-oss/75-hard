import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { formatDateShort, getTodayStr } from '../utils/dateUtils';
import TaskManager from './TaskManager';
import QuoteLibrary from './QuoteLibrary';
import { checkForUpdate, applyUpdate } from '../utils/swUtils.js';
import BuildBanner, { BUILD_VERSION, BUILD_LABEL, BUILD_DATE, PRODUCTION_URL } from './BuildBanner';

const LS_KEYS = ['profiles', 'allDays', 'activeProfile', 'quoteData', 'experiments', 'dismissedHints'];

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

export default function SettingsView() {
  const {
    activeProfile, profile, profiles,
    updateProfile, startChallenge, resetChallenge, setChallengeStart,
    getDayNumber,
    setActiveProfile,
  } = useApp();

  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(profile?.name || '');
  const [showReset, setShowReset] = useState(false);
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

  function handleReset() {
    resetChallenge();
    setShowReset(false);
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
    if (!n || n < 1 || n > 75) { flash(false, 'Enter a number from 1 to 75.'); return; }
    const startStr = dayNumToStartDate(n);
    setChallengeStart(startStr);
    flash(true, `Today is now Day ${n}. Day 1 = ${formatDateShort(startStr)}.`);
    setTodayAsDayInput('');
  }

  const otherProfile = activeProfile === 'me' ? 'girlfriend' : 'me';

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

      {/* Quote Library */}
      <div className="settings-section">
        <QuoteLibrary />
      </div>

      {/* Challenge management + start date */}
      <div className="settings-section">
        <div className="section-title">🎯 Challenge</div>

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
              Day {getDayNumber()} of 75
            </span>
          </div>
        ) : null}

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
                max="75"
                placeholder="1–75"
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
            {todayAsDayInput && +todayAsDayInput >= 1 && +todayAsDayInput <= 75 && (
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

        {/* Start fresh / Reset */}
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!profile?.challengeStart ? (
            <button className="btn btn-primary btn-full" onClick={() => startChallenge()}>
              Start Challenge Today
            </button>
          ) : (
            <button className="btn btn-danger btn-full" onClick={() => setShowReset(true)}>
              🔄 Reset Challenge &amp; Wipe Data
            </button>
          )}
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

      {/* Deployment Debug */}
      <div className="settings-section">
        <div className="section-title">🛠 Deployment Debug</div>
        <div className="settings-row">
          <span className="settings-row-label">App Version</span>
          <span className="settings-row-value" style={{ fontFamily: 'monospace', fontSize: 13 }}>{BUILD_VERSION}</span>
        </div>
        <div className="settings-row">
          <span className="settings-row-label">Build Label</span>
          <span className="settings-row-value" style={{ fontFamily: 'monospace', fontSize: 13 }}>{BUILD_LABEL}</span>
        </div>
        <div className="settings-row">
          <span className="settings-row-label">Production URL</span>
          <span className="settings-row-value" style={{ fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>{PRODUCTION_URL}</span>
        </div>
        <div className="settings-row">
          <span className="settings-row-label">Last Updated</span>
          <span className="settings-row-value" style={{ fontFamily: 'monospace', fontSize: 13 }}>{BUILD_DATE}</span>
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

      {/* Reset confirmation */}
      {showReset && (
        <div className="modal-overlay" onClick={() => setShowReset(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>Reset Challenge?</h3>
            <p>This will delete all your progress for this profile and start fresh. This cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowReset(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleReset}>Yes, Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
