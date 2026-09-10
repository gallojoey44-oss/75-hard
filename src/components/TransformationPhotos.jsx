import { useState, useEffect, useRef } from 'react';
import { listPhotos, photoURL } from '../utils/photoStore';

/**
 * The Day 30 before → after experience.
 *
 * Shows the first and last stored photos side by side, with an optional scrubber
 * through every day that has one. Object URLs are created once for the whole set
 * and revoked together on unmount, so scrubbing does not leak memory.
 *
 * Renders nothing at all when there are no photos — a user who ran the challenge
 * without storable photos still gets the full stats report above this.
 */
export default function TransformationPhotos({ profileId, duration }) {
  const [photos, setPhotos] = useState([]);
  const [urls, setUrls] = useState({});
  const [scrub, setScrub] = useState(null);      // day number, or null for before/after
  const urlsRef = useRef({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await listPhotos(profileId);
      if (cancelled) return;
      const map = {};
      for (const p of list) {
        const u = photoURL(p);
        if (u) map[p.dayNumber] = u;
      }
      urlsRef.current = map;
      setPhotos(list);
      setUrls(map);
    })();
    return () => {
      cancelled = true;
      for (const u of Object.values(urlsRef.current)) { try { URL.revokeObjectURL(u); } catch {} }
      urlsRef.current = {};
    };
  }, [profileId]);

  if (!photos.length) return null;

  const first = photos[0];
  const last = photos[photos.length - 1];
  const single = photos.length === 1;
  const scrubPhoto = scrub != null ? photos.find(p => p.dayNumber === scrub) : null;

  return (
    <div className="tf-photos">
      <div className="tf-photos-title">Before → After</div>

      {scrubPhoto ? (
        <div className="tf-single">
          <div className="tf-frame">
            <img src={urls[scrubPhoto.dayNumber]} alt={`Progress photo, day ${scrubPhoto.dayNumber}`} />
            <span className="tf-frame-label">Day {scrubPhoto.dayNumber}</span>
          </div>
        </div>
      ) : (
        <div className="tf-pair">
          <div className="tf-frame">
            <img src={urls[first.dayNumber]} alt={`Progress photo, day ${first.dayNumber}`} />
            <span className="tf-frame-label">Day {first.dayNumber}</span>
          </div>
          {!single && (
            <div className="tf-frame">
              <img src={urls[last.dayNumber]} alt={`Progress photo, day ${last.dayNumber}`} />
              <span className="tf-frame-label">Day {last.dayNumber}</span>
            </div>
          )}
        </div>
      )}

      {photos.length > 1 && (
        <div className="tf-scrub">
          <div className="tf-scrub-head">
            <span>{scrub != null ? `Day ${scrub}` : 'Scrub through all your photos'}</span>
            {scrub != null && (
              <button className="tf-scrub-reset" onClick={() => setScrub(null)}>Back to before / after</button>
            )}
          </div>
          <input
            type="range"
            className="tf-scrub-range"
            min={0}
            max={photos.length - 1}
            value={scrub != null ? photos.findIndex(p => p.dayNumber === scrub) : 0}
            onChange={e => setScrub(photos[Number(e.target.value)].dayNumber)}
            aria-label="Scrub through progress photos"
          />
          <div className="tf-scrub-meta">
            {photos.length} {photos.length === 1 ? 'photo' : 'photos'} across {duration} days
          </div>
        </div>
      )}

      <div className="tf-photos-note">
        🔒 These stay on this device. Forge never uploads them and never includes them in an export.
      </div>
    </div>
  );
}
