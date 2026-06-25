const crypto = require('crypto');
const https = require('https');

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'panicsafe';
const CERT_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let cachedCerts = null;
let certsExpireAt = 0;

function base64UrlDecode(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  return Buffer.from(padded, 'base64');
}

function parseJwt(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) {
    throw Object.assign(new Error('Malformed token.'), { statusCode: 401 });
  }

  return {
    header: JSON.parse(base64UrlDecode(parts[0]).toString('utf8')),
    payload: JSON.parse(base64UrlDecode(parts[1]).toString('utf8')),
    signature: parts[2],
    signedContent: `${parts[0]}.${parts[1]}`
  };
}

function fetchCerts() {
  return new Promise((resolve, reject) => {
    https.get(CERT_URL, (response) => {
      let data = '';
      response.on('data', chunk => {
        data += chunk.toString();
      });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Firebase cert fetch failed with ${response.statusCode}.`));
          return;
        }

        const cacheControl = response.headers['cache-control'] || '';
        const maxAgeMatch = /max-age=(\d+)/i.exec(cacheControl);
        const maxAgeMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 60 * 60 * 1000;
        cachedCerts = JSON.parse(data);
        certsExpireAt = Date.now() + maxAgeMs;
        resolve(cachedCerts);
      });
    }).on('error', reject);
  });
}

async function getCerts() {
  if (cachedCerts && Date.now() < certsExpireAt) {
    return cachedCerts;
  }
  return fetchCerts();
}

async function verifyFirebaseIdToken(token) {
  const { header, payload, signature, signedContent } = parseJwt(token);

  if (header.alg !== 'RS256' || !header.kid) {
    throw Object.assign(new Error('Invalid token header.'), { statusCode: 401 });
  }

  const certs = await getCerts();
  const cert = certs[header.kid];
  if (!cert) {
    throw Object.assign(new Error('Unknown token key.'), { statusCode: 401 });
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(signedContent);
  verifier.end();

  const validSignature = verifier.verify(cert, base64UrlDecode(signature));
  if (!validSignature) {
    throw Object.assign(new Error('Invalid token signature.'), { statusCode: 401 });
  }

  const now = Math.floor(Date.now() / 1000);
  const issuer = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;

  if (payload.aud !== FIREBASE_PROJECT_ID || payload.iss !== issuer) {
    throw Object.assign(new Error('Invalid token issuer or audience.'), { statusCode: 401 });
  }
  if (!payload.sub || typeof payload.sub !== 'string') {
    throw Object.assign(new Error('Missing token subject.'), { statusCode: 401 });
  }
  if (Number(payload.exp || 0) <= now || Number(payload.iat || 0) > now + 300) {
    throw Object.assign(new Error('Expired token.'), { statusCode: 401 });
  }

  return {
    uid: payload.sub,
    email: payload.email || '',
    name: payload.name || ''
  };
}

async function verifyFirebaseRequest(req) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(String(authHeader));
  if (!match) {
    throw Object.assign(new Error('Missing authorization token.'), { statusCode: 401 });
  }
  return verifyFirebaseIdToken(match[1]);
}

module.exports = {
  verifyFirebaseIdToken,
  verifyFirebaseRequest
};
