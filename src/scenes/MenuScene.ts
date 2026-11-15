import Phaser from 'phaser';
import { getApp } from '../app/context';
import { FACTION_IDS } from '../game/GameState';
import { GROUND_K, placeSprite } from '../render/Sprites';
import { staticLayerCanvas } from '../render/TerrainArt';
import { HEX, HEX_W, TEX_SCALE } from '../render/TextureFactory';
import { hexCenter, neighbors } from '../world/HexMap';
import { generateMap } from '../world/MapGenerator';
import { DECOR_VARIANTS, FOG_VARIANTS, GROUND_VARIANTS, RUIN_VARIANTS } from './BootScene';

const K = GROUND_K;
const INV = 1 / TEX_SCALE;

/** A főmenü háttere: ugyanabból a 3D-s világból épülő, lassan úszó, ködbe burkolt térkép. */
export class MenuScene extends Phaser.Scene {
  private worldW = 0;
  private worldH = 0;
  constructor() { super('Menu'); }

  create() {
    const map = generateMap(Math.floor(Math.random() * 100000));
    const pos = (i: number) => { const c = hexCenter(i, HEX); return { x: c.x, y: c.y * K }; };
    this.worldW = HEX_W * 11.5;
    this.worldH = (HEX * 1.5 * 10 + HEX * 2) * K;
    const depth = (y: number) => 2 + y / this.worldH;

    map.tiles.forEach((tile, i) => {
      const { x, y } = pos(i);
      this.add.image(x, y, `g-${tile.terrain}-autumn-${i % GROUND_VARIANTS}`).setScale(INV, INV * K);
    });
    if (this.textures.exists('static-menu')) this.textures.remove('static-menu');
    this.textures.addCanvas('static-menu', staticLayerCanvas(map.tiles, map.width, map.height));
    this.add.image(0, 0, 'static-menu').setOrigin(0).setScale(INV, INV * K).setDepth(1);

    const owners = Phaser.Utils.Array.Shuffle([...FACTION_IDS]);
    const settled = new Set([...map.capitals, ...map.villages]);
    map.tiles.forEach((tile, i) => {
      const { x, y } = pos(i);
      if (!settled.has(i)) placeSprite(this.add.image(x, y, '__DEFAULT'), `decor-${tile.terrain}-autumn-${i % DECOR_VARIANTS}`).setDepth(depth(y));
      if (tile.ruin) placeSprite(this.add.image(x, y, '__DEFAULT'), `ruin-${i % RUIN_VARIANTS}`).setDepth(depth(y) + 0.0002);
    });
    map.capitals.forEach((i, k) => {
      const { x, y } = pos(i);
      placeSprite(this.add.image(x, y, '__DEFAULT'), `city-5-${owners[k]}`, 1.15).setDepth(depth(y) + 0.0004);
      // Egy-egy sereg vonul a fővárosok mellett.
      const n = neighbors(i, map.width, map.height).find(t => !settled.has(t) && map.tiles[t].terrain === 'plains')
        ?? neighbors(i, map.width, map.height)[0];
      const p = pos(n);
      (['spear', 'cavalry', 'archer'] as const).forEach((type, j) => {
        placeSprite(this.add.image(p.x - 12 + j * 12, p.y - 4 + j * 6, '__DEFAULT'), `unit-${type}-${owners[k]}`, 0.9).setDepth(depth(p.y) + 0.0006 + j * 0.00001);
      });
    });
    map.villages.forEach((i, k) => {
      const { x, y } = pos(i);
      placeSprite(this.add.image(x, y, '__DEFAULT'), `city-${2 + (k % 2)}-neutral`, 1.35).setDepth(depth(y) + 0.0004);
    });

    const animate = getApp().settings.quality !== 'low';
    map.tiles.forEach((_t, i) => {
      const { x, y } = pos(i);
      const d = Math.hypot(x - this.worldW / 2, (y - this.worldH / 2) / K) / 560;
      const alpha = Phaser.Math.Clamp(0.05 + d * 0.7 + (Math.random() - 0.5) * 0.3, 0, 0.9);
      const fog = this.add.image(x, y, `fog-${i % FOG_VARIANTS}`).setScale(INV, INV * K).setAlpha(alpha).setDepth(4);
      if (animate) this.tweens.add({ targets: fog, alpha: Math.max(0.05, alpha - 0.3), duration: 3500 + Math.random() * 4000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));
    const cam = this.cameras.main;
    this.tweens.add({ targets: cam, scrollX: cam.scrollX + 90, scrollY: cam.scrollY + 40, duration: 26000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private layout() {
    const cam = this.cameras.main;
    const zoom = Math.max(cam.width / (this.worldW * 0.8), cam.height / (this.worldH * 0.8));
    cam.setZoom(zoom);
    cam.centerOn(this.worldW / 2, this.worldH / 2);
  }
}
