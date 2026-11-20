# CSO v0.8.1 — QA report

## Changes validated
- Local Hunt Advisor suitability scoring added for hourly stand comparisons.
- Score components are explicit: wind alignment 65, wind-speed context 10, temperature context 15, precipitation probability 10.
- NWS hourly precipitation probability is normalized and stored when available; absent values remain unknown and receive neutral weighting.
- Existing direct wind-match report remains unchanged.
- Existing localStorage key/schema retained; no data migration or cloud configuration introduced.
- Service-worker cache bumped to `cso-shell-v0.8.1`.

## Automated validation
- JavaScript syntax: passed.
- App smoke tests: 18/18 passed.
- Service-worker tests: 4/4 passed.
- Static checks: passed (unique IDs, button types, iPhone viewport metadata, CSP, PWA assets, service-worker shell, no `innerHTML` sinks, GPS/NWS/USGS wiring).

## Not yet validated
- Actual iPhone Safari/Home Screen update behavior for this release.
- Real NWS precipitation probability availability and local forecast accuracy across all service areas.
- Whether heuristic temperature and wind-speed weights improve real hunting decisions; this requires field feedback and should not be represented as a deer-activity prediction.
- Conversational LLM advisor, barometric-pressure analysis, terrain/thermal airflow, parcel auto-selection, and learned property-specific deer movement are not included.
