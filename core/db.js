// core/db.js — IndexedDB wrapper
const AppDB = {
  db: null,

  open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('invoiceApp', 1);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('sheets')) {
          db.createObjectStore('sheets', { keyPath: 'id', autoIncrement: true });
        }
      };

      req.onsuccess = (e) => { AppDB.db = e.target.result; resolve(); };
      req.onerror = () => reject(req.error);
    });
  },

  _store(name, mode = 'readonly') {
    return AppDB.db.transaction(name, mode).objectStore(name);
  },

  add(store, data) {
    return new Promise((res, rej) => {
      const req = AppDB._store(store, 'readwrite').add({ ...data, createdAt: Date.now() });
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  },

  getAll(store) {
    return new Promise((res, rej) => {
      const req = AppDB._store(store).getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  },

  delete(store, id) {
    return new Promise((res, rej) => {
      const req = AppDB._store(store, 'readwrite').delete(id);
      req.onsuccess = () => res();
      req.onerror = () => rej(req.error);
    });
  },

  update(store, data) {
    return new Promise((res, rej) => {
      const req = AppDB._store(store, 'readwrite').put(data);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }
};
