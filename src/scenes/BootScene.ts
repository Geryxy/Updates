import Phaser from 'phaser';
import { getApp } from '../app/context';
import { RES_KEYS } from '../game/GameState';
import { SEASONS } from '../game/SeasonSystem';
import { decorCanvas, fogCanvas, glowCanvas, groundCanvas } from '../render/TerrainArt';
import { cityCanvas, flagCanvas, resBadgeCanvas, ruinCanvas, tokenCanvas } from '../render/TextureFactory';
import { TERRAINS } from '../world/TerrainTypes';

export const TERRAIN_VARIANTS = 3;
export const GROUND_VARIANTS = 2;
export const MOTE_COLORS = { spring: '#d8ffb0', summer: '#fff2a8', autumn: '#ffb060', winter: '#e6f4ff' } as const;
export const FOG_VARIANTS = 3;
export const OWNERS = ['szikra', 'moha', 'vaskapu', 'volgyek', 'neutral'] as const;

/** Betöltő jelenet: a teljes grafikát kódból állítja elő, majd átadja a vezérlést. */
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    const add = (key: string, canvas: HTMLCanvasElement) => { if (!this.textures.exists(key)) this.textures.addCanvas(key, canvas); };
    for (const terrain of TERRAINS) for (const season of SEASONS) {
      for (let v = 0; v < GROUND_VARIANTS; v++) add(`g-${terrain}-${season}-${v}`, groundCanvas(terrain, season, v));
      for (let v = 0; v < TERRAIN_VARIANTS; v++) add(`d-${terrain}-${season}-${v}`, decorCanvas(terrain, season, v));
    }
    for (const season of SEASONS) add(`mote-${season}`, glowCanvas(10, MOTE_COLORS[season], 1));
    add('cloud', glowCanvas(260, '#05070c', 0.5));
    add('glint', glowCanvas(12, '#ffffff', 0.9));
    for (let l = 1; l <= 5; l++) add(`city-${l}`, cityCanvas(l));
    for (const o of OWNERS) { add(`flag-${o}`, flagCanvas(o)); add(`token-${o}`, tokenCanvas(o)); }
    for (const k of RES_KEYS) add(`res-${k}`, resBadgeCanvas(k));
    for (let v = 0; v < FOG_VARIANTS; v++) add(`fog-${v}`, fogCanvas(v));
    add('ruin', ruinCanvas());
    getApp().onBooted();
  }
}
