# PanicSafe Android APK Build

This wraps the deployed PanicSafe PWA as an Android app using Capacitor.

## 1. Set the deployed URL

Open `capacitor.config.json` and replace:

```json
"url": "https://YOUR-PANICSAFE-VERCEL-URL.vercel.app"
```

with your real Vercel URL.

The APK should load the deployed site because PanicSafe uses Vercel API routes such as `/api/send-push-alert` and `/api/push-config`.

## 2. Install dependencies

```powershell
npm install
```

## 3. Create Android project

```powershell
npm run android:init
npm run android:sync
```

## 4. Build APK

Open Android Studio:

```powershell
npm run android:open
```

Then use:

```text
Build > Build Bundle(s) / APK(s) > Build APK(s)
```

The APK will be created inside the Android project output folder.

## Notes

Android will install this like a real app. iPhone still uses Add to Home Screen unless you later build a native iOS app through Xcode.
