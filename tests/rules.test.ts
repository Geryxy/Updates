import 'fake-indexeddb/auto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canBuild, canRecruit, createArmy, processCity, recruit, startBuild } from '../src/game/CitySystem';
import { previewBattle, resolveBattle } from '../src/game/CombatSystem';
import { declareWar, evaluateProposal, playerPropose, sendGift } from '../src/game/DiplomacySystem';
import { applyIncome, computeIncome } from '../src/game/EconomySystem';
import { resolvePlayerEvent } from '../src/game/EventSystem';
import { GameState, RES_KEYS, armyAt, armyMen, capitalOf, getPair, tilesOf } from '../src/game/GameState';
import { enterCost, executeMove, maxMoves, reachable, refreshMoves } from '../src/game/MovementSystem';
import { newGame } from '../src/game/NewGame';
import { startResearch, techCost, tickResearch } from '../src/game/ResearchSystem';
import { seasonOf } from '../src/game/SeasonSystem';
import { supplyNetwork, updateSupply } from '../src/game/SupplySystem';
import { endTurn } from '../src/game/TurnManager';
import { checkVictory, territoryGoal } from '../src/game/VictorySystem';
import { hasKey } from '../src/i18n';
import { IndexedDBStorage } from '../src/storage/IndexedDBStorage';
import { SaveManager, deserialize, serialize } from '../src/storage/SaveManager';
import { hexDistance, neighbors } from '../src/world/HexMap';

const fresh = (): GameState => newGame({ player: 'szikra', difficulty: 'normal' });
const myCapital = (s: GameState) => capitalOf(s, s.playerId)!;
const myArmy = (s: GameState) => s.armies.find(a => a.owner === s.playerId)!;

describe('térkép', () => {
  it('11×11 mező, négy főváros, a szomszédság szimmetrikus', () => {
    const s = fresh();
    expect(s.tiles.length).toBe(121);
    expect(s.cities.filter(c => c.capitalOf).length).toBe(4);
    for (let i = 0; i < 121; i++) for (const n of neighbors(i)) {
      expect(neighbors(n)).toContain(i);
      expect(hexDistance(i, n)).toBe(1);
    }
  });
  it('azonos magból azonos világ jön létre', () => {
    expect(newGame({ player: 'moha', difficulty: 'hard', seed: 99 }).tiles).toEqual(newGame({ player: 'moha', difficulty: 'hard', seed: 99 }).tiles);
  });
});

describe('gazdaság', () => {
  it('a kör végi változás megegyezik a kijelzett bevétellel', () => {
    const s = fresh();
    const before = { ...s.factions.szikra.res };
    const inc = computeIncome(s, 'szikra');
    applyIncome(s, 'szikra');
    for (const k of RES_KEYS) expect(s.factions.szikra.res[k]).toBe(before[k] + inc.net[k]);
  });
  it('télen kevesebb az élelem és drágább a hadsereg', () => {
    const s = fresh();
    const summer = computeIncome(s, 'szikra').net.food;
    s.turn = 13;
    expect(seasonOf(s.turn)).toBe('winter');
    expect(computeIncome(s, 'szikra').net.food).toBeLessThan(summer);
  });
  it('éhínség: a készlet nem lesz negatív, de romlik a morál és az elégedettség', () => {
    const s = fresh();
    s.factions.szikra.res.food = 0;
    s.turn = 13;
    for (let i = 0; i < 5; i++) createArmy(s, 'szikra', 100 + i, [{ type: 'cavalry', count: 100 }, { type: 'cavalry', count: 100 }]);
    const morale = myArmy(s).morale;
    applyIncome(s, 'szikra');
    expect(s.factions.szikra.res.food).toBe(0);
    expect(myArmy(s).morale).toBeLessThan(morale);
    expect(myCapital(s).happyMod).toBeLessThan(0);
  });
  it('nyersanyag nélkül nem lehet építeni vagy toborozni', () => {
    const s = fresh();
    const c = myCapital(s);
    s.factions.szikra.res = { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 };
    expect(canBuild(s, c, 'lumber').ok).toBe(false);
    expect(startBuild(s, c, 'lumber').ok).toBe(false);
    expect(canRecruit(s, c, 'militia').ok).toBe(false);
    expect(recruit(s, c, 'militia').ok).toBe(false);
    for (const k of RES_KEYS) expect(s.factions.szikra.res[k]).toBe(0);
  });
  it('az építkezés időbe telik, a költség azonnal levonódik', () => {
    const s = fresh();
    const c = myCapital(s);
    const wood = s.factions.szikra.res.wood;
    expect(startBuild(s, c, 'lumber').ok).toBe(true);
    expect(s.factions.szikra.res.wood).toBeLessThan(wood);
    expect(startBuild(s, c, 'quarry').ok).toBe(false);
    processCity(s, c);
    expect(c.buildings).not.toContain('lumber');
    processCity(s, c);
    expect(c.buildings).toContain('lumber');
    expect(c.build).toBeNull();
  });
  it('a frakcióbónuszok érvényesülnek (Szikra piac, Moha farm)', () => {
    const a = newGame({ player: 'szikra', difficulty: 'normal' });
    const b = newGame({ player: 'szikra', difficulty: 'normal' });
    capitalOf(a, 'moha')!.buildings = []; capitalOf(b, 'moha')!.buildings = ['farm'];
    capitalOf(a, 'vaskapu')!.buildings = []; capitalOf(b, 'vaskapu')!.buildings = ['farm'];
    const moha = computeIncome(b, 'moha').net.food - computeIncome(a, 'moha').net.food;
    const vas = computeIncome(b, 'vaskapu').net.food - computeIncome(a, 'vaskapu').net.food;
    expect(moha).toBeGreaterThan(vas);
  });
});

describe('mozgás', () => {
  it('a hadsereg csak elérhető mezőre léphet, és mozgáspontot fogyaszt', () => {
    const s = fresh();
    const a = myArmy(s);
    const r = reachable(s, a);
    expect(r.moves.size).toBeGreaterThan(0);
    const [target, cost] = [...r.moves.entries()][0];
    const moves = a.moves;
    expect(executeMove(s, a.id, target).ok).toBe(true);
    expect(a.tile).toBe(target);
    expect(a.moves).toBeCloseTo(moves - cost, 5);
  });
  it('a gazdátlan mező a rálépő hadseregé lesz', () => {
    const s = fresh();
    const a = myArmy(s);
    const before = tilesOf(s, 'szikra');
    const target = [...reachable(s, a).moves.keys()].find(i => s.tiles[i].owner === null)!;
    executeMove(s, a.id, target);
    expect(s.tiles[target].owner).toBe('szikra');
    expect(tilesOf(s, 'szikra')).toBeGreaterThan(before);
  });
  it('béke idején idegen területre nem lehet belépni', () => {
    const s = fresh();
    const a = myArmy(s);
    const foreign = capitalOf(s, 'moha')!.tile;
    a.tile = neighbors(foreign).find(n => !armyAt(s, n))!;
    for (const n of neighbors(a.tile)) if (s.tiles[n].owner === 'moha') expect(reachable(s, a).moves.has(n)).toBe(false);
    expect(reachable(s, a).attacks.has(foreign)).toBe(false);
    declareWar(s, 'szikra', 'moha');
    expect(reachable(s, a).attacks.has(foreign)).toBe(true);
  });
  it('a terep, az út és a tél módosítja a mozgási költséget', () => {
    const s = fresh();
    const a = myArmy(s);
    const mountain = s.tiles.findIndex(t => t.terrain === 'mountain' && !t.road && !t.river);
    const summer = enterCost(s, a, mountain);
    s.turn = 13;
    expect(enterCost(s, a, mountain)).toBe(summer + 1);
    const road = s.tiles.findIndex(t => t.road && t.terrain === 'plains');
    expect(enterCost(s, a, road)).toBe(0.5);
  });
  it('egy mezőn csak egy hadsereg állhat; a sajátok egyesíthetők', () => {
    const s = fresh();
    const a = myArmy(s);
    const spot = [...reachable(s, a).moves.keys()][0];
    const b = createArmy(s, 'szikra', spot, [{ type: 'militia', count: 100 }]);
    refreshMoves(s);
    const r = reachable(s, a);
    expect(r.moves.has(spot)).toBe(false);
    expect(r.merges.has(spot)).toBe(true);
    executeMove(s, a.id, spot);
    expect(s.armies.filter(x => x.tile === spot).length).toBe(1);
    expect(armyAt(s, spot)!.id).toBe(b.id);
    expect(b.squads.length).toBe(5);
  });
});

describe('harc', () => {
  const setup = () => {
    const s = fresh();
    const a = myArmy(s);
    const tile = neighbors(a.tile).find(n => !armyAt(s, n) && s.tiles[n].terrain === 'plains')!;
    return { s, a, tile };
  };
  it('a túlerő nyer, a győztes elfoglalja a mezőt és tapasztalatot kap', () => {
    const { s, a, tile } = setup();
    a.squads = [{ type: 'spear', count: 100 }, { type: 'spear', count: 100 }, { type: 'archer', count: 100 }, { type: 'cavalry', count: 100 }];
    createArmy(s, 'neutral', tile, [{ type: 'militia', count: 40 }]);
    const pv = previewBattle(s, a, tile)!;
    expect(pv.winChance).toBe(1);
    const res = executeMove(s, a.id, tile);
    expect(res.report!.winner).toBe('attacker');
    expect(a.tile).toBe(tile);
    expect(a.xp).toBeGreaterThan(0);
    expect(res.report!.defender.losses).toBeGreaterThan(0);
  });
  it('reménytelen támadás: a támadó veszít és helyben marad', () => {
    const { s, a, tile } = setup();
    a.squads = [{ type: 'militia', count: 30 }];
    createArmy(s, 'neutral', tile, [{ type: 'spear', count: 100 }, { type: 'spear', count: 100 }, { type: 'archer', count: 100 }]);
    const from = a.tile;
    expect(previewBattle(s, a, tile)!.winChance).toBe(0);
    const report = resolveBattle(s, a, tile)!;
    expect(report.winner).toBe('defender');
    expect(armyAt(s, tile)!.owner).toBe('neutral');
    expect(s.armies.find(x => x.id === a.id)?.tile ?? from).toBe(from);
  });
  it('a terep, az erődítés, a morál és az ellátás számít', () => {
    const { s, a, tile } = setup();
    const d = createArmy(s, 'neutral', tile, [{ type: 'spear', count: 100 }]);
    const plain = previewBattle(s, a, tile)!.defender.power;
    s.tiles[tile].terrain = 'mountain';
    expect(previewBattle(s, a, tile)!.defender.power).toBeGreaterThan(plain);
    const full = previewBattle(s, a, tile)!.attacker.power;
    a.morale = 20; a.supply = 20;
    expect(previewBattle(s, a, tile)!.attacker.power).toBeLessThan(full);
    expect(d.squads.length).toBe(1);
  });
  it('a lándzsások hatékonyak lovasság ellen', () => {
    const { s, a, tile } = setup();
    createArmy(s, 'neutral', tile, [{ type: 'spear', count: 100 }]);
    a.squads = [{ type: 'archer', count: 100 }];
    const vsArchers = previewBattle(s, a, tile)!.defender.power;
    a.squads = [{ type: 'cavalry', count: 100 }];
    expect(previewBattle(s, a, tile)!.defender.power).toBeGreaterThan(vsArchers);
  });
  it('bekerített vesztes megsemmisül, ha nincs hová visszavonulnia', () => {
    const { s, a, tile } = setup();
    declareWar(s, 'szikra', 'moha');
    const d = createArmy(s, 'moha', tile, [{ type: 'militia', count: 100 }]);
    for (const n of neighbors(tile)) if (!armyAt(s, n)) createArmy(s, 'szikra', n, [{ type: 'militia', count: 100 }]);
    a.squads = Array.from({ length: 6 }, () => ({ type: 'cavalry' as const, count: 100 }));
    const report = resolveBattle(s, a, tile)!;
    expect(report.defender.fate).toBe('destroyed');
    expect(s.armies.some(x => x.id === d.id)).toBe(false);
  });
});

describe('utánpótlás', () => {
  it('az ellátási hálózattól elszakadt sereg ellátása és morálja romlik', () => {
    const s = fresh();
    const a = myArmy(s);
    const net = supplyNetwork(s, 'szikra');
    expect(net[a.tile]).toBe(2);
    a.tile = s.tiles.findIndex((t, i) => t.owner === null && !armyAt(s, i) && hexDistance(i, myCapital(s).tile) >= 5);
    for (let i = 0; i < 6; i++) updateSupply(s);
    expect(a.supply).toBeLessThan(40);
    expect(a.morale).toBeLessThan(80);
    expect(maxMoves(s, a)).toBeLessThan(3);
  });
});

describe('diplomácia és kutatás', () => {
  it('az AI nem fogad el mindent; az ajándék javítja a kapcsolatot', () => {
    const s = fresh();
    getPair(s, 'szikra', 'volgyek').rel = -40;
    expect(evaluateProposal(s, 'szikra', 'volgyek', 'alliance').accept).toBe(false);
    expect(playerPropose(s, 'volgyek', 'alliance').accept).toBe(false);
    const rel = getPair(s, 'szikra', 'volgyek').rel;
    expect(sendGift(s, 'szikra', 'volgyek')).toBe(true);
    expect(getPair(s, 'szikra', 'volgyek').rel).toBeGreaterThan(rel);
    getPair(s, 'szikra', 'moha').rel = 40;
    expect(playerPropose(s, 'moha', 'trade').accept).toBe(true);
    expect(getPair(s, 'szikra', 'moha').trade).toBe(true);
  });
  it('a kereskedelem aranyat hoz, a háború megszünteti', () => {
    const s = fresh();
    const base = computeIncome(s, 'szikra').net.gold;
    getPair(s, 'szikra', 'moha').trade = true;
    expect(computeIncome(s, 'szikra').net.gold).toBeGreaterThan(base);
    declareWar(s, 'szikra', 'moha');
    expect(getPair(s, 'szikra', 'moha').trade).toBe(false);
  });
  it('a kutatás pontokból készül el, és tényleges hatása van', () => {
    const s = fresh();
    const before = computeIncome(s, 'szikra').net.food;
    expect(startResearch(s, 'szikra', 'finance')).toBe(false);
    expect(startResearch(s, 'szikra', 'agri')).toBe(true);
    tickResearch(s, 'szikra', techCost('szikra', 'agri') - 1);
    expect(s.factions.szikra.techs).not.toContain('agri');
    tickResearch(s, 'szikra', 1);
    expect(s.factions.szikra.techs).toContain('agri');
    expect(computeIncome(s, 'szikra').net.food).toBeGreaterThan(before);
  });
});

describe('körváltás, események, győzelem', () => {
  it('a kör lezárása után az állapot konzisztens', () => {
    const s = fresh();
    startBuild(s, myCapital(s), 'lumber');
    endTurn(s);
    expect(s.turn).toBe(2);
    expect(myArmy(s).moves).toBe(maxMoves(s, myArmy(s)));
    expect(myCapital(s).build!.turns).toBe(1);
    for (let i = 0; i < 4; i++) { if (s.pendingEvent) resolvePlayerEvent(s, 0); endTurn(s); }
    expect(seasonOf(s.turn)).toBe('summer');
    expect(myCapital(s).buildings).toContain('lumber');
  });
  it('az esemény választása tényleges következménnyel jár', () => {
    const s = fresh();
    s.pendingEvent = { id: 'famine' };
    const food = s.factions.szikra.res.food;
    expect(resolvePlayerEvent(s, 0)).toBe(true);
    expect(s.factions.szikra.res.food).toBe(food - 40);
    expect(myCapital(s).happyMod).toBe(8);
    s.pendingEvent = { id: 'famine' };
    s.factions.szikra.res.food = 5;
    expect(resolvePlayerEvent(s, 0)).toBe(false);
  });
  it('területi győzelem: 65% három egymást követő körben', () => {
    const s = fresh();
    let n = tilesOf(s, 'szikra');
    s.tiles.forEach(t => { if (n < territoryGoal(s) && t.owner === null && !t.cityId) { t.owner = 'szikra'; n++; } });
    checkVictory(s); checkVictory(s);
    expect(s.outcome).toBeNull();
    checkVictory(s);
    expect(s.outcome).toMatchObject({ type: 'victory', winner: 'szikra' });
  });
  it('katonai győzelem két fővárossal; vereség, ha minden elveszett', () => {
    const s = fresh();
    capitalOf(s, 'moha')!.owner = 'szikra';
    checkVictory(s);
    expect(s.outcome).toBeNull();
    capitalOf(s, 'vaskapu')!.owner = 'szikra';
    checkVictory(s);
    expect(s.outcome?.type).toBe('victory');
    const d = fresh();
    d.cities.filter(c => c.owner === 'szikra').forEach(c => { c.owner = 'moha'; });
    checkVictory(d);
    expect(d.outcome).toBeNull(); // a hadsereg még megvan: nem egyetlen hiba dönt
    d.armies = d.armies.filter(a => a.owner !== 'szikra');
    checkVictory(d);
    expect(d.outcome?.type).toBe('defeat');
  });
});

describe('mentés', () => {
  it('a mentés veszteségmentesen visszatölthető, a sérült fájl elutasításra kerül', () => {
    const s = fresh();
    for (let i = 0; i < 3; i++) endTurn(s);
    const back = deserialize(serialize(s, 'slot1'))!;
    expect(back.state).toEqual(JSON.parse(JSON.stringify(s)));
    expect(back.meta.turn).toBe(s.turn);
    expect(deserialize('{"valami":1}')).toBeNull();
    expect(deserialize('nem json')).toBeNull();
  });
  it('IndexedDB: három mentési hely és automatikus mentés', async () => {
    const saves = new SaveManager(new IndexedDBStorage());
    const s = fresh();
    expect(await saves.save('auto', s)).toBe(true);
    endTurn(s);
    expect(await saves.save('slot2', s)).toBe(true);
    const list = await saves.list();
    expect(list.auto?.turn).toBe(1);
    expect(list.slot2?.turn).toBe(2);
    expect(list.slot1).toBeNull();
    const loaded = (await saves.load('slot2'))!;
    expect(armyMen(loaded.armies[0])).toBe(armyMen(s.armies[0]));
    endTurn(loaded); // a betöltött játék folytatható
    expect(loaded.turn).toBe(3);
    await saves.remove('slot2');
    expect(await saves.load('slot2')).toBeNull();
  });
});

describe('lokalizáció', () => {
  it('a kódban használt összes szövegkulcs létezik a magyar szótárban', () => {
    const files: string[] = [];
    const walk = (dir: string) => readdirSync(dir).forEach(n => { const f = join(dir, n); if (statSync(f).isDirectory()) walk(f); else if (f.endsWith('.ts') && !f.includes('i18n')) files.push(f); });
    walk('src');
    const missing = new Set<string>();
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\bt\(([^)]*)/g)) for (const k of m[1].matchAll(/'([a-zA-Z]+\.[a-zA-Z0-9.]+)'/g)) if (!hasKey(k[1])) missing.add(`${k[1]} (${f})`);
      for (const m of src.matchAll(/no\('([a-zA-Z.]+)'/g)) if (!hasKey(m[1])) missing.add(m[1]);
    }
    expect([...missing]).toEqual([]);
  });
});
