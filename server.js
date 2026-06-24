// ============================================================================
// PanicSafe - Zero-Dependency Node.js Database Backend & Static File Server
// ============================================================================

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) return;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  });
}

loadEnvFile(path.join(__dirname, '.env'));

const PORT = 3000;
const DB_FILE = path.join(__dirname, 'contacts.json');
const STATIC_DIR = __dirname;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER || '';
const SMS_DEFAULT_COUNTRY_CODE = process.env.SMS_DEFAULT_COUNTRY_CODE || '';
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:alerts@panicsafe.app';

// Start with no contacts; users add their own trusted contacts.
const DEFAULT_CONTACTS = [];

// Helper: Ensure contacts database exists
function initDatabase() {
  if (!fs.existsSync(DB_FILE)) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_CONTACTS, null, 2), 'utf8');
      console.log('[Database] Created initial empty contacts.json.');
    } catch (err) {
      console.error('[Database] Failed to write contacts.json:', err);
    }
  }
}

// Helper: Read contacts
function readDatabase() {
  try {
    initDatabase();
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('[Database] Error reading database, returning empty array:', err);
    return [];
  }
}

// Helper: Write contacts
function writeDatabase(contacts) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(contacts, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[Database] Error writing to database:', err);
    return false;
  }
}

// Helper: Parse JSON POST bodies
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        if (!body) {
          resolve({});
        } else {
          resolve(JSON.parse(body));
        }
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', (err) => {
      reject(err);
    });
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

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

async function sendWebPushAlert(subscriptions, notification) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return {
      success: false,
      error: 'VAPID keys are not configured.'
    };
  }

  let webpush;
  try {
    webpush = require('web-push');
  } catch (err) {
    return {
      success: false,
      error: 'Install dependencies with npm install before using push locally.'
    };
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  const payload = JSON.stringify(notification);
  const results = await Promise.allSettled(
    subscriptions.map(subscription => webpush.sendNotification(subscription, payload))
  );

  return {
    success: results.some(result => result.status === 'fulfilled'),
    results: results.map(result => ({
      ok: result.status === 'fulfilled',
      reason: result.status === 'rejected' ? result.reason?.message : undefined
    }))
  };
}

// Server Request Router
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  console.log(`[HTTP] ${method} ${pathname}`);

  // --- API ROUTING ENGINE ---
  if (pathname === '/api/contacts') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*'); // Enable CORS for development
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle pre-flight requests
    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // GET /api/contacts -> Read
    if (method === 'GET') {
      const contacts = readDatabase();
      res.writeHead(200);
      res.end(JSON.stringify(contacts));
      return;
    }

    // POST /api/contacts -> Create
    if (method === 'POST') {
      try {
        const payload = await parseJsonBody(req);
        if (!payload.name || !payload.phone || !payload.relation) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Name, phone, and relation are required.' }));
          return;
        }

        const contacts = readDatabase();
        const newContact = {
          id: payload.id || Date.now().toString(),
          name: payload.name.trim(),
          phone: payload.phone.trim(),
          relation: payload.relation.trim()
        };

        contacts.push(newContact);
        if (writeDatabase(contacts)) {
          res.writeHead(201);
          res.end(JSON.stringify(newContact));
        } else {
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to write contact database.' }));
        }
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Malformed JSON payload.' }));
      }
      return;
    }

    // DELETE /api/contacts?id=<id> -> Delete
    if (method === 'DELETE') {
      const id = parsedUrl.query.id;
      if (!id) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Contact ID is required.' }));
        return;
      }

      let contacts = readDatabase();
      const initialCount = contacts.length;
      contacts = contacts.filter(c => c.id !== id);

      if (contacts.length === initialCount) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Contact not found.' }));
        return;
      }

      if (writeDatabase(contacts)) {
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: 'Contact removed successfully.' }));
      } else {
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to write database.' }));
      }
      return;
    }

    // Route not allowed
    res.writeHead(405);
    res.end(JSON.stringify({ error: 'Method not allowed.' }));
    return;
  }

  if (pathname === '/api/sos-alert') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed.' });
      return;
    }

    try {
      const payload = await parseJsonBody(req);
      const contacts = Array.isArray(payload.contacts) && payload.contacts.length > 0
        ? payload.contacts
        : readDatabase();
      const validRecipients = contacts
        .map(contact => ({
          name: String(contact.name || 'Emergency contact').trim(),
          phone: normalizeSmsPhone(contact.phone)
        }))
        .filter(contact => contact.phone);

      if (validRecipients.length === 0) {
        sendJson(res, 400, { error: 'No emergency contacts with phone numbers available.' });
        return;
      }

      const message = buildSosMessage(payload);
      const results = [];

      for (const contact of validRecipients) {
        const result = await sendTwilioSms(contact.phone, message);
        const status = result.ok ? (result.simulated ? 'prepared' : 'sent') : 'failed';
        console.log(`[SOS] SMS ${status} for ${contact.name} (${contact.phone}): ${message}`);
        results.push({
          contact: contact.name,
          phone: contact.phone,
          message,
          ...result
        });
      }

      sendJson(res, 200, {
        success: results.every(result => result.ok),
        simulated: results.every(result => result.simulated),
        message,
        results
      });
    } catch (err) {
      console.error('[SOS] Failed to process alert:', err);
      sendJson(res, 500, { error: 'Failed to process SOS alert.' });
    }
    return;
  }

  if (pathname === '/api/push-config') {
    if (method !== 'GET') {
      sendJson(res, 405, { error: 'Method not allowed.' });
      return;
    }

    sendJson(res, 200, { vapidPublicKey: VAPID_PUBLIC_KEY });
    return;
  }

  if (pathname === '/api/send-push-alert') {
    if (method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed.' });
      return;
    }

    try {
      const payload = await parseJsonBody(req);
      const subscriptions = Array.isArray(payload.subscriptions) ? payload.subscriptions : [];
      if (subscriptions.length === 0) {
        sendJson(res, 400, { error: 'No push subscriptions provided.' });
        return;
      }

      const result = await sendWebPushAlert(subscriptions, {
        title: payload.title || 'PanicSafe Alert',
        body: payload.body || 'A connected PanicSafe user needs attention.',
        icon: '/assets/icon-192.png',
        badge: '/assets/icon-192.png',
        tag: 'panicsafe-connected-alert',
        data: {
          url: '/',
          ...(payload.data || {})
        }
      });
      sendJson(res, result.success ? 200 : 500, result);
    } catch (err) {
      console.error('[Push] Failed to process alert:', err);
      sendJson(res, 500, { error: 'Failed to process push alert.' });
    }
    return;
  }

  // --- STATIC FILES ROUTING ---
  if (method === 'GET') {
    // Map URL path to filesystem path
    let relativeFilePath = pathname === '/' ? 'index.html' : pathname;
    // Prevent directory traversal attacks
    relativeFilePath = path.normalize(relativeFilePath).replace(/^(\.\.[\/\\])+/, '');
    const absoluteFilePath = path.join(STATIC_DIR, relativeFilePath);

    fs.stat(absoluteFilePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found - PanicSafe Webapp File Not Located');
        return;
      }

      // Detect MIME Type
      const ext = path.extname(absoluteFilePath).toLowerCase();
      let mimeType = 'text/plain';
      if (ext === '.html') mimeType = 'text/html';
      else if (ext === '.css') mimeType = 'text/css';
      else if (ext === '.js') mimeType = 'text/javascript';
      else if (ext === '.json') mimeType = 'application/json';
      else if (ext === '.webmanifest') mimeType = 'application/manifest+json';
      else if (ext === '.svg') mimeType = 'image/svg+xml';
      else if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.jpg') mimeType = 'image/jpeg';
      else if (ext === '.ico') mimeType = 'image/x-icon';

      // Serve file
      res.writeHead(200, { 'Content-Type': mimeType });
      const stream = fs.createReadStream(absoluteFilePath);
      stream.pipe(res);
    });
    return;
  }

  // Unsupported fallback request
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Path Not Supported');
});

// Start Server
initDatabase();
server.listen(PORT, () => {
  console.log('====================================================');
  console.log(`PanicSafe Server is online!`);
  console.log(`Open in browser: http://localhost:${PORT}`);
  console.log('====================================================');
});
