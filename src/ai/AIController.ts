import { foundCity, recruit, startBuild, startUpgrade } from '../game/CitySystem';
import {
  applyTreaty, declareWar, evaluateProposal, militaryPower, others,
} from '../game/DiplomacySystem';
import { computeIncome } from '../game/EconomySystem';
import {
  FactionId, GameState, ProposalKind, armiesOf, armyById, armyMen, capitalOf, citiesOf, getPair, rand,
} from '../game/GameState';
import { executeMove } from '../game/MovementSystem';
import { availableTechs, startResearch } from '../game/ResearchSystem';
import { supplyNetwork } from '../game/SupplySystem';
import {
  Assessment, assess, chooseArmyTarget, chooseBuild, chooseUnit, desiredSquads, evaluateWar, recruitCapacity, shouldFoundCity,
} from './AIDecisionEngine';
import { DIFFICULTY, PROFILES } from './AIPersonality';

/** Egy AI-frakció teljes köre: kutatás, diplomácia, gazdaság, toborzás, hadmozdulatok. */
export function runAI(s: GameState, fid: FactionId) {
  const f = s.factions[fid];
  const prof = PROFILES[f.personality];
  const diff = DIFFICULTY[s.difficulty];
  const roll = () => rand(s);

  if (!f.research) {
    const avail = availableTechs(s, fid);
    const next = prof.techOrder.find(id => avail.includes(id));
    if (next) startResearch(s, fid, next);
  }

  let as = assess(s, fid, computeIncome(s, fid));
  diplomacy(s, as);
  as = assess(s, fid, computeIncome(s, fid));

  // Gazdaság: minden üres építési sorú város kap feladatot.
  for (const c of citiesOf(s, fid)) {
    if (c.build) continue;
    const choice = chooseBuild(s, c, as, prof, diff, roll);
    if (choice?.kind === 'building') startBuild(s, c, choice.id);
    else if (choice?.kind === 'upgrade') startUpgrade(s, c);
    as.income = computeIncome(s, fid);
  }

  // Toborzás: a fenyegetett városok élveznek elsőbbséget.
  const target = desiredSquads(s, as, prof);
  const cities = citiesOf(s, fid).sort((a, b) => (as.threat.get(b.id) ?? 0) - (as.threat.get(a.id) ?? 0) || b.level - a.level);
  let guard = 0;
  while (as.squads < target && guard++ < 8) {
    const c = cities.find(x => recruitCapacity(x) > 0 && chooseUnit(s, x, as));
    if (!c) break;
    const unit = chooseUnit(s, c, as)!;
    if (!recruit(s, c, unit).ok) break;
    as.squads++;
    as.income = computeIncome(s, fid);
  }

  // Hadmozdulatok: az erősebb seregek lépnek először.
  const net = supplyNetwork(s, fid);
  const taken = new Set<number>();
  const ids = armiesOf(s, fid).sort((a, b) => armyMen(b) - armyMen(a)).map(a => a.id);
  for (const id of ids) {
    if (roll() < diff.idle) continue;
    for (let step = 0; step < diff.actions; step++) {
      const a = armyById(s, id);
      if (!a || a.moves <= 0 || s.outcome) break;
      if (shouldFoundCity(s, a, as, prof)) { foundCity(s, a); break; }
      const tgt = chooseArmyTarget(s, a, as, prof, diff, taken, net, roll);
      if (!tgt || tgt.tile === a.tile) break;
      taken.add(tgt.tile);
      const before = a.tile;
      const res = executeMove(s, id, tgt.tile);
      const after = armyById(s, id);
      if (after) after.goto = null;
      if (!res.ok || res.kind === 'attack' || res.kind === 'merge' || !after || after.tile === before) break;
    }
  }
}

function offer(s: GameState, from: FactionId, to: FactionId, kind: ProposalKind, cooldown: number, target?: FactionId) {
  const memo = s.factions[from].ai.lastOffer;
  const key = `${to}:${kind}`;
  if (memo[key] !== undefined && s.turn - memo[key] < cooldown) return;
  memo[key] = s.turn;
  if (to === s.playerId) {
    if (!s.proposals.some(p => p.from === from && p.kind === kind)) s.proposals.push({ from, kind, target });
  } else if (evaluateProposal(s, from, to, kind, target).accept) {
    applyTreaty(s, from, to, kind, target);
  }
}

function diplomacy(s: GameState, as: Assessment) {
  const fid = as.fid;
  const f = s.factions[fid];
  const prof = PROFILES[f.personality];
  const diff = DIFFICULTY[s.difficulty];
  const cap = capitalOf(s, fid);
  const capitalLost = !cap || cap.owner !== fid;

  for (const o of others(s, fid)) {
    const p = getPair(s, fid, o);
    const their = militaryPower(s, o) + 1;
    if (p.war) {
      // Béke: ha vesztésre áll, kimerült, vagy elvesztette a fővárosát.
      const losing = as.power < their * 0.6;
      if (losing || f.ai.weariness >= 8 || (capitalLost && f.ai.weariness >= 4)) offer(s, fid, o, 'peace', 4);
      continue;
    }
    if (!p.trade && p.rel >= -5) offer(s, fid, o, 'trade', 6);
    if (p.nap === 0 && !p.alliance && p.rel >= 10 && (prof.aggression <= 0 || their > as.power * 1.3)) offer(s, fid, o, 'nap', 8);
    const shared = others(s, fid).some(x => x !== o && getPair(s, fid, x).war && getPair(s, o, x).war);
    if (!p.alliance && p.rel >= 50 && (shared || prof.aggression < 0)) offer(s, fid, o, 'alliance', 10);
    // Szövetségesi kötelesség: csatlakozás a szövetséges háborújához.
    if (p.alliance) {
      for (const x of others(s, fid)) {
        if (x === o || !getPair(s, o, x).war) continue;
        const px = getPair(s, fid, x);
        if (!px.war && !px.alliance && px.nap === 0 && px.truce === 0 && px.rel < 25 && as.power > 10) declareWar(s, fid, x);
      }
    }
  }
  const war = evaluateWar(s, as, prof, diff);
  if (war) declareWar(s, fid, war.target);
}
