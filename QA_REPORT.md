# CSO Trophy Studio v0.9.4 — side-by-side result review and save gate

## Starting project inspected

Inspected the actual v0.9.3 ZIP project extracted into the working area. Reviewed the Trophy Studio home, generated production bundle, photo intake, IndexedDB gallery, secure Worker, Turnstile flow, Durable Object quota guard, service worker, manifest, and all existing test suites. v0.9.3 was used as the baseline.

## Highest-value milestone implemented

The next user-facing gap after photo intake and the prepared secure generation path was reliable visual review of generated output against the actual harvest photo. The previous result panel replaced the source preview with the generated image, so hunters could not compare the antler geometry side by side before saving.

### Changes

- Successful generation now displays the original harvest photo beside the generated digital mount, with accessible labels.
- The result caption explicitly tells the hunter to compare beam shape, visible tine count, left/right asymmetry, face, and coat.
- Saving to the local IndexedDB gallery is disabled until the hunter checks an explicit review confirmation.
- A fresh Turnstile token changes the main action label to **Regenerate Digital Mount** when a generated result exists.
- Changing the primary photo, adding/removing reference angles, or changing style, background, plaque, name, year, or preservation preference invalidates the unsaved result and its usage estimate. This prevents an output from being saved with metadata that does not match its generation settings.
- The same result can only be saved once during the page session. The user can still download the result after reviewing it.
- Existing IndexedDB gallery schema and hunting-companion `cso_gps_v4` storage key were not changed.
- Corrected the cost meter after checking current official pricing: the Worker uses the direct synchronous Images API Standard tier, so the applicable rates are $8/M image input, $5/M text input, and $30/M image output (checked 2026-11-24). v0.9.3 had used Batch rates ($4/$2.50/$15) while labeling them Standard; those lower rates do not apply to this direct request.
- Service-worker cache bumped to `cso-shell-v0.9.4`.

### Exact files changed from v0.9.3

- `trophy.js`
- `trophy-app.js` (regenerated production bundle)
- `index.html`
- `engine/worker.js` (corrected Standard API cost rates)
- `engine/SECURE_AI_SETUP.md`
- `sw.js`
- `manifest.webmanifest`
- `package.json`
- `README.md`
- `QA_REPORT.md`
- `tests/trophy-ui-smoke.test.mjs`
- `tests/engine-test.mjs`
- `tests/trophy-usage.test.mjs`
- `tests/static-check.py`
- `tests/pwa-reliability-test.mjs`
- `tests/lodge-test.mjs`

### Test results

`npm run test:all` completed successfully after rebuilding the production bundle. Static checks passed and all 97 automated assertions passed.

| Suite | Assertions | Result |
|---|---:|---|
| Hunting companion regression | 18 | PASS |
| Photo intake | 5 | PASS |
| Trophy Studio UI and simulated Worker response | 10 | PASS |
| Gallery input validation | 3 | PASS |
| Usage display formatter | 3 | PASS |
| Service worker | 4 | PASS |
| Secure Worker mock | 11 | PASS |
| Atomic usage guard | 4 | PASS |
| Archived Cloudflare Workers AI adapter | 5 | PASS |
| Archived PixelSter adapter | 5 | PASS |
| Lodge | 13 | PASS |
| PWA reliability | 16 | PASS |
| **Total** | **97** | **PASS** |

The UI smoke test uses a simulated successful Worker response to exercise the comparison panel, review checkbox, regeneration label, and stale-result invalidation. Worker usage tests also assert the corrected Standard-rate estimate. These tests do not call OpenAI or prove real image quality.

## Not tested / blockers

- No Cloudflare Worker, Durable Object namespace, or Turnstile widget was deployed or created.
- No OpenAI API key was created/configured; no API billing was enabled.
- No live image-edit request or real billing reconciliation was performed.
- No iPhone Safari/home-screen device test was performed.
- No real buck output was reviewed for tine-count, antler-geometry, face/coat fidelity, or print resolution.
- The corrected estimate has not been reconciled against a live provider invoice; it uses the published direct Standard rate card, not a measured per-mount bill.
- Side-by-side comparison and save gating are verified with a simulated browser/Worker harness, not on a physical device.

## Budget and approval boundary

Incremental spend: **$0**. Total startup cap remains $250. No account, project, API key, billing, cloud resource, deployment, publication, customer/vendor contact, or legal commitment was created or made. `GENERATION_ENABLED` remains `false` by default.
