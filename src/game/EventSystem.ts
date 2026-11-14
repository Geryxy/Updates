import { EVENTS, EventDef, EventEffect } from '../data/events';
import { neighbors } from '../world/HexMap';
import {
  FactionId, GameState, MAX_SQUADS, RES_KEYS, addLog, armiesOf, armyAt, capitalOf, citiesOf, clamp, pick, rand,
} from './GameState';
import { createArmy } from './CitySystem';
import { changeRel, others } from './DiplomacySystem';
import { seasonOf } from './SeasonSystem';
import { t } from '../i18n';

export const eventDef = (id: string): EventDef | undefined => EVENTS.find(e => e.id === id);

export function choiceAffordable(s: GameState, fid: FactionId, eff: EventEffect): boolean {
  const res = s.factions[fid].res;
  return RES_KEYS.every(k => (eff.res?.[k] ?? 0) >= 0 || res[k] >= -(eff.res![k]!));
}

export function applyEffect(s: GameState, fid: FactionId, eff: EventEffect, target?: FactionId, other?: FactionId) {
  const f = s.factions[fid];
  if (eff.res) for (const k of RES_KEYS) f.res[k] = Math.max(0, f.res[k] + (eff.res[k] ?? 0));
  for (const c of citiesOf(s, fid)) {
    if (eff.happy) { c.happyMod += eff.happy; c.happiness = clamp(c.happiness + eff.happy / 2, 0, 100); }
    if (eff.popPct) c.pop = Math.max(2, c.pop * (1 + eff.popPct / 100));
  }
  if (eff.morale) for (const a of armiesOf(s, fid)) a.morale = clamp(a.morale + eff.morale, 0, 100);
  if (eff.modifier) {
    f.modifiers = f.modifiers.filter(m => m.id !== eff.modifier!.id);
    f.modifiers.push({ ...eff.modifier });
  }
  if (eff.research && f.research) f.research.progress += eff.research;
  if (eff.deposit) {
    const own = s.tiles.map((tile, i) => ({ tile, i })).filter(x => x.tile.owner === fid && !x.tile.resource);
    const rocky = own.filter(x => x.tile.terrain === 'hills' || x.tile.terrain === 'mountain');
    const pool = rocky.length ? rocky : own;
    if (pool.length) pick(s, pool).tile.resource = 'iron';
  }
  if (eff.mercs) {
    const cap = capitalOf(s, fid) ?? citiesOf(s, fid)[0];
    const squads = [{ type: 'spear' as const, count: 100 }, { type: 'archer' as const, count: 100 }];
    if (cap) {
      const here = armyAt(s, cap.tile);
      if (!here) createArmy(s, fid, cap.tile, squads);
      else if (here.owner === fid && here.squads.length + 2 <= MAX_SQUADS) here.squads.push(...squads);
      else {
        const spot = neighbors(cap.tile, s.width, s.height).find(n => !armyAt(s, n) && s.tiles[n].owner === fid);
        if (spot !== undefined) createArmy(s, fid, spot, squads);
        else f.res.gold += 80;
      }
    }
  }
  if (eff.relTarget && target) changeRel(s, fid, target, eff.relTarget);
  if (eff.relOther && other) changeRel(s, fid, other, eff.relOther);
}

/** Új esemény sorsolása a játékosnak a kör elején. */
export function rollPlayerEvent(s: GameState) {
  if (s.pendingEvent || s.turn < 3) return;
  if (s.eventCooldown > 0) { s.eventCooldown--; return; }
  if (rand(s) > 0.45) return;
  const winter = seasonOf(s.turn) === 'winter';
  const foes = others(s, s.playerId);
  const pool = EVENTS.filter(e => (!e.winterOnly || winter) && (!e.needsTarget || foes.length >= 1)
    && (s.seenEvents[s.seenEvents.length - 1] !== e.id));
  if (!pool.length) return;
  let roll = rand(s) * pool.reduce((n, e) => n + e.weight, 0);
  const ev = pool.find(e => (roll -= e.weight) < 0) ?? pool[0];
  const target = ev.needsTarget ? pick(s, foes) : undefined;
  const rest = foes.filter(o => o !== target);
  s.pendingEvent = { id: ev.id, target, other: rest.length ? pick(s, rest) : undefined };
  s.seenEvents.push(ev.id);
  if (s.seenEvents.length > 12) s.seenEvents.shift();
  s.eventCooldown = 2;
}

export function resolvePlayerEvent(s: GameState, choice: number): boolean {
  const pe = s.pendingEvent;
  const def = pe && eventDef(pe.id);
  if (!pe || !def) { s.pendingEvent = null; return false; }
  const eff = def.choices[choice];
  if (!eff || !choiceAffordable(s, s.playerId, eff)) return false;
  applyEffect(s, s.playerId, eff, pe.target, pe.other);
  addLog(s, t('log.event', { title: t(`event.${def.id}.title`), choice: t(`event.${def.id}.c${choice}`) }), 'info');
  s.pendingEvent = null;
  return true;
}

/** Az AI-frakciókat is érik események; a megengedhető lehetőségek közül az elsőt választják. */
export function rollAIEvents(s: GameState) {
  for (const fid of others(s, s.playerId)) {
    if (rand(s) > 0.12) continue;
    const pool = EVENTS.filter(e => !e.needsTarget && (!e.winterOnly || seasonOf(s.turn) === 'winter'));
    const ev = pick(s, pool);
    const eff = ev.choices.find(c => choiceAffordable(s, fid, c));
    if (eff) applyEffect(s, fid, eff);
  }
}
