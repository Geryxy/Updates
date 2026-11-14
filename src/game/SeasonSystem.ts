import type { Season } from './GameState';

export const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];
export const TURNS_PER_SEASON = 4;
export const seasonOf = (turn: number): Season => SEASONS[Math.floor((turn - 1) / TURNS_PER_SEASON) % 4];
export const yearOf = (turn: number) => Math.floor((turn - 1) / (TURNS_PER_SEASON * 4)) + 1;

export interface SeasonFx {
  /** Élelemtermelés szorzója. */
  food: number;
  /** Hadsereg-fenntartás szorzója. */
  upkeep: number;
  /** Támadóerő szorzója. */
  attack: number;
  /** Ellátásvesztés szorzója a hálózaton kívül. */
  supplyDecay: number;
  mountainExtra: number;
  riverExtra: number;
  happiness: number;
}

export const SEASON_FX: Record<Season, SeasonFx> = {
  spring: { food: 1, upkeep: 1, attack: 1, supplyDecay: 1, mountainExtra: 0, riverExtra: 1, happiness: 0 },
  summer: { food: 1.1, upkeep: 1, attack: 1.05, supplyDecay: 0.8, mountainExtra: 0, riverExtra: 0, happiness: 2 },
  autumn: { food: 1.35, upkeep: 1, attack: 1, supplyDecay: 1, mountainExtra: 0, riverExtra: 0, happiness: 0 },
  winter: { food: 0.5, upkeep: 1.4, attack: 0.9, supplyDecay: 1.7, mountainExtra: 1, riverExtra: 0, happiness: -4 },
};
export const seasonFx = (turn: number) => SEASON_FX[seasonOf(turn)];
