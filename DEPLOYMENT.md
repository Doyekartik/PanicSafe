# PanicSafe Cloud Deployment Guide 🚀

This guide explains how to deploy PanicSafe so that you can open it on your mobile phone (without running it locally on your computer) for free. 

**Note on Security**: Secure HTTPS (`https://`) is required by modern mobile browsers to enable the **Contact Picker API** (accessing your device's address book) and **browser geolocation tracking**. All options below automatically provide HTTPS security!

## Recommended: Vercel for iPhone

Vercel can host PanicSafe over HTTPS, which is what iPhone Safari needs for location access. This project includes `api/sos-alert.js`, a Vercel serverless function that accepts SOS payloads and sends SMS through Twilio when the Twilio environment variables are configured.

On Vercel:

1. Import the project or drag and drop the `PanicSafe` folder.
2. Open **Settings > Environment Variables**.
3. Add:
   ```bash
   TWILIO_ACCOUNT_SID=your_twilio_account_sid
   TWILIO_AUTH_TOKEN=your_twilio_auth_token
   TWILIO_FROM_NUMBER=+12405495724
   SMS_DEFAULT_COUNTRY_CODE=+91
   VAPID_PUBLIC_KEY=your_web_push_public_key
   VAPID_PRIVATE_KEY=your_web_push_private_key
   VAPID_SUBJECT=mailto:you@example.com
   ```
4. Redeploy the project.
5. Open the `https://...vercel.app` URL on iPhone Safari.
6. Tap **Share > Add to Home Screen** to install it like an app.

On Vercel, contacts are saved in the phone browser's local storage. The timer sends those contacts to the serverless SOS endpoint when an alert fires.

To enable Firebase Google login:

1. In Firebase Console, open **Authentication > Sign-in method**.
2. Enable **Google** as a provider.
3. Open **Authentication > Settings > Authorized domains**.
4. Add your Vercel domain, such as `your-app.vercel.app`.
5. Open **Firestore Database** and create a database so profile saves can write to `users/{uid}`.
6. In Firestore **Rules**, use the rules in `firestore.rules` so each signed-in user can only access their own profile.

To enable connected-user iPhone notifications, generate Web Push VAPID keys:

```bash
npx web-push generate-vapid-keys
```

Add the public/private keys to Vercel as `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`, then redeploy. Each connected user must open PanicSafe from their iPhone Home Screen and tap **Enable iPhone Notifications** so their device subscription can be saved.

---

## 🌐 Option 1: Full-Stack Server Cloud Hosting (Render)
*Best for saving contacts in a persistent remote database (`contacts.json`) across all devices.*

1. **Upload to GitHub**:
   - Create a free account on [GitHub](https://github.com/) if you don't have one.
   - Create a new repository called `PanicSafe`.
   - Push your project files (`index.html`, `style.css`, `app.js`, `server.js`, `package.json`, `contacts.json`) to that repository.

2. **Deploy to Render**:
   - Create a free account on [Render](https://render.com/).
   - Click **New +** in the top right and select **Web Service**.
   - Connect your GitHub account and select your `PanicSafe` repository.
   - Configure the following settings:
     - **Runtime**: `Node`
     - **Build Command**: *Leave blank* (since our app requires no build step!)
     - **Start Command**: `node server.js` (Render should pull this from `package.json` automatically)
     - **Instance Type**: `Free`
   - Click **Deploy Web Service**.

3. **Open on Phone**:
   - Render will build and launch your server.
   - Once the deployment shows a green "Live" status, Render will provide a public URL in the top left (e.g., `https://panicsafe-abcd.onrender.com`).
   - Open this URL on your phone! It will connect to the cloud database database.

---

## ⚡ Option 2: Super-Fast Static Hosting (Vercel)
*Best for instant 10-second setup, ultra-fast loading, and full mobile integration using offline-first sandbox mode.*

Because PanicSafe is built with a smart fallback engine, if the backend server is offline, the app runs completely inside the browser client and saves contacts to your phone's native local storage. This runs with zero server lag!

1. **Deploy in 10 Seconds (No Code, Drag & Drop)**:
   - Create a free account on [Vercel](https://vercel.com/).
   - Go to your Vercel Dashboard, click **Add New** and choose **Project**.
   - Under the import fields, click the link to **"Browse all templates or drag and drop a folder"** (or go to [vercel.com/deploy](https://vercel.com/deploy)).
   - Drag and drop your local `PanicSafe` folder directly into the box!
   
2. **Access on Phone**:
   - Vercel will instantly host your static files and give you a secure `https://...vercel.app` URL.
   - Open it on your phone! All features (interactive maps, native address book picking, timers) will work.

---

## 🔄 Option 3: Local Tunneling (Instant Phone Testing)
*Best for testing your local computer code on your mobile phone immediately without deploying to the cloud.*

If you have Node.js installed on your computer, you can tunnel your active local server securely over the internet:

1. **Start the local server**:
   - In your workspace terminal, start the backend:
     ```bash
     node server.js
     ```

2. **Launch a secure tunnel**:
   - Open a *second* terminal window and run:
     ```bash
     npx localtunnel --port 3000
     ```
   - This command will generate a public secure URL:
     ```
     your url is: https://cool-panda-5.localtunnel.me
     ```

3. **Test on Phone**:
   - Type that `https` URL into your mobile phone's web browser.
   - Your phone will communicate directly with your computer's local database!
