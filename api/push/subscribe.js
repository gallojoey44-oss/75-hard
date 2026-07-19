// POST /api/push/subscribe — store a Web Push subscription for later delivery.
//
// Backend-readiness note: this route validates and acknowledges subscriptions.
// Persisting them requires a storage backend (e.g. Vercel KV/Postgres) before
// scheduled pushes can be sent; only notification delivery info is stored
// server-side — challenge data stays local to the device.
//
// Required env vars (see .env.example): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// VAPID_SUBJECT. The private key must NEVER ship to the client.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { profileId, subscription } = req.body || {};
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ error: 'Invalid push subscription' });
  }
  if (!['me', 'girlfriend'].includes(profileId)) {
    return res.status(400).json({ error: 'Invalid profile' });
  }

  if (!process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_PUBLIC_KEY) {
    return res.status(503).json({
      error: 'Push service not configured',
      detail: 'Set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT in the environment.',
    });
  }

  // TODO(storage): persist { profileId, subscription } in a durable store
  // keyed by subscription.endpoint so the scheduled sender can deliver
  // reminders. Until a store is attached, acknowledge without persisting.
  return res.status(200).json({ ok: true, stored: false, reason: 'no-storage-backend' });
}
