import type { Army, UnitType } from '../game/GameState';

const BIG: UnitType[] = ['siege', 'cavalry'];

/**
 * A sereget megjelenítő figurák: osztagonként egy, legfeljebb három; elöl a legnagyobb
 * létszámú egységtípusok, így a térképről leolvasható a sereg mérete és összetétele.
 */
export function armyFigures(a: Army): UnitType[] {
  const men = new Map<UnitType, number>();
  for (const q of a.squads) men.set(q.type, (men.get(q.type) ?? 0) + q.count);
  const types = [...men.entries()].sort((x, y) => y[1] - x[1]).map(e => e[0]);
  const out: UnitType[] = [];
  for (let i = 0; out.length < Math.min(3, a.squads.length); i++) out.push(types[i % types.length]);
  // A nagy testű egységek (ostromgép, lovas) hátra kerülnek, hogy ne takarják a gyalogosokat.
  return out.sort((x, y) => BIG.indexOf(y) - BIG.indexOf(x));
}
