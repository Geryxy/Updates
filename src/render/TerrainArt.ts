/**
 * Festményszerű terepgrafika. A talaj lágy szélű foltokból áll, amelyek a szomszédos
 * mezőkkel egymásba olvadnak; a domborzat és a növényzet külön rétegen, vetett
 * árnyékkal jelenik meg. Minden kódból készül, külső képfájl nélkül.
 */
import type { Season, Terrain, Tile } from '../game/GameState';
import { hexCenter, hexCorners, neighbors } from '../world/HexMap';
import { Ctx, HEX, HEX_W, TEX_SCALE, makeCanvas, seeded } from './TextureFactory';

export const GROUND_SIZE = HEX * 2.7;
export const DECOR_W = HEX_W * 1.5;
export const DECOR_H = HEX * 3.2;
/** A díszítőréteg horgonypontja: a mező közepe a kép magasságának ennyied részénél van. */
export const DECOR_ANCHOR_Y = 0.62;
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

// ---------- Domborzat és növényzet ----------
function shadow(ctx: Ctx, x: number, y: number, rw: number, rh: number, alpha = 0.34) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rw);
  g.addColorStop(0, `rgba(8,10,16,${alpha})`); g.addColorStop(1, 'rgba(8,10,16,0)');
  ctx.save(); ctx.translate(x, y); ctx.scale(1, rh / rw); ctx.translate(-x, -y);
  ctx.fillStyle = g; ctx.fillRect(x - rw, y - rw, rw * 2, rw * 2);
  ctx.restore();
}

const LEAVES: Record<Season, string[][]> = {
  spring: [['#2f6d32', '#4f9a45', '#86c765'], ['#2a6436', '#44904c', '#79c070'], ['#3a6f2a', '#5f9a3a', '#9fcf5a']],
  summer: [['#215226', '#35783a', '#62a653'], ['#1d4a2a', '#2f6c3c', '#559a58'], ['#2a5a20', '#427f2e', '#73ac48']],
  autumn: [['#7a3416', '#b5561d', '#e58a36'], ['#7a5a12', '#c0902a', '#efc65a'], ['#5e2a1c', '#96402a', '#cf6a3c']],
  winter: [['#3a5248', '#56756a', '#dfeaee'], ['#33483f', '#4c6a60', '#edf4f7']],
};
const PINE: Record<Season, [string, string, string]> = {
  spring: ['#16402a', '#27643c', '#4b9358'], summer: ['#123522', '#1f5532', '#3f8249'],
  autumn: ['#173a26', '#285a36', '#4a8650'], winter: ['#1f3d36', '#3b6359', '#eef5f8'],
};

function conifer(ctx: Ctx, x: number, y: number, s: number, season: Season) {
  const [dk, mid, hi] = PINE[season];
  shadow(ctx, x + s * 0.34, y + s * 0.06, s * 0.62, s * 0.2);
  ctx.fillStyle = '#3d2814'; ctx.fillRect(x - s * 0.05, y - s * 0.22, s * 0.1, s * 0.26);
  for (let i = 0; i < 4; i++) {
    const w = s * (0.46 - i * 0.09), base = y - s * (0.14 + i * 0.3), tip = base - s * 0.48;
    ctx.fillStyle = dk; ctx.beginPath(); ctx.moveTo(x - w, base); ctx.lineTo(x + w, base); ctx.lineTo(x, tip); ctx.closePath(); ctx.fill();
    ctx.fillStyle = mid; ctx.beginPath(); ctx.moveTo(x - w, base); ctx.lineTo(x + w * 0.12, base); ctx.lineTo(x, tip); ctx.closePath(); ctx.fill();
    ctx.fillStyle = hi; ctx.globalAlpha = season === 'winter' ? 0.95 : 0.6;
    ctx.beginPath(); ctx.moveTo(x - w * 0.85, base - s * 0.02); ctx.lineTo(x - w * 0.3, base - s * 0.04); ctx.lineTo(x - s * 0.02, tip + s * 0.05); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function broadleaf(ctx: Ctx, x: number, y: number, s: number, season: Season, r: () => number) {
  const set = LEAVES[season][Math.floor(r() * LEAVES[season].length)];
  shadow(ctx, x + s * 0.36, y + s * 0.05, s * 0.7, s * 0.22);
  ctx.strokeStyle = '#3a2613'; ctx.lineWidth = s * 0.11; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s * 0.02, y - s * 0.5); ctx.stroke();
  const puffs: [number, number, number][] = [[0, -0.72, 0.42], [-0.3, -0.58, 0.32], [0.3, -0.6, 0.33], [0.02, -1.0, 0.3], [-0.2, -0.88, 0.26], [0.22, -0.9, 0.26]];
  for (const [px, py, pr] of puffs) { ctx.fillStyle = set[0]; ctx.beginPath(); ctx.arc(x + px * s + s * 0.05, y + py * s + s * 0.06, pr * s, 0, Math.PI * 2); ctx.fill(); }
  for (const [px, py, pr] of puffs) { ctx.fillStyle = set[1]; ctx.beginPath(); ctx.arc(x + px * s, y + py * s, pr * s * 0.9, 0, Math.PI * 2); ctx.fill(); }
  for (const [px, py, pr] of puffs) {
    ctx.fillStyle = set[2]; ctx.globalAlpha = season === 'winter' ? 0.9 : 0.55;
    ctx.beginPath(); ctx.arc(x + px * s - pr * s * 0.3, y + py * s - pr * s * 0.34, pr * s * 0.48, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function deadTree(ctx: Ctx, x: number, y: number, s: number) {
  shadow(ctx, x + s * 0.25, y + 1, s * 0.4, s * 0.12, 0.3);
  ctx.strokeStyle = '#2b2219'; ctx.lineCap = 'round';
  const line = (w: number, ...p: number[]) => { ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x + p[0] * s, y + p[1] * s); for (let i = 2; i < p.length; i += 2) ctx.lineTo(x + p[i] * s, y + p[i + 1] * s); ctx.stroke(); };
  line(s * 0.1, 0, 0, 0.03, -0.55, -0.02, -0.95);
  line(s * 0.06, 0.03, -0.5, 0.3, -0.78, 0.36, -1.0); line(s * 0.06, 0.01, -0.62, -0.26, -0.84, -0.4, -0.8);
  line(s * 0.04, 0.3, -0.78, 0.46, -0.8); line(s * 0.04, -0.26, -0.84, -0.3, -1.02);
}

function mountain(ctx: Ctx, x: number, y: number, w: number, h: number, season: Season, r: () => number) {
  const winter = season === 'winter';
  shadow(ctx, x + w * 0.55, y + 2, w * 1.25, w * 0.34, 0.42);
  const ridgeX = x + w * (r() * 0.16 - 0.08), shoulder = y - h * (0.5 + r() * 0.12);
  // Megvilágított (bal) oldal.
  const lg = ctx.createLinearGradient(x - w, y, ridgeX, y - h);
  lg.addColorStop(0, winter ? '#8e9aa6' : '#6a655f'); lg.addColorStop(1, winter ? '#dfe7ec' : '#a9a295');
  ctx.fillStyle = lg;
  ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x - w * 0.55, shoulder + h * 0.16); ctx.lineTo(ridgeX, y - h); ctx.lineTo(ridgeX + w * 0.1, y - h * 0.5); ctx.lineTo(x + w * 0.05, y); ctx.closePath(); ctx.fill();
  // Árnyékos (jobb) oldal.
  const sg = ctx.createLinearGradient(ridgeX, y - h, x + w, y);
  sg.addColorStop(0, winter ? '#6f7d8c' : '#4a444c'); sg.addColorStop(1, winter ? '#4d5967' : '#2a252e');
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.moveTo(ridgeX, y - h); ctx.lineTo(x + w * 0.5, shoulder + h * 0.2); ctx.lineTo(x + w, y); ctx.lineTo(x + w * 0.05, y); ctx.lineTo(ridgeX + w * 0.1, y - h * 0.5); ctx.closePath(); ctx.fill();
  // Sziklabordák.
  ctx.strokeStyle = 'rgba(20,18,24,0.42)'; ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const t = 0.2 + i * 0.15, sx = ridgeX + (x - w - ridgeX) * t * 0.9, sy = y - h + h * t;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + w * 0.12, sy + h * 0.16); ctx.lineTo(sx + w * 0.06, sy + h * 0.3); ctx.stroke();
    const tx = ridgeX + (x + w - ridgeX) * t * 0.9;
    ctx.beginPath(); ctx.moveTo(tx, sy); ctx.lineTo(tx - w * 0.08, sy + h * 0.18); ctx.stroke();
  }
  // Hósapka.
  const k = winter ? 0.6 : season === 'summer' ? 0.26 : 0.36;
  ctx.fillStyle = '#f6fafc';
  ctx.beginPath(); ctx.moveTo(ridgeX, y - h);
  ctx.lineTo(ridgeX - w * k * 0.62, y - h + h * k); ctx.lineTo(ridgeX - w * k * 0.3, y - h + h * k * 0.78); ctx.lineTo(ridgeX - w * k * 0.1, y - h + h * k * 1.08);
  ctx.lineTo(ridgeX + w * 0.06, y - h + h * k * 0.72); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#b9c8d6';
  ctx.beginPath(); ctx.moveTo(ridgeX, y - h); ctx.lineTo(ridgeX + w * 0.06, y - h + h * k * 0.72); ctx.lineTo(ridgeX + w * k * 0.3, y - h + h * k * 0.95); ctx.lineTo(ridgeX + w * k * 0.5, y - h + h * k * 0.8); ctx.closePath(); ctx.fill();
}

function hill(ctx: Ctx, x: number, y: number, rw: number, rh: number, cols: [string, string, string, string], r: () => number) {
  shadow(ctx, x + rw * 0.3, y + 3, rw * 1.15, rh * 0.55, 0.36);
  const g = ctx.createLinearGradient(x - rw, y - rh, x + rw, y);
  g.addColorStop(0, cols[2]); g.addColorStop(0.5, cols[0]); g.addColorStop(1, cols[3]);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(x - rw, y);
  ctx.bezierCurveTo(x - rw * 0.7, y - rh * 1.25, x + rw * 0.5, y - rh * 1.3, x + rw, y); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(20,18,10,0.3)'; ctx.lineWidth = 0.9;
  for (let i = 0; i < 5; i++) {
    const t = 0.2 + r() * 0.6, hx = x - rw + rw * 2 * t, hy = y - rh * (0.9 - Math.abs(t - 0.5) * 1.1);
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(hx + 3, hy + rh * 0.3, hx + 1, hy + rh * 0.55); ctx.stroke();
  }
}

function rock(ctx: Ctx, x: number, y: number, s: number) {
  ctx.fillStyle = '#8b8780'; ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x - s * 0.5, y - s * 0.9); ctx.lineTo(x + s * 0.5, y - s * 0.7); ctx.lineTo(x + s, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#4e4a4c'; ctx.beginPath(); ctx.moveTo(x + s * 0.1, y - s * 0.8); ctx.lineTo(x + s * 0.5, y - s * 0.7); ctx.lineTo(x + s, y); ctx.lineTo(x + s * 0.2, y); ctx.closePath(); ctx.fill();
}

/** A mező domborzata és növényzete (átlátszó háttérrel, a talajréteg fölé kerül). */
export function decorCanvas(terrain: Terrain, season: Season, variant: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(DECOR_W, DECOR_H);
  const cx = DECOR_W / 2, cy = DECOR_H * DECOR_ANCHOR_Y;
  const r = seeded(variant * 733 + terrain.length * 389 + 5);
  const cols = GROUND[terrain][season];
  const spots = (n: number, spread: number) => Array.from({ length: n }, (): [number, number] => {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * HEX * spread;
    return [cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.86];
  }).sort((a, b) => a[1] - b[1]);

  if (terrain === 'forest') {
    for (const [x, y] of spots(22, 0.88)) {
      if (r() > 0.42) conifer(ctx, x, y + 10, 17 + r() * 9, season); else broadleaf(ctx, x, y + 10, 15 + r() * 7, season, r);
    }
  } else if (terrain === 'plains') {
    for (const [x, y] of spots(variant % 3 === 1 ? 3 : 1, 0.7)) broadleaf(ctx, x, y + 6, 10 + r() * 5, season, r);
    for (const [x, y] of spots(3, 0.8)) {
      shadow(ctx, x + 3, y + 1, 7, 2.5, 0.28);
      ctx.fillStyle = cols[3]; ctx.beginPath(); ctx.arc(x, y - 2, 4.2, 0, Math.PI * 2); ctx.arc(x + 4, y - 1, 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = cols[2]; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.arc(x - 1, y - 3.5, 2.4, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    }
  } else if (terrain === 'hills') {
    for (const [x, y] of spots(4, 0.62)) hill(ctx, x, y + 12, 22 + r() * 12, 13 + r() * 7, cols, r);
    for (const [x, y] of spots(3, 0.8)) rock(ctx, x, y + 10, 3 + r() * 3);
    if (variant % 2) for (const [x, y] of spots(2, 0.7)) conifer(ctx, x, y + 8, 12 + r() * 4, season);
  } else if (terrain === 'mountain') {
    const base = cy + 26;
    mountain(ctx, cx - 24, base - 8, 24, 48 + r() * 8, season, r);
    mountain(ctx, cx + 26, base - 4, 22, 42 + r() * 8, season, r);
    mountain(ctx, cx + (variant % 2 ? -4 : 5), base + 6, 34, 76 + r() * 12, season, r);
    for (const [x, y] of spots(5, 0.9)) if (y > cy + 8) rock(ctx, x, y + 16, 3 + r() * 4);
  } else {
    for (const [x, y] of spots(3, 0.75)) deadTree(ctx, x, y + 8, 16 + r() * 8);
    ctx.lineCap = 'round';
    for (const [x, y] of spots(18, 0.9)) {
      ctx.strokeStyle = season === 'winter' ? '#77857a' : '#3a5a30'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x, y + 8); ctx.quadraticCurveTo(x + 1.5, y, x + 0.5, y - 4); ctx.stroke();
      ctx.fillStyle = '#4a3320'; ctx.fillRect(x - 0.4, y - 7, 2, 4.5);
    }
    for (const [x, y] of spots(4, 0.8)) blob(ctx, x, y, 22 + r() * 14, 'rgba(190,215,205,1)', 0.16);
  }
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = season === 'winter' ? 'rgba(40,60,90,0.1)' : 'rgba(10,16,30,0.2)';
  ctx.fillRect(0, 0, DECOR_W, DECOR_H);
  return c;
}

/** Sötét, gomolygó köd a feltáratlan vidék fölött; lágy szélű, hogy ne rajzolja ki a rácsot. */
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

export const STATIC_SCALE = 1 / TEX_SCALE;
