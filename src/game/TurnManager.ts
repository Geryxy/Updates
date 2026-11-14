import { runAI } from '../ai/AIController';
import { FACTION_IDS, GameState, MAX_TURNS, addLog, rand } from './GameState';
import { checkRebellions, growBorders, processCity } from './CitySystem';
import { tickDiplomacy } from './DiplomacySystem';
import { applyIncome } from './EconomySystem';
import { rollAIEvents, rollPlayerEvent } from './EventSystem';
import { continueMarches, refreshMoves } from './MovementSystem';
import { tickResearch } from './ResearchSystem';
import { seasonOf } from './SeasonSystem';
import { updateSupply } from './SupplySystem';
import { checkVictory } from './VictorySystem';
import { updateExplored } from './VisionSystem';
import { t } from '../i18n';

/** A kör végi elszámolás minden frakcióra, rögzített sorrendben. */
export function endOfRound(s: GameState) {
  const alive = FACTION_IDS.filter(f => s.factions[f].alive);
  for (const fid of alive) {
    const inc = applyIncome(s, fid);
    tickResearch(s, fid, inc.research);
    const f = s.factions[fid];
    f.modifiers = f.modifiers.filter(m => --m.turns > 0);
  }
  for (const c of s.cities) processCity(s, c);
  growBorders(s);
  updateSupply(s);
  checkRebellions(s, () => rand(s));
  tickDiplomacy(s);
  rollAIEvents(s);
  checkVictory(s);
}

/**
 * A játékos körének lezárása: az AI-frakciók lépnek, lezajlik a kör végi
 * elszámolás, majd új kör kezdődik. A visszatérés után az állapot konzisztens.
 */
export function endTurn(s: GameState) {
  if (s.outcome) return;
  s.pendingEvent = null;
  for (const fid of FACTION_IDS) {
    const f = s.factions[fid];
    if (f.alive && !f.isPlayer && !s.outcome) runAI(s, fid);
  }
  endOfRound(s);
  if (s.outcome) { updateExplored(s); return; }
  const before = seasonOf(s.turn);
  s.turn = Math.min(MAX_TURNS + 1, s.turn + 1);
  const now = seasonOf(s.turn);
  if (now !== before) addLog(s, t(`log.season.${now}`), 'info');
  refreshMoves(s);
  continueMarches(s, s.playerId);
  updateExplored(s);
  rollPlayerEvent(s);
}
