import { hexDistance, neighbors } from '../world/HexMap';
import { Army, FactionId, GameState, allied, armyMen, citiesOf, clamp, hasTech, cityAt, addLog } from './GameState';
import { seasonFx } from './SeasonSystem';
import { t } from '../i18n';

/**
 * Utánpótlási hálózat: 2 = a fővárossal (vagy a székhellyel) összefüggő saját/szövetséges terület,
 * 1 = csak egy elszigetelt városhoz kapcsolódó terület, 0 = ellátatlan.
 */
export function supplyNetwork(s: GameState, fid: FactionId): number[] {
  const level = new Array<number>(s.tiles.length).fill(0);
  const cities = citiesOf(s, fid);
  if (!cities.length) return level;
  const seat = cities.find(c => c.capitalOf === fid) ?? [...cities].sort((a, b) => b.level - a.level)[0];
  const flood = (start: number, lv: number) => {
    const queue = [start];
    level[start] = lv;
    while (queue.length) {
      const cur = queue.shift()!;
      for (const n of neighbors(cur, s.width, s.height)) {
        if (level[n] >= lv) continue;
        const o = s.tiles[n].owner;
        if (o === fid || (o && allied(s, fid, o))) { level[n] = lv; queue.push(n); }
      }
    }
  };
  flood(seat.tile, 2);
  for (const c of cities) if (level[c.tile] === 0) flood(c.tile, 1);
  return level;
}

export const supplyRange = (s: GameState, fid: FactionId) => 2 + (hasTech(s, fid, 'logistics') ? 1 : 0);

/** A hadsereg távolsága a legközelebbi ellátott mezőtől (0 = hálózaton áll). */
export function supplyDistance(s: GameState, net: number[], tile: number): number {
  if (net[tile] > 0) return 0;
  let best = Infinity;
  for (let i = 0; i < net.length; i++) if (net[i] > 0) best = Math.min(best, hexDistance(tile, i, s.width));
  return best;
}

export const supplyFactor = (supply: number) => 0.6 + 0.4 * (supply / 100);
export const moraleFactor = (morale: number) => 0.6 + 0.4 * (morale / 100);

function updateArmy(s: GameState, a: Army, net: number[]) {
  const fid = a.owner as FactionId;
  const fx = seasonFx(s.turn);
  const lv = net[a.tile];
  if (lv > 0) {
    const target = lv === 2 ? 100 : 70;
    a.supply = a.supply < target ? Math.min(target, a.supply + 25) : Math.max(target, a.supply - 10);
  } else {
    const d = supplyDistance(s, net, a.tile);
    a.supply -= (d <= supplyRange(s, fid) ? 6 : 18) * fx.supplyDecay;
  }
  a.supply = clamp(Math.round(a.supply), 0, 100);

  const tile = s.tiles[a.tile];
  const city = cityAt(s, a.tile);
  const home = tile.owner === fid;
  if (a.supply < 40) a.morale -= 8;
  else if (home) a.morale += 6 + (hasTech(s, fid, 'drill') ? 5 : 0) + (city ? 4 : 0);
  else a.morale += 1;
  a.morale = clamp(Math.round(a.morale), 0, 100);

  if (a.supply <= 0) {
    for (const q of a.squads) q.count = Math.round(q.count * 0.88);
    if (fid === s.playerId) addLog(s, t('log.attrition', { army: a.name }), 'bad');
  } else if (home && a.supply >= 60 && s.factions[fid].res.food > 0) {
    const heal = city && city.owner === fid ? 12 : 5;
    for (const q of a.squads) q.count = Math.min(100, q.count + heal);
  }
  a.squads = a.squads.filter(q => q.count >= 5);
}

/** Minden hadsereg ellátásának, moráljának és gyógyulásának kör végi frissítése. */
export function updateSupply(s: GameState) {
  const nets = new Map<FactionId, number[]>();
  for (const a of s.armies) {
    if (a.owner === 'neutral') { a.supply = 100; a.morale = Math.min(100, a.morale + 5); continue; }
    let net = nets.get(a.owner);
    if (!net) { net = supplyNetwork(s, a.owner); nets.set(a.owner, net); }
    updateArmy(s, a, net);
  }
  for (const a of s.armies) if (!armyMen(a) && a.owner === s.playerId) addLog(s, t('log.armyLost', { army: a.name }), 'bad');
  s.armies = s.armies.filter(a => armyMen(a) > 0);
}
