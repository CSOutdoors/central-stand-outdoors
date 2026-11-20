# CSO v0.6.1 QA report

## Automated checks
- Application smoke tests: 19/19 passed (existing GPS save, storage, backup/restore, weather, and advisor regression coverage).
- Service-worker tests: 4/4 passed.
- Static checks passed: unique IDs, explicit button types, iPhone viewport metadata, CSP, PWA manifest/icons, service-worker shell, no `innerHTML` sinks, GPS/NWS/USGS wiring.
- JavaScript syntax checks passed for app.js and sw.js.

## v0.6.1 changes
- ScentCast increased to 280 smaller particles with faster movement (roughly 1.5–2.5 seconds to travel through the modeled plume, depending on wind speed). Reduced-motion preference still disables animation.
- Added a map-based observed wind direction tool. User selects a saved stand, enters wind-map mode, and taps the map in the direction the wind is coming FROM. Direction is snapped to a 16-point compass and stored locally on that stand.
- Field-observed direction takes priority over the NWS regional direction for stand wind matching and ScentCast direction.
- Added NWS forecast refresh at a selected stand coordinate and at a fresh GPS fix. GPS only anchors the forecast lookup; it is not a wind sensor. NWS output remains grid-scale forecast data.
- Existing manual map location placement and hand-drawn property boundaries remain available.
- Saved wind observations and forecast coordinates are included in the existing local backup format without changing the storage key.

## Not yet verified / limitations
- Automated tests do not emulate real iPhone map taps, touch accuracy, particle performance, or visual appearance; test on the actual Home Screen app.
- Manual wind observation depends on the user's field observation and map orientation; it is not an instrument measurement.
- GPS coordinates are used to request the closest NWS forecast grid; the forecast is not a point-level live wind measurement.
- Manually drawn boundaries are approximate user traces, not surveyed/legal boundaries.
- Parcel-click auto-selection is not implemented in this build. Peoria County publishes a public parcel feature layer, but the user's Metamora-area property may fall in Woodford County, whose official public viewer is hosted through Cloudpoint/ArcGIS Experience. A stable, supported parcel feature endpoint and its terms need verification before enabling parcel taps across counties.
- ScentCast remains conceptual and is not a scientifically validated scent transport model.
