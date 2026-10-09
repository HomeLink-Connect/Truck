import { isConfigured } from './firebase-config.js';
import { $, $$, esc, icon, toast, errMsg } from './ui.js';

const app = document.getElementById('app');

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(e => console.warn('Service worker not registered', e));
window.addEventListener('offline', () => toast('You are offline. Changes cannot be saved until you reconnect.', 'err'));
window.addEventListener('online', () => toast('Back online.'));

const brand = `<div class="brand"><svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#F2A900"/><path d="M6 21V11h12v10M18 14h5l3 3v4H18M10 24a2 2 0 100-.01M22 24a2 2 0 100-.01" fill="none" stroke="#15222C" stroke-width="2" stroke-linejoin="round"/></svg>
  <span>FleetOps<small>Your company name here</small></span></div>`; // replace with the client's logo and name

if (!isConfigured) {
  app.innerHTML = `<main class="center-card"><div class="card">${brand}<h1>Connect your Firebase project</h1>
    <p>Open <code>public/js/firebase-config.js</code> and paste your web app config from the Firebase console (Project settings → Your apps).</p>
    <p>Then deploy the rules and functions, and create the first Super Admin. Steps are in <code>README.md</code>.</p></div></main>`;
} else boot();

async function boot() {
  const { onSession } = await import('./auth.js');
  onSession((session, err) => {
    if (err) return screenMessage('Could not load your session', err);
    if (!session) return loginScreen();
    if (!session.user.emailVerified) return verifyScreen(session);
    if (!session.role) return screenMessage('Account not set up', 'Your account has no role yet. Ask your administrator to assign one, then sign in again.', true);
    shell(session);
  });
}

function screenMessage(title, msg, signOutBtn = false) {
  app.innerHTML = `<main class="center-card"><div class="card">${brand}<h1>${esc(title)}</h1><p>${esc(msg)}</p>${signOutBtn ? '<button class="btn" id="so">Sign out</button>' : ''}</div></main>`;
  $('#so')?.addEventListener('click', async () => (await import('./auth.js')).signOut());
}

function loginScreen() {
  app.innerHTML = `<main class="center-card"><form class="card" id="login" novalidate>${brand}<h1>Sign in</h1>
    <div class="field"><label for="em">Email</label><input id="em" type="email" autocomplete="username" required></div>
    <div class="field"><label for="pw">Password</label><input id="pw" type="password" autocomplete="current-password" required></div>
    <p class="error" id="err" role="alert"></p>
    <button class="btn primary block" id="go">Sign in</button>
    <button class="link" type="button" id="forgot">Forgot password?</button></form></main>`;
  $('#login').addEventListener('submit', async e => {
    e.preventDefault(); const A = await import('./auth.js'); const em = $('#em').value, pw = $('#pw').value;
    if (!em || !pw) { $('#err').textContent = 'Enter your email and password.'; return; }
    $('#go').disabled = true; $('#go').textContent = 'Signing in…'; $('#err').textContent = '';
    try { await A.signIn(em, pw); A.recordLogin(); }
    catch (x) { $('#err').textContent = errMsg(x); $('#go').disabled = false; $('#go').textContent = 'Sign in'; }
  });
  $('#forgot').onclick = async () => {
    const em = $('#em').value.trim(); if (!em) { $('#err').textContent = 'Type your email above, then select Forgot password.'; return; }
    try { await (await import('./auth.js')).resetPassword(em); toast('If that email has an account, a reset link is on its way.'); } catch (x) { $('#err').textContent = errMsg(x); }
  };
}

function verifyScreen() {
  app.innerHTML = `<main class="center-card"><div class="card">${brand}<h1>Verify your email</h1><p>Your email address has not been verified yet. Use the link in the email we sent, or request a new one.</p>
    <button class="btn primary" id="rs">Send verification email</button> <button class="btn" id="rl">I have verified — continue</button> <button class="link" id="so">Sign out</button></div></main>`;
  $('#rs').onclick = async () => { try { await (await import('./auth.js')).resendVerification(); toast('Verification email sent.'); } catch (x) { toast(errMsg(x), 'err'); } };
  $('#rl').onclick = async () => { const A = await import('./auth.js'); const { auth } = await import('./firebase.js'); await auth.currentUser.reload(); location.reload(); };
  $('#so').onclick = async () => (await import('./auth.js')).signOut();
}

async function shell(session) {
  const { can, ROLES } = await import('./rbac.js'); const A = await import('./auth.js');
  if (session.role === 'DRIVER') return screenMessage('Driver app not available yet', 'The driver mobile experience is planned for a later phase. Your administrator can still manage your records.', true);
  const NAV = [
    { id: 'dashboard', label: 'Overview', icon: 'dashboard', load: () => import('./modules/dashboard.js') },
    { id: 'vehicles', label: 'Vehicles', icon: 'truck', load: () => import('./modules/vehicles.js') },
    { id: 'drivers', label: 'Drivers', icon: 'driver', load: () => import('./modules/drivers.js') },
    { id: 'users', label: 'Users', icon: 'users', load: () => import('./modules/users.js') },
    { id: 'audit', label: 'Audit log', icon: 'audit', load: () => import('./modules/audit.js') }
  ].filter(n => can(session.role, n.id, 'read'));

  app.innerHTML = `<div class="shell"><aside class="side" id="side">${brand}<nav aria-label="Main">${NAV.map(n => `<a href="#/${n.id}" data-nav="${n.id}">${icon(n.icon)}<span>${n.label}</span></a>`).join('')}</nav>
    <div class="side-foot"><div class="who"><b>${esc(session.name)}</b><small>${esc(ROLES[session.role])}</small></div><button class="btn ghost" id="so">${icon('logout')} Sign out</button></div></aside>
    <div class="scrim" id="scrim"></div>
    <div class="main"><header class="top"><button class="icon-btn menu" id="menu" aria-label="Open menu">${icon('menu', 22)}</button><span class="top-title" id="ttl"></span><span class="net" id="net"></span></header>
    <main id="view" tabindex="-1"></main></div></div>`;
  $('#so').onclick = () => A.signOut();
  const side = $('#side'), scrim = $('#scrim');
  const toggle = open => { side.classList.toggle('open', open); scrim.classList.toggle('on', open); };
  $('#menu').onclick = () => toggle(true); scrim.onclick = () => toggle(false);
  const net = () => { $('#net').textContent = navigator.onLine ? '' : 'Offline'; }; net(); window.addEventListener('online', net); window.addEventListener('offline', net);

  async function route() {
    const id = (location.hash.replace('#/', '') || 'dashboard'); const item = NAV.find(n => n.id === id) || NAV[0];
    $$('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === item.id)); $('#ttl').textContent = item.label; toggle(false);
    const view = $('#view'); view.innerHTML = '<div class="state">Loading…</div>';
    try { const m = await item.load(); await m.default(view); view.focus({ preventScroll: true }); }
    catch (e) { console.error(e); view.innerHTML = `<div class="state err">${esc(errMsg(e))}</div>`; }
  }
  window.addEventListener('hashchange', route); route();
}
