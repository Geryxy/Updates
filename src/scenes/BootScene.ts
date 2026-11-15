import Phaser from 'phaser';
import { getApp } from '../app/context';
import { RES_KEYS } from '../game/GameState';
import { SEASONS } from '../game/SeasonSystem';
import { SPRITE_PAGES, pageKey, registerSprites } from '../render/Sprites';
import { fogCanvas, glowCanvas, groundCanvas } from '../render/TerrainArt';
import { resBadgeCanvas, tokenCanvas } from '../render/TextureFactory';
import { TERRAINS } from '../world/TerrainTypes';

/** A 3D-s domborzat és romok változatainak száma (tools/blender/kk/terrain.py). */
export const DECOR_VARIANTS = 3;
export const RUIN_VARIANTS = 2;
export const GROUND_VARIANTS = 2;
export const MOTE_COLORS = { spring: '#d8ffb0', summer: '#fff2a8', autumn: '#ffb060', winter: '#e6f4ff' } as const;
export const FOG_VARIANTS = 3;
export const OWNERS = ['szikra', 'moha', 'vaskapu', 'volgyek', 'neutral'] as const;

/** Betöltő jelenet: betölti a 3D-s képatlaszokat, előállítja a festett talaj- és ködtextúrákat, majd átadja a vezérlést. */
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    SPRITE_PAGES.forEach((file, i) => this.load.image(pageKey(i), `./sprites/${file}`));
  }

  create() {
    registerSprites(this.textures);
    const add = (key: string, canvas: HTMLCanvasElement) => { if (!this.textures.exists(key)) this.textures.addCanvas(key, canvas); };
    for (const terrain of TERRAINS) for (const season of SEASONS) {
      for (let v = 0; v < GROUND_VARIANTS; v++) add(`g-${terrain}-${season}-${v}`, groundCanvas(terrain, season, v));
    }
    for (const season of SEASONS) add(`mote-${season}`, glowCanvas(10, MOTE_COLORS[season], 1));
    add('cloud', glowCanvas(260, '#05070c', 0.5));
    add('glint', glowCanvas(12, '#ffffff', 0.9));
    for (const o of OWNERS) add(`token-${o}`, tokenCanvas(o));
    for (const k of RES_KEYS) add(`res-${k}`, resBadgeCanvas(k));
    for (let v = 0; v < FOG_VARIANTS; v++) add(`fog-${v}`, fogCanvas(v));
    getApp().onBooted();
  }
}
