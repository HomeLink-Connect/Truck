import { auth, fa, call } from './firebase.js';
import { errMsg } from './ui.js';

export const session = { user: null, role: null, name: '' };

export async function signIn(email, password) {
  const cred = await fa.signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}
export const signOut = () => fa.signOut(auth);
export const resetPassword = email => fa.sendPasswordResetEmail(auth, email.trim());
export const resendVerification = () => fa.sendEmailVerification(auth.currentUser);

// Loads claims; role comes from the signed token, never from anything the user can edit.
export async function loadSession(user) {
  const tok = await user.getIdTokenResult(true);
  session.user = user; session.role = tok.claims.role || null; session.name = user.displayName || user.email;
  return session;
}

export function onSession(cb) {
  return fa.onAuthStateChanged(auth, async user => {
    if (!user) { session.user = null; session.role = null; return cb(null); }
    try { await loadSession(user); cb(session); }
    catch (e) { console.error(e); cb(null, errMsg(e)); }
  });
}
export const recordLogin = () => call('recordLogin')().catch(e => console.warn('recordLogin failed', e));
