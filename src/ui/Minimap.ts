import type { GameApp } from '../app/GameApp';
import { seasonOf } from '../game/SeasonSystem';
import { terrainColor } from '../render/TerrainArt';
import { HEX, ownerColor } from '../render/TextureFactory';
import { hexCenter, hexCorners } from '../world/HexMap';

const SIZE = 7.2;

/** Minitérkép: terep, birtokviszonyok, városok, látható seregek és a kamera kerete. */
export function drawMinimap(app: GameApp, canvas: HTMLCanvasElement) {
  const s = app.state;
  if (!s) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.sqrt(3) * SIZE * (s.width + 0.5), h = SIZE * 1.5 * (s.height - 1) + SIZE * 2;
  if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); canvas.style.width = `${w}px`; canvas.style.height = `${h}px`; }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const season = seasonOf(s.turn);
  s.tiles.forEach((tile, i) => {
    const c = hexCenter(i, SIZE, s.width);
    ctx.beginPath();
    hexCorners(c.x, c.y, SIZE + 0.3).forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    if (!s.explored[i]) { ctx.fillStyle = '#0b0f18'; ctx.fill(); return; }
    ctx.fillStyle = terrainColor(tile.terrain, season); ctx.fill();
    ctx.fillStyle = 'rgba(8,10,18,0.45)'; ctx.fill();
    if (tile.owner) { ctx.globalAlpha = 0.62; ctx.fillStyle = ownerColor(tile.owner); ctx.fill(); ctx.globalAlpha = 1; }
    if (!app.visible[i]) { ctx.fillStyle = 'rgba(6,8,14,0.4)'; ctx.fill(); }
  });
  for (const city of s.cities) {
    if (!s.explored[city.tile]) continue;
    const c = hexCenter(city.tile, SIZE, s.width);
    ctx.fillStyle = '#14100a'; ctx.fillRect(c.x - 3.4, c.y - 3.4, 6.8, 6.8);
    ctx.fillStyle = city.capitalOf ? '#ffffff' : '#e6dcc0'; ctx.fillRect(c.x - 2.4, c.y - 2.4, 4.8, 4.8);
  }
  for (const a of s.armies) {
    if (!app.visible[a.tile]) continue;
    const c = hexCenter(a.tile, SIZE, s.width);
    ctx.beginPath(); ctx.arc(c.x + 2.5, c.y - 2.5, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = ownerColor(a.owner); ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = '#0c0a08'; ctx.stroke();
  }
  const view = app.mapScene?.viewRect();
  if (view) {
    const k = SIZE / HEX;
    ctx.strokeStyle = '#f3dc97'; ctx.lineWidth = 1.4;
    ctx.strokeRect(Math.max(0.7, view.x * k), Math.max(0.7, view.y * k), Math.min(w - 1.4, view.w * k), Math.min(h - 1.4, view.h * k));
  }
}

/** Kattintás vagy koppintás a minitérképen: a kamera a legközelebbi mezőre ugrik. */
export function minimapClick(app: GameApp, canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const s = app.state;
  if (!s || !app.mapScene) return;
  const r = canvas.getBoundingClientRect();
  const x = clientX - r.left, y = clientY - r.top;
  let best = 0, bd = Infinity;
  for (let i = 0; i < s.tiles.length; i++) {
    const c = hexCenter(i, SIZE, s.width);
    const d = (c.x - x) ** 2 + (c.y - y) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  app.mapScene.centerOn(best);
}
