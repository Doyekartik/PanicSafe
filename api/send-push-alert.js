const webpush = require('web-push');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:alerts@panicsafe.app';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    res.status(500).json({ error: 'VAPID keys are not configured.' });
    return;
  }

  const {
    subscriptions = [],
    title = 'PanicSafe Alert',
    body = 'A connected PanicSafe user needs attention.',
    data = {}
  } = req.body || {};

  if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
    res.status(400).json({ error: 'No push subscriptions provided.' });
    return;
  }

  const payload = JSON.stringify({
    title,
    body,
    icon: '/assets/icon-192.png',
    badge: '/assets/icon-192.png',
    tag: 'panicsafe-connected-alert',
    data: {
      url: '/',
      ...data
    }
  });

  const results = await Promise.allSettled(
    subscriptions.map(subscription => webpush.sendNotification(subscription, payload))
  );

  res.status(200).json({
    success: results.some(result => result.status === 'fulfilled'),
    results: results.map(result => ({
      ok: result.status === 'fulfilled',
      reason: result.status === 'rejected' ? result.reason?.message : undefined
    }))
  });
};
