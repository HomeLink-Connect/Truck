export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICONS = {
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  truck: 'M3 6h11v9H3zM14 9h4l3 3v3h-7zM7 18.5a1.5 1.5 0 1 0 0-.01M17 18.5a1.5 1.5 0 1 0 0-.01',
  driver: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9c0-4 4-6 8-6s8 2 8 6',
  users: 'M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2c-3 0-6 1.5-6 4v2h12v-2c0-2.5-3-4-6-4zm8 0c-.5 0-1 0-1.500.1 1.600 1 2.500 2.300 2.500 3.900v2h5v-2c0-2.500-3-4-6-4z',
  audit: 'M6 2h9l5 5v15H6zM14 2v6h6M9 13h7M9 17h7',
  menu: 'M3 6h18M3 12h18M3 18h18', logout: 'M10 4H4v16h6M16 8l4 4-4 4M20 12H9',
  plus: 'M12 5v14M5 12h14', search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4', trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13', close: 'M6 6l12 12M18 6L6 18'
};
export const icon = (n, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[n] || ''}"/></svg>`;

export function toast(msg, type = 'ok') {
  let box = $('#toasts'); if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); document.body.append(box); }
  const t = document.createElement('div'); t.className = `toast ${type}`; t.textContent = msg; box.append(t);
  setTimeout(() => t.remove(), type === 'err' ? 7000 : 3500);
}

export function modal({ title, body, actions = [], wide = false }) {
  const wrap = document.createElement('div'); wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <header><h2>${esc(title)}</h2><button class="icon-btn" data-x aria-label="Close">${icon('close')}</button></header>
    <div class="modal-body"></div><footer></footer></div>`;
  const bodyEl = $('.modal-body', wrap); typeof body === 'string' ? bodyEl.innerHTML = body : bodyEl.append(body);
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  $('[data-x]', wrap).onclick = close;
  wrap.addEventListener('mousedown', e => { if (e.target === wrap) close(); });
  const foot = $('footer', wrap);
  actions.forEach(a => { const b = document.createElement('button'); b.className = `btn ${a.kind || ''}`; b.textContent = a.label; b.onclick = () => a.onClick({ close, button: b, root: wrap }); foot.append(b); });
  document.body.append(wrap);
  (wrap.querySelector('input,select,textarea,button.btn') || wrap).focus();
  return { close, root: wrap };
}

export const confirmDialog = (title, message, confirmLabel = 'Confirm', danger = false) => new Promise(res => {
  modal({ title, body: `<p>${esc(message)}</p>`, actions: [
    { label: 'Cancel', onClick: ({ close }) => { close(); res(false); } },
    { label: confirmLabel, kind: danger ? 'danger' : 'primary', onClick: ({ close }) => { close(); res(true); } }] });
});

export const fmtDate = v => { const d = v?.toDate ? v.toDate() : v ? new Date(v) : null; return d && !isNaN(d) ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; };
export const fmtDateTime = v => { const d = v?.toDate ? v.toDate() : v ? new Date(v) : null; return d && !isNaN(d) ? d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; };
export const fmtNum = v => v === '' || v == null ? '—' : Number(v).toLocaleString('en-US');

export const STATUS_TONE = {
  'Available': 'good', 'Assigned': 'info', 'Loading': 'info', 'In Transit': 'info', 'At Border': 'warn', 'Delivered': 'good',
  'Parked': 'muted', 'Maintenance': 'warn', 'Breakdown': 'bad', 'Accident': 'bad', 'Inactive': 'muted',
  'Active': 'good', 'On Leave': 'warn', 'Suspended': 'bad', 'Terminated': 'muted'
};
export const badge = s => `<span class="badge ${STATUS_TONE[s] || 'muted'}">${esc(s || '—')}</span>`;

// Expiry helper: returns {label, tone}
export function expiryState(dateStr) {
  if (!dateStr) return { label: 'Not set', tone: 'muted' };
  const days = Math.floor((new Date(dateStr) - new Date().setHours(0, 0, 0, 0)) / 86400000);
  if (days < 0) return { label: `Expired ${-days}d ago`, tone: 'bad' };
  if (days <= 30) return { label: `Expires in ${days}d`, tone: 'warn' };
  return { label: fmtDate(dateStr), tone: 'good' };
}

// Maps Firebase/Functions errors to messages a person can act on.
export function errMsg(e) {
  const c = e?.code || '';
  const map = {
    'permission-denied': 'You do not have permission to do this.',
    'functions/permission-denied': 'You do not have permission to do this.',
    'unavailable': 'Cannot reach the server. Check your internet connection and try again.',
    'auth/invalid-credential': 'Email or password is incorrect.', 'auth/wrong-password': 'Email or password is incorrect.',
    'auth/user-not-found': 'Email or password is incorrect.', 'auth/too-many-requests': 'Too many attempts. Wait a few minutes or reset your password.',
    'auth/user-disabled': 'This account has been deactivated. Contact your administrator.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
    'failed-precondition': 'This query needs a Firestore index. Run "firebase deploy --only firestore:indexes" or follow the link in the browser console.',
    'unauthenticated': 'Your session has expired. Sign in again.'
  };
  return map[c] || map[c.replace('functions/', '')] || e?.message || 'Something went wrong. Try again.';
}
