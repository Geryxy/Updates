import { FACTIONS, NEUTRAL_CITIES } from '../data/factions';
import { hexDistance, neighbors, tilesWithin } from '../world/HexMap';
import { PRESET_SEED, generateMap } from '../world/MapGenerator';
import {
  City, Difficulty, FACTION_IDS, FactionId, FactionState, GameState, Pair, SAVE_VERSION, pairKey, rand,
} from './GameState';
import { createArmy } from './CitySystem';
import { refreshMoves } from './MovementSystem';
import { updateExplored } from './VisionSystem';
import { addLog } from './GameState';
import { t } from '../i18n';

export interface NewGameOptions {
  player: FactionId;
  difficulty: Difficulty;
  /** Ha nincs megadva, az előre elkészített térkép töltődik be. */
  seed?: number;
  tutorial?: boolean;
}

function makeFaction(id: FactionId, isPlayer: boolean): FactionState {
  return {
    id, isPlayer, alive: true, personality: FACTIONS[id].personality,
    res: { food: 120, wood: 110, stone: 60, iron: 30, gold: 160 },
    techs: [], research: null, modifiers: [], domTurns: 0,
    stats: { battlesWon: 0, battlesLost: 0, tilesCaptured: 0, citiesCaptured: 0, treaties: 0, goldEarned: 0 },
    ai: { weariness: 0, lastOffer: {}, armySeq: 0 },
  };
}

export function newGame(opts: NewGameOptions): GameState {
  const seed = opts.seed ?? PRESET_SEED;
  const map = generateMap(seed);
  const s: GameState = {
    version: SAVE_VERSION, seed, rng: seed ^ 0x9e3779b9, turn: 1, difficulty: opts.difficulty, playerId: opts.player,
    width: map.width, height: map.height, tiles: map.tiles, cities: [], armies: [],
    factions: Object.fromEntries(FACTION_IDS.map(id => [id, makeFaction(id, id === opts.player)])) as Record<FactionId, FactionState>,
    pairs: {}, explored: new Array(map.tiles.length).fill(false), log: [], pendingEvent: null, eventCooldown: 2,
    seenEvents: [], proposals: [], reports: [], outcome: null, nextId: 1,
    tutorial: opts.tutorial ? { step: 0, flags: {} } : null,
  };
  for (let i = 0; i < FACTION_IDS.length; i++) for (let j = i + 1; j < FACTION_IDS.length; j++) {
    const pair: Pair = { rel: Math.round(rand(s) * 20 - 8), war: false, trade: false, nap: 0, alliance: false, truce: 0 };
    s.pairs[pairKey(FACTION_IDS[i], FACTION_IDS[j])] = pair;
  }

  // A frakciók véletlenszerű sarkokba kerülnek.
  const order = [...FACTION_IDS];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const addCity = (c: Omit<City, 'id' | 'happyMod' | 'build' | 'training'>) => {
    const city: City = { ...c, id: `c${s.nextId++}`, happyMod: 0, build: null, training: [] };
    s.cities.push(city);
    s.tiles[city.tile].cityId = city.id;
    return city;
  };
  order.forEach((fid, k) => {
    const tile = map.capitals[k];
    addCity({ name: FACTIONS[fid].capital, owner: fid, tile, level: 2, pop: 12, happiness: 65, buildings: ['farm'], capitalOf: fid });
    s.tiles[tile].owner = fid;
    for (const nb of neighbors(tile, s.width, s.height)) s.tiles[nb].owner = fid;
    createArmy(s, fid, tile, [
      { type: 'militia', count: 100 }, { type: 'militia', count: 100 }, { type: 'spear', count: 100 }, { type: 'scout', count: 100 },
    ]);
  });
  map.villages.forEach((tile, k) => {
    addCity({ name: NEUTRAL_CITIES[k], owner: 'neutral', tile, level: 1, pop: 6, happiness: 55, buildings: [], capitalOf: null });
    createArmy(s, 'neutral', tile, [{ type: 'militia', count: 100 }, { type: 'spear', count: 70 }], t('army.villageGuard'));
  });
  createArmy(s, 'neutral', map.center, [
    { type: 'spear', count: 100 }, { type: 'spear', count: 100 }, { type: 'archer', count: 100 }, { type: 'archer', count: 80 },
  ], t('army.mistGuard'));

  if (opts.tutorial) {
    // Oktatómód: gyenge útonállók a főváros közelében, hogy a harc kipróbálható legyen.
    const cap = s.cities.find(c => c.capitalOf === opts.player)!;
    const spot = tilesWithin(cap.tile, 2, s.width).find(i => hexDistance(i, cap.tile, s.width) === 2
      && !s.tiles[i].cityId && !s.armies.some(a => a.tile === i) && s.tiles[i].terrain === 'plains')
      ?? tilesWithin(cap.tile, 2, s.width).find(i => hexDistance(i, cap.tile, s.width) === 2 && !s.tiles[i].cityId && s.tiles[i].terrain !== 'mountain');
    if (spot !== undefined) createArmy(s, 'neutral', spot, [{ type: 'militia', count: 60 }], t('army.bandits'));
  }
  refreshMoves(s);
  updateExplored(s);
  addLog(s, t('log.start', { faction: t(`faction.${opts.player}`) }), 'info');
  return s;
}
