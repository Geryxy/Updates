/**
 * Festményszerű talaj, köd és útháló. A talaj lágy szélű foltokból áll, amelyek a szomszédos
 * mezőkkel egymásba olvadnak; a rajta álló domborzat, növényzet, városok és seregek
 * Blenderben renderelt 3D-s képek (lásd Sprites.ts és tools/blender).
 */
import type { Season, Terrain, Tile } from '../game/GameState';
import { hexCenter, hexCorners, neighbors } from '../world/HexMap';
import { Ctx, HEX, HEX_W, TEX_SCALE, makeCanvas, seeded } from './TextureFactory';

export const GROUND_SIZE = HEX * 2.7;
export const FOG_SIZE = HEX * 3;

// ---------- Zajtextúrák (egyszer készülnek el) ----------
const noiseCache = new Map<number, HTMLCanvasElement>();
function noiseCanvas(cells: number): HTMLCanvasElement {
  let c = noiseCache.get(cells);
  if (c) return c;
  const size = 256;
  c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const r = seeded(cells * 7919 + 13);
  const grid = Array.from({ length: cells * cells }, () => r());
  const at = (x: number, y: number) => grid[((y % cells) + cells) % cells * cells + ((x % cells) + cells) % cells];
  const fade = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const gx = (x / size) * cells, gy = (y / size) * cells;
    const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = fade(gx - x0), fy = fade(gy - y0);
    const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx, bot = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
    const v = Math.round((top * (1 - fy) + bot * fy) * 255);
    const i = (y * size + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  noiseCache.set(cells, c);
  return c;
}

/** Talajszínek: [világos, sötét, kiemelés, árnyék]. */
const GROUND: Record<Terrain, Record<Season, [string, string, string, string]>> = {
  plains: {
    spring: ['#7aa648', '#3f6a2c', '#b4cf62', '#2c4a22'], summer: ['#86a23e', '#4a6a28', '#c4c95a', '#32481e'],
    autumn: ['#a08a38', '#66522a', '#cdb04e', '#473819'], winter: ['#d3dde3', '#8fa3b0', '#f4f8fa', '#6c8290'],
  },
  forest: {
    spring: ['#456f38', '#213f1e', '#6b9a4a', '#15281a'], summer: ['#3b642e', '#1c381b', '#5f8c40', '#122316'],
    autumn: ['#6e5528', '#3a2a16', '#a87a30', '#261a0e'], winter: ['#aebdc4', '#667b87', '#e3ebef', '#4c606c'],
  },
  hills: {
    spring: ['#8f904c', '#55592c', '#b9b86a', '#3a3d1f'], summer: ['#988a40', '#5a5026', '#c2b25c', '#3d351a'],
    autumn: ['#9a763a', '#5c4322', '#c49a50', '#3d2c16'], winter: ['#c2ccd1', '#84949e', '#eef2f4', '#66767f'],
  },
  mountain: {
    spring: ['#716c68', '#3c3840', '#958f88', '#27242c'], summer: ['#787068', '#403a3e', '#9c9486', '#2a262a'],
    autumn: ['#77675c', '#3f3438', '#9a8774', '#2a2226'], winter: ['#b8c2ca', '#6d7a88', '#eaf0f4', '#525e6c'],
  },
  swamp: {
    spring: ['#4d6649', '#22382e', '#6f8a5a', '#16261f'], summer: ['#485c40', '#20342a', '#6a8052', '#15231c'],
    autumn: ['#5c5838', '#322f1e', '#84783e', '#201e13'], winter: ['#98a9a9', '#596d72', '#cfdada', '#435559'],
  },
};
export const terrainColor = (terrain: Terrain, season: Season) => GROUND[terrain][season][0];

function blob(ctx: Ctx, x: number, y: number, rad: number, color: string, alpha: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha; ctx.fillStyle = g;
  ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  ctx.globalAlpha = 1;
}

/** Lágy szélű, festett talajfolt. A szomszédos foltok átfedik egymást, így nincs éles mezőhatár. */
export function groundCanvas(terrain: Terrain, season: Season, variant: number): HTMLCanvasElement {
  const S = GROUND_SIZE, c0 = S / 2;
  const [c, ctx] = makeCanvas(S, S);
  const r = seeded(variant * 1013 + terrain.length * 977 + season.length * 31);
  const [light, dark, hi, shade] = GROUND[terrain][season];
  const g = ctx.createRadialGradient(c0 - 14, c0 - 18, 6, c0, c0, S * 0.62);
  g.addColorStop(0, light); g.addColorStop(1, dark);
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 18; i++) blob(ctx, r() * S, r() * S, 14 + r() * 26, i % 3 ? (i % 2 ? hi : shade) : light, i % 3 && i % 2 ? 0.14 : 0.3);

  // Zaj: nagy foltok és finom szemcse.
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.55;
  ctx.drawImage(noiseCanvas(5), r() * 120, r() * 120, 130, 130, 0, 0, S, S);
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 0.5;
  // A finom szemcse eredeti felbontásban kerül fel, hogy ne legyen kockás.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const grain = noiseCanvas(96);
  for (let gx = -Math.floor(r() * 200); gx < S * TEX_SCALE; gx += 256) for (let gy = -Math.floor(r() * 200); gy < S * TEX_SCALE; gy += 256) ctx.drawImage(grain, gx, gy);
  ctx.restore();

  const spot = (spread = 0.9): [number, number] => {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * HEX * spread;
    return [c0 + Math.cos(a) * d, c0 + Math.sin(a) * d];
  };
  ctx.lineCap = 'round';
  if (terrain === 'plains' || terrain === 'hills') {
    for (let i = 0; i < 46; i++) {
      const [x, y] = spot(1.15);
      ctx.strokeStyle = i % 3 ? shade : hi; ctx.globalAlpha = 0.5; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(x - 2, y); ctx.lineTo(x - 1, y - 3.5); ctx.moveTo(x, y); ctx.lineTo(x + 0.5, y - 4.5); ctx.moveTo(x + 2, y); ctx.lineTo(x + 1.5, y - 3.5); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (terrain === 'plains' && season !== 'winter') {
      const flowers = season === 'autumn' ? ['#c9682a', '#e0a83a'] : ['#f2e6a0', '#e9b3c9', '#ffffff'];
      for (let i = 0; i < 12; i++) { const [x, y] = spot(1.05); ctx.fillStyle = flowers[i % flowers.length]; ctx.globalAlpha = 0.75; ctx.fillRect(x, y, 1.3, 1.3); }
      ctx.globalAlpha = 1;
      if (variant % 3 === 0) {
        // Szántóföld-sávok.
        ctx.save(); ctx.translate(c0 - 8, c0 + 14); ctx.rotate(-0.28);
        ctx.fillStyle = season === 'autumn' ? 'rgba(96,66,28,0.5)' : 'rgba(196,172,84,0.42)';
        ctx.fillRect(-26, -10, 44, 22);
        ctx.strokeStyle = 'rgba(40,28,10,0.4)'; ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-26, -8 + i * 4); ctx.lineTo(18, -8 + i * 4); ctx.stroke(); }
        ctx.restore();
      }
    }
  } else if (terrain === 'forest') {
    for (let i = 0; i < 10; i++) { const [x, y] = spot(1.1); blob(ctx, x, y, 16 + r() * 12, shade, 0.5); }
  } else if (terrain === 'mountain') {
    ctx.strokeStyle = shade; ctx.lineWidth = 1.1;
    for (let i = 0; i < 16; i++) {
      const [x, y] = spot(1.15); ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 4 + r() * 6, y + 2 - r() * 4); ctx.lineTo(x + 9 + r() * 6, y + 3); ctx.stroke();
    }
    for (let i = 0; i < 12; i++) {
      const [x, y] = spot(1.1); ctx.globalAlpha = 0.85;
      ctx.fillStyle = i % 2 ? hi : dark; ctx.beginPath(); ctx.ellipse(x, y, 2.5 + r() * 3, 1.6 + r() * 2, r(), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else {
    for (let i = 0; i < 7; i++) {
      const [x, y] = spot(1.0);
      const rw = 10 + r() * 14, rh = 4 + r() * 6;
      ctx.fillStyle = shade; ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.ellipse(x, y + 1.5, rw + 2, rh + 2, 0, 0, Math.PI * 2); ctx.fill();
      const wg = ctx.createLinearGradient(x, y - rh, x, y + rh);
      if (season === 'winter') { wg.addColorStop(0, '#cfe4ee'); wg.addColorStop(1, '#8fb2c4'); } else { wg.addColorStop(0, '#3f7684'); wg.addColorStop(1, '#1c3d48'); }
      ctx.fillStyle = wg; ctx.globalAlpha = 0.92;
      ctx.beginPath(); ctx.ellipse(x, y, rw, rh, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(220,245,255,0.45)'; ctx.lineWidth = 0.9; ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.ellipse(x - rw * 0.2, y - rh * 0.3, rw * 0.45, rh * 0.3, 0, Math.PI, Math.PI * 1.9); ctx.stroke();
    }
  }
  if (season === 'winter') for (let i = 0; i < 70; i++) { const [x, y] = spot(1.25); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(x, y, 1.4, 1.4); }

  // Egységes, borongós színvilág.
  ctx.fillStyle = season === 'winter' ? 'rgba(40,60,90,0.16)' : 'rgba(10,16,30,0.3)';
  ctx.fillRect(0, 0, S, S);

  // Lágy szélű maszk: a folt a mező szélén túl fokozatosan eltűnik.
  const m = ctx.createRadialGradient(c0, c0, HEX * 0.8, c0, c0, S / 2);
  m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.55, 'rgba(0,0,0,0.7)'); m.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = m; ctx.fillRect(0, 0, S, S);
  return c;
}

export function fogCanvas(variant: number): HTMLCanvasElement {
  const S = FOG_SIZE, c0 = S / 2;
  const [c, ctx] = makeCanvas(S, S);
  const r = seeded(variant * 31 + 5);
  ctx.fillStyle = '#0a0f18'; ctx.fillRect(0, 0, S, S);
  ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.9;
  ctx.drawImage(noiseCanvas(5), r() * 100, r() * 100, 150, 150, 0, 0, S, S);
  ctx.restore();
  for (let i = 0; i < 11; i++) {
    const tone = 95 + r() * 70;
    blob(ctx, r() * S, r() * S, 26 + r() * 34, `rgb(${tone},${tone + 14},${tone + 40})`, 0.2 + r() * 0.14);
  }
  const m = ctx.createRadialGradient(c0, c0, HEX * 0.7, c0, c0, S / 2);
  m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.5, 'rgba(0,0,0,0.75)'); m.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'destination-in'; ctx.fillStyle = m; ctx.fillRect(0, 0, S, S);
  return c;
}

/** Kis fényfolt (felhőárnyékhoz, parázshoz, vízcsillanáshoz). */
export function glowCanvas(size: number, color: string, alpha: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(size, size);
  blob(ctx, size / 2, size / 2, size / 2, color, alpha);
  return c;
}

/**
 * A térkép állandó rétege egyetlen nagy textúrán: halvány mezőrács, kanyargó folyók
 * és földutak. A játék során nem változik.
 */
export function staticLayerCanvas(tiles: Tile[], w: number, h: number): HTMLCanvasElement {
  const worldW = HEX_W * (w + 0.5), worldH = HEX * 1.5 * (h - 1) + HEX * 2;
  const [c, ctx] = makeCanvas(worldW, worldH);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(12,14,10,0.2)'; ctx.lineWidth = 1;
  tiles.forEach((_t, i) => {
    const p = hexCenter(i, HEX, w);
    ctx.beginPath();
    hexCorners(p.x, p.y, HEX - 0.5).forEach((pt, k) => (k ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
    ctx.closePath(); ctx.stroke();
  });

  const links = (flag: 'river' | 'road') => {
    const out: [number, number][] = [];
    tiles.forEach((t, i) => { if (t[flag]) for (const n of neighbors(i, w, h)) if (n > i && tiles[n][flag]) out.push([i, n]); });
    return out;
  };
  const curve = (a: number, b: number, dy: number, bend: number) => {
    const A = hexCenter(a, HEX, w), B = hexCenter(b, HEX, w);
    const r = seeded(a * 131 + b * 17);
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2 + dy, nx = -(B.y - A.y), ny = B.x - A.x, len = Math.hypot(nx, ny) || 1;
    const k = (r() - 0.5) * bend;
    ctx.beginPath(); ctx.moveTo(A.x, A.y + dy);
    ctx.quadraticCurveTo(mx + (nx / len) * k, my + (ny / len) * k, B.x, B.y + dy);
  };
  const strokeAll = (list: [number, number][], dy: number, bend: number, width: number, style: string, dash?: number[]) => {
    ctx.lineWidth = width; ctx.strokeStyle = style; ctx.setLineDash(dash ?? []);
    for (const [a, b] of list) { curve(a, b, dy, bend); ctx.stroke(); }
    ctx.setLineDash([]);
  };
  const rivers = links('river');
  strokeAll(rivers, 12, 26, 22, 'rgba(14,26,24,0.45)');
  strokeAll(rivers, 12, 26, 15, '#1d4a66');
  strokeAll(rivers, 12, 26, 11, '#2f7fae');
  strokeAll(rivers, 11, 26, 5, 'rgba(120,200,235,0.75)');
  strokeAll(rivers, 10, 26, 1.6, 'rgba(235,250,255,0.75)', [7, 15]);
  const roads = links('road');
  strokeAll(roads, 4, 14, 10, 'rgba(26,18,10,0.5)');
  strokeAll(roads, 4, 14, 6.5, '#8a6f45');
  strokeAll(roads, 4, 14, 4, '#c2a56e');
  strokeAll(roads, 4, 14, 1.2, 'rgba(70,50,26,0.5)', [3, 9]);
  return c;
}
