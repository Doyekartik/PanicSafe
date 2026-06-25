const https = require('https');
const { verifyFirebaseRequest } = require('../lib/firebase-id-token');

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER || '';
const SMS_DEFAULT_COUNTRY_CODE = process.env.SMS_DEFAULT_COUNTRY_CODE || '';

function normalizeSmsPhone(phone) {
  const cleaned = String(phone || '').replace(/[^\d+]/g, '').trim();
  if (!cleaned) return '';
  if (cleaned.startsWith('+')) return cleaned;

  const countryCode = SMS_DEFAULT_COUNTRY_CODE.replace(/[^\d+]/g, '').trim();
  if (!countryCode) return cleaned;

  const nationalNumber = cleaned.replace(/^0+/, '');
  return `${countryCode.startsWith('+') ? countryCode : `+${countryCode}`}${nationalNumber}`;
}

function buildSosMessage(payload) {
  const userName = String(payload.userName || 'PanicSafe user').trim();
  const triggerSource = String(payload.triggerSource || '').toLowerCase();
  const location = payload.location || {};
  const lat = Number(location.lat);
  const lng = Number(location.lng);
  const hasLocation = Number.isFinite(lat) && Number.isFinite(lng);
  const locationText = hasLocation
    ? ` Last location: https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`
    : '';

  if (triggerSource.includes('timer')) {
    return `${userName} is not responding to the PanicSafe timer.${locationText}`;
  }

  return `${userName} triggered a PanicSafe SOS alert.${locationText}`;
}

function sendTwilioSms(to, body) {
  return new Promise((resolve) => {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
      resolve({
        ok: true,
        simulated: true,
        detail: 'Twilio env vars not configured; SMS logged only.'
      });
      return;
    }

    const postData = new URLSearchParams({
      To: to,
      From: TWILIO_FROM_NUMBER,
      Body: body
    }).toString();

    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    const request = https.request({
      hostname: 'api.twilio.com',
      path: `/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (twilioRes) => {
      let data = '';
      twilioRes.on('data', chunk => {
        data += chunk.toString();
      });
      twilioRes.on('end', () => {
        if (twilioRes.statusCode >= 200 && twilioRes.statusCode < 300) {
          resolve({ ok: true, simulated: false, providerStatus: twilioRes.statusCode });
        } else {
          resolve({
            ok: false,
            simulated: false,
            providerStatus: twilioRes.statusCode,
            detail: data
          });
        }
      });
    });

    request.on('error', (err) => {
      resolve({ ok: false, simulated: false, detail: err.message });
    });

    request.write(postData);
    request.end();
  });
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    return JSON.parse(req.body);
  }
  return req.body;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  try {
    const authUser = await verifyFirebaseRequest(req);
    const payload = parseBody(req);
    if (payload.senderUid && payload.senderUid !== authUser.uid) {
      res.status(403).json({ error: 'Sender mismatch.' });
      return;
    }

    const contacts = Array.isArray(payload.contacts) ? payload.contacts : [];
    const validRecipients = contacts
      .slice(0, 8)
      .map(contact => ({
        name: String(contact.name || 'Emergency contact').trim(),
        phone: normalizeSmsPhone(contact.phone)
      }))
      .filter(contact => contact.phone);

    if (validRecipients.length === 0) {
      res.status(400).json({ error: 'No emergency contacts with phone numbers available.' });
      return;
    }

    const message = buildSosMessage(payload).slice(0, 800);
    const results = [];

    for (const contact of validRecipients) {
      const result = await sendTwilioSms(contact.phone, message);
      results.push({
        contact: contact.name,
        phone: contact.phone,
        message,
        ...result
      });
    }

    res.status(200).json({
      success: results.every(result => result.ok),
      simulated: results.every(result => result.simulated),
      message,
      results
    });
  } catch (err) {
    if (err.statusCode === 401 || err.statusCode === 403) {
      res.status(err.statusCode).json({ error: 'Unauthorized emergency request.' });
      return;
    }
    res.status(500).json({ error: 'Failed to process SOS alert.' });
  }
};
