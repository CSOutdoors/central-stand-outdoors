# Central Stand Outdoors — Hunt Decision Foundation v0.5.0

## What's new in v0.5.0
- Adds a ScentCast beta panel to the property map.
- Lets the hunter select a saved stand and draw an estimated downwind exposure fan using the latest NWS forecast wind direction.
- Adds a directional axis and stand marker, plus a plain-language explanation of the projected downwind direction.
- Adds a first-pass Today's Hunt stand ranking using the hunter's saved safe-wind settings and the latest forecast.
- Preserves the existing GPS, local storage, trail-camera, backup/restore, NWS weather, and offline app-shell behavior.

## Important model limitations
ScentCast is currently a conceptual visualization, not a validated atmospheric dispersion model. It uses a coarse regional forecast wind direction and speed. It does not yet account for on-site wind measurements, stand height, terrain-driven airflow, vegetation, turbulence, atmospheric stability, thermals, or scent chemistry. The plume's length and width are illustrative and must not be interpreted as a measured scent boundary or guarantee of concealment.

Today's Hunt is currently a transparent rule-based wind match, not a trained AI model or deer-movement prediction. It ranks saved stands against the safe-wind directions the hunter configured. No stand is recommended when the forecast is stale, failed, or has variable wind direction.

## Run locally
A service worker requires HTTPS or localhost. From this folder:

```sh
python -m http.server 8000
```

Open `http://localhost:8000` in a modern browser. Deploy the contents of this folder to the root of the GitHub Pages repository. Do not upload the ZIP itself or nest the contents inside another folder.

## Tests

```sh
npm run check
npm test
```

Tests use Node's built-in modules and Python's standard library. Automated browser mocks are not a substitute for real iPhone Safari testing or field validation.

## Privacy
Saved property names, coordinates, notes, and wind settings stay in local browser storage on this device. They are not uploaded to a CSO server. Weather lookups send the selected coordinates to `api.weather.gov`; map tile requests reveal the approximate map area to the USGS service. Exported backups contain precise hunting locations and should be kept private.

## Known limitations / next work
- No AI API or cloud model is connected yet. The current advisor is deterministic and local.
- ScentCast currently uses a simple downwind fan; next steps are forecast-hour selection, improved plume uncertainty, terrain/elevation context, and comparison of multiple stands.
- Property boundary drawing, bedding/travel-corridor exposure, access-route analysis, and deer movement learning are not yet implemented.
- Leaflet and map tiles require internet. The app shell and saved data can work offline; live weather and map tiles cannot.
- NWS live requests and USGS imagery need continued device/network testing. A secure backend may eventually be needed for reliable weather access and any paid AI API integration.
