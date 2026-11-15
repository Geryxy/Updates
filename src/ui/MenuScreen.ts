import type { GameApp } from '../app/GameApp';
import { Difficulty, FACTION_IDS, FactionId } from '../game/GameState';
import { t } from '../i18n';
import { APP_VERSION, isTauri, native } from '../platform/Platform';
import { emblemUrl, logoUrl } from '../render/TextureFactory';
import { ALL_SLOTS, AUTO_SLOT, MANUAL_SLOTS, SaveMeta } from '../storage/SaveManager';
import { btn } from './dom';
import { actions, modals } from './registry';

export interface MenuState {
  view: 'main' | 'new';
  faction: FactionId;
  difficulty: Difficulty;
  map: 'preset' | 'random';
  hasAuto: boolean;
  hasAny: boolean;
}
export const menuState: MenuState = { view: 'main', faction: 'szikra', difficulty: 'normal', map: 'preset', hasAuto: false, hasAny: false };
let slotCache: Record<string, SaveMeta | null> = {};

export async function refreshSlots(app: GameApp) {
  slotCache = await app.saves.list();
  menuState.hasAuto = !!slotCache[AUTO_SLOT];
  menuState.hasAny = ALL_SLOTS.some(k => !!slotCache[k]);
}

/** Főmenü és új játék (frakció-, nehézség- és térképválasztás). */
export function renderMenu(): string {
  if (menuState.view === 'new') return renderNewGame();
  return `<div class="menu-main">
      <img class="logo" src="${logoUrl()}" alt="">
      <h1>Köd Koronája</h1><p class="subtitle">${t('menu.subtitle')}</p>
      <nav>
        ${btn(t('menu.new'), 'menu:new', { cls: 'primary big' })}
        ${btn(t('menu.continue'), 'menu:continue', { cls: 'big', disabled: !menuState.hasAuto, title: menuState.hasAuto ? '' : t('menu.noSave') })}
        ${btn(t('menu.load'), 'saves', { arg: 'load', cls: 'big', disabled: !menuState.hasAny, title: menuState.hasAny ? '' : t('menu.noSave') })}
        ${btn(t('menu.tutorial'), 'menu:tutorial', { cls: 'big' })}
        ${btn(t('ui.settings'), 'open', { arg: 'settings', cls: 'big' })}
        ${isTauri ? btn(t('menu.exit'), 'menu:exit', { cls: 'big' }) : ''}
      </nav>
      <p class="version">${t('set.version', { v: APP_VERSION })}</p>
    </div>`;
}

function renderNewGame(): string {
  const cards = FACTION_IDS.map(f => `<button class="faction${f === menuState.faction ? ' on' : ''}" data-act="menu:faction" data-arg="${f}" style="--fc:var(--c-${f})">
      <header><img src="${emblemUrl(f)}" alt=""><div><b>${t(`faction.${f}`)}</b><small>${t(`faction.${f}.motto`)}</small></div></header>
      <ul class="pros">${t(`faction.${f}.pros`).split('|').map(p => `<li>${p}</li>`).join('')}</ul>
      <ul class="cons"><li>${t(`faction.${f}.cons`)}</li></ul>
      <p class="style">${t('menu.style')}: ${t(`faction.${f}.style`)}</p>
    </button>`).join('');
  const seg = (group: string, value: string, cur: string, label: string) =>
    `<button class="seg${value === cur ? ' on' : ''}" data-act="menu:set" data-arg="${group}|${value}">${label}</button>`;
  return `<div class="menu-new">
      <h2>${t('menu.chooseFaction')}</h2>
      <div class="factions">${cards}</div>
      <div class="options">
        <div><span>${t('menu.difficulty')}</span><div class="segs">${(['easy', 'normal', 'hard'] as const).map(d => seg('difficulty', d, menuState.difficulty, t(`diff.${d}`))).join('')}</div>
          <small>${t(`diff.${menuState.difficulty}.desc`)}</small></div>
        <div><span>${t('menu.map')}</span><div class="segs">${seg('map', 'preset', menuState.map, t('menu.map.preset'))}${seg('map', 'random', menuState.map, t('menu.map.random'))}</div>
          <small>${t(`menu.map.${menuState.map}.desc`)}</small></div>
      </div>
      <div class="actions">${btn(t('ui.back'), 'menu:back', { cls: 'big' })}${btn(t('menu.start'), 'menu:start', { cls: 'primary big' })}</div>
    </div>`;
}

actions['menu:new'] = app => { menuState.view = 'new'; app.ui.render(); };
actions['menu:back'] = app => { menuState.view = 'main'; app.ui.render(); };
actions['menu:faction'] = (app, [f]) => { menuState.faction = f as FactionId; app.ui.render(); };
actions['menu:set'] = (app, [group, value]) => {
  if (group === 'difficulty') menuState.difficulty = value as Difficulty;
  if (group === 'map') menuState.map = value as 'preset' | 'random';
  app.ui.render();
};
actions['menu:start'] = app => {
  menuState.view = 'main';
  app.startNew({ player: menuState.faction, difficulty: menuState.difficulty, seed: menuState.map === 'random' ? Math.floor(Math.random() * 1e9) + 1 : undefined });
};
actions['menu:tutorial'] = app => app.startNew({ player: 'szikra', difficulty: 'easy', tutorial: true });
actions['menu:continue'] = async app => {
  const state = await app.saves.load(AUTO_SLOT);
  if (state) app.enter(state); else app.ui.toast(t('save.loadFail'));
};
actions['menu:exit'] = () => { void native('return_to_launcher').catch(() => undefined); };

// ---------- Játék közbeni menü, mentés és betöltés ----------
modals.gamemenu = {
  render: () => `<h2>${t('ui.menu')}</h2><div class="menu-list">
      ${btn(t('gm.resume'), 'modal:close', { cls: 'primary big' })}
      ${btn(t('gm.save'), 'saves', { arg: 'save', cls: 'big' })}
      ${btn(t('gm.load'), 'saves', { arg: 'load', cls: 'big' })}
      ${btn(t('ui.settings'), 'open', { arg: 'settings|gamemenu', cls: 'big' })}
      ${btn(t('ui.help'), 'open', { arg: 'help|gamemenu', cls: 'big' })}
      ${btn(t('gm.quit'), 'game:quit', { cls: 'big' })}
    </div>`,
};

function slotLine(meta: SaveMeta | null): string {
  if (!meta) return `<small class="muted">${t('save.empty')}</small>`;
  const date = new Date(meta.savedAt).toLocaleString('hu-HU', { dateStyle: 'short', timeStyle: 'short' });
  return `<small>${t(`faction.${meta.faction}`)} · ${t('ui.turnShort', { n: meta.turn })} · ${t(`diff.${meta.difficulty}`)}${meta.tutorial ? ` · ${t('ui.tutorial')}` : ''} · ${date}</small>`;
}

modals.saves = {
  render(app, data) {
    const mode = String(data.mode);
    const inGame = !!app.state;
    const rows = (mode === 'save' ? MANUAL_SLOTS : ALL_SLOTS).map(slot => {
      const meta = slotCache[slot] ?? null;
      const action = mode === 'save'
        ? btn(t('save.saveHere'), 'saves:save', { arg: slot, cls: 'primary small' })
        : btn(t('save.load'), 'saves:load', { arg: slot, cls: 'primary small', disabled: !meta });
      const del = meta && slot !== AUTO_SLOT ? btn(t('save.delete'), 'saves:delete', { arg: `${slot}|${mode}`, cls: 'small' }) : '';
      return `<div class="item"><div><b>${t(`save.slot.${slot}`)}</b>${slotLine(meta)}</div><div class="item-btns">${action}${del}</div></div>`;
    }).join('');
    return `<h2>${t(mode === 'save' ? 'gm.save' : 'gm.load')}</h2>${rows}
      <h3>${t('save.file')}</h3><p class="hint">${t('save.fileHint')}</p>
      <div class="actions">
        ${inGame ? btn(t('save.export'), 'saves:export') : ''}${btn(t('save.import'), 'saves:import')}
        ${btn(t('ui.back'), inGame ? 'open' : 'modal:close', { arg: 'gamemenu' })}
      </div>`;
  },
};

actions.saves = async (app, [mode]) => { await refreshSlots(app); app.ui.openModal('saves', { mode }); };
actions['saves:save'] = async (app, [slot]) => {
  const ok = app.state ? await app.saves.save(slot, app.state) : false;
  app.audio.play(ok ? 'coin' : 'error');
  app.ui.toast(t(ok ? 'save.saved' : 'save.saveFail'));
  await refreshSlots(app);
  app.ui.render();
};
actions['saves:load'] = async (app, [slot]) => {
  const state = await app.saves.load(slot);
  if (!state) return app.ui.toast(t('save.loadFail'));
  app.ui.closeModal(true);
  app.enter(state);
  app.ui.toast(t('save.loaded'));
};
actions['saves:delete'] = async (app, [slot]) => {
  await app.saves.remove(slot);
  await refreshSlots(app);
  app.ui.render();
};
actions['saves:export'] = app => { if (app.state) app.saves.exportFile(app.state); };
actions['saves:import'] = async app => {
  const state = await app.saves.importFile();
  if (!state) return app.ui.toast(t('save.importFail'));
  app.ui.closeModal(true);
  app.enter(state);
  app.ui.toast(t('save.loaded'));
};
actions['game:quit'] = app => { app.ui.closeModal(true); void app.toMenu(); };
