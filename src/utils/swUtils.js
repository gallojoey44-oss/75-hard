// Service-worker update management.
// localStorage is never touched here — all user data lives there independently.

let registration = null;
let isApplyingUpdate = false;

export async function registerSW() {
  if (!('serviceWorker' in navigator)) return;

  // Capture whether a SW was already controlling this page before registration.
  // Used to avoid a reload loop on first install (no prior SW = no reload needed).
  const hadController = !!navigator.serviceWorker.controller;

  // When the new SW activates (v4+), it posts SW_UPDATED to all window clients.
  // If a SW was already in control, reload to serve the freshly cached HTML/assets.
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type === 'SW_UPDATED' && hadController && !isApplyingUpdate) {
      window.location.reload();
    }
  });

  try {
    registration = await navigator.serviceWorker.register('/sw.js');

    let announced = false;
    function announceUpdate() {
      if (announced) return;
      announced = true;
      window.dispatchEvent(new CustomEvent('sw-update-available'));
    }

    // New SW already waiting when page loads (user skipped a previous prompt)
    if (registration.waiting) {
      announceUpdate();
    }

    // New SW found and installed during this session
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          announceUpdate();
        }
      });
    });

    // When the new SW takes control (after skipWaiting), reload to serve fresh files
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (isApplyingUpdate) window.location.reload();
    });

    // Background update check every 30 minutes
    setInterval(() => registration.update().catch(() => {}), 30 * 60 * 1000);

  } catch {
    // Non-fatal: app works without SW
  }
}

/**
 * Tell the waiting SW to activate, then reload the page.
 * Called when the user taps "Update" in the banner or Settings.
 */
export function applyUpdate() {
  if (registration?.waiting) {
    isApplyingUpdate = true;
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    // Reload is triggered by the controllerchange listener above.
    // Safety fallback if controllerchange never fires (e.g. no prior SW):
    setTimeout(() => window.location.reload(), 2000);
  } else {
    // No waiting SW — just do a hard reload so network-first fetches fresh HTML
    window.location.reload();
  }
}

/**
 * Trigger a manual update check.
 * Returns: 'update-available' | 'up-to-date' | 'unavailable' | 'error'
 */
export async function checkForUpdate() {
  if (!registration) {
    try {
      registration = await navigator.serviceWorker.getRegistration('/sw.js') ?? null;
    } catch {}
  }
  if (!registration) return 'unavailable';

  try {
    await registration.update();
    // Wait briefly for the installing → installed statechange to propagate
    await new Promise(r => setTimeout(r, 1500));
    return registration.waiting ? 'update-available' : 'up-to-date';
  } catch {
    return 'error';
  }
}
