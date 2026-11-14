import type { TechId } from '../game/GameState';

export interface TechDef {
  branch: 'economy' | 'military' | 'science';
  cost: number;
  requires: TechId[];
}

/** A hatásokat a rendszerek a hasTech() segítségével olvassák ki; a leírás a lokalizációs fájlban van. */
export const TECHS: Record<TechId, TechDef> = {
  agri: { branch: 'economy', cost: 20, requires: [] },
  logging: { branch: 'economy', cost: 20, requires: [] },
  stonework: { branch: 'economy', cost: 30, requires: ['logging'] },
  finance: { branch: 'economy', cost: 40, requires: ['agri'] },
  traderoutes: { branch: 'economy', cost: 55, requires: ['finance'] },
  weapons: { branch: 'military', cost: 25, requires: [] },
  armor: { branch: 'military', cost: 30, requires: ['weapons'] },
  drill: { branch: 'military', cost: 40, requires: ['weapons'] },
  siegecraft: { branch: 'military', cost: 50, requires: ['armor'] },
  logistics: { branch: 'military', cost: 55, requires: ['drill'] },
  cartography: { branch: 'science', cost: 20, requires: [] },
  protocol: { branch: 'science', cost: 30, requires: ['cartography'] },
  urban: { branch: 'science', cost: 40, requires: ['cartography'] },
  admin: { branch: 'science', cost: 55, requires: ['urban'] },
  scouting: { branch: 'science', cost: 45, requires: ['cartography'] },
};
export const TECH_IDS = Object.keys(TECHS) as TechId[];
