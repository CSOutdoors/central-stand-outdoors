const DB_NAME = 'cso_trophy_gallery';
const DB_VERSION = 1;
const STORE = 'trophies';

export function openTrophyGallery(factory = globalThis.indexedDB) {
  if (!factory) return Promise.reject(new Error('This browser does not support local trophy storage.'));
  return new Promise((resolve, reject) => {
    const request = factory.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('savedAt', 'savedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Could not open your on-device trophy gallery.'));
  });
}

function transaction(db, mode, action) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let result;
    try { result = action(store); } catch (error) { reject(error); return; }
    tx.oncomplete = () => resolve(result?.result);
    tx.onerror = () => reject(new Error('Your trophy could not be saved. Check available iPhone storage.'));
    tx.onabort = () => reject(new Error('Your trophy save was cancelled.'));
  });
}

export async function saveTrophy(record, factory = globalThis.indexedDB) {
  if (!record?.imageBlob || !(record.imageBlob instanceof Blob) || !record.imageBlob.size) throw new Error('A finished trophy image is required.');
  const db = await openTrophyGallery(factory);
  const item = {
    id: globalThis.crypto?.randomUUID?.() || `trophy-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: String(record.name || 'My Whitetail Trophy').trim().slice(0, 60) || 'My Whitetail Trophy',
    year: String(record.year || '').replace(/[^0-9]/g, '').slice(0, 4),
    style: String(record.style || 'Digital mount').slice(0, 80),
    savedAt: new Date().toISOString(),
    imageBlob: record.imageBlob
  };
  try { await transaction(db, 'readwrite', store => store.add(item)); }
  finally { db.close(); }
  return item;
}

export async function listTrophies(factory = globalThis.indexedDB) {
  const db = await openTrophyGallery(factory);
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      request.onsuccess = () => resolve((request.result || []).sort((a, b) => b.savedAt.localeCompare(a.savedAt)));
      request.onerror = () => reject(new Error('Could not load your trophy gallery.'));
    });
  } finally { db.close(); }
}

export async function deleteTrophy(id, factory = globalThis.indexedDB) {
  if (!id) throw new Error('A trophy ID is required.');
  const db = await openTrophyGallery(factory);
  try { await transaction(db, 'readwrite', store => store.delete(id)); }
  finally { db.close(); }
}
