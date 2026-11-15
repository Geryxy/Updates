/**
 * Kódból rajzolt felületi grafika (Canvas 2D): erőforrás-ikonok, frakciócímerek,
 * hadseregjelzők és a játék logója. A térkép 3D-s tárgyai a Sprites.ts-ben vannak.
 */
import { FACTIONS } from '../data/factions';
import type { OwnerId, ResKey } from '../game/GameState';

export const HEX = 56;
export const TEX_SCALE = 2;
export const HEX_W = Math.sqrt(3) * HEX;

export type Ctx = CanvasRenderingContext2D;

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * TEX_SCALE); c.height = Math.ceil(h * TEX_SCALE);
  const ctx = c.getContext('2d')!;
  ctx.scale(TEX_SCALE, TEX_SCALE);
  return [c, ctx];
}

export function seeded(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexPath(ctx: Ctx, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 180) * (60 * k - 30);
    const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
    if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath();
}

/** Erőforrás-ikon rajzolása (a térképen és a kezelőfelületen is ezt használjuk). */
export function drawResIcon(ctx: Ctx, key: ResKey, cx: number, cy: number, s: number) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s / 24, s / 24);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (key === 'food') {
    ctx.strokeStyle = '#e9c558'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, -8); ctx.stroke();
    ctx.fillStyle = '#f2d36b';
    for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(sx * 4, -7 + i * 4.2, 3.6, 2, sx * -0.7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.beginPath(); ctx.ellipse(0, -10, 2, 3.2, 0, 0, Math.PI * 2); ctx.fill();
  } else if (key === 'wood') {
    ctx.fillStyle = '#9a6a3a'; ctx.fillRect(-9, -5, 16, 10);
    ctx.fillStyle = '#7a4f28'; ctx.fillRect(-9, 1, 16, 4);
    ctx.fillStyle = '#d9b27a'; ctx.beginPath(); ctx.ellipse(7, 0, 3.6, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#9a6a3a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(7, 0, 1.6, 2.4, 0, 0, Math.PI * 2); ctx.stroke();
  } else if (key === 'stone') {
    ctx.fillStyle = '#b9bdc2'; ctx.beginPath(); ctx.moveTo(-10, 7); ctx.lineTo(-7, -3); ctx.lineTo(0, -8); ctx.lineTo(8, -3); ctx.lineTo(10, 7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8b9096'; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(8, -3); ctx.lineTo(10, 7); ctx.lineTo(1, 7); ctx.lineTo(3, -1); ctx.closePath(); ctx.fill();
  } else if (key === 'iron') {
    ctx.fillStyle = '#7f95ad'; ctx.beginPath(); ctx.moveTo(-10, -6); ctx.lineTo(10, -6); ctx.lineTo(6, 0); ctx.lineTo(3, 0); ctx.lineTo(3, 4); ctx.lineTo(8, 8); ctx.lineTo(-8, 8); ctx.lineTo(-3, 4); ctx.lineTo(-3, 0); ctx.lineTo(-6, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c3d2e0'; ctx.fillRect(-9, -6, 18, 2.4);
  } else {
    for (const [x, y] of [[-4, 4], [4, 4], [0, -3]]) {
      ctx.fillStyle = '#c9982a'; ctx.beginPath(); ctx.ellipse(x, y + 1.5, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f4cf55'; ctx.beginPath(); ctx.ellipse(x, y, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c9982a'; ctx.beginPath(); ctx.ellipse(x, y, 3, 1.8, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

export function resBadgeCanvas(key: ResKey): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(30, 30);
  ctx.fillStyle = 'rgba(24,20,14,0.82)'; ctx.beginPath(); ctx.arc(15, 15, 13, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#d7b866'; ctx.lineWidth = 1.5; ctx.stroke();
  drawResIcon(ctx, key, 15, 15, 17);
  return c;
}

/** Frakciócímer (a zászlókon, a hadseregjelzőkön és a felületen). */
export function drawEmblem(ctx: Ctx, owner: OwnerId, cx: number, cy: number, s: number, color = '#fff') {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s / 24, s / 24);
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (owner === 'szikra') {
    ctx.beginPath();
    for (let i = 0; i < 16; i++) { const a = (Math.PI / 8) * i - Math.PI / 2, rr = i % 2 ? 3.6 : i % 4 ? 7 : 11; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
  } else if (owner === 'moha') {
    ctx.beginPath(); ctx.moveTo(0, 10); ctx.bezierCurveTo(-12, 4, -9, -8, 0, -11); ctx.bezierCurveTo(9, -8, 12, 4, 0, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(0, 9); ctx.lineTo(0, -7); ctx.moveTo(0, 2); ctx.lineTo(-4, -2); ctx.moveTo(0, -1); ctx.lineTo(4, -5); ctx.stroke();
  } else if (owner === 'vaskapu') {
    ctx.fillRect(-9, -3, 18, 13);
    for (let i = 0; i < 3; i++) ctx.fillRect(-9 + i * 7, -9, 4, 6);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.moveTo(-3.5, 10); ctx.lineTo(-3.5, 3); ctx.arc(0, 3, 3.5, Math.PI, 0); ctx.lineTo(3.5, 10); ctx.closePath(); ctx.fill();
  } else if (owner === 'volgyek') {
    for (const dy of [-5, 3]) { ctx.beginPath(); ctx.moveTo(-10, dy + 5); ctx.lineTo(0, dy - 4); ctx.lineTo(10, dy + 5); ctx.stroke(); }
  } else {
    ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(8, 8); ctx.moveTo(8, -8); ctx.lineTo(-8, 8); ctx.stroke();
  }
  ctx.restore();
}

export const ownerColor = (o: OwnerId | null) => (o && o !== 'neutral' ? FACTIONS[o].css : '#9a9488');
export const ownerDark = (o: OwnerId | null) => (o && o !== 'neutral' ? FACTIONS[o].dark : '#3d3a34');

/** Hadseregjelző: címeres pajzs a frakció színében. */
export function tokenCanvas(owner: OwnerId): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(48, 56);
  const shield = () => {
    ctx.beginPath(); ctx.moveTo(5, 5); ctx.lineTo(43, 5); ctx.lineTo(43, 27);
    ctx.bezierCurveTo(43, 41, 31, 48, 24, 52); ctx.bezierCurveTo(17, 48, 5, 41, 5, 27); ctx.closePath();
  };
  ctx.save(); ctx.translate(1.5, 2.5); shield(); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill(); ctx.restore();
  shield();
  const g = ctx.createLinearGradient(5, 5, 43, 52);
  g.addColorStop(0, ownerColor(owner)); g.addColorStop(1, ownerDark(owner));
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = '#f3e3b0'; ctx.lineWidth = 2.2; ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 0.8; ctx.stroke();
  drawEmblem(ctx, owner, 24, 24, 24, '#fff');
  return c;
}

const urlCache = new Map<string, string>();
function cachedUrl(key: string, size: number, draw: (ctx: Ctx) => void): string {
  let url = urlCache.get(key);
  if (!url) {
    const c = document.createElement('canvas');
    c.width = c.height = size * 3;
    const ctx = c.getContext('2d')!;
    ctx.scale(3, 3);
    draw(ctx);
    url = c.toDataURL();
    urlCache.set(key, url);
  }
  return url;
}
export const resIconUrl = (key: ResKey) => cachedUrl(`res:${key}`, 24, ctx => drawResIcon(ctx, key, 12, 12, 24));
export const emblemUrl = (owner: OwnerId) => cachedUrl(`emb:${owner}`, 48, ctx => {
  ctx.beginPath(); ctx.moveTo(5, 4); ctx.lineTo(43, 4); ctx.lineTo(43, 25);
  ctx.bezierCurveTo(43, 37, 31, 42, 24, 46); ctx.bezierCurveTo(17, 42, 5, 37, 5, 25); ctx.closePath();
  const g = ctx.createLinearGradient(5, 4, 43, 46);
  g.addColorStop(0, ownerColor(owner)); g.addColorStop(1, ownerDark(owner));
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = '#f3e3b0'; ctx.lineWidth = 2; ctx.stroke();
  drawEmblem(ctx, owner, 24, 22, 24, '#fff');
});

/** A játék logója: koronás, ködbe burkolt hatszög. */
export function drawLogo(ctx: Ctx, cx: number, cy: number, s: number) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s / 100, s / 100);
  hexPath(ctx, 0, 0, 48);
  const g = ctx.createLinearGradient(0, -48, 0, 48);
  g.addColorStop(0, '#2b3a55'); g.addColorStop(1, '#101724');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = '#d7b866'; ctx.lineWidth = 4; ctx.stroke();
  ctx.save(); hexPath(ctx, 0, 0, 45); ctx.clip();
  for (const [x, y, rad, a] of [[-22, 22, 30, 0.5], [18, 28, 34, 0.45], [0, 40, 40, 0.5], [-34, 6, 20, 0.25], [34, 10, 22, 0.25]]) {
    const fg = ctx.createRadialGradient(x, y, 2, x, y, rad);
    fg.addColorStop(0, `rgba(200,215,235,${a})`); fg.addColorStop(1, 'rgba(200,215,235,0)');
    ctx.fillStyle = fg; ctx.fillRect(-50, -50, 100, 100);
  }
  ctx.restore();
  const cg = ctx.createLinearGradient(0, -26, 0, 14);
  cg.addColorStop(0, '#ffe38a'); cg.addColorStop(1, '#c08a1e');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.moveTo(-26, 12); ctx.lineTo(-30, -16); ctx.lineTo(-15, -3); ctx.lineTo(0, -26); ctx.lineTo(15, -3); ctx.lineTo(30, -16); ctx.lineTo(26, 12);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#6b4a0c'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.fillStyle = '#8a5f12'; ctx.fillRect(-26, 7, 52, 5);
  for (const [x, y, col] of [[-30, -16, '#e24b4b'], [0, -26, '#6ec3ff'], [30, -16, '#e24b4b'], [0, 1, '#7be08a']] as const) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3a2806'; ctx.lineWidth = 1; ctx.stroke();
  }
  ctx.restore();
}
export const logoUrl = () => cachedUrl('logo', 100, ctx => drawLogo(ctx, 50, 50, 100));
