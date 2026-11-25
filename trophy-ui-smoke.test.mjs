import assert from 'node:assert/strict';

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
  toggle(value, force) {
    if (force === undefined) {
      if (this.values.has(value)) { this.values.delete(value); return false; }
      this.values.add(value); return true;
    }
    if (force) this.values.add(value); else this.values.delete(value);
    return Boolean(force);
  }
}

class FakeNode {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.className = '';
    this.children = [];
    this.listeners = {};
    this.classList = new FakeClassList();
    this.dataset = {};
    this.attributes = {};
    this.value = '';
    this.files = [];
    this.disabled = false;
    this.checked = false;
    this.text = '';
    this.src = '';
    this.href = '';
    this.download = '';
  }
  set textContent(value) { this.text = String(value ?? ''); this.children = []; }
  get textContent() { return this.text + this.children.map(child => child.textContent ?? '').join(''); }
  append(...nodes) { for (const node of nodes) this.children.push(typeof node === 'string' ? new FakeText(node) : node); }
  replaceChildren(...nodes) { this.children = []; this.text = ''; this.append(...nodes); }
  addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
  getContext() { return { drawImage() {} }; }
  toBlob(callback, type = 'image/jpeg') { callback(new Blob([new Uint8Array([9,8,7,6])], { type })); }
  async dispatch(type, event = {}) {
    event.target ||= this;
    event.currentTarget = this;
    for (const callback of this.listeners[type] || []) await callback(event);
  }
}
class FakeText {
  constructor(text) { this.text = String(text); }
  get textContent() { return this.text; }
}

const ids = [
  'photo','cameraPhoto','references','sourceImage','uploadContent','drop','preview','create','status',
  'uploadConsentWrap','uploadConsent','privacyNotice','engineEndpoint','endpointSaved','sumStyle',
  'sumBackground','sumName','sumYear','sumPhoto','sumReferences','referenceCount','clearPhotosBtn',
  'addReferencesBtn','referenceList','photoMeta','resultActions','downloadResult','previewCaption',
  'chooseBtn','cameraBtn','addReferencesBtn','background','name','year','plaque','preserve','saveEndpoint',
  'engineTurnstileSiteKey','turnstileWidget','generationUsage','reviewMount','saveToGallery'
];
const elements = Object.fromEntries(ids.map(id => [id, new FakeNode(id === 'photo' || id === 'cameraPhoto' || id === 'references' ? 'input' : 'div')]));
const styleButtons = ['Classic shoulder mount','European mount','Pedestal display','Outdoor portrait'].map((style, index) => {
  const button = new FakeNode('button');
  button.dataset.style = style;
  if (index === 0) button.classList.add('selected');
  return button;
});
const document = {
  head: new FakeNode('head'),
  getElementById: id => elements[id] || (elements[id] = new FakeNode()),
  createElement: tag => new FakeNode(tag),
  querySelectorAll: selector => selector === '.style' ? styleButtons : []
};
const store = new Map();
const localStorage = {
  getItem: key => store.has(key) ? store.get(key) : null,
  setItem: (key, value) => store.set(key, String(value))
};
const navigator = { serviceWorker: { register: async () => ({}) } };
let turnstileOptions = null;
const window = {
  isSecureContext: true,
  turnstile: {
    render(container, options) { turnstileOptions = options; return 'test-widget'; },
    reset() {},
    remove() {}
  }
};
let fetchCalls = 0;
let providerEnabled = false;
Object.defineProperty(globalThis, 'document', { value: document, configurable: true });
Object.defineProperty(globalThis, 'localStorage', { value: localStorage, configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: navigator, configurable: true });
Object.defineProperty(globalThis, 'window', { value: window, configurable: true });
Object.defineProperty(globalThis, 'fetch', { value: async (url, options) => {
  fetchCalls += 1;
  if (!providerEnabled) throw new Error('Unexpected network request');
  assert.equal(url, 'https://approved-worker.example/generate');
  assert.equal(options.method, 'POST');
  assert.ok(options.body instanceof FormData);
  assert.equal(options.body.getAll('image').length, 1);
  return new Response(JSON.stringify({
    image: 'ZmFrZS1wbmc=', mimeType: 'image/png', model: 'gpt-image-2.6-sunburst',
    usage: { inputTokens: 1200, outputTokens: 1000, imageInputTokens: 1000, textInputTokens: 200, imageOutputTokens: 1000, estimatedCostUsd: 0.039, rateCardCheckedOn: '2026-11-24' }
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}, configurable: true });
class FakeImage { constructor() { this.width = 1200; this.height = 800; } set src(value) { this._src = value; queueMicrotask(() => this.onload?.()); } get src() { return this._src; } }
Object.defineProperty(globalThis, 'Image', { value: FakeImage, configurable: true });

await import('../trophy-app.js?ui-smoke=1');

const primary = new File([new Uint8Array([1,2,3,4])], 'harvest.jpg', { type: 'image/jpeg' });
elements.photo.files = [primary];
await elements.photo.dispatch('change');
assert.equal(elements.create.disabled, true, 'Generation stays disabled without a secure backend and Turnstile sitekey');
assert.match(elements.photoMeta.textContent, /harvest\.jpg/);
assert.equal(elements.sumPhoto.textContent, 'Ready');
assert.match(elements.previewCaption.textContent, /Local preview only/);
assert.match(elements.privacyNotice.textContent, /not connected/i);
assert.equal(fetchCalls, 0, 'A local preview must not call an image provider');
assert.equal(elements.generationUsage.classList.contains('hidden'), true, 'No cost estimate is shown before a real provider response');

store.set('cso_trophy_engine_endpoint', 'https://approved-worker.example/generate');
store.set('cso_trophy_turnstile_sitekey', '1x00000000000000000000AA');
elements.engineEndpoint.value = 'https://approved-worker.example/generate';
elements.engineTurnstileSiteKey.value = '1x00000000000000000000AA';
await elements.saveEndpoint.dispatch('click');
assert.ok(turnstileOptions, 'Turnstile must render for the configured secure backend');
assert.equal(turnstileOptions.action, 'cso_trophy_generate');
assert.equal(elements.create.disabled, true, 'Generation remains disabled until Turnstile succeeds');
turnstileOptions.callback('valid-test-token');
assert.equal(elements.create.disabled, false, 'Generation becomes available only after security verification');
await elements.create.dispatch('click');
assert.match(elements.status.textContent, /confirm that you want to send/i);
assert.equal(fetchCalls, 0, 'A configured endpoint must not receive photos without explicit consent');

const references = [1,2,3,4].map(index => new File([new Uint8Array([index])], `angle-${index}.jpg`, { type: 'image/jpeg' }));
elements.references.files = references;
await elements.references.dispatch('change');
assert.equal(elements.referenceList.children.length, 3);
assert.equal(elements.referenceCount.textContent, '3 of 3 added');
assert.match(elements.status.textContent, /no more than 3/);

await elements.referenceList.children[0].children[2].dispatch('click');
assert.equal(elements.referenceList.children.length, 2);
assert.equal(elements.referenceCount.textContent, '2 of 3 added');

// Simulate a real successful backend response to exercise the result-review gate.
providerEnabled = true;
elements.uploadConsent.checked = true;
await elements.create.dispatch('click');
assert.equal(fetchCalls, 1, 'Only explicit consent may send the photo to the configured backend');
assert.equal(elements.resultActions.classList.contains('hidden'), false);
assert.equal(elements.preview.children[0].className, 'compare-grid');
assert.equal(elements.preview.children[0].children.length, 2, 'Original and generated images must be shown side by side');
assert.match(elements.previewCaption.textContent, /tine count/i);
assert.equal(elements.saveToGallery.disabled, true, 'Saving stays disabled until the hunter confirms a visual review');
assert.equal(elements.reviewMount.checked, false);

turnstileOptions.callback('fresh-regeneration-token');
assert.equal(elements.create.textContent, 'REGENERATE DIGITAL MOUNT', 'A fresh security token exposes the regenerate action');
elements.reviewMount.checked = true;
await elements.reviewMount.dispatch('change');
assert.equal(elements.saveToGallery.disabled, false, 'A reviewed generated result can be saved');

// Changing a generation choice invalidates the old output to prevent mismatched gallery metadata.
await styleButtons[1].dispatch('click');
assert.equal(elements.resultActions.classList.contains('hidden'), true);
assert.equal(elements.generationUsage.classList.contains('hidden'), true);
assert.match(elements.previewCaption.textContent, /Local preview only/);
assert.equal(elements.reviewMount.checked, false);
assert.equal(elements.saveToGallery.disabled, true);
assert.equal(elements.create.textContent, 'CREATE MY DIGITAL MOUNT');

elements.uploadConsent.checked = true;
await elements.create.dispatch('click');
assert.equal(fetchCalls, 2, 'The same selected buck can be regenerated after the user changes presentation settings');
assert.equal(elements.preview.children[0].className, 'compare-grid');

// Adding a new reference angle also invalidates the previous output.
elements.references.files = [new File([new Uint8Array([8,8,8])], 'extra-angle.jpg', { type: 'image/jpeg' })];
await elements.references.dispatch('change');
assert.equal(elements.referenceList.children.length, 3);
assert.equal(elements.resultActions.classList.contains('hidden'), true);
assert.match(elements.previewCaption.textContent, /Local preview only/);

await elements.clearPhotosBtn.dispatch('click');
assert.equal(elements.create.disabled, true);
assert.equal(elements.sumPhoto.textContent, 'Not added');
assert.equal(elements.referenceList.children.length, 0);
assert.equal(elements.sourceImage.classList.contains('hidden'), true);

const cameraPhoto = new File([new Uint8Array([5,6,7])], 'camera-shot.jpg', { type: 'image/jpeg' });
elements.cameraPhoto.files = [cameraPhoto];
await elements.cameraPhoto.dispatch('change');
assert.equal(elements.create.disabled, true);
assert.match(elements.photoMeta.textContent, /camera-shot\.jpg/);
assert.equal(fetchCalls, 2);

console.log(JSON.stringify({
  passed: [
    'Selecting a primary harvest photo enables a local preview and updates the summary',
    'Local preview does not upload or generate while secure AI is unconfigured',
    'Secure backend remains disabled until Turnstile succeeds and explicit photo consent is checked',
    'Reference photo intake enforces the three-image cap and supports individual removal',
    'Clear photos resets the primary image, reference list, and action state',
    'Camera capture input follows the same primary-photo intake flow',
    'Real backend response renders original and generated images side by side',
    'Saving is gated by an explicit visual review of rack and subject details',
    'Regeneration is clearly labeled after a fresh security check',
    'Changing mount style or adding reference photos invalidates stale output and usage'
  ],
  total: 10
}, null, 2));
