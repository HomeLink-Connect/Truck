import { db, fs, fa, auth, call } from '../firebase.js';
import { session } from '../auth.js';
import { ROLES } from '../rbac.js';
import { $, $$, esc, modal, toast, confirmDialog, errMsg, badge, fmtDateTime } from '../ui.js';
import { V } from '../validators.js';

export default async function render(root) {
  root.innerHTML = `<div class="page-head"><div><h1>Users</h1><p class="sub">People who can sign in. Roles control what each person can see and change.</p></div>
    <button class="btn primary" id="add">Add user</button></div><div class="panel"><div id="rows" class="state">Loading…</div></div>`;
  const roleOptions = Object.entries(ROLES).filter(([k]) => session.role === 'SUPER_ADMIN' || k !== 'SUPER_ADMIN');

  async function load() {
    try {
      const snap = await fs.getDocs(fs.query(fs.collection(db, 'users'), fs.orderBy('displayName'), fs.limit(200)));
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      $('#rows', root).className = '';
      $('#rows', root).innerHTML = `<table class="data"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last sign-in</th><th></th></tr></thead><tbody>${rows.map(u => `
        <tr data-id="${u.id}"><td data-label="Name">${esc(u.displayName)}</td><td data-label="Email">${esc(u.email)}</td>
        <td data-label="Role">${u.id === session.user.uid ? esc(ROLES[u.role]) : `<select data-role aria-label="Role for ${esc(u.displayName)}">${roleOptions.map(([k, v]) => `<option value="${k}" ${k === u.role ? 'selected' : ''}>${v}</option>`).join('')}</select>`}</td>
        <td data-label="Status">${badge(u.active ? 'Active' : 'Suspended').replace('Suspended', 'Deactivated')}</td><td data-label="Last sign-in">${fmtDateTime(u.lastLoginAt)}</td>
        <td class="actions-col">${u.id === session.user.uid ? '' : `<button class="btn" data-toggle>${u.active ? 'Deactivate' : 'Activate'}</button>`}</td></tr>`).join('')}</tbody></table>`;
      $$('tr[data-id]', root).forEach(tr => {
        const u = rows.find(r => r.id === tr.dataset.id);
        $('[data-role]', tr)?.addEventListener('change', async e => {
          try { await call('setUserRole')({ uid: u.id, role: e.target.value }); toast('Role updated. The user must sign in again.'); }
          catch (err) { toast(errMsg(err), 'err'); load(); }
        });
        $('[data-toggle]', tr)?.addEventListener('click', async () => {
          if (u.active && !(await confirmDialog('Deactivate user', `${u.displayName} will be signed out and unable to sign in.`, 'Deactivate', true))) return;
          try { await call('setUserActive')({ uid: u.id, active: !u.active }); toast(u.active ? 'User deactivated.' : 'User activated.'); load(); }
          catch (err) { toast(errMsg(err), 'err'); }
        });
      });
    } catch (e) { console.error(e); $('#rows', root).className = 'state err'; $('#rows', root).textContent = errMsg(e); }
  }

  $('#add', root).onclick = () => modal({ title: 'Add user', body: `<div class="form"><div class="grid">
      <div class="field"><label for="u_name">Full name <span class="req">*</span></label><input id="u_name"><small class="error" id="e_name"></small></div>
      <div class="field"><label for="u_email">Email <span class="req">*</span></label><input id="u_email" type="email"><small class="error" id="e_email"></small></div>
      <div class="field"><label for="u_role">Role <span class="req">*</span></label><select id="u_role">${roleOptions.map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div></div>
      <p class="note">We email the person a link to set their password. Their email is verified when they use it.</p></div>`,
    actions: [{ label: 'Cancel', onClick: ({ close }) => close() }, { label: 'Create user', kind: 'primary', onClick: async ({ close, button, root: m }) => {
      const name = $('#u_name', m).value.trim(), email = $('#u_email', m).value.trim(), role = $('#u_role', m).value;
      $('#e_name', m).textContent = V.required(name) || ''; $('#e_email', m).textContent = V.required(email) || V.email(email) || '';
      if (V.required(name) || V.required(email) || V.email(email)) return;
      button.disabled = true; button.textContent = 'Creating…';
      try { await call('createUserAccount')({ displayName: name, email, role }); await fa.sendPasswordResetEmail(auth, email); toast(`User created. A password setup email was sent to ${email}.`); close(); load(); }
      catch (e) { toast(errMsg(e), 'err'); button.disabled = false; button.textContent = 'Create user'; }
    } }] });
  load();
}
