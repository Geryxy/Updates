import type { Modifier, Resources } from '../game/GameState';

export interface EventEffect {
  res?: Partial<Resources>;
  /** Tartós elégedettségmódosító minden városra. */
  happy?: number;
  popPct?: number;
  morale?: number;
  modifier?: Modifier;
  mercs?: boolean;
  deposit?: boolean;
  research?: number;
  /** Kapcsolatváltozás az esemény célfrakciójával, illetve egy harmadik féllel. */
  relTarget?: number;
  relOther?: number;
}

export interface EventDef {
  id: string;
  weight: number;
  /** Csak adott évszakban fordulhat elő. */
  winterOnly?: boolean;
  needsTarget?: boolean;
  choices: EventEffect[];
}

/** A szövegek kulcsai: event.<id>.title / .text / .c0 / .c1 / .c2 */
export const EVENTS: EventDef[] = [
  { id: 'famine', weight: 3, choices: [
    { res: { food: -40 }, happy: 8 },
    { res: { gold: 30 }, happy: -10 },
    { happy: -6, popPct: -5 },
  ] },
  { id: 'boom', weight: 3, choices: [
    { res: { gold: -40 }, modifier: { id: 'boom', turns: 6, goldMult: 1.3 } },
    { res: { gold: 50 } },
  ] },
  { id: 'plague', weight: 2, choices: [
    { res: { gold: -30 }, popPct: -5 },
    { res: { food: -40, gold: -20 }, popPct: -2, happy: 5 },
    { popPct: -15, happy: -8 },
  ] },
  { id: 'mine', weight: 2, choices: [
    { res: { wood: -30 }, deposit: true },
    { res: { gold: 60 } },
  ] },
  { id: 'revolt', weight: 2, choices: [
    { res: { gold: -40 }, happy: 10 },
    { morale: -8, happy: -10, popPct: -4 },
    { happy: 3, modifier: { id: 'reforms', turns: 5, goldMult: 0.85 } },
  ] },
  { id: 'merchant', weight: 3, choices: [
    { res: { gold: -50, iron: 30 } },
    { res: { gold: -40, food: 70 } },
    {},
  ] },
  { id: 'mercs', weight: 2, choices: [
    { res: { gold: -80 }, mercs: true },
    { happy: 2 },
  ] },
  { id: 'ruins', weight: 2, choices: [
    { res: { food: -30, gold: 60 }, research: 15 },
    { research: 35 },
    { happy: 4 },
  ] },
  { id: 'crisis', weight: 2, needsTarget: true, choices: [
    { res: { gold: -40 }, relTarget: 12 },
    { relTarget: -20, morale: 6 },
    { relTarget: 6, relOther: -15 },
  ] },
  { id: 'hardwinter', weight: 5, winterOnly: true, choices: [
    { res: { food: -50 }, happy: 5 },
    { morale: -10, modifier: { id: 'rationing', turns: 3, upkeepMult: 0.7 } },
    { res: { wood: -40 } },
  ] },
];
