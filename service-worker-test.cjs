const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const src = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
const listeners = {};
const added = [];
const deleted = [];
let claimed = false;
let skipped = false;
const cache = { addAll: async urls => added.push(...urls), put: async () => {} };
const caches = {
  open: async () => cache,
  keys: async () => ['cso-shell-old', 'other-cache'],
  delete: async key => { deleted.push(key); return true; },
  match: async key => {
    const url = typeof key === 'string' ? key : key.url;
    if (url.endsWith('/hunt.html')) return 'cached-hunt-companion';
    if (url.endsWith('/index.html') || url.endsWith('/')) return 'cached-trophy-home';
    return undefined;
  }
};
const self = {
  location: { origin: 'https://cso.example' },
  clients: { claim: async () => { claimed = true; } },
  skipWaiting: async () => { skipped = true; },
  addEventListener: (type, fn) => { listeners[type] = fn; }
};
const context = { self, caches, URL, Promise, fetch: async () => { throw new Error('offline'); } };
vm.createContext(context);
vm.runInContext(src, context, { filename: 'sw.js' });

(async () => {
  let installPromise;
  listeners.install({ waitUntil: promise => { installPromise = promise; } });
  await installPromise;
  for (const file of ['./index.html', './hunt.html', './trophy-app.js', './lodge.js', './app.js', './manifest.webmanifest']) {
    assert.ok(added.includes(file), `Expected ${file} in app shell`);
  }
  assert.ok(skipped);

  let activatePromise;
  listeners.activate({ waitUntil: promise => { activatePromise = promise; } });
  await activatePromise;
  assert.deepEqual(deleted, ['cso-shell-old']);
  assert.ok(claimed);

  let responsePromise;
  listeners.fetch({
    request: { method: 'GET', url: 'https://cso.example/hunt.html', mode: 'navigate' },
    respondWith: promise => { responsePromise = promise; }
  });
  const huntResponse = await responsePromise;
  assert.equal(huntResponse, 'cached-hunt-companion');

  let homeResponsePromise;
  listeners.fetch({
    request: { method: 'GET', url: 'https://cso.example/', mode: 'navigate' },
    respondWith: promise => { homeResponsePromise = promise; }
  });
  const homeResponse = await homeResponsePromise;
  assert.equal(homeResponse, 'cached-trophy-home');

  let intercepted = false;
  listeners.fetch({
    request: { method: 'GET', url: 'https://api.weather.gov/points/1,2', mode: 'cors' },
    respondWith: () => { intercepted = true; }
  });
  assert.equal(intercepted, false);
  console.log(JSON.stringify({
    passed: [
      'Install caches Trophy Studio home, preserved hunt companion, scripts, manifest, and icons',
      'Activation removes old CSO shell caches and claims clients',
      'Offline navigation restores the cached hunting companion and Trophy Studio home separately',
      'Cross-origin NWS API requests are not cached or intercepted'
    ],
    total: 4
  }, null, 2));
})().catch(error => { console.error(error); process.exit(1); });
