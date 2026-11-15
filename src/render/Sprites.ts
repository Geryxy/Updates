/**
 * Blenderben renderelt 3D-s képek (városok, egységek, domborzat) képatlaszokból.
 * A leírófájlt és az atlaszokat a tools/blender/build.py állítja elő.
 */
import type Phaser from 'phaser';
import manifest from './sprites.json';
import { HEX } from './TextureFactory';

/** [lap, x, y, szélesség, magasság, talajpont x, talajpont y, képpont/hatszögsugár] */
type Entry = [number, number, number, number, number, number, number, number];
const SPRITES = manifest.sprites as unknown as Record<string, Entry>;

/** A talaj függőleges rövidülése a döntött nézetben (a kamera dőlésszögének koszinusza). */
export const GROUND_K: number = manifest.k;
export const SPRITE_PAGES: string[] = manifest.pages;
export const pageKey = (index: number) => `sprites-${index}`;
export const hasSprite = (name: string) => name in SPRITES;
export const spriteNames = () => Object.keys(SPRITES);

/** A betöltött atlaszlapokon belül névvel ellátja az egyes képek területét. */
export function registerSprites(textures: Phaser.Textures.TextureManager) {
  for (const name in SPRITES) {
    const e = SPRITES[name];
    if (textures.exists(pageKey(e[0]))) textures.get(pageKey(e[0])).add(name, 0, e[1], e[2], e[3], e[4]);
  }
}

/**
 * Beállítja a képet, a méretét és a talajpontját: a kép (x, y) helye ezután az a pont,
 * ahol a modell a talajon áll.
 */
export function placeSprite<T extends Phaser.GameObjects.Image>(img: T, name: string, scale = 1): T {
  const e = SPRITES[name];
  img.setTexture(pageKey(e[0]), name);
  img.setOrigin(e[5] / e[3], e[6] / e[4]);
  img.setScale((HEX / e[7]) * scale);
  return img;
}

/** Különálló, kicsinyített kép a kezelőfelülethez (panelek, listák). */
export const spriteUrl = (name: string) => `./sprites/ui/${name}.webp`;
