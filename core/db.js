// core/db.js — localStorage wrapper (works on all devices including iOS PWA)
const AppDB = {

  open() {
    // Nothing to open with localStorage, just return resolved
    return Promise.resolve();
  },

  _getStore(store) {
    try {
      return JSON.parse(localStorage.getItem('appdb_' + store) || '[]');
    } catch (e) {
      return [];
    }
  },

  _saveStore(store, data) {
    localStorage.setItem('appdb_' + store, JSON.stringify(data));
  },

  add(store, data) {
    return new Promise((res) => {
      const items = AppDB._getStore(store);
      const id = Date.now() + Math.floor(Math.random() * 1000);
      const newItem = { ...data, id, createdAt: Date.now() };
      items.push(newItem);
      AppDB._saveStore(store, items);
      res(id);
    });
  },

  getAll(store) {
    return new Promise((res) => {
      res(AppDB._getStore(store));
    });
  },

  delete(store, id) {
    return new Promise((res) => {
      const items = AppDB._getStore(store).filter(i => i.id !== id);
      AppDB._saveStore(store, items);
      res();
    });
  },

  update(store, data) {
    return new Promise((res) => {
      const items = AppDB._getStore(store).map(i => i.id === data.id ? data : i);
      AppDB._saveStore(store, items);
      res(data.id);
    });
  }
};
