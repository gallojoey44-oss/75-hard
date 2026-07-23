// Shared Web Push sender. Configures VAPID once and delivers a payload to a
// subscription, cleaning up subscriptions the push service reports as gone.

import webpush from 'web-push';
import { removeSubscriptionByEndpoint } from './store.js';

let configured = false;

export function vapidConfigured() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function ensureVapid() {
  if (configured) return true;
  if (!vapidConfigured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
  configured = true;
  return true;
}

/**
 * Send a JSON payload to one subscription.
 * Returns { ok, statusCode?, gone?, error? }. When the endpoint is gone
 * (404/410) the subscription is removed from the store automatically.
 */
export async function sendPush(subscription, payload) {
  if (!ensureVapid()) return { ok: false, error: 'vapid-not-configured' };
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { ok: true };
  } catch (err) {
    const statusCode = err?.statusCode;
    const gone = statusCode === 404 || statusCode === 410;
    if (gone && subscription?.endpoint) {
      await removeSubscriptionByEndpoint(subscription.endpoint).catch(() => {});
    }
    return { ok: false, statusCode, gone, error: String(err?.body || err?.message || err) };
  }
}
