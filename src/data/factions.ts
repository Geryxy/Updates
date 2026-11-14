import type { BuildingId, FactionId, Personality, UnitType } from '../game/GameState';

export interface FactionMods {
  marketMult: number;
  tradeMult: number;
  tradeAccept: number;
  goldFlat: number;
  cheapBuildings: BuildingId[];
  upkeepGoldMult: number;
  farmMult: number;
  forestMove: number | null;
  unitCost: Partial<Record<UnitType, number>>;
  growthMult: number;
  wallMult: number;
  defenseMult: number;
  mineMult: number;
  taxMult: number;
  scoutMove: number;
  vision: number;
  cavalryMove: number;
  milTechMult: number;
}

const BASE: FactionMods = {
  marketMult: 1, tradeMult: 1, tradeAccept: 0, goldFlat: 0, cheapBuildings: [], upkeepGoldMult: 1,
  farmMult: 1, forestMove: null, unitCost: {}, growthMult: 1, wallMult: 1, defenseMult: 1, mineMult: 1,
  taxMult: 1, scoutMove: 0, vision: 0, cavalryMove: 0, milTechMult: 1,
};

export interface FactionDef {
  id: FactionId;
  color: number;
  css: string;
  dark: string;
  personality: Personality;
  mods: FactionMods;
  capital: string;
  cities: string[];
}

export const FACTIONS: Record<FactionId, FactionDef> = {
  szikra: {
    id: 'szikra', color: 0xe8b23a, css: '#e8b23a', dark: '#6b4a0c', personality: 'trader',
    mods: { ...BASE, marketMult: 1.15, tradeMult: 1.5, tradeAccept: 10, goldFlat: 4, cheapBuildings: ['market', 'archive'], upkeepGoldMult: 1.3 },
    capital: 'Aranyrév', cities: ['Szikravár', 'Lámpásrév', 'Borostyánkő', 'Érchíd', 'Fényvásár', 'Tallérfok'],
  },
  moha: {
    id: 'moha', color: 0x58a84f, css: '#58a84f', dark: '#1f4a1c', personality: 'expander',
    mods: { ...BASE, farmMult: 1.2, forestMove: 1, unitCost: { scout: 0.6, siege: 1.4 }, growthMult: 1.3 },
    capital: 'Tölgyszív', cities: ['Mohaliget', 'Páfrányos', 'Gyökérvár', 'Zöldforrás', 'Harmatrét', 'Lombkapu'],
  },
  vaskapu: {
    id: 'vaskapu', color: 0xc2483f, css: '#c2483f', dark: '#571a16', personality: 'defender',
    mods: { ...BASE, wallMult: 1.5, defenseMult: 1.1, mineMult: 1.25, unitCost: { spear: 0.75 }, taxMult: 0.85, growthMult: 0.85 },
    capital: 'Vaskapu', cities: ['Kőbástya', 'Pajzsfok', 'Üllővár', 'Sziklaőr', 'Vértes', 'Koronaszirt'],
  },
  volgyek: {
    id: 'volgyek', color: 0x4f8fd8, css: '#4f8fd8', dark: '#173a66', personality: 'conqueror',
    mods: { ...BASE, scoutMove: 1, vision: 1, cavalryMove: 1, milTechMult: 0.75, taxMult: 0.85 },
    capital: 'Szélvölgy', cities: ['Sólyomrét', 'Vágtamező', 'Kéktisztás', 'Nyeregfő', 'Füveshát', 'Szabadrév'],
  },
};

export const NEUTRAL_COLOR = 0x9a9488;
export const NEUTRAL_CITIES = ['Hollókő', 'Ködfalva', 'Révhely', 'Ószeg', 'Csendesmalom', 'Borókás', 'Határkő'];
export const mods = (id: FactionId | 'neutral'): FactionMods => (id === 'neutral' ? BASE : FACTIONS[id].mods);
