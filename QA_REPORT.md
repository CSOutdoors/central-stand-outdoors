# QA Report — CSO v0.8.0 Local Today's Hunt

- App smoke tests: **18/18 passed**.
- Service-worker tests: **4/4 passed**.
- JavaScript syntax checks: passed.
- Static checks: passed (unique IDs, explicit button types, iPhone viewport metadata, CSP, PWA assets, service-worker shell, no `innerHTML` sinks, GPS/NWS/USGS wiring).
- Today's Hunt test verifies a stand with matching Ideal Wind is ranked at 100/100 using the hourly forecast.
- Stale-forecast test verifies no stand recommendation or score is shown when forecast age exceeds three hours.
- No-match test verifies CSO does not recommend a stand when none of the upcoming hourly forecast periods match its Ideal Wind settings.
- Existing local storage key `cso_gps_v4` retained; no migration or deletion of existing saved data.
- Cloud sync is not configured or enabled; no Supabase project or account is required.
- Today's Hunt score is a rule-based average of up to 24 hourly forecast wind-direction matches. It is not a deer-movement or harvest probability.
- Actual iPhone rendering, NWS availability, and field forecast accuracy still require user testing.
