/* ============================================
   db.js — IndexedDB wrapper
   Single source of truth. Every write lands here
   first; sync.js (Phase 2) will later push rows
   where `synced === false` to Google Sheets.
   ============================================ */

const DB_NAME = 'getGorgeousDB';
const DB_VERSION = 2;

const STORES = {
  customers:         { keyPath: 'id', indexes: ['mobile', 'name'] },
  appointments:       { keyPath: 'id', indexes: ['customerId', 'scheduledAt', 'status'] },
  services:           { keyPath: 'id', indexes: ['name'] },
  bills:              { keyPath: 'id', indexes: ['customerId', 'createdAt'] },
  products:           { keyPath: 'id', indexes: ['name', 'category'] },
  purchases:          { keyPath: 'id', indexes: ['createdAt'] },
  stockTransactions:  { keyPath: 'id', indexes: ['productId', 'createdAt'] },
  expenses:           { keyPath: 'id', indexes: ['category', 'date'] },
  photos:             { keyPath: 'id', indexes: ['customerId'] },
  staff:              { keyPath: 'id', indexes: ['name'] },
  attendance:         { keyPath: 'id', indexes: ['staffId', 'date'] },
  settings:           { keyPath: 'key', indexes: [] },
};

let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      Object.entries(STORES).forEach(([storeName, cfg]) => {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: cfg.keyPath });
          cfg.indexes.forEach((idx) => store.createIndex(idx, idx, { unique: false }));
          if (cfg.keyPath !== 'key') {
            store.createIndex('synced', 'synced', { unique: false });
          }
        }
      });
    };

    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
  return _dbPromise;
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const DB = {
  uuid,

  /** Insert a new record. Auto-fills id, createdAt, synced unless caller sets them. */
  async add(storeName, record) {
    const db = await openDB();
    const now = new Date().toISOString();
    const full = {
      id: record.id || uuid(),
      createdAt: record.createdAt || now,
      updatedAt: now,
      synced: false,
      ...record,
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).add(full);
      tx.oncomplete = () => resolve(full);
      tx.onerror = (e) => reject(e.target.error);
    });
  },

  /** Update an existing record (partial patch merged onto the stored one). */
  async update(storeName, id, patch) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (!existing) return reject(new Error(`${storeName} record ${id} not found`));
        const merged = { ...existing, ...patch, updatedAt: new Date().toISOString(), synced: false };
        store.put(merged);
        resolve(merged);
      };
      getReq.onerror = (e) => reject(e.target.error);
    });
  },

  async get(storeName, id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = (e) => reject(e.target.error);
    });
  },

  async getAll(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  },

  async getByIndex(storeName, indexName, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).index(indexName).getAll(value);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  },

  async remove(storeName, id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => reject(e.target.error);
    });
  },

  async getUnsynced(storeName) {
    return this.getByIndex(storeName, 'synced', false);
  },

  // ---- settings helpers (keyPath: 'key', not part of sync) ----
  async setSetting(key, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      tx.objectStore('settings').put({ key, value });
      tx.oncomplete = () => resolve(value);
      tx.onerror = (e) => reject(e.target.error);
    });
  },

  async getSetting(key, fallback = null) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readonly');
      const req = tx.objectStore('settings').get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : fallback);
      req.onerror = (e) => reject(e.target.error);
    });
  },
};

window.DB = DB;
