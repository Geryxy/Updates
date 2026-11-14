/**
 * Központi játékállapot-modell. Minden itt szereplő adat egyszerű JSON,
 * így a mentés és a betöltés veszteségmentes.
 */
export type FactionId = 'szikra' | 'moha' | 'vaskapu' | 'volgyek';
export type OwnerId = FactionId | 'neutral';
export type ResKey = 'food' | 'wood' | 'stone' | 'iron' | 'gold';
export type Resources = Record<ResKey, number>;
export type Terrain = 'plains' | 'forest' | 'hills' | 'mountain' | 'swamp';
export type UnitType = 'militia' | 'spear' | 'archer' | 'cavalry' | 'siege' | 'scout';
export type BuildingId =
  | 'farm' | 'lumber' | 'quarry' | 'mine' | 'market'
  | 'barracks' | 'stable' | 'archery' | 'smith' | 'wall' | 'tower'
  | 'library' | 'academy' | 'archive';
export type TechId =
  | 'agri' | 'logging' | 'stonework' | 'finance' | 'traderoutes'
  | 'weapons' | 'armor' | 'drill' | 'siegecraft' | 'logistics'
  | 'cartography' | 'protocol' | 'urban' | 'admin' | 'scouting';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type Personality = 'conqueror' | 'defender' | 'trader' | 'expander';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export const RES_KEYS: ResKey[] = ['food', 'wood', 'stone', 'iron', 'gold'];
export const FACTION_IDS: FactionId[] = ['szikra', 'moha', 'vaskapu', 'volgyek'];
export const MAX_SQUADS = 6;
export const SQUAD_SIZE = 100;
export const MAX_TURNS = 50;
export const SAVE_VERSION = 1;

export interface Tile {
  terrain: Terrain;
  owner: FactionId | null;
  river: boolean;
  road: boolean;
  resource: ResKey | null;
  ruin: boolean;
  cityId: string | null;
}

export type BuildOrder =
  | { kind: 'building'; id: BuildingId; turns: number; total: number }
  | { kind: 'upgrade'; turns: number; total: number };

export interface City {
  id: string;
  name: string;
  owner: OwnerId;
  tile: number;
  level: number;
  pop: number;
  happiness: number;
  /** Tartós (eseményekből származó) elégedettségmódosító, körönként 1-gyel cseng le. */
  happyMod: number;
  buildings: BuildingId[];
  build: BuildOrder | null;
  training: { unit: UnitType; turns: number }[];
  capitalOf: FactionId | null;
}

export interface Squad { type: UnitType; count: number }

export interface Army {
  id: string;
  owner: OwnerId;
  name: string;
  tile: number;
  squads: Squad[];
  morale: number;
  supply: number;
  moves: number;
  xp: number;
  goto: number | null;
}

export interface Modifier {
  id: string;
  turns: number;
  foodMult?: number;
  goldMult?: number;
  ironAdd?: number;
  upkeepMult?: number;
  growthMult?: number;
}

export interface FactionStats {
  battlesWon: number;
  battlesLost: number;
  tilesCaptured: number;
  citiesCaptured: number;
  treaties: number;
  goldEarned: number;
}

export interface FactionState {
  id: FactionId;
  isPlayer: boolean;
  alive: boolean;
  personality: Personality;
  res: Resources;
  techs: TechId[];
  research: { id: TechId; progress: number } | null;
  modifiers: Modifier[];
  /** Hány egymást követő körben teljesült a területi győzelem feltétele. */
  domTurns: number;
  stats: FactionStats;
  /** Az AI belső állapota (háborús fáradtság, legutóbbi ajánlatok köre). */
  ai: { weariness: number; lastOffer: Record<string, number>; armySeq: number };
}

export interface Pair {
  rel: number;
  war: boolean;
  trade: boolean;
  /** Meg nem támadási szerződés hátralévő körei. */
  nap: number;
  alliance: boolean;
  /** Békekötés utáni kötelező fegyverszünet körei. */
  truce: number;
}

export type ProposalKind = 'trade' | 'nap' | 'alliance' | 'peace' | 'jointwar';
export interface Proposal { from: FactionId; kind: ProposalKind; target?: FactionId }

export interface PowerPart { label: string; mult: number }
export interface BattleSide {
  owner: OwnerId;
  name: string;
  before: Squad[];
  after: Squad[];
  power: number;
  parts: PowerPart[];
  losses: number;
  fate: 'held' | 'advanced' | 'retreated' | 'destroyed' | 'repelled';
}
export interface BattleReport {
  turn: number;
  tile: number;
  attacker: BattleSide;
  defender: BattleSide;
  roll: number;
  winner: 'attacker' | 'defender';
  cityCaptured: string | null;
}

export interface LogEntry { turn: number; text: string; kind: 'info' | 'good' | 'bad' | 'war' | 'diplo' }

export interface Outcome {
  type: 'victory' | 'defeat' | 'score';
  reason: string;
  winner: FactionId | null;
  scores: { id: FactionId; total: number; parts: Record<string, number> }[];
}

export interface GameState {
  version: number;
  seed: number;
  rng: number;
  turn: number;
  difficulty: Difficulty;
  playerId: FactionId;
  width: number;
  height: number;
  tiles: Tile[];
  cities: City[];
  armies: Army[];
  factions: Record<FactionId, FactionState>;
  pairs: Record<string, Pair>;
  explored: boolean[];
  log: LogEntry[];
  pendingEvent: { id: string; target?: FactionId; other?: FactionId } | null;
  eventCooldown: number;
  seenEvents: string[];
  proposals: Proposal[];
  reports: BattleReport[];
  outcome: Outcome | null;
  nextId: number;
  tutorial: { step: number; flags: Record<string, boolean> } | null;
}

export const emptyRes = (): Resources => ({ food: 0, wood: 0, stone: 0, iron: 0, gold: 0 });

/** Determinisztikus, a játékállapotban tárolt véletlenszám-generátor (mulberry32). */
export function rand(state: { rng: number }): number {
  state.rng = (state.rng + 0x6d2b79f5) | 0;
  let t = state.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const randInt = (s: { rng: number }, n: number) => Math.floor(rand(s) * n);
export const pick = <T>(s: { rng: number }, arr: T[]): T => arr[randInt(s, arr.length)];

export const pairKey = (a: FactionId, b: FactionId) => (a < b ? `${a}|${b}` : `${b}|${a}`);
export const getPair = (s: GameState, a: FactionId, b: FactionId): Pair => s.pairs[pairKey(a, b)];

export function atWar(s: GameState, a: OwnerId, b: OwnerId | null): boolean {
  if (b === null || a === b) return false;
  if (a === 'neutral' || b === 'neutral') return true;
  return getPair(s, a, b).war;
}
export function allied(s: GameState, a: OwnerId, b: OwnerId | null): boolean {
  if (b === null || a === 'neutral' || b === 'neutral') return false;
  if (a === b) return true;
  return getPair(s, a, b).alliance;
}

export const armyAt = (s: GameState, tile: number): Army | undefined => s.armies.find(a => a.tile === tile);
export const cityAt = (s: GameState, tile: number): City | undefined => {
  const id = s.tiles[tile].cityId;
  return id ? s.cities.find(c => c.id === id) : undefined;
};
export const cityById = (s: GameState, id: string) => s.cities.find(c => c.id === id);
export const armyById = (s: GameState, id: string) => s.armies.find(a => a.id === id);
export const citiesOf = (s: GameState, f: OwnerId) => s.cities.filter(c => c.owner === f);
export const armiesOf = (s: GameState, f: OwnerId) => s.armies.filter(a => a.owner === f);
export const tilesOf = (s: GameState, f: FactionId) => s.tiles.reduce((n, t) => n + (t.owner === f ? 1 : 0), 0);
export const armyMen = (a: { squads: Squad[] }) => a.squads.reduce((n, q) => n + q.count, 0);
export const capitalOf = (s: GameState, f: FactionId) => s.cities.find(c => c.capitalOf === f);
export const newId = (s: GameState, prefix: string) => `${prefix}${s.nextId++}`;
export const hasTech = (s: GameState, f: OwnerId, t: TechId) => f !== 'neutral' && s.factions[f].techs.includes(t);
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function addLog(s: GameState, text: string, kind: LogEntry['kind'] = 'info') {
  s.log.push({ turn: s.turn, text, kind });
  if (s.log.length > 120) s.log.splice(0, s.log.length - 120);
}
