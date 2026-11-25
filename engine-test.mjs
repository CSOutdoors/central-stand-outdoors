import assert from 'node:assert/strict';
import worker, { CSOUsageGuard, summarizeUsage } from '../engine/worker.js';

const origin = 'https://example.github.io';
const storage = new Map();
const state = { storage: { async transaction(callback) {
  const draft = new Map(storage);
  const txn = {
    async get(key) { return draft.get(key); },
    async put(key, value) { draft.set(key, structuredClone(value)); }
  };
  const result = await callback(txn);
  storage.clear();
  for (const [key, value] of draft) storage.set(key, value);
  return result;
} } };
const guard = new CSOUsageGuard(state);
const namespace = { idFromName: name => name, get: () => ({ fetch: (url, init) => guard.fetch(new Request(url, init)) }) };
const env = {
  GENERATION_ENABLED: 'true',
  OPENAI_API_KEY: 'server-only-test-secret',
  TURNSTILE_SECRET_KEY: 'turnstile-server-secret',
  APP_ORIGIN: origin,
  CSO_USAGE_GUARD: namespace,
  IMAGE_MODEL: 'gpt-image-2.6-sunburst',
  MAX_GENERATIONS_PER_DAY: '1',
  MAX_GENERATIONS_PER_IP_PER_DAY: '1'
};
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const oldFetch = globalThis.fetch;
let turnstileCalls = 0;
let upstreamCalls = 0;
let upstreamImages = 0;
let upstreamPrompt = '';
let turnstileResult = { success: true, hostname: 'example.github.io', action: 'cso_trophy_generate' };
globalThis.fetch = async (url, options) => {
  if (url === 'https://challenges.cloudflare.com/turnstile/v0/siteverify') {
    turnstileCalls += 1;
    const body = JSON.parse(options.body);
    assert.equal(body.secret, 'turnstile-server-secret');
    assert.equal(body.response, 'valid-turnstile-token');
    assert.ok(body.idempotency_key);
    return new Response(JSON.stringify(turnstileResult), { status: 200 });
  }
  if (url === 'https://api.openai.com/v1/images/edits') {
    upstreamCalls += 1;
    assert.equal(options.headers.Authorization, 'Bearer server-only-test-secret');
    assert.equal(options.body.get('model'), 'gpt-image-2.6-sunburst');
    assert.equal(options.body.get('quality'), 'high');
    assert.equal(options.body.get('size'), '1024x1536');
    upstreamImages = options.body.getAll('image[]').length;
    upstreamPrompt = options.body.get('prompt');
    assert.match(upstreamPrompt, /tine count/i);
    assert.match(upstreamPrompt, /asymmetry/i);
    assert.match(upstreamPrompt, /November buck/);
    return new Response(JSON.stringify({
      data: [{ b64_json: 'ZmFrZS1wbmc=' }],
      usage: {
        input_tokens: 1200,
        input_tokens_details: { image_tokens: 1000, text_tokens: 200 },
        output_tokens: 1000,
        output_tokens_details: { image_tokens: 1000, text_tokens: 0 }
      }
    }), { status: 200, headers: { 'x-request-id': 'req_cso_test_123' } });
  }
  throw new Error(`Unexpected fetch: ${url}`);
};

function makeRequest({ ip = '203.0.113.10', token = 'valid-turnstile-token', validImage = true } = {}) {
  const form = new FormData();
  const bytes = validImage ? jpeg : new Uint8Array([1, 2, 3, 4, 5, 6]);
  form.append('image', new File([bytes], 'buck.jpg', { type: 'image/jpeg' }));
  form.append('references', new File([jpeg], 'left.jpg', { type: 'image/jpeg' }));
  form.append('references', new File([jpeg], 'right.jpg', { type: 'image/jpeg' }));
  form.append('cf-turnstile-response', token);
  form.append('style', 'Classic shoulder mount');
  form.append('background', 'Warm lodge');
  form.append('plaque', 'Dark walnut');
  form.append('name', 'November buck');
  form.append('year', '2026');
  form.append('preserve', 'true');
  return new Request('https://worker.example/generate', {
    method: 'POST',
    headers: { Origin: origin, 'CF-Connecting-IP': ip },
    body: form
  });
}

try {
  let response = await worker.fetch(new Request('https://worker.example/', { method: 'POST', headers: { Origin: 'https://evil.example' } }), env);
  assert.equal(response.status, 403);
  response = await worker.fetch(new Request('https://worker.example/', { method: 'GET', headers: { Origin: origin } }), env);
  assert.equal(response.status, 405);

  const disabled = { ...env, GENERATION_ENABLED: 'false' };
  response = await worker.fetch(makeRequest(), disabled);
  assert.equal(response.status, 503);
  assert.equal(turnstileCalls, 0);
  assert.equal(upstreamCalls, 0);

  const missingSecrets = { ...env, TURNSTILE_SECRET_KEY: undefined };
  response = await worker.fetch(makeRequest(), missingSecrets);
  assert.equal(response.status, 503);
  assert.equal(turnstileCalls, 0);

  response = await worker.fetch(makeRequest({ validImage: false }), env);
  assert.equal(response.status, 415);
  assert.equal(turnstileCalls, 0);

  turnstileResult = { success: false, hostname: 'example.github.io', action: 'cso_trophy_generate' };
  response = await worker.fetch(makeRequest({ ip: '203.0.113.20' }), env);
  assert.equal(response.status, 403);
  assert.equal(upstreamCalls, 0);

  turnstileResult = { success: true, hostname: 'attacker.example', action: 'cso_trophy_generate' };
  response = await worker.fetch(makeRequest({ ip: '203.0.113.21' }), env);
  assert.equal(response.status, 403);
  assert.equal(upstreamCalls, 0);

  turnstileResult = { success: true, hostname: 'example.github.io', action: 'wrong_action' };
  response = await worker.fetch(makeRequest({ ip: '203.0.113.22' }), env);
  assert.equal(response.status, 403);
  assert.equal(upstreamCalls, 0);

  turnstileResult = { success: true, hostname: 'example.github.io', action: 'cso_trophy_generate' };
  response = await worker.fetch(makeRequest(), env);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.image, 'ZmFrZS1wbmc=');
  assert.equal(result.mimeType, 'image/png');
  assert.equal(result.model, 'gpt-image-2.6-sunburst');
  assert.equal(result.provider, 'openai-secure-worker');
  assert.equal(result.requestId, 'req_cso_test_123');
  assert.equal(result.usage.imageInputTokens, 1000);
  assert.equal(result.usage.textInputTokens, 200);
  assert.equal(result.usage.imageOutputTokens, 1000);
  assert.equal(result.usage.estimatedCostUsd, 0.039);
  assert.equal(result.usage.rateCardCheckedOn, '2026-11-24');
  assert.equal(upstreamImages, 3);
  assert.doesNotMatch(JSON.stringify(result), /server-only-test-secret/);
  assert.equal(response.headers.get('Cache-Control'), 'no-store, private');

  response = await worker.fetch(makeRequest({ ip: '203.0.113.99' }), env);
  assert.equal(response.status, 429, 'The global daily cap must stop a second provider call even from a different IP');
  assert.equal(upstreamCalls, 1);

  const noGuard = { ...env, CSO_USAGE_GUARD: undefined };
  response = await worker.fetch(makeRequest({ ip: '203.0.113.30' }), noGuard);
  assert.equal(response.status, 503);

  const noUsage = summarizeUsage(null);
  assert.equal(noUsage, null, 'Missing usage must not produce a fabricated cost estimate');
  const malformedUsage = summarizeUsage({ input_tokens: 1, output_tokens: 1, input_tokens_details: { image_tokens: 'unknown', text_tokens: 0 } });
  assert.equal(malformedUsage, null, 'Malformed token details must not produce a fabricated cost estimate');

  console.log(JSON.stringify({
    passed: [
      'Rejects unauthorized origins and unsupported methods',
      'Fails closed while generation is disabled or secrets are missing',
      'Rejects spoofed MIME types by checking image file signatures',
      'Validates Turnstile success, hostname, and action server-side',
      'Sends the primary harvest photo and two reference angles to OpenAI image edits',
      'Builds the antler-preservation prompt on the server from allowlisted choices',
      'Returns sanitized provider token usage, a standard-rate cost estimate, and request ID without exposing secrets',
      'Keeps the API key out of the response and sets no-store headers',
      'Enforces the global daily cap before a second provider call',
      'Fails closed when the atomic usage guard is unavailable',
      'Does not fabricate cost when usage is absent or malformed'
    ],
    total: 11
  }, null, 2));
} finally {
  globalThis.fetch = oldFetch;
}
