// Service-worker update management.
// localStorage is never touched here — all user data lives there independently.
//
// Update model (reliable, deterministic):
// - The service worker never calls skipWaiting() on its own. A freshly
//   downloaded worker sits in the "waiting" state until the app tells it to
//   activate. That makes `registration.waiting` a trustworthy signal for
//   "an update is ready".
// - registerSW() surfaces that signal (banner + Settings) and reloads the page
//   exactly once, only after the user applied the update.
// - applyUpdate() / checkForUpdate() drive activation through the SKIP_WAITING
//   message — the single intended update path.

let registration = null;
let isApplyingUpdate = false; // true once the user has asked to apply an update
let refreshing = false;       // guards against multiple reloads on controllerchange

function announceUpdate() {
  window.dispatchEvent(new CustomEvent('sw-update-available'));
}

// A worker is "waiting to take over" when it is installed but not yet the
// controller. This is the reliable readiness signal now that the SW no longer
// auto-skips waiting.
function updateIsReady() {
  return !!(registration && registration.waiting && navigator.serviceWorker.controller);
}

export async function registerSW() {
  if (!('serviceWorker' in navigator)) return;

  // Reload once when a NEW worker takes control — but only if the user asked to
  // update. On first install, clients.claim() also fires controllerchange with
  // no prior controller; the isApplyingUpdate guard prevents a surprise reload.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!isApplyingUpdate || refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  try {
    registration = await navigator.serviceWorker.register('/sw.js');

    // A worker was already waiting when the app opened (a previous background
    // check found an update the user hasn't applied yet).
    if (registration.waiting && navigator.serviceWorker.controller) {
      announceUpdate();
    }

    // A new worker is downloading during this session.
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', () => {
        // 'installed' + an existing controller == an update is ready and waiting
        // (a first install has no controller, so no banner / no reload).
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          announceUpdate();
        }
      });
    });

    // Background update check every 30 minutes (also re-fetches /sw.js).
    setInterval(() => registration.update().catch(() => {}), 30 * 60 * 1000);
  } catch {
    // Non-fatal: the app works without a service worker.
  }
}

// Ask a worker (waiting, or one that is still installing) to activate. The
// page reload is driven by the controllerchange listener above; a timeout is a
// safety net in case that event does not fire.
function activateWorker(worker) {
  if (!worker) return;
  isApplyingUpdate = true;
  worker.postMessage({ type: 'SKIP_WAITING' });
  setTimeout(() => {
    if (!refreshing) { refreshing = true; window.location.reload(); }
  }, 3000);
}

/**
 * Apply a pending update: activate the waiting worker and reload. Called from
 * the update banner and the Settings "Apply Update" button.
 */
export function applyUpdate() {
  if (registration?.waiting) {
    activateWorker(registration.waiting);
    return;
  }
  // A worker may still be installing — activate it as soon as it is ready.
  if (registration?.installing) {
    const worker = registration.installing;
    isApplyingUpdate = true;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed') activateWorker(worker);
    });
    return;
  }
  // Nothing pending — the current worker is already latest. A plain reload pulls
  // fresh network-first HTML without touching any user data.
  window.location.reload();
}

/**
 * Trigger a manual update check ("Check for Updates").
 * Fetches the latest /sw.js, waits for a new worker to finish installing, and
 * reports whether one is now waiting to take over.
 * Returns: 'update-available' | 'up-to-date' | 'unavailable' | 'error'
 */
export async function checkForUpdate() {
  if (!registration) {
    try {
      registration = await navigator.serviceWorker.getRegistration('/sw.js') ?? null;
    } catch { /* ignore */ }
  }
  if (!registration) return 'unavailable';

  try {
    // If one is already waiting, we're done.
    if (updateIsReady()) return 'update-available';

    await registration.update();

    // update() may kick off a download; wait for the installing worker (if any)
    // to reach 'installed', so registration.waiting becomes populated.
    const installing = registration.installing;
    if (installing) {
      await new Promise(resolve => {
        const done = () => resolve();
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' || installing.state === 'redundant') done();
        });
        setTimeout(done, 5000); // safety timeout
      });
    } else {
      // No download started — give the browser a brief moment in case one is
      // just beginning, then re-check.
      await new Promise(r => setTimeout(r, 800));
    }

    return registration.waiting ? 'update-available' : 'up-to-date';
  } catch {
    return 'error';
  }
}
