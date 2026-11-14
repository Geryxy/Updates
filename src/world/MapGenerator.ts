import type { ResKey, Terrain, Tile } from '../game/GameState';
import { MAP_H, MAP_W, hexDistance, neighbors, toIdx } from './HexMap';
import { buildPath, dijkstra } from './Pathfinding';
import { TERRAIN } from './TerrainTypes';

export interface GeneratedMap {
  width: number;
  height: number;
  tiles: Tile[];
  /** A négy főváros helye (sarkok közelében). */
  capitals: number[];
  villages: number[];
  center: number;
}

export const PRESET_SEED = 20240;

function rng(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothNoise(r: () => number, n: number, w: number, h: number): number[] {
  let v = Array.from({ length: n }, () => r());
  for (let pass = 0; pass < 2; pass++) {
    v = v.map((x, i) => {
      const nb = neighbors(i, w, h);
      return (x * 2 + nb.reduce((s, j) => s + v[j], 0)) / (nb.length + 2);
    });
  }
  return v;
}

/** Magból determinisztikusan előállított 11×11-es világtérkép. */
export function generateMap(seed: number): GeneratedMap {
  const w = MAP_W, h = MAP_H, n = w * h;
  const r = rng(seed);
  const elev = smoothNoise(r, n, w, h), moist = smoothNoise(r, n, w, h);
  const rank = (arr: number[]) => {
    const order = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const out = new Array<number>(n);
    order.forEach(([, i], k) => { out[i] = k / (n - 1); });
    return out;
  };
  const e = rank(elev), m = rank(moist);
  const tiles: Tile[] = [];
  for (let i = 0; i < n; i++) {
    let terrain: Terrain = 'plains';
    if (e[i] > 0.88) terrain = 'mountain';
    else if (e[i] > 0.72) terrain = 'hills';
    else if (m[i] > 0.66) terrain = 'forest';
    else if (m[i] < 0.1) terrain = 'swamp';
    tiles.push({ terrain, owner: null, river: false, road: false, resource: null, ruin: false, cityId: null });
  }

  const capitals = [toIdx(2, 2), toIdx(8, 2), toIdx(2, 8), toIdx(8, 8)];
  const villages = [toIdx(5, 2), toIdx(5, 8), toIdx(2, 5), toIdx(8, 5)];
  const center = toIdx(5, 5);
  const special = new Set([...capitals, ...villages, center]);

  for (const c of capitals) {
    tiles[c].terrain = 'plains';
    const ring = neighbors(c, w, h);
    const wanted: Terrain[] = ['plains', 'plains', 'forest', 'hills', 'plains', 'forest'];
    ring.forEach((t, k) => { tiles[t].terrain = wanted[(k + c) % wanted.length]; });
  }
  for (const v of villages) tiles[v].terrain = 'plains';
  tiles[center].terrain = 'plains';
  tiles[center].ruin = true;

  // Két folyó: északról délre és nyugatról keletre kanyarogva.
  const carve = (start: number, next: (i: number) => number[]) => {
    let cur = start;
    for (let guard = 0; guard < 30; guard++) {
      if (!special.has(cur)) {
        tiles[cur].river = true;
        if (tiles[cur].terrain === 'mountain') tiles[cur].terrain = 'hills';
      }
      const opts = next(cur).filter(i => !capitals.includes(i));
      if (!opts.length) break;
      cur = opts[Math.floor(r() * opts.length)];
    }
  };
  const colStart = 3 + Math.floor(r() * 2);
  carve(toIdx(colStart, 0), i => neighbors(i, w, h).filter(j => Math.floor(j / w) > Math.floor(i / w)));
  const rowStart = 6 + Math.floor(r() * 2);
  carve(toIdx(0, rowStart), i => neighbors(i, w, h).filter(j => j % w > i % w && Math.abs(Math.floor(j / w) - rowStart) <= 1));

  // Utak: a fővárosoktól a szomszédos településekig, onnan a romvárosig.
  const roadCost = (_f: number, to: number) => TERRAIN[tiles[to].terrain].moveCost * (tiles[to].terrain === 'mountain' ? 3 : 1) + (tiles[to].river ? 1 : 0);
  const pave = (a: number, b: number) => {
    const p = buildPath(dijkstra(a, n, w, h, roadCost), b);
    if (p) for (const i of p) tiles[i].road = true;
  };
  for (const c of capitals) {
    const near = [...villages].sort((a, b) => hexDistance(c, a) - hexDistance(c, b));
    pave(c, near[0]); pave(c, near[1]);
  }
  for (const v of villages) pave(v, center);

  // Romok és nyersanyag-lelőhelyek.
  const free = (i: number) => !special.has(i) && !tiles[i].ruin && !tiles[i].resource;
  const farFromCapitals = (i: number, d: number) => capitals.every(c => hexDistance(c, i) >= d);
  const place = (count: number, ok: (i: number) => boolean, apply: (t: Tile) => void) => {
    const pool = Array.from({ length: n }, (_, i) => i).filter(i => free(i) && ok(i));
    for (let k = 0; k < count && pool.length; k++) apply(tiles[pool.splice(Math.floor(r() * pool.length), 1)[0]]);
  };
  place(5, i => farFromCapitals(i, 3), t => { t.ruin = true; });
  for (const c of capitals) {
    const near = (res: ResKey, ok: (t: Tile) => boolean) => {
      const pool = Array.from({ length: n }, (_, i) => i).filter(i => free(i) && hexDistance(c, i) >= 1 && hexDistance(c, i) <= 2 && ok(tiles[i]));
      if (pool.length) tiles[pool[Math.floor(r() * pool.length)]].resource = res;
    };
    near('iron', t => t.terrain === 'hills' || t.terrain === 'mountain');
    near('food', t => t.terrain === 'plains');
  }
  const res = (count: number, key: ResKey, terr: Terrain[]) => place(count, i => terr.includes(tiles[i].terrain) && farFromCapitals(i, 2), t => { t.resource = key; });
  res(4, 'iron', ['mountain', 'hills']);
  res(3, 'stone', ['hills', 'mountain']);
  res(4, 'gold', ['plains', 'hills', 'swamp']);
  res(3, 'wood', ['forest']);
  res(3, 'food', ['plains']);

  return { width: w, height: h, tiles, capitals, villages, center };
}
