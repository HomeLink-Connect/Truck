// UI-side permission matrix. The real enforcement is in firestore.rules / storage.rules / Functions.
export const ROLES = {
  SUPER_ADMIN: 'Super admin', OWNER: 'Owner', FLEET_MANAGER: 'Fleet manager',
  OPERATIONS_MANAGER: 'Operations manager', DISPATCHER: 'Dispatcher',
  FINANCE_MANAGER: 'Finance manager', MAINTENANCE_MANAGER: 'Maintenance manager',
  DRIVER: 'Driver', VIEWER: 'Viewer'
};
const ALL_STAFF = ['SUPER_ADMIN','OWNER','FLEET_MANAGER','OPERATIONS_MANAGER','DISPATCHER','FINANCE_MANAGER','MAINTENANCE_MANAGER','VIEWER'];
export const PERMS = {
  dashboard: { read: ALL_STAFF },
  vehicles:  { read: ALL_STAFF, write: ['SUPER_ADMIN','OWNER','FLEET_MANAGER'], delete: ['SUPER_ADMIN','OWNER'] },
  drivers:   { read: ['SUPER_ADMIN','OWNER','FLEET_MANAGER','OPERATIONS_MANAGER','DISPATCHER','VIEWER'],
               write: ['SUPER_ADMIN','OWNER','FLEET_MANAGER'], delete: ['SUPER_ADMIN','OWNER'] },
  users:     { read: ['SUPER_ADMIN','OWNER'], write: ['SUPER_ADMIN','OWNER'] },
  audit:     { read: ['SUPER_ADMIN','OWNER'] }
};
export const can = (role, mod, action = 'read') => !!PERMS[mod]?.[action]?.includes(role);
