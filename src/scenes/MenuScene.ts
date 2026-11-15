import Phaser from 'phaser';
import { getApp } from '../app/context';
import { HEX, TEX_SCALE } from '../render/TextureFactory';
import { hexCenter } from '../world/HexMap';
import { generateMap } from '../world/MapGenerator';
import { DECOR_ANCHOR_Y } from '../render/TerrainArt';
import { FOG_VARIANTS, GROUND_VARIANTS, TERRAIN_VARIANTS } from './BootScene';

/** A főmenü háttere: lassan úszó, ködbe burkolt fantasy világtérkép. */
export class MenuScene extends Phaser.Scene {
  private worldW = 0;
  private worldH = 0;
  constructor() { super('Menu'); }

  create() {
    const map = generateMap(Math.floor(Math.random() * 100000));
    const inv = 1 / TEX_SCALE;
    map.tiles.forEach((tile, i) => {
      const { x, y } = hexCenter(i, HEX);
      this.add.image(x, y, `g-${tile.terrain}-autumn-${i % GROUND_VARIANTS}`).setScale(inv);
    });
    const special = new Set([...map.capitals, ...map.villages]);
    map.tiles.forEach((tile, i) => {
      const { x, y } = hexCenter(i, HEX);
      if (!special.has(i)) this.add.image(x, y, `d-${tile.terrain}-autumn-${i % TERRAIN_VARIANTS}`).setOrigin(0.5, DECOR_ANCHOR_Y).setScale(inv);
      if (tile.ruin) this.add.image(x, y, 'ruin').setScale(inv);
    });
    [...map.capitals, ...map.villages].forEach((i, k) => {
      const { x, y } = hexCenter(i, HEX);
      this.add.image(x, y - 8, `city-${k < 4 ? 5 : 3}`).setScale(inv);
    });
    const animate = getApp().settings.quality !== 'low';
    map.tiles.forEach((_t, i) => {
      const { x, y } = hexCenter(i, HEX);
      const d = Math.hypot(x - 540, y - 470) / 560;
      const alpha = Phaser.Math.Clamp(0.05 + d * 0.7 + (Math.random() - 0.5) * 0.3, 0, 0.9);
      const fog = this.add.image(x, y, `fog-${i % FOG_VARIANTS}`).setScale(inv).setAlpha(alpha);
      if (animate) this.tweens.add({ targets: fog, alpha: Math.max(0.05, alpha - 0.3), duration: 3500 + Math.random() * 4000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    this.worldW = Math.sqrt(3) * HEX * 11.5;
    this.worldH = HEX * 1.5 * 10 + HEX * 2;
    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));
    const cam = this.cameras.main;
    this.tweens.add({ targets: cam, scrollX: cam.scrollX + 90, scrollY: cam.scrollY + 50, duration: 26000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private layout() {
    const cam = this.cameras.main;
    const zoom = Math.max(cam.width / (this.worldW * 0.8), cam.height / (this.worldH * 0.8));
    cam.setZoom(zoom);
    cam.centerOn(this.worldW / 2, this.worldH / 2);
  }
}
