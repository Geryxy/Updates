import { TECHS, TECH_IDS } from '../data/technologies';
import { computeIncome } from '../game/EconomySystem';
import { TechId } from '../game/GameState';
import { startResearch, techAvailable, techCost } from '../game/ResearchSystem';
import { t } from '../i18n';
import { bar, btn } from './dom';
import { actions, modals } from './registry';

const BRANCHES = ['economy', 'military', 'science'] as const;

/** Kutatási fa három ággal; egyszerre egy kutatás folyhat. */
modals.research = {
  wide: true,
  render(app) {
    const s = app.state!;
    const me = s.playerId;
    const f = s.factions[me];
    const rate = Math.max(1, computeIncome(s, me).research);
    const cols = BRANCHES.map(branch => {
      const cards = TECH_IDS.filter(id => TECHS[id].branch === branch).map(id => {
        const cost = techCost(me, id);
        const done = f.techs.includes(id);
        const active = f.research?.id === id;
        const avail = techAvailable(s, me, id);
        let status: string;
        if (done) status = `<span class="tag ok">✓ ${t('res.done')}</span>`;
        else if (active) status = `${bar(100 * f.research!.progress / cost, 'gold')}<small>${Math.floor(f.research!.progress)} / ${cost} · ${t('ui.turnsLeft', { n: Math.max(1, Math.ceil((cost - f.research!.progress) / rate)) })}</small>`;
        else if (avail) status = `<small>${t('res.cost', { n: cost })} · ${t('ui.turns', { n: Math.ceil(cost / rate) })}</small>${btn(t('res.start'), 'research:start', { arg: id, cls: 'primary small' })}`;
        else status = `<small class="why">${t('res.requires', { name: TECHS[id].requires.map(r => t(`tech.${r}`)).join(', ') })}</small>`;
        return `<div class="tech${done ? ' done' : active ? ' active' : avail ? '' : ' locked'}"><b>${t(`tech.${id}`)}</b><small>${t(`tech.${id}.desc`)}</small>${status}</div>`;
      }).join('');
      return `<div class="branch"><h3>${t(`branch.${branch}`)}</h3>${cards}</div>`;
    }).join('');
    return `<h2>${t('ui.research')}</h2>
      <p class="hint">${t('res.rate', { n: rate })} ${f.research ? t('res.current', { name: t(`tech.${f.research.id}`) }) : t('res.none')}</p>
      <div class="branches">${cols}</div>`;
  },
};

actions['research:start'] = (app, [id]) => {
  if (startResearch(app.state!, app.state!.playerId, id as TechId)) app.audio.play('coin');
  app.changed();
};
