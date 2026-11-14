import {
  FACTION_IDS, FactionId, GameState, MAX_TURNS, Outcome, addLog, armiesOf, armyMen, citiesOf, getPair, tilesOf,
} from './GameState';
import { computeIncome } from './EconomySystem';
import { t } from '../i18n';

export const TERRITORY_SHARE = 0.65;
export const TERRITORY_TURNS = 3;
export const CAPITALS_NEEDED = 2;

export const territoryGoal = (s: GameState) => Math.ceil(s.tiles.length * TERRITORY_SHARE);
export const capitalsHeld = (s: GameState, fid: FactionId) =>
  s.cities.filter(c => c.capitalOf && c.capitalOf !== fid && c.owner === fid).length;

export function computeScores(s: GameState): Outcome['scores'] {
  return FACTION_IDS.filter(f => s.factions[f].alive).map(id => {
    const f = s.factions[id];
    const inc = computeIncome(s, id);
    const rels = FACTION_IDS.filter(o => o !== id && s.factions[o].alive).map(o => getPair(s, id, o));
    const parts: Record<string, number> = {
      territory: tilesOf(s, id) * 10,
      cities: citiesOf(s, id).reduce((n, c) => n + c.level * 40, 0),
      economy: Math.round(Math.max(0, inc.net.gold) * 3 + Math.max(0, inc.net.food) + f.stats.goldEarned / 10),
      military: f.stats.battlesWon * 25 + f.stats.citiesCaptured * 60 + Math.round(armiesOf(s, id).reduce((n, a) => n + armyMen(a), 0) / 20),
      diplomacy: Math.round(f.stats.treaties * 30 + rels.reduce((n, p) => n + Math.max(0, p.rel) / 2 + (p.alliance ? 50 : 0), 0)),
    };
    return { id, parts, total: Object.values(parts).reduce((a, b) => a + b, 0) };
  }).sort((a, b) => b.total - a.total);
}

function eliminate(s: GameState, fid: FactionId) {
  s.factions[fid].alive = false;
  for (const tile of s.tiles) if (tile.owner === fid) tile.owner = null;
  for (const o of FACTION_IDS) if (o !== fid) {
    const p = getPair(s, fid, o);
    p.war = false; p.trade = false; p.alliance = false; p.nap = 0; p.truce = 0;
  }
  s.proposals = s.proposals.filter(p => p.from !== fid && p.target !== fid);
  addLog(s, t('log.eliminated', { faction: t(`faction.${fid}`) }), fid === s.playerId ? 'bad' : 'war');
}

/** A kör végén ellenőrzi a kiesést, a győzelmi és a vereségi feltételeket. */
export function checkVictory(s: GameState) {
  if (s.outcome) return;
  for (const fid of FACTION_IDS) {
    const f = s.factions[fid];
    if (f.alive && !citiesOf(s, fid).length && !armiesOf(s, fid).length) eliminate(s, fid);
  }
  const finish = (type: Outcome['type'], reason: string, winner: FactionId | null) => {
    s.outcome = { type, reason, winner, scores: computeScores(s) };
  };
  const player = s.playerId;
  if (!s.factions[player].alive) return finish('defeat', t('end.eliminated'), null);
  const alive = FACTION_IDS.filter(f => s.factions[f].alive);
  if (alive.length === 1) return finish('victory', t('end.lastStanding'), player);

  for (const fid of alive) {
    const f = s.factions[fid];
    f.domTurns = tilesOf(s, fid) >= territoryGoal(s) ? f.domTurns + 1 : 0;
    const name = t(`faction.${fid}`);
    if (f.domTurns >= TERRITORY_TURNS) {
      return fid === player ? finish('victory', t('end.territory'), fid) : finish('defeat', t('end.aiTerritory', { faction: name }), fid);
    }
    if (capitalsHeld(s, fid) >= CAPITALS_NEEDED) {
      return fid === player ? finish('victory', t('end.military'), fid) : finish('defeat', t('end.aiMilitary', { faction: name }), fid);
    }
  }
  if (s.turn >= MAX_TURNS) {
    const scores = computeScores(s);
    s.outcome = {
      type: 'score', winner: scores[0].id, scores,
      reason: scores[0].id === player ? t('end.scoreWin') : t('end.scoreLose', { faction: t(`faction.${scores[0].id}`) }),
    };
  }
}
