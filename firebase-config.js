// Firebase web app config. This config is public by design; security comes from
// Auth + Firestore/Storage rules + App Check, not from hiding these values.
export const firebaseConfig = {
  apiKey: "AIzaSyCgTv9zCdz0eTQSgv5hUlqQ0QxaApI6jsQ",
  authDomain: "truck-project-261bf.firebaseapp.com",
  projectId: "truck-project-261bf",
  storageBucket: "truck-project-261bf.firebasestorage.app",
  messagingSenderId: "399205379833",
  appId: "1:399205379833:web:610783782711f6ffa03c28"
};
export const isConfigured = !Object.values(firebaseConfig).some(v => String(v).startsWith('PASTE_'));
