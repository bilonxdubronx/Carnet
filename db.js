/* Stockage local (IndexedDB) */
const NAME = 'carnet-entrainement';
const VERSION = 1;
export const STORES = ['programs', 'templates', 'sessions', 'weights', 'photos', 'exercises'];
let dbp = null;

export function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const r = indexedDB.open(NAME, VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return dbp;
}

function run(store, mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req && 'result' in req ? req.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

export const all = store => run(store, 'readonly', s => s.getAll());
export const get = (store, id) => run(store, 'readonly', s => s.get(id));
export const put = (store, obj) => run(store, 'readwrite', s => s.put(obj));
export const del = (store, id) => run(store, 'readwrite', s => s.delete(id));
export const clear = store => run(store, 'readwrite', s => s.clear());
export const kvGet = key => run('kv', 'readonly', s => s.get(key));
export const kvSet = (key, val) => run('kv', 'readwrite', s => s.put(val, key));
export const kvDel = key => run('kv', 'readwrite', s => s.delete(key));
export const kvClear = () => clear('kv');
