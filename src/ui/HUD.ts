import type { GameApp } from '../app/GameApp';
import { computeIncome } from '../game/EconomySystem';
import { MAX_TURNS, RES_KEYS } from '../game/GameState';
import { seasonOf, yearOf } from '../game/SeasonSystem';
import { t } from '../i18n';
import { emblemUrl } from '../render/TextureFactory';
import { ICON, esc, fmt, resIcon, signed } from './dom';
import { actions } from './registry';
import { TUTORIAL_STEPS, computeTasks } from './Tasks';

const SEASON_GLYPH = { spring: '✿', summer: '☀', autumn: '❦', winter: '❄' } as const;

/** Felső sáv: erőforrások (készlet és körönkénti változás), évszak, kör, frakció. */
export function renderTop(app: GameApp): string {
  const s = app.state!;
  const f = s.factions[s.playerId];
  const inc = computeIncome(s, s.playerId);
  const season = seasonOf(s.turn);
  const res = RES_KEYS.map(k => {
    const net = inc.net[k];
    return `<button class="res" data-act="open" data-arg="economy" title="${t(`res.${k}`)}: ${fmt(f.res[k])} (${signed(net)} ${t('ui.perTurn')})">
      ${resIcon(k)}<b>${fmt(f.res[k])}</b><small class="${net < 0 ? 'neg' : 'pos'}">${signed(net)}</small></button>`;
  }).join('');
  return `<div class="res-row">${res}</div>
    <div class="meta">
      <button class="chip season-${season}" data-act="open" data-arg="season" title="${t(`season.${season}.fx`)}">${SEASON_GLYPH[season]} ${t(`season.${season}`)} · ${t('ui.year', { n: yearOf(s.turn) })}</button>
      <span class="chip">${t('ui.turn', { n: Math.min(s.turn, MAX_TURNS), max: MAX_TURNS })}</span>
      <span class="chip fac"><img src="${emblemUrl(s.playerId)}" alt="">${t(`faction.${s.playerId}`)}</span>
    </div>`;
}

/** Alsó sáv: eseménynapló, aktuális feladatok, gyorsgombok és a kör befejezése. */
export function renderBottom(app: GameApp): string {
  const s = app.state!;
  const last = s.log[s.log.length - 1];
  const tasks = computeTasks(app);
  const tut = s.tutorial;
  let taskHtml: string;
  if (tut && tut.step < TUTORIAL_STEPS) {
    taskHtml = `<button class="task tut" data-act="open" data-arg="tutorial"><b>${t('tut.label', { n: tut.step + 1, max: TUTORIAL_STEPS })}</b> ${t(`tut.${tut.step}.short`)}</button>`;
  } else {
    const top = tasks[0];
    taskHtml = top
      ? `<button class="task${top.urgent ? ' urgent' : ''}" data-act="${top.act}" data-arg="${esc(top.arg ?? '')}">${esc(top.text)}</button>`
      : `<span class="task done">${t('task.none')}</span>`;
  }
  const tool = (key: keyof typeof ICON, act: string, arg: string, label: string, hot: string, on = false) =>
    `<button class="tool${on ? ' on' : ''}" data-act="${act}" data-arg="${arg}" title="${label} (${hot})">${ICON[key]}<span>${label}</span></button>`;
  return `<div class="info">
      <button class="log-line k-${last?.kind ?? 'info'}" data-act="open" data-arg="log" title="${t('ui.log')}">${last ? esc(last.text) : ''}</button>
      <div class="task-row">${taskHtml}<button class="task-count" data-act="open" data-arg="tasks" title="${t('ui.tasks')}">${ICON.tasks}<b>${tasks.length}</b></button></div>
    </div>
    <div class="tools">
      ${tool('diplomacy', 'open', 'diplomacy', t('ui.diplomacy'), 'D')}
      ${tool('research', 'open', 'research', t('ui.research'), 'K')}
      ${tool('economy', 'open', 'economy', t('ui.economy'), 'G')}
      ${tool('supply', 'supply', '', t('ui.supplyView'), 'U', app.supplyView)}
      ${tool('next', 'nextArmy', '', t('ui.nextArmy'), 'N')}
      ${tool('menu', 'open', 'gamemenu', t('ui.menu'), 'Esc')}
    </div>
    <div class="zoom">
      <button class="tool" data-act="zoom" data-arg="in" title="${t('ui.zoomIn')} (+)">${ICON.plus}</button>
      <button class="tool" data-act="zoom" data-arg="out" title="${t('ui.zoomOut')} (−)">${ICON.minus}</button>
      <button class="tool" data-act="home" title="${t('ui.home')} (C)">${ICON.home}</button>
    </div>
    <button class="end-turn" data-act="endTurn"${s.outcome ? ' disabled' : ''} title="Enter">${ICON.hourglass}<span>${t('ui.endTurn')}</span></button>`;
}

actions.endTurn = app => app.endTurn();
actions.supply = app => app.toggleSupply();
actions.nextArmy = app => app.nextArmy();
actions.zoom = (app, [dir]) => app.mapScene?.zoomBy(dir === 'in' ? 1.25 : 0.8);
actions.focus = (app, [tile]) => { app.ui.closeModal(); app.focus(Number(tile)); };
actions.home = app => {
  const s = app.state!;
  const cap = s.cities.find(c => c.capitalOf === s.playerId && c.owner === s.playerId) ?? s.cities.find(c => c.owner === s.playerId);
  const army = s.armies.find(a => a.owner === s.playerId);
  const tile = cap?.tile ?? army?.tile;
  if (tile !== undefined) app.focus(tile);
};
