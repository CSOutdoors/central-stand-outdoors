# CSO Trophy Studio — zero-dollar AI test path

## Selected engine

The free test backend uses Cloudflare Workers AI with `@cf/black-forest-labs/flux-2-klein-4b`, an image generation/editing model that accepts up to four reference images. Cloudflare currently includes 10,000 Workers AI Neurons per day at no charge on its Free plan. This is a daily allowance, not unlimited usage; requests stop after the allowance is exhausted. The model is metered by input/output image tiles, so actual daily image count depends on image dimensions and request shape.

At the model's documented rate (5.37 Neurons per 512px input tile and 26.05 per 512px output tile), a 768x1024 output plus one 500px input is roughly 110 Neurons before any additional references. Treat this as a rough estimate, not a guaranteed quota.

Official references:
- Workers AI free allowance and model pricing: https://developers.cloudflare.com/workers-ai/platform/pricing/
- FLUX.2 Klein 4B image editing and multipart reference-image format: https://developers.cloudflare.com/changelog/product/workers-ai/2/

## iPhone app settings

1. Choose `Cloudflare free tier · FLUX.2 Klein 4B` under Advanced → Image engine connection.
2. Enter the HTTPS URL of the deployed private Worker and save.
3. Select a harvest photo and optional reference photos. The app resizes references to a maximum 500px side for this model's documented reference-image limit.
4. Review the privacy notice and explicitly check the photo-consent box before generating.

## Backend setup (not performed)

This repository includes `worker-free.js` and `wrangler-free.toml.example`. To use it, the owner must create/authorize a Cloudflare account, create a KV namespace, deploy the Worker, configure the exact app origin, and bind Workers AI as `AI`. No API key is required for Workers AI. These are account/deployment actions and have intentionally not been performed.

## Safety and commercial limitations

- The Worker refuses to run without KV rate-limit storage. The default is three requests per IP per hour.
- Origin checks and IP rate limits are not authentication. Do not expose this endpoint publicly to customers without authenticated sessions or a server-validated anti-abuse layer.
- Do not use customer photos until privacy/retention terms and commercial model terms have been reviewed.
- This is a prototype route. FLUX may change antler geometry. No exact-rack preservation is promised. Review tine count, beam shape, spread, asymmetry, and deer identity for every result.
- Free quotas, model availability, queue capacity, and terms can change. No billing method or paid upgrade is required by this code, but do not enable paid billing or add payment details without explicit owner approval.
- Output is 768x1024 for testing; it is not yet validated for print products.
