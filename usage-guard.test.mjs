import assert from 'node:assert/strict';
import { CSOUsageGuard } from '../engine/worker.js';
const store = new Map();
const state = { storage: { async transaction(callback) {
  const draft = new Map(store);
  const txn = {
    async get(key) { return draft.get(key); },
    async put(key, value) { draft.set(key, structuredClone(value)); }
  };
  const result = await callback(txn);
  store.clear();
  for (const [key, value] of draft) store.set(key, value);
  return result;
} } };
const guard = new CSOUsageGuard(state);
const hashA = 'a'.repeat(64);
const hashB = 'b'.repeat(64);
const consume = async (ipHash, maxDaily = 3, maxPerIp = 1) => guard.fetch(new Request('https://usage-guard/consume', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ipHash, maxDaily, maxPerIp })
}));

let response = await consume(hashA);
assert.equal(response.status, 200);
assert.equal((await response.json()).remaining, 2);
response = await consume(hashA);
assert.equal(response.status, 429, 'Per-IP daily cap blocks a second generation');
response = await consume(hashB);
assert.equal(response.status, 200, 'A second IP may use the remaining global allowance');
response = await consume('not-a-hash');
assert.equal(response.status, 400);
response = await guard.fetch(new Request('https://usage-guard/other', { method: 'POST' }));
assert.equal(response.status, 404);
response = await guard.fetch(new Request('https://usage-guard/consume', { method: 'GET' }));
assert.equal(response.status, 404);
console.log(JSON.stringify({
  passed: [
    'Atomically reserves a daily generation slot',
    'Enforces per-IP daily limit using a hashed address only',
    'Allows another IP while global daily allowance remains',
    'Rejects malformed IP hashes and unsupported routes/methods'
  ],
  total: 4
}, null, 2));
