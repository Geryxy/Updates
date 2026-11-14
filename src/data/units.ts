import type { BuildingId, Resources, UnitType } from '../game/GameState';

export interface UnitDef {
  attack: number;
  defense: number;
  move: number;
  vision: number;
  cost: Partial<Resources>;
  upkeep: { food: number; gold: number };
  requires: BuildingId | null;
  trainTurns: number;
}

/** Az értékek egy teljes, 100 fős osztagra vonatkoznak. */
export const UNITS: Record<UnitType, UnitDef> = {
  militia: { attack: 4, defense: 5, move: 3, vision: 1, cost: { gold: 20, food: 10 }, upkeep: { food: 1.5, gold: 0.5 }, requires: null, trainTurns: 1 },
  spear: { attack: 6, defense: 9, move: 3, vision: 1, cost: { gold: 35, iron: 8, wood: 5 }, upkeep: { food: 1.5, gold: 1 }, requires: 'barracks', trainTurns: 1 },
  archer: { attack: 8, defense: 5, move: 3, vision: 2, cost: { gold: 40, wood: 15 }, upkeep: { food: 1.5, gold: 1 }, requires: 'archery', trainTurns: 1 },
  cavalry: { attack: 12, defense: 7, move: 5, vision: 2, cost: { gold: 70, iron: 12, food: 15 }, upkeep: { food: 3, gold: 2 }, requires: 'stable', trainTurns: 2 },
  siege: { attack: 5, defense: 3, move: 2, vision: 1, cost: { gold: 90, wood: 40, iron: 20 }, upkeep: { food: 2, gold: 3 }, requires: 'smith', trainTurns: 2 },
  scout: { attack: 2, defense: 2, move: 5, vision: 3, cost: { gold: 25, food: 5 }, upkeep: { food: 1, gold: 0.5 }, requires: null, trainTurns: 1 },
};

export const UNIT_TYPES = Object.keys(UNITS) as UnitType[];
