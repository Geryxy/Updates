import { describe, expect, it } from 'vitest';
import { FACTION_IDS, GameState, MAX_SQUADS, RES_KEYS, armiesOf, citiesOf, tilesOf } from '../src/game/GameState';
import { newGame } from '../src/game/NewGame';
import { endTurn } from '../src/game/TurnManager';
import { resolvePlayerEvent } from '../src/game/EventSystem';
import { respondProposal } from '../src/game/DiplomacySystem';

function checkInvariants(s: GameState) {
  const seen = new Set<number>();
  for (const a of s.armies) {
    expect(seen.has(a.tile), `két hadsereg egy mezőn (${a.tile})`).toBe(false);
    seen.add(a.tile);
    expect(a.squads.length).toBeGreaterThan(0);
    expect(a.squads.length).toBeLessThanOrEqual(MAX_SQUADS);
    for (const q of a.squads) { expect(q.count).toBeGreaterThan(0); expect(q.count).toBeLessThanOrEqual(100); }
    expect(a.morale).toBeGreaterThanOrEqual(0); expect(a.morale).toBeLessThanOrEqual(100);
    expect(a.supply).toBeGreaterThanOrEqual(0); expect(a.supply).toBeLessThanOrEqual(100);
  }
  for (const f of FACTION_IDS) for (const k of RES_KEYS) {
    expect(s.factions[f].res[k], `${f} ${k}`).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(s.factions[f].res[k])).toBe(true);
  }
  for (const c of s.cities) {
    expect(s.tiles[c.tile].cityId).toBe(c.id);
    if (c.owner !== 'neutral') expect(s.tiles[c.tile].owner).toBe(c.owner);
    expect(c.happiness).toBeGreaterThanOrEqual(0); expect(c.happiness).toBeLessThanOrEqual(100);
  }
  for (const key in s.pairs) { expect(Math.abs(s.pairs[key].rel)).toBeLessThanOrEqual(100); }
}

function summary(s: GameState) {
  return FACTION_IDS.map(f => `${f}${s.factions[f].alive ? '' : '†'}: ${tilesOf(s, f)}t ${citiesOf(s, f).length}c ${armiesOf(s, f).reduce((n, a) => n + a.squads.length, 0)}sq tech${s.factions[f].techs.length} g${Math.round(s.factions[f].res.gold)} f${Math.round(s.factions[f].res.food)}`).join(' | ');
}

describe('teljes játék szimulációja (az AI ténylegesen játszik)', () => {
  for (const difficulty of ['easy', 'normal', 'hard'] as const) {
    for (const seed of [undefined, 7, 4242]) {
      it(`${difficulty}, mag: ${seed ?? 'előre elkészített'}`, () => {
        const s = newGame({ player: 'szikra', difficulty, seed });
        let wars = 0;
        for (let i = 0; i < 60 && !s.outcome; i++) {
          if (s.pendingEvent) resolvePlayerEvent(s, 0) || resolvePlayerEvent(s, 1) || resolvePlayerEvent(s, 2);
          while (s.proposals.length) respondProposal(s, 0, s.proposals[0].kind !== 'jointwar');
          endTurn(s);
          checkInvariants(s);
          wars = Math.max(wars, Object.values(s.pairs).filter(p => p.war).length);
        }
        console.log(`[${difficulty}/${seed}] kör ${s.turn} ${s.outcome?.type}: ${s.outcome?.reason}\n  ${summary(s)} | max háború: ${wars}`);
        expect(s.outcome).not.toBeNull();
        // Az AI-frakciók terjeszkednek, építkeznek és kutatnak.
        const ai = FACTION_IDS.filter(f => f !== 'szikra');
        expect(ai.some(f => tilesOf(s, f) > 12)).toBe(true);
        expect(ai.some(f => s.factions[f].techs.length >= 3)).toBe(true);
        expect(ai.some(f => citiesOf(s, f).some(c => c.buildings.length >= 4))).toBe(true);
      });
    }
  }
});
