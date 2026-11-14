import { BUILDINGS } from '../data/buildings';
import { mods } from '../data/factions';
import { UNITS } from '../data/units';
import { DEPOSIT_BONUS, TERRAIN } from '../world/TerrainTypes';
import {
  FactionId, GameState, RES_KEYS, ResKey, Resources, addLog, armiesOf, citiesOf, emptyRes, getPair, hasTech, FACTION_IDS,
} from './GameState';
import { seasonFx } from './SeasonSystem';
import { t } from '../i18n';

export interface IncomeLine { key: string; res: Partial<Resources> }
export interface Income { net: Resources; lines: IncomeLine[]; research: number }

const BASE_GOLD = 8;
const BASE_RESEARCH = 3;
const TAX_PER_POP = 0.7;
const FOOD_PER_POP = 0.8;
const TRADE_GOLD = 5;

export const canAfford = (res: Resources, cost: Partial<Resources>) =>
  RES_KEYS.every(k => res[k] >= (cost[k] ?? 0));

export function pay(res: Resources, cost: Partial<Resources>) {
  for (const k of RES_KEYS) res[k] -= cost[k] ?? 0;
}
export function refund(res: Resources, cost: Partial<Resources>) {
  for (const k of RES_KEYS) res[k] += cost[k] ?? 0;
}
export const scaleCost = (cost: Partial<Resources>, mult: number): Partial<Resources> => {
  const out: Partial<Resources> = {};
  for (const k of RES_KEYS) if (cost[k]) out[k] = Math.max(1, Math.round(cost[k]! * mult));
  return out;
};

const levelScale = (level: number) => 1 + 0.15 * (level - 1);

/**
 * A frakció körönkénti bevétele és kiadása tételesen. A HUD és a körváltás
 * ugyanezt a függvényt használja, így a kijelzett érték mindig a tényleges.
 */
export function computeIncome(s: GameState, fid: FactionId): Income {
  const f = s.factions[fid];
  const m = mods(fid);
  const fx = seasonFx(s.turn);
  const mult = (k: 'foodMult' | 'goldMult' | 'upkeepMult') => f.modifiers.reduce((v, mo) => v * (mo[k] ?? 1), 1);
  const woodMult = hasTech(s, fid, 'logging') ? 1.25 : 1;
  const stoneMult = hasTech(s, fid, 'stonework') ? 1.25 : 1;
  const foodMult = fx.food * mult('foodMult');

  const tiles = emptyRes();
  for (const tile of s.tiles) {
    if (tile.owner !== fid) continue;
    const y = TERRAIN[tile.terrain].yield;
    for (const k of RES_KEYS) tiles[k] += y[k] ?? 0;
    if (tile.resource) tiles[tile.resource] += DEPOSIT_BONUS;
  }
  tiles.food *= foodMult; tiles.wood *= woodMult; tiles.stone *= stoneMult; tiles.iron *= m.mineMult;

  const bld = emptyRes();
  const taxes = emptyRes();
  const popFood = emptyRes();
  const bldUpkeep = emptyRes();
  let research = BASE_RESEARCH;
  for (const c of citiesOf(s, fid)) {
    const ls = levelScale(c.level);
    let cityResearch = 0;
    for (const b of c.buildings) {
      const def = BUILDINGS[b];
      if (def.yield) for (const k of RES_KEYS) {
        let v = (def.yield[k] ?? 0) * ls;
        if (!v) continue;
        if (b === 'farm') v *= m.farmMult * (hasTech(s, fid, 'agri') ? 1.25 : 1) * foodMult;
        if (b === 'lumber') v *= woodMult;
        if (b === 'quarry') v *= stoneMult;
        if (b === 'mine') v *= m.mineMult;
        if (b === 'market') v = (v + (hasTech(s, fid, 'traderoutes') ? 4 : 0)) * m.marketMult;
        bld[k] += v;
      }
      if (def.research) cityResearch += def.research * ls;
      if (def.category === 'military') bldUpkeep.gold -= 1;
    }
    if (c.buildings.includes('academy')) cityResearch *= 1.25;
    research += cityResearch;
    taxes.gold += c.pop * TAX_PER_POP * (0.5 + c.happiness / 200) * levelScale(c.level) * m.taxMult * (hasTech(s, fid, 'finance') ? 1.2 : 1);
    popFood.food -= c.pop * FOOD_PER_POP;
  }
  taxes.gold += BASE_GOLD + m.goldFlat;

  const trade = emptyRes();
  for (const o of FACTION_IDS) {
    if (o === fid || !s.factions[o].alive) continue;
    const p = getPair(s, fid, o);
    if (p.trade && !p.war) trade.gold += TRADE_GOLD * m.tradeMult * (hasTech(s, fid, 'traderoutes') ? 2 : 1);
  }

  const army = emptyRes();
  const upMult = fx.upkeep * (hasTech(s, fid, 'logistics') ? 0.8 : 1) * mult('upkeepMult');
  for (const a of armiesOf(s, fid)) for (const q of a.squads) {
    const u = UNITS[q.type].upkeep;
    army.food -= (q.count / 100) * u.food * upMult;
    army.gold -= (q.count / 100) * u.gold * upMult * m.upkeepGoldMult;
  }

  const goldMult = mult('goldMult');
  if (goldMult !== 1) { taxes.gold *= goldMult; bld.gold *= goldMult; trade.gold *= goldMult; }
  const extraIron = f.modifiers.reduce((v, mo) => v + (mo.ironAdd ?? 0), 0);
  if (extraIron) bld.iron += extraIron;

  const lines: IncomeLine[] = [
    { key: 'eco.tiles', res: tiles }, { key: 'eco.buildings', res: bld }, { key: 'eco.taxes', res: taxes },
    { key: 'eco.trade', res: trade }, { key: 'eco.popFood', res: popFood }, { key: 'eco.army', res: army },
    { key: 'eco.bldUpkeep', res: bldUpkeep },
  ];
  const net = emptyRes();
  for (const l of lines) for (const k of RES_KEYS) net[k] += l.res[k] ?? 0;
  for (const k of RES_KEYS) net[k] = Math.round(net[k]);
  return { net, lines, research: Math.round(research) };
}

/** A kör végi elszámolás: hiány esetén tényleges következményekkel. */
export function applyIncome(s: GameState, fid: FactionId) {
  const f = s.factions[fid];
  const inc = computeIncome(s, fid);
  for (const k of RES_KEYS) f.res[k] += inc.net[k];
  f.stats.goldEarned += Math.max(0, inc.net.gold);
  if (f.res.food < 0) {
    f.res.food = 0;
    for (const c of citiesOf(s, fid)) {
      c.happyMod -= 8;
      c.pop = Math.max(2, c.pop * 0.95);
    }
    for (const a of armiesOf(s, fid)) a.morale = Math.max(0, a.morale - 10);
    if (f.isPlayer) addLog(s, t('log.starvation'), 'bad');
  }
  if (f.res.gold < 0) {
    f.res.gold = 0;
    for (const a of armiesOf(s, fid)) a.morale = Math.max(0, a.morale - 8);
    if (f.isPlayer) addLog(s, t('log.unpaid'), 'bad');
  }
  for (const k of ['wood', 'stone', 'iron'] as ResKey[]) if (f.res[k] < 0) f.res[k] = 0;
  return inc;
}
