# FleetOps — setup (Phase 1: foundation, vehicles, drivers, users, audit log)

## 1. Firebase project
1. Create a project in the Firebase console. Upgrade to **Blaze** (Functions need it).
2. Enable **Authentication → Email/Password**, **Firestore**, **Storage**.
3. Add a **Web app** and paste its config into `public/js/firebase-config.js`.
4. (Recommended) Enable **App Check** with reCAPTCHA Enterprise, and add your hosting domain under Auth → Settings → Authorized domains.

## 2. Deploy backend
```bash
npm i -g firebase-tools && firebase login
firebase use --add            # pick your project
cd functions && npm install && cd ..
firebase deploy --only firestore:rules,firestore:indexes,storage,functions
```

## 3. Create the first Super Admin (one time)
Download a service-account key (Project settings → Service accounts). **Never commit it.**
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
node scripts/set-super-admin.js you@company.com "Your Name"
```
Open the app, enter that email, choose **Forgot password**, set a password, sign in. After that, add everyone else from the **Users** page.

## 4. Run locally / deploy
ES modules need http, not file://:
```bash
firebase emulators:start --only hosting     # or: npx serve public
firebase deploy --only hosting
```

## What is real in this drop
Auth with email verification, role claims, RBAC in rules, validated CRUD with server-side rule checks, server-written immutable audit log, user management via Cloud Functions, login history (success), PWA shell.

## What is NOT built yet (no placeholders in the UI)
Trips, border events, cargo, fuel, maintenance, documents upload, expenses, revenue, reports, GPS ingest and live map, driver app, push notifications. Failed-login monitoring needs Identity Platform blocking functions.
