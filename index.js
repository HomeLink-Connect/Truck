'use strict';
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

const ROLES = ['SUPER_ADMIN','OWNER','FLEET_MANAGER','OPERATIONS_MANAGER','DISPATCHER',
               'FINANCE_MANAGER','MAINTENANCE_MANAGER','DRIVER','VIEWER'];
const ts = () => admin.firestore.FieldValue.serverTimestamp();

async function requireAdmin(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const r = req.auth.token.role;
  if (r !== 'SUPER_ADMIN' && r !== 'OWNER') throw new HttpsError('permission-denied', 'Only an Owner or Super Admin can manage users.');
  return r;
}

// Only a Super Admin may assign the Super Admin role.
function guardRole(actorRole, targetRole) {
  if (!ROLES.includes(targetRole)) throw new HttpsError('invalid-argument', 'Unknown role.');
  if (targetRole === 'SUPER_ADMIN' && actorRole !== 'SUPER_ADMIN')
    throw new HttpsError('permission-denied', 'Only a Super Admin can assign the Super Admin role.');
}

exports.createUserAccount = onCall(async (req) => {
  const actorRole = await requireAdmin(req);
  const { email, displayName, role } = req.data || {};
  if (typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpsError('invalid-argument', 'Enter a valid email address.');
  if (typeof displayName !== 'string' || displayName.trim().length < 2) throw new HttpsError('invalid-argument', "Enter the user's full name.");
  guardRole(actorRole, role);
  let user;
  try {
    user = await auth.createUser({ email, displayName: displayName.trim(), emailVerified: false,
      password: require('crypto').randomBytes(24).toString('base64url') });
  } catch (e) {
    if (e.code === 'auth/email-already-exists') throw new HttpsError('already-exists', 'A user with this email already exists.');
    throw new HttpsError('internal', 'Could not create the account.');
  }
  await auth.setCustomUserClaims(user.uid, { role });
  await db.doc(`users/${user.uid}`).set({ displayName: displayName.trim(), email, role, active: true, createdAt: ts(), createdBy: req.auth.uid });
  await writeAudit({ uid: req.auth.uid }, 'create', 'users', user.uid, { role: { old: null, new: role }, email: { old: null, new: email } });
  // The client then calls sendPasswordResetEmail(email): the user sets a password and the email becomes verified.
  return { uid: user.uid };
});

exports.setUserRole = onCall(async (req) => {
  const actorRole = await requireAdmin(req);
  const { uid, role } = req.data || {};
  guardRole(actorRole, role);
  if (uid === req.auth.uid) throw new HttpsError('failed-precondition', 'You cannot change your own role.');
  const snap = await db.doc(`users/${uid}`).get();
  if (!snap.exists) throw new HttpsError('not-found', 'User not found.');
  if (snap.data().role === 'SUPER_ADMIN' && actorRole !== 'SUPER_ADMIN') throw new HttpsError('permission-denied', 'Only a Super Admin can change a Super Admin.');
  await auth.setCustomUserClaims(uid, { role });
  await auth.revokeRefreshTokens(uid);
  await db.doc(`users/${uid}`).update({ role });
  await writeAudit({ uid: req.auth.uid }, 'update', 'users', uid, { role: { old: snap.data().role, new: role } });
  return { ok: true };
});

exports.setUserActive = onCall(async (req) => {
  await requireAdmin(req);
  const { uid, active } = req.data || {};
  if (uid === req.auth.uid) throw new HttpsError('failed-precondition', 'You cannot deactivate your own account.');
  if (typeof active !== 'boolean') throw new HttpsError('invalid-argument', 'active must be true or false.');
  await auth.updateUser(uid, { disabled: !active });
  if (!active) await auth.revokeRefreshTokens(uid);
  await db.doc(`users/${uid}`).update({ active });
  await writeAudit({ uid: req.auth.uid }, 'update', 'users', uid, { active: { old: !active, new: active } });
  return { ok: true };
});

exports.recordLogin = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const raw = req.rawRequest;
  await db.collection('loginHistory').add({
    uid: req.auth.uid, email: req.auth.token.email || null,
    ip: (raw.headers['x-forwarded-for'] || raw.ip || '').toString().split(',')[0].trim(),
    userAgent: (raw.headers['user-agent'] || '').slice(0, 250), at: ts()
  });
  await db.doc(`users/${req.auth.uid}`).set({ lastLoginAt: ts() }, { merge: true });
  return { ok: true };
});

// ---------- audit ----------
async function actorName(uid) {
  if (!uid) return 'System';
  const s = await db.doc(`users/${uid}`).get();
  return s.exists ? s.data().displayName : uid;
}
async function writeAudit(actor, action, collection, docId, changes) {
  await db.collection('auditLogs').add({
    actorUid: actor.uid || null, actorName: await actorName(actor.uid),
    action, collection, docId, changes, at: ts()
  });
}
const IGNORE = new Set(['updatedAt', 'updatedBy', 'createdAt', 'createdBy', 'searchKey']);

function auditTrigger(collection) {
  return onDocumentWritten(`${collection}/{id}`, async (event) => {
    const before = event.data.before.exists ? event.data.before.data() : null;
    const after = event.data.after.exists ? event.data.after.data() : null;
    const action = !before ? 'create' : !after ? 'delete' : 'update';
    const changes = {};
    const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
    for (const k of keys) {
      if (IGNORE.has(k)) continue;
      const o = before ? before[k] : undefined, n = after ? after[k] : undefined;
      if (JSON.stringify(o) !== JSON.stringify(n)) changes[k] = { old: o ?? null, new: n ?? null };
    }
    if (action === 'update' && !Object.keys(changes).length) return;
    const actorUid = (after || before).updatedBy || null;
    await writeAudit({ uid: actorUid }, action, collection, event.params.id, changes);
  });
}
exports.auditVehicles = auditTrigger('vehicles');
exports.auditDrivers = auditTrigger('drivers');
