# Central Stand Outdoors — PWA field companion v0.4.1

## What this build includes
- iPhone-oriented responsive layout and PWA manifest/service worker shell.
- User-initiated GPS requests only; no background tracking.
- GPS save flows for property center, stands, trail cameras, food plots, access points, and deer sightings.
- Local browser persistence with migration from `cso_gps_v3` and `cso_field_v2`.
- JSON backup export and validated, confirmation-gated restore.
- Defensive validation for imported coordinates, location types, duplicate IDs, record count, and file size.
- NWS hourly forecast handling for compass directions, variable wind, and wind-speed ranges. Forecasts older than three hours are not used for stand recommendations.
- USGS National Map imagery when Leaflet and the network are available; graceful map fallback otherwise.
- Offline app-shell caching. Saved data is local; weather and map tiles remain online-only.
- No analytics, advertising, accounts, or cloud sync.

## Run locally
A service worker requires HTTPS or localhost. From this folder:

```sh
python -m http.server 8000
```

Open `http://localhost:8000` in a modern browser. For an iPhone installation, deploy the folder to an HTTPS host, open the HTTPS URL in Safari, then Share → Add to Home Screen. No hosting account has been created and nothing has been published.

## Tests

```sh
npm run check
npm test
```

The tests use Node's built-in modules and Python's standard library; no npm packages are required. The smoke tests simulate browser APIs and are not a substitute for real iPhone testing.

## Privacy and data handling
Location records are stored in the browser's local storage on this device. They are not sent to a CSO server. A weather lookup sends the selected coordinates to `api.weather.gov`; when the map is displayed, requested map tiles reveal the approximate map area to the USGS service. There are no analytics or advertising scripts. Exported backups contain precise hunting locations and should be protected.

## Known limitations
- This is a field-companion prototype, not the complete CSO product.
- No account, cloud sync, cross-device sync, photo upload, habitat AI, Rut Report, or advanced Hunt Advisor is included.
- The map and Leaflet library require internet. If the CDN is unavailable, GPS capture and saved-location lists still work, but the interactive map falls back to a message.
- The app shell and local saved data can work offline, but basemap tiles and NWS weather cannot.
- NWS documentation recommends an identifying User-Agent. Browser JavaScript cannot set a custom User-Agent; the app keeps the request simple for CORS. If direct browser requests are blocked or throttled, a small server-side proxy may be required. This has not been live-tested from this environment.
- Real iPhone Safari GPS accuracy, Add to Home Screen behavior, and offline lifecycle still require physical-device validation.
