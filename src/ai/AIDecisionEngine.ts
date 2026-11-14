import { BUILDINGS, BUILDING_IDS, FOUND_CITY_COST } from '../data/buildings';
import { UNITS } from '../data/units';
import {
  canBuild, canFoundCity, canRecruit, canUpgrade, popCapOf, slotsOf, unitCost, MAX_TRAINING,
} from '../game/CitySystem';
import { previewBattle } from '../game/CombatSystem';
import { dominance, militaryPower, others, sharesBorder } from '../game/DiplomacySystem';
import { Income, canAfford } from '../game/EconomySystem';
import {
  Army, BuildingId, City, FactionId, GameState, UnitType, armiesOf, armyAt, armyMen, atWar, cityAt, citiesOf, getPair,
} from '../game/GameState';
import { enterCost, borderOpen, maxMoves } from '../game/MovementSystem';
import { seasonOf } from '../game/SeasonSystem';
import { supplyDistance, supplyRange } from '../game/SupplySystem';
import { hexDistance, neighbors } from '../world/HexMap';
import { dijkstra } from '../world/Pathfinding';
import { DifficultyProfile, PersonalityProfile } from './AIPersonality';

export interface Assessment {
  fid: FactionId;
  income: Income;
  power: number;
  enemies: FactionId[];
  /** Városonként a közelben lévő ellenséges haderő (harci érték). */
  threat: Map<string, number>;
  squads: number;
}

const armyValue = (a: Army) => a.squads.reduce((n, q) => n + (q.count / 100) * (UNITS[q.type].attack + UNITS[q.type].defense) / 2, 0);

export function assess(s: GameState, fid: FactionId, income: Income): Assessment {
  const enemies = others(s, fid).filter(o => getPair(s, fid, o).war);
  const threat = new Map<string, number>();
  for (const c of citiesOf(s, fid)) {
    let v = 0;
    for (const a of s.armies) {
      if (a.owner === fid || a.owner === 'neutral' || !atWar(s, fid, a.owner)) continue;
      if (hexDistance(a.tile, c.tile, s.width) <= 3) v += armyValue(a);
    }
    threat.set(c.id, v);
  }
  const squads = armiesOf(s, fid).reduce((n, a) => n + a.squads.length, 0) + citiesOf(s, fid).reduce((n, c) => n + c.training.length, 0);
  return { fid, income, power: militaryPower(s, fid), enemies, threat, squads };
}

export type BuildChoice = { kind: 'building'; id: BuildingId } | { kind: 'upgrade' } | null;

/** Épületválasztás pontozással: a szűkös erőforrások és a fenyegetettség szerint. */
export function chooseBuild(s: GameState, c: City, as: Assessment, prof: PersonalityProfile, diff: DifficultyProfile, roll: () => number): BuildChoice {
  const f = s.factions[as.fid];
  const net = as.income.net;
  const threatened = (as.threat.get(c.id) ?? 0) > 0;
  const winterSoon = seasonOf(s.turn) === 'autumn' || seasonOf(s.turn) === 'summer';
  const owned = (id: BuildingId) => citiesOf(s, as.fid).some(x => x.buildings.includes(id) || (x.build?.kind === 'building' && x.build.id === id));
  const need: Record<BuildingId, number> = {
    farm: net.food < 4 ? 95 : net.food < 10 ? 55 + (winterSoon ? 15 : 0) : 15,
    lumber: net.wood < 6 ? 70 : f.res.wood < 60 ? 45 : 18,
    quarry: net.stone < 4 ? 50 : 15,
    mine: net.iron < 3 ? 45 : 12,
    market: net.gold < 12 ? 60 : 25,
    barracks: owned('barracks') ? 20 : 65,
    archery: owned('archery') ? 12 : 40,
    stable: owned('stable') ? 8 : 32,
    smith: owned('smith') ? 5 : 28,
    wall: threatened ? 75 : c.capitalOf ? 30 : 12,
    tower: threatened ? 25 : 8,
    library: owned('library') ? 18 : 42,
    academy: 24,
    archive: 16,
  };
  const options: { choice: BuildChoice; score: number; affordable: boolean }[] = [];
  for (const id of BUILDING_IDS) {
    const chk = canBuild(s, c, id);
    const def = BUILDINGS[id];
    const structurallyOk = !c.buildings.includes(id) && c.level >= def.minLevel && (!def.requires || c.buildings.includes(def.requires)) && c.buildings.length < slotsOf(s, c);
    if (!structurallyOk) continue;
    options.push({ choice: { kind: 'building', id }, score: need[id] + (prof.buildBias[id] ?? 0), affordable: chk.ok });
  }
  const up = canUpgrade(s, c);
  if (c.level < 5 && c.pop >= popCapOf(c) * 0.6) {
    const full = c.buildings.length >= slotsOf(s, c) || c.pop >= popCapOf(c) * 0.9;
    options.push({ choice: { kind: 'upgrade' }, score: full ? 80 : 38, affordable: up.ok });
  }
  if (!options.length) return null;
  options.sort((a, b) => b.score - a.score);
  const affordable = options.filter(o => o.affordable);
  if (!affordable.length) return null;
  if (roll() < diff.sloppyBuild) return affordable[Math.floor(roll() * affordable.length)].choice;
  // A körültekintő AI kivár, ha a legfontosabb fejlesztésre még gyűjtenie kell.
  if (diff.sloppyBuild === 0 && !options[0].affordable && options[0].score >= affordable[0].score + 30) return null;
  return affordable[0].choice;
}

/** Kívánt hadseregméret (osztagokban) a kör, a személyiség és a hadiállapot alapján. */
export function desiredSquads(s: GameState, as: Assessment, prof: PersonalityProfile): number {
  const base = 4 + (s.turn / 3.5) * prof.army;
  const war = as.enemies.length ? 1.4 : 1;
  const threat = [...as.threat.values()].some(v => v > 0) ? 2 : 0;
  return Math.min(6 * (citiesOf(s, as.fid).length + 2), Math.round(base * war) + threat);
}

/** A kiképzendő egységtípus kiválasztása a kívánt összetételtől való eltérés alapján. */
export function chooseUnit(s: GameState, c: City, as: Assessment): UnitType | null {
  const f = s.factions[as.fid];
  const counts: Record<string, number> = {};
  let total = 0;
  for (const a of armiesOf(s, as.fid)) for (const q of a.squads) { counts[q.type] = (counts[q.type] ?? 0) + 1; total++; }
  const ideal: [UnitType, number][] = [['spear', 0.32], ['archer', 0.26], ['cavalry', 0.2], ['militia', 0.14], ['siege', as.enemies.length ? 0.08 : 0]];
  let best: UnitType | null = null, bestGap = -Infinity;
  for (const [type, share] of ideal) {
    if (!canRecruit(s, c, type).ok) continue;
    const up = UNITS[type].upkeep;
    if (as.income.net.food - up.food < 1 && f.res.food < 80) continue;
    if (as.income.net.gold - up.gold < -2 && f.res.gold < 150) continue;
    const gap = share - (counts[type] ?? 0) / Math.max(1, total);
    if (gap > bestGap) { bestGap = gap; best = type; }
  }
  return best;
}

export const recruitCapacity = (c: City) => MAX_TRAINING - c.training.length;
export const canPayUnit = (s: GameState, fid: FactionId, u: UnitType) => canAfford(s.factions[fid].res, unitCost(s, fid, u));

export interface ArmyTarget { tile: number; score: number; kind: 'attack' | 'capture' | 'defend' | 'merge' | 'retreat' }

/**
 * Egy hadsereg lehetséges célpontjainak értékelése: érték / (1 + elérési körök).
 * A támadások értékét a harcrendszer előzetes becslése adja.
 */
export function chooseArmyTarget(
  s: GameState, a: Army, as: Assessment, prof: PersonalityProfile, diff: DifficultyProfile,
  taken: Set<number>, net: number[], roll: () => number,
): ArmyTarget | null {
  const fid = as.fid;
  const mm = maxMoves(s, a);
  const res = dijkstra(a.tile, s.tiles.length, s.width, s.height, (_f, to) => {
    if (!borderOpen(s, a, to)) return Infinity;
    return enterCost(s, a, to);
  }, mm * 4);
  const men = armyMen(a);
  const weak = a.morale < 35 || a.supply < 30 || men < a.squads.length * 35;
  const here = cityAt(s, a.tile);
  const hereThreat = here && here.owner === fid ? as.threat.get(here.id) ?? 0 : 0;
  let best = null as ArmyTarget | null;
  const consider = (tile: number, value: number, kind: ArmyTarget['kind']) => {
    const d = tile === a.tile ? 0 : res.dist[tile];
    if (!isFinite(d)) return;
    const score = value / (1 + Math.ceil(d / mm));
    if (!best || score > best.score) best = { tile, score, kind };
  };

  // Védekezés: fenyegetett városban a helyőrség marad.
  if (hereThreat > 0) consider(a.tile, 60 + hereThreat * 4 + (here!.capitalOf ? 30 : 0), 'defend');
  if (weak) {
    for (const c of citiesOf(s, fid)) {
      const occ = armyAt(s, c.tile);
      if (!occ || occ.id === a.id) consider(c.tile, 120, 'retreat');
    }
    if (best) return best;
  }

  for (let i = 0; i < s.tiles.length; i++) {
    if (i === a.tile || !isFinite(res.dist[i])) continue;
    const tile = s.tiles[i];
    const other = armyAt(s, i);
    const city = cityAt(s, i);
    if (other && other.owner === fid) {
      // Összevonás: gyenge seregek egyesítése az összehangoltan játszó AI-nál.
      if (diff.coordinate && other.squads.length + a.squads.length <= 6 && a.squads.length <= 3 && other.squads.length >= a.squads.length && !taken.has(i))
        consider(i, as.enemies.length ? 34 : 16, 'merge');
      continue;
    }
    const hostileArmy = other && atWar(s, fid, other.owner);
    const hostileCity = city && city.owner !== fid && atWar(s, fid, city.owner);
    if (other && !hostileArmy) continue;
    if (hostileArmy || hostileCity) {
      const pv = previewBattle(s, a, i);
      if (!pv) continue;
      const estimate = pv.winChance + (roll() - 0.5) * 2 * diff.noise;
      if (estimate < diff.minWin) continue;
      let value = 45 + armyMen(pv.defenderArmy) / 12;
      if (city) value += (city.owner === 'neutral' ? 70 : 90) + city.level * 30 + (city.capitalOf ? 70 : 0);
      if (tile.ruin) value += 50;
      // Fenyegetés elhárítása: a saját város közelében álló ellenség kiemelt célpont.
      if (other && citiesOf(s, fid).some(c => hexDistance(c.tile, i, s.width) <= 2)) value += 40;
      if (taken.has(i) && !diff.coordinate) value *= 0.5;
      consider(i, value * pv.winChance, 'attack');
      continue;
    }
    if (city) {
      // Saját, őrizetlen és fenyegetett város megerősítése.
      if (city.owner === fid && (as.threat.get(city.id) ?? 0) > 0 && !taken.has(i)) consider(i, 70 + (city.capitalOf ? 40 : 0), 'defend');
      continue;
    }
    if (taken.has(i)) continue;
    if (tile.owner === fid) continue;
    if (tile.owner !== null && !atWar(s, fid, tile.owner)) continue;
    let value = (10 + (tile.resource ? 14 : 0) + (tile.ruin ? 32 : 0)) * prof.expand;
    if (tile.owner !== null) value += 10;
    if (neighbors(i, s.width, s.height).some(n => s.tiles[n].owner === fid)) value += 5;
    // Az ellátási vonaltól túl messzire nem merészkedik.
    if (supplyDistance(s, net, i) > supplyRange(s, fid)) value *= 0.35;
    if (seasonOf(s.turn) === 'winter' && tile.terrain === 'mountain') value *= 0.5;
    consider(i, value, 'capture');
  }
  return best;
}

/** Érdemes-e várost alapítani a hadsereg jelenlegi helyén? */
export function shouldFoundCity(s: GameState, a: Army, as: Assessment, prof: PersonalityProfile): boolean {
  if (citiesOf(s, as.fid).length >= prof.maxCities || as.enemies.length) return false;
  if (!canFoundCity(s, a).ok) return false;
  const res = s.factions[as.fid].res;
  if (!canAfford(res, { wood: FOUND_CITY_COST.wood! + 40, gold: FOUND_CITY_COST.gold! + 60, food: FOUND_CITY_COST.food! + 40, stone: FOUND_CITY_COST.stone! })) return false;
  return s.cities.every(c => hexDistance(c.tile, a.tile, s.width) >= 3);
}

export interface WarCandidate { target: FactionId; score: number }

/** Hadüzenet mérlegelése: erőviszony, kapcsolat, határ és a vezető frakció megfékezése. */
export function evaluateWar(s: GameState, as: Assessment, prof: PersonalityProfile, diff: DifficultyProfile): WarCandidate | null {
  if (s.turn < diff.warFromTurn || as.power < 14) return null;
  if (as.enemies.length >= (prof.aggression > 10 ? 2 : 1)) return null;
  let best = null as WarCandidate | null;
  for (const o of others(s, as.fid)) {
    const p = getPair(s, as.fid, o);
    if (p.war || p.alliance || p.nap > 0 || p.truce > 0) continue;
    if (!sharesBorder(s, as.fid, o) && dominance(s, o) < 0.4) continue;
    const their = militaryPower(s, o) + 1;
    let score = (as.power / their - 1) * 40 - p.rel * 0.5 + prof.aggression;
    if (dominance(s, o) > 0.35) score += 25;
    if (diff.coordinate && others(s, o).some(x => x !== as.fid && getPair(s, o, x).war)) score += 15;
    if (p.trade) score -= 12;
    if (!best || score > best.score) best = { target: o, score };
  }
  return best && best.score > 35 ? best : null;
}
