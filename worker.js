/**
 * CSO Trophy Studio — server-side OpenAI image-edit Worker.
 *
 * Fail-closed requirements:
 *   - GENERATION_ENABLED=true (otherwise no photo is accepted)
 *   - OPENAI_API_KEY secret
 *   - TURNSTILE_SECRET_KEY secret + public Turnstile sitekey in the app
 *   - exact APP_ORIGIN
 *   - CSO_USAGE_GUARD Durable Object binding
 *
 * The API key is never returned to or embedded in the browser. This Worker
 * does not persist source or result images. It intentionally uses a strict
 * daily request cap for early owner testing.
 */
const MODEL_DEFAULT = 'gpt-image-2.6-sunburst';
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 256 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const STYLES = new Set(['Classic shoulder mount', 'European mount', 'Pedestal display', 'Outdoor portrait']);
const BACKGROUNDS = new Set(['Warm lodge', 'Modern trophy room', 'Rustic cabin', 'Neutral studio', 'Autumn woods']);
const PLAQUES = new Set(['Dark walnut', 'Natural oak', 'Matte black', 'No plaque']);
const ACTION_DEFAULT = 'cso_trophy_generate';
// OpenAI published Standard Images API rates checked 2026-11-24. The lower
// $4/$2.50/$15 rates are Batch rates and do not apply to this direct request.
// Refresh before activation; this estimate is telemetry, not a retail price.
const STANDARD_RATES = Object.freeze({ imageInput: 8, textInput: 5, imageOutput: 30 });
const RATE_CARD_CHECKED_ON = '2026-11-24';

function safeTokenCount(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

export function summarizeUsage(usage) {
  if (!usage || typeof usage !== 'object') return null;
  const inputDetails = usage.input_tokens_details || {};
  const outputDetails = usage.output_tokens_details || {};
  const inputTokens = safeTokenCount(usage.input_tokens);
  const outputTokens = safeTokenCount(usage.output_tokens);
  const imageInputTokens = safeTokenCount(inputDetails.image_tokens);
  const textInputTokens = safeTokenCount(inputDetails.text_tokens);
  if (inputTokens === null || outputTokens === null || imageInputTokens === null || textInputTokens === null) return null;

  // Image-edit responses may omit output_tokens_details. For this endpoint,
  // output_tokens are the generated image tokens unless a split is supplied.
  const imageOutputTokens = safeTokenCount(outputDetails.image_tokens) ?? outputTokens;
  const textOutputTokens = safeTokenCount(outputDetails.text_tokens) ?? 0;
  const estimatedCostUsd = (
    imageInputTokens * STANDARD_RATES.imageInput
    + textInputTokens * STANDARD_RATES.textInput
    + imageOutputTokens * STANDARD_RATES.imageOutput
  ) / 1_000_000;

  return {
    inputTokens,
    outputTokens,
    imageInputTokens,
    textInputTokens,
    imageOutputTokens,
    textOutputTokens,
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(8)),
    currency: 'USD',
    pricingBasis: 'OpenAI Standard API token rates',
    rateCardCheckedOn: RATE_CARD_CHECKED_ON
  };
}

function corsHeaders(origin, allowedOrigin) {
  const headers = new Headers({
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'X-Content-Type-Options': 'nosniff'
  });
  if (origin && allowedOrigin && origin === allowedOrigin) headers.set('Access-Control-Allow-Origin', allowedOrigin);
  return headers;
}

function json(data, status, cors) {
  const headers = new Headers(cors);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store, private');
  return new Response(JSON.stringify(data), { status, headers });
}

function clampInt(value, fallback, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, parsed));
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function verifyTurnstile(token, env, expectedHostname) {
  if (!env.TURNSTILE_SECRET_KEY || !token || token.length > 2048) return false;
  let response;
  try {
    response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
        idempotency_key: crypto.randomUUID()
      })
    });
  } catch {
    return false;
  }
  if (!response.ok) return false;
  const result = await response.json().catch(() => ({}));
  return result.success === true
    && result.hostname === expectedHostname
    && result.action === (env.TURNSTILE_ACTION || ACTION_DEFAULT);
}

async function readBoundedBody(stream, maximumBytes) {
  if (!stream) return null;
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined.buffer;
}

async function validImageFile(file) {
  if (!(file instanceof File) || !ALLOWED_TYPES.has(file.type) || file.size < 4 || file.size > MAX_IMAGE_BYTES) return false;
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.type === 'image/png') return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  return bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
}

function safeField(value, maxLength) {
  return String(value || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, maxLength);
}

function buildTrustedPrompt(form) {
  const styleValue = safeField(form.get('style'), 50);
  const backgroundValue = safeField(form.get('background'), 50);
  const plaqueValue = safeField(form.get('plaque'), 50);
  const style = STYLES.has(styleValue) ? styleValue : 'Classic shoulder mount';
  const background = BACKGROUNDS.has(backgroundValue) ? backgroundValue : 'Warm lodge';
  const plaque = PLAQUES.has(plaqueValue) ? plaqueValue : 'Dark walnut';
  const name = safeField(form.get('name'), 40) || 'No name supplied';
  const yearRaw = safeField(form.get('year'), 4);
  const year = /^\d{4}$/.test(yearRaw) ? yearRaw : 'Not supplied';
  const preserve = form.get('preserve') === 'true';

  return `Create a premium, photorealistic digital taxidermy artwork based on the uploaded real whitetail deer harvest photograph(s). This is an EDIT of the supplied reference photography, not a new unrelated deer.\n\nMOUNT STYLE: ${style}. DISPLAY SETTING: ${background}. PLAQUE: ${plaque}. TROPHY NAME: ${name}. HARVEST YEAR: ${year}.\n\nCRITICAL SUBJECT PRESERVATION: Treat the first original harvest photo as the identity anchor and use additional angles only to clarify details. Preserve the visible antler architecture as closely as possible: left/right beam shape, tine count, tine positions, curvature, spread, asymmetry, stickers, drop tines, and visible damage. Do not add, remove, straighten, mirror, enlarge, or invent antler points. Preserve the animal's recognizable face, coat color, and proportions. Do not turn it into a generic oversized trophy buck. If details are obscured in the reference, do not fabricate extra features.\n\nCreate a believable professionally mounted taxidermy presentation with anatomically plausible neck/head proportions, realistic hair texture, natural glass eyes, accurate skull/antler attachment, and professional studio lighting. Keep the full rack visible and inside the frame. Do not include extra deer, extra antlers, duplicate beams, text, logos, watermarks, or graphic overlays. ${preserve ? 'Favor fidelity to the reference over dramatic embellishment.' : 'Use tasteful presentation styling while keeping the deer recognizable.'} The result is digital artwork, not a guaranteed exact physical replica.`;
}

async function reserveGeneration(request, env) {
  if (!env.CSO_USAGE_GUARD) return { ok: false, unavailable: true };
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ipHash = await sha256Hex(ip);
  const maxDaily = clampInt(env.MAX_GENERATIONS_PER_DAY, 1, 10);
  const maxPerIp = clampInt(env.MAX_GENERATIONS_PER_IP_PER_DAY, 1, maxDaily);
  try {
    const id = env.CSO_USAGE_GUARD.idFromName('cso-global-generation-budget');
    const stub = env.CSO_USAGE_GUARD.get(id);
    const response = await stub.fetch('https://usage-guard/consume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ipHash, maxDaily, maxPerIp })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok !== true) return { ok: false, limited: response.status === 429 || result.limited === true };
    return { ok: true };
  } catch {
    return { ok: false, unavailable: true };
  }
}

export class CSOUsageGuard {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/consume') {
      return new Response('Not found', { status: 404 });
    }
    let body;
    try { body = await request.json(); } catch { return json({ ok: false }, 400, {}); }
    const ipHash = String(body.ipHash || '');
    const maxDaily = clampInt(body.maxDaily, 1, 10);
    const maxPerIp = clampInt(body.maxPerIp, 1, maxDaily);
    if (!/^[a-f0-9]{64}$/.test(ipHash)) return json({ ok: false }, 400, {});

    const day = new Date().toISOString().slice(0, 10);
    const result = await this.state.storage.transaction(async txn => {
      let usage = await txn.get('daily-usage');
      if (!usage || usage.day !== day) usage = { day, total: 0, ips: {} };
      const ipCount = Number(usage.ips[ipHash] || 0);
      if (usage.total >= maxDaily || ipCount >= maxPerIp) return { ok: false, limited: true };
      usage.total += 1;
      usage.ips[ipHash] = ipCount + 1;
      await txn.put('daily-usage', usage);
      return { ok: true, remaining: Math.max(0, maxDaily - usage.total) };
    });
    return json(result, result.ok ? 200 : 429, {});
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowedOrigin = (env.APP_ORIGIN || '').replace(/\/$/, '');
    const cors = corsHeaders(origin, allowedOrigin);
    if (request.method === 'OPTIONS') {
      if (!allowedOrigin || origin !== allowedOrigin) return new Response(null, { status: 403, headers: cors });
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, cors);
    if (!allowedOrigin || origin !== allowedOrigin) return json({ error: 'This app origin is not authorized.' }, 403, cors);

    // Explicitly disabled until the owner has approved credentials, provider
    // spend, Turnstile setup, and deployment. No photo is parsed or forwarded.
    if (env.GENERATION_ENABLED !== 'true') return json({ error: 'Secure AI generation is not enabled for this CSO test build.' }, 503, cors);
    if (!env.OPENAI_API_KEY || !env.TURNSTILE_SECRET_KEY || !env.CSO_USAGE_GUARD) {
      return json({ error: 'The secure image service is missing required server configuration.' }, 503, cors);
    }

    const declaredSize = Number(request.headers.get('Content-Length') || 0);
    if (declaredSize > MAX_REQUEST_BYTES) return json({ error: 'Please use smaller photos. The request limit is 12 MB.' }, 413, cors);
    const contentType = request.headers.get('Content-Type') || '';
    if (!/^multipart\/form-data\s*;\s*boundary=/i.test(contentType)) return json({ error: 'A multipart photo request is required.' }, 400, cors);

    let form;
    try {
      const bodyBytes = await readBoundedBody(request.body, MAX_REQUEST_BYTES);
      if (!bodyBytes) return json({ error: 'Please use smaller photos. The request limit is 12 MB.' }, 413, cors);
      form = await new Response(bodyBytes, { headers: { 'Content-Type': contentType } }).formData();
    } catch {
      return json({ error: 'Could not read the uploaded photos.' }, 400, cors);
    }

    const primaryValues = form.getAll('image');
    const primary = primaryValues[0];
    const referenceValues = form.getAll('references');
    if (primaryValues.length !== 1 || !(primary instanceof File)) return json({ error: 'Exactly one primary harvest photo is required.' }, 400, cors);
    if (referenceValues.length > 3 || referenceValues.some(value => !(value instanceof File))) {
      return json({ error: 'Use no more than three additional reference photos.' }, 400, cors);
    }
    const files = [primary, ...referenceValues];
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_UPLOAD_BYTES || files.some(file => !file.size || file.size > MAX_IMAGE_BYTES)) {
      return json({ error: 'The selected photos are too large or empty. Please choose smaller images.' }, 413, cors);
    }
    for (const file of files) {
      if (!(await validImageFile(file))) return json({ error: 'One of the selected photos is not a valid JPG, PNG, or WebP image.' }, 415, cors);
    }

    const token = String(form.get('cf-turnstile-response') || '');
    let hostname;
    try { hostname = new URL(allowedOrigin).hostname; }
    catch { return json({ error: 'The secure image service origin is not configured correctly.' }, 503, cors); }
    if (!(await verifyTurnstile(token, env, hostname))) {
      return json({ error: 'Security verification expired or failed. Please complete the security check again.' }, 403, cors);
    }

    const budget = await reserveGeneration(request, env);
    if (!budget.ok) {
      return json({ error: budget.limited ? 'The CSO test generation limit has been reached. Please try again tomorrow.' : 'The secure generation limit service is unavailable. No image was sent to the provider.' }, budget.limited ? 429 : 503, cors);
    }

    const prompt = buildTrustedPrompt(form);
    const upstream = new FormData();
    upstream.append('model', env.IMAGE_MODEL || MODEL_DEFAULT);
    upstream.append('prompt', prompt);
    upstream.append('quality', 'high');
    upstream.append('size', '1024x1536');
    upstream.append('output_format', 'png');
    files.forEach((file, index) => {
      const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      upstream.append('image[]', file, `harvest-reference-${index + 1}.${extension}`);
    });

    let upstreamResponse;
    try {
      upstreamResponse = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
        body: upstream
      });
    } catch {
      return json({ error: 'The image provider could not be reached. The test-generation allowance has been used; please try again tomorrow.' }, 502, cors);
    }
    const payload = await upstreamResponse.json().catch(() => ({}));
    if (!upstreamResponse.ok) {
      return json({ error: upstreamResponse.status === 429 ? 'The image provider is temporarily rate-limited. Please try again later.' : 'The image provider could not create this mount. Please try again later.' }, upstreamResponse.status === 429 ? 429 : 502, cors);
    }
    const image = payload?.data?.[0]?.b64_json;
    if (!image) return json({ error: 'The image provider returned no finished image.' }, 502, cors);
    const responseBody = {
      image,
      mimeType: 'image/png',
      model: env.IMAGE_MODEL || MODEL_DEFAULT,
      provider: 'openai-secure-worker'
    };
    const usage = summarizeUsage(payload?.usage);
    if (usage) responseBody.usage = usage;
    const requestId = String(upstreamResponse.headers.get('x-request-id') || '').slice(0, 128);
    if (requestId) responseBody.requestId = requestId;
    return json(responseBody, 200, cors);
  }
};
