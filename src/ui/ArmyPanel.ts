import type { GameApp } from '../app/GameApp';
import { FOUND_CITY_COST } from '../data/buildings';
import { UNITS } from '../data/units';
import { canFoundCity, createArmy, foundCity } from '../game/CitySystem';
import { Army, armyById, armyMen } from '../game/GameState';
import { maxMoves, splitArmy } from '../game/MovementSystem';
import { t } from '../i18n';
import { unitIconUrl } from '../render/TextureFactory';
import { bar, btn, costHtml, esc } from './dom';
import { actions } from './registry';

export const squadRow = (q: { type: keyof typeof UNITS; count: number }, extra = '') =>
  `<li class="squad"><img class="ico" src="${unitIconUrl(q.type)}" alt=""><span>${t(`unit.${q.type}`)}</span><b>${q.count}</b>${extra}</li>`;

const fmtMoves = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Hadsereg adatai és műveletei az oldalpanelen. */
export function renderArmy(app: GameApp, a: Army): string {
  const s = app.state!;
  const own = a.owner === s.playerId;
  const head = `<h3><span class="dot" style="background:var(--c-${a.owner})"></span>${esc(a.name)} <small>${t(`faction.${a.owner}`)}</small></h3>`;
  if (!own) {
    return `<section class="block army">${head}
      <div class="row"><span>${t('army.men')}</span><b>${armyMen(a)}</b></div>
      <ul class="squads">${a.squads.map(q => squadRow(q)).join('')}</ul></section>`;
  }
  const found = canFoundCity(s, a);
  const canSplit = a.squads.length > 1;
  const squads = a.squads.map((q, i) =>
    squadRow(q, canSplit ? `<button class="mini" data-act="army:split" data-arg="${a.id}|${i}" title="${t('army.split')}">⇲</button>` : '')).join('');
  return `<section class="block army">${head}
    <div class="row"><span>${t('army.men')}</span><b>${armyMen(a)} · ${a.squads.length}/6 ${t('army.squads')}</b></div>
    <div class="row"><span>${t('army.morale')}</span>${bar(a.morale, a.morale < 40 ? 'bad' : '')}<b>${a.morale}</b></div>
    <div class="row"><span>${t('army.supply')}</span>${bar(a.supply, a.supply < 40 ? 'bad' : 'blue')}<b>${a.supply}</b></div>
    <div class="row"><span>${t('army.moves')}</span><b>${fmtMoves(a.moves)} / ${maxMoves(s, a)}</b></div>
    <div class="row"><span>${t('army.xp')}</span>${bar(a.xp, 'gold')}<b>${Math.round(a.xp)}</b></div>
    <ul class="squads">${squads}</ul>
    ${a.moves > 0 ? `<p class="hint">${t('army.hint')}</p>` : `<p class="hint">${t('army.noMoves')}</p>`}
    <div class="actions">
      ${a.goto !== null ? btn(t('army.cancelMarch'), 'army:stop', { arg: a.id }) : ''}
      ${found.ok || s.tiles[a.tile].owner === s.playerId && !s.tiles[a.tile].cityId
        ? `${btn(`${t('army.found')} ${costHtml(FOUND_CITY_COST, s.factions[s.playerId].res)}`, 'army:found', { arg: a.id, disabled: !found.ok, title: found.reason })}
           ${found.ok ? '' : `<small class="why">${esc(found.reason ?? '')}</small>`}` : ''}
    </div></section>`;
}

actions['army:found'] = (app, [id]) => {
  const s = app.state!;
  const a = armyById(s, id);
  if (!a) return;
  const res = foundCity(s, a);
  if (res.ok) { app.audio.play('build'); app.mapScene?.pulse(a.tile, 0xffd866); } else { app.audio.play('error'); app.ui.toast(res.reason ?? ''); }
  app.changed();
};
actions['army:stop'] = (app, [id]) => {
  const a = armyById(app.state!, id);
  if (a) a.goto = null;
  app.changed();
};
actions['army:split'] = (app, [id, index]) => {
  const s = app.state!;
  const a = armyById(s, id);
  if (!a) return;
  if (splitArmy(s, a, Number(index), tile => createArmy(s, a.owner, tile, []))) app.audio.play('move');
  else { app.audio.play('error'); app.ui.toast(t('army.splitFail')); }
  app.changed();
};
