import type { Resources, Terrain } from '../game/GameState';

export interface TerrainDef {
  moveCost: number;
  defense: number;
  yield: Partial<Resources>;
}

export const TERRAIN: Record<Terrain, TerrainDef> = {
  plains: { moveCost: 1, defense: 0, yield: { food: 2 } },
  forest: { moveCost: 2, defense: 0.25, yield: { wood: 2 } },
  hills: { moveCost: 2, defense: 0.2, yield: { stone: 1, food: 1 } },
  mountain: { moveCost: 3, defense: 0.4, yield: { stone: 1, iron: 1 } },
  swamp: { moveCost: 2, defense: 0.1, yield: { food: 1 } },
};

export const TERRAINS = Object.keys(TERRAIN) as Terrain[];
/** Nyersanyag-lelőhely többlethozama körönként. */
export const DEPOSIT_BONUS = 3;
