# CSO v0.7.0 QA report

## Automated checks
- `npm run check`: passed (app.js and sw.js syntax).
- `npm test`: passed.
- Smoke tests: 20/20 passed, including persistence of multiple NWS hourly forecast periods and existing backup/location workflows.
- Service-worker tests: 4/4 passed.
- Static checks: passed (unique IDs, explicit button types, CSP, PWA manifest/icons, service-worker shell, no unsafe `innerHTML`, GPS requested on demand).

## v0.7.0 changes
- Stores up to 168 NWS hourly forecast periods (maximum seven days).
- Adds seven-day daily Ideal Wind summary and next-24-hour hourly wind score table for a selected saved stand.
- Score is a transparent rule comparison: 100 = forecast wind-from sector matches saved Ideal Wind; 0 = does not match; 50 = variable/unavailable direction. It is not a probability of deer movement or hunting success.
- Adds a LIVE GPS · RECENTER MAP control. It recenters immediately on the last known fix, then requests a fresh GPS fix and recenters again. No background watchPosition is used.
- Existing localStorage key `cso_gps_v4` and saved location/parcel schemas remain compatible. Hourly weather is additive and included in backup export.

## Field testing still required
- Actual iPhone Safari/Home Screen rendering and NWS CORS/network access.
- Validate that hourly periods use the expected local time zone and refresh at the actual stand before relying on the forecast.
- Compare the forecast against an on-site wind indicator; GPS locates the forecast grid but does not measure wind.
- No guarantee of deer movement, scent dispersion, or harvest success. Weather forecasts are model output and may differ from conditions under canopy or near terrain features.
