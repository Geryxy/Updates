import { mods } from '../data/factions';
import { UNITS } from '../data/units';
import { neighbors } from '../world/HexMap';
import {
  FACTION_IDS, FactionId, GameState, ProposalKind, addLog, armiesOf, citiesOf, clamp, getPair, hasTech, tilesOf,
} from './GameState';
import { t } from '../i18n';

export const GIFT_GOLD = 50;
export const NAP_TURNS = 10;
export const TRUCE_TURNS = 6;

export const others = (s: GameState, fid: FactionId) => FACTION_IDS.filter(o => o !== fid && s.factions[o].alive);
const name = (f: FactionId) => t(`faction.${f}`);
const kindOf = (s: GameState, a: FactionId, b: FactionId) => (a === s.playerId || b === s.playerId ? 'diplo' : 'info') as 'diplo' | 'info';

export function militaryPower(s: GameState, fid: FactionId): number {
  let p = 0;
  for (const a of armiesOf(s, fid)) for (const q of a.squads) p += (q.count / 100) * (UNITS[q.type].attack + UNITS[q.type].defense) / 2;
  return p;
}

export function sharesBorder(s: GameState, a: FactionId, b: FactionId): boolean {
  return s.tiles.some((tile, i) => tile.owner === a && neighbors(i, s.width, s.height).some(n => s.tiles[n].owner === b));
}

export const hasArchive = (s: GameState, fid: FactionId) => citiesOf(s, fid).some(c => c.buildings.includes('archive'));
const commonEnemy = (s: GameState, a: FactionId, b: FactionId) =>
  others(s, a).some(o => o !== b && getPair(s, a, o).war && getPair(s, b, o).war);

export interface Evaluation {
  accept: boolean;
  score: number;
  threshold: number;
  reasons: { label: string; value: number }[];
  blocked?: string;
}

/**
 * A `to` frakció (AI) mérlegeli a `from` ajánlatát. A döntés determinisztikus,
 * az indokok tételesen megjeleníthetők a diplomáciai felületen.
 */
export function evaluateProposal(s: GameState, from: FactionId, to: FactionId, kind: ProposalKind, target?: FactionId): Evaluation {
  const pair = getPair(s, from, to);
  const pers = s.factions[to].personality;
  const reasons: { label: string; value: number }[] = [];
  const add = (key: string, value: number) => { if (Math.round(value) !== 0) reasons.push({ label: t(key), value: Math.round(value) }); };
  const blocked = (key: string): Evaluation => ({ accept: false, score: 0, threshold: 0, reasons: [], blocked: t(key) });
  const myPower = militaryPower(s, from) + 1, theirPower = militaryPower(s, to) + 1;
  let threshold = 0;

  if (hasTech(s, from, 'protocol')) add('dip.r.protocol', 10);
  if (hasArchive(s, from)) add('dip.r.archive', 8);

  switch (kind) {
    case 'trade':
      if (pair.war) return blocked('dip.b.war');
      if (pair.trade) return blocked('dip.b.already');
      threshold = 10;
      add('dip.r.relation', pair.rel);
      add('dip.r.tradeGood', 15);
      add('dip.r.merchant', mods(from).tradeAccept);
      if (pers === 'trader') add('dip.r.personality', 15);
      break;
    case 'nap':
      if (pair.war) return blocked('dip.b.war');
      if (pair.nap > 0 || pair.alliance) return blocked('dip.b.already');
      threshold = 20;
      add('dip.r.relation', pair.rel);
      add('dip.r.power', clamp((myPower / theirPower - 1) * 20, -10, 20));
      if (pair.trade) add('dip.r.trade', 8);
      add('dip.r.personality', pers === 'defender' ? 10 : pers === 'trader' ? 8 : pers === 'conqueror' ? -15 : 0);
      break;
    case 'alliance':
      if (pair.war) return blocked('dip.b.war');
      if (pair.alliance) return blocked('dip.b.already');
      threshold = 55;
      add('dip.r.relation', pair.rel);
      if (pair.trade) add('dip.r.trade', 10);
      if (pair.nap > 0) add('dip.r.nap', 10);
      if (commonEnemy(s, from, to)) add('dip.r.commonEnemy', 25);
      add('dip.r.power', clamp((myPower / theirPower - 1) * 15, -15, 15));
      if (pers === 'conqueror') add('dip.r.personality', -10);
      break;
    case 'peace': {
      if (!pair.war) return blocked('dip.b.noWar');
      threshold = 20;
      add('dip.r.weariness', s.factions[to].ai.weariness * 4);
      add('dip.r.power', clamp((myPower / theirPower - 1) * 40, -40, 40));
      add('dip.r.relation', pair.rel / 4);
      const otherWars = others(s, to).filter(o => o !== from && getPair(s, to, o).war).length;
      add('dip.r.otherWars', otherWars * 15);
      if (pers === 'conqueror') add('dip.r.personality', -10);
      break;
    }
    case 'jointwar': {
      if (!target || target === to || target === from) return blocked('dip.b.invalid');
      const tp = getPair(s, to, target);
      if (tp.war) return blocked('dip.b.already');
      if (tp.alliance || tp.nap > 0 || tp.truce > 0) return blocked('dip.b.treaty');
      if (!getPair(s, from, target).war) return blocked('dip.b.youNotAtWar');
      threshold = 50;
      add('dip.r.relation', pair.rel);
      if (pair.alliance) add('dip.r.alliance', 30);
      add('dip.r.targetRel', -tp.rel / 2);
      add('dip.r.power', theirPower > militaryPower(s, target) ? 12 : -15);
      if (pers === 'conqueror') add('dip.r.personality', 12);
      if (pers === 'trader') add('dip.r.personality', -10);
      break;
    }
  }
  const score = reasons.reduce((n, r) => n + r.value, 0);
  return { accept: score >= threshold, score, threshold, reasons };
}

export function changeRel(s: GameState, a: FactionId, b: FactionId, delta: number) {
  const p = getPair(s, a, b);
  p.rel = clamp(p.rel + delta, -100, 100);
}

export function declareWar(s: GameState, a: FactionId, b: FactionId) {
  const p = getPair(s, a, b);
  if (p.war) return;
  const broke = p.nap > 0 || p.alliance || p.truce > 0;
  p.war = true; p.trade = false; p.nap = 0; p.alliance = false; p.truce = 0;
  changeRel(s, a, b, broke ? -50 : -30);
  for (const o of others(s, a)) {
    if (o === b) continue;
    if (broke) changeRel(s, a, o, -15);
    if (getPair(s, b, o).alliance) changeRel(s, a, o, -20);
    if (getPair(s, b, o).war) changeRel(s, a, o, 8);
  }
  addLog(s, t(broke ? 'log.warBroken' : 'log.war', { a: name(a), b: name(b) }), a === s.playerId || b === s.playerId ? 'war' : 'info');
}

export function applyTreaty(s: GameState, a: FactionId, b: FactionId, kind: ProposalKind, target?: FactionId) {
  const p = getPair(s, a, b);
  switch (kind) {
    case 'trade': p.trade = true; changeRel(s, a, b, 6); break;
    case 'nap': p.nap = NAP_TURNS; changeRel(s, a, b, 8); break;
    case 'alliance': p.alliance = true; p.nap = 0; changeRel(s, a, b, 15); break;
    case 'peace':
      p.war = false; p.truce = TRUCE_TURNS; changeRel(s, a, b, 12);
      s.factions[a].ai.weariness = 0; s.factions[b].ai.weariness = 0;
      break;
    case 'jointwar': if (target) { declareWar(s, b, target); changeRel(s, a, b, 6); } break;
  }
  if (kind !== 'jointwar') {
    s.factions[a].stats.treaties++; s.factions[b].stats.treaties++;
    addLog(s, t(`log.treaty.${kind}`, { a: name(a), b: name(b) }), kindOf(s, a, b));
  }
}

export type CancelKind = 'trade' | 'nap' | 'alliance';
export function cancelTreaty(s: GameState, a: FactionId, b: FactionId, kind: CancelKind) {
  const p = getPair(s, a, b);
  if (kind === 'trade') { p.trade = false; changeRel(s, a, b, -8); }
  if (kind === 'nap') { p.nap = 0; changeRel(s, a, b, -15); }
  if (kind === 'alliance') { p.alliance = false; changeRel(s, a, b, -25); }
  addLog(s, t(`log.cancel.${kind}`, { a: name(a), b: name(b) }), kindOf(s, a, b));
}

export function sendGift(s: GameState, from: FactionId, to: FactionId): boolean {
  const f = s.factions[from];
  if (f.res.gold < GIFT_GOLD || getPair(s, from, to).war) return false;
  f.res.gold -= GIFT_GOLD;
  s.factions[to].res.gold += GIFT_GOLD;
  changeRel(s, from, to, hasTech(s, from, 'protocol') ? 14 : 10);
  addLog(s, t('log.gift', { a: name(from), b: name(to), gold: GIFT_GOLD }), kindOf(s, from, to));
  return true;
}

/** A játékos ajánlata egy AI-frakciónak. Elutasításkor kis mértékben romlik a kapcsolat. */
export function playerPropose(s: GameState, to: FactionId, kind: ProposalKind, target?: FactionId): Evaluation {
  const from = s.playerId;
  const ev = evaluateProposal(s, from, to, kind, target);
  if (ev.blocked) return ev;
  const key = `${to}:${kind}:${target ?? ''}`;
  const memo = s.factions[from].ai.lastOffer;
  if (memo[key] === s.turn) return { ...ev, accept: false, blocked: t('dip.b.asked') };
  memo[key] = s.turn;
  if (ev.accept) applyTreaty(s, from, to, kind, target);
  else {
    changeRel(s, from, to, -2);
    addLog(s, t('log.rejected', { b: name(to), what: t(`dip.kind.${kind}`) }), 'diplo');
  }
  return ev;
}

/** A játékos válasza egy AI által küldött ajánlatra. */
export function respondProposal(s: GameState, index: number, accept: boolean) {
  const [p] = s.proposals.splice(index, 1);
  if (!p || !s.factions[p.from].alive) return;
  const pair = getPair(s, p.from, s.playerId);
  const valid = p.kind === 'peace' ? pair.war : !pair.war;
  if (accept && valid) applyTreaty(s, p.from, s.playerId, p.kind, p.target);
  else if (!accept) changeRel(s, p.from, s.playerId, -4);
}

/** Körönkénti diplomáciai sodródás és a szerződések lejárata. */
export function tickDiplomacy(s: GameState) {
  const alive = FACTION_IDS.filter(f => s.factions[f].alive);
  for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
    const a = alive[i], b = alive[j];
    const p = getPair(s, a, b);
    if (p.nap > 0 && --p.nap === 0) addLog(s, t('log.napExpired', { a: name(a), b: name(b) }), kindOf(s, a, b));
    if (p.truce > 0) p.truce--;
    let d = 0;
    if (p.war) d -= 1;
    if (p.trade) d += 0.5;
    if (p.alliance) d += 1;
    if (hasArchive(s, a)) d += 0.4;
    if (hasArchive(s, b)) d += 0.4;
    if (!p.war && !p.alliance && p.nap === 0 && sharesBorder(s, a, b)) d -= 0.5;
    if (commonEnemy(s, a, b)) d += 0.5;
    if (!p.war && !p.trade && !p.alliance) d += p.rel > 0 ? -0.25 : p.rel < 0 ? 0.25 : 0;
    p.rel = clamp(p.rel + d, -100, 100);
  }
  for (const f of alive) {
    const fs = s.factions[f];
    const warring = others(s, f).some(o => getPair(s, f, o).war);
    fs.ai.weariness = warring ? fs.ai.weariness + 0.5 : Math.max(0, fs.ai.weariness - 1);
  }
}

export const dominance = (s: GameState, fid: FactionId) => tilesOf(s, fid) / s.tiles.length;
