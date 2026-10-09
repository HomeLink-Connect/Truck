import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import * as fa from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import * as fs from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import * as ff from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js';
import { firebaseConfig } from './firebase-config.js';

export const app = initializeApp(firebaseConfig);
export const auth = fa.getAuth(app);
// Local cache lets the shell and previously loaded lists work on weak connections.
export const db = fs.initializeFirestore(app, {
  localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() })
});
export const functions = ff.getFunctions(app);
export const call = (name) => ff.httpsCallable(functions, name);
export { fa, fs };
