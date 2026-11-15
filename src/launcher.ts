/**
 * Köd Koronája Launcher – a Windows-alkalmazás indítóképernyője.
 * Ugyanazt a beállításfájlt és grafikai kódot használja, mint a játék.
 */
import { t } from './i18n';
import { APP_VERSION, isTauri, native } from './platform/Platform';
import { FACTION_IDS } from './game/GameState';
import { GROUND_K, drawSprite, loadSpritePages } from './render/Sprites';
import { FOG_SIZE, GROUND_SIZE, fogCanvas, groundCanvas, staticLayerCanvas } from './render/TerrainArt';
import { HEX, HEX_W, TEX_SCALE, logoUrl } from './render/TextureFactory';
import { Settings, WINDOW_SIZES, loadSettings, saveSettings } from './storage/Settings';
import { hexCenter } from './world/HexMap';
import { generateMap } from './world/MapGenerator';

let settings: Settings;
let view: 'main' | 'settings' = 'main';
let savesPath = '';
let starting = false;
const root = document.getElementById('launcher')!;

/** Látványos háttér: a játék 3D-s világából összerakott, ködbe burkolt térkép. */
async function drawBackground() {
  const canvas = document.getElementById('bg') as HTMLCanvasElement;
  const pages = await loadSpritePages();
  const map = generateMap(Math.floor(Math.random() * 100000));
  const K = GROUND_K, R = 2;
  const w = HEX_W * 11.5, h = (HEX * 1.5 * 10 + HEX * 2) * K;
  canvas.width = w * R; canvas.height = h * R;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(R, R);
  ctx.fillStyle = '#0d1118'; ctx.fillRect(0, 0, w, h);
  const pos = (i: number) => { const c = hexCenter(i, HEX); return { x: c.x, y: c.y * K }; };
  // A talaj és a köd a döntött nézetben függőlegesen rövidül.
  const flat = (img: HTMLCanvasElement, x: number, y: number, size: number, alpha = 1) => {
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, x - size / 2, y - (size * K) / 2, size, size * K);
    ctx.globalAlpha = 1;
  };
  const grounds = new Map<string, HTMLCanvasElement>();
  map.tiles.forEach((tile, i) => {
    const key = `${tile.terrain}${i % 2}`;
    if (!grounds.has(key)) grounds.set(key, groundCanvas(tile.terrain, 'autumn', i % 2));
    const { x, y } = pos(i);
    flat(grounds.get(key)!, x, y, GROUND_SIZE);
  });
  const roads = staticLayerCanvas(map.tiles, map.width, map.height);
  ctx.drawImage(roads, 0, 0, roads.width / TEX_SCALE, (roads.height / TEX_SCALE) * K);

  const owners = [...FACTION_IDS].sort(() => Math.random() - 0.5);
  const settled = new Set([...map.capitals, ...map.villages]);
  const items: { y: number; name: string; x: number; scale: number }[] = [];
  map.tiles.forEach((tile, i) => {
    const { x, y } = pos(i);
    if (!settled.has(i)) items.push({ x, y, name: `decor-${tile.terrain}-autumn-${i % 3}`, scale: 1 });
    if (tile.ruin) items.push({ x, y: y + 0.01, name: `ruin-${i % 2}`, scale: 1 });
  });
  map.capitals.forEach((i, k) => items.push({ ...pos(i), name: `city-5-${owners[k]}`, scale: 1.15 }));
  map.villages.forEach((i, k) => items.push({ ...pos(i), name: `city-${2 + (k % 2)}-neutral`, scale: 1.35 }));
  for (const it of items.sort((a, b) => a.y - b.y)) drawSprite(ctx, pages, it.name, it.x, it.y, it.scale);

  const fogs = [0, 1, 2].map(v => fogCanvas(v));
  map.tiles.forEach((_t, i) => {
    const { x, y } = pos(i);
    const d = Math.hypot(x - w / 2, (y - h / 2) / K) / (w / 2);
    flat(fogs[i % 3], x, y, FOG_SIZE, Math.min(0.95, Math.max(0.05, d * 0.85 + (Math.random() - 0.5) * 0.3)));
  });
}

function render() {
  if (view === 'settings') return renderSettings();
  root.innerHTML = `
    <section class="hero">
      <img class="logo" src="${logoUrl()}" alt="Köd Koronája logó">
      <h1>Köd Koronája</h1>
      <p class="subtitle">${t('menu.subtitle')}</p>
    </section>
    <nav>
      <button class="btn primary big" data-act="play"${starting ? ' disabled' : ''}>${starting ? t('l.starting') : t('l.play')}</button>
      <button class="btn big" data-act="settings">${t('ui.settings')}</button>
      <button class="btn big" data-act="exit">${t('l.exit')}</button>
    </nav>
    <footer><span>${t('set.version', { v: APP_VERSION })}</span><span>${settings.fullscreen ? t('set.fullscreen.on') : `${t('l.windowed')} · ${settings.windowSize.replace('x', ' × ')}`}</span></footer>`;
}

function renderSettings() {
  const slider = (key: 'music' | 'sfx') => `<label class="field"><span>${t(`set.${key}`)}</span>
    <input type="range" min="0" max="100" value="${Math.round(settings[key] * 100)}" data-key="${key}"><b>${Math.round(settings[key] * 100)}%</b></label>`;
  const opt = (v: string, cur: string, label: string) => `<option value="${v}"${v === cur ? ' selected' : ''}>${label}</option>`;
  root.innerHTML = `<section class="panel">
      <h2>${t('ui.settings')}</h2>
      <label class="field"><span>${t('l.mode')}</span><select data-key="fullscreen">${opt('1', settings.fullscreen ? '1' : '0', t('l.fullscreen'))}${opt('0', settings.fullscreen ? '1' : '0', t('l.windowed'))}</select></label>
      <label class="field"><span>${t('set.windowSize')}</span><select data-key="windowSize"${settings.fullscreen ? ' disabled' : ''}>${WINDOW_SIZES.map(s => opt(s, settings.windowSize, s.replace('x', ' × '))).join('')}</select></label>
      ${slider('music')}${slider('sfx')}
      <label class="field"><span>${t('set.mute')}</span><input type="checkbox" data-key="muted"${settings.muted ? ' checked' : ''}></label>
      <label class="field"><span>${t('set.quality')}</span><select data-key="quality">${(['low', 'medium', 'high'] as const).map(q => opt(q, settings.quality, t(`set.quality.${q}`))).join('')}</select></label>
      <div class="field"><span>${t('set.saves')}</span><small class="path">${savesPath || t('set.webSaves')}</small></div>
      <div class="field"><span>${t('l.versionLabel')}</span><b class="ver">${APP_VERSION}</b></div>
      <div class="actions">
        ${isTauri ? `<button class="btn" data-act="openSaves">${t('set.openSaves')}</button>` : ''}
        <button class="btn primary" data-act="back">${t('ui.back')}</button>
      </div>
    </section>`;
}

async function play() {
  if (starting) return;
  starting = true;
  render();
  await saveSettings(settings);
  if (isTauri) {
    try { await native('launch_game'); } catch (err) { console.error(err); }
    starting = false;
    render();
  } else {
    window.location.href = './index.html';
  }
}

document.addEventListener('click', e => {
  const el = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
  if (!el) return;
  switch (el.dataset.act) {
    case 'play': void play(); break;
    case 'settings': view = 'settings'; render(); break;
    case 'back': view = 'main'; render(); break;
    case 'openSaves': void native('open_saves_dir').catch(() => undefined); break;
    case 'exit': if (isTauri) void native('quit_app'); else window.close(); break;
  }
});

document.addEventListener('input', e => {
  const el = e.target as HTMLInputElement;
  const key = el.dataset.key;
  if (!key) return;
  if (key === 'music' || key === 'sfx') {
    settings[key] = Number(el.value) / 100;
    const out = el.parentElement?.querySelector('b');
    if (out) out.textContent = `${el.value}%`;
  } else if (key === 'muted') settings.muted = el.checked;
  else if (key === 'fullscreen') settings.fullscreen = el.value === '1';
  else if (key === 'windowSize') settings.windowSize = el.value;
  else if (key === 'quality') settings.quality = el.value as Settings['quality'];
  void saveSettings(settings);
  if (el.tagName === 'SELECT') render();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && view === 'settings') { view = 'main'; render(); }
  if (e.key === 'Enter' && view === 'main') void play();
});
document.addEventListener('contextmenu', e => e.preventDefault());

void (async () => {
  settings = await loadSettings();
  if (isTauri) savesPath = await native<string>('saves_path').catch(() => '');
  void drawBackground().catch(() => undefined);
  render();
})();
