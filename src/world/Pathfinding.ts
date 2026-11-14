import { neighbors } from './HexMap';

export interface PathResult { dist: number[]; prev: number[] }

/**
 * Dijkstra-keresés a hatszögrácson. A `cost(from, to)` Infinity-t ad, ha a lépés nem járható.
 * A `maxDist` fölötti mezőket nem terjeszti tovább.
 */
export function dijkstra(
  start: number, count: number, w: number, h: number,
  cost: (from: number, to: number) => number, maxDist = Infinity,
): PathResult {
  const dist = new Array<number>(count).fill(Infinity);
  const prev = new Array<number>(count).fill(-1);
  const done = new Array<boolean>(count).fill(false);
  dist[start] = 0;
  for (;;) {
    let cur = -1, best = Infinity;
    for (let i = 0; i < count; i++) if (!done[i] && dist[i] < best) { best = dist[i]; cur = i; }
    if (cur < 0) break;
    done[cur] = true;
    for (const n of neighbors(cur, w, h)) {
      if (done[n]) continue;
      const c = cost(cur, n);
      if (!isFinite(c)) continue;
      const nd = best + c;
      if (nd <= maxDist && nd < dist[n]) { dist[n] = nd; prev[n] = cur; }
    }
  }
  return { dist, prev };
}

export function buildPath(res: PathResult, target: number): number[] | null {
  if (!isFinite(res.dist[target])) return null;
  const path: number[] = [];
  for (let c = target; c >= 0; c = res.prev[c]) path.unshift(c);
  return path;
}
