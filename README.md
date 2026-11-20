# Central Stand Outdoors — Hunt Decision Foundation v0.5.2

## What's new in v0.5.2
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


### v0.5.2 ScentCast visual update
- Added subtle animated pulsing to the conceptual scent fan and moving dash flow along its centerline.
- Respects device reduced-motion settings.
- No change to saved-data format or location storage.


### v0.5.2
- ScentCast uses a widening scent-cloud footprint and animated downwind particles (respects reduced-motion settings).
- Safe-wind setup is now a visual compass rose: tap one or more directions from which wind may safely come.
- The compass uses wind FROM convention; all selected directions are saved in the existing data format.

## v0.6.1 map planning
- Add a stand, camera, food plot, access point, or sighting from the map without using GPS: choose **Add location on map**, tap the map, then save the selected point from the location form.
- Draw a property boundary by choosing **Draw property boundary**, tapping each corner/bend, and choosing **Finish boundary**. Boundaries are saved locally and included in backup exports.
- ScentCast now renders 150 faster-moving particles for a denser airflow effect. The plume remains an illustrative visualization, not measured scent transport.
- Parcel-click selection is not included yet. That requires reliable parcel polygon data for the selected county and a suitable data-use agreement/source; the current boundary tool lets the hunter trace the property manually.


## v0.6.1 updates
- ScentCast now uses 280 smaller particles with faster continuous movement and more size/brightness variation.
- Map-based field wind observation: choose a saved stand, select **Set wind from map**, then tap the map in the direction the wind is coming FROM. The direction is saved to that stand and takes priority over the regional forecast for that stand.
- Refresh an NWS forecast at the selected stand coordinates or at a fresh GPS fix. GPS identifies the forecast location; it does not measure wind. NWS wind remains a grid forecast, not an anemometer reading.
- Existing manually drawn property boundaries and manual map stand placement remain available.
