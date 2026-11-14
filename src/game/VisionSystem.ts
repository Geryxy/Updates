import { mods } from '../data/factions';
import { UNITS } from '../data/units';
import { neighbors, tilesWithin } from '../world/HexMap';
import { Army, FactionId, GameState, hasTech } from './GameState';

export function armyVision(s: GameState, a: Army): number {
  let v = Math.max(...a.squads.map(q => UNITS[q.type].vision), 1) + mods(a.owner).vision;
  if (hasTech(s, a.owner, 'cartography')) v += 1;
  if (hasTech(s, a.owner, 'scouting') && a.squads.some(q => q.type === 'scout')) v += 1;
  return v;
}

/** A frakció által éppen belátott mezők. */
export function computeVisible(s: GameState, fid: FactionId): boolean[] {
  const vis = new Array<boolean>(s.tiles.length).fill(false);
  s.tiles.forEach((tile, i) => {
    if (tile.owner !== fid) return;
    vis[i] = true;
    for (const n of neighbors(i, s.width, s.height)) vis[n] = true;
  });
  for (const c of s.cities) if (c.owner === fid) {
    const r = 2 + (c.buildings.includes('tower') ? 1 : 0) + mods(fid).vision;
    for (const i of tilesWithin(c.tile, r, s.width)) vis[i] = true;
  }
  for (const a of s.armies) if (a.owner === fid) for (const i of tilesWithin(a.tile, armyVision(s, a), s.width)) vis[i] = true;
  return vis;
}

export function updateExplored(s: GameState): boolean[] {
  const vis = computeVisible(s, s.playerId);
  vis.forEach((v, i) => { if (v) s.explored[i] = true; });
  return vis;
}
