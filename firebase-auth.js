import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  deleteUser,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  deleteDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  serverTimestamp,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCEUJrm_61tB_1g2Z72oiDktZDsSTdbNW0',
  authDomain: 'panicsafe.firebaseapp.com',
  projectId: 'panicsafe',
  storageBucket: 'panicsafe.firebasestorage.app',
  messagingSenderId: '42229487342',
  appId: '1:42229487342:web:437693bfcc7c98005d45ff',
  measurementId: 'G-5QKP6NMB7B'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
const seenAlertIds = new Set();
const CONNECT_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

function toAuthUser(user) {
  if (!user) return null;

  return {
    provider: 'firebase-google',
    id: user.uid,
    uid: user.uid,
    name: user.displayName || '',
    email: user.email || '',
    picture: user.photoURL || '',
    signedInAt: new Date().toISOString()
  };
}

function getLegacyConnectionCode(uid) {
  return String(uid || '').slice(0, 8).toUpperCase();
}

function normalizeConnectionCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function formatConnectionCode(value) {
  const normalized = normalizeConnectionCode(value);
  return normalized.match(/.{1,4}/g)?.join('-') || '';
}

function generateConnectionCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map(byte => CONNECT_CODE_ALPHABET[byte % CONNECT_CODE_ALPHABET.length])
    .join('');
}

function needsSecureConnectionCode(profile, uid) {
  const code = normalizeConnectionCode(profile?.connectionCode);
  return !profile?.connectionCodeSecure || code.length < 12 || code === getLegacyConnectionCode(uid);
}

function getConnectionCode(value) {
  return formatConnectionCode(value);
}

function subscriptionId(endpoint) {
  return btoa(endpoint)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
    .slice(0, 180);
}

async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return toAuthUser(result.user);
  } catch (err) {
    if (err.code === 'auth/popup-blocked') {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    throw err;
  }
}

async function loadUserProfile(uid = auth.currentUser?.uid) {
  if (!uid) return null;

  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

async function saveUserProfile(profile) {
  const user = auth.currentUser;
  if (!user) throw new Error('No Firebase user is signed in.');

  const existingProfile = await loadUserProfile(user.uid);
  const previousCode = normalizeConnectionCode(existingProfile?.connectionCode);
  const connectionCode = needsSecureConnectionCode(existingProfile, user.uid)
    ? generateConnectionCode()
    : previousCode;

  const payload = {
    ...profile,
    uid: user.uid,
    email: profile.email || user.email || '',
    emailLower: String(profile.email || user.email || '').toLowerCase(),
    fullNameLower: String(profile.fullName || user.displayName || '').toLowerCase(),
    connectionCode,
    connectionCodeSecure: true,
    authProvider: 'google',
    updatedAt: serverTimestamp()
  };

  await setDoc(doc(db, 'users', user.uid), payload, { merge: true });
  await setDoc(doc(db, 'connectCodes', connectionCode), {
    uid: user.uid,
    fullName: payload.fullName || user.displayName || '',
    connectionCode: payload.connectionCode,
    updatedAt: serverTimestamp()
  }, { merge: true });

  if (previousCode && previousCode !== connectionCode) {
    await deleteDoc(doc(db, 'connectCodes', previousCode)).catch(() => {});
  }
  await deleteDoc(doc(db, 'publicProfiles', user.uid)).catch(() => {});

  return {
    ...payload,
    updatedAt: new Date().toISOString()
  };
}

async function ensureSecureUserProfile(profile) {
  if (!profile || !auth.currentUser) return profile;
  if (!needsSecureConnectionCode(profile, auth.currentUser.uid)) return profile;
  return saveUserProfile(profile);
}

async function findConnectionProfile(identifier) {
  const code = normalizeConnectionCode(identifier);
  if (!code) return null;

  const snap = await getDoc(doc(db, 'connectCodes', code));
  return snap.exists() ? snap.data() : null;
}

async function saveConnection(targetProfile) {
  const user = auth.currentUser;
  if (!user) throw new Error('No Firebase user is signed in.');
  if (!targetProfile || !targetProfile.uid) throw new Error('Connected profile not found.');

  const currentProfile = await loadUserProfile(user.uid);

  await setDoc(doc(db, 'users', user.uid, 'connections', targetProfile.uid), {
    uid: targetProfile.uid,
    fullName: targetProfile.fullName || 'PanicSafe user',
    connectionCode: targetProfile.connectionCode || '',
    connectedAt: serverTimestamp()
  }, { merge: true });

  await setDoc(doc(db, 'users', targetProfile.uid, 'connections', user.uid), {
    uid: user.uid,
    fullName: currentProfile?.fullName || user.displayName || 'PanicSafe user',
    connectionCode: currentProfile?.connectionCode || '',
    connectedAt: serverTimestamp()
  }, { merge: true });
}

async function loadConnections() {
  const user = auth.currentUser;
  if (!user) return [];

  const snapshot = await getDocs(collection(db, 'users', user.uid, 'connections'));
  return snapshot.docs.map(connectionDoc => connectionDoc.data());
}

async function savePushSubscription(subscription) {
  const user = auth.currentUser;
  if (!user || !subscription) return;

  const json = subscription.toJSON();
  const id = subscriptionId(json.endpoint);

  await setDoc(doc(db, 'users', user.uid, 'pushSubscriptions', id), {
    ...json,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function loadPushSubscriptionsForUser(uid) {
  if (!uid) return [];

  const snapshot = await getDocs(collection(db, 'users', uid, 'pushSubscriptions'));
  return snapshot.docs.map(subscriptionDoc => subscriptionDoc.data());
}

async function sendUserAlert(recipientUid, alert) {
  const user = auth.currentUser;
  if (!user) throw new Error('No Firebase user is signed in.');
  if (!recipientUid) throw new Error('Missing connected user.');

  return addDoc(collection(db, 'users', recipientUid, 'alerts'), {
    ...alert,
    senderUid: user.uid,
    createdAtMs: Date.now(),
    createdAt: serverTimestamp(),
    status: 'new'
  });
}

function listenForIncomingAlerts(callback) {
  const user = auth.currentUser;
  if (!user) return () => {};

  const startedAt = Date.now();
  const alertsQuery = query(
    collection(db, 'users', user.uid, 'alerts'),
    orderBy('createdAtMs', 'desc'),
    limit(8)
  );

  return onSnapshot(
    alertsQuery,
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const alertId = change.doc.id;
        const alert = { id: alertId, ...change.doc.data() };
        if (seenAlertIds.has(alertId)) return;
        seenAlertIds.add(alertId);

        if (change.type === 'added' && Number(alert.createdAtMs || 0) >= startedAt - 5000) {
          callback(alert);
        }
      });
    },
    (err) => {
      callback({ type: 'listener_error', errorCode: err.code || 'unknown', errorMessage: err.message || 'Alert listener failed.' });
    }
  );
}

async function signOutUser() {
  await signOut(auth);
}

async function deleteCurrentUserAccount() {
  const user = auth.currentUser;
  if (!user) throw new Error('No Firebase user is signed in.');

  const uid = user.uid;
  const profile = await loadUserProfile(uid);
  const code = normalizeConnectionCode(profile?.connectionCode);
  const connections = await loadConnections();
  const batch = writeBatch(db);
  const subcollections = ['connections', 'pushSubscriptions', 'alerts'];

  for (const name of subcollections) {
    const snapshot = await getDocs(collection(db, 'users', uid, name));
    snapshot.docs.forEach((item) => {
      batch.delete(item.ref);
    });
  }

  connections.forEach((connection) => {
    if (connection.uid) {
      batch.delete(doc(db, 'users', connection.uid, 'connections', uid));
    }
  });

  if (code) {
    const connectCodeRef = doc(db, 'connectCodes', code);
    const connectCodeSnap = await getDoc(connectCodeRef);
    if (connectCodeSnap.exists() && connectCodeSnap.data().uid === uid) {
      batch.delete(connectCodeRef);
    }
  }
  batch.delete(doc(db, 'publicProfiles', uid));
  batch.delete(doc(db, 'users', uid));
  await batch.commit();

  try {
    await deleteUser(user);
    return { authDeleted: true };
  } catch (err) {
    if (err.code === 'auth/requires-recent-login') {
      await signOut(auth);
      return { authDeleted: false, requiresRecentLogin: true };
    }
    throw err;
  }
}

const ready = getRedirectResult(auth).catch((err) => {
  console.warn('Firebase redirect sign-in check failed:', err);
  return null;
});

window.PanicSafeFirebase = {
  auth,
  db,
  ready,
  signInWithGoogle,
  signOutUser,
  deleteCurrentUserAccount,
  loadUserProfile,
  saveUserProfile,
  ensureSecureUserProfile,
  findConnectionProfile,
  saveConnection,
  loadConnections,
  savePushSubscription,
  loadPushSubscriptionsForUser,
  sendUserAlert,
  listenForIncomingAlerts,
  getConnectionCode,
  onAuthStateChanged: (callback) => onAuthStateChanged(auth, user => callback(toAuthUser(user), user))
};
