# CSO PWA v0.4.1 — Independent QA & hardening report

**Review date:** 2026-11-19  
**Reviewed baseline:** Library artifact `Central_Stand_Outdoors_GPS_First_Prototype_v0_3.html` (15,573 bytes)  
**Working result:** New local PWA package `CSO_PWA_v0_4`  
**Original Library file:** Not overwritten or modified.

## Executive result

The v0.3 baseline was a useful GPS-first HTML prototype, but it was not installable as a PWA and had no restore path, no offline shell, no storage-failure handling, and no map-library failure fallback. GPS save and basic local persistence existed. Weather parsing handled only the first number in a wind-speed range and did not safely handle variable wind.

A hardened v0.4.1 working copy has been created. It adds an iPhone-oriented PWA shell, defensive local storage, validated backup/restore, explicit GPS failure and low-accuracy messaging, safer DOM rendering, stale-weather protection, and a graceful map fallback. Automated logic tests passed in the available Node environment.

**Release status: NOT READY TO INSTALL ON A REAL IPHONE YET.** The package still needs an HTTPS deployment target and physical-device validation. Nothing was published.

## Findings in the v0.3 baseline

| Severity | Finding | Status in v0.4.1 |
|---|---|---|
| Critical for PWA release | No web app manifest or service worker; no installable/offline app shell | Fixed in local working copy; HTTPS deployment still required |
| High | Backup export existed, but there was no restore flow | Fixed: versioned JSON restore with validation and explicit replace confirmation |
| High | Local-storage reads/writes were not safely handled; quota/security errors could interrupt save flow | Fixed: guarded load/save; failed write does not commit state or claim success |
| High | Leaflet CDN failure could stop app initialization | Fixed: map falls back to a visible status panel; GPS/list flows remain available |
| High | No offline status or cached app shell | Fixed in source; service-worker logic tested with a mock harness, not a real browser lifecycle |
| Medium | GPS accuracy was displayed but weak fixes were not clearly called out | Fixed: weak accuracy over 100 m is explicitly warned; user may still choose to save |
| Medium | GPS permission and secure-context errors needed clearer handling | Fixed: actionable denied/unavailable/timeout and HTTPS messages |
| Medium | Wind-speed ranges were reduced to their first number; variable wind failed parsing | Fixed: min/max range parsing and variable-direction handling |
| Medium | A previously saved forecast could be treated as current indefinitely | Fixed: forecast older than three hours is not used for a stand recommendation; failed refresh is called out |
| Medium | DOM list generation relied on HTML strings | Fixed: saved names and notes are inserted as text nodes; no `innerHTML` sink in app logic |
| Medium | No backup input validation for coordinate bounds or record types | Fixed: validates type, coordinates, record count, file size, version, and duplicate IDs |

## Files created or changed

Created in `/mnt/data/CSO_PWA_v0_4/`:
- `index.html` — mobile-first interface, accessibility labels, privacy disclosure, iPhone install instructions, CSP.
- `app.js` — GPS, local storage, backup/restore, weather parsing, stale forecast guard, safe rendering, map fallback.
- `manifest.webmanifest` — install metadata.
- `sw.js` — app-shell cache and offline navigation fallback; NWS and map requests are deliberately not cached.
- `icons/icon-192.png`, `icons/icon-512.png`, `icons/apple-touch-icon.png` — app icons.
- `README.md` — local run, deployment prerequisite, privacy, and known limitations.
- `package.json` — repeatable test commands; no external dependencies.
- `tests/smoke-test.cjs` — mocked browser-API integration/regression tests.
- `tests/service-worker-test.cjs` — service-worker install/activate/offline-fetch logic tests.
- `tests/static-check.py` — HTML/PWA/security/static checks.

The baseline Library HTML file was materialized for review but not overwritten. This is a separate working copy, not a deployed site or a persistent cloud repository.

## Test evidence

Environment:
- Node.js v22.16.0
- Python 3.13.5
- Chromium 144 was present; Playwright 1.57 was present.

Passed:
- `node --check app.js`
- `node --check sw.js`
- `node tests/smoke-test.cjs` — **19 passed**. Uses a controlled Node VM with mocked DOM, localStorage, geolocation, and fetch. Covered stand save, property center, camera save, delete, reload persistence, backup export/restore/cancel/rejection, invalid coordinates, denied GPS, weak GPS accuracy, storage quota failure, legacy migration, duplicate IDs, XSS-safe text rendering, NWS speed ranges, NNE sector normalization, variable wind, stale forecasts, and offline status.
- `node tests/service-worker-test.cjs` — **4 passed**. Mocked service-worker install, activation, cache cleanup, offline navigation fallback, and non-interception of cross-origin NWS requests.
- `python tests/static-check.py` — passed. Checks duplicate IDs, explicit button types, iPhone viewport metadata, CSP, PWA manifest/icons, app-shell file list, absence of `innerHTML`, and GPS/NWS/USGS wiring.

Not completed:
- A Playwright page-level run was attempted, but this runtime's managed Chromium policy blocks all navigations (`URLBlocklist: *`, `ERR_BLOCKED_BY_ADMINISTRATOR`). Therefore no real browser rendering or browser-native service-worker lifecycle test is claimed.
- Outbound DNS/network access from the coding container was unavailable; live NWS JSON calls and USGS tile downloads were not executed.
- No physical iPhone/Safari test was possible.

## NWS and USGS integration review

- NWS documentation confirms the free API, the `/points/{latitude},{longitude}` lookup, and the `forecastHourly` URL returned from that point lookup. NWS forecasts are on a grid of about 2.5 km × 2.5 km, so this is regional forecast context, not a precise stand-level wind reading. NWS also publishes rate limits and recommends an identifying User-Agent. Browser JavaScript cannot set a custom User-Agent; the app keeps requests simple for CORS. If live browser requests are blocked or throttled, a small server-side proxy may be needed. This environment could not verify the live request.
- The current USGS ImageryOnly MapServer endpoint is officially listed as a cached orthoimagery base map. Its service metadata reports visibility to approximately 1:9,028 scale, resolution varying roughly 6 inches to 1 meter depending on source, and imagery service data refreshed June 2024. Actual imagery acquisition dates vary by location; do not promise current-year imagery. The map attribution now includes USDA and USGS National Map orthoimagery credit.

## Privacy and budget

- No account, paid service, domain, hosting, or API subscription was created.
- No customer or third party was contacted; nothing was published.
- **Budget spent: $0.**
- Precise hunting locations remain in browser local storage. Weather lookups send coordinates to NWS; map tile requests reveal the viewed area to USGS. Backup JSON contains exact hunting locations and should be treated as sensitive.
- No photos, cloud sync, analytics, advertising, or user accounts are included.

## Remaining limitations

- Leaflet is still loaded from a public CDN. If it cannot load, the app remains usable for GPS saving and lists, but the interactive map is unavailable. Bundling the library locally is a follow-up hardening task once package assets can be obtained and verified.
- Offline support covers the app shell and locally saved records only. Basemap tiles and NWS forecasts require internet.
- Browser JavaScript cannot add a custom NWS User-Agent. Direct API access must be tested from the final HTTPS origin.
- Local browser storage is not a cloud backup and does not sync across devices. Export backups regularly.
- Real iPhone Safari GPS permission, accuracy, download/restore UX, Add to Home Screen, standalone mode, and offline reload remain untested.

## Single next release blocker

**An approved HTTPS deployment target so the package can be opened and tested on the actual iPhone in Safari.** No host/account was created and no deployment was performed because that requires approval. Once an HTTPS target is approved, the next gate is a hands-on iPhone test of GPS permission/save, reload persistence, backup/restore, map loading, and offline shell behavior.
