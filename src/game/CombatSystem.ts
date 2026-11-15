import { mods } from '../data/factions';
import { UNITS } from '../data/units';
import { hexDistance, neighbors } from '../world/HexMap';
import { TERRAIN } from '../world/TerrainTypes';
import {
  Army, BattleReport, BattleSide, GameState, PowerPart, Squad, addLog, allied, armyAt, armyMen, atWar, cityAt,
  citiesOf, clamp, hasTech, rand,
} from './GameState';
import { cityFort } from './CitySystem';
import { seasonFx, seasonOf } from './SeasonSystem';
import { moraleFactor, supplyFactor } from './SupplySystem';
import { t } from '../i18n';

export const ROLL_MIN = 0.85;
export const ROLL_MAX = 1.15;

export interface PowerResult { power: number; parts: PowerPart[] }
export interface BattlePreview {
  attacker: PowerResult;
  defender: PowerResult;
  defenderArmy: Army;
  winChance: number;
  lossA: number;
  lossD: number;
  risk: 'low' | 'medium' | 'high' | 'extreme';
}

const share = (a: Army, type: string) => {
  const men = armyMen(a);
  return men ? a.squads.filter(q => q.type === type).reduce((n, q) => n + q.count, 0) / men : 0;
};
const ownsBuilding = (s: GameState, a: Army, b: 'smith') => a.owner !== 'neutral' && citiesOf(s, a.owner).some(c => c.buildings.includes(b));

/** Ha a megtámadott városban nincs hadsereg, a városőrség védekezik. */
export function townGuard(s: GameState, tile: number): Army | null {
  const c = cityAt(s, tile);
  if (!c) return null;
  const count = 25 * c.level + (c.buildings.includes('wall') ? 30 : 0);
  return {
    id: 'guard', owner: c.owner, name: t('army.guard', { city: c.name }), tile,
    squads: [{ type: 'militia', count }], morale: 70, supply: 100, moves: 0, xp: 0, goto: null,
  };
}

export const defenderAt = (s: GameState, tile: number): Army | null => armyAt(s, tile) ?? townGuard(s, tile);

/**
 * Egy hadsereg harci ereje adott szerepben. Az eredmény tételesen visszaadja
 * az összes szorzót, hogy a csata előtti képernyő és a jelentés átlátható legyen.
 */
export function armyPower(s: GameState, a: Army, role: 'attack' | 'defend', tileIdx: number, enemy: Army): PowerResult {
  const tile = s.tiles[tileIdx];
  const city = cityAt(s, tileIdx);
  const enemyCav = share(enemy, 'cavalry');
  const enemySpear = share(enemy, 'spear');
  const rough = tile.terrain !== 'plains' && tile.terrain !== 'hills';
  let base = 0;
  for (const q of a.squads) {
    const u = UNITS[q.type];
    let v = role === 'attack' ? u.attack : u.defense;
    if (role === 'attack') {
      if (q.type === 'cavalry') v *= (rough ? 0.7 : 1.25) * (1 - 0.4 * enemySpear);
      if (q.type === 'siege' && city) v *= hasTech(s, a.owner, 'siegecraft') ? 3.2 : 2.5;
    } else {
      if (q.type === 'spear') v *= 1 + 0.6 * enemyCav;
      if (q.type === 'archer') v *= city ? 1.5 : 1.3;
      if (q.type === 'militia' && city) v *= 1.3;
      if (q.type === 'cavalry' && rough) v *= 0.8;
    }
    base += (q.count / 100) * v;
  }
  const parts: PowerPart[] = [{ label: t('pw.base'), mult: base }];
  const add = (key: string, mult: number) => { if (Math.abs(mult - 1) > 0.004) parts.push({ label: t(key), mult }); };
  add('pw.morale', moraleFactor(a.morale));
  add('pw.supply', supplyFactor(a.supply));
  add('pw.xp', 1 + Math.min(a.xp, 100) / 400);
  if (ownsBuilding(s, a, 'smith')) add('pw.smith', 1.05);
  if (role === 'attack') {
    if (hasTech(s, a.owner, 'weapons')) add('pw.weapons', 1.1);
    add(`pw.season.${seasonOf(s.turn)}`, seasonFx(s.turn).attack);
  } else {
    if (hasTech(s, a.owner, 'armor')) add('pw.armor', 1.1);
    add('pw.faction', mods(a.owner).defenseMult);
    add(`pw.terrain.${tile.terrain}`, 1 + TERRAIN[tile.terrain].defense);
    if (tile.river) add('pw.river', 1.15);
    if (city && city.owner === a.owner) {
      const siegeMen = enemy.squads.filter(q => q.type === 'siege').reduce((n, q) => n + q.count, 0) / 100;
      const breach = Math.min(0.9, siegeMen * (hasTech(s, enemy.owner, 'siegecraft') ? 0.5 : 0.35));
      add('pw.fort', 1 + cityFort(city) * (1 - breach));
    }
  }
  return { power: parts.reduce((v, p) => v * p.mult, 1), parts };
}

const lossFrac = (p: number) => clamp(0.7 * Math.pow(p, 1.6), 0.02, 0.75);

/** A csata várható kimenetele véletlen nélkül (dobás = 1). */
export function previewBattle(s: GameState, attacker: Army, tile: number): BattlePreview | null {
  const defenderArmy = defenderAt(s, tile);
  if (!defenderArmy) return null;
  const A = armyPower(s, attacker, 'attack', tile, defenderArmy);
  const D = armyPower(s, defenderArmy, 'defend', tile, attacker);
  const winChance = A.power <= 0 ? 0 : clamp((ROLL_MAX - D.power / A.power) / (ROLL_MAX - ROLL_MIN), 0, 1);
  const p = A.power / Math.max(0.001, A.power + D.power);
  const lossA = Math.round(armyMen(attacker) * lossFrac(1 - p));
  const lossD = Math.round(armyMen(defenderArmy) * lossFrac(p));
  const risk = winChance >= 0.85 ? 'low' : winChance >= 0.55 ? 'medium' : winChance >= 0.25 ? 'high' : 'extreme';
  return { attacker: A, defender: D, defenderArmy, winChance, lossA, lossD, risk };
}

function applyLosses(a: Army, frac: number): number {
  let lost = 0;
  for (const q of a.squads) {
    const l = Math.min(q.count, Math.round(q.count * frac));
    q.count -= l; lost += l;
  }
  for (const q of a.squads) if (q.count < 5) { lost += q.count; q.count = 0; }
  a.squads = a.squads.filter(q => q.count > 0);
  return lost;
}

function retreatTile(s: GameState, a: Army, from: number): number | null {
  let best: number | null = null, bestScore = -Infinity;
  for (const n of neighbors(a.tile, s.width, s.height)) {
    if (armyAt(s, n)) continue;
    const o = s.tiles[n].owner;
    const c = cityAt(s, n);
    if (c && c.owner !== a.owner) continue;
    if (o && o !== a.owner && !allied(s, a.owner, o) && !atWar(s, a.owner, o)) continue;
    const score = (o === a.owner ? 10 : o === null ? 3 : 0) + hexDistance(n, from, s.width) * 2 + (c ? 5 : 0);
    if (score > bestScore) { bestScore = score; best = n; }
  }
  return best;
}

const copySquads = (sq: Squad[]) => sq.map(q => ({ ...q }));

/** Csata lejátszása. A támadó a szomszédos mezőről támad; a győztes mozgatását a mozgásrendszer végzi. */
export function resolveBattle(s: GameState, attacker: Army, tile: number): BattleReport | null {
  const real = armyAt(s, tile);
  const defender = real ?? townGuard(s, tile);
  if (!defender) return null;
  const A = armyPower(s, attacker, 'attack', tile, defender);
  const D = armyPower(s, defender, 'defend', tile, attacker);
  const roll = ROLL_MIN + rand(s) * (ROLL_MAX - ROLL_MIN);
  const eff = A.power * roll;
  const attackerWins = eff > D.power;
  const p = eff / Math.max(0.001, eff + D.power);
  const side = (a: Army, pw: PowerResult): BattleSide =>
    ({ owner: a.owner, name: a.name, before: copySquads(a.squads), after: [], power: pw.power, parts: pw.parts, losses: 0, fate: 'held' });
  const sa = side(attacker, A), sd = side(defender, D);
  const menD = armyMen(defender);
  sa.losses = applyLosses(attacker, lossFrac(1 - p) * (attackerWins ? 1 : 1.25));
  sd.losses = applyLosses(defender, lossFrac(p) * (attackerWins ? 1.25 : 1));
  const xpGain = (a: Army, won: boolean) => { a.xp = Math.min(100, a.xp + (won ? 12 : 4) * (hasTech(s, a.owner, 'drill') ? 1.5 : 1)); };
  xpGain(attacker, attackerWins); xpGain(defender, !attackerWins);
  const from = attacker.tile;

  if (attackerWins) {
    attacker.morale = clamp(attacker.morale + 8, 0, 100);
    defender.morale = clamp(defender.morale - 20, 0, 100);
    sa.fate = 'advanced';
    if (!real) sd.fate = 'destroyed';
    else {
      // A független helyőrségek nem vonulnak vissza: vereség esetén szétszélednek.
      const to = defender.owner !== 'neutral' && armyMen(defender) >= menD * 0.2 ? retreatTile(s, defender, from) : null;
      if (to === null) { defender.squads = []; sd.fate = 'destroyed'; }
      else { defender.tile = to; defender.goto = null; sd.fate = 'retreated'; }
    }
  } else {
    attacker.morale = clamp(attacker.morale - 20, 0, 100);
    defender.morale = clamp(defender.morale + 8, 0, 100);
    sa.fate = armyMen(attacker) > 0 ? 'repelled' : 'destroyed';
    sd.fate = 'held';
  }
  sa.after = copySquads(attacker.squads); sd.after = copySquads(defender.squads);
  attacker.goto = null;
  s.armies = s.armies.filter(a => armyMen(a) > 0);

  const win = attackerWins ? attacker : defender, lose = attackerWins ? defender : attacker;
  if (win.owner !== 'neutral') s.factions[win.owner].stats.battlesWon++;
  if (lose.owner !== 'neutral') { s.factions[lose.owner].stats.battlesLost++; s.factions[lose.owner].ai.weariness += 2; }

  const report: BattleReport = { turn: s.turn, tile, attacker: sa, defender: sd, roll, winner: attackerWins ? 'attacker' : 'defender', cityCaptured: null };
  const involved = attacker.owner === s.playerId || defender.owner === s.playerId;
  if (involved) s.reports.push(report);
  const ownerName = (o: string) => t(`faction.${o}`);
  addLog(s, t(attackerWins ? 'log.battleWon' : 'log.battleLost', {
    a: `${sa.name} (${ownerName(sa.owner)})`, d: `${sd.name} (${ownerName(sd.owner)})`,
  }), involved ? ((win.owner === s.playerId) ? 'good' : 'bad') : 'war');
  return report;
}
