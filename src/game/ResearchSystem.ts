import { mods } from '../data/factions';
import { TECHS, TECH_IDS } from '../data/technologies';
import { FactionId, GameState, TechId, addLog } from './GameState';
import { t } from '../i18n';

export function techCost(fid: FactionId, id: TechId): number {
  const def = TECHS[id];
  return Math.round(def.cost * (def.branch === 'military' ? mods(fid).milTechMult : 1));
}

export function techAvailable(s: GameState, fid: FactionId, id: TechId): boolean {
  const f = s.factions[fid];
  return !f.techs.includes(id) && TECHS[id].requires.every(r => f.techs.includes(r));
}

export const availableTechs = (s: GameState, fid: FactionId) => TECH_IDS.filter(id => techAvailable(s, fid, id));

/** Egyszerre egy kutatás folyhat; váltáskor az addigi haladás elvész. */
export function startResearch(s: GameState, fid: FactionId, id: TechId): boolean {
  if (!techAvailable(s, fid, id)) return false;
  const f = s.factions[fid];
  if (f.research?.id === id) return false;
  f.research = { id, progress: 0 };
  return true;
}

export function tickResearch(s: GameState, fid: FactionId, points: number) {
  const f = s.factions[fid];
  if (!f.research) return;
  f.research.progress += points;
  if (f.research.progress >= techCost(fid, f.research.id)) {
    f.techs.push(f.research.id);
    if (f.isPlayer) addLog(s, t('log.researched', { name: t(`tech.${f.research.id}`) }), 'good');
    f.research = null;
  }
}
