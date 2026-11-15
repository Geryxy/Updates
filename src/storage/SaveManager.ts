import { FACTION_IDS, GameState, SAVE_VERSION } from '../game/GameState';
import { isTauri } from '../platform/Platform';
import { IndexedDBStorage, StorageBackend } from './IndexedDBStorage';
import { TauriStorage } from './TauriStorage';

export const AUTO_SLOT = 'auto';
export const MANUAL_SLOTS = ['slot1', 'slot2', 'slot3'];
export const ALL_SLOTS = [AUTO_SLOT, ...MANUAL_SLOTS];

export interface SaveMeta { slot: string; turn: number; faction: string; difficulty: string; savedAt: number; tutorial: boolean }
interface SaveFile { app: 'kod-koronaja'; version: number; meta: SaveMeta; state: GameState }

/** A betöltött állapot alapvető szerkezeti ellenőrzése (sérült vagy idegen fájlok kiszűrése). */
export function validateState(s: unknown): s is GameState {
  const g = s as GameState;
  return !!g && typeof g === 'object' && g.version === SAVE_VERSION && Array.isArray(g.tiles) &&
    g.tiles.length === g.width * g.height && Array.isArray(g.cities) && Array.isArray(g.armies) &&
    typeof g.turn === 'number' && !!g.factions && FACTION_IDS.every(f => !!g.factions[f]) &&
    FACTION_IDS.includes(g.playerId) && !!g.pairs && Array.isArray(g.explored) && Array.isArray(g.log);
}

export function serialize(state: GameState, slot: string): string {
  const file: SaveFile = {
    app: 'kod-koronaja', version: SAVE_VERSION, state,
    meta: { slot, turn: state.turn, faction: state.playerId, difficulty: state.difficulty, savedAt: Date.now(), tutorial: !!state.tutorial },
  };
  return JSON.stringify(file);
}

export function deserialize(text: string): { meta: SaveMeta; state: GameState } | null {
  try {
    const file = JSON.parse(text) as SaveFile;
    if (file.app !== 'kod-koronaja' || !validateState(file.state)) return null;
    return { meta: file.meta, state: file.state };
  } catch {
    return null;
  }
}

export class SaveManager {
  constructor(private backend: StorageBackend = isTauri ? new TauriStorage() : new IndexedDBStorage()) {}

  async save(slot: string, state: GameState): Promise<boolean> {
    try { await this.backend.set(slot, serialize(state, slot)); return true; } catch { return false; }
  }

  async load(slot: string): Promise<GameState | null> {
    try {
      const text = await this.backend.get(slot);
      return text ? deserialize(text)?.state ?? null : null;
    } catch { return null; }
  }

  async list(): Promise<Record<string, SaveMeta | null>> {
    const out: Record<string, SaveMeta | null> = {};
    for (const slot of ALL_SLOTS) {
      try {
        const text = await this.backend.get(slot);
        out[slot] = text ? deserialize(text)?.meta ?? null : null;
      } catch { out[slot] = null; }
    }
    return out;
  }

  async remove(slot: string) { try { await this.backend.remove(slot); } catch { /* nincs teendő */ } }

  /** Mentés letöltése JSON-fájlként. */
  exportFile(state: GameState) {
    const blob = new Blob([serialize(state, 'export')], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kod-koronaja-${state.playerId}-kor${state.turn}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  /** JSON-fájl kiválasztása és beolvasása; érvénytelen fájl esetén null. */
  importFile(): Promise<GameState | null> {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.onchange = async () => {
        const file = input.files?.[0];
        resolve(file ? deserialize(await file.text())?.state ?? null : null);
      };
      input.addEventListener('cancel', () => resolve(null));
      input.click();
    });
  }
}
