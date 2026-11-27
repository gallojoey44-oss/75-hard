/**
 * Whether Forge is running inside the iPhone app (Capacitor) rather than in a
 * browser or as the web app added to the Home Screen.
 *
 * The app's native shell defines window.Capacitor before any page script runs,
 * and it reports a native platform. A browser has no window.Capacitor at all —
 * or, once a Capacitor plugin module has been loaded, one that reports "web" —
 * so this is false everywhere on the web and nothing it guards can run there.
 */
export function isNativeApp() {
  try {
    return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

/** Decided once, at startup: the platform cannot change while the app runs. */
export const IS_NATIVE_APP = isNativeApp();
