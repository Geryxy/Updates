import type { GameApp } from '../app/GameApp';
import { BUILDING_IDS } from '../data/buildings';
import { canBuild, slotsOf } from '../game/CitySystem';
import { computeIncome } from '../game/EconomySystem';
import { GameState, armiesOf, citiesOf } from '../game/GameState';
import { availableTechs } from '../game/ResearchSystem';
import { t } from '../i18n';

export interface Task { text: string; act: string; arg?: string; urgent?: boolean }

/** Az aktuális teendők a tényleges játékállapotból levezetve. */
export function computeTasks(app: GameApp): Task[] {
  const s = app.state!;
  const me = s.playerId;
  const out: Task[] = [];
  if (s.pendingEvent) out.push({ text: t('task.event'), act: 'open', arg: 'event', urgent: true });
  if (s.proposals.length) out.push({ text: t('task.proposal'), act: 'open', arg: 'proposal', urgent: true });
  const inc = computeIncome(s, me);
  if (inc.net.food < 0) out.push({ text: t('task.food', { n: inc.net.food }), act: 'open', arg: 'economy', urgent: s.factions[me].res.food + inc.net.food * 3 < 0 });
  if (inc.net.gold < 0) out.push({ text: t('task.gold', { n: inc.net.gold }), act: 'open', arg: 'economy' });
  if (!s.factions[me].research && availableTechs(s, me).length) out.push({ text: t('task.research'), act: 'open', arg: 'research' });
  for (const c of citiesOf(s, me)) {
    if (!c.build && c.buildings.length < slotsOf(s, c) && BUILDING_IDS.some(b => canBuild(s, c, b).ok))
      out.push({ text: t('task.build', { city: c.name }), act: 'city', arg: `${c.id}|build` });
    if (c.happiness < 35) out.push({ text: t('task.unhappy', { city: c.name }), act: 'focus', arg: String(c.tile), urgent: true });
  }
  for (const a of armiesOf(s, me)) {
    if (a.supply < 40) out.push({ text: t('task.supply', { army: a.name }), act: 'focus', arg: String(a.tile), urgent: true });
    else if (a.moves > 0 && a.goto === null && !s.tiles[a.tile].cityId) out.push({ text: t('task.idle', { army: a.name }), act: 'focus', arg: String(a.tile) });
  }
  return out;
}

export const TUTORIAL_STEPS = 6;

/** Az oktatómód hat küldetése: a feltételek a játékos tényleges műveleteit figyelik. */
export function tutorialDone(s: GameState, step: number): boolean {
  const f = s.tutorial?.flags ?? {};
  switch (step) {
    case 0: return !!f.capital && !!f.camera;
    case 1: return !!f.economy;
    case 2: return !!f.built;
    case 3: return !!f.moved;
    case 4: return !!f.fought;
    case 5: return !!f.diplo;
    default: return true;
  }
}

/** Előrelépteti az oktatómódot; igaz, ha új küldetés kezdődött. */
export function advanceTutorial(s: GameState): boolean {
  const tut = s.tutorial;
  if (!tut) return false;
  let advanced = false;
  while (tut.step < TUTORIAL_STEPS && tutorialDone(s, tut.step)) { tut.step++; advanced = true; }
  return advanced;
}
