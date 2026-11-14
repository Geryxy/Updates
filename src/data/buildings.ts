import type { BuildingId, Resources } from '../game/GameState';

export interface BuildingDef {
  category: 'economy' | 'military' | 'science';
  cost: Partial<Resources>;
  turns: number;
  minLevel: number;
  requires?: BuildingId;
  yield?: Partial<Resources>;
  research?: number;
}

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  farm: { category: 'economy', cost: { wood: 30, gold: 20 }, turns: 2, minLevel: 1, yield: { food: 8 } },
  lumber: { category: 'economy', cost: { wood: 20, gold: 25 }, turns: 2, minLevel: 1, yield: { wood: 6 } },
  quarry: { category: 'economy', cost: { wood: 30, gold: 30 }, turns: 2, minLevel: 1, yield: { stone: 5 } },
  mine: { category: 'economy', cost: { wood: 40, stone: 20, gold: 40 }, turns: 3, minLevel: 1, yield: { iron: 4 } },
  market: { category: 'economy', cost: { wood: 40, stone: 20, gold: 50 }, turns: 3, minLevel: 2, yield: { gold: 10 } },
  barracks: { category: 'military', cost: { wood: 50, stone: 20, gold: 40 }, turns: 2, minLevel: 1 },
  archery: { category: 'military', cost: { wood: 60, gold: 40 }, turns: 2, minLevel: 1 },
  stable: { category: 'military', cost: { wood: 60, food: 30, gold: 60 }, turns: 3, minLevel: 2, requires: 'barracks' },
  smith: { category: 'military', cost: { wood: 40, stone: 40, iron: 20, gold: 60 }, turns: 3, minLevel: 3, requires: 'barracks' },
  wall: { category: 'military', cost: { stone: 80, wood: 20, gold: 40 }, turns: 3, minLevel: 2 },
  tower: { category: 'military', cost: { wood: 30, stone: 30, gold: 20 }, turns: 2, minLevel: 1 },
  library: { category: 'science', cost: { wood: 50, stone: 20, gold: 50 }, turns: 3, minLevel: 2, research: 3 },
  academy: { category: 'science', cost: { wood: 60, stone: 60, gold: 100 }, turns: 4, minLevel: 3, requires: 'library', research: 5 },
  archive: { category: 'science', cost: { wood: 40, stone: 60, gold: 120 }, turns: 4, minLevel: 4, requires: 'library' },
};

export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[];

/** Városszintek: fejlesztési költség a KÖVETKEZŐ szintre, népességkorlát, építési helyek. */
export const CITY_LEVELS = [
  { popCap: 10, slots: 3, upgrade: { wood: 60, stone: 20, gold: 60 } as Partial<Resources>, turns: 3 },
  { popCap: 20, slots: 5, upgrade: { wood: 90, stone: 60, gold: 120 } as Partial<Resources>, turns: 4 },
  { popCap: 34, slots: 7, upgrade: { wood: 130, stone: 110, iron: 20, gold: 200 } as Partial<Resources>, turns: 5 },
  { popCap: 52, slots: 9, upgrade: { wood: 180, stone: 170, iron: 50, gold: 320 } as Partial<Resources>, turns: 6 },
  { popCap: 75, slots: 11, upgrade: null, turns: 0 },
];
export const FOUND_CITY_COST: Partial<Resources> = { wood: 60, stone: 30, food: 40, gold: 80 };
