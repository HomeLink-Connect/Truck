import { db, fs } from '../firebase.js';
import { $, esc, errMsg, fmtDate } from '../ui.js';
import { VEHICLE_STATUSES } from './vehicles.js';

const count = async (coll, ...c) => (await fs.getCountFromServer(fs.query(fs.collection(db, coll), ...c))).data().count;
const todayStr = (add = 0) => { const d = new Date(); d.setDate(d.getDate() + add); return d.toISOString().slice(0, 10); };

const EXPIRY_CHECKS = [
  ['vehicles', 'insuranceExpiry', 'Insurance', 'registration'], ['vehicles', 'roadLicenceExpiry', 'Road licence', 'registration'],
  ['vehicles', 'fitnessExpiry', 'Certificate of fitness', 'registration'],
  ['drivers', 'licenceExpiry', 'Driver licence', 'fullName'], ['drivers', 'medicalExpiry', 'Medical certificate', 'fullName']
];

export default async function render(root) {
  root.innerHTML = `<div class="page-head"><div><h1>Fleet overview</h1><p class="sub">Calculated from your records when this page opened.</p></div>
    <button class="btn" id="refresh">Refresh</button></div><div id="body" class="state">Loading…</div>`;
  $('#refresh', root).onclick = () => render(root);
  try {
    const [total, activeDrivers, ...statusCounts] = await Promise.all([
      count('vehicles'), count('drivers', fs.where('employmentStatus', '==', 'Active')),
      ...VEHICLE_STATUSES.map(s => count('vehicles', fs.where('status', '==', s)))
    ]);
    const by = Object.fromEntries(VEHICLE_STATUSES.map((s, i) => [s, statusCounts[i]]));
    const limit = todayStr(30), floor = '2000-01-01';
    const expiring = (await Promise.all(EXPIRY_CHECKS.map(async ([coll, field, label, nameKey]) => {
      const snap = await fs.getDocs(fs.query(fs.collection(db, coll), fs.where(field, '>=', floor), fs.where(field, '<=', limit), fs.orderBy(field), fs.limit(25)));
      return snap.docs.map(d => ({ label, who: d.data()[nameKey], id: d.id, date: d.data()[field] }));
    }))).flat().sort((a, b) => a.date.localeCompare(b.date));

    const inTransit = by['In Transit'] + by['At Border'] + by['Loading'];
    const kpi = (label, value, tone = '') => `<div class="kpi ${tone}"><span class="kpi-v">${value}</span><span class="kpi-l">${esc(label)}</span></div>`;
    $('#body', root).className = '';
    $('#body', root).innerHTML = `
      <div class="kpis">${kpi('Total vehicles', total)}${kpi('Available', by.Available, 'good')}${kpi('On the road', inTransit, 'info')}
        ${kpi('At border', by['At Border'], by['At Border'] ? 'warn' : '')}${kpi('In maintenance', by.Maintenance, by.Maintenance ? 'warn' : '')}
        ${kpi('Breakdown / accident', by.Breakdown + by.Accident, by.Breakdown + by.Accident ? 'bad' : '')}${kpi('Active drivers', activeDrivers)}
        ${kpi('Documents needing attention', expiring.length, expiring.length ? 'warn' : 'good')}</div>
      <div class="two-col">
        <section class="panel"><h2>Vehicles by status</h2>${total ? `<ul class="bars">${VEHICLE_STATUSES.filter(s => by[s]).map(s => `<li><span>${esc(s)}</span><div class="bar"><i style="width:${(by[s] / total) * 100}%"></i></div><b>${by[s]}</b></li>`).join('')}</ul>`
          : '<div class="state"><strong>No vehicles yet</strong><p>Add vehicles on the Vehicles page and this chart fills in.</p></div>'}</section>
        <section class="panel"><h2>Expired or expiring within 30 days</h2>${expiring.length ? `<table class="data compact"><tbody>${expiring.map(x => {
          const late = x.date < todayStr(); return `<tr><td>${esc(x.label)}</td><td>${esc(x.who)}</td><td><span class="badge ${late ? 'bad' : 'warn'}">${late ? 'Expired' : 'Due'} ${fmtDate(x.date)}</span></td></tr>`; }).join('')}</tbody></table>`
          : '<div class="state"><strong>Nothing due</strong><p>No vehicle or driver documents expire in the next 30 days.</p></div>'}</section>
      </div>
      <p class="note">Trips, fuel, maintenance, revenue and live GPS appear here as those modules are built and connected. Nothing on this page is simulated.</p>`;
  } catch (e) { console.error(e); $('#body', root).className = 'state err'; $('#body', root).textContent = errMsg(e); }
}
