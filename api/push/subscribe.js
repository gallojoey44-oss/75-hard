// POST /api/push/subscribe — persist a Web Push subscription for later
// server-side delivery.
//
// Body: { installId, profileId, subscription: PushSubscriptionJSON }
// The subscription (endpoint + p256dh/auth keys) is stored in a durable
// Redis-compatible store, associated with an anonymous installation id and the
// profile id. No health/challenge data is stored server-side.

import { saveSubscription, storeConfigured } from '../_lib/store.js';
import { vapidConfigured } from '../_lib/push.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { installId, profileId, subscription } = req.body || {};
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ error: 'Invalid push subscription' });
  }
  if (!['me', 'girlfriend'].includes(profileId)) {
    return res.status(400).json({ error: 'Invalid profile' });
  }
  if (!installId || typeof installId !== 'string') {
    return res.status(400).json({ error: 'Missing installId' });
  }

  if (!vapidConfigured()) {
    return res.status(503).json({
      error: 'Push service not configured',
      detail: 'Set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT in the environment.',
    });
  }
  if (!storeConfigured()) {
    return res.status(503).json({
      error: 'Subscription store not configured',
      detail: 'Attach a Vercel KV (or Upstash Redis) store so subscriptions can persist.',
    });
  }

  try {
    await saveSubscription(installId, profileId, subscription);
    return res.status(200).json({ ok: true, stored: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to store subscription', detail: String(err?.message || err) });
  }
}
