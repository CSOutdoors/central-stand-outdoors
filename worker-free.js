/**
 * ARCHIVED — experimental prototype only; not active and not approved for customer photos.
 * CSO Trophy Studio — Cloudflare Workers AI free-tier image engine.
 * Bind Workers AI as `AI` and KV as `CSO_RATE_LIMIT`.
 * Configure APP_ORIGIN to the exact deployed app origin.
 * No provider API key is required. Free daily Workers AI neuron limits apply.
 * This endpoint is NOT production-safe without authenticated user sessions or
 * server-validated abuse protection; Origin checks and IP limits are not auth.
 */
const MODEL = '@cf/black-forest-labs/flux-2-klein-4b';
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
function corsHeaders(origin, allowedOrigin) {
  const h = new Headers({ 'Vary':'Origin', 'Access-Control-Allow-Methods':'POST, OPTIONS', 'Access-Control-Allow-Headers':'Content-Type', 'Access-Control-Max-Age':'86400' });
  if (origin && allowedOrigin && origin === allowedOrigin) h.set('Access-Control-Allow-Origin', allowedOrigin);
  return h;
}
function json(data, status, cors) {
  const h = new Headers(cors); h.set('Content-Type','application/json; charset=utf-8'); h.set('Cache-Control','no-store');
  return new Response(JSON.stringify(data), {status, headers:h});
}
async function rateLimit(request, env) {
  if (!env.CSO_RATE_LIMIT) return {ok:false, reason:'Rate-limit storage is not configured. The service is disabled for safety.'};
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const bucket = `hour:${new Date().toISOString().slice(0,13)}:${ip}`;
  const count = Number(await env.CSO_RATE_LIMIT.get(bucket) || 0);
  const max = Math.max(1, Math.min(8, Number(env.MAX_REQUESTS_PER_HOUR || 3)));
  if (count >= max) return {ok:false, limited:true};
  await env.CSO_RATE_LIMIT.put(bucket, String(count+1), {expirationTtl:7200});
  return {ok:true};
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.APP_ORIGIN || '').replace(/\/$/,'');
    const cors = corsHeaders(origin, allowed);
    if (request.method === 'OPTIONS') return origin === allowed && allowed ? new Response(null,{status:204,headers:cors}) : new Response(null,{status:403,headers:cors});
    if (request.method !== 'POST') return json({error:'Method not allowed.'},405,cors);
    if (!allowed || origin !== allowed) return json({error:'This app origin is not authorized.'},403,cors);
    if (!env.AI || typeof env.AI.run !== 'function') return json({error:'Cloudflare Workers AI binding is not configured.'},503,cors);
    const declared = Number(request.headers.get('Content-Length') || 0);
    if (declared > MAX_UPLOAD_BYTES) return json({error:'Please use smaller photos. The request limit is 12 MB.'},413,cors);
    const limit = await rateLimit(request,env);
    if (!limit.ok) return json({error:limit.limited?'This connection has reached its temporary image limit. Please try again later.':limit.reason},limit.limited?429:503,cors);
    let form; try { form = await request.formData(); } catch { return json({error:'Could not read the uploaded photos.'},400,cors); }
    const primary = form.get('image');
    if (!(primary instanceof File) || !ALLOWED_TYPES.has(primary.type)) return json({error:'A JPG, PNG, or WebP harvest photo is required.'},400,cors);
    const refs = form.getAll('references').filter(x=>x instanceof File);
    if (refs.length > 3 || refs.some(x=>!ALLOWED_TYPES.has(x.type))) return json({error:'Use no more than three additional JPG, PNG, or WebP reference photos.'},400,cors);
    const files=[primary,...refs];
    if (files.reduce((n,f)=>n+f.size,0)>MAX_UPLOAD_BYTES || files.some(f=>!f.size)) return json({error:'The selected photos are too large or empty.'},413,cors);
    const prompt=String(form.get('prompt')||'').trim();
    if (!prompt || prompt.length>12000) return json({error:'The mount instructions are missing or too long.'},400,cors);
    const modelForm = new FormData();
    modelForm.append('prompt', `${prompt}\nUse the first reference photo as the identity anchor. Preserve the actual deer, especially the visible antler beam shape, tine count, points, spread, and asymmetry. Do not invent, remove, mirror, or symmetrize antler points. Treat this as a faithful artistic rendering, not a new deer.`);
    modelForm.append('width','768'); modelForm.append('height','1024');
    files.forEach((file,i)=>modelForm.append(`input_image_${i}`,file,`reference-${i}.jpg`));
    try {
      const serialized = new Response(modelForm);
      const result = await env.AI.run(MODEL,{multipart:{body:serialized.body,contentType:serialized.headers.get('content-type')}});
      const image = result?.image;
      if (!image) return json({error:'The free image model returned no image. Please try again later.'},502,cors);
      return json({image,mimeType:'image/png',model:MODEL,provider:'cloudflare-workers-ai-free'},200,cors);
    } catch (error) {
      const message = String(error?.message || 'The free image model is temporarily unavailable.').slice(0,350);
      return json({error:message},502,cors);
    }
  }
};
