# CSO Trophy Studio — secure AI image-edit path (v0.9.4)

## Status

This is a prepared, fail-closed backend implementation. It is **not deployed or enabled**. No account, project, Turnstile widget, API key, billing setting, or cloud resource was created. `GENERATION_ENABLED` defaults to `false`, so the Worker refuses image requests before reading or forwarding the photo.

## Architecture

1. The iPhone browser keeps selected source photos in memory and shows a local-only preview.
2. The owner configures the HTTPS CSO Worker URL and the public Turnstile sitekey in Advanced settings.
3. The user checks explicit photo-transfer consent and completes the Turnstile challenge.
4. The browser sends the photo(s), style choices, and single-use Turnstile token to the CSO Worker.
5. The Worker validates the exact app origin, request size, file signatures, photo count, Turnstile token/hostname/action, and an atomic daily usage allowance.
6. Only then does the Worker send the photos to OpenAI's `/v1/images/edits` endpoint using a server-side `OPENAI_API_KEY` secret.
7. The Worker returns the generated PNG and does not persist source photos or output. The browser saves output locally only if the user chooses Save.

## Required server configuration (not performed)

- `APP_ORIGIN`: exact HTTPS origin serving CSO (no trailing path).
- `GENERATION_ENABLED=false` until the owner explicitly approves a live paid test.
- `IMAGE_MODEL=gpt-image-2.6-sunburst`.
- `OPENAI_API_KEY`: Worker secret, never a browser setting.
- `TURNSTILE_SECRET_KEY`: Worker secret.
- `CSO_USAGE_GUARD`: SQLite-backed Durable Object binding.
- `MAX_GENERATIONS_PER_DAY=1` and `MAX_GENERATIONS_PER_IP_PER_DAY=1` for the first controlled test.
- Public Turnstile sitekey: entered in the app's Advanced settings. It is not a secret, but must belong to the widget whose secret is installed on the Worker.

Cloudflare Turnstile validation is server-side and checks `success`, hostname, and action. Tokens expire after five minutes and are single-use. The app resets the widget after each attempt.

## Cost control

- The backend is disabled by default.
- The SQLite Durable Object atomically limits the whole service to one generation per UTC day by default, and one per IP per day. This is a request-count cap, not a dollar-denominated guarantee; provider token usage varies with source image content and model processing.
- The Worker fixes output to one 1024×1536 PNG at `high` quality and accepts at most four source photos, 12 MB total, and 5 MB per photo.
- Successful responses include sanitized provider token usage, an OpenAI request ID, and a model-cost estimate using direct Images API Standard rates checked 2026-11-24: image input $8/1M tokens, text input $5/1M tokens, and image output $30/1M tokens. The lower $4/$2.50/$15 rates are Batch rates and do not apply to this synchronous `/v1/images/edits` request. The estimate is not a guarantee or a retail price; refresh the rate card before activation and compare it with the billing dashboard.
- It reserves the daily allowance before calling the provider, so failed upstream attempts also consume the daily slot. This intentionally favors cost safety over retries.
- Current OpenAI image pricing is token-based: GPT-Image-2.6 Sunburst image input is listed at $4 per million tokens and image output at $15 per million tokens (standard rates); text input is $2.50 per million tokens. Actual edit cost is estimated from provider usage for the exact photo set and settings and is shown in the result panel. No exact per-mount retail price is promised. Compare the estimate with the provider billing record during the first approved live test.
- No API request or charge was made during this build. The $250 total startup cap is unchanged.

## Photo privacy and retention

- CSO's Worker holds images in request memory only; this code does not write photos or generated results to KV, R2, D1, logs, or a CSO server-side gallery.
- Photos leave the iPhone only after the user checks consent and starts generation. The user can clear the selected photos before submission. Generated images remain in page memory until discarded; they enter the on-device IndexedDB gallery only after the user taps Save, and can be deleted there.
- OpenAI states API data is not used for model training by default. Its current data-controls documentation lists up to 30 days of abuse-monitoring retention for `/v1/images/edits`; images flagged by safety scanning may be retained for manual review even where retention controls apply. Do not promise zero retention.
- The OpenAI API image-edit endpoint is listed as Zero Data Retention eligible, but the current published image model list does not explicitly list GPT-Image-2.6. CSO must not claim ZDR for this model without confirmation from OpenAI and project eligibility.
- Cloudflare processes the request at the Worker and Turnstile layers. Turnstile receives browser/challenge signals to validate the visitor; the harvest photo is not sent as part of the challenge itself. No image body logging is implemented. Cloudflare account log/diagnostic settings still need review before public customer use.
- Before customer launch, publish a clear privacy notice, deletion process, retention schedule, support path, and photo ownership/permission rules. No customer photos should be accepted until these are approved.

## Output quality and identity limits

The server prompt treats the primary photo as the identity anchor and asks the model to preserve beam shape, tine count, tine position, spread, asymmetry, stickers/drop tines/damage, face, coat, and proportions. This is a strong instruction, not a guarantee. The model can still alter antler geometry or facial identity. A human-reviewed test set must compare each output against the original rack before any fidelity claim or print-product work.

## Owner-approved activation checklist

1. Confirm the existing CSO website origin and hosting path.
2. Owner creates/authorizes the required Cloudflare and OpenAI API resources only after approval.
3. Owner creates a Turnstile widget restricted to the CSO hostname and provides its public sitekey.
4. Deploy the Worker with Durable Object migration; install the two secrets using Wrangler secret commands.
5. Keep `GENERATION_ENABLED=false` until all secrets, origin, Turnstile, and limit bindings are verified.
6. Owner explicitly approves the first API test and its cost cap; only then set `GENERATION_ENABLED=true`.
7. Run one owner-controlled test on iPhone Safari with a personal harvest photo, inspect the output against the rack, and record actual provider usage/cost.
8. Do not open customer access until authentication, monitoring, privacy terms, output quality, and abuse controls are reviewed.

No deployment, account creation, billing activation, customer contact, or vendor contact has been performed.
