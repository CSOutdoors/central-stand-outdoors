# Central Stand Outdoors — Today's Hunt v0.8.0 (local-only)

## What's new in v0.8.0
- Adds a clean Today's Hunt briefing as the first screen: current saved forecast wind, temperature, forecast freshness, best stand, hourly wind-match score, and the next six hourly conditions.
- Ranks stands across the next 24 forecast hours using the user's saved Ideal Wind directions. Ranking uses average hourly wind-match score, ideal-hour count, and best consecutive ideal stretch.
- Adds a one-tap action to jump to the recommended stand on the map.
- Keeps advanced wind reports, map tools, GPS/property setup, location management, scent visualization, weather details, and privacy information in collapsed sections.
- Cloud synchronization remains OFF. No Supabase or account setup is required.
- Preserves the existing `cso_gps_v4` local storage key and saved-data schema.

## Today's Hunt scoring
Each available forecast hour is scored 100 when the wind-from sector matches that stand's saved Ideal Wind, 0 when it does not, and 50 when the forecast direction is variable/unavailable. The stand score is the average across up to the next 24 forecast hours. This is a transparent wind-rule match, not a probability of deer activity, deer presence, or harvest success. A forecast must be no more than three hours old; stale or failed forecasts do not generate a recommendation. Refresh the forecast at the stand coordinates for the most relevant local grid forecast. GPS identifies where to request a forecast; it does not measure wind.

## Deployment
This is the local-only continuation of v0.7.2. Extract the ZIP and upload its contents to the root of the existing GitHub Pages repository. Do not upload the ZIP itself or nest the contents inside another folder. Existing saved data remains in the same browser storage key. Do not upload the v0.8.0 cloud foundation build; cloud is intentionally deferred.

## Testing
Run `npm run check` and `npm test`. Automated tests are not a substitute for iPhone Safari and field testing.

## Privacy and limitations
Saved property names, coordinates, notes, Ideal Wind settings, and other records remain in local browser storage on this device. They are not synced to a CSO server. Weather requests send selected coordinates to the National Weather Service; map tiles and place search use their respective public services. NWS hourly forecasts are modeled grid forecasts, not on-site wind measurements.

