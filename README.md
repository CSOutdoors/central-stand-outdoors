# Central Stand Outdoors — Trophy Studio first (v0.8.5)

## Product direction

CSO Trophy Studio is now the primary home-screen experience and flagship digital-keepsake product. The hunting companion remains available at `hunt.html` as a secondary experience. Its existing local storage key (`cso_gps_v4`) and application logic are preserved.

## What's new in v0.8.5

- Promotes Trophy Studio to the app root (`index.html`) and PWA start screen.
- Preserves the previous hunting companion as `hunt.html`; the old `trophy.html` path redirects to the new home screen.
- Adds separate iPhone-first **Choose from Photos** and **Take a photo** actions.
- Adds primary-photo preview, replace/clear behavior, up to three additional reference angles, thumbnails, file-size display, and per-reference removal.
- Validates image files and rejects empty or oversized source photos before they enter the intake flow.
- Makes the preview explicitly local-only when no generation endpoint is connected. It does not claim that a prompt builder or photo preview is AI generation.
- Adds an explicit photo-transfer consent checkbox before any configured image endpoint can receive photos.
- Registers and caches the Trophy Studio home and preserved hunting companion for the PWA shell.
- Preserves existing hunting-companion code and the `cso_gps_v4` local storage key.

## Image generation status

The private image-edit Worker adapter remains in `engine/worker.js`. It is **not deployed or connected by default**. The API key must remain a server-side secret, never in browser code or GitHub Pages. A working service still requires owner-approved provider credentials, an approved server deployment, a configured rate-limit KV binding, spend controls, and real mobile/quality testing. No live generation call or paid API request was made in this build.

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
