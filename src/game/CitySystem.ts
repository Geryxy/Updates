import { BUILDINGS, CITY_LEVELS, FOUND_CITY_COST } from '../data/buildings';
import { FACTIONS, mods } from '../data/factions';
import { UNITS } from '../data/units';
import { hexDistance, neighbors, tilesWithin } from '../world/HexMap';
import {
  Army, BuildingId, City, FactionId, GameState, MAX_SQUADS, OwnerId, Resources, UnitType, addLog, armyAt, atWar,
  citiesOf, clamp, hasTech, newId, cityAt, FACTION_IDS, getPair,
} from './GameState';
import { canAfford, pay, refund, scaleCost } from './EconomySystem';
import { seasonFx } from './SeasonSystem';
import { t } from '../i18n';

export interface Check { ok: boolean; reason?: string }
const no = (key: string, p?: Record<string, string | number>): Check => ({ ok: false, reason: t(key, p) });
const YES: Check = { ok: true };

export const slotsOf = (s: GameState, c: City) => CITY_LEVELS[c.level - 1].slots + (hasTech(s, c.owner, 'urban') ? 2 : 0);
export const popCapOf = (c: City) => CITY_LEVELS[c.level - 1].popCap;

export function buildingCost(s: GameState, c: City, id: BuildingId): Partial<Resources> {
  let m = 1;
  if (c.owner !== 'neutral' && mods(c.owner).cheapBuildings.includes(id)) m *= 0.7;
  if (id === 'wall' && hasTech(s, c.owner, 'stonework')) m *= 0.75;
  return scaleCost(BUILDINGS[id].cost, m);
}
export const buildTurns = (s: GameState, c: City, id: BuildingId) =>
  Math.max(1, BUILDINGS[id].turns - (hasTech(s, c.owner, 'urban') ? 1 : 0));

export function canBuild(s: GameState, c: City, id: BuildingId): Check {
  if (c.owner === 'neutral') return no('err.notYours');
  const def = BUILDINGS[id];
  if (c.buildings.includes(id)) return no('err.alreadyBuilt');
  if (c.build) return no('err.queueBusy');
  if (c.level < def.minLevel) return no('err.needLevel', { level: t(`city.level.${def.minLevel}`) });
  if (def.requires && !c.buildings.includes(def.requires)) return no('err.needBuilding', { name: t(`bld.${def.requires}`) });
  if (c.buildings.length >= slotsOf(s, c)) return no('err.noSlots');
  if (!canAfford(s.factions[c.owner].res, buildingCost(s, c, id))) return no('err.noResources');
  return YES;
}

export function startBuild(s: GameState, c: City, id: BuildingId): Check {
  const chk = canBuild(s, c, id);
  if (!chk.ok) return chk;
  pay(s.factions[c.owner as FactionId].res, buildingCost(s, c, id));
  const turns = buildTurns(s, c, id);
  c.build = { kind: 'building', id, turns, total: turns };
  return YES;
}

export function upgradeCost(s: GameState, c: City): Partial<Resources> | null {
  const base = CITY_LEVELS[c.level - 1].upgrade;
  return base ? scaleCost(base, hasTech(s, c.owner, 'admin') ? 0.8 : 1) : null;
}

export function canUpgrade(s: GameState, c: City): Check {
  if (c.owner === 'neutral') return no('err.notYours');
  const cost = upgradeCost(s, c);
  if (!cost) return no('err.maxLevel');
  if (c.build) return no('err.queueBusy');
  if (c.pop < popCapOf(c) * 0.6) return no('err.needPop', { pop: Math.ceil(popCapOf(c) * 0.6) * 100 });
  if (!canAfford(s.factions[c.owner].res, cost)) return no('err.noResources');
  return YES;
}

export function startUpgrade(s: GameState, c: City): Check {
  const chk = canUpgrade(s, c);
  if (!chk.ok) return chk;
  pay(s.factions[c.owner as FactionId].res, upgradeCost(s, c)!);
  const turns = CITY_LEVELS[c.level - 1].turns;
  c.build = { kind: 'upgrade', turns, total: turns };
  return YES;
}

/** Folyamatban lévő építkezés visszavonása teljes visszatérítéssel. */
export function cancelBuild(s: GameState, c: City) {
  if (!c.build || c.owner === 'neutral') return;
  const cost = c.build.kind === 'building' ? buildingCost(s, c, c.build.id) : upgradeCost(s, c)!;
  refund(s.factions[c.owner].res, cost);
  c.build = null;
}

export function unitCost(s: GameState, fid: OwnerId, unit: UnitType): Partial<Resources> {
  let m = mods(fid).unitCost[unit] ?? 1;
  if (unit === 'siege' && hasTech(s, fid, 'siegecraft')) m *= 0.8;
  return scaleCost(UNITS[unit].cost, m);
}

export const MAX_TRAINING = 3;
export function canRecruit(s: GameState, c: City, unit: UnitType): Check {
  if (c.owner === 'neutral') return no('err.notYours');
  const def = UNITS[unit];
  if (def.requires && !c.buildings.includes(def.requires)) return no('err.needBuilding', { name: t(`bld.${def.requires}`) });
  if (c.training.length >= MAX_TRAINING) return no('err.trainingFull');
  if (c.pop < 3) return no('err.lowPop');
  if (!canAfford(s.factions[c.owner].res, unitCost(s, c.owner, unit))) return no('err.noResources');
  return YES;
}

export function recruit(s: GameState, c: City, unit: UnitType): Check {
  const chk = canRecruit(s, c, unit);
  if (!chk.ok) return chk;
  pay(s.factions[c.owner as FactionId].res, unitCost(s, c.owner, unit));
  c.pop -= 1;
  c.training.push({ unit, turns: UNITS[unit].trainTurns });
  return YES;
}

export function createArmy(s: GameState, owner: OwnerId, tile: number, squads: { type: UnitType; count: number }[], name?: string): Army {
  let armyName = name;
  if (!armyName) {
    if (owner === 'neutral') armyName = t('army.neutral');
    else armyName = t('army.name', { n: ++s.factions[owner].ai.armySeq });
  }
  const army: Army = { id: newId(s, 'a'), owner, name: armyName, tile, squads, morale: 80, supply: 100, moves: 0, xp: 0, goto: null };
  s.armies.push(army);
  return army;
}

function deployTrained(s: GameState, c: City): void {
  while (c.training.length && c.training[0].turns <= 0) {
    const unit = c.training[0].unit;
    const army = armyAt(s, c.tile);
    if (!army) createArmy(s, c.owner, c.tile, [{ type: unit, count: 100 }]);
    else if (army.owner === c.owner && army.squads.length < MAX_SQUADS) army.squads.push({ type: unit, count: 100 });
    else return; // nincs hely: az osztag a városban várakozik
    c.training.shift();
  }
}

/** Erődítési bónusz a város védőinek (a harcrendszer használja). */
export function cityFort(c: City): number {
  let fort = 0.08 * c.level;
  if (c.buildings.includes('wall')) fort += 0.5 * mods(c.owner).wallMult;
  if (c.buildings.includes('tower')) fort += 0.1;
  return fort;
}

export function happinessTarget(s: GameState, c: City): number {
  let target = 60 + c.happyMod + seasonFx(s.turn).happiness;
  if (hasTech(s, c.owner, 'admin')) target += 8;
  const garrison = armyAt(s, c.tile);
  if (garrison && garrison.owner === c.owner) target += 5;
  if (c.buildings.includes('wall')) target += 3;
  if (c.buildings.includes('market')) target += 3;
  if (c.pop > popCapOf(c) * 0.95) target -= 6;
  if (c.owner !== 'neutral') {
    const owner = c.owner;
    const wars = FACTION_IDS.filter(o => o !== owner && s.factions[o].alive && getPair(s, owner, o).war).length;
    target -= wars * 4;
  }
  return clamp(target, 0, 100);
}

/** Egy város kör végi feldolgozása: építkezés, kiképzés, népesség, elégedettség. */
export function processCity(s: GameState, c: City) {
  if (c.owner === 'neutral') return;
  const f = s.factions[c.owner];
  if (c.build) {
    c.build.turns -= 1;
    if (c.build.turns <= 0) {
      if (c.build.kind === 'building') {
        c.buildings.push(c.build.id);
        if (f.isPlayer) addLog(s, t('log.built', { city: c.name, name: t(`bld.${c.build.id}`) }), 'good');
      } else {
        c.level += 1;
        if (f.isPlayer) addLog(s, t('log.upgraded', { city: c.name, level: t(`city.level.${c.level}`) }), 'good');
      }
      c.build = null;
    }
  }
  if (c.training.length) {
    if (c.training[0].turns > 0) c.training[0].turns -= 1;
    deployTrained(s, c);
  }
  if (c.happyMod > 0) c.happyMod -= 1; else if (c.happyMod < 0) c.happyMod += 1;
  const target = happinessTarget(s, c);
  c.happiness += clamp(target - c.happiness, -6, 6);
  const cap = popCapOf(c);
  if (c.pop < cap && f.res.food > 0 && c.happiness >= 35) {
    const growthMod = f.modifiers.reduce((v, mo) => v * (mo.growthMult ?? 1), 1);
    c.pop = Math.min(cap, c.pop + 0.4 * mods(c.owner).growthMult * growthMod * (c.happiness / 60));
  } else if (c.pop > cap) c.pop = cap;
}

export function canFoundCity(s: GameState, army: Army): Check {
  if (army.owner === 'neutral') return no('err.notYours');
  const tile = s.tiles[army.tile];
  if (tile.owner !== army.owner) return no('err.foundOwn');
  if (tile.cityId) return no('err.foundCity');
  if (tile.terrain === 'mountain' || tile.terrain === 'swamp') return no('err.foundTerrain');
  if (s.cities.some(c => hexDistance(c.tile, army.tile) < 3)) return no('err.foundNear');
  if (!canAfford(s.factions[army.owner].res, FOUND_CITY_COST)) return no('err.noResources');
  return YES;
}

export function nextCityName(s: GameState, fid: FactionId): string {
  const used = new Set(s.cities.map(c => c.name));
  return FACTIONS[fid].cities.find(n => !used.has(n)) ?? t('city.newName', { n: s.cities.length + 1 });
}

export function foundCity(s: GameState, army: Army): Check {
  const chk = canFoundCity(s, army);
  if (!chk.ok) return chk;
  const fid = army.owner as FactionId;
  pay(s.factions[fid].res, FOUND_CITY_COST);
  const city: City = {
    id: newId(s, 'c'), name: nextCityName(s, fid), owner: fid, tile: army.tile, level: 1, pop: 4, happiness: 65,
    happyMod: 0, buildings: [], build: null, training: [], capitalOf: null,
  };
  s.cities.push(city);
  s.tiles[army.tile].cityId = city.id;
  for (const n of neighbors(army.tile, s.width, s.height)) if (s.tiles[n].owner === null) s.tiles[n].owner = fid;
  addLog(s, t('log.founded', { faction: t(`faction.${fid}`), city: city.name }), fid === s.playerId ? 'good' : 'info');
  return YES;
}

/** Város elfoglalása: a környező, védtelen mezők is gazdát cserélnek. */
export function captureCity(s: GameState, c: City, newOwner: FactionId) {
  const old = c.owner;
  c.owner = newOwner;
  c.build = null;
  c.training = [];
  c.pop = Math.max(2, c.pop * 0.85);
  c.happiness = Math.min(c.happiness, 45);
  c.happyMod = -15;
  s.tiles[c.tile].owner = newOwner;
  for (const n of tilesWithin(c.tile, 1, s.width)) {
    const tile = s.tiles[n];
    const other = armyAt(s, n);
    if (other && other.owner !== newOwner) continue;
    if (tile.owner === null || tile.owner === old || (tile.owner !== newOwner && atWar(s, newOwner, tile.owner) && !cityAt(s, n))) {
      if (!tile.cityId || n === c.tile) tile.owner = newOwner;
    }
  }
  s.factions[newOwner].stats.citiesCaptured += 1;
  const kind = newOwner === s.playerId ? 'good' : old === s.playerId ? 'bad' : 'war';
  addLog(s, t(c.capitalOf && c.capitalOf !== newOwner ? 'log.capitalTaken' : 'log.cityTaken',
    { faction: t(`faction.${newOwner}`), city: c.name }), kind);
}

/** A városok lassan kiterjesztik határaikat a szomszédos gazdátlan földekre. */
export function growBorders(s: GameState) {
  if (s.turn % 2 !== 0) return;
  for (const c of s.cities) {
    if (c.owner === 'neutral') continue;
    const radius = c.level >= 3 ? 2 : 1;
    const options = tilesWithin(c.tile, radius + 1, s.width).filter(i =>
      s.tiles[i].owner === null && !s.tiles[i].cityId && !armyAt(s, i) &&
      neighbors(i, s.width, s.height).some(n => s.tiles[n].owner === c.owner));
    if (!options.length) continue;
    options.sort((a, b) => hexDistance(a, c.tile) - hexDistance(b, c.tile) || a - b);
    s.tiles[options[0]].owner = c.owner;
  }
}

/** Elégedetlen városokban lázadás törhet ki. */
export function checkRebellions(s: GameState, roll: () => number) {
  for (const c of [...s.cities]) {
    if (c.owner === 'neutral' || c.happiness >= 25 || roll() > 0.3) continue;
    const owner = c.owner;
    const garrison = armyAt(s, c.tile);
    const isPlayer = owner === s.playerId;
    if (garrison && garrison.owner === owner) {
      for (const q of garrison.squads) q.count = Math.max(5, Math.round(q.count * 0.85));
      c.pop = Math.max(2, c.pop * 0.9);
      c.happyMod += 12;
      if (isPlayer) addLog(s, t('log.revoltCrushed', { city: c.name }), 'bad');
    } else if (!c.capitalOf && citiesOf(s, owner).length > 1 && !garrison) {
      c.owner = 'neutral';
      c.build = null; c.training = [];
      c.happiness = 50; c.happyMod = 0;
      s.tiles[c.tile].owner = null;
      createArmy(s, 'neutral', c.tile, [{ type: 'militia', count: 100 }, { type: 'militia', count: 60 }], t('army.rebels'));
      addLog(s, t('log.revoltLost', { city: c.name, faction: t(`faction.${owner}`) }), isPlayer ? 'bad' : 'info');
    } else {
      c.pop = Math.max(2, c.pop * 0.85);
      c.happyMod += 10;
      if (isPlayer) addLog(s, t('log.revoltDamage', { city: c.name }), 'bad');
    }
  }
}
