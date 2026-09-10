/**
 * Progress photo storage.
 *
 * Photos are the one kind of user data Forge holds that cannot live in
 * localStorage: thirty JPEGs are megabytes, and localStorage is a ~5MB quota
 * shared with every profile, day record and archive the app already keeps.
 * They go in IndexedDB instead, which is sized for binary data.
 *
 * PRIVACY. These images never leave the device. IndexedDB is origin-scoped, the
 * app makes no network calls with them, and they are deliberately NOT included
 * in Settings → Export (a JSON backup the user might mail to themselves should
 * not silently contain their body photos). Deleting a profile's data deletes
 * them. The only way a photo leaves is the user saving it themselves.
 *
 * Everything here degrades gracefully: in a private window, with storage
 * blocked, or in any environment without IndexedDB, every call resolves to null
 * or false instead of throwing, and the photo task falls back to a plain manual
 * checkbox. A challenge is never blocked by storage.
 */

const DB_NAME = 'forge-photos';
const DB_VERSION = 1;
const STORE = 'photos';

/** Longest edge, in px, a stored photo is downscaled to. */
export const MAX_EDGE = 1080;
/** JPEG quality for stored photos — visually clean at roughly 150–250KB each. */
export const JPEG_QUALITY = 0.82;

/** Storage key for one profile's photo on one challenge day. */
export function photoKey(profileId, dayNumber) {
  return `${profileId}:${dayNumber}`;
}

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'key' });
          store.createIndex('profileId', 'profileId', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

/** True when photos can actually be stored in this environment. */
export async function photosAvailable() {
  return !!(await openDB());
}

function tx(db, mode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}

function asPromise(request) {
  return new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => resolve(null);
  });
}

/**
 * Downscale an image file to a JPEG blob no larger than MAX_EDGE on its longest
 * side. Keeps thirty days of photos to a few megabytes and strips the original
 * file's metadata (including any EXIF GPS tag) as a side effect of re-encoding.
 */
export function downscale(file, maxEdge = MAX_EDGE, quality = JPEG_QUALITY) {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(
            (blob) => { URL.revokeObjectURL(url); resolve(blob ? { blob, w, h } : null); },
            'image/jpeg',
            quality,
          );
        } catch {
          URL.revokeObjectURL(url);
          resolve(null);
        }
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Store a photo for one challenge day. Returns the stored record, or null when
 * storage is unavailable or the file could not be read as an image — the caller
 * must treat null as "not recorded" and leave the task unchecked.
 */
export async function savePhoto(profileId, dayNumber, file, dateStr = null) {
  const db = await openDB();
  if (!db || !file || !profileId || !dayNumber) return null;
  const scaled = await downscale(file);
  if (!scaled) return null;
  const record = {
    key: photoKey(profileId, dayNumber),
    profileId,
    dayNumber: Number(dayNumber),
    date: dateStr,
    blob: scaled.blob,
    width: scaled.w,
    height: scaled.h,
    bytes: scaled.blob.size,
    takenAt: Date.now(),
  };
  const ok = await new Promise((resolve) => {
    try {
      const req = tx(db, 'readwrite').put(record);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);      // quota exceeded, most likely
    } catch { resolve(false); }
  });
  return ok ? record : null;
}

/** One day's photo record, or null. */
export async function getPhoto(profileId, dayNumber) {
  const db = await openDB();
  if (!db) return null;
  return asPromise(tx(db, 'readonly').get(photoKey(profileId, dayNumber)));
}

/** Every photo a profile has, ordered by day number. */
export async function listPhotos(profileId) {
  const db = await openDB();
  if (!db) return [];
  const all = await new Promise((resolve) => {
    try {
      const req = tx(db, 'readonly').index('profileId').getAll(profileId);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    } catch { resolve([]); }
  });
  return all.sort((a, b) => a.dayNumber - b.dayNumber);
}

/** The day numbers a profile has photos for. */
export async function photoDayNumbers(profileId) {
  return (await listPhotos(profileId)).map(p => p.dayNumber);
}

/** Remove one day's photo. */
export async function deletePhoto(profileId, dayNumber) {
  const db = await openDB();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const req = tx(db, 'readwrite').delete(photoKey(profileId, dayNumber));
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch { resolve(false); }
  });
}

/** Remove every photo belonging to a profile (used when its data is deleted). */
export async function clearProfilePhotos(profileId) {
  const photos = await listPhotos(profileId);
  for (const p of photos) await deletePhoto(profileId, p.dayNumber);
  return photos.length;
}

/** An object URL for a photo record. The caller must revoke it when done. */
export function photoURL(record) {
  if (!record?.blob) return null;
  try { return URL.createObjectURL(record.blob); } catch { return null; }
}

/** Total bytes a profile's photos occupy. */
export async function photoBytes(profileId) {
  return (await listPhotos(profileId)).reduce((sum, p) => sum + (p.bytes || 0), 0);
}

/** Reset the cached connection — tests only. */
export function _resetForTests() {
  dbPromise = null;
}
