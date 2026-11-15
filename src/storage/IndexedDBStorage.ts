export interface StorageBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

const DB_NAME = 'kod-koronaja';
const STORE = 'saves';

/** IndexedDB-alapú tartós tároló (böngésző, iPhone Safari, PWA). */
export class IndexedDBStorage implements StorageBackend {
  private db: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    if (!this.db) {
      this.db = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this.db;
  }

  private async run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async get(key: string) { return (await this.run<string | undefined>('readonly', s => s.get(key))) ?? null; }
  async set(key: string, value: string) { await this.run('readwrite', s => s.put(value, key)); }
  async remove(key: string) { await this.run('readwrite', s => s.delete(key)); }
  async keys() { return (await this.run('readonly', s => s.getAllKeys())).map(String); }
}
