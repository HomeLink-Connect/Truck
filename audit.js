import { db, fs } from '../firebase.js';
import { $, esc, errMsg, fmtDateTime } from '../ui.js';

export default async function render(root) {
  let last = null;
  root.innerHTML = `<div class="page-head"><div><h1>Audit log</h1><p class="sub">Every change to vehicles, drivers and users. Entries are written by the server and cannot be edited.</p></div></div>
    <div class="toolbar"><select id="coll" aria-label="Filter by record type"><option value="">All record types</option><option value="vehicles">Vehicles</option><option value="drivers">Drivers</option><option value="users">Users</option></select></div>
    <div class="panel"><div id="rows"></div><div class="pager"><button class="btn" id="more">Load more</button></div></div>`;
  const fmtChanges = c => Object.entries(c || {}).map(([k, v]) => `<div><b>${esc(k)}</b>: <span class="old">${esc(v.old ?? '—')}</span> → <span class="new">${esc(v.new ?? '—')}</span></div>`).join('');
  async function load(reset) {
    if (reset) { last = null; $('#rows', root).innerHTML = '<div class="state">Loading…</div>'; }
    try {
      const f = $('#coll', root).value, cons = [];
      if (f) cons.push(fs.where('collection', '==', f));
      cons.push(fs.orderBy('at', 'desc')); if (last) cons.push(fs.startAfter(last)); cons.push(fs.limit(25));
      const snap = await fs.getDocs(fs.query(fs.collection(db, 'auditLogs'), ...cons));
      if (reset && snap.empty) { $('#rows', root).innerHTML = '<div class="state"><strong>No activity recorded yet</strong><p>Changes appear here a few seconds after they are saved.</p></div>'; $('#more', root).disabled = true; return; }
      const html = snap.docs.map(d => { const x = d.data(); return `<tr><td data-label="When">${fmtDateTime(x.at)}</td><td data-label="User">${esc(x.actorName)}</td><td data-label="Action"><span class="badge ${x.action === 'delete' ? 'bad' : x.action === 'create' ? 'good' : 'info'}">${esc(x.action)}</span></td><td data-label="Record">${esc(x.collection)} / ${esc(x.docId)}</td><td data-label="Changes" class="changes">${fmtChanges(x.changes)}</td></tr>`; }).join('');
      if (reset) $('#rows', root).innerHTML = `<table class="data"><thead><tr><th>When</th><th>User</th><th>Action</th><th>Record</th><th>Changes</th></tr></thead><tbody>${html}</tbody></table>`;
      else $('#rows tbody', root).insertAdjacentHTML('beforeend', html);
      last = snap.docs[snap.docs.length - 1] || last; $('#more', root).disabled = snap.docs.length < 25;
    } catch (e) { console.error(e); $('#rows', root).innerHTML = `<div class="state err">${esc(errMsg(e))}</div>`; }
  }
  $('#coll', root).onchange = () => load(true); $('#more', root).onclick = () => load(false); load(true);
}
