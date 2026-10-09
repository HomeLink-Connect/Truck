// One-time bootstrap: node scripts/set-super-admin.js you@company.com "Your Name"
// Needs a service-account key: export GOOGLE_APPLICATION_CREDENTIALS=/path/key.json  (never commit this key)
const admin = require('../functions/node_modules/firebase-admin');
admin.initializeApp();
(async () => {
  const [email, name = 'Super Admin'] = process.argv.slice(2);
  if (!email) { console.error('Usage: node set-super-admin.js <email> [name]'); process.exit(1); }
  let user;
  try { user = await admin.auth().getUserByEmail(email); }
  catch { user = await admin.auth().createUser({ email, displayName: name, emailVerified: true }); }
  await admin.auth().updateUser(user.uid, { emailVerified: true, disabled: false });
  await admin.auth().setCustomUserClaims(user.uid, { role: 'SUPER_ADMIN' });
  await admin.firestore().doc(`users/${user.uid}`).set({
    displayName: user.displayName || name, email, role: 'SUPER_ADMIN', active: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  console.log('Super Admin ready:', email, '\nNow use "Forgot password" on the login screen to set your password.');
})();
