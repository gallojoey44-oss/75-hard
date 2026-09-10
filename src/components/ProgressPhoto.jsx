import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import * as FLH from '../data/fatLossHardConfig';
import {
  savePhoto, getPhoto, deletePhoto, photoURL, photosAvailable,
} from '../utils/photoStore';

/**
 * The daily progress photo control.
 *
 * Taking or choosing a photo IS completing the task: a successful save ticks
 * `fl_photo` automatically, and removing the photo unticks it, so the checkbox
 * can never claim a photo exists when it does not.
 *
 * If this browser cannot store images (private window, storage blocked, no
 * IndexedDB), the control says so and the task falls back to a plain manual
 * checkbox on the daily list — the challenge is never blocked by storage.
 */
export default function ProgressPhoto({ dayNumber, date, compact = false }) {
  const { activeProfile, getDayData, toggleTask } = useApp();

  const [record, setRecord] = useState(null);
  const [url, setUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const inputRef = useRef(null);
  const urlRef = useRef(null);

  const done = !!getDayData(dayNumber)?.tasks?.fl_photo;

  const revoke = () => {
    if (urlRef.current) { try { URL.revokeObjectURL(urlRef.current); } catch {} urlRef.current = null; }
  };

  const load = useCallback(async () => {
    const ok = await photosAvailable();
    setAvailable(ok);
    if (!ok) return;
    const rec = await getPhoto(activeProfile, dayNumber);
    revoke();
    setRecord(rec);
    const u = rec ? photoURL(rec) : null;
    urlRef.current = u;
    setUrl(u);
  }, [activeProfile, dayNumber]);

  useEffect(() => { load(); return revoke; }, [load]);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';                       // allow re-picking the same file
    if (!file) return;
    setBusy(true); setError('');
    const saved = await savePhoto(activeProfile, dayNumber, file, date);
    setBusy(false);
    if (!saved) {
      // Never tick the task on a failed save — that would claim a photo exists.
      setError('That photo could not be saved. Your device storage may be full, or the file may not be an image.');
      return;
    }
    await load();
    if (!done) toggleTask(dayNumber, 'fl_photo');
  }

  async function handleRemove() {
    setBusy(true);
    await deletePhoto(activeProfile, dayNumber);
    setBusy(false);
    revoke(); setRecord(null); setUrl(null);
    if (done) toggleTask(dayNumber, 'fl_photo');   // the task follows the photo
  }

  if (!available) {
    return (
      <div className="flh-photo flh-photo-unavailable">
        <div className="flh-photo-title">📸 Daily progress photo</div>
        <div className="flh-note">
          This browser will not let Forge store images (private browsing, or site data is blocked),
          so take your photo with your normal camera app and tick the task by hand. Everything else
          in the challenge works exactly the same.
        </div>
      </div>
    );
  }

  return (
    <div className={`flh-photo${compact ? ' compact' : ''}`}>
      <div className="flh-photo-head">
        <span className="flh-photo-title">📸 Day {dayNumber} photo</span>
        <span className={`flh-photo-status${record ? ' done' : ''}`}>
          {record ? 'Recorded' : 'Required'}
        </span>
      </div>

      {url ? (
        <>
          <div className="flh-photo-frame">
            <img src={url} alt={`Progress photo, day ${dayNumber}`} />
          </div>
          <div className="flh-photo-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => inputRef.current?.click()} disabled={busy}>
              Replace
            </button>
            <button className="btn btn-ghost btn-sm danger" onClick={handleRemove} disabled={busy}>
              Remove
            </button>
          </div>
        </>
      ) : (
        <button className="flh-photo-drop" onClick={() => inputRef.current?.click()} disabled={busy}>
          <span className="flh-photo-drop-icon">📷</span>
          <span className="flh-photo-drop-label">{busy ? 'Saving…' : 'Take or choose today\'s photo'}</span>
          <span className="flh-photo-drop-hint">Recording it ticks the task automatically</span>
        </button>
      )}

      {error && <div className="flh-photo-error">{error}</div>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        style={{ display: 'none' }}
      />

      <button className="flh-photo-guide-toggle" onClick={() => setShowGuide(v => !v)}>
        {showGuide ? '▾' : '▸'} {FLH.PHOTO_GUIDE.title}
      </button>
      {showGuide && (
        <>
          <div className="flh-note">{FLH.PHOTO_GUIDE.blurb}</div>
          <ul className="flh-list">
            {FLH.PHOTO_GUIDE.items.map((i, n) => <li key={n}>{i}</li>)}
          </ul>
        </>
      )}
      <div className="flh-photo-privacy">🔒 {FLH.PHOTO_GUIDE.privacy}</div>
    </div>
  );
}
