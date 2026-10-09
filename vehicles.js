import { entityModule } from '../entity.js';
import { V } from '../validators.js';
import { badge, esc, fmtNum, expiryState } from '../ui.js';

export const VEHICLE_STATUSES = ['Available','Assigned','Loading','In Transit','At Border','Delivered','Parked','Maintenance','Breakdown','Accident','Inactive'];
const expiry = v => { const s = expiryState(v); return `<span class="badge ${s.tone}">${esc(s.label)}</span>`; };

export default entityModule({
  mod: 'vehicles', coll: 'vehicles', title: 'Vehicles', singular: 'vehicle', idField: 'fleetId', idLabel: 'Fleet ID',
  searchField: 'searchKey', searchSource: 'registration', searchLabel: 'registration number', statusField: 'status', statusOptions: VEHICLE_STATUSES,
  columns: ['fleetId', 'registration', 'make', 'status', 'mileageKm', 'insuranceExpiry'],
  fields: [
    { section: 'Identification', key: 'fleetId', label: 'Fleet ID', required: true, validate: V.id, help: 'Your internal number, e.g. TRK-001.' },
    { key: 'registration', label: 'Registration number', required: true, validate: V.registration },
    { key: 'vin', label: 'VIN / chassis number' }, { key: 'engineNo', label: 'Engine number' },
    { key: 'make', label: 'Make', required: true, format: (v, r) => `${esc(v)} ${esc(r.model || '')}` },
    { key: 'model', label: 'Model', required: true },
    { key: 'year', label: 'Year', type: 'number', required: true, validate: V.year },
    { key: 'type', label: 'Vehicle type', type: 'select', options: ['Horse / truck tractor','Rigid truck','Tanker','Flatbed','Refrigerated','Tipper','Other'] },
    { section: 'Operations', key: 'status', label: 'Status', type: 'select', required: true, options: VEHICLE_STATUSES, format: v => badge(v) },
    { key: 'fuelType', label: 'Fuel type', type: 'select', options: ['Diesel','Petrol','Other'] },
    { key: 'tankLitres', label: 'Fuel tank capacity (L)', type: 'number' },
    { key: 'mileageKm', label: 'Current mileage (km)', type: 'number', required: true, format: v => `${Number(v || 0).toLocaleString('en-US')} km` },
    { key: 'gpsDeviceId', label: 'GPS device ID', help: 'Link a device once your tracking provider is connected.' },
    { section: 'Compliance', key: 'insuranceExpiry', label: 'Insurance expiry', type: 'date', format: expiry },
    { key: 'roadLicenceExpiry', label: 'Road licence expiry', type: 'date' },
    { key: 'fitnessExpiry', label: 'Certificate of fitness expiry', type: 'date' },
    { section: 'Purchase', key: 'purchaseDate', label: 'Purchase date', type: 'date' },
    { key: 'purchasePrice', label: 'Purchase price (USD)', type: 'number' },
    { key: 'currentValue', label: 'Current value (USD)', type: 'number' },
    { key: 'notes', label: 'Notes', type: 'textarea', wide: true }
  ]
});
