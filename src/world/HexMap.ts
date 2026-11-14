/** Hegyes csúcsú hatszögrács, "odd-r" eltolt koordinátákkal. A mező indexe: r * szélesség + q. */
export const MAP_W = 11;
export const MAP_H = 11;

export const toIdx = (q: number, r: number, w = MAP_W) => r * w + q;
export const toQR = (idx: number, w = MAP_W) => ({ q: idx % w, r: Math.floor(idx / w) });

const EVEN = [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
const ODD = [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]];

const cache = new Map<string, number[][]>();
function table(w: number, h: number): number[][] {
  const key = `${w}x${h}`;
  let t = cache.get(key);
  if (!t) {
    t = [];
    for (let i = 0; i < w * h; i++) {
      const { q, r } = toQR(i, w);
      const out: number[] = [];
      for (const [dq, dr] of r & 1 ? ODD : EVEN) {
        const nq = q + dq, nr = r + dr;
        if (nq >= 0 && nq < w && nr >= 0 && nr < h) out.push(toIdx(nq, nr, w));
      }
      t.push(out);
    }
    cache.set(key, t);
  }
  return t;
}

export const neighbors = (idx: number, w = MAP_W, h = MAP_H): number[] => table(w, h)[idx];

export function hexDistance(a: number, b: number, w = MAP_W): number {
  const A = toQR(a, w), B = toQR(b, w);
  const ax = A.q - ((A.r - (A.r & 1)) >> 1), bx = B.q - ((B.r - (B.r & 1)) >> 1);
  const dx = ax - bx, dz = A.r - B.r;
  return Math.max(Math.abs(dx), Math.abs(dz), Math.abs(dx + dz));
}

export function tilesWithin(center: number, radius: number, w = MAP_W, h = MAP_H): number[] {
  const out: number[] = [];
  for (let i = 0; i < w * h; i++) if (hexDistance(center, i, w) <= radius) out.push(i);
  return out;
}

/** A hatszög középpontja képpontban, adott sugárral. */
export function hexCenter(idx: number, size: number, w = MAP_W) {
  const { q, r } = toQR(idx, w);
  const hw = Math.sqrt(3) * size;
  return { x: hw * (q + 0.5 * (r & 1)) + hw / 2, y: size * 1.5 * r + size };
}
