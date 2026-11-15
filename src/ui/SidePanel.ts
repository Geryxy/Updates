import type { GameApp } from '../app/GameApp';
import { cityFort, popCapOf } from '../game/CitySystem';
import { City, RES_KEYS, armyAt, cityAt } from '../game/GameState';
import { t } from '../i18n';
import { toQR } from '../world/HexMap';
import { DEPOSIT_BONUS, TERRAIN } from '../world/TerrainTypes';
import { renderArmy } from './ArmyPanel';
import { ICON, bar, btn, esc, pct, resIcon } from './dom';

function cityBlock(app: GameApp, c: City): string {
  const s = app.state!;
  const own = c.owner === s.playerId;
  let body = `<div class="row"><span>${t('city.level')}</span><b>${t(`city.level.${c.level}`)}</b></div>
    <div class="row"><span>${t('city.defense')}</span><b>+${pct(cityFort(c))}</b></div>`;
  if (own) {
    const b = c.build;
    body += `<div class="row"><span>${t('city.pop')}</span><b>${Math.floor(c.pop * 100)} / ${popCapOf(c) * 100}</b></div>
      <div class="row"><span>${t('city.happiness')}</span>${bar(c.happiness, c.happiness < 35 ? 'bad' : 'green')}<b>${Math.round(c.happiness)}</b></div>
      <div class="row"><span>${t('city.building')}</span><b>${b ? `${b.kind === 'building' ? t(`bld.${b.id}`) : t('city.upgrade')} – ${t('ui.turnsLeft', { n: b.turns })}` : t('ui.nothing')}</b></div>
      ${c.training.length ? `<div class="row"><span>${t('city.training')}</span><b>${c.training.map(q => t(`unit.${q.unit}`)).join(', ')}</b></div>` : ''}
      <div class="actions">${btn(t('city.manage'), 'city', { arg: `${c.id}|overview`, cls: 'primary' })}${btn(t('city.buildTab'), 'city', { arg: `${c.id}|build` })}${btn(t('city.recruitTab'), 'city', { arg: `${c.id}|recruit` })}</div>`;
  }
  return `<section class="block city"><h3><span class="dot" style="background:var(--c-${c.owner})"></span>${c.capitalOf ? '★ ' : ''}${esc(c.name)} <small>${t(`faction.${c.owner}`)}</small></h3>${body}</section>`;
}

/** Jobb oldali (álló módban alsó) információs panel a kijelölt mezőről. */
export function renderSide(app: GameApp): string {
  const s = app.state!;
  const idx = app.selectedTile;
  if (idx === null) return '';
  const tile = s.tiles[idx];
  const { q, r } = toQR(idx, s.width);
  const close = `<button class="x" data-act="deselect" title="${t('ui.close')}">${ICON.close}</button>`;
  if (!s.explored[idx]) {
    return `<header><h2>${t('tile.unknown')}</h2>${close}</header><p class="hint">${t('tile.unknownHint')}</p>${marchActions(app, idx)}`;
  }
  const city = cityAt(s, idx);
  const army = app.visible[idx] ? armyAt(s, idx) : undefined;
  const td = TERRAIN[tile.terrain];
  const yields = RES_KEYS.filter(k => td.yield[k] || tile.resource === k)
    .map(k => `${resIcon(k)}${(td.yield[k] ?? 0) + (tile.resource === k ? DEPOSIT_BONUS : 0)}`).join(' ');
  const tags = [tile.river ? t('tile.river') : '', tile.road ? t('tile.road') : '', tile.ruin ? t('tile.ruin') : ''].filter(Boolean).join(' · ');
  return `<header><h2>${city ? esc(city.name) : `${t(`terrain.${tile.terrain}`)} <small>(${q + 1}, ${r + 1})</small>`}</h2>${close}</header>
    <section class="block">
      <div class="row"><span>${t('tile.owner')}</span><b><span class="dot" style="background:var(--c-${tile.owner ?? 'neutral'})"></span>${tile.owner ? t(`faction.${tile.owner}`) : t('tile.unowned')}</b></div>
      <div class="row"><span>${t('tile.terrain')}</span><b>${t(`terrain.${tile.terrain}`)}</b></div>
      <div class="row"><span>${t('tile.move')}</span><b>${tile.road ? (tile.terrain === 'plains' ? '½' : '1') : td.moveCost + (tile.river ? 1 : 0)}</b></div>
      <div class="row"><span>${t('tile.defense')}</span><b>+${pct(td.defense + (tile.river ? 0.15 : 0))}</b></div>
      <div class="row"><span>${t('tile.yield')}</span><b class="yields">${yields || '–'}</b></div>
      ${tile.resource ? `<div class="row"><span>${t('tile.resource')}</span><b>${resIcon(tile.resource)} ${t(`res.${tile.resource}`)}</b></div>` : ''}
      ${tags ? `<div class="row"><span>${t('tile.features')}</span><b>${tags}</b></div>` : ''}
    </section>
    ${city ? cityBlock(app, city) : ''}
    ${army ? renderArmy(app, army) : !app.visible[idx] ? `<p class="hint">${t('tile.notVisible')}</p>` : ''}
    ${marchActions(app, idx)}`;
}

function marchActions(app: GameApp, idx: number): string {
  const army = app.activeArmyObj();
  if (!army || army.tile === idx || !app.reach) return '';
  if (app.reach.attacks.has(idx)) return `<div class="actions sticky">${btn(t('army.attack'), 'attack', { arg: String(idx), cls: 'danger' })}</div>`;
  if (app.reach.moves.has(idx) || app.reach.merges.has(idx)) return '';
  const ok = app.canMarch(idx);
  return `<div class="actions sticky">${btn(t('army.march', { army: esc(army.name) }), 'march', { arg: String(idx), cls: 'primary', disabled: !ok, title: ok ? '' : t('err.unreachable') })}</div>`;
}
