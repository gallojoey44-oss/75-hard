// POST /api/push/unsubscribe — remove a stored Web Push subscription.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { endpoint } = req.body || {};
  if (!endpoint) {
    return res.status(400).json({ error: 'Missing endpoint' });
  }

  // TODO(storage): delete the stored subscription for this endpoint once a
  // durable store is attached.
  return res.status(200).json({ ok: true });
}
