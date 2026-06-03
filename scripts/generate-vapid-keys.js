const crypto = require('crypto');

function base64UrlToBuffer(value) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  return Buffer.from((value + padding).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function bufferToBase64Url(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1'
});

const publicJwk = publicKey.export({ format: 'jwk' });
const privateJwk = privateKey.export({ format: 'jwk' });
const publicKeyBytes = Buffer.concat([
  Buffer.from([0x04]),
  base64UrlToBuffer(publicJwk.x),
  base64UrlToBuffer(publicJwk.y)
]);
const privateKeyBytes = base64UrlToBuffer(privateJwk.d);

console.log('VAPID_PUBLIC_KEY=' + bufferToBase64Url(publicKeyBytes));
console.log('VAPID_PRIVATE_KEY=' + bufferToBase64Url(privateKeyBytes));
