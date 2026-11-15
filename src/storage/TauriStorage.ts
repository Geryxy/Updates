import { native } from '../platform/Platform';
import type { StorageBackend } from './IndexedDBStorage';

/** Windows: a mentések JSON-fájlként az alkalmazás helyi adatmappájába kerülnek (Rust-parancsokon át). */
export class TauriStorage implements StorageBackend {
  get(key: string) { return native<string | null>('save_read', { slot: key }); }
  async set(key: string, value: string) { await native('save_write', { slot: key, data: value }); }
  async remove(key: string) { await native('save_delete', { slot: key }); }
  keys() { return native<string[]>('save_list'); }
}
