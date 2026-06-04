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
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: {
      url: '/',
      ...data
    }
  });

  // To increase delivery reliability, send a small burst of notifications
  // with slightly different tags so they appear persistently until acted on.
  const attempts = 3;
  const now = Date.now();

  const sendTasks = [];
  const baseObj = JSON.parse(payload);

  for (let i = 0; i < attempts; i++) {
    const attemptPayloadObj = {
      ...baseObj,
      tag: `panicsafe-connected-alert-${now}-${i}`,
      data: { ...(baseObj.data || {}), attempt: i }
    };
    const attemptPayload = JSON.stringify(attemptPayloadObj);

    for (const subscription of subscriptions) {
      // capture endpoint for result mapping
      // set a moderate TTL and high urgency to encourage delivery
      const sendPromise = webpush.sendNotification(subscription, attemptPayload, { TTL: 60 });
      sendTasks.push({ subscription: subscription.endpoint, attempt: i, promise: sendPromise });
    }
  }

  // execute all sends and map results
  const settled = await Promise.allSettled(sendTasks.map(t => t.promise));

  const results = settled.map((r, idx) => {
    const task = sendTasks[idx];
    if (r.status === 'fulfilled') {
      return { ok: true, endpoint: task.subscription, attempt: task.attempt };
    }
    const reason = r.reason && (r.reason.body || r.reason.message || (r.reason.stack && r.reason.stack.toString())) || 'unknown';
    return { ok: false, endpoint: task.subscription, attempt: task.attempt, reason };
  });

  res.status(200).json({
    success: results.some(r => r.ok),
    results
  });
};
