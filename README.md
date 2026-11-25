# CSO Trophy Studio secure image engine

The active backend is `worker.js`. It uses the OpenAI Images API with real harvest photos as image-edit references. The API key is read only from the server-side `OPENAI_API_KEY` secret.

## Current status

Prepared and covered by mocked tests, but **not deployed and disabled by default**. The Worker refuses all generation until `GENERATION_ENABLED=true`, the OpenAI and Turnstile secrets exist, the exact app origin is configured, and the Durable Object binding is present. No account, secret, project, or cloud resource was created during this build.

See [`SECURE_AI_SETUP.md`](SECURE_AI_SETUP.md) before any owner-approved activation.

## Security controls

- Exact `APP_ORIGIN` check and CORS preflight handling.
- Server-side Turnstile Siteverify validation; checks `success`, exact hostname, and `cso_trophy_generate` action.
- Single-use, short-lived Turnstile tokens; client resets the widget after each attempt.
- SQLite-backed `CSOUsageGuard` Durable Object with atomic daily and per-IP generation limits. The IP is SHA-256 hashed before it reaches storage.
- Fail-closed behavior if the Worker is disabled or any required secret/binding is missing.
- Bounded multipart request reader; 12 MB total upload cap, 5 MB per file, one primary image, up to three references, strict MIME and file-signature checks.
- Server-generated prompt from allowlisted style/background/plaque values.
- No source/result image persistence, request-body logging, or API-key return path.
- `Cache-Control: no-store, private` on API responses.

Turnstile plus a low global quota is an owner-test safeguard, not complete user authentication. Do not open the endpoint to customers until authentication, monitoring, provider-side usage alerts/limits, privacy terms, and incident handling are in place.

## Provider and cost

The Worker calls `POST https://api.openai.com/v1/images/edits` using `gpt-image-2.6-sunburst`, `high` quality, `1024x1536`, PNG output. It sends the primary harvest photo and up to three optional reference angles. The prompt emphasizes rack architecture, tine count/positions, spread, asymmetry, face, coat, and proportions, but model output can still change those features.

Current standard token rates are $4 per million image-input tokens, $15 per million image-output tokens, and $2.50 per million text-input tokens. Actual cost per edit varies with image inputs and output token usage; record actual usage on a live test before estimating unit economics. The configured request cap is not a dollar-denominated guarantee.

## API contract

`POST /` multipart fields:
- `image`: one primary JPG/PNG/WebP harvest photo
- `references`: zero to three additional JPG/PNG/WebP photos
- `style`: allowlisted mount style
- `background`: allowlisted display setting
- `plaque`: allowlisted plaque finish
- `name`: optional short trophy name
- `year`: optional four-digit year
- `preserve`: `true` or `false`
- `cf-turnstile-response`: fresh Turnstile token

Returns `{ image, mimeType: "image/png", model, provider }`. The generated image is returned to the browser; the browser only writes it into local IndexedDB when the user chooses Save.

## Historical prototypes

- `pixelster.js` and `worker-free.js` are retained for historical comparison and isolated tests only. They are not active in the production bundle, and should not be deployed or selected for customer-photo processing under the current CSO security requirements.
