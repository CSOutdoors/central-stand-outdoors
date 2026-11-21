# Central Stand Outdoors — Trophy Studio first (v0.9.0)

## Product direction

CSO Trophy Studio is now the primary home-screen experience and flagship digital-keepsake product. The hunting companion remains available at `hunt.html` as a secondary experience. Its existing local storage key (`cso_gps_v4`) and application logic are preserved.

## What's new in v0.8.6

- Promotes Trophy Studio to the app root (`index.html`) and PWA start screen.
- Preserves the previous hunting companion as `hunt.html`; the old `trophy.html` path redirects to the new home screen.
- Adds separate iPhone-first **Choose from Photos** and **Take a photo** actions.
- Adds primary-photo preview, replace/clear behavior, up to three additional reference angles, thumbnails, file-size display, and per-reference removal.
- Validates image files and rejects empty or oversized source photos before they enter the intake flow.
- Makes the preview explicitly local-only when no generation endpoint is connected. It does not claim that a prompt builder or photo preview is AI generation.
- Adds an explicit photo-transfer consent checkbox before any configured image endpoint can receive photos.
- Adds a personal on-device digital trophy gallery using IndexedDB, with save, list, and delete actions for completed generated artwork. Gallery content stays in this browser and is not cloud-synced or backed up.
- Registers and caches the Trophy Studio home and preserved hunting companion for the PWA shell.
- Preserves existing hunting-companion code and the `cso_gps_v4` local storage key.

## Image generation status

The private image-edit Worker adapter remains in `engine/worker.js`. It is **not deployed or connected by default**. Important security limitation: origin/CORS checks are browser controls, not user authentication; a non-browser caller can forge an Origin header. IP rate limiting alone is not sufficient protection for a public paid-generation endpoint. Do not expose this Worker publicly until an abuse-resistant access layer (for example, verified Turnstile plus server-side rate and spend controls, or authenticated user sessions) is implemented and tested. The API key must remain a server-side secret, never in browser code or GitHub Pages. A working service still requires owner-approved provider credentials, an approved server deployment, a configured rate-limit KV binding, spend controls, and real mobile/quality testing. No live generation call or paid API request was made in this build.

The image edit pipeline uses the hunter's harvest photo(s) as references and instructs the model to preserve the original rack architecture, tine count, asymmetry, face, coat, and proportions. These prompts cannot guarantee exact identity preservation. A controlled human-reviewed test set is required before CSO markets fidelity claims.

## Photo privacy and retention

- Before generation is connected, selected images are held only in the current browser page session using local object URLs. They are not written to local storage, uploaded, or saved to a CSO account/gallery.
- If an endpoint is configured, images are not sent until the user checks the consent box and presses Create.
- The current Worker code does not persist uploaded or generated image files in its own storage. The upstream image provider's current processing and retention terms must still be reviewed before enabling the service.
- A future gallery needs authenticated access, per-user ownership, clear retention/deletion controls, and secure object storage before it is implemented.

## Hunting companion compatibility

The original field companion is preserved at `hunt.html`. Do not clear Safari website data or change its storage key. The existing `cso_gps_v4` property, point, parcel, and weather records remain in the same browser storage namespace.

## Run checks

```sh
npm run test:all
```

The checks cover the preserved hunting companion, photo intake validation, PWA shell, and mocked image Worker behavior. They do not replace Safari/iPhone device tests or live provider-quality tests.

## Deploy

No deployment was performed. After owner approval, upload the **contents** of this project folder to the root of the existing GitHub Pages repository. Confirm the GitHub Pages origin before configuring the private Worker. Open the secure HTTPS site in Safari and use Share → Add to Home Screen.

## Budget

No accounts, paid services, billing, vendor contacts, or deployments were created or enabled. Incremental spend for this change: **$0**. The total startup cap remains **$250**.


## Free AI image-generation prototype (v0.8.7)

A separate Cloudflare Workers AI backend is included at `engine/worker-free.js`. It uses FLUX.2 Klein 4B image editing and Cloudflare's published 10,000-Neuron daily free allowance. See `engine/FREE_TIER_SETUP.md` for the limits, setup steps, and privacy/security caveats. The backend is not deployed or connected; no account, API key, or billing has been created.


## CSO Trophy Lodge concept (v0.8.8)

- Adds a dedicated iPhone-friendly `lodge.html` virtual great room, with a fireplace, timber walls, and curated wall displays.
- Adds 12 original inline-SVG trophy presentation studies across classic shoulder, European, pedestal, and family collections.
- Adds collection filters and a detail modal for each study.
- Links the Lodge from the Trophy Studio home screen and caches it for offline shell use.
- The 12 visuals are illustrative concept artwork only. They are **not AI-generated images, not actual harvest-photo transformations, and not evidence of antler-identity preservation**. The real AI image-generation milestone remains open.
- No external image service, account, API, deployment, payment, or customer-photo upload is involved.

Run `npm run test:lodge` to check the lodge page, all 12 study entries, filters, detail behavior, and offline cache entries.


## Free no-signup AI image editing prototype (v0.9.0)

- Adds FreeAPI PixelSter as the default image-to-image provider, using its documented `POST /api/pti` endpoint and Flux Kontext Dev. The provider advertises no signup, no API key, no subscription, no watermark, and fair-use throttling.
- The iPhone flow now prepares the selected primary harvest photo, sends it with CSO's antler-preservation prompt only after explicit consent, retrieves the resulting image, and enables download and local gallery save.
- The adapter lives in `engine/pixelster.js`; it does not require a CSO account, Cloudflare account, API key, or server deployment.
- PixelSter accepts one reference photo for this integration. Additional angles remain local and are not sent by this provider. Choose the clearest full-rack image as the primary photo.
- Provider states its standard APIs are free for personal and commercial projects under fair use; availability is not guaranteed. The provider says prompts and outputs are not permanently stored. Review current [privacy](https://freeapi.pro/privacy) and [terms](https://freeapi.pro/terms) before uploading.
- The selected photo leaves the iPhone only after the user checks the consent box and taps Create. No photos are sent automatically.
- The adapter is covered by mocked request/response tests. A live provider call, CORS behavior, model output quality, antler fidelity, and Safari/iPhone operation have **not** yet been independently verified in this environment. This is a prototype integration, not a production SLA.

Run `npm run test:pixelster` for adapter tests and `npm run test:all` for the full suite.


## v0.9.0 iPhone PWA reliability patch
- Network-first service-worker fetch strategy so an installed iPhone home-screen app does not remain pinned to stale UI/scripts while online; cached files remain available offline.
- Added explicit service-worker update checks and visible module-startup error handling.
- Added a prominent Lodge entry point in the Trophy Studio hero.
- No changes to IndexedDB trophy records or hunting-companion localStorage keys.
