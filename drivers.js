import { entityModule } from '../entity.js';
import { V } from '../validators.js';
import { badge, esc, expiryState } from '../ui.js';

export const DRIVER_STATUSES = ['Active', 'On Leave', 'Suspended', 'Terminated'];
const expiry = v => { const s = expiryState(v); return `<span class="badge ${s.tone}">${esc(s.label)}</span>`; };

export default entityModule({
  mod: 'drivers', coll: 'drivers', title: 'Drivers', singular: 'driver', idField: 'employeeId', idLabel: 'Employee ID',
  searchField: 'searchKey', searchSource: 'fullName', searchLabel: 'name', statusField: 'employmentStatus', statusOptions: DRIVER_STATUSES,
  columns: ['employeeId', 'fullName', 'phone', 'employmentStatus', 'licenceExpiry', 'medicalExpiry'],
  fields: [
    { section: 'Personal details', key: 'employeeId', label: 'Employee ID', required: true, validate: V.id },
    { key: 'fullName', label: 'Full name', required: true },
    { key: 'phone', label: 'Phone', required: true, validate: V.phone },
    { key: 'email', label: 'Email', type: 'email', validate: V.email },
    { key: 'nationalId', label: 'National ID' }, { key: 'passportNo', label: 'Passport number' },
    { key: 'address', label: 'Address', wide: true },
    { section: 'Licence and medical', key: 'licenceNo', label: 'Driver licence number', required: true },
    { key: 'licenceClass', label: 'Licence class', type: 'select', options: ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Other'] },
    { key: 'licenceExpiry', label: 'Licence expiry', type: 'date', required: true, format: expiry },
    { key: 'medicalExpiry', label: 'Medical certificate expiry', type: 'date', format: expiry },
    { section: 'Employment', key: 'employmentStatus', label: 'Employment status', type: 'select', required: true, options: DRIVER_STATUSES, format: v => badge(v) },
    { key: 'emergencyName', label: 'Emergency contact name' },
    { key: 'emergencyPhone', label: 'Emergency contact phone', validate: V.phone }
  ]
});
