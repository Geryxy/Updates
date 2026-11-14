import type { BuildingId, Difficulty, Personality, TechId } from '../game/GameState';

export interface PersonalityProfile {
  /** Mennyire törekszik nagy hadseregre (osztag/kör arány). */
  army: number;
  /** Hadüzenet-hajlandóság módosítója. */
  aggression: number;
  /** Semleges területek foglalásának súlya. */
  expand: number;
  /** Az épületek preferenciái (pontszám-többlet). */
  buildBias: Partial<Record<BuildingId, number>>;
  techOrder: TechId[];
  maxCities: number;
}

export const PROFILES: Record<Personality, PersonalityProfile> = {
  conqueror: {
    army: 1.3, aggression: 15, expand: 1.1, maxCities: 3,
    buildBias: { barracks: 25, stable: 20, archery: 10, smith: 15 },
    techOrder: ['weapons', 'agri', 'drill', 'armor', 'logistics', 'logging', 'siegecraft', 'cartography', 'finance', 'stonework', 'scouting', 'urban', 'protocol', 'traderoutes', 'admin'],
  },
  defender: {
    army: 1.05, aggression: -10, expand: 0.9, maxCities: 3,
    buildBias: { wall: 30, tower: 12, barracks: 15, archery: 15, quarry: 10, mine: 10 },
    techOrder: ['agri', 'weapons', 'armor', 'logging', 'stonework', 'drill', 'cartography', 'urban', 'finance', 'logistics', 'admin', 'siegecraft', 'protocol', 'scouting', 'traderoutes'],
  },
  trader: {
    army: 0.85, aggression: -20, expand: 0.9, maxCities: 3,
    buildBias: { market: 30, library: 15, archive: 15, academy: 10 },
    techOrder: ['agri', 'finance', 'cartography', 'logging', 'traderoutes', 'protocol', 'weapons', 'urban', 'armor', 'admin', 'stonework', 'drill', 'scouting', 'logistics', 'siegecraft'],
  },
  expander: {
    army: 1, aggression: 0, expand: 1.5, maxCities: 4,
    buildBias: { farm: 15, lumber: 10, barracks: 10, library: 5 },
    techOrder: ['agri', 'logging', 'cartography', 'weapons', 'urban', 'finance', 'armor', 'scouting', 'drill', 'stonework', 'admin', 'logistics', 'protocol', 'traderoutes', 'siegecraft'],
  },
};

export interface DifficultyProfile {
  /** A támadáshoz megkövetelt győzelmi esély. */
  minWin: number;
  /** A helyzetértékelés pontatlansága (0 = pontos becslés). */
  noise: number;
  /** Annak esélye, hogy egy hadsereg tétlen marad a körben. */
  idle: number;
  /** Annak esélye, hogy nem a legjobb, hanem egy véletlen megfizethető épületet választ. */
  sloppyBuild: number;
  /** Hadseregek egyesítése és összehangolt támadás. */
  coordinate: boolean;
  /** Legkorábbi kör, amikor hadat üzenhet. */
  warFromTurn: number;
  /** Egy hadsereg hány akciót hajthat végre körönként. */
  actions: number;
}

/** A nehezebb AI nem kap többlet-erőforrást: pontosabban mérlegel és hatékonyabban szervez. */
export const DIFFICULTY: Record<Difficulty, DifficultyProfile> = {
  easy: { minWin: 0.5, noise: 0.3, idle: 0.35, sloppyBuild: 0.45, coordinate: false, warFromTurn: 16, actions: 1 },
  normal: { minWin: 0.6, noise: 0.1, idle: 0.08, sloppyBuild: 0.12, coordinate: false, warFromTurn: 11, actions: 2 },
  hard: { minWin: 0.66, noise: 0, idle: 0, sloppyBuild: 0, coordinate: true, warFromTurn: 8, actions: 3 },
};
