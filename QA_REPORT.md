# CSO v0.5.1 — QA report

**Date:** 2026-11-19  
**Scope:** Existing v0.4.1 GPS-first PWA plus first ScentCast / Hunt Decision Foundation increment.

## Changes
- Added ScentCast beta UI with saved-stand selector and show/hide control.
- Added conceptual downwind fan and centerline overlay on the Leaflet property map.
- Wind FROM is converted to the opposite downwind bearing for the visual projection.
- Added an explicit explanation of forecast source, estimated direction, and illustrative length.
- Added subtle CSS animation: the plume gently pulses and the centerline dash pattern drifts downwind. Reduced-motion preferences are respected.
- Updated service-worker cache to v0.5.1 so installed PWAs can detect the new shell.
- Added Today's Hunt stand ranking based on configured safe-wind directions and the latest forecast.
- Retained stale forecast and variable wind safeguards.
- Bumped service-worker cache version from v0.5.0 to v0.5.1.

## Automated validation
- JavaScript syntax check: passed.
- Existing app smoke suite: 19/19 passed.
- Service-worker suite: 4/4 passed.
- Static checks: passed (unique IDs, button types, CSP, PWA shell, safe DOM rendering, GPS/NWS/USGS wiring).

## Not yet validated
- ScentCast map geometry and animation performance on an actual iPhone / Leaflet map.
- Accuracy of regional forecast wind at a specific stand.
- Terrain, thermal, canopy, turbulence, and vegetation effects.
- Real deer movement prediction or AI model performance.
- Live NWS/USGS network behavior in all locations.

## Release guidance
This is a development build, not a field-validated hunting recommendation system. ScentCast is illustrative. Today's Hunt is a transparent safe-wind rule comparison only. Test on the iPhone before relying on it, and verify wind at the stand locally.
