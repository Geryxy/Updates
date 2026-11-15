import {
  CancelKind, Evaluation, GIFT_GOLD, cancelTreaty, declareWar, evaluateProposal, militaryPower, others, playerPropose, sendGift,
} from '../game/DiplomacySystem';
import { FACTION_IDS, FactionId, ProposalKind, getPair, tilesOf } from '../game/GameState';
import { t } from '../i18n';
import { emblemUrl } from '../render/TextureFactory';
import { btn, esc, resIcon, signed } from './dom';
import { actions, modals } from './registry';

function evalHtml(ev: Evaluation | undefined, accepted: boolean | undefined): string {
  if (!ev) return '';
  if (ev.blocked) return `<div class="eval no"><b>${esc(ev.blocked)}</b></div>`;
  const rows = ev.reasons.map(r => `<li><span>${esc(r.label)}</span><b class="${r.value < 0 ? 'neg' : 'pos'}">${signed(r.value)}</b></li>`).join('');
  return `<div class="eval ${accepted ? 'yes' : 'no'}"><b>${accepted ? t('dip.accepted') : t('dip.refused')}</b>
    <ul>${rows}<li class="sum"><span>${t('dip.total', { need: ev.threshold })}</span><b>${ev.score}</b></li></ul></div>`;
}

/** Diplomáciai felület: kapcsolatok, szerződések és a nyolc diplomáciai lehetőség. */
modals.diplomacy = {
  wide: true,
  render(app, data) {
    const s = app.state!;
    const me = s.playerId;
    const myPower = Math.round(militaryPower(s, me));
    const last = data.last as { to: FactionId; ev: Evaluation; accepted: boolean } | undefined;
    const cards = FACTION_IDS.filter(f => f !== me).map(f => {
      const fs = s.factions[f];
      const head = `<header><img src="${emblemUrl(f)}" alt=""><div><b>${t(`faction.${f}`)}</b><small>${t(`personality.${fs.personality}`)} · ${t(`faction.${f}.motto`)}</small></div></header>`;
      if (!fs.alive) return `<article class="dip dead">${head}<p class="hint">${t('dip.dead')}</p></article>`;
      const p = getPair(s, me, f);
      const tags = [
        p.war ? `<span class="tag war">${t('dip.tag.war')}</span>` : '',
        p.alliance ? `<span class="tag ok">${t('dip.tag.alliance')}</span>` : '',
        p.trade ? `<span class="tag gold">${t('dip.tag.trade')}</span>` : '',
        p.nap > 0 ? `<span class="tag">${t('dip.tag.nap', { n: p.nap })}</span>` : '',
        p.truce > 0 ? `<span class="tag">${t('dip.tag.truce', { n: p.truce })}</span>` : '',
        !p.war && !p.alliance && !p.trade && p.nap === 0 ? `<span class="tag">${t('dip.tag.peace')}</span>` : '',
      ].join('');
      const offer = (kind: ProposalKind, target?: FactionId) => {
        const ev = evaluateProposal(s, me, f, kind, target);
        if (ev.blocked) return '';
        const label = kind === 'jointwar' ? t('dip.jointwar', { target: t(`faction.${target}`) }) : t(`dip.kind.${kind}`);
        return btn(`${label}<small class="${ev.accept ? 'pos' : 'neg'}">${ev.accept ? t('dip.likely') : t('dip.unlikely')} (${ev.score}/${ev.threshold})</small>`,
          'dip:propose', { arg: `${f}|${kind}|${target ?? ''}`, cls: 'stack' });
      };
      const joint = others(s, me).filter(x => x !== f && getPair(s, me, x).war).map(x => offer('jointwar', x)).join('');
      const buttons = [
        offer('trade'), offer('nap'), offer('alliance'), joint, offer('peace'),
        !p.war ? btn(`${t('dip.gift')} ${resIcon('gold')}${GIFT_GOLD}`, 'dip:gift', { arg: f, disabled: s.factions[me].res.gold < GIFT_GOLD, title: t('dip.giftHint') }) : '',
        !p.war ? btn(t(p.nap > 0 || p.alliance || p.truce > 0 ? 'dip.warBreak' : 'dip.war'), 'dip:war', { arg: f, cls: 'danger' }) : '',
        p.trade ? btn(t('dip.cancel.trade'), 'dip:cancel', { arg: `${f}|trade` }) : '',
        p.nap > 0 ? btn(t('dip.cancel.nap'), 'dip:cancel', { arg: `${f}|nap` }) : '',
        p.alliance ? btn(t('dip.cancel.alliance'), 'dip:cancel', { arg: `${f}|alliance` }) : '',
      ].join('');
      const rel = Math.round(p.rel);
      return `<article class="dip">${head}
        <div class="rel"><span>${t('dip.relation')}</span><span class="relbar"><i style="left:${(rel + 100) / 2}%"></i></span><b class="${rel < 0 ? 'neg' : 'pos'}">${signed(rel)}</b></div>
        <div class="tags">${tags}</div>
        <div class="row"><span>${t('dip.power')}</span><b>${Math.round(militaryPower(s, f))} <small>(${t('dip.you')}: ${myPower})</small></b></div>
        <div class="row"><span>${t('dip.lands')}</span><b>${tilesOf(s, f)} <small>(${t('dip.you')}: ${tilesOf(s, me)})</small></b></div>
        <div class="actions">${buttons}</div>
        ${last && last.to === f ? evalHtml(last.ev, last.accepted) : ''}</article>`;
    }).join('');
    return `<h2>${t('ui.diplomacy')}</h2><p class="hint">${t('dip.hint')}</p><div class="dips">${cards}</div>`;
  },
};

actions['dip:propose'] = (app, [to, kind, target]) => {
  const ev = playerPropose(app.state!, to as FactionId, kind as ProposalKind, (target || undefined) as FactionId | undefined);
  const accepted = ev.accept && !ev.blocked;
  app.audio.play(accepted ? 'coin' : 'error');
  app.flag('diplo');
  app.ui.openModal('diplomacy', { last: { to, ev, accepted } });
  app.changed();
};
actions['dip:gift'] = (app, [to]) => {
  if (sendGift(app.state!, app.state!.playerId, to as FactionId)) { app.audio.play('coin'); app.flag('diplo'); }
  app.changed();
};
actions['dip:war'] = (app, [to]) => app.ui.openModal('confirm', {
  title: t('dip.warTitle', { faction: t(`faction.${to}`) }), text: t('dip.warText'), yes: t('dip.war'), act: 'dip:warYes', arg: to, back: 'diplomacy',
});
actions['dip:warYes'] = (app, [to]) => {
  declareWar(app.state!, app.state!.playerId, to as FactionId);
  app.audio.play('battle');
  app.flag('diplo');
  app.ui.openModal('diplomacy', {});
  app.changed();
};
actions['dip:cancel'] = (app, [to, kind]) => {
  cancelTreaty(app.state!, app.state!.playerId, to as FactionId, kind as CancelKind);
  app.audio.play('click');
  app.changed();
};
