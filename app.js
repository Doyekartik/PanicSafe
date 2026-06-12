// ============================================================================
// PanicSafe - Core Application Script (Upgraded Version)
// State Management, Live Leaflet Maps, Backend REST Sync, & Contact Import API
// ============================================================================

// --- Application State ---
const state = {
  monitoringState: 'IDLE', // IDLE, TIMER_ACTIVE, ALARM
  contacts: [],            // List of active emergency contacts
  connections: [],
  alertUnsubscribe: null,
  activeGuardianAlert: null,
  backendSync: false,      // Synchronized with server database (server.js)
  userName: localStorage.getItem('panic_safe_user_name') || '',
  authUser: JSON.parse(localStorage.getItem('panic_safe_auth_user') || 'null'),
  profile: JSON.parse(localStorage.getItem('panic_safe_profile') || 'null'),
  timer: {
    remainingSeconds: 0,
    totalSeconds: 0,
    intervalId: null,
    isDangerState: false,
    reminderSent: false
  },
  panicCountdown: {
    remaining: 3,
    intervalId: null
  },
  gps: {
    lat: 37.7749,
    lng: -122.4194,
    watchId: null,
    permissionState: 'prompt',
    hasDeviceFix: false
  },
  map: {
    instance: null,
    marker: null
  },
  audio: {
    ctx: null,
    oscillator1: null,
    oscillator2: null,
    gainNode: null,
    sirenIntervalId: null
  }
};

// --- Constant References ---
const STROKE_DASH_MAX = 640;     // SVG circle length (2 * PI * r = 2 * 3.14159 * 102)
const API_ENDPOINT = '/api/contacts';
const SOS_ALERT_ENDPOINT = '/api/sos-alert';
const PUSH_CONFIG_ENDPOINT = '/api/push-config';
const PUSH_ALERT_ENDPOINT = '/api/send-push-alert';

// --- DOM Elements ---
const DOM = {
  appMockup: document.getElementById('app-mockup'),
  authScreen: document.getElementById('auth-screen'),
  firebaseGoogleBtn: document.getElementById('firebase-google-btn'),
  authStatus: document.getElementById('auth-status'),
  profileScreen: document.getElementById('profile-screen'),
  profileForm: document.getElementById('profile-form'),
  profileLogoutBtn: document.getElementById('profile-logout-btn'),
  profileDeleteBtn: document.getElementById('profile-delete-btn'),
  profileBackBtn: document.getElementById('profile-back-btn'),
  profileFullName: document.getElementById('profile-full-name'),
  profileEmail: document.getElementById('profile-email'),
  profilePhone: document.getElementById('profile-phone'),
  profileHomeArea: document.getElementById('profile-home-area'),
  profileBloodGroup: document.getElementById('profile-blood-group'),
  profileAge: document.getElementById('profile-age'),
  profileHeight: document.getElementById('profile-height'),
  profileWeight: document.getElementById('profile-weight'),
  profileAllergies: document.getElementById('profile-allergies'),
  profileConditions: document.getElementById('profile-conditions'),
  profileMedications: document.getElementById('profile-medications'),
  profileDoctorName: document.getElementById('profile-doctor-name'),
  profileDoctorPhone: document.getElementById('profile-doctor-phone'),
  profileInsurance: document.getElementById('profile-insurance'),
  profileSafetyNote: document.getElementById('profile-safety-note'),
  profileConnectCode: document.getElementById('profile-connect-code'),
  connectUserInput: document.getElementById('connect-user-input'),
  connectUserBtn: document.getElementById('connect-user-btn'),
  connectedUsersList: document.getElementById('connected-users-list'),
  profileChip: document.getElementById('profile-chip'),
  profileChipInitials: document.getElementById('profile-chip-initials'),
  
  // Interactive Elements on Home View
  checkinBtn: document.getElementById('checkin-btn'),
  checkinLabel: document.getElementById('checkin-label'),
  timerProgress: document.getElementById('timer-progress'),
  timerQuickActions: document.getElementById('timer-quick-actions'),
  timerDisarmBtn: document.getElementById('timer-disarm-btn'),
  timerExtendBtn: document.getElementById('timer-extend-btn'),
  panicTriggerBtn: document.getElementById('panic-trigger-btn'),
  contactsTriggerBtn: document.getElementById('contacts-trigger-btn'),
  statusDashboardBtn: document.getElementById('status-dashboard-btn'),
  statusDashboardBtnMobile: document.getElementById('status-dashboard-btn-mobile'),
  
  // Collapsible Map View
  mapViewBoxContainer: document.getElementById('map-view-box-container'),
  
  // Overlay Backdrops & Special Screen Panels
  modalOverlay: document.getElementById('modal-overlay'),
  timerSetupSheet: document.getElementById('timer-setup-sheet'),
  contactsSetupSheet: document.getElementById('contacts-setup-sheet'),
  diagnosticsSheet: document.getElementById('diagnostics-sheet'),
  panicPreOverlay: document.getElementById('panic-pre-overlay'),
  alarmOverlay: document.getElementById('alarm-overlay'),
  guardianAlertOverlay: document.getElementById('guardian-alert-overlay'),
  guardianAlertName: document.getElementById('guardian-alert-name'),
  guardianAlertTime: document.getElementById('guardian-alert-time'),
  guardianAlertLocation: document.getElementById('guardian-alert-location'),
  guardianAlertMapLink: document.getElementById('guardian-alert-map-link'),
  guardianAlertCallLink: document.getElementById('guardian-alert-call-link'),
  guardianAlertHealthGrid: document.getElementById('guardian-alert-health-grid'),
  guardianAlertNote: document.getElementById('guardian-alert-note'),
  guardianAlertDismissBtn: document.getElementById('guardian-alert-dismiss-btn'),
  
  // Timer Setup Elements
  presetBtns: document.querySelectorAll('.preset-btn'),
  customTimerToggle: document.getElementById('custom-timer-toggle'),
  customTimeInputs: document.getElementById('custom-time-inputs'),
  timerPresets: document.querySelector('.timer-presets'),
  customHours: document.getElementById('custom-hours'),
  customMins: document.getElementById('custom-mins'),
  customSecs: document.getElementById('custom-secs'),
  startTimerBtn: document.getElementById('start-timer-btn'),
  alertUserName: document.getElementById('alert-user-name'),
  notificationPermissionBtn: document.getElementById('notification-permission-btn'),
  shakeDetectionToggleBtn: document.getElementById('shake-detection-toggle-btn'),
  vibrationPermissionBtn: document.getElementById('vibration-permission-btn'),
  
  // Contact Configuration Elements
  contactsScrollList: document.getElementById('contacts-scroll-list'),
  contactsEmptyState: document.getElementById('contacts-empty-state'),
  addContactForm: document.getElementById('add-contact-form'),
  importContactBtn: document.getElementById('import-contact-btn'),
  vcardImportInput: document.getElementById('vcard-import-input'),
  contactName: document.getElementById('contact-name'),
  contactPhone: document.getElementById('contact-phone'),
  contactRelation: document.getElementById('contact-relation'),
  
  // Diagnostics Dashboard Panel Elements
  diagStateVal: document.getElementById('diag-state-val'),
  diagContactsCount: document.getElementById('diag-contacts-count'),
  telemetryLat: document.getElementById('telemetry-lat'),
  telemetryLng: document.getElementById('telemetry-lng'),
  activityLogTerminal: document.getElementById('activity-log-terminal'),
  
  // SOS & Cancel Overlays
  panicCountdownVal: document.getElementById('panic-countdown-val'),
  panicCancelBtn: document.getElementById('panic-cancel-btn'),
  sosNotificationFeed: document.getElementById('sos-notification-feed'),
  disarmAlarmBtn: document.getElementById('disarm-alarm-btn'),
  
  // Toast
  toastBanner: document.getElementById('toast-banner'),
  toastMessage: document.getElementById('toast-message')
};

// ============================================================================
// INITIALIZATION & CORE BACKEND SYNCHRONIZER
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  preventMobilePageZoom();
  registerServiceWorker();
  setupIncomingAlertListeners();
  initializeAuthFlow();
  initializeLocationStatus();
  updateNotificationButton();
  updateShakeDetectionButton();
  updateTelemetryDisplay();
  hydrateProfileUI();
  hydrateGuardianAlertFromUrl();
  initializeDarkMode();
  await synchronizeWithBackend();
  logActivity('System initialized successfully. All checks secure.');
});

function preventMobilePageZoom() {
  let lastTouchEnd = 0;

  document.addEventListener('touchend', (event) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });

  document.addEventListener('gesturestart', (event) => {
    event.preventDefault();
  });
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(() => {
        logActivity('PWA offline shell registered.');
      })
      .catch((err) => {
        console.warn('Service worker registration failed:', err);
      });
  });
}

function notificationsSupported() {
  return ('Notification' in window && 'serviceWorker' in navigator);
}

function updateNotificationButton() {
  if (!DOM.notificationPermissionBtn) return;

  DOM.notificationPermissionBtn.classList.remove('enabled', 'blocked');

  if (!notificationsSupported()) {
    DOM.notificationPermissionBtn.textContent = 'Notifications unavailable';
    DOM.notificationPermissionBtn.disabled = true;
    return;
  }

  if (Notification.permission === 'granted') {
    DOM.notificationPermissionBtn.textContent = 'iPhone Notifications Enabled';
    DOM.notificationPermissionBtn.classList.add('enabled');
  } else if (Notification.permission === 'denied') {
    DOM.notificationPermissionBtn.textContent = 'Notifications Blocked in Settings';
    DOM.notificationPermissionBtn.classList.add('blocked');
  } else {
    DOM.notificationPermissionBtn.textContent = 'Enable iPhone Notifications';
  }
}

function updateShakeDetectionButton() {
  if (!DOM.shakeDetectionToggleBtn) return;

  DOM.shakeDetectionToggleBtn.classList.remove('enabled', 'blocked');

  if (!shakeDetectionSupported()) {
    DOM.shakeDetectionToggleBtn.textContent = 'Shake Detection Unavailable';
    DOM.shakeDetectionToggleBtn.disabled = true;
    return;
  }

  const permissionStatus = localStorage.getItem('motion_permission_status');
  
  if (permissionStatus === 'granted' && shakeDetectionState.permissionGranted) {
    DOM.shakeDetectionToggleBtn.textContent = 'Shake Detection Enabled';
    DOM.shakeDetectionToggleBtn.classList.add('enabled');
  } else if (permissionStatus === 'denied') {
    DOM.shakeDetectionToggleBtn.textContent = 'Shake Detection Blocked';
    DOM.shakeDetectionToggleBtn.classList.add('blocked');
  } else {
    DOM.shakeDetectionToggleBtn.textContent = 'Enable Shake Detection';
  }
}

function shakeDetectionSupported() {
  return ('DeviceMotionEvent' in window);
}

async function requestNotificationPermission() {
  if (!notificationsSupported()) {
    showToast('Notifications need the installed iPhone web app on iOS 16.4+.', 'info');
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    updateNotificationButton();

    if (permission === 'granted') {
      logActivity('Notification permission granted.');
      showToast('Notifications enabled.', 'success');
      await registerRemotePushSubscription();
      showPanicSafeNotification(
        'PanicSafe notifications enabled',
        'You will get a notification when a safety timer expires.',
        'panicsafe-test'
      );
    } else {
      logActivity(`Notification permission ${permission}.`);
      showToast('Notifications were not enabled.', 'info');
    }
  } catch (err) {
    console.warn('Notification permission request failed:', err);
    showToast('Could not enable notifications on this device.', 'info');
  }
}

async function registerRemotePushSubscription() {
  if (!state.authUser || !window.PanicSafeFirebase) {
    logActivity('Remote push subscription skipped until Firebase sign-in completes.');
    return false;
  }

  if (!('PushManager' in window)) {
    logActivity('Remote Web Push unavailable on this browser.');
    return false;
  }

  try {
    const response = await fetch(PUSH_CONFIG_ENDPOINT, { signal: AbortSignal.timeout(2500) });
    const config = response.ok ? await response.json() : {};
    if (!config.vapidPublicKey) {
      logActivity('Remote push not configured. Add VAPID keys on Vercel.');
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing || await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey)
    });

    await window.PanicSafeFirebase.savePushSubscription(subscription);
    logActivity('Remote push subscription saved to Firebase profile.');
    return true;
  } catch (err) {
    console.warn('Remote push registration failed:', err);
    logActivity('Remote push registration failed. Local notifications still work.');
    return false;
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

async function showPanicSafeNotification(title, body, tag = 'panicsafe-alert') {
  if (!notificationsSupported() || Notification.permission !== 'granted') {
    return false;
  }

  const options = {
    body,
    icon: '/assets/icon-192.png',
    badge: '/assets/icon-192.png',
    tag,
    renotify: true,
    requireInteraction: true,
    data: {
      url: '/'
    }
  };

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, options);
    return true;
  } catch (err) {
    try {
      new Notification(title, options);
      return true;
    } catch (fallbackErr) {
      console.warn('Notification display failed:', err, fallbackErr);
      return false;
    }
  }
}

function setupIncomingAlertListeners() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'PANICSAFE_CONNECTED_ALERT') {
        showGuardianAlertScreen(event.data.alert, 'push');
      }
    });
  }

  window.addEventListener('storage', (event) => {
    if (event.key !== 'panic_safe_latest_guardian_alert' || !event.newValue) return;
    try {
      showGuardianAlertScreen(JSON.parse(event.newValue), 'storage');
    } catch (err) {
      console.warn('Could not parse stored guardian alert:', err);
    }
  });
}

function hydrateGuardianAlertFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const encodedAlert = params.get('guardianAlert');
  if (!encodedAlert) return;

  try {
    const alert = JSON.parse(decodeURIComponent(encodedAlert));
    showGuardianAlertScreen(alert, 'url');
    window.history.replaceState({}, document.title, window.location.pathname);
  } catch (err) {
    console.warn('Could not load guardian alert from notification URL:', err);
  }
}

async function initializeAuthFlow() {
  renderAccountState();

  try {
    await waitForFirebaseAuth();
    await window.PanicSafeFirebase.ready;
    window.PanicSafeFirebase.onAuthStateChanged(handleFirebaseAuthState);
    DOM.authStatus.textContent = 'Use Google to create your Firebase account.';
  } catch (err) {
    console.warn('Firebase auth initialization failed:', err);
    DOM.authStatus.textContent = 'Firebase Auth could not load. Check your network and Firebase setup.';
  }
}

function waitForFirebaseAuth() {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const timerId = setInterval(() => {
      attempts++;
      if (window.PanicSafeFirebase) {
        clearInterval(timerId);
        resolve();
      } else if (attempts > 40) {
        clearInterval(timerId);
        reject(new Error('Firebase Auth module did not load'));
      }
    }, 100);
  });
}

async function signInWithFirebaseGoogle() {
  try {
    DOM.authStatus.textContent = 'Opening Google sign-in...';
    await waitForFirebaseAuth();
    await window.PanicSafeFirebase.signInWithGoogle();
  } catch (err) {
    console.error('Firebase Google sign-in failed:', err);
    const message = getFirebaseAuthErrorMessage(err);
    DOM.authStatus.textContent = message;
    showToast(message, 'info');
  }
}

async function signOutFromPanicSafe() {
  try {
    await waitForFirebaseAuth();
    if (window.PanicSafeFirebase?.signOutUser) {
      await window.PanicSafeFirebase.signOutUser();
    }
  } catch (err) {
    console.warn('Firebase sign-out failed:', err);
  } finally {
    stopIncomingFirestoreAlerts();
    state.authUser = null;
    state.profile = null;
    state.connections = [];
    state.userName = '';
    localStorage.removeItem('panic_safe_auth_user');
    localStorage.removeItem('panic_safe_profile');
    localStorage.removeItem('panic_safe_user_name');
    renderConnections();
    updateProfileChip();
    renderAccountState();
    DOM.authStatus.textContent = 'Signed out. Continue with Google to log in.';
    showToast('Logged out.', 'success');
  }
}

async function deletePanicSafeAccount() {
  const confirmed = window.confirm(
    'Delete this PanicSafe account and remove your profile, medical details, connections, alerts, and notification subscriptions from Firebase? This cannot be undone.'
  );
  if (!confirmed) return;

  DOM.profileDeleteBtn.disabled = true;
  DOM.profileDeleteBtn.textContent = 'Deleting...';

  try {
    await waitForFirebaseAuth();
    await unsubscribeRemotePushSubscription();
    const result = await window.PanicSafeFirebase.deleteCurrentUserAccount();
    clearLocalAccountState();

    if (result.requiresRecentLogin) {
      DOM.authStatus.textContent = 'Database details deleted. Sign in again to finish deleting the Firebase login account.';
      showToast('Database details deleted. Sign in again to finish auth deletion.', 'info');
    } else {
      DOM.authStatus.textContent = 'Account deleted. Continue with Google to create a new account.';
      showToast('Account deleted.', 'success');
    }
  } catch (err) {
    console.error('Delete account failed:', err);
    showToast(`Delete failed: ${err.code || err.message}`, 'info');
  } finally {
    DOM.profileDeleteBtn.disabled = false;
    DOM.profileDeleteBtn.textContent = 'Delete Account';
  }
}

async function unsubscribeRemotePushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }
  } catch (err) {
    console.warn('Could not unsubscribe push subscription:', err);
  }
}

function clearLocalAccountState() {
  stopIncomingFirestoreAlerts();
  state.authUser = null;
  state.profile = null;
  state.connections = [];
  state.userName = '';
  localStorage.removeItem('panic_safe_auth_user');
  localStorage.removeItem('panic_safe_profile');
  localStorage.removeItem('panic_safe_user_name');
  localStorage.removeItem('panic_safe_latest_guardian_alert');
  renderConnections();
  updateProfileChip();
  dismissGuardianAlert();
  renderAccountState();
}

function getFirebaseAuthErrorMessage(err) {
  const code = err && err.code ? err.code : 'unknown';

  const messages = {
    'auth/unauthorized-domain': 'Firebase blocked this domain. Add this exact domain in Authentication > Settings > Authorized domains.',
    'auth/operation-not-allowed': 'Google sign-in is not enabled. Enable Google in Authentication > Sign-in method.',
    'auth/invalid-api-key': 'Firebase API key is invalid. Re-copy the Firebase web app config.',
    'auth/app-not-authorized': 'This app is not authorized for Firebase Auth. Check your Firebase web app config.',
    'auth/popup-blocked': 'The Google popup was blocked. Allow popups or try redirect sign-in.',
    'auth/popup-closed-by-user': 'The Google sign-in popup was closed before login finished.',
    'auth/network-request-failed': 'Firebase network request failed. Check internet connection and ad blockers.',
    'auth/internal-error': 'Firebase Auth internal error. Check that Google provider is saved and the domain is authorized.'
  };

  return `${messages[code] || 'Google sign-in failed. Check Firebase setup.'} (${code})`;
}

async function handleFirebaseAuthState(authUser) {
  if (!authUser) {
    stopIncomingFirestoreAlerts();
    state.authUser = null;
    state.profile = null;
    localStorage.removeItem('panic_safe_auth_user');
    localStorage.removeItem('panic_safe_profile');
    renderAccountState();
    return;
  }

  saveAuthUser(authUser);
  startIncomingFirestoreAlerts();
  if (Notification.permission === 'granted') {
    registerRemotePushSubscription();
  }

  try {
    let remoteProfile = await window.PanicSafeFirebase.loadUserProfile(authUser.uid);
    if (remoteProfile) {
      remoteProfile = await window.PanicSafeFirebase.ensureSecureUserProfile(remoteProfile);
      state.profile = remoteProfile;
      localStorage.setItem('panic_safe_profile', JSON.stringify(remoteProfile));
      hydrateProfileUI();
      renderAccountState();
      refreshConnectionsUI();
      logActivity('Loaded Firebase profile from Firestore.');
    }
  } catch (err) {
    console.warn('Could not load Firestore profile:', err);
    showToast('Signed in, but profile sync needs Firestore rules.', 'info');
  }
}

function startIncomingFirestoreAlerts() {
  if (!window.PanicSafeFirebase?.listenForIncomingAlerts || state.alertUnsubscribe) return;

  state.alertUnsubscribe = window.PanicSafeFirebase.listenForIncomingAlerts((alert) => {
    if (alert.type === 'listener_error') {
      console.warn('Incoming alert listener failed:', alert.errorCode, alert.errorMessage);
      logActivity(`Connected-user alert listener failed: ${alert.errorCode}`);
      showToast(`Connected alerts blocked: ${alert.errorCode}`, 'info');
      return;
    }
    showGuardianAlertScreen(alert, 'firestore');
  });
  logActivity('Connected-user alert listener active.');
}

function stopIncomingFirestoreAlerts() {
  if (typeof state.alertUnsubscribe === 'function') {
    state.alertUnsubscribe();
  }
  state.alertUnsubscribe = null;
}

function saveAuthUser(authUser) {
  state.authUser = authUser;
  localStorage.setItem('panic_safe_auth_user', JSON.stringify(authUser));
  hydrateProfileUI();
  renderAccountState();
}

function hydrateProfileUI() {
  const profile = state.profile || {};
  const authUser = state.authUser || {};

  DOM.profileFullName.value = profile.fullName || authUser.name || '';
  DOM.profileEmail.value = profile.email || authUser.email || '';
  DOM.profilePhone.value = profile.phone || '';
  DOM.profileHomeArea.value = profile.homeArea || '';
  DOM.profileBloodGroup.value = profile.bloodGroup || '';
  DOM.profileAge.value = profile.age || '';
  DOM.profileHeight.value = profile.height || '';
  DOM.profileWeight.value = profile.weight || '';
  DOM.profileAllergies.value = profile.allergies || '';
  DOM.profileConditions.value = profile.conditions || '';
  DOM.profileMedications.value = profile.medications || '';
  DOM.profileDoctorName.value = profile.doctorName || '';
  DOM.profileDoctorPhone.value = profile.doctorPhone || '';
  DOM.profileInsurance.value = profile.insurance || '';
  DOM.profileSafetyNote.value = profile.safetyNote || '';
  DOM.profileConnectCode.value = state.authUser?.uid
    ? window.PanicSafeFirebase?.getConnectionCode(profile.connectionCode) || ''
    : '';

  state.userName = profile.fullName || authUser.name || state.userName || '';
  DOM.alertUserName.value = state.userName;
  updateProfileChip();
  renderConnections();
}

async function saveProfile(event) {
  event.preventDefault();

  const profile = {
    fullName: DOM.profileFullName.value.trim(),
    email: DOM.profileEmail.value.trim(),
    phone: DOM.profilePhone.value.trim(),
    homeArea: DOM.profileHomeArea.value.trim(),
    bloodGroup: DOM.profileBloodGroup.value,
    age: DOM.profileAge.value.trim(),
    height: DOM.profileHeight.value.trim(),
    weight: DOM.profileWeight.value.trim(),
    allergies: DOM.profileAllergies.value.trim(),
    conditions: DOM.profileConditions.value.trim(),
    medications: DOM.profileMedications.value.trim(),
    doctorName: DOM.profileDoctorName.value.trim(),
    doctorPhone: DOM.profileDoctorPhone.value.trim(),
    insurance: DOM.profileInsurance.value.trim(),
    safetyNote: DOM.profileSafetyNote.value.trim(),
    updatedAt: new Date().toISOString()
  };

  if (!profile.fullName || !profile.phone) {
    showToast('Add your name and phone number to save profile.', 'info');
    return;
  }

  try {
    await waitForFirebaseAuth();
    const savedProfile = await window.PanicSafeFirebase.saveUserProfile(profile);
    state.profile = {
      ...profile,
      ...savedProfile
    };
    showToast('Profile saved to Firebase.', 'success');
  } catch (err) {
    console.error('Firebase profile save failed:', err);
    state.profile = profile;
    showToast('Profile saved on this device. Check Firestore setup to sync.', 'info');
  }

  state.userName = state.profile.fullName;
  localStorage.setItem('panic_safe_profile', JSON.stringify(state.profile));
  localStorage.setItem('panic_safe_user_name', state.profile.fullName);
  DOM.alertUserName.value = state.profile.fullName;
  renderAccountState();
  updateProfileChip();
  refreshConnectionsUI();
  logActivity(`Profile saved for ${state.profile.fullName}.`);
}

function renderAccountState() {
  if (!state.authUser) {
    DOM.authScreen.classList.add('visible');
    DOM.profileScreen.classList.remove('visible');
    return;
  }

  DOM.authScreen.classList.remove('visible');
  if (!state.profile) {
    DOM.profileScreen.classList.add('visible');
  } else {
    DOM.profileScreen.classList.remove('visible');
  }
}

function openProfileEditor() {
  if (!state.authUser) {
    DOM.authScreen.classList.add('visible');
    return;
  }

  hydrateProfileUI();
  DOM.profileScreen.classList.add('visible');
  refreshConnectionsUI();
}

function closeProfileEditor() {
  if (!state.profile) {
    showToast('Save your profile before continuing.', 'info');
    return;
  }

  DOM.profileScreen.classList.remove('visible');
}

function updateProfileChip() {
  const name = state.profile?.fullName || state.authUser?.name || 'PanicSafe';
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toUpperCase())
    .join('') || 'PS';

  DOM.profileChipInitials.textContent = initials;
}

async function connectPanicSafeUser() {
  const identifier = DOM.connectUserInput.value.trim();
  if (!identifier) {
    showToast('Enter a PanicSafe connect code.', 'info');
    return;
  }

  try {
    await waitForFirebaseAuth();
    const targetProfile = await window.PanicSafeFirebase.findConnectionProfile(identifier);
    if (!targetProfile) {
      showToast('No PanicSafe user found for that connect code.', 'info');
      return;
    }
    if (targetProfile.uid === state.authUser?.uid) {
      showToast('That is your own PanicSafe profile.', 'info');
      return;
    }

    await window.PanicSafeFirebase.saveConnection(targetProfile);
    DOM.connectUserInput.value = '';
    await refreshConnectionsUI();
    showToast(`${targetProfile.fullName || 'User'} connected.`, 'success');
  } catch (err) {
    console.error('Could not connect PanicSafe user:', err);
    const code = err && err.code ? err.code : 'unknown';
    showToast(`Could not connect user. Firestore: ${code}`, 'info');
  }
}

async function refreshConnectionsUI() {
  if (!state.authUser || !window.PanicSafeFirebase) {
    state.connections = [];
    renderConnections();
    return;
  }

  try {
    state.connections = await window.PanicSafeFirebase.loadConnections();
  } catch (err) {
    console.warn('Could not load connections:', err);
    state.connections = [];
  }
  renderConnections();
}

function renderConnections() {
  if (!DOM.connectedUsersList) return;

  DOM.connectedUsersList.innerHTML = '';
  if (!state.connections.length) {
    DOM.connectedUsersList.innerHTML = '<div class="contacts-empty">No connected PanicSafe users yet.</div>';
    return;
  }

  state.connections.forEach((connection) => {
    const item = document.createElement('div');
    item.className = 'connected-user-item';
    item.innerHTML = `
      <div>
        <div class="connected-user-name">${escapeHTML(connection.fullName || 'PanicSafe user')}</div>
        <div class="connected-user-meta">${escapeHTML(window.PanicSafeFirebase?.getConnectionCode(connection.connectionCode) || 'Connected')}</div>
      </div>
      <span class="indicator-dot"></span>
    `;
    DOM.connectedUsersList.appendChild(item);
  });
}

function buildGuardianAlertPayload(userName, triggerSource = 'Timer Expiration') {
  const profile = state.profile || {};
  const lat = Number(state.gps.lat);
  const lng = Number(state.gps.lng);
  const mapsUrl = Number.isFinite(lat) && Number.isFinite(lng)
    ? `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`
    : '';
  const normalizedUser = userName || profile.fullName || 'PanicSafe user';
  const isTimer = String(triggerSource).toLowerCase().includes('timer');
  const type = isTimer ? 'timer_expired' : 'panic_triggered';
  const message = isTimer
    ? `${normalizedUser} is not responding to the PanicSafe timer.`
    : `${normalizedUser} has triggered an immediate PanicSafe SOS alert.`;

  return {
    type,
    senderUid: state.authUser?.uid || '',
    senderName: normalizedUser,
    message,
    createdAtMs: Date.now(),
    triggerSource: String(triggerSource),
    location: {
      lat,
      lng,
      mapsUrl
    },
    profile: {
      fullName: profile.fullName || normalizedUser,
      phone: profile.phone || '',
      homeArea: profile.homeArea || '',
      bloodGroup: profile.bloodGroup || '',
      age: profile.age || '',
      height: profile.height || '',
      weight: profile.weight || '',
      allergies: profile.allergies || '',
      conditions: profile.conditions || '',
      medications: profile.medications || '',
      doctorName: profile.doctorName || '',
      doctorPhone: profile.doctorPhone || '',
      safetyNote: profile.safetyNote || ''
    }
  };
}

function showGuardianAlertScreen(alert, source = 'remote') {
  const normalized = normalizeGuardianAlert(alert);
  state.activeGuardianAlert = normalized;
  localStorage.setItem('panic_safe_latest_guardian_alert', JSON.stringify(normalized));

  if (!DOM.guardianAlertOverlay) return;

  const profile = normalized.profile || {};
  const location = normalized.location || {};
  const createdAt = normalized.createdAtMs
    ? new Date(normalized.createdAtMs)
    : new Date();

  DOM.guardianAlertName.textContent = `${normalized.senderName || profile.fullName || 'PanicSafe user'} is not responding`;
  DOM.guardianAlertTime.textContent = `Timer alert received ${createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  const hasLocation = Number.isFinite(Number(location.lat)) && Number.isFinite(Number(location.lng));
  DOM.guardianAlertLocation.textContent = hasLocation
    ? `${Number(location.lat).toFixed(5)}, ${Number(location.lng).toFixed(5)}`
    : 'Location unavailable';

  if (location.mapsUrl) {
    DOM.guardianAlertMapLink.href = location.mapsUrl;
    DOM.guardianAlertMapLink.classList.remove('disabled');
  } else {
    DOM.guardianAlertMapLink.href = '#';
    DOM.guardianAlertMapLink.classList.add('disabled');
  }

  if (profile.phone) {
    DOM.guardianAlertCallLink.href = `tel:${profile.phone}`;
    DOM.guardianAlertCallLink.classList.remove('disabled');
  } else {
    DOM.guardianAlertCallLink.href = '#';
    DOM.guardianAlertCallLink.classList.add('disabled');
  }

  const statRows = [
    ['Phone', profile.phone],
    ['Home Area', profile.homeArea],
    ['Blood Group', profile.bloodGroup],
    ['Age', profile.age],
    ['Height', profile.height],
    ['Weight', profile.weight],
    ['Allergies', profile.allergies],
    ['Conditions', profile.conditions],
    ['Medications', profile.medications],
    ['Doctor', [profile.doctorName, profile.doctorPhone].filter(Boolean).join(' - ')]
  ].filter(([, value]) => value);

  DOM.guardianAlertHealthGrid.innerHTML = statRows.length
    ? statRows.map(([label, value]) => `
        <div class="guardian-stat">
          <span>${escapeHTML(label)}</span>
          <strong>${escapeHTML(value)}</strong>
        </div>
      `).join('')
    : '<div class="guardian-empty">No medical details saved by this user.</div>';

  DOM.guardianAlertNote.textContent = profile.safetyNote || normalized.message || 'Check on this user immediately.';
  DOM.guardianAlertOverlay.classList.add('visible');
  DOM.profileScreen.classList.remove('visible');
  closeAllSheets();
  showToast('Connected user timer alert received.', 'info');
  logActivity(`Connected-user alert shown from ${source}.`);
}

function normalizeGuardianAlert(alert = {}) {
  const data = alert.data || {};
  const location = alert.location || data.location || {
    lat: data.lat,
    lng: data.lng,
    mapsUrl: data.mapsUrl
  };

  return {
    ...alert,
    senderUid: alert.senderUid || data.senderUid || '',
    senderName: alert.senderName || data.senderName || alert.title || 'PanicSafe user',
    message: alert.message || data.message || alert.body || 'A connected PanicSafe user is not responding to their timer.',
    createdAtMs: Number(alert.createdAtMs || data.createdAtMs || Date.now()),
    location,
    profile: alert.profile || data.profile || {}
  };
}

function dismissGuardianAlert() {
  if (!DOM.guardianAlertOverlay) return;
  DOM.guardianAlertOverlay.classList.remove('visible');
  state.activeGuardianAlert = null;
}

// Sync contacts list directly from server.js REST database, with localStorage fallback
async function synchronizeWithBackend() {
  try {
    const response = await fetch(API_ENDPOINT, { signal: AbortSignal.timeout(2000) });
    if (response.ok) {
      const data = await response.json();
      state.contacts = data;
      state.backendSync = true;
      logActivity('Synchronized with Server Database (Backend Online).');
    } else {
      throw new Error('Server returned error status');
    }
  } catch (err) {
    state.backendSync = false;
    logActivity('Server unreachable. Loaded Local Storage backup sandbox (Backend Offline).');
    
    // LocalStorage Fallback
    const stored = localStorage.getItem('panic_safe_contacts');
    if (stored) {
      try {
        state.contacts = JSON.parse(stored);
      } catch (e) {
        state.contacts = [];
      }
    } else {
      // Pre-fill initial defaults if clean load
      state.contacts = [
        { id: '1', name: 'Sarah Miller (Mom)', phone: '+1 (555) 0199', relation: 'Family' },
        { id: '2', name: 'David Chen', phone: '+1 (555) 0142', relation: 'Friend' }
      ];
      localStorage.setItem('panic_safe_contacts', JSON.stringify(state.contacts));
    }
  }
  updateContactsListUI();
}

function updateLocalBackup() {
  if (!state.backendSync) {
    localStorage.setItem('panic_safe_contacts', JSON.stringify(state.contacts));
  }
}

// ============================================================================
// INTERACTIVE AUDIO GENERATION (WEB AUDIO API SYNTHESIZER)
// ============================================================================
function initAudio() {
  if (!state.audio.ctx) {
    state.audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (state.audio.ctx.state === 'suspended') {
    state.audio.ctx.resume();
  }
}

function playChime(type) {
  try {
    initAudio();
    const ctx = state.audio.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    const now = ctx.currentTime;
    
    if (type === 'success') {
      // Arpeggio chime
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
      osc.frequency.setValueAtTime(1046.50, now + 0.3); // C6
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.start(now);
      osc.stop(now + 0.6);
    } else if (type === 'cancel') {
      // Low dual note
      osc.type = 'sine';
      osc.frequency.setValueAtTime(392.00, now); // G4
      osc.frequency.setValueAtTime(329.63, now + 0.15); // E4
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (type === 'tick') {
      // Short click
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.05, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.06);
    }
  } catch (e) {
    console.error('Audio synthesizer blocked/unsupported: ', e);
  }
}

function startSirenSound() {
  try {
    initAudio();
    const ctx = state.audio.ctx;
    
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc1.type = 'sawtooth';
    osc2.type = 'square';
    
    osc1.frequency.value = 600;
    osc2.frequency.value = 605;
    
    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    
    osc1.start();
    osc2.start();
    
    state.audio.oscillator1 = osc1;
    state.audio.oscillator2 = osc2;
    state.audio.gainNode = gainNode;
    
    let goingUp = true;
    state.audio.sirenIntervalId = setInterval(() => {
      const now = ctx.currentTime;
      if (goingUp) {
        osc1.frequency.exponentialRampToValueAtTime(1000, now + 0.45);
        osc2.frequency.exponentialRampToValueAtTime(1005, now + 0.45);
      } else {
        osc1.frequency.exponentialRampToValueAtTime(500, now + 0.45);
        osc2.frequency.exponentialRampToValueAtTime(505, now + 0.45);
      }
      goingUp = !goingUp;
    }, 500);
    
  } catch (e) {
    console.error('Siren generation error: ', e);
  }
}

function stopSirenSound() {
  if (state.audio.sirenIntervalId) {
    clearInterval(state.audio.sirenIntervalId);
    state.audio.sirenIntervalId = null;
  }
  try {
    if (state.audio.oscillator1) {
      state.audio.oscillator1.stop();
      state.audio.oscillator1.disconnect();
      state.audio.oscillator1 = null;
    }
    if (state.audio.oscillator2) {
      state.audio.oscillator2.stop();
      state.audio.oscillator2.disconnect();
      state.audio.oscillator2 = null;
    }
    if (state.audio.gainNode) {
      state.audio.gainNode.disconnect();
      state.audio.gainNode = null;
    }
  } catch (e) {
    console.error('Siren stop cleanup error: ', e);
  }
}

// ============================================================================
// MONITORING STATE ENGINE
// ============================================================================
function setMonitoringState(newState) {
  state.monitoringState = newState;
  
  DOM.diagStateVal.className = 'indicator-val';
  
  if (newState === 'IDLE') {
    DOM.diagStateVal.classList.add('secure');
    DOM.diagStateVal.innerHTML = '<span class="indicator-dot"></span> SECURE';
    DOM.appMockup.classList.remove('alarm-active');
  } else if (newState === 'TIMER_ACTIVE') {
    DOM.diagStateVal.classList.add('monitoring');
    DOM.diagStateVal.innerHTML = '<span class="indicator-dot"></span> MONITORING';
    DOM.appMockup.classList.remove('alarm-active');
  } else if (newState === 'ALARM') {
    DOM.diagStateVal.classList.add('alert');
    DOM.diagStateVal.innerHTML = '<span class="indicator-dot"></span> ALARM ACTIVE';
    DOM.appMockup.classList.add('alarm-active');
  }
}

// ============================================================================
// DEVICE GPS & LIVE TELEMETRY
// ============================================================================
function initializeLocationStatus() {
  if (!('geolocation' in navigator)) {
    state.gps.permissionState = 'unsupported';
    logActivity('Device location unavailable in this browser.');
    return;
  }

  if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: 'geolocation' })
      .then((permission) => {
        state.gps.permissionState = permission.state;
        logActivity(`Device location permission status: ${permission.state}.`);
        permission.addEventListener('change', () => {
          state.gps.permissionState = permission.state;
          logActivity(`Device location permission changed to ${permission.state}.`);
        });
      })
      .catch(() => {
        state.gps.permissionState = 'prompt';
      });
  }
}

function requestDeviceLocation() {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      showToast('Location is not supported on this device/browser.', 'info');
      resolve(false);
      return;
    }

    logActivity('Requesting device location permission...');
    showToast('Allow location access so PanicSafe can track your ride.', 'info');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        applyDevicePosition(position, true);
        state.gps.permissionState = 'granted';
        logActivity('Device location permission granted. Live GPS fix acquired.');
        resolve(true);
      },
      (error) => {
        handleLocationError(error);
        resolve(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
      }
    );
  });
}

function startGPSTelemetry() {
  if (!('geolocation' in navigator) || state.gps.watchId !== null) return;

  state.gps.watchId = navigator.geolocation.watchPosition(
    (position) => {
      applyDevicePosition(position);
    },
    handleLocationError,
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000
    }
  );
}

function stopGPSTelemetry() {
  if (state.gps.watchId !== null && 'geolocation' in navigator) {
    navigator.geolocation.clearWatch(state.gps.watchId);
    state.gps.watchId = null;
  }
}

function applyDevicePosition(position, shouldRecenter = false) {
  state.gps.lat = position.coords.latitude;
  state.gps.lng = position.coords.longitude;
  state.gps.hasDeviceFix = true;

  updateTelemetryDisplay();
  updateMapPosition(shouldRecenter);
}

function updateTelemetryDisplay() {
  DOM.telemetryLat.textContent = state.gps.lat.toFixed(6);
  DOM.telemetryLng.textContent = state.gps.lng.toFixed(6);
}

function updateMapPosition(shouldRecenter = false) {
  if (!state.map.instance || !state.map.marker) return;

  const coords = [state.gps.lat, state.gps.lng];
  state.map.marker.setLatLng(coords);

  if (state.monitoringState === 'TIMER_ACTIVE' || shouldRecenter) {
    state.map.instance.panTo(coords);
  }
}

function handleLocationError(error) {
  state.gps.hasDeviceFix = false;

  if (error.code === error.PERMISSION_DENIED) {
    state.gps.permissionState = 'denied';
    logActivity('Device location permission denied. Using last known fallback coordinates.');
    showToast('Location permission denied. Enable it in your browser settings for live tracking.', 'info');
  } else if (error.code === error.POSITION_UNAVAILABLE) {
    logActivity('Device location is currently unavailable. Retrying when signal returns.');
    showToast('Location signal unavailable. PanicSafe will keep retrying.', 'info');
  } else if (error.code === error.TIMEOUT) {
    logActivity('Device location request timed out. Retrying in the background.');
    showToast('Location request timed out. Check GPS/network signal.', 'info');
  } else {
    logActivity('Device location error encountered. Retrying when possible.');
  }
}

function logActivity(message) {
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];
  
  const logLine = document.createElement('div');
  logLine.className = 'log-line';
  logLine.innerHTML = `<span class="log-time">[${timeStr}]</span> ${message}`;
  
  DOM.activityLogTerminal.appendChild(logLine);
  DOM.activityLogTerminal.scrollTop = DOM.activityLogTerminal.scrollHeight;
}

// ============================================================================
// TOAST ALERT ENGINE
// ============================================================================
let toastTimeoutId = null;
function showToast(message, type = 'info') {
  if (toastTimeoutId) {
    clearTimeout(toastTimeoutId);
  }
  
  DOM.toastBanner.className = `toast toast-${type} visible`;
  DOM.toastMessage.textContent = message;
  
  toastTimeoutId = setTimeout(() => {
    DOM.toastBanner.classList.remove('visible');
  }, 3500);
}

// ============================================================================
// MODAL DRAWER TOGGLERS
// ============================================================================
function openSheet(sheetElement) {
  initAudio();
  DOM.modalOverlay.classList.add('visible');
  sheetElement.classList.add('visible');
}

function closeAllSheets() {
  DOM.modalOverlay.classList.remove('visible');
  DOM.timerSetupSheet.classList.remove('visible');
  DOM.contactsSetupSheet.classList.remove('visible');
  DOM.diagnosticsSheet.classList.remove('visible');
}

// ============================================================================
// INTERACTIVE LEAFLET MAP HANDLERS
// ============================================================================
function mountLeafletMap() {
  DOM.mapViewBoxContainer.classList.add('visible');
  
  // Wait for CSS slide transition to complete so map viewport sizes correctly
  setTimeout(() => {
    try {
      if (!state.map.instance) {
        // Initialize Leaflet Map
        state.map.instance = L.map('safety-map', {
          zoomControl: false,
          attributionControl: false
        }).setView([state.gps.lat, state.gps.lng], 16);
        
        // CartoDB Voyager Tilelayer for clean high-contrast travel maps
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          maxZoom: 19
        }).addTo(state.map.instance);
        
        // Custom pulsing marker beacon
        const beaconIcon = L.divIcon({
          className: 'map-user-beacon',
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        });
        
        state.map.marker = L.marker([state.gps.lat, state.gps.lng], { icon: beaconIcon }).addTo(state.map.instance);
        logActivity('Live Leaflet map initialized. Map tracking live.');
      } else {
        // Recenter existing map
        state.map.marker.setLatLng([state.gps.lat, state.gps.lng]);
        state.map.instance.setView([state.gps.lat, state.gps.lng], 16);
      }
      
      // Force leaflet engine to recalculate container offsets
      setTimeout(() => {
        if (state.map.instance) state.map.instance.invalidateSize();
      }, 250);
      
    } catch (err) {
      console.error('Error mounting Leaflet Map: ', err);
    }
  }, 400);
}

function unmountLeafletMap() {
  DOM.mapViewBoxContainer.classList.remove('visible');
  logActivity('Live safety map hidden.');
}

// ============================================================================
// SAFETY TIMER CONTROLLERS
// ============================================================================
let selectedTimerPresetSeconds = null;

function setupTimerPresets() {
  DOM.presetBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      DOM.presetBtns.forEach(b => b.classList.remove('selected'));
      
      const targetBtn = e.currentTarget;
      targetBtn.classList.add('selected');
      selectedTimerPresetSeconds = parseInt(targetBtn.dataset.seconds, 10);
      
      DOM.customTimeInputs.classList.remove('visible');
    });
  });
  
  DOM.customTimerToggle.addEventListener('click', () => {
    DOM.presetBtns.forEach(b => b.classList.remove('selected'));
    selectedTimerPresetSeconds = null;
    DOM.customTimeInputs.classList.toggle('visible');
    const customVisible = DOM.customTimeInputs.classList.contains('visible');
    // hide presets when custom dial is active, show them otherwise
    if (DOM.timerPresets) DOM.timerPresets.style.display = customVisible ? 'none' : '';
    // update toggle label
    if (DOM.customTimerToggle) {
      DOM.customTimerToggle.textContent = customVisible ? 'Or select from Presets' : 'Or set a custom duration';
    }
    // initialize custom dial when shown
    if (customVisible) initCustomTimerDialUI();
  });
}
function initCustomTimerDialUI() {
  const svg = document.getElementById('custom-dial-svg');
  const knob = document.getElementById('dial-knob');
  const display = document.getElementById('custom-time-display');
  if (!svg || !knob || !display || !DOM.customMins) return;

  const view = { cx: 100, cy: 100, r: 90 };

  // Ensure sensible default
  let minutes = Math.max(1, Math.min(60, parseInt(DOM.customMins.value, 10) || 5));

  function render() {
    // Update hidden input
    DOM.customHours.value = '0';
    DOM.customMins.value = String(minutes);
    DOM.customSecs.value = '0';
    // Update display
    display.textContent = `${String(minutes).padStart(2,'0')}:00`;
    // Position knob on SVG semicircle
    const rad = ((minutes - 1) / 59) * Math.PI; // 0..pi
    const x = view.cx - view.r * Math.cos(rad);
    const y = view.cy - view.r * Math.sin(rad);
    const knobGroup = document.getElementById('knob-group');
    if (knobGroup) {
      knobGroup.setAttribute('transform', `translate(${x},${y})`);
    }
    // update aria
    const dialEl = document.getElementById('custom-dial');
    if (dialEl) dialEl.setAttribute('aria-valuenow', String(minutes));
  }

  function setFromSvgPoint(svgPoint) {
    const dx = view.cx - svgPoint.x;
    const dy = view.cy - svgPoint.y;
    // If user drags below the semicircle, snap to nearest end instead of wrapping
    if (svgPoint.y > view.cy) {
      // right side -> 60, left side -> 1
      minutes = svgPoint.x >= view.cx ? 60 : 1;
      render();
      return;
    }

    const rad = Math.atan2(dy, dx); // expected 0..pi for semicircle
    // clamp
    const clamped = Math.max(0, Math.min(Math.PI, rad));
    const angleDeg = clamped * 180 / Math.PI;
    const m = 1 + Math.round((angleDeg / 180) * 59);
    minutes = Math.max(1, Math.min(60, m));
    render();
  }

  // No ticks/labels: a clean thick semicircle with a draggable knob

  function toSvgPoint(clientX, clientY) {
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const inv = svg.getScreenCTM().inverse();
    return pt.matrixTransform(inv);
  }

  let dragging = false;

  knob.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    (e.target).setPointerCapture(e.pointerId);
    // tiny haptic feedback for mobile devices
    try {
      if (navigator.vibrate) navigator.vibrate(10);
    } catch (err) {
      /* swallow */
    }
    dragging = true;
    const p = toSvgPoint(e.clientX, e.clientY);
    setFromSvgPoint(p);
  });

  svg.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const p = toSvgPoint(e.clientX, e.clientY);
    setFromSvgPoint(p);
  });

  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const p = toSvgPoint(e.clientX, e.clientY);
    setFromSvgPoint(p);
  });

  window.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    dragging = false;
    try { knob.releasePointerCapture(e.pointerId); } catch (_) {}
  });

  // Keyboard accessibility
  const dialWrap = document.getElementById('custom-dial');
  if (dialWrap) {
    dialWrap.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        minutes = Math.max(1, minutes - 1); render(); e.preventDefault();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        minutes = Math.min(60, minutes + 1); render(); e.preventDefault();
      }
    });
  }

  const applyBtn = document.getElementById('apply-custom-time');
  if (applyBtn) {
    applyBtn.onclick = () => {
      selectedTimerPresetSeconds = null;
      showToast('Custom timer set', 'success');
    };
  }

  render();
}

function getTimerDuration() {
  if (selectedTimerPresetSeconds !== null) {
    return selectedTimerPresetSeconds;
  }
  const hrs = parseInt(DOM.customHours.value, 10) || 0;
  const mins = parseInt(DOM.customMins.value, 10) || 0;
  const secs = parseInt(DOM.customSecs.value, 10) || 0;
  return (hrs * 3600) + (mins * 60) + secs;
}

async function startSafetyTimer() {
  const duration = getTimerDuration();
  if (duration <= 0) {
    showToast('Please select or configure a safety timer duration.', 'info');
    return;
  }

  state.userName = DOM.alertUserName.value.trim() || 'PanicSafe user';
  localStorage.setItem('panic_safe_user_name', state.userName);

  const hasLocation = await requestDeviceLocation();
  if (hasLocation) {
    startGPSTelemetry();
  } else {
    logActivity('Safety Timer continuing with fallback coordinates until location is available.');
  }
  
  closeAllSheets();
  
  state.timer.totalSeconds = duration;
  state.timer.remainingSeconds = duration;
  state.timer.isDangerState = false;
  state.timer.reminderSent = false;
  
  setMonitoringState('TIMER_ACTIVE');
  playChime('success');
  logActivity(`Safety Timer armed for ${formatTime(duration)}.`);
  
  // Transition home circle button into timer active state
  DOM.checkinBtn.classList.add('timer-active');
  DOM.checkinBtn.classList.remove('timer-danger');
  DOM.checkinBtn.style.setProperty('--timer-fill-scale', '1');
  DOM.timerQuickActions.classList.add('visible');
  
  updateTimerUI();
  
  // Mount leaflet maps
  mountLeafletMap();
  
  if (state.timer.intervalId) {
    clearInterval(state.timer.intervalId);
  }
  state.timer.intervalId = setInterval(tickTimer, 1000);
  
  showToast(`Safety check-in active. Disarm in ${formatTime(duration)}.`, 'success');
}

function tickTimer() {
  state.timer.remainingSeconds--;
  playChime('tick');

  if (!state.timer.reminderSent && state.timer.remainingSeconds === 15) {
    state.timer.reminderSent = true;
    showPanicSafeNotification(
      'PanicSafe reminder',
      '15 seconds left before your timer ends. Check in now to stay safe.',
      'panicsafe-15-sec-reminder'
    );
    logActivity('Reminder sent: 15 seconds remaining on timer.');
    showToast('15 seconds left on your timer.', 'info');
  }
  
  if (state.timer.remainingSeconds <= 10 && !state.timer.isDangerState) {
    state.timer.isDangerState = true;
    DOM.timerProgress.classList.add('danger');
    DOM.checkinBtn.classList.add('timer-danger');
    logActivity('Safety timer running low. Impending emergency alert.');
    showToast('Check in immediately to avoid distress alert!', 'info');
  }
  
  updateTimerUI();
  
  if (state.timer.remainingSeconds <= 0) {
    expireTimerTriggerAlarm();
  }
}

function updateTimerUI() {
  const rem = state.timer.remainingSeconds;
  const total = state.timer.totalSeconds;
  
  DOM.checkinLabel.className = 'checkin-label';
  DOM.checkinLabel.textContent = 'SECURE';
  
  let valDisplay = document.getElementById('countdown-val');
  if (!valDisplay) {
    valDisplay = document.createElement('span');
    valDisplay.id = 'countdown-val';
    valDisplay.className = 'countdown-val';
    DOM.checkinBtn.insertBefore(valDisplay, DOM.checkinLabel);
  }
  valDisplay.textContent = formatTime(rem);
  
  const ratio = rem / total;
  const dashoffset = STROKE_DASH_MAX * (1 - ratio);
  DOM.timerProgress.style.strokeDashoffset = dashoffset;
  DOM.checkinBtn.style.setProperty('--timer-fill-scale', Math.max(0, ratio).toFixed(3));
}

function extendTimer() {
  if (state.monitoringState !== 'TIMER_ACTIVE') return;
  
  const addition = 120; // 2 minutes
  state.timer.remainingSeconds += addition;
  state.timer.totalSeconds += addition;
  
  if (state.timer.remainingSeconds > 10) {
    state.timer.isDangerState = false;
    DOM.timerProgress.classList.remove('danger');
    DOM.checkinBtn.classList.remove('timer-danger');
  }
  
  playChime('success');
  updateTimerUI();
  logActivity(`Extended Safety Timer by 2:00. Remaining: ${formatTime(state.timer.remainingSeconds)}.`);
  showToast('Timer extended by 2 minutes.', 'success');
  
  // Refresh leaflet redraw
  if (state.map.instance) {
    state.map.instance.invalidateSize();
  }
}

function disarmSafetyTimer() {
  if (state.timer.intervalId) {
    clearInterval(state.timer.intervalId);
    state.timer.intervalId = null;
  }

  state.timer.reminderSent = false;
  state.timer.isDangerState = false;
  
  setMonitoringState('IDLE');
  playChime('cancel');
  logActivity('Safety Timer disarmed. User marked safe.');
  
  // Collapse Map
  unmountLeafletMap();
  stopGPSTelemetry();
  
  // Restore Circle Button
  DOM.checkinBtn.classList.remove('timer-active');
  DOM.checkinBtn.classList.remove('timer-danger');
  DOM.checkinBtn.style.setProperty('--timer-fill-scale', '1');
  DOM.timerQuickActions.classList.remove('visible');
  DOM.timerProgress.classList.remove('danger');
  DOM.timerProgress.style.strokeDashoffset = STROKE_DASH_MAX;
  
  const valDisplay = document.getElementById('countdown-val');
  if (valDisplay) {
    valDisplay.remove();
  }
  
  DOM.checkinLabel.className = 'checkin-label';
  DOM.checkinLabel.textContent = 'CHECK IN';
  
  showToast('Check-in complete. Monitoring disarmed.', 'success');
}

function expireTimerTriggerAlarm() {
  if (state.timer.intervalId) {
    clearInterval(state.timer.intervalId);
    state.timer.intervalId = null;
  }

  state.timer.reminderSent = false;
  state.timer.isDangerState = false;
  
  logActivity('Timer reached 0 without check-in. Triggering SOS sequence.');
  triggerAlarmSequence('Timer Expiration');
}

function formatTime(totalSecs) {
  if (totalSecs < 0) return '00:00';
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  
  const pad = (n) => n.toString().padStart(2, '0');
  
  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

// ============================================================================
// PANIC BUTTON SEQUENCE
// ============================================================================
function triggerPanicBtnSequence() {
  closeAllSheets();
  requestDeviceLocation().then((hasLocation) => {
    if (hasLocation) startGPSTelemetry();
  });
  state.panicCountdown.remaining = 3;
  DOM.panicCountdownVal.textContent = state.panicCountdown.remaining;
  
  // Immediate vibration feedback when panic button is pressed
  triggerVibration([100, 50, 100]); // Quick alert on panic press
  
  DOM.panicPreOverlay.classList.add('visible');
  playChime('tick');
  logActivity('Panic Button pressed. Starting 3s pre-alarm interruption.');
  
  state.panicCountdown.intervalId = setInterval(() => {
    state.panicCountdown.remaining--;
    DOM.panicCountdownVal.textContent = state.panicCountdown.remaining;
    
    if (state.panicCountdown.remaining > 0) {
      playChime('tick');
      // Vibration pulse on each countdown tick
      triggerVibration(50);
    } else {
      clearInterval(state.panicCountdown.intervalId);
      state.panicCountdown.intervalId = null;
      DOM.panicPreOverlay.classList.remove('visible');
      
      logActivity('Pre-SOS countdown expired. Alerting responders.');
      triggerAlarmSequence('Panic Button Manual Trigger');
    }
  }, 1000);
}

function cancelPanicBtnSequence() {
  if (state.panicCountdown.intervalId) {
    clearInterval(state.panicCountdown.intervalId);
    state.panicCountdown.intervalId = null;
  }
  if (state.monitoringState === 'IDLE') {
    stopGPSTelemetry();
  }
  DOM.panicPreOverlay.classList.remove('visible');
  playChime('cancel');
  logActivity('Panic SOS sequence canceled by user.');
  showToast('SOS alarm sequence aborted.', 'info');
}

// ============================================================================
// SOS BROADCAST CONTROL PANEL
// ============================================================================
function triggerAlarmSequence(triggerSource) {
  setMonitoringState('ALARM');
  
  // Strong vibration alert on the sender's phone
  triggerVibration([200, 100, 200, 100, 300]); // 5 pulses for urgent alert
  
  notifyTimerExpiration(triggerSource);
  
  // Collapse Map
  unmountLeafletMap();
  
  // Display flashing overlay
  DOM.alarmOverlay.classList.add('visible');
  
  // Play wailing siren
  startSirenSound();
  
  DOM.sosNotificationFeed.innerHTML = '';
  const lines = [
    `> SOS Alarm Activated via ${triggerSource}`,
    `> Decibel broadcast engaged at full amplification`,
    `> Locating coordinates: Lat ${state.gps.lat.toFixed(5)}, Lng ${state.gps.lng.toFixed(5)}`,
    `> Compiling emergency SMS distress payloads...`
  ];
  
  lines.forEach((l, i) => {
    setTimeout(() => {
      appendSOSLog(l);
    }, i * 600);
  });
  
  // Alert all contacts
  if (state.contacts.length === 0) {
    setTimeout(() => {
      appendSOSLog('! WARNING: No emergency contacts configured in backend.');
    }, 2400);
  } else {
    setTimeout(() => {
      broadcastEmergencySms(triggerSource);
    }, 2500);
  }
}

function notifyTimerExpiration(triggerSource) {
  const userName = state.userName || state.profile?.fullName || DOM.alertUserName.value.trim() || 'PanicSafe user';
  
  notifyConnectedPanicSafeUsers(userName, triggerSource);
}

async function notifyConnectedPanicSafeUsers(userName, triggerSource = 'Timer Expiration') {
  if (!state.authUser || !window.PanicSafeFirebase) {
    appendSOSLog('! Connected-user push skipped. Firebase sign-in unavailable.');
    return;
  }

  try {
    const connections = state.connections.length
      ? state.connections
      : await window.PanicSafeFirebase.loadConnections();
    if (!connections.length) {
      appendSOSLog('! No connected PanicSafe users configured for app notification.');
      return;
    }

    const alertPayload = buildGuardianAlertPayload(userName, triggerSource);
    const subscriptions = [];
    let firestoreAlerts = 0;
    for (const connection of connections) {
      if (window.PanicSafeFirebase.loadPushSubscriptionsForUser) {
        try {
          const pushSubscriptions = await window.PanicSafeFirebase.loadPushSubscriptionsForUser(connection.uid);
          subscriptions.push(...pushSubscriptions);
        } catch (err) {
          appendSOSLog(`! Could not read notification device for ${connection.fullName || 'connected user'}: ${err.code || err.message}`);
        }
      }

      if (window.PanicSafeFirebase.sendUserAlert) {
        try {
          await window.PanicSafeFirebase.sendUserAlert(connection.uid, alertPayload);
          firestoreAlerts++;
        } catch (err) {
          appendSOSLog(`! In-app alert failed for ${connection.fullName || 'connected user'}: ${err.code || err.message}`);
        }
      }
    }

    if (firestoreAlerts) {
      appendSOSLog(`> PanicSafe emergency screen triggered for ${firestoreAlerts} connected user(s).`);
    }

    if (subscriptions.length === 0) {
      appendSOSLog('! Connected users have not enabled iPhone notifications yet. In-app alert was still sent.');
      return;
    }

    const isTimer = String(triggerSource).toLowerCase().includes('timer');
    const alertBody = isTimer
      ? `${userName} is not responding to the PanicSafe timer. Location: ${state.gps.lat.toFixed(6)}, ${state.gps.lng.toFixed(6)}`
      : `${userName} has triggered a PanicSafe SOS alert. Location: ${state.gps.lat.toFixed(6)}, ${state.gps.lng.toFixed(6)}`;
    const notificationData = {
      ...alertPayload,
      url: `/?guardianAlert=${encodeURIComponent(JSON.stringify(alertPayload))}`
    };
    const response = await fetch(PUSH_ALERT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriptions,
        title: 'PanicSafe connected user alert',
        body: alertBody,
        data: notificationData
      })
    });
    const result = await response.json();

    if (!response.ok) {
      appendSOSLog('! Push delivery service returned an error.');
    }

    const sentCount = (result.results || []).filter(r => r.ok).length;
    const failList = (result.results || []).filter(r => !r.ok).map(r => ({ endpoint: r.endpoint, reason: r.reason }));

    appendSOSLog(`> PanicSafe app notification attempts: ${sentCount} succeeded, ${failList.length} failed.`);
    if (failList.length) {
      failList.slice(0, 10).forEach(f => appendSOSLog(`! Push failed for endpoint: ${f.endpoint} — ${f.reason}`));
      showToast(`${failList.length} connected devices did not receive push notifications.`, 'info');
    }
  } catch (err) {
    console.error('Connected-user push alert failed:', err);
    appendSOSLog(`! Connected-user push failed: ${err.message}`);
  }
}

async function broadcastEmergencySms(triggerSource) {
  const payload = {
    userName: state.userName || DOM.alertUserName.value.trim() || 'PanicSafe user',
    triggerSource,
    contacts: state.contacts,
    profile: state.profile,
    location: {
      lat: state.gps.lat,
      lng: state.gps.lng
    }
  };

  try {
    const response = await fetch(SOS_ALERT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'SMS alert request failed.');
    }

    result.results.forEach((smsResult) => {
      const mode = smsResult.simulated ? 'SIMULATED SMS' : 'SMS';
      const status = smsResult.ok ? 'sent' : 'failed';
      appendSOSLog(`> ${mode} ${status} to ${smsResult.contact} (${smsResult.phone})`);
    });
    appendSOSLog(`  Payload: "${result.message}"`);

    if (result.simulated) {
      appendSOSLog('! SMS delivery is simulated in this build (no SMS provider configured).');
    }
  } catch (err) {
    console.error('SOS SMS broadcast error: ', err);
    appendSOSLog(`! SMS broadcast failed: ${err.message}`);
    showToast('SMS alert failed. Check server/provider configuration.', 'info');
  }
}

function appendSOSLog(text) {
  const line = document.createElement('div');
  line.className = 'sos-notif-line';
  line.textContent = text;
  DOM.sosNotificationFeed.appendChild(line);
  DOM.sosNotificationFeed.scrollTop = DOM.sosNotificationFeed.scrollHeight;
}

function dismissAlarmSequence() {
  stopSirenSound();
  DOM.alarmOverlay.classList.remove('visible');
  
  disarmSafetyTimer();
  setMonitoringState('IDLE');
  
  logActivity('Emergency alarm dismissed by user. Systems disengaged.');
  showToast('Emergency alert disarmed. System safe.', 'success');
}

// ============================================================================
// EMERGENCY CONTACTS CRUD (REST SYNCED + LOCALSTORAGE FALLBACK)
// ============================================================================
function updateContactsListUI() {
  DOM.diagContactsCount.textContent = `${state.contacts.length} Configured`;
  DOM.contactsScrollList.innerHTML = '';
  
  if (state.contacts.length === 0) {
    DOM.contactsEmptyState.style.display = 'block';
    DOM.contactsScrollList.appendChild(DOM.contactsEmptyState);
    return;
  }
  
  DOM.contactsEmptyState.style.display = 'none';
  
  state.contacts.forEach(contact => {
    const el = document.createElement('div');
    el.className = 'contact-item';
    el.innerHTML = `
      <div class="contact-info">
        <div class="contact-name">${escapeHTML(contact.name)}</div>
        <div class="contact-phone-relation">${escapeHTML(contact.phone)} &bull; ${escapeHTML(contact.relation)}</div>
      </div>
      <button class="delete-contact-btn" data-id="${contact.id}">Remove</button>
    `;
    DOM.contactsScrollList.appendChild(el);
  });
  
  DOM.contactsScrollList.querySelectorAll('.delete-contact-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      deleteContact(id);
    });
  });
}

async function addEmergencyContact() {
  const name = DOM.contactName.value.trim();
  const phone = DOM.contactPhone.value.trim();
  const relation = DOM.contactRelation.value;
  
  if (!name || !phone || !relation) {
    showToast('Please fill out all contact fields.', 'info');
    return;
  }
  
  const newContact = {
    id: Date.now().toString(),
    name,
    phone,
    relation
  };

  if (state.backendSync) {
    // Write to Server REST API
    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContact)
      });
      if (response.ok) {
        const savedContact = await response.json();
        state.contacts.push(savedContact);
        logActivity(`[Server DB] Added contact: ${name} (${relation})`);
        showToast(`${name} saved to server database.`, 'success');
      } else {
        throw new Error('Database server write failure.');
      }
    } catch (err) {
      console.error(err);
      showToast('Database server error. Reverting to sandbox storage.', 'info');
      state.backendSync = false;
      
      // Local Fallback
      state.contacts.push(newContact);
      updateLocalBackup();
      logActivity(`[Local Storage] Added contact: ${name} (${relation})`);
      showToast(`${name} added to local storage.`, 'success');
    }
  } else {
    // Write to LocalStorage Sandbox
    state.contacts.push(newContact);
    updateLocalBackup();
    logActivity(`[Local Storage] Added contact: ${name} (${relation})`);
    showToast(`${name} added to local storage.`, 'success');
  }

  updateContactsListUI();
  
  // Clear forms
  DOM.contactName.value = '';
  DOM.contactPhone.value = '';
  DOM.contactRelation.value = '';
}

async function deleteContact(id) {
  const contact = state.contacts.find(c => c.id === id);
  const name = contact ? contact.name : 'Unknown';

  if (state.backendSync) {
    try {
      const response = await fetch(`${API_ENDPOINT}?id=${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        state.contacts = state.contacts.filter(c => c.id !== id);
        logActivity(`[Server DB] Removed contact: ${name}`);
        showToast(`Contact removed from server database.`, 'info');
      } else {
        throw new Error('Database server delete failure.');
      }
    } catch (err) {
      console.error(err);
      showToast('Database server error. Reverting to sandbox storage.', 'info');
      state.backendSync = false;
      
      // Local Fallback
      state.contacts = state.contacts.filter(c => c.id !== id);
      updateLocalBackup();
      logActivity(`[Local Storage] Removed contact: ${name}`);
      showToast(`Contact removed successfully from local storage.`, 'info');
    }
  } else {
    state.contacts = state.contacts.filter(c => c.id !== id);
    updateLocalBackup();
    logActivity(`[Local Storage] Removed contact: ${name}`);
    showToast(`Contact removed successfully.`, 'info');
  }

  updateContactsListUI();
}

// Utility: escape strings to prevent XSS
function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// ============================================================================
// MOBILE PHONE CONTACT PICKER API INTEGRATION & VCARD FALLBACK
// ============================================================================
async function triggerDeviceContactPicker() {
  const isMobileContactPickerSupported = ('contacts' in navigator && 'ContactsManager' in window && navigator.contacts.select);
  
  if (isMobileContactPickerSupported) {
    // 📱 NATIVE PHONE ADDRESS BOOK INTERACTION
    const properties = ['name', 'tel'];
    try {
      logActivity('Opening native device contacts picker...');
      const selectedContacts = await navigator.contacts.select(properties, { multiple: false });
      
      if (selectedContacts && selectedContacts.length > 0) {
        const contact = selectedContacts[0];
        const name = contact.name && contact.name[0] ? contact.name[0] : '';
        const phone = contact.tel && contact.tel[0] ? contact.tel[0] : '';
        
        applyImportedContact(name, phone, 'native device contacts');
      } else {
        logActivity('Address book import canceled.');
      }
    } catch (err) {
      console.error('Mobile contact picker error: ', err);
      showToast('Address book select canceled.', 'info');
    }
  } else {
    // 💻 PREMIUM DESKTOP SIMULATION ADDRESS BOOK DRAWER
    openVCardImport();
  }
}

function openVCardImport() {
  logActivity('Native Contacts API unavailable. Opening vCard contact import.');
  showToast('Choose a .vcf contact card exported from your phone contacts.', 'info');
  DOM.vcardImportInput.value = '';
  DOM.vcardImportInput.click();
}

async function handleVCardImport(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const contacts = parseVCardContacts(text);
    if (contacts.length === 0) {
      showToast('No usable contact found in that vCard file.', 'info');
      logActivity('vCard import failed: no name and phone pair found.');
      return;
    }

    const contact = contacts[0];
    applyImportedContact(contact.name, contact.phone, 'vCard file');
  } catch (err) {
    console.error('vCard import error: ', err);
    showToast('Could not read that contact card.', 'info');
  }
}

function applyImportedContact(name, phone, sourceLabel) {
  const safeName = (name || '').trim();
  const safePhone = (phone || '').trim();

  if (!safeName || !safePhone) {
    showToast('Selected contact needs both a name and phone number.', 'info');
    return;
  }

  DOM.contactName.value = safeName;
  DOM.contactPhone.value = safePhone;
  DOM.contactRelation.focus();
  logActivity(`Imported ${sourceLabel} contact: ${safeName} (${safePhone})`);
  showToast(`Imported ${safeName}. Select relationship.`, 'success');
}

function parseVCardContacts(text) {
  const cards = unfoldVCardLines(text)
    .join('\n')
    .split(/END:VCARD/i);

  return cards
    .map(parseSingleVCard)
    .filter(contact => contact.name && contact.phone);
}

function unfoldVCardLines(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .reduce((lines, line) => {
      if (/^[ \t]/.test(line) && lines.length) {
        lines[lines.length - 1] += line.slice(1);
      } else {
        lines.push(line);
      }
      return lines;
    }, []);
}

function parseSingleVCard(cardText) {
  const lines = cardText.split('\n');
  const fullNameLine = lines.find(line => /^FN(?:[;:])/i.test(line));
  const nameLine = lines.find(line => /^N(?:[;:])/i.test(line));
  const phoneLine = lines.find(line => /^TEL(?:[;:])/i.test(line));

  const fullName = fullNameLine ? decodeVCardValue(fullNameLine) : '';
  const structuredName = nameLine ? decodeVCardValue(nameLine).split(';').filter(Boolean).reverse().join(' ') : '';
  const phone = phoneLine ? normalizePhoneNumber(decodeVCardValue(phoneLine)) : '';

  return {
    name: fullName || structuredName,
    phone
  };
}

function decodeVCardValue(line) {
  const separatorIndex = line.indexOf(':');
  if (separatorIndex === -1) return '';

  return line
    .slice(separatorIndex + 1)
    .replace(/\\n/gi, ' ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .trim();
}

function normalizePhoneNumber(value) {
  return value.replace(/[^\d+().\-\s]/g, '').trim();
}

// ============================================================================
// SYSTEM WORKFLOW EVENTS BINDINGS
// ============================================================================
function setupEventListeners() {
  DOM.modalOverlay.addEventListener('click', closeAllSheets);
  DOM.firebaseGoogleBtn.addEventListener('click', signInWithFirebaseGoogle);
  DOM.profileForm.addEventListener('submit', saveProfile);
  DOM.profileLogoutBtn.addEventListener('click', signOutFromPanicSafe);
  DOM.profileDeleteBtn.addEventListener('click', deletePanicSafeAccount);
  DOM.profileBackBtn.addEventListener('click', closeProfileEditor);
  DOM.profileChip.addEventListener('click', openProfileEditor);
  DOM.connectUserBtn.addEventListener('click', connectPanicSafeUser);
  DOM.connectUserInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      connectPanicSafeUser();
    }
  });
  DOM.notificationPermissionBtn.addEventListener('click', requestNotificationPermission);
  if (DOM.shakeDetectionToggleBtn) {
    DOM.shakeDetectionToggleBtn.addEventListener('click', async () => {
      const status = localStorage.getItem('motion_permission_status');
      // If already enabled, allow user to disable
      if (status === 'granted' && shakeDetectionState.permissionGranted) {
        window.removeEventListener('devicemotion', handleDeviceMotion, true);
        shakeDetectionState.permissionGranted = false;
        localStorage.setItem('motion_permission_status', 'disabled');
        updateShakeDetectionButton();
        showToast('Shake detection disabled', 'info');
        if (typeof logActivity === 'function') logActivity('Shake detection disabled by user.');
        return;
      }

      // Request permission / enable detection
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        await requestMotionPermission();
      } else {
        // Non-iOS / no permission API - start directly
        startShakeDetection();
        localStorage.setItem('motion_permission_status', 'granted');
        shakeDetectionState.permissionGranted = true;
        updateShakeDetectionButton();
        showToast('Shake detection enabled', 'success');
        if (typeof logActivity === 'function') logActivity('Shake detection enabled by user.');
      }
    });
  }
  
  if (DOM.vibrationPermissionBtn) {
    DOM.vibrationPermissionBtn.addEventListener('click', () => {
      if (vibrationState.enabled) {
        disableVibration();
      } else {
        enableVibration();
      }
    });
  }
  
  DOM.checkinBtn.addEventListener('click', () => {
    if (state.monitoringState === 'TIMER_ACTIVE') {
      disarmSafetyTimer();
    } else {
      openSheet(DOM.timerSetupSheet);
    }
  });
  
  DOM.contactsTriggerBtn.addEventListener('click', () => {
    openSheet(DOM.contactsSetupSheet);
  });
  
  DOM.statusDashboardBtn.addEventListener('click', () => {
    openSheet(DOM.diagnosticsSheet);
  });
  
  if (DOM.statusDashboardBtnMobile) {
    DOM.statusDashboardBtnMobile.addEventListener('click', () => {
      openSheet(DOM.diagnosticsSheet);
    });
  }
  
  setupTimerPresets();
  DOM.startTimerBtn.addEventListener('click', startSafetyTimer);
  
  DOM.timerDisarmBtn.addEventListener('click', disarmSafetyTimer);
  DOM.timerExtendBtn.addEventListener('click', extendTimer);
  
  DOM.addContactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    addEmergencyContact();
  });
  
  DOM.importContactBtn.addEventListener('click', triggerDeviceContactPicker);
  DOM.vcardImportInput.addEventListener('change', handleVCardImport);
  
  DOM.panicTriggerBtn.addEventListener('click', triggerPanicBtnSequence);
  DOM.panicCancelBtn.addEventListener('click', cancelPanicBtnSequence);
  DOM.disarmAlarmBtn.addEventListener('click', dismissAlarmSequence);
  DOM.guardianAlertDismissBtn.addEventListener('click', dismissGuardianAlert);
}


// ============================================================================
// DARK MODE TOGGLE
// ============================================================================

function initializeDarkMode() {
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  if (!themeToggleBtn) return;

  // Load saved theme preference or use system preference
  const savedTheme = localStorage.getItem('panic_safe_theme');
  let isDarkMode = savedTheme 
    ? savedTheme === 'dark' 
    : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (isDarkMode) {
    document.documentElement.classList.add('dark-mode');
  }

  // Listen for theme toggle
  themeToggleBtn.addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    if (isDarkMode) {
      document.documentElement.classList.add('dark-mode');
      localStorage.setItem('panic_safe_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark-mode');
      localStorage.setItem('panic_safe_theme', 'light');
    }
  });

  // Listen for system preference changes
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('panic_safe_theme')) {
        isDarkMode = e.matches;
        if (isDarkMode) {
          document.documentElement.classList.add('dark-mode');
        } else {
          document.documentElement.classList.remove('dark-mode');
        }
      }
    });
  }
}

// ============================================================================
// EMERGENCY HELPLINES DRAWER TOGGLE
// ============================================================================

function initializeEmergencyDrawer() {
  const drawerToggle = document.getElementById('emergency-drawer-toggle');
  const drawer = document.getElementById('emergency-drawer');
  
  if (!drawerToggle || !drawer) return;

  drawerToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    drawer.classList.toggle('expanded');
    const isExpanded = drawer.classList.contains('expanded');
    drawerToggle.setAttribute('aria-expanded', isExpanded);
  });

  // Close drawer when clicking outside
  document.addEventListener('click', (e) => {
    if (drawer.classList.contains('expanded') && !drawer.contains(e.target)) {
      drawer.classList.remove('expanded');
      drawerToggle.setAttribute('aria-expanded', 'false');
    }
  });

  // Prevent clicks inside drawer from closing it
  drawer.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Close drawer when clicking an emergency item
  const emergencyItems = drawer.querySelectorAll('.emergency-item');
  emergencyItems.forEach(item => {
    item.addEventListener('click', () => {
      drawer.classList.remove('expanded');
      drawerToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

// Initialize emergency drawer when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initializeEmergencyDrawer();
});

// ============================================================================
// SHAKE DETECTION FEATURE
// ============================================================================

let shakeDetectionState = {
  lastX: 0,
  lastY: 0,
  lastZ: 0,
  lastTime: 0,
  shakeThreshold: 15, // Sensitivity threshold
  shakeTimeout: null,
  cooldownPeriod: 3000, // 3 seconds cooldown between shake detections
  lastShakeTime: 0,
  permissionGranted: false,
  permissionAsked: false,
  autoTriggerTimer: null,
  autoTriggerCountdown: 30,
  alertActive: false
};

let vibrationState = {
  enabled: false,
  supported: false
};

function detectVibrationSupport() {
  // Check for Vibration API (Android) or Haptic Feedback (iOS 13+)
  // Be permissive - assume supported and let the try/catch handle it
  vibrationState.supported = true;
  return vibrationState.supported;
}

function enableVibration() {
  detectVibrationSupport();
  
  vibrationState.enabled = true;
  DOM.vibrationPermissionBtn.classList.add('enabled');
  showToast('Vibration alerts enabled! (Test pattern sent)', 'success');
  
  // Send a test vibration pattern so user knows if it works
  triggerVibration([100, 50, 100, 50, 100]); // Medium pattern
  logActivity('Vibration alerts enabled.');
}

function disableVibration() {
  vibrationState.enabled = false;
  DOM.vibrationPermissionBtn.classList.remove('enabled');
  showToast('Vibration alerts disabled.', 'info');
  logActivity('Vibration alerts disabled.');
}

function triggerVibration(pattern) {
  if (!vibrationState.enabled) {
    return;
  }
  
  try {
    // Log what we're attempting
    console.log('Attempting vibration with pattern:', pattern, 'navigator.vibrate:', !!navigator.vibrate);
    
    // Try standard Vibration API first (Android, some browsers)
    if (navigator.vibrate) {
      const result = navigator.vibrate(pattern);
      console.log('navigator.vibrate result:', result);
      return;
    } 
    // Fallback for webkit browsers
    if (navigator.webkitVibrate) {
      const result = navigator.webkitVibrate(pattern);
      console.log('navigator.webkitVibrate result:', result);
      return;
    }
    // Fallback for moz browsers
    if (navigator.moz_vibrate) {
      const result = navigator.moz_vibrate(pattern);
      console.log('navigator.moz_vibrate result:', result);
      return;
    }
    
    console.warn('No vibration API available on this browser');
  } catch (err) {
    console.error('Vibration API error:', err);
  }
}

function initializeShakeDetection() {
  const shakeOverlay = document.getElementById('shake-alert-overlay');
  const alrightBtn = document.getElementById('shake-alright-btn');
  const triggerBtn = document.getElementById('shake-trigger-btn');
  const motionPermissionOverlay = document.getElementById('motion-permission-overlay');
  const motionEnableBtn = document.getElementById('motion-permission-enable');
  const motionSkipBtn = document.getElementById('motion-permission-skip');

  if (!shakeOverlay || !alrightBtn || !triggerBtn) {
    console.error('Shake alert elements not found in DOM');
    return;
  }

  console.log('Shake detection initialization started');

  // Check if DeviceMotionEvent is available
  if (typeof DeviceMotionEvent === 'undefined') {
    console.log('Device motion not supported on this device');
    return;
  }

  // Check if permission was already asked
  const permissionStatus = localStorage.getItem('motion_permission_status');
  console.log('Motion permission status:', permissionStatus);
  
  if (permissionStatus === 'granted') {
    startShakeDetection();
  } else if (permissionStatus === 'denied' || permissionStatus === 'skipped') {
    // Don't ask again
    console.log('Motion permission previously denied or skipped');
  } else {
    // Do not auto-show a permission popup. Expose a toggle in the timer setup instead.
    console.log('Motion permission not granted — awaiting user action via toggle');
  }

  // Shake alert button handlers
  alrightBtn.addEventListener('click', () => {
    console.log('User clicked I\'m Alright');
    acknowledgeShake();
  });

  triggerBtn.addEventListener('click', () => {
    console.log('User clicked Trigger Alert');
    closeShakeAlert();
    // Trigger the panic button
    const panicBtn = document.getElementById('panic-trigger-btn');
    if (panicBtn) {
      panicBtn.click();
    }
  });

  // Motion permission handlers
  if (motionEnableBtn) {
    motionEnableBtn.addEventListener('click', async () => {
      console.log('User clicked Enable motion permission');
      await requestMotionPermission();
      closeMotionPermissionPrompt();
    });
  }

  if (motionSkipBtn) {
    motionSkipBtn.addEventListener('click', () => {
      console.log('User clicked Skip motion permission');
      localStorage.setItem('motion_permission_status', 'skipped');
      closeMotionPermissionPrompt();
      logActivity('Motion detection permission skipped by user.');
    });
  }

  // TEST BUTTON - Remove this after testing
  // Uncomment to test shake popup manually:
  // setTimeout(() => {
  //   console.log('TEST: Showing shake alert manually');
  //   showShakeAlert();
  // }, 5000);
}

function showMotionPermissionPrompt() {
  const motionPermissionOverlay = document.getElementById('motion-permission-overlay');
  if (motionPermissionOverlay && !shakeDetectionState.permissionAsked) {
    motionPermissionOverlay.classList.add('visible');
    shakeDetectionState.permissionAsked = true;
    console.log('Motion permission prompt shown');
  } else {
    console.log('Motion permission overlay not found or already asked');
  }
}

function closeMotionPermissionPrompt() {
  const motionPermissionOverlay = document.getElementById('motion-permission-overlay');
  if (motionPermissionOverlay) {
    motionPermissionOverlay.classList.remove('visible');
  }
}

async function requestMotionPermission() {
  if (typeof DeviceMotionEvent.requestPermission === 'function') {
    try {
      const permissionState = await DeviceMotionEvent.requestPermission();
      if (permissionState === 'granted') {
        startShakeDetection();
        localStorage.setItem('motion_permission_status', 'granted');
        shakeDetectionState.permissionGranted = true;
        logActivity('Motion detection permission granted.');
        showToast('Shake detection enabled', 'success');
        updateShakeDetectionButton();
      } else {
        localStorage.setItem('motion_permission_status', 'denied');
        console.log('Motion detection permission denied');
        showToast('Shake detection not enabled', 'info');
        updateShakeDetectionButton();
      }
    } catch (error) {
      console.error('Motion permission request failed:', error);
      localStorage.setItem('motion_permission_status', 'denied');
      showToast('Could not enable shake detection', 'info');
    }
  } else {
    // Non-iOS device
    startShakeDetection();
    localStorage.setItem('motion_permission_status', 'granted');
    shakeDetectionState.permissionGranted = true;
    updateShakeDetectionButton();
  }
}

function startShakeDetection() {
  if (shakeDetectionState.permissionGranted) {
    console.log('Shake detection already started');
    return; // Already started
  }
  
  console.log('Starting shake detection - adding devicemotion listener');
  window.addEventListener('devicemotion', handleDeviceMotion, true);
  shakeDetectionState.permissionGranted = true;
  
  if (typeof logActivity === 'function') {
    logActivity('Shake detection activated.');
  }
  
  console.log('Shake detection is now active');
}

function handleDeviceMotion(event) {
  // Ignore motion events while an active shake alert/countdown is visible
  if (shakeDetectionState.alertActive) return;

  const current = event.accelerationIncludingGravity;
  
  if (!current || current.x === null || current.y === null || current.z === null) {
    return;
  }

  const currentTime = new Date().getTime();

  // Check cooldown period
  if (currentTime - shakeDetectionState.lastShakeTime < shakeDetectionState.cooldownPeriod) {
    return;
  }

  if (shakeDetectionState.lastTime === 0) {
    shakeDetectionState.lastX = current.x;
    shakeDetectionState.lastY = current.y;
    shakeDetectionState.lastZ = current.z;
    shakeDetectionState.lastTime = currentTime;
    return;
  }

  const deltaX = Math.abs(current.x - shakeDetectionState.lastX);
  const deltaY = Math.abs(current.y - shakeDetectionState.lastY);
  const deltaZ = Math.abs(current.z - shakeDetectionState.lastZ);

  // More sensitive shake detection
  if (
    (deltaX > shakeDetectionState.shakeThreshold && deltaY > shakeDetectionState.shakeThreshold) ||
    (deltaX > shakeDetectionState.shakeThreshold && deltaZ > shakeDetectionState.shakeThreshold) ||
    (deltaY > shakeDetectionState.shakeThreshold && deltaZ > shakeDetectionState.shakeThreshold)
  ) {
    // Shake detected!
    console.log('SHAKE DETECTED! deltaX:', deltaX, 'deltaY:', deltaY, 'deltaZ:', deltaZ);
    shakeDetectionState.lastShakeTime = currentTime;
    showShakeAlert();
  }

  shakeDetectionState.lastX = current.x;
  shakeDetectionState.lastY = current.y;
  shakeDetectionState.lastZ = current.z;
  shakeDetectionState.lastTime = currentTime;
}

function showShakeAlert() {
  console.log('showShakeAlert called');
  const shakeOverlay = document.getElementById('shake-alert-overlay');
  
  if (!shakeOverlay) {
    console.error('shake-alert-overlay element not found');
    return;
  }

  console.log('Shake overlay element found:', shakeOverlay);

  // Mark alert active so subsequent shakes are ignored until user acknowledges
  shakeDetectionState.alertActive = true;

  // Don't show if alarm is already active or panic is in progress
  const alarmOverlay = document.getElementById('alarm-overlay');
  const panicPreOverlay = document.getElementById('panic-pre-overlay');
  
  if (
    alarmOverlay?.classList.contains('visible') || 
    panicPreOverlay?.classList.contains('visible')
  ) {
    console.log('Not showing shake alert - alarm or panic already active');
    return;
  }

  console.log('Adding visible class to shake overlay');
  shakeOverlay.classList.add('visible');
  
  if (typeof logActivity === 'function') {
    logActivity('Shake detected. Emergency confirmation prompt shown.');
  }

  // Vibrate if supported
  if (navigator.vibrate) {
    console.log('Triggering vibration');
    navigator.vibrate([200, 100, 200]);
  }

  // Start 30-second auto-trigger countdown
  console.log('Starting auto-trigger countdown');
  startAutoTriggerCountdown();
}

function startAutoTriggerCountdown() {
  const countdownElement = document.getElementById('shake-countdown-timer');
  if (!countdownElement) return;

  // Reset countdown
  shakeDetectionState.autoTriggerCountdown = 30;
  countdownElement.textContent = shakeDetectionState.autoTriggerCountdown;

  // Clear any existing timer
  if (shakeDetectionState.autoTriggerTimer) {
    clearInterval(shakeDetectionState.autoTriggerTimer);
  }

  // Start countdown
  shakeDetectionState.autoTriggerTimer = setInterval(() => {
    shakeDetectionState.autoTriggerCountdown--;
    countdownElement.textContent = shakeDetectionState.autoTriggerCountdown;

    // Visual warning when countdown gets low
    if (shakeDetectionState.autoTriggerCountdown <= 10) {
      countdownElement.parentElement.style.backgroundColor = '#fed7d7';
      countdownElement.parentElement.style.borderColor = '#f56565';
    }

    // Auto-trigger when countdown reaches 0
    if (shakeDetectionState.autoTriggerCountdown <= 0) {
      clearInterval(shakeDetectionState.autoTriggerTimer);
      autoTriggerPanicAlert();
    }
  }, 1000);
}

function stopAutoTriggerCountdown() {
  if (shakeDetectionState.autoTriggerTimer) {
    clearInterval(shakeDetectionState.autoTriggerTimer);
    shakeDetectionState.autoTriggerTimer = null;
  }
}

function autoTriggerPanicAlert() {
  logActivity('Auto-triggered panic alert (no response to shake detection).');
  closeShakeAlert();
  
  // Trigger the panic button
  const panicBtn = document.getElementById('panic-trigger-btn');
  if (panicBtn) {
    panicBtn.click();
  }
}

function closeShakeAlert() {
  const shakeOverlay = document.getElementById('shake-alert-overlay');
  if (shakeOverlay) {
    shakeOverlay.classList.remove('visible');
  }
  
  // Stop the auto-trigger countdown
  stopAutoTriggerCountdown();
  
  // Reset countdown display
  const countdownElement = document.getElementById('shake-countdown-timer');
  if (countdownElement) {
    countdownElement.textContent = '30';
    countdownElement.parentElement.style.backgroundColor = '#fff5f5';
    countdownElement.parentElement.style.borderColor = '#fed7d7';
  }
}

function acknowledgeShake() {
  // User confirmed they're alright – close prompt and allow future shakes
  closeShakeAlert();
  shakeDetectionState.alertActive = false;
  if (typeof logActivity === 'function') logActivity('Shake alert acknowledged by user.');
  showToast('Shake alert dismissed', 'success');
}

// Initialize shake detection when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initializeShakeDetection();
  detectVibrationSupport();
});
