import { db, fs } from './firebase.js';
import { session } from './auth.js';
import { can } from './rbac.js';
import { $, $$, esc, icon, toast, modal, confirmDialog, errMsg, fmtNum } from './ui.js';
import { V } from './validators.js';

const PAGE = 25;

/**
 * cfg: { mod, coll, title, singular, idField, searchField, statusField, statusOptions,
 *        fields:[{key,label,type,required,options,validate,help,col,section,format}], columns:[key|fn], deleteLabel }
 */
export function entityModule(cfg) {
  return async function render(root) {
    const canWrite = can(session.role, cfg.mod, 'write'), canDelete = can(session.role, cfg.mod, 'delete');
    const state = { pages: [], cursors: [null], page: 0, q: '', status: '' };

    root.innerHTML = `
      <div class="page-head"><div><h1>${esc(cfg.title)}</h1><p class="sub" id="count"></p></div>
        ${canWrite ? `<button class="btn primary" id="add">${icon('plus')} Add ${esc(cfg.singular)}</button>` : ''}</div>
      <div class="toolbar">
        <label class="search">${icon('search')}<input id="q" type="search" placeholder="Search by ${esc(cfg.searchLabel)}" aria-label="Search"></label>
        <select id="status" aria-label="Filter by status"><option value="">All statuses</option>${cfg.statusOptions.map(s => `<option>${esc(s)}</option>`).join('')}</select>
      </div>
      <div class="panel"><div id="table"></div>
        <div class="pager"><button class="btn" id="prev">Previous</button><span id="pageno"></span><button class="btn" id="next">Next</button></div></div>`;

    async function load() {
      const tbl = $('#table', root); tbl.innerHTML = '<div class="state">Loading…</div>';
      try {
        const cons = [];
        if (state.status) cons.push(fs.where(cfg.statusField, '==', state.status));
        if (state.q) {
          const q = state.q.toLowerCase().replace(/\s+/g, '');
          cons.push(fs.where(cfg.searchField, '>=', q), fs.where(cfg.searchField, '<=', q + '\uf8ff'));
        }
        cons.push(fs.orderBy(cfg.searchField));
        if (state.cursors[state.page]) cons.push(fs.startAfter(state.cursors[state.page]));
        cons.push(fs.limit(PAGE + 1));
        const snap = await fs.getDocs(fs.query(fs.collection(db, cfg.coll), ...cons));
        const docs = snap.docs, more = docs.length > PAGE, rows = docs.slice(0, PAGE);
        state.cursors[state.page + 1] = more ? rows[rows.length - 1] : null;
        state.rows = rows.map(d => ({ id: d.id, ...d.data() }));
        draw(more);
      } catch (e) { console.error(e); tbl.innerHTML = `<div class="state err">${esc(errMsg(e))}<br><button class="btn" id="retry">Try again</button></div>`; $('#retry', root).onclick = load; }
    }

    function draw(more) {
      const tbl = $('#table', root);
      $('#pageno', root).textContent = `Page ${state.page + 1}`;
      $('#prev', root).disabled = state.page === 0; $('#next', root).disabled = !more;
      $('#count', root).textContent = state.rows.length ? `Showing ${state.rows.length} on this page` : '';
      if (!state.rows.length) {
        tbl.innerHTML = `<div class="state"><strong>${state.q || state.status ? 'No matches' : `No ${esc(cfg.title.toLowerCase())} yet`}</strong>
          <p>${state.q || state.status ? 'Try a different search or clear the filter.' : canWrite ? `Add your first ${esc(cfg.singular)} to get started.` : 'Nothing has been added yet.'}</p></div>`; return;
      }
      const cols = cfg.columns.map(k => cfg.fields.find(f => f.key === k));
      tbl.innerHTML = `<table class="data"><thead><tr>${cols.map(c => `<th>${esc(c.label)}</th>`).join('')}<th class="actions-col"><span class="sr">Actions</span></th></tr></thead><tbody>
        ${state.rows.map(r => `<tr data-id="${esc(r.id)}">${cols.map(c => `<td data-label="${esc(c.label)}">${c.format ? c.format(r[c.key], r) : esc(r[c.key] ?? '—')}</td>`).join('')}
        <td class="actions-col">${canWrite ? `<button class="icon-btn" data-edit aria-label="Edit ${esc(r.id)}">${icon('edit')}</button>` : ''}${canDelete ? `<button class="icon-btn danger" data-del aria-label="Delete ${esc(r.id)}">${icon('trash')}</button>` : ''}</td></tr>`).join('')}</tbody></table>`;
      $$('tr[data-id]', tbl).forEach(tr => {
        const row = state.rows.find(r => r.id === tr.dataset.id);
        $('[data-edit]', tr)?.addEventListener('click', () => form(row));
        $('[data-del]', tr)?.addEventListener('click', () => remove(row));
      });
    }

    function fieldHtml(f, val) {
      const id = `f_${f.key}`, v = val ?? '', req = f.required ? ' required' : '';
      let input;
      if (f.type === 'select') input = `<select id="${id}"${req}><option value="">Select…</option>${f.options.map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
      else if (f.type === 'textarea') input = `<textarea id="${id}" rows="3" maxlength="1000">${esc(v)}</textarea>`;
      else input = `<input id="${id}" type="${f.type || 'text'}" value="${esc(v)}"${req}${f.type === 'number' ? ' min="0" step="any"' : ''}${f.readonly ? ' readonly' : ''}>`;
      return `<div class="field ${f.wide ? 'wide' : ''}"><label for="${id}">${esc(f.label)}${f.required ? ' <span class="req">*</span>' : ''}</label>${input}${f.help ? `<small>${esc(f.help)}</small>` : ''}<small class="error" id="e_${f.key}"></small></div>`;
    }

    function form(row) {
      const editing = !!row;
      let html = '', section = null;
      cfg.fields.forEach(f => {
        if (f.section && f.section !== section) { if (section) html += '</div>'; html += `<h3>${esc(f.section)}</h3><div class="grid">`; section = f.section; }
        html += fieldHtml(f.key === cfg.idField && editing ? { ...f, readonly: true, help: 'The ID cannot be changed.' } : f, row?.[f.key]);
      });
      html += '</div>';
      const m = modal({ title: editing ? `Edit ${cfg.singular}` : `Add ${cfg.singular}`, body: `<div class="form">${html}</div>`, wide: true, actions: [
        { label: 'Cancel', onClick: ({ close }) => close() },
        { label: editing ? 'Save changes' : `Add ${cfg.singular}`, kind: 'primary', onClick: ctx => save(ctx, row) }] });
    }

    async function save({ close, button, root: mroot }, row) {
      const data = {}; let ok = true;
      cfg.fields.forEach(f => {
        const el = $(`#f_${f.key}`, mroot); let v = el.value.trim();
        if (f.type === 'number' && v !== '') v = Number(v);
        if (f.key === 'year' && v !== '') v = Number(v);
        const checks = [f.required ? V.required(v) : null, f.validate ? f.validate(v) : null,
          f.type === 'number' ? V.nonNegative(v) : null, f.type === 'date' ? V.date(v) : null].filter(Boolean);
        $(`#e_${f.key}`, mroot).textContent = checks[0] || ''; el.setAttribute('aria-invalid', checks[0] ? 'true' : 'false');
        if (checks[0]) ok = false; data[f.key] = v;
      });
      if (!ok) { toast('Fix the highlighted fields and try again.', 'err'); return; }
      button.disabled = true; button.textContent = 'Saving…';
      try {
        const id = (row?.id || data[cfg.idField]).toUpperCase(); data[cfg.idField] = id;
        const ref = fs.doc(db, cfg.coll, id);
        if (!row && (await fs.getDoc(ref)).exists()) { $(`#e_${cfg.idField}`, mroot).textContent = `${cfg.idLabel} ${id} already exists.`; throw { soft: true }; }
        data.searchKey = String(data[cfg.searchField === 'searchKey' ? cfg.searchSource : cfg.searchField] ?? '').toLowerCase().replace(/\s+/g, '');
        data.updatedBy = session.user.uid; data.updatedAt = fs.serverTimestamp();
        if (!row) { data.createdBy = session.user.uid; data.createdAt = fs.serverTimestamp(); }
        await fs.setDoc(ref, data, { merge: true });
        toast(`${cfg.singular} ${row ? 'updated' : 'added'}.`); close(); state.cursors = [null]; state.page = 0; load();
      } catch (e) {
        if (!e.soft) { console.error(e); toast(errMsg(e), 'err'); }
        button.disabled = false; button.textContent = row ? 'Save changes' : `Add ${cfg.singular}`;
      }
    }

    async function remove(row) {
      if (!(await confirmDialog(`Delete ${cfg.singular}`, `Delete ${row.id}? This cannot be undone. The deletion will be recorded in the audit log.`, 'Delete', true))) return;
      try {
        const ref = fs.doc(db, cfg.coll, row.id);
        await fs.updateDoc(ref, { updatedBy: session.user.uid, updatedAt: fs.serverTimestamp() }); // lets the audit trigger name the actor
        await fs.deleteDoc(ref); toast(`${cfg.singular} deleted.`); load();
      } catch (e) { console.error(e); toast(errMsg(e), 'err'); }
    }

    let t; $('#q', root).addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value.trim(); state.cursors = [null]; state.page = 0; load(); }, 300); });
    $('#status', root).addEventListener('change', e => { state.status = e.target.value; state.cursors = [null]; state.page = 0; load(); });
    $('#next', root).onclick = () => { state.page++; load(); };
    $('#prev', root).onclick = () => { state.page--; load(); };
    $('#add', root)?.addEventListener('click', () => form(null));
    load();
  };
}
