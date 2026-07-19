// POST /api/push/test — send one real Web Push message to the subscription
// provided in the request body. Works as soon as VAPID env vars are set; no
// storage backend needed because the client passes its own subscription.
//
// Body: { subscription: PushSubscriptionJSON, title?, body? }

import webpush from 'web-push';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return res.status(503).json({
      error: 'Push service not configured',
      detail: 'Set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT in the environment.',
    });
  }

  const { subscription, title, body } = req.body || {};
  if (!subscription?.endpoint) {
    return res.status(400).json({ error: 'Missing push subscription' });
  }

  try {
    webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:admin@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    await webpush.sendNotification(subscription, JSON.stringify({
      title: title || '⚔️ Forge push test',
      body: body || 'Server-side push is working.',
      tag: 'forge-server-test',
      view: 'settings',
    }));
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(502).json({ error: 'Push delivery failed', detail: String(err?.statusCode || err) });
  }
}
