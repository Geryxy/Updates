import Phaser from 'phaser';
import { getApp } from '../app/context';
import { RES_KEYS } from '../game/GameState';
import { SEASONS } from '../game/SeasonSystem';
import { cityCanvas, flagCanvas, fogCanvas, resBadgeCanvas, ruinCanvas, terrainCanvas, tokenCanvas } from '../render/TextureFactory';
import { TERRAINS } from '../world/TerrainTypes';

export const TERRAIN_VARIANTS = 3;
export const FOG_VARIANTS = 3;
export const OWNERS = ['szikra', 'moha', 'vaskapu', 'volgyek', 'neutral'] as const;

/** Betöltő jelenet: a teljes grafikát kódból állítja elő, majd átadja a vezérlést. */
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    const add = (key: string, canvas: HTMLCanvasElement) => { if (!this.textures.exists(key)) this.textures.addCanvas(key, canvas); };
    for (const terrain of TERRAINS) for (const season of SEASONS) for (let v = 0; v < TERRAIN_VARIANTS; v++) {
      add(`t-${terrain}-${season}-${v}`, terrainCanvas(terrain, season, v));
    }
    for (let l = 1; l <= 5; l++) add(`city-${l}`, cityCanvas(l));
    for (const o of OWNERS) { add(`flag-${o}`, flagCanvas(o)); add(`token-${o}`, tokenCanvas(o)); }
    for (const k of RES_KEYS) add(`res-${k}`, resBadgeCanvas(k));
    for (let v = 0; v < FOG_VARIANTS; v++) add(`fog-${v}`, fogCanvas(v));
    add('ruin', ruinCanvas());
    getApp().onBooted();
  }
}
