import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { MenuScene } from '../scenes/MenuScene';
import { WorldMapScene } from '../scenes/WorldMapScene';
import type { Settings } from '../storage/Settings';

export const QUALITY_DPR: Record<Settings['quality'], number> = { low: 1, medium: 1.5, high: 2 };
export const pixelRatio = (quality: Settings['quality']) => Math.min(window.devicePixelRatio || 1, QUALITY_DPR[quality]);

/** A Phaser-példány létrehozása. A vászon mérete a kijelző képpontsűrűségéhez igazodik. */
export function createPhaser(parent: HTMLElement, quality: Settings['quality']): Phaser.Game {
  const dpr = pixelRatio(quality);
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#0d1118',
    banner: false,
    audio: { noAudio: true },
    input: { activePointers: 3 },
    render: { antialias: true, powerPreference: 'high-performance', mipmapFilter: 'LINEAR_MIPMAP_LINEAR' },
    scale: { mode: Phaser.Scale.NONE, width: Math.round(parent.clientWidth * dpr), height: Math.round(parent.clientHeight * dpr), zoom: 1 / dpr },
    scene: [BootScene, MenuScene, WorldMapScene],
  });
}

export function resizePhaser(game: Phaser.Game, parent: HTMLElement, quality: Settings['quality']) {
  const dpr = pixelRatio(quality);
  game.scale.setZoom(1 / dpr);
  game.scale.resize(Math.round(parent.clientWidth * dpr), Math.round(parent.clientHeight * dpr));
}
