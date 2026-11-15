/**
 * Saját készítésű, kódból rajzolt grafika (Canvas 2D). Sem a játék, sem a launcher
 * nem használ külső képfájlt, így minden jogtiszta és offline is elérhető.
 */
import { FACTIONS } from '../data/factions';
import type { OwnerId, ResKey, UnitType } from '../game/GameState';

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

export function hexPath(ctx: Ctx, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 180) * (60 * k - 30);
    const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
    if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath();
}

function house(ctx: Ctx, x: number, y: number, w: number, h: number, roof = '#9b3f2c') {
  ctx.fillStyle = '#e4d6b4'; ctx.fillRect(x - w / 2, y - h, w, h);
  ctx.fillStyle = '#b9a67c'; ctx.fillRect(x, y - h, w / 2, h);
  ctx.fillStyle = roof;
  ctx.beginPath(); ctx.moveTo(x - w / 2 - 2, y - h); ctx.lineTo(x, y - h - w * 0.6); ctx.lineTo(x + w / 2 + 2, y - h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3d2a17'; ctx.fillRect(x - 1.5, y - h * 0.5, 3, h * 0.5);
  // Meleg fényű ablak.
  ctx.fillStyle = '#ffd97a'; ctx.fillRect(x - w * 0.36, y - h * 0.72, 2.2, 2.4);
  ctx.fillStyle = 'rgba(255,200,90,0.28)'; ctx.beginPath(); ctx.arc(x - w * 0.3, y - h * 0.6, 3.6, 0, Math.PI * 2); ctx.fill();
}

function tower(ctx: Ctx, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#b8b3a6'; ctx.fillRect(x - w / 2, y - h, w, h);
  ctx.fillStyle = '#8e897e'; ctx.fillRect(x, y - h, w / 2, h);
  ctx.fillStyle = '#b8b3a6';
  const m = w / 5;
  for (let i = 0; i < 3; i++) ctx.fillRect(x - w / 2 + i * 2 * m, y - h - m * 1.2, m, m * 1.3);
  ctx.fillStyle = '#2d2620'; ctx.fillRect(x - 1.2, y - h * 0.7, 2.4, 5);
}

/** Városikon az öt városszinthez (tábortól a királyi központig). */
export function cityCanvas(level: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(80, 72);
  const x = 40, y = 60;
  // Kitaposott tér és vetett árnyék a település alatt.
  const dirt = ctx.createRadialGradient(x, y - 2, 4, x, y - 2, 38);
  dirt.addColorStop(0, 'rgba(122,96,60,0.9)'); dirt.addColorStop(0.7, 'rgba(96,74,44,0.55)'); dirt.addColorStop(1, 'rgba(96,74,44,0)');
  ctx.save(); ctx.translate(x, y - 2); ctx.scale(1, 0.36); ctx.translate(-x, -(y - 2));
  ctx.fillStyle = dirt; ctx.fillRect(x - 40, y - 42, 80, 80); ctx.restore();
  ctx.fillStyle = 'rgba(6,8,12,0.34)';
  ctx.beginPath(); ctx.ellipse(x + 5, y + 1, 30, 7, 0, 0, Math.PI * 2); ctx.fill();
  if (level === 1) {
    for (const [tx, s] of [[-14, 1], [10, 1.2]] as const) {
      ctx.fillStyle = '#d9c9a0';
      ctx.beginPath(); ctx.moveTo(x + tx - 12 * s, y); ctx.lineTo(x + tx, y - 20 * s); ctx.lineTo(x + tx + 12 * s, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4a3823';
      ctx.beginPath(); ctx.moveTo(x + tx - 3, y); ctx.lineTo(x + tx, y - 10 * s); ctx.lineTo(x + tx + 3, y); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#e8762c'; ctx.beginPath(); ctx.arc(x - 1, y + 2, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd35a'; ctx.beginPath(); ctx.arc(x - 1, y + 2, 1.5, 0, Math.PI * 2); ctx.fill();
  } else if (level === 2) {
    house(ctx, x - 16, y - 2, 14, 11); house(ctx, x + 14, y - 3, 15, 12, '#7d5a2c'); house(ctx, x - 1, y + 2, 16, 13);
  } else if (level === 3) {
    ctx.strokeStyle = '#6b4a28'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(x, y - 4, 31, 9, 0, 0, Math.PI * 2); ctx.stroke();
    tower(ctx, x + 2, y - 6, 12, 30);
    house(ctx, x - 18, y - 1, 14, 11); house(ctx, x + 19, y - 2, 14, 11, '#7d5a2c'); house(ctx, x - 3, y + 3, 15, 12);
  } else {
    const big = level === 5;
    ctx.fillStyle = '#a7a296'; ctx.fillRect(x - 32, y - 16, 64, 16);
    ctx.fillStyle = '#8a8579'; ctx.fillRect(x - 32, y - 6, 64, 6);
    for (let i = 0; i < 8; i++) { ctx.fillStyle = '#a7a296'; ctx.fillRect(x - 32 + i * 8.3, y - 20, 5, 5); }
    tower(ctx, x - 30, y, 13, big ? 36 : 30); tower(ctx, x + 30, y, 13, big ? 36 : 30);
    house(ctx, x - 12, y - 16, 13, 9); house(ctx, x + 13, y - 16, 13, 9, '#7d5a2c');
    if (big) {
      tower(ctx, x, y - 14, 18, 40);
      ctx.fillStyle = '#3f6fb5';
      ctx.beginPath(); ctx.moveTo(x - 11, y - 54); ctx.lineTo(x, y - 70); ctx.lineTo(x + 11, y - 54); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f1c84b'; ctx.beginPath(); ctx.arc(x, y - 70, 2.2, 0, Math.PI * 2); ctx.fill();
    } else tower(ctx, x, y - 14, 14, 26);
    ctx.fillStyle = '#3a2a1a';
    ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x - 5, y - 8); ctx.arc(x, y - 8, 5, Math.PI, 0); ctx.lineTo(x + 5, y); ctx.closePath(); ctx.fill();
  }
  return c;
}

export function ruinCanvas(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(56, 48);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(28, 40, 22, 6, 0, 0, Math.PI * 2); ctx.fill();
  const col = (x: number, h: number) => {
    ctx.fillStyle = '#c9c4b5'; ctx.fillRect(x - 4, 40 - h, 8, h);
    ctx.fillStyle = '#9d988a'; ctx.fillRect(x, 40 - h, 4, h);
    ctx.fillStyle = '#d8d3c4'; ctx.fillRect(x - 5.5, 40 - h - 3, 11, 3);
  };
  col(12, 22); col(27, 30); col(43, 14);
  ctx.fillStyle = '#c9c4b5'; ctx.fillRect(7, 15, 26, 4);
  ctx.fillStyle = '#6f8a5a'; ctx.beginPath(); ctx.arc(20, 40, 5, Math.PI, 0); ctx.fill(); ctx.beginPath(); ctx.arc(38, 41, 4, Math.PI, 0); ctx.fill();
  return c;
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

export function flagCanvas(owner: OwnerId): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(26, 34);
  ctx.fillStyle = '#3a2a1a'; ctx.fillRect(3, 2, 2.4, 31);
  ctx.fillStyle = ownerColor(owner);
  ctx.beginPath(); ctx.moveTo(5, 3); ctx.lineTo(25, 6); ctx.lineTo(19, 11); ctx.lineTo(25, 17); ctx.lineTo(5, 19); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1; ctx.stroke();
  drawEmblem(ctx, owner, 12, 11, 9, 'rgba(255,255,255,0.92)');
  return c;
}

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

export function drawUnitIcon(ctx: Ctx, type: UnitType, cx: number, cy: number, s: number, color = '#f3e3b0') {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s / 24, s / 24);
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const line = (...p: number[]) => { ctx.beginPath(); ctx.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]); ctx.stroke(); };
  if (type === 'militia') { line(0, 10, 0, -4); line(-5, -10, -5, -4, 5, -4, 5, -10); line(0, -4, 0, -10); }
  else if (type === 'spear') { line(-8, 10, 6, -6); ctx.beginPath(); ctx.moveTo(10, -10); ctx.lineTo(3, -8); ctx.lineTo(8, -3); ctx.closePath(); ctx.fill(); }
  else if (type === 'archer') { ctx.beginPath(); ctx.arc(-4, 0, 10, -Math.PI / 2.4, Math.PI / 2.4); ctx.stroke(); line(-1, -9, -1, 9); line(-8, 0, 10, 0); line(6, -3, 10, 0, 6, 3); }
  else if (type === 'cavalry') { ctx.lineWidth = 3.4; ctx.beginPath(); ctx.arc(0, -1, 7.5, Math.PI * 0.2, Math.PI * 0.8, true); ctx.stroke(); ctx.lineWidth = 2.2; line(-6, 5, -6, 9); line(6, 5, 6, 9); }
  else if (type === 'siege') { ctx.beginPath(); ctx.arc(-5, 7, 3.5, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(6, 7, 3.5, 0, Math.PI * 2); ctx.stroke(); line(-9, 3, 10, 3); line(0, 3, -8, -9); ctx.beginPath(); ctx.arc(-8, -9, 2.6, 0, Math.PI * 2); ctx.fill(); }
  else { ctx.beginPath(); ctx.moveTo(-10, 0); ctx.quadraticCurveTo(0, -9, 10, 0); ctx.quadraticCurveTo(0, 9, -10, 0); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
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
export const unitIconUrl = (type: UnitType) => cachedUrl(`unit:${type}`, 24, ctx => drawUnitIcon(ctx, type, 12, 12, 22));
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
