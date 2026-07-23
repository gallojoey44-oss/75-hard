// POST /api/push/test-background — send a real Web Push to the subscriptions
// stored server-side for { installId, profileId }. Unlike /api/push/test (which
// echoes to a subscription passed in the body), this exercises the full
// production path: durable store → VAPID → push service. It works after the
// user has left the app because delivery originates entirely on the server.
//
// Body: { installId, profileId }

import { getSubscriptions, updateDiagnostics, storeConfigured } from '../_lib/store.js';
import { sendPush, vapidConfigured } from '../_lib/push.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!vapidConfigured()) {
    return res.status(503).json({ error: 'Push service not configured' });
  }
  if (!storeConfigured()) {
    return res.status(503).json({ error: 'Subscription store not configured' });
  }

  const { installId, profileId } = req.body || {};
  if (!installId || !['me', 'girlfriend'].includes(profileId)) {
    return res.status(400).json({ error: 'Missing installId/profileId' });
  }

  try {
    const subs = await getSubscriptions(installId, profileId);
    if (subs.length === 0) {
      return res.status(404).json({ error: 'No stored subscription for this install/profile' });
    }

    const payload = {
      title: '⚔️ Forge background push',
      body: 'Server-side push works — this arrived even with Forge closed.',
      tag: `forge-${profileId}-bgtest`,
      view: 'settings',
    };

    let delivered = 0, cleaned = 0, lastError = null;
    for (const sub of subs) {
      const r = await sendPush(sub, payload);
      if (r.ok) delivered++;
      else { if (r.gone) cleaned++; lastError = r.error || r.statusCode; }
    }

    await updateDiagnostics(installId, profileId, {
      lastPushAttempt: new Date().toISOString(),
      lastPushType: 'background-test',
      ...(delivered > 0
        ? { lastPushDelivered: new Date().toISOString(), lastPushResult: 'delivered', failureReason: null }
        : { lastPushResult: 'failed', failureReason: String(lastError || 'unknown') }),
    }).catch(() => {});

    if (delivered === 0) {
      return res.status(502).json({ error: 'Delivery failed', cleaned, detail: String(lastError) });
    }
    return res.status(200).json({ ok: true, delivered, cleaned });
  } catch (err) {
    return res.status(500).json({ error: 'Background test failed', detail: String(err?.message || err) });
  }
}
