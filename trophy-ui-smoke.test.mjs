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
  'chooseBtn','cameraBtn','addReferencesBtn','background','name','year','plaque','preserve','saveEndpoint'
];
const elements = Object.fromEntries(ids.map(id => [id, new FakeNode(id === 'photo' || id === 'cameraPhoto' || id === 'references' ? 'input' : 'div')]));
const styleButtons = ['Classic shoulder mount','European mount','Pedestal display','Outdoor portrait'].map((style, index) => {
  const button = new FakeNode('button');
  button.dataset.style = style;
  if (index === 0) button.classList.add('selected');
  return button;
});
const document = {
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
const window = { isSecureContext: true };
let fetchCalls = 0;
Object.defineProperty(globalThis, 'document', { value: document, configurable: true });
Object.defineProperty(globalThis, 'localStorage', { value: localStorage, configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: navigator, configurable: true });
Object.defineProperty(globalThis, 'window', { value: window, configurable: true });
Object.defineProperty(globalThis, 'fetch', { value: async () => { fetchCalls += 1; throw new Error('Unexpected network request'); }, configurable: true });

await import('../trophy.js?ui-smoke=1');

const primary = new File([new Uint8Array([1,2,3,4])], 'harvest.jpg', { type: 'image/jpeg' });
elements.photo.files = [primary];
await elements.photo.dispatch('change');
assert.equal(elements.create.disabled, false);
assert.match(elements.photoMeta.textContent, /harvest\.jpg/);
assert.equal(elements.sumPhoto.textContent, 'Ready');
assert.match(elements.previewCaption.textContent, /Local preview only/);

await elements.create.dispatch('click');
assert.match(elements.status.textContent, /Live AI generation is not connected/);
assert.equal(fetchCalls, 0, 'Local preview must not upload photos or call a remote service');

store.set('cso_trophy_engine_endpoint', 'https://approved-worker.example');
await elements.create.dispatch('click');
assert.match(elements.status.textContent, /Please confirm that you want to send/);
assert.equal(fetchCalls, 0, 'A configured endpoint must not receive photos without explicit consent');
store.delete('cso_trophy_engine_endpoint');

const references = [1,2,3,4].map(index => new File([new Uint8Array([index])], `angle-${index}.jpg`, { type: 'image/jpeg' }));
elements.references.files = references;
await elements.references.dispatch('change');
assert.equal(elements.referenceList.children.length, 3);
assert.equal(elements.referenceCount.textContent, '3 of 3 added');
assert.match(elements.status.textContent, /no more than 3/);

await elements.referenceList.children[0].children[2].dispatch('click');
assert.equal(elements.referenceList.children.length, 2);
assert.equal(elements.referenceCount.textContent, '2 of 3 added');

await elements.clearPhotosBtn.dispatch('click');
assert.equal(elements.create.disabled, true);
assert.equal(elements.sumPhoto.textContent, 'Not added');
assert.equal(elements.referenceList.children.length, 0);
assert.equal(elements.sourceImage.classList.contains('hidden'), true);

const cameraPhoto = new File([new Uint8Array([5,6,7])], 'camera-shot.jpg', { type: 'image/jpeg' });
elements.cameraPhoto.files = [cameraPhoto];
await elements.cameraPhoto.dispatch('change');
assert.equal(elements.create.disabled, false);
assert.match(elements.photoMeta.textContent, /camera-shot\.jpg/);
assert.equal(fetchCalls, 0);

console.log(JSON.stringify({
  passed: [
    'Selecting a primary harvest photo enables a local preview and updates the summary',
    'Preview action does not upload or generate when the secure engine is unconfigured',
    'Configured image endpoint is blocked until the user explicitly consents to photo transfer',
    'Reference photo intake enforces the three-image cap and supports individual removal',
    'Clear photos resets the primary image, reference list, and action state',
    'Camera capture input follows the same primary-photo intake flow'
  ],
  total: 6
}, null, 2));
