# Archived CSO free-tier AI prototype — not active

This document describes an earlier Cloudflare Workers AI / FLUX.2 Klein prototype. It is retained for historical comparison only.

The prototype does **not** meet the current CSO requirement for a controlled server-side image-edit service with a private API credential, owner-approved spend controls, and customer-photo privacy review. It is not connected to the Trophy Studio production browser bundle and should not be deployed or used for customer harvest photos.

The active implementation is `engine/worker.js`. See `engine/SECURE_AI_SETUP.md` for the current fail-closed OpenAI + Turnstile design. No account, API key, billing, deployment, or live image request has been created or performed.
