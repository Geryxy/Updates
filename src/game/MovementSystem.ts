import { mods } from '../data/factions';
import { UNITS } from '../data/units';
import { neighbors } from '../world/HexMap';
import { buildPath, dijkstra } from '../world/Pathfinding';
import { TERRAIN } from '../world/TerrainTypes';
import {
  Army, BattleReport, FactionId, GameState, MAX_SQUADS, addLog, allied, armyAt, armyById, atWar, cityAt, hasTech, rand,
} from './GameState';
import { captureCity } from './CitySystem';
import { resolveBattle } from './CombatSystem';
import { seasonFx } from './SeasonSystem';
import { t } from '../i18n';

export function maxMoves(s: GameState, a: Army): number {
  if (a.owner === 'neutral' || !a.squads.length) return 0;
  const m = mods(a.owner);
  let best = Infinity;
  for (const q of a.squads) {
    let mv = UNITS[q.type].move;
    if (q.type === 'scout') mv += m.scoutMove + (hasTech(s, a.owner, 'scouting') ? 1 : 0);
    if (q.type === 'cavalry') mv += m.cavalryMove;
    best = Math.min(best, mv);
  }
  if (a.supply < 30) best -= 1;
  return Math.max(1, best);
}

/** A belépés mozgási költsége a terep, az utak, a folyók és az évszak alapján. */
export function enterCost(s: GameState, a: Army, to: number): number {
  const tile = s.tiles[to];
  const fx = seasonFx(s.turn);
  if (tile.road) return tile.terrain === 'plains' ? 0.5 : 1;
  let c = TERRAIN[tile.terrain].moveCost;
  if (tile.terrain === 'forest' && mods(a.owner).forestMove !== null) c = mods(a.owner).forestMove!;
  if (tile.terrain === 'mountain') c += fx.mountainExtra;
  if (tile.river) c += 1 + fx.riverExtra;
  return c;
}

/** Beléphet-e a hadsereg a mező területére (diplomáciai szempontból)? */
export function borderOpen(s: GameState, a: Army, to: number): boolean {
  const o = s.tiles[to].owner;
  if (o === null || o === a.owner) return true;
  return atWar(s, a.owner, o) || allied(s, a.owner, o);
}

export type TargetKind = 'move' | 'attack' | 'merge';
export interface Reach {
  /** Ebben a körben elérhető üres mezők és a költségük. */
  moves: Map<number, number>;
  attacks: Set<number>;
  merges: Set<number>;
  prev: number[];
}

function isHostileTarget(s: GameState, a: Army, tile: number): boolean {
  const other = armyAt(s, tile);
  if (other) return other.owner !== a.owner && atWar(s, a.owner, other.owner);
  const c = cityAt(s, tile);
  return !!c && c.owner !== a.owner && atWar(s, a.owner, c.owner);
}

const freeStep = (s: GameState, a: Army, to: number) =>
  borderOpen(s, a, to) && !armyAt(s, to) && !isHostileTarget(s, a, to);

/** Az ebben a körben elérhető mezők, megtámadható célpontok és egyesítési lehetőségek. */
export function reachable(s: GameState, a: Army): Reach {
  const moves = new Map<number, number>();
  const attacks = new Set<number>(), merges = new Set<number>();
  const n = s.tiles.length;
  if (a.moves <= 0 || a.owner === 'neutral') return { moves, attacks, merges, prev: new Array(n).fill(-1) };
  const res = dijkstra(a.tile, n, s.width, s.height, (_f, to) => (freeStep(s, a, to) ? enterCost(s, a, to) : Infinity), a.moves);
  for (let i = 0; i < n; i++) if (i !== a.tile && isFinite(res.dist[i])) moves.set(i, res.dist[i]);
  if (a.moves >= maxMoves(s, a)) {
    // Teljes mozgásponttal a szomszédos mezőre mindig be lehet lépni.
    for (const nb of neighbors(a.tile, s.width, s.height)) {
      if (!moves.has(nb) && freeStep(s, a, nb)) { moves.set(nb, a.moves); res.prev[nb] = a.tile; res.dist[nb] = a.moves; }
    }
  }
  const stage = (from: number, left: number) => {
    if (left <= 0) return;
    for (const nb of neighbors(from, s.width, s.height)) {
      if (!borderOpen(s, a, nb)) continue;
      if (isHostileTarget(s, a, nb)) attacks.add(nb);
      else {
        const other = armyAt(s, nb);
        if (other && other.owner === a.owner && other.id !== a.id && other.squads.length + a.squads.length <= MAX_SQUADS) merges.add(nb);
      }
    }
  };
  stage(a.tile, a.moves);
  for (const [i, c] of moves) stage(i, a.moves - c + 0.001);
  return { moves, attacks, merges, prev: res.prev };
}

/** Többkörös útvonal a célig (a más hadseregek által elfoglalt mezőket kerüli). */
export function findPath(s: GameState, a: Army, target: number): number[] | null {
  const res = dijkstra(a.tile, s.tiles.length, s.width, s.height, (_f, to) => {
    if (to === target) return borderOpen(s, a, to) ? enterCost(s, a, to) : Infinity;
    return freeStep(s, a, to) ? enterCost(s, a, to) : Infinity;
  });
  return buildPath(res, target);
}

/** A hadsereg tényleges belépése egy mezőre: területfoglalás, romok, városok. */
function stepInto(s: GameState, a: Army, to: number, cost: number) {
  a.tile = to;
  a.moves = Math.max(0, a.moves - cost);
  if (a.owner === 'neutral') return;
  const fid = a.owner as FactionId;
  const tile = s.tiles[to];
  const city = cityAt(s, to);
  if (city && city.owner !== fid && atWar(s, fid, city.owner)) captureCity(s, city, fid);
  else if (tile.owner !== fid && (tile.owner === null || atWar(s, fid, tile.owner)) && !city) {
    tile.owner = fid;
    s.factions[fid].stats.tilesCaptured += 1;
  }
  if (tile.ruin) {
    tile.ruin = false;
    const gold = 40 + Math.floor(rand(s) * 50);
    const f = s.factions[fid];
    f.res.gold += gold;
    if (f.research) f.research.progress += 10;
    addLog(s, t('log.ruin', { faction: t(`faction.${fid}`), gold }), fid === s.playerId ? 'good' : 'info');
  }
}

function walk(s: GameState, a: Army, path: number[]): boolean {
  let moved = false;
  for (let i = 1; i < path.length; i++) {
    const to = path[i];
    if (!freeStep(s, a, to)) break;
    const cost = enterCost(s, a, to);
    if (a.moves >= cost) stepInto(s, a, to, cost);
    else if (a.moves > 0 && a.moves >= maxMoves(s, a)) stepInto(s, a, to, a.moves);
    else break;
    moved = true;
  }
  return moved;
}

export interface MoveResult { ok: boolean; kind?: TargetKind | 'march'; report?: BattleReport; reason?: string }

export function mergeArmies(s: GameState, a: Army, into: Army) {
  const menA = a.squads.reduce((n, q) => n + q.count, 0), menB = into.squads.reduce((n, q) => n + q.count, 0);
  const w = menA / Math.max(1, menA + menB);
  into.morale = Math.round(into.morale * (1 - w) + a.morale * w);
  into.supply = Math.round(into.supply * (1 - w) + a.supply * w);
  into.xp = Math.round(into.xp * (1 - w) + a.xp * w);
  into.squads.push(...a.squads);
  into.moves = Math.min(into.moves, a.moves);
  s.armies = s.armies.filter(x => x.id !== a.id);
}

/** A hadsereg egyik osztagának leválasztása egy szomszédos, szabad saját mezőre. */
export function splitArmy(s: GameState, a: Army, squadIndex: number, makeArmy: (tile: number) => Army): boolean {
  if (a.squads.length < 2 || !a.squads[squadIndex]) return false;
  const spot = neighbors(a.tile, s.width, s.height).find(n => !armyAt(s, n) && s.tiles[n].owner === a.owner && !cityAt(s, n))
    ?? neighbors(a.tile, s.width, s.height).find(n => freeStep(s, a, n) && s.tiles[n].owner === null);
  if (spot === undefined) return false;
  const [squad] = a.squads.splice(squadIndex, 1);
  const na = makeArmy(spot);
  na.squads = [squad];
  na.morale = a.morale; na.supply = a.supply; na.xp = a.xp; na.moves = 0;
  if (s.tiles[spot].owner === null && a.owner !== 'neutral') s.tiles[spot].owner = a.owner;
  return true;
}

/**
 * Mozgás, támadás vagy egyesítés végrehajtása. Távoli cél esetén a hadsereg
 * a lehető legmesszebb halad, a célt pedig megjegyzi (többkörös menetelés).
 */
export function executeMove(s: GameState, armyId: string, target: number): MoveResult {
  const a = armyById(s, armyId);
  if (!a) return { ok: false, reason: t('err.noArmy') };
  if (target === a.tile) return { ok: false };
  const r = reachable(s, a);
  const pathTo = (dest: number) => {
    const p: number[] = [];
    for (let c = dest; c >= 0 && c !== a.tile; c = r.prev[c]) p.unshift(c);
    return [a.tile, ...p];
  };
  if (r.moves.has(target)) {
    a.goto = null;
    walk(s, a, pathTo(target));
    return { ok: true, kind: 'move' };
  }
  if (r.attacks.has(target) || r.merges.has(target)) {
    // A legolcsóbban elérhető szomszédos felvonulási mező kiválasztása.
    let stageTile = -1, best = Infinity;
    for (const nb of neighbors(target, s.width, s.height)) {
      const c = nb === a.tile ? 0 : r.moves.get(nb);
      if (c !== undefined && c < a.moves && c < best) { best = c; stageTile = nb; }
    }
    if (stageTile < 0) return { ok: false, reason: t('err.unreachable') };
    if (stageTile !== a.tile) walk(s, a, pathTo(stageTile));
    if (a.tile !== stageTile) return { ok: false, reason: t('err.unreachable') };
    a.goto = null;
    if (r.merges.has(target)) {
      mergeArmies(s, a, armyAt(s, target)!);
      return { ok: true, kind: 'merge' };
    }
    const report = resolveBattle(s, a, target) ?? undefined;
    const alive = armyById(s, armyId);
    if (alive) {
      alive.moves = 0;
      if (report && report.winner === 'attacker' && !armyAt(s, target)) {
        const city = cityAt(s, target);
        const wasForeign = city && city.owner !== alive.owner;
        stepInto(s, alive, target, 0);
        if (wasForeign && city!.owner === alive.owner) report.cityCaptured = city!.name;
      }
    }
    return { ok: true, kind: 'attack', report };
  }
  const path = findPath(s, a, target);
  if (!path) return { ok: false, reason: t('err.unreachable') };
  const moved = walk(s, a, path);
  a.goto = a.tile === target ? null : target;
  return moved ? { ok: true, kind: 'march' } : { ok: a.goto !== null, kind: 'march', reason: t('err.noMoves') };
}

export function refreshMoves(s: GameState) {
  for (const a of s.armies) a.moves = maxMoves(s, a);
}

/** A játékos megkezdett, többkörös menetparancsainak folytatása a kör elején. */
export function continueMarches(s: GameState, fid: FactionId) {
  for (const a of s.armies.filter(x => x.owner === fid && x.goto !== null)) {
    const target = a.goto!;
    if (armyAt(s, target) || !borderOpen(s, a, target)) { a.goto = null; continue; }
    const path = findPath(s, a, target);
    if (!path) { a.goto = null; continue; }
    walk(s, a, path);
    if (a.tile === target) a.goto = null;
  }
}
