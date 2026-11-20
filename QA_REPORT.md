# QA Report — CSO v0.8.2

## Automated checks
- 18/18 application smoke tests passed.
- 4/4 service-worker tests passed.
- Static checks passed, including unique IDs, button types, PWA shell, CSP, local-only GPS behavior, and the new visible remote stand-placement workflow.
- JavaScript syntax checks passed for app.js and sw.js.

## Manual iPhone verification still required
- Confirm the new Add Stand / Location button is visible without opening advanced tools.
- Search for a property many miles away, zoom to a known stand, tap and drag the pin, and save.
- Confirm the stand persists and appears in Today's Hunt and the saved locations list.
- Confirm existing local stands and settings remain intact after deployment.

Automated checks do not replace real-device map tile, touch, and GPS testing.
