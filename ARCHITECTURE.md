# FleetOps — Architecture (sections A–M)

## A. System architecture
```
 Browser (PWA, vanilla ES modules)         Driver phone (PWA, Phase 4)
        │  Firebase Auth (ID token + role claim)        │
        ▼                                               ▼
 ┌──────────── Firebase ─────────────────────────────────────────┐
 │ Auth ── custom claims {role}                                  │
 │ Firestore ── rules enforce role + field validation            │
 │ Storage ── private docs, rules enforce size/type/role         │
 │ Cloud Functions (Node 20)                                     │
 │   • createUserAccount / setUserRole / setUserActive (admin)   │
 │   • recordLogin (IP + UA)                                     │
 │   • auditTrigger (vehicles, drivers, … → auditLogs)           │
 │   • gpsIngest (HTTPS, per-device key)  [Phase 3]              │
 │   • scheduled: expiry + service-due alerts [Phase 2]          │
 │ FCM ── push        Hosting ── static app + CDN                │
 └───────────────────────────────────────────────────────────────┘
        ▲
 GPS/telematics provider webhook or driver-phone GPS ──► gpsIngest
```
Principle: the browser is untrusted. Every permission is enforced in Firestore/Storage rules or Functions; the UI only hides what a role cannot use.

## B. Modules
Foundation (done in this drop): Auth, RBAC, shell/router/PWA, Dashboard (live counts), Vehicles, Drivers, Users, Audit log.
Next: Trips, Border events, Cargo, Customers, Fuel, Maintenance, Documents, Expenses, Revenue/Profit, Alerts, Reports, Tracking map, Driver app.

## C. Firestore schema
| Collection | Key fields | Owner / notes |
|---|---|---|
| users/{uid} | displayName, email, role, active, createdAt | written by Functions only |
| loginHistory/{id} | uid, ip, userAgent, at | Functions only |
| vehicles/{fleetId} | fleetId, registration, vin, engineNo, make, model, year, type, fuelType, tankLitres, mileageKm, status, assignedDriverId, trailerId, gpsDeviceId, insuranceExpiry, roadLicenceExpiry, fitnessExpiry, purchaseDate, purchasePrice, currentValue, notes, searchKey, createdBy/At, updatedBy/At | Fleet mgmt |
| drivers/{employeeId} | fullName, phone, email, nationalId, passportNo, licenceNo, licenceClass, licenceExpiry, medicalExpiry, emergency*, employmentStatus, assignedVehicleId, userUid, searchKey | Fleet/Ops |
| trailers/{id} | registration, type, capacityKg, status | |
| customers/{id} | name, contact, country, paymentTerms | Finance/Ops |
| trips/{tripId} | vehicleId, trailerId, driverId, customerId, cargoId, origin, destination, route[], status, departAt, etaAt, arrivedAt, revenue, createdBy | Dispatcher |
| trips/{tripId}/events/{id} | type, at, by, location, note | border/status timeline (subcollection) |
| cargo/{id} | tripId, customerId, description, qty, weightKg, value, consignmentNo, waybillNo, loadStatus, deliveryStatus | |
| fuelRecords/{id} | vehicleId, driverId, tripId, date, station, litres, pricePerLitre, total, odometerKm, payment, receiptPath | |
| maintenance/{id} | vehicleId, type, date, mileageKm, parts, labour, cost, workshop, nextServiceKm/Date | |
| expenses/{id} | category, amount, vehicleId, driverId, tripId, customerId, date, receiptPath | |
| revenues/{id} | tripId, customerId, amount, invoiceNo, date | Finance |
| documents/{id} | entityType, entityId, kind, storagePath, expiryDate, status | metadata; file in Storage |
| locations/{id} | name, type (border/warehouse/customer), lat, lng, country | |
| gpsDevices/{deviceId} | vehicleId, provider, apiKeyHash, lastSeenAt, lastPosition | |
| gpsLatest/{vehicleId} | lat,lng,speed,heading,ignition,odometer,fuel,accuracy,deviceId,battery,ts | 1 doc/vehicle → live map listens here |
| gpsHistory/{vehicleId}/days/{yyyymmdd} | points[] (batched) | or BigQuery at scale |
| geofences/{id} | name, type, center/radius or polygon | |
| notifications/{id} | userId/role, type, severity, entity, readAt | |
| incidents/{id} | vehicleId, driverId, tripId, kind, at, description | |
| auditLogs/{id} | actorUid, actorName, action, collection, docId, changes{field:{old,new}}, at | **write: Functions only; read: Owner/Super Admin** |
| settings/{key} | company, thresholds | |

Indexes: see `firestore.indexes.json` (status+searchKey etc.). Relationships are by ID (no embedding of large data); trip events are a subcollection to avoid document growth.

## D. Roles & permissions
| Module | SUPER_ADMIN | OWNER | FLEET_MGR | OPS_MGR | DISPATCHER | FINANCE | MAINT | DRIVER | VIEWER |
|---|---|---|---|---|---|---|---|---|---|
| Dashboard | R | R | R | R | R | R | R | – | R |
| Vehicles | CRUD | CRUD | CRU | R | R | R | R | own (R) | R |
| Drivers | CRUD | CRUD | CRU | R | R | – | – | self | R |
| Trips | CRUD | CRUD | R | CRUD | CRU | R | – | own (U status) | R |
| Fuel/Expenses | CRUD | CRUD | CRU | CRU | C | CRUD | C | C own | R |
| Maintenance | CRUD | CRUD | CRU | R | – | R | CRUD | report | R |
| Revenue/Profit | CRUD | CRUD | – | – | – | CRUD | – | – | – |
| Users | CRUD | CRU | – | – | – | – | – | – | – |
| Audit log | R | R | – | – | – | – | – | – | – |
(C create, R read, U update, D delete.) Implemented once in `rbac.js` (UI) and mirrored in `firestore.rules`.

## E. GPS / telematics
1. Device/provider → HTTPS Function `gpsIngest` with per-device key (hashed in `gpsDevices`). No keys in browser.
2. Function validates payload (lat/lng range, timestamp, deviceId), rejects stale/duplicate.
3. Writes `gpsLatest/{vehicleId}` (throttled: only if moved >50 m or >30 s) → map listens to this one collection.
4. Appends to a batched history doc per vehicle/day (not one write per ping); long-term: stream to BigQuery.
5. Rules engine in the Function: geofence enter/exit, overspeed, stoppage, offline (scheduled sweep on `lastSeenAt`), route deviation → `notifications` + FCM.
6. Driver phone GPS: same endpoint with a driver-scoped token, lower priority.
Vendor adapters (Teltonika/Traccar/Wialon/Cartrack etc.) normalise to the payload above. Nothing is simulated: the map shows markers only when `gpsLatest` docs exist.

## F. Security
Auth with email verification; role in custom claims; rules check claims (no extra reads); users cannot self-assign roles; deactivation disables the Auth user and revokes refresh tokens; audit log written server-side only and immutable; Storage rules limit size/type; web config is public by design — restrict the Maps key by HTTP referrer and enable App Check; secrets only in Functions config/Secret Manager.

## G. Stack
Vanilla ES modules + Firebase v10 modular SDK (CDN, no build step), Google Maps JS API, Chart.js (Phase 2), Functions Node 20. If the codebase passes ~40 modules, migrate to Vite + TypeScript — the folder layout already allows it.

## H. Structure
```
fleetops/
  firebase.json  firestore.rules  storage.rules  firestore.indexes.json
  public/ index.html manifest.webmanifest sw.js css/styles.css icons/
    js/ firebase-config.js firebase.js app.js auth.js rbac.js ui.js validators.js entity.js
      modules/ dashboard.js vehicles.js drivers.js users.js audit.js
  functions/ index.js package.json
  scripts/ set-super-admin.js
```

## I. Phases
1 Foundation + fleet/drivers/users/audit (this drop) → 2 Trips, border timeline, cargo, customers, documents, alerts → 3 Fuel, maintenance, expenses, revenue/profit, reports, charts → 4 GPS ingest + live map + geofences → 5 Driver PWA + FCM → 6 Hardening (App Check, backups, load test, pen-test).

## J. Deployment
Firebase Hosting (CDN) + Firestore (multi-region `eur3` or closest — `africa-south1` Firestore is not generally available, check console) + Functions (Blaze plan required). Separate `dev` and `prod` projects; demo data only in dev. Daily Firestore export to a Storage bucket.

## K. External services
Firebase (Blaze plan), Google Maps Platform (Maps JS, Directions, Geocoding), a GPS/telematics provider with API/webhooks, optional email provider (Firebase Extension "Trigger Email"), SMS/WhatsApp only via a real provider (Twilio, Africa's Talking) — not claimed until integrated.

## L. Risks / limits
Functions + audit trigger need Blaze plan. Failed-login monitoring needs Identity Platform blocking functions (not in the free tier). Firestore is poor at ad-hoc reporting: heavy reports should aggregate via Functions into summary docs or BigQuery. Offline GPS buffering is a driver-app feature (Phase 5), not present now. Zimbabwe mobile data is patchy: ingest must tolerate batched, late points.

## M. Investor roadmap
Q1 pilot with one fleet (10 trucks) → Q2 live tracking + profitability → Q3 driver app + customer tracking links → Q4 multi-tenant (companies), subscription billing per vehicle, regional border-wait analytics.
