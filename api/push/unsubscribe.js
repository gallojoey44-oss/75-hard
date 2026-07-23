// POST /api/push/unsubscribe — remove a stored Web Push subscription and, when
// no subscriptions remain for this install/profile, its reminder schedule.
//
// Body: { installId, profileId, endpoint }

import {
  removeSubscription, getSubscriptions, removeSchedule, storeConfigured,
} from '../_lib/store.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { installId, profileId, endpoint } = req.body || {};
  if (!endpoint) {
    return res.status(400).json({ error: 'Missing endpoint' });
  }
  if (!storeConfigured()) {
    // Nothing persisted — acknowledge so the client can still unsubscribe locally.
    return res.status(200).json({ ok: true, stored: false });
  }
  if (!installId || !['me', 'girlfriend'].includes(profileId)) {
    return res.status(400).json({ error: 'Missing installId/profileId' });
  }

  try {
    await removeSubscription(installId, profileId, endpoint);
    // If this was the last subscription for the profile, drop its schedule too
    // so the cron sender stops considering it.
    const remaining = await getSubscriptions(installId, profileId);
    if (remaining.length === 0) await removeSchedule(installId, profileId);
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to unsubscribe', detail: String(err?.message || err) });
  }
}
