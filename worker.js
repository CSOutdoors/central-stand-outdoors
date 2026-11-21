/**
 * CSO Trophy Studio image engine — Cloudflare Worker
 * Required secrets/vars:
 *   OPENAI_API_KEY (secret)
 *   APP_ORIGIN (e.g. https://YOURNAME.github.io)
 *   CSO_RATE_LIMIT (KV namespace binding; recommended before public use)
 * Optional vars:
 *   IMAGE_MODEL (defaults to gpt-image-2.6-sunburst)
 *   MAX_REQUESTS_PER_HOUR (defaults to 8 per IP)
 *
 * Never place OPENAI_API_KEY in the browser or GitHub repository.
 */
const MODEL_DEFAULT = 'gpt-image-2.6-sunburst';
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function corsHeaders(origin, allowedOrigin) {
  const headers = new Headers({
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  });
  if (origin && allowedOrigin && origin === allowedOrigin) headers.set('Access-Control-Allow-Origin', allowedOrigin);
  return headers;
}
function json(data, status, cors) {
  const headers = new Headers(cors);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(data), { status, headers });
}
async function rateLimit(request, env) {
  if (!env.CSO_RATE_LIMIT) return { ok: false, reason: 'Rate-limit storage is not configured. The service is disabled for safety.' };
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const bucket = `hour:${new Date().toISOString().slice(0, 13)}:${ip}`;
  const count = Number(await env.CSO_RATE_LIMIT.get(bucket) || 0);
  const limit = Math.max(1, Math.min(30, Number(env.MAX_REQUESTS_PER_HOUR || 8)));
  if (count >= limit) return { ok: false, limited: true };
  await env.CSO_RATE_LIMIT.put(bucket, String(count + 1), { expirationTtl: 7200 });
  return { ok: true };
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
    if (!env.OPENAI_API_KEY) return json({ error: 'Image engine is not configured yet.' }, 503, cors);
    const declaredSize = Number(request.headers.get('Content-Length') || 0);
    if (declaredSize > MAX_UPLOAD_BYTES) return json({ error: 'Please use smaller photos. The request limit is 12 MB.' }, 413, cors);

    const limit = await rateLimit(request, env);
    if (!limit.ok) return json({ error: limit.limited ? 'Daily image limit reached for this connection. Please try again later.' : limit.reason }, limit.limited ? 429 : 503, cors);

    let form;
    try { form = await request.formData(); }
    catch { return json({ error: 'Could not read the uploaded photos.' }, 400, cors); }
    const primary = form.get('image');
    if (!(primary instanceof File) || !ALLOWED_TYPES.has(primary.type)) return json({ error: 'A JPG, PNG, or WebP harvest photo is required.' }, 400, cors);
    const refs = form.getAll('references').filter(x => x instanceof File);
    if (refs.length > 3 || refs.some(x => !ALLOWED_TYPES.has(x.type))) return json({ error: 'Use no more than three additional JPG, PNG, or WebP reference photos.' }, 400, cors);
    const files = [primary, ...refs];
    const total = files.reduce((sum, file) => sum + file.size, 0);
    if (total > MAX_UPLOAD_BYTES || files.some(file => file.size === 0)) return json({ error: 'The selected photos are too large or empty. Please choose smaller images.' }, 413, cors);
    const prompt = String(form.get('prompt') || '').trim();
    if (!prompt || prompt.length > 12000) return json({ error: 'The mount instructions are missing or too long.' }, 400, cors);

    const upstream = new FormData();
    upstream.append('model', env.IMAGE_MODEL || MODEL_DEFAULT);
    upstream.append('prompt', prompt);
    upstream.append('quality', 'high');
    upstream.append('size', '1024x1536');
    upstream.append('output_format', 'png');
    for (const file of files) {
      const safeName = file.name && /\.(jpe?g|png|webp)$/i.test(file.name) ? file.name : 'harvest-reference.jpg';
      upstream.append('image[]', file, safeName);
    }
    let upstreamResponse;
    try {
      upstreamResponse = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
        body: upstream
      });
    } catch {
      return json({ error: 'The image provider could not be reached. Please try again.' }, 502, cors);
    }
    const payload = await upstreamResponse.json().catch(() => ({}));
    if (!upstreamResponse.ok) {
      const message = payload?.error?.message || 'The image provider could not create this mount.';
      return json({ error: message.slice(0, 500) }, upstreamResponse.status === 429 ? 429 : 502, cors);
    }
    const image = payload?.data?.[0]?.b64_json;
    if (!image) return json({ error: 'The image provider returned no finished image.' }, 502, cors);
    return json({ image, mimeType: 'image/png', model: env.IMAGE_MODEL || MODEL_DEFAULT }, 200, cors);
  }
};
