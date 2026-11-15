import type { GameApp } from '../app/GameApp';
import { EventEffect } from '../data/events';
import { BattlePreview } from '../game/CombatSystem';
import { respondProposal } from '../game/DiplomacySystem';
import { computeIncome } from '../game/EconomySystem';
import { choiceAffordable, eventDef, resolvePlayerEvent } from '../game/EventSystem';
import { BattleReport, BattleSide, OwnerId, PowerPart, RES_KEYS, Squad, armyMen, citiesOf, tilesOf } from '../game/GameState';
import { SEASONS, seasonOf } from '../game/SeasonSystem';
import { capitalsHeld, territoryGoal } from '../game/VictorySystem';
import { t } from '../i18n';
import { emblemUrl } from '../render/TextureFactory';
import { squadRow } from './ArmyPanel';
import { btn, esc, gainHtml, pct, resIcon, signed } from './dom';
import { actions, modals } from './registry';
import { TUTORIAL_STEPS, computeTasks } from './Tasks';

const partsHtml = (parts: PowerPart[]) => `<ul class="parts">${parts.map((p, i) =>
  `<li><span>${esc(p.label)}</span><b>${i === 0 ? p.mult.toFixed(1) : `×${p.mult.toFixed(2)}`}</b></li>`).join('')}</ul>`;
const squadsHtml = (sq: Squad[], owner: OwnerId) => `<ul class="squads">${sq.map(q => squadRow(q, owner)).join('') || `<li class="muted">–</li>`}</ul>`;

// ---------- Csata előtti képernyő ----------
modals.battle = {
  wide: true,
  render(app, data) {
    const tile = Number(data.tile);
    const army = app.activeArmyObj();
    const pv: BattlePreview | null = app.battlePreview(tile);
    if (!army || !pv) return `<h2>${t('battle.gone')}</h2>`;
    const side = (title: string, name: string, owner: OwnerId, sq: Squad[], power: number, parts: PowerPart[], loss: number) =>
      `<div class="side-col"><h3><img src="${emblemUrl(owner)}" alt="">${title}</h3><b>${esc(name)}</b>
        ${squadsHtml(sq, owner)}<div class="power">${t('battle.power')}: <b>${power.toFixed(1)}</b></div>${partsHtml(parts)}
        <div class="row"><span>${t('battle.estLoss')}</span><b class="neg">~${loss} ${t('battle.men')}</b></div></div>`;
    return `<h2>${t('battle.title')}</h2>
      <div class="versus">
        ${side(t('battle.attacker'), army.name, army.owner, army.squads, pv.attacker.power, pv.attacker.parts, pv.lossA)}
        ${side(t('battle.defender'), pv.defenderArmy.name, pv.defenderArmy.owner, pv.defenderArmy.squads, pv.defender.power, pv.defender.parts, pv.lossD)}
      </div>
      <div class="chance risk-${pv.risk}"><span>${t('battle.chance')}</span><b>${pct(pv.winChance)}</b><span>${t(`battle.risk.${pv.risk}`)}</span></div>
      <p class="hint">${t('battle.note')}</p>
      <div class="actions">${btn(t('army.attack'), 'attack:go', { arg: String(tile), cls: 'danger' })}${btn(t('ui.cancel'), 'modal:close')}</div>`;
  },
};
actions.attack = (app, [tile]) => app.ui.openModal('battle', { tile: Number(tile) });
actions['attack:go'] = (app, [tile]) => { app.ui.closeModal(); app.move(Number(tile)); };
actions.march = (app, [tile]) => app.move(Number(tile));

// ---------- Csatajelentés ----------
modals.report = {
  wide: true,
  locked: true,
  render(app, data) {
    const r = data.report as BattleReport;
    const me = app.state!.playerId;
    const iWon = (r.winner === 'attacker' ? r.attacker.owner : r.defender.owner) === me;
    const side = (title: string, sd: BattleSide) =>
      `<div class="side-col"><h3><img src="${emblemUrl(sd.owner)}" alt="">${title}</h3><b>${esc(sd.name)}</b> <small>${t(`faction.${sd.owner}`)}</small>
        <div class="row"><span>${t('battle.before')}</span><b>${armyMen({ squads: sd.before })}</b></div>${squadsHtml(sd.before, sd.owner)}
        <div class="row"><span>${t('battle.after')}</span><b>${armyMen({ squads: sd.after })}</b></div>${squadsHtml(sd.after, sd.owner)}
        <div class="row"><span>${t('battle.losses')}</span><b class="neg">−${sd.losses}</b></div>
        <div class="row"><span>${t('battle.fateLabel')}</span><b>${t(`battle.fate.${sd.fate}`)}</b></div>
        <div class="power">${t('battle.power')}: <b>${sd.power.toFixed(1)}</b></div>${partsHtml(sd.parts)}</div>`;
    return `<h2 class="${iWon ? 'win' : 'lose'}">${t(iWon ? 'battle.won' : 'battle.lost')}</h2>
      <p class="hint">${t('battle.reportLine', { turn: r.turn, roll: `×${r.roll.toFixed(2)}` })}</p>
      ${r.cityCaptured ? `<p class="banner">${t('battle.cityCaptured', { city: esc(r.cityCaptured) })}</p>` : ''}
      <div class="versus">${side(t('battle.attacker'), r.attacker)}${side(t('battle.defender'), r.defender)}</div>
      <div class="actions">${btn(t('ui.ok'), 'modal:close', { cls: 'primary' })}</div>`;
  },
};

// ---------- Események ----------
function effectHtml(e: EventEffect): string {
  const bits: string[] = [];
  if (e.res) bits.push(gainHtml(e.res));
  if (e.happy) bits.push(`<span class="${e.happy < 0 ? 'neg' : 'pos'}">${t('fx.happy')} ${signed(e.happy)}</span>`);
  if (e.popPct) bits.push(`<span class="neg">${t('fx.pop')} ${e.popPct}%</span>`);
  if (e.morale) bits.push(`<span class="${e.morale < 0 ? 'neg' : 'pos'}">${t('fx.morale')} ${signed(e.morale)}</span>`);
  if (e.research) bits.push(`<span class="pos">${t('fx.research')} +${e.research}</span>`);
  if (e.relTarget) bits.push(`<span class="${e.relTarget < 0 ? 'neg' : 'pos'}">${t('fx.rel')} ${signed(e.relTarget)}</span>`);
  if (e.relOther) bits.push(`<span class="neg">${t('fx.relOther')} ${signed(e.relOther)}</span>`);
  if (e.deposit) bits.push(`<span class="pos">${resIcon('iron')} ${t('fx.deposit')}</span>`);
  if (e.mercs) bits.push(`<span class="pos">${t('fx.mercs')}</span>`);
  return bits.join(' ') || `<span class="muted">${t('fx.none')}</span>`;
}

modals.event = {
  locked: true,
  render(app) {
    const s = app.state!;
    const pe = s.pendingEvent;
    const def = pe && eventDef(pe.id);
    if (!pe || !def) return `<h2>${t('ui.nothing')}</h2><div class="actions">${btn(t('ui.ok'), 'modal:close')}</div>`;
    const names = { target: pe.target ? t(`faction.${pe.target}`) : '', other: pe.other ? t(`faction.${pe.other}`) : '' };
    const choices = def.choices.map((eff, i) => {
      if (eff.relOther && !pe.other) return '';
      const ok = choiceAffordable(s, s.playerId, eff);
      return `<button class="choice" data-act="event:choose" data-arg="${i}"${ok ? '' : ' disabled'}>
        <b>${String.fromCharCode(65 + i)}) ${t(`event.${def.id}.c${i}`, names)}</b><small>${effectHtml(eff)}</small>${ok ? '' : `<small class="why">${t('err.noResources')}</small>`}</button>`;
    }).join('');
    return `<h2>${t(`event.${def.id}.title`)}</h2><p class="story">${t(`event.${def.id}.text`, names)}</p><div class="choices">${choices}</div>`;
  },
};
actions['event:choose'] = (app, [i]) => {
  if (resolvePlayerEvent(app.state!, Number(i))) { app.audio.play('coin'); app.ui.closeModal(); }
  app.changed();
};

// ---------- AI-ajánlatok ----------
modals.proposal = {
  locked: true,
  render(app) {
    const p = app.state!.proposals[0];
    if (!p) return `<h2>${t('ui.nothing')}</h2><div class="actions">${btn(t('ui.ok'), 'modal:close')}</div>`;
    return `<h2><img class="emb" src="${emblemUrl(p.from)}" alt=""> ${t('prop.title', { faction: t(`faction.${p.from}`) })}</h2>
      <p class="story">${t(`prop.${p.kind}`, { faction: t(`faction.${p.from}`) })}</p>
      <div class="actions">${btn(t('prop.accept'), 'prop:answer', { arg: 'yes', cls: 'primary' })}${btn(t('prop.reject'), 'prop:answer', { arg: 'no' })}</div>`;
  },
};
actions['prop:answer'] = (app, [ans]) => {
  respondProposal(app.state!, 0, ans === 'yes');
  app.audio.play(ans === 'yes' ? 'coin' : 'click');
  app.flag('diplo');
  if (!app.state!.proposals.length) app.ui.closeModal();
  app.changed();
};

// ---------- Gazdaság ----------
modals.economy = {
  wide: true,
  render(app) {
    const s = app.state!;
    const me = s.playerId;
    const inc = computeIncome(s, me);
    const f = s.factions[me];
    const cell = (v: number | undefined) => { const n = Math.round((v ?? 0) * 10) / 10; return `<td class="${n < 0 ? 'neg' : n > 0 ? 'pos' : 'muted'}">${n ? signed(n) : '–'}</td>`; };
    const rows = inc.lines.filter(l => RES_KEYS.some(k => Math.abs(l.res[k] ?? 0) >= 0.05))
      .map(l => `<tr><th>${t(l.key)}</th>${RES_KEYS.map(k => cell(l.res[k])).join('')}</tr>`).join('');
    const mods = f.modifiers.map(m => `<li>${t(`mod.${m.id}`)} – ${t('ui.turnsLeft', { n: m.turns })}</li>`).join('');
    const season = seasonOf(s.turn);
    return `<h2>${t('ui.economy')}</h2>
      <div class="table-wrap"><table class="eco"><thead><tr><th></th>${RES_KEYS.map(k => `<th>${resIcon(k)}<span>${t(`res.${k}`)}</span></th>`).join('')}</tr></thead>
        <tbody>${rows}<tr class="sum"><th>${t('eco.net')}</th>${RES_KEYS.map(k => cell(inc.net[k])).join('')}</tr>
        <tr><th>${t('eco.stock')}</th>${RES_KEYS.map(k => `<td>${Math.floor(f.res[k])}</td>`).join('')}</tr></tbody></table></div>
      <p class="hint">${t('eco.research', { n: inc.research })} · ${t('eco.lands', { n: tilesOf(s, me), goal: territoryGoal(s) })} · ${t('eco.cities', { n: citiesOf(s, me).length })} · ${t('eco.capitals', { n: capitalsHeld(s, me) })}</p>
      <h3>${t(`season.${season}`)}</h3><p class="hint">${t(`season.${season}.fx`)}</p>
      ${mods ? `<h3>${t('eco.modifiers')}</h3><ul class="help">${mods}</ul>` : ''}
      <div class="actions">${btn(t('ui.ok'), 'modal:close', { cls: 'primary' })}</div>`;
  },
};

modals.season = {
  render(app) {
    const cur = seasonOf(app.state!.turn);
    return `<h2>${t('ui.seasons')}</h2>${SEASONS.map(se => `<div class="item${se === cur ? ' current' : ''}"><div><b>${t(`season.${se}`)}${se === cur ? ` – ${t('ui.now')}` : ''}</b><small>${t(`season.${se}.fx`)}</small></div></div>`).join('')}
      <p class="hint">${t('ui.seasonHint')}</p><div class="actions">${btn(t('ui.ok'), 'modal:close', { cls: 'primary' })}</div>`;
  },
};

// ---------- Napló és feladatok ----------
modals.log = {
  render(app) {
    const items = [...app.state!.log].reverse().map(l => `<li class="k-${l.kind}"><small>${t('ui.turnShort', { n: l.turn })}</small> ${esc(l.text)}</li>`).join('');
    return `<h2>${t('ui.log')}</h2><ul class="log">${items}</ul>`;
  },
};
modals.tasks = {
  render(app) {
    const tasks = computeTasks(app);
    const items = tasks.map(k => `<button class="task${k.urgent ? ' urgent' : ''}" data-act="${k.act}" data-arg="${esc(k.arg ?? '')}">${esc(k.text)}</button>`).join('');
    return `<h2>${t('ui.tasks')}</h2><div class="task-list">${items || `<p class="hint">${t('task.none')}</p>`}</div>`;
  },
};
modals.tutorial = {
  render(app) {
    const tut = app.state!.tutorial;
    if (!tut) return '';
    const done = tut.step >= TUTORIAL_STEPS;
    const list = Array.from({ length: TUTORIAL_STEPS }, (_x, i) =>
      `<li class="${i < tut.step ? 'done' : i === tut.step ? 'current' : ''}"><b>${i + 1}. ${t(`tut.${i}.title`)}</b>${i === tut.step ? `<p>${t(`tut.${i}.text`)}</p>` : ''}</li>`).join('');
    return `<h2>${t('ui.tutorial')}</h2>${done ? `<p class="banner">${t('tut.done')}</p>` : ''}<ol class="tut-list">${list}</ol>
      <div class="actions">${btn(t('ui.ok'), 'modal:close', { cls: 'primary' })}</div>`;
  },
};

// ---------- Megerősítés ----------
modals.confirm = {
  render: (_app, d) => `<h2>${esc(d.title)}</h2><p class="story">${esc(d.text)}</p>
    <div class="actions">${btn(esc(d.yes), String(d.act), { arg: String(d.arg ?? ''), cls: 'danger' })}${btn(t('ui.cancel'), d.back ? 'open' : 'modal:close', { arg: String(d.back ?? '') })}</div>`,
};

// ---------- Játék vége ----------
modals.end = {
  wide: true,
  locked: true,
  render(app) {
    const s = app.state!;
    const o = s.outcome!;
    const won = o.winner === s.playerId;
    const keys = ['territory', 'cities', 'economy', 'military', 'diplomacy'];
    const rows = o.scores.map((sc, i) => `<tr class="${sc.id === s.playerId ? 'me' : ''}"><th>${i + 1}. <img class="ico" src="${emblemUrl(sc.id)}" alt=""> ${t(`faction.${sc.id}`)}</th>
      ${keys.map(k => `<td>${sc.parts[k]}</td>`).join('')}<td><b>${sc.total}</b></td></tr>`).join('');
    return `<h2 class="${won ? 'win' : 'lose'}">${t(won ? 'end.victory' : o.type === 'score' ? 'end.score' : 'end.defeat')}</h2>
      <p class="story">${esc(o.reason)}</p>
      <div class="table-wrap"><table class="eco"><thead><tr><th></th>${keys.map(k => `<th>${t(`score.${k}`)}</th>`).join('')}<th>${t('score.total')}</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="actions">${btn(t('end.toMenu'), 'game:quit', { cls: 'primary' })}${btn(t('end.viewMap'), 'modal:close')}</div>`;
  },
};

export function playOutcomeSound(app: GameApp) {
  const o = app.state?.outcome;
  if (o) app.audio.play(o.winner === app.state!.playerId ? 'victory' : 'defeat');
}
