# Central Stand Outdoors — Map-first stand planning v0.8.2 (local-only)

## What's new in v0.8.2
- Promotes **ADD STAND / LOCATION** to a large, always-visible map action instead of hiding it in advanced tools.
- Opens the location form automatically and guides the user through searching for a distant property, zooming in, tapping the exact map location, dragging the pin to fine-tune, and saving.
- Makes clear that manual map placement works from home and does not use the phone's GPS.
- Improves search handoff: a successful place search zooms closer and updates the manual-placement instructions.
- Preserves the v0.8.1 Intelligent Hunt Advisor and all existing local data.

## What's new in v0.8.1
- Adds a transparent local Hunt Advisor suitability index for each saved stand across the next 24 forecast hours.
- Explains the leading stand and shows how its score was built: Ideal Wind alignment (65 points), wind-speed suitability (10), temperature context (15), and precipitation probability (10).
- Uses National Weather Service hourly precipitation probability when supplied; missing values receive a neutral score rather than being treated as zero precipitation.
- Hourly dashboard chips now display the broader suitability score. Existing hourly wind-only reports remain available for direct Ideal Wind comparisons.
- Preserves the existing local storage key (`cso_gps_v4`), saved points, parcels, and weather records. No cloud account, backend, or external AI service is added.
- Bumps the service-worker cache to v0.8.2.

## Important limits
The suitability index is a transparent planning aid, not a validated deer-activity model, harvest probability, or guarantee. The temperature and wind-speed bands are general planning heuristics, not proven whitetail behavior rules. It does not yet incorporate barometric-pressure trends, on-site wind instruments, terrain/thermal effects, hunting pressure, food/bedding locations, access disturbance, or your personal observation journal. NWS wind and precipitation are forecast values, not measurements at the stand. Always verify conditions and make the final decision yourself.

This is **not yet a conversational generative-AI advisor**. A future AI chat/reasoning layer will require a secure backend so no private API key is exposed in the public browser app. We can keep designing that while building useful local decision tools first.

## Deploy
Extract this ZIP and upload its contents (not the ZIP itself or its parent folder) to the root of the existing GitHub Pages repository. Commit to `main` and allow Pages to deploy. Existing saved data stays in the same browser storage key; do not clear Safari website data or delete the Home Screen app. The v0.8.0 cloud-foundation ZIP is not part of this release.

## Run checks
```sh
npm run check
npm test
```
Automated tests do not replace testing on your iPhone and checking actual field conditions.

## Privacy
Saved hunting locations and preferences remain in local browser storage on this device. Weather requests send forecast coordinates to `api.weather.gov`; map requests contact their respective tile providers. No CSO cloud sync is configured.
