# CSO Trophy Studio v0.9.0 — iPhone PWA reliability patch

## Root-cause assessment
The v0.8.9 source archive had the Lodge page and its assets in the service-worker shell, but its fetch handler was cache-first for every same-origin script and asset. An installed iPhone home-screen app can therefore remain on previously cached JavaScript/UI until the service worker updates successfully. The user's reported symptom (old/incomplete UI, Lodge absent, controls unresponsive) is consistent with a stale installed PWA, but cannot be conclusively confirmed without inspecting that iPhone's installed service worker and deployed site.

## Changes
- Bumped service-worker cache to `cso-shell-v0.9.0`.
- Changed same-origin GET handling to network-first, updating cache on success and falling back to cache offline.
- Added `updateViaCache: 'none'` and an explicit `registration.update()` check.
- Added module boot wrappers that display an actionable error if the Trophy Studio or Lodge module fails to load/initialize.
- Added a second, prominent Lodge link in the home-screen hero, independent of the tiny header navigation.
- Preserved existing app data: no changes to IndexedDB trophy schema, `cso_gps_v4`, hunting companion storage, or user trophy records.

## Verification
- Automated project suite is run below in this build environment.
- Live Safari/iPhone home-screen validation is not possible from this environment. User must receive a new deployment for the service-worker update to reach the installed app.
- No live AI generation is claimed by this reliability patch.

## Files changed
`sw.js`, `index.html`, `trophy.js`, `lodge.html`, `package.json`, `README.md`; added `app-boot.js`, `lodge-boot.js`.

## Budget and approvals
$0 spent. No accounts, billing, deployment, or publishing performed.
