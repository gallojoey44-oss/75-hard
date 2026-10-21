// POST /api/push/delivered — the service worker reporting that a push actually
// arrived on the device.
//
// This endpoint exists because of a specific honesty problem. A 201 from
// Apple's push service means ACCEPTED FOR DELIVERY. It does not mean the phone
// received anything, and it certainly does not mean a notification was shown.
// Treating acceptance as delivery is how "push is working" gets claimed when
// the user is receiving nothing.
//
// The only party that knows the push genuinely arrived is the service worker
// whose `push` handler fired. It posts here, and that confirmation — with a
// timestamp the server did not invent — is what the diagnostics panel reports
// as confirmed delivery.
//
// Body: { installId, profileId, label?, tag?, receivedAt? }

import { recordDelivery, storeConfigured } from '../_lib/store.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  // Never fail the service worker's report in a way that looks like a push
  // problem — if the store is down there is simply nothing to record.
  if (!storeConfigured()) {
    return res.status(200).json({ ok: false, reason: 'store-not-configured' });
  }

  const { installId, profileId, label, tag } = req.body || {};
  if (!installId || !['me', 'girlfriend'].includes(profileId)) {
    return res.status(400).json({ error: 'Missing installId/profileId' });
  }

  try {
    await recordDelivery(installId, profileId, { label, tag });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to record delivery', detail: String(err?.message || err) });
  }
}
