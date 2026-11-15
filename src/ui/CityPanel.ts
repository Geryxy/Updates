import type { GameApp } from '../app/GameApp';
import { BUILDINGS, BUILDING_IDS, CITY_LEVELS } from '../data/buildings';
import { UNITS, UNIT_TYPES } from '../data/units';
import {
  MAX_TRAINING, buildTurns, buildingCost, canBuild, canRecruit, canUpgrade, cancelBuild, cityFort, popCapOf, recruit,
  slotsOf, startBuild, startUpgrade, unitCost, upgradeCost,
} from '../game/CitySystem';
import { cityEconomy } from '../game/EconomySystem';
import { BuildingId, UnitType, cityById } from '../game/GameState';
import { t } from '../i18n';
import { spriteUrl } from '../render/Sprites';
import { unitImg } from './ArmyPanel';
import { bar, btn, costHtml, esc, pct, resIcon } from './dom';
import { actions, modals } from './registry';

const CATS = ['economy', 'military', 'science'] as const;

/** Városkezelő ablak: áttekintés, építkezés és toborzás. */
modals.city = {
  wide: true,
  render(app, data) {
    const s = app.state!;
    const c = cityById(s, String(data.cityId));
    if (!c || c.owner !== s.playerId) return `<h2>${t('city.lost')}</h2>`;
    const tab = String(data.tab ?? 'overview');
    const res = s.factions[s.playerId].res;
    const tabs = (['overview', 'build', 'recruit'] as const).map(k =>
      `<button class="tab${k === tab ? ' on' : ''}" data-act="city" data-arg="${c.id}|${k}">${t(`city.tab.${k}`)}</button>`).join('');
    const queue = c.build
      ? `<div class="progress"><div><b>${c.build.kind === 'building' ? t(`bld.${c.build.id}`) : t('city.upgradeTo', { level: t(`city.level.${c.level + 1}`) })}</b>
          <small>${t('ui.turnsLeft', { n: c.build.turns })}</small></div>${bar(100 * (1 - c.build.turns / c.build.total), 'gold')}
          ${btn(t('city.cancel'), 'city:cancel', { arg: c.id, cls: 'small' })}</div>`
      : `<p class="hint">${t('city.idle')}</p>`;
    let body = '';
    if (tab === 'overview') {
      const eco = cityEconomy(s, c);
      const up = upgradeCost(s, c);
      const chk = canUpgrade(s, c);
      body = `<div class="city-hero"><img src="${spriteUrl(`city-${c.level}-${c.owner}`)}" alt="${t(`city.level.${c.level}`)}"></div>
        <div class="grid2">
          <div class="row"><span>${t('city.level')}</span><b>${t(`city.level.${c.level}`)} (${c.level}/5)</b></div>
          <div class="row"><span>${t('city.pop')}</span><b>${Math.floor(c.pop * 100)} / ${popCapOf(c) * 100}</b></div>
          <div class="row"><span>${t('city.happiness')}</span>${bar(c.happiness, c.happiness < 35 ? 'bad' : 'green')}<b>${Math.round(c.happiness)}</b></div>
          <div class="row"><span>${t('city.defense')}</span><b>+${pct(cityFort(c))}</b></div>
          <div class="row"><span>${t('city.tax')}</span><b>${resIcon('gold')}+${eco.tax}</b></div>
          <div class="row"><span>${t('city.foodNeed')}</span><b>${resIcon('food')}−${eco.foodNeed}</b></div>
        </div>
        <h3>${t('city.construction')}</h3>${queue}
        <h3>${t('city.buildings')} <small>${c.buildings.length} / ${slotsOf(s, c)} ${t('city.slots')}</small></h3>
        <ul class="chips">${c.buildings.map(b => `<li title="${t(`bld.${b}.desc`)}">${t(`bld.${b}`)}</li>`).join('') || `<li class="muted">${t('ui.nothing')}</li>`}</ul>
        <h3>${t('city.upgrade')}</h3>
        ${up ? `<div class="item"><img class="city-next" src="${spriteUrl(`city-${c.level + 1}-${c.owner}`)}" alt=""><div><b>${t('city.upgradeTo', { level: t(`city.level.${c.level + 1}`) })}</b>
            <small>${t('city.upgradeDesc', { slots: CITY_LEVELS[c.level].slots, pop: CITY_LEVELS[c.level].popCap * 100 })}</small>
            ${costHtml(up, res)} <small>${t('ui.turns', { n: CITY_LEVELS[c.level - 1].turns })}</small>
            ${chk.ok ? '' : `<small class="why">${esc(chk.reason ?? '')}</small>`}</div>
            ${btn(t('city.upgradeBtn'), 'city:upgrade', { arg: c.id, cls: 'primary', disabled: !chk.ok })}</div>`
          : `<p class="hint">${t('err.maxLevel')}</p>`}`;
    } else if (tab === 'build') {
      body = `${queue}<p class="hint">${t('city.slotsFree', { n: slotsOf(s, c) - c.buildings.length })}</p>` + CATS.map(cat => {
        const items = BUILDING_IDS.filter(b => BUILDINGS[b].category === cat && !c.buildings.includes(b)).map(b => {
          const chk = canBuild(s, c, b);
          return `<div class="item"><div><b>${t(`bld.${b}`)}</b><small>${t(`bld.${b}.desc`)}</small>
            ${costHtml(buildingCost(s, c, b), res)} <small>${t('ui.turns', { n: buildTurns(s, c, b) })}</small>
            ${chk.ok ? '' : `<small class="why">${esc(chk.reason ?? '')}</small>`}</div>
            ${btn(t('city.buildBtn'), 'city:build', { arg: `${c.id}|${b}`, cls: 'primary', disabled: !chk.ok })}</div>`;
        }).join('');
        return items ? `<h3>${t(`cat.${cat}`)}</h3>${items}` : '';
      }).join('');
    } else {
      const training = c.training.length
        ? `<ul class="chips">${c.training.map(q => `<li>${t(`unit.${q.unit}`)} – ${q.turns > 0 ? t('ui.turnsLeft', { n: q.turns }) : t('city.waiting')}</li>`).join('')}</ul>`
        : `<p class="hint">${t('city.noTraining')}</p>`;
      body = `<h3>${t('city.training')} <small>${c.training.length} / ${MAX_TRAINING}</small></h3>${training}` + UNIT_TYPES.map(u => {
        const def = UNITS[u];
        const chk = canRecruit(s, c, u);
        return `<div class="item">${unitImg(u, s.playerId, 'unit-ico')}<div><b>${t(`unit.${u}`)}</b><small>${t(`unit.${u}.desc`)}</small>
          <small class="stats">${t('unit.stats', { a: def.attack, d: def.defense, m: def.move })} · ${t('unit.upkeep')}: ${resIcon('food')}${def.upkeep.food} ${resIcon('gold')}${def.upkeep.gold}</small>
          ${costHtml(unitCost(s, s.playerId, u), res)} <small>${t('ui.turns', { n: def.trainTurns })} · ${t('unit.popCost')}</small>
          ${chk.ok ? '' : `<small class="why">${esc(chk.reason ?? '')}</small>`}</div>
          ${btn(t('city.recruitBtn'), 'city:recruit', { arg: `${c.id}|${u}`, cls: 'primary', disabled: !chk.ok })}</div>`;
      }).join('');
    }
    return `<h2>${c.capitalOf ? '★ ' : ''}${esc(c.name)} <small>${t(`city.level.${c.level}`)}</small></h2><nav class="tabs">${tabs}</nav>${body}`;
  },
};

actions.city = (app, [cityId, tab]) => app.ui.openModal('city', { cityId, tab: tab ?? 'overview' });

const result = (app: GameApp, res: { ok: boolean; reason?: string }, sound: 'build' | 'coin') => {
  if (res.ok) app.audio.play(sound);
  else { app.audio.play('error'); app.ui.toast(res.reason ?? ''); }
  app.changed();
};
actions['city:build'] = (app, [cityId, b]) => {
  const c = cityById(app.state!, cityId);
  if (!c) return;
  const res = startBuild(app.state!, c, b as BuildingId);
  if (res.ok) { app.flag('built'); app.mapScene?.pulse(c.tile, 0xffd866); }
  result(app, res, 'build');
};
actions['city:upgrade'] = (app, [cityId]) => {
  const c = cityById(app.state!, cityId);
  if (c) result(app, startUpgrade(app.state!, c), 'build');
};
actions['city:cancel'] = (app, [cityId]) => {
  const c = cityById(app.state!, cityId);
  if (c) { cancelBuild(app.state!, c); app.audio.play('click'); app.changed(); }
};
actions['city:recruit'] = (app, [cityId, u]) => {
  const c = cityById(app.state!, cityId);
  if (c) result(app, recruit(app.state!, c, u as UnitType), 'coin');
};
