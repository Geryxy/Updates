import Phaser from 'phaser';
import { pixelRatio } from '../app/GameConfig';
import { getApp } from '../app/context';
import { FACTIONS, NEUTRAL_COLOR } from '../data/factions';
import { Army, GameState, OwnerId, armyMen, capitalOf } from '../game/GameState';
import { seasonOf } from '../game/SeasonSystem';
import { GROUND_K, hasSprite, placeSprite } from '../render/Sprites';
import { DECOR_ANCHOR_Y, staticLayerCanvas } from '../render/TerrainArt';
import { HEX, HEX_W, TEX_SCALE } from '../render/TextureFactory';
import { hexCenter, hexCorners, neighborAcrossEdge, neighbors } from '../world/HexMap';
import { FOG_VARIANTS, GROUND_VARIANTS, TERRAIN_VARIANTS } from './BootScene';
import { armyFigures } from './figures';

const INV = 1 / TEX_SCALE;
/**
 * Döntött (2,5D) nézet: a talaj síkja függőlegesen K-szorosára rövidül, a rajta álló
 * modellek pedig ugyanebből a kameraszögből készültek, így pontosan illeszkednek rá.
 */
const K = GROUND_K;
const colorOf = (o: OwnerId | null) => (o && o !== 'neutral' ? FACTIONS[o].color : NEUTRAL_COLOR);
const LABEL: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'Georgia, "Times New Roman", serif', fontSize: '13px', color: '#f6ecd0', stroke: '#14100a', strokeThickness: 4,
};
/** Rétegek. Az álló tárgyak (domborzat, városok, seregek) a talajon elfoglalt helyük szerint takarják egymást. */
const DEPTH = { ground: 0, statics: 1, glint: 1.5, owner: 2, highlight: 3, objects: 4, labels: 6.2, clouds: 6.4, motes: 6.6, fog: 7, selection: 8, fx: 9 };
const BIAS = { decor: 0, feature: 0.0002, city: 0.0004, army: 0.0006 };

/** A városok nagyobbak a méretarányosnál (szintenként): ezek a térkép legfontosabb tájékozódási pontjai. */
const CITY_SCALE = [1.5, 1.4, 1.3, 1.2, 1.15];
const UNIT_SCALE = 0.9;
/** A figurák helye a seregen belül (hátsó sorból előre), a figurák száma szerint. */
const SLOTS: { x: number; y: number }[][] = [
  [{ x: 0, y: 2 }],
  [{ x: -11, y: -3 }, { x: 11, y: 4 }],
  [{ x: -14, y: -6 }, { x: 13, y: -3 }, { x: -1, y: 8 }],
];
interface ArmyView {
  body: Phaser.GameObjects.Container;
  tag: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
  dot: Phaser.GameObjects.Arc;
  owner: OwnerId;
  sig: string;
}

/** A stratégiai világtérkép megjelenítése és kezelése (egér, görgő, érintés, kétujjas nagyítás). */
export class WorldMapScene extends Phaser.Scene {
  private tileImgs: Phaser.GameObjects.Image[] = [];
  private decorImgs: Phaser.GameObjects.Image[] = [];
  private motes: Phaser.GameObjects.Image[] = [];
  private fogImgs: Phaser.GameObjects.Image[] = [];
  private ownerG!: Phaser.GameObjects.Graphics;
  private hiG!: Phaser.GameObjects.Graphics;
  private selG!: Phaser.GameObjects.Graphics;
  private labelLayer!: Phaser.GameObjects.Container;
  private features: Phaser.GameObjects.GameObject[] = [];
  private cityObjs: Phaser.GameObjects.GameObject[] = [];
  private armies = new Map<string, ArmyView>();
  private featureSig = '';
  private citySig = '';
  private season = '';
  private mapW = 11;
  private worldW = HEX_W * 11.5;
  /** A térkép magassága a döntött nézetben. */
  private viewH = (HEX * 1.5 * 10 + HEX * 2) * K;
  private userZoom = 1;
  private drag = { active: false, moved: false, x: 0, y: 0, id: -1 };
  private pinch = { active: false, dist: 0, zoom: 1 };
  private hover = -1;

  constructor() { super('WorldMap'); }

  create() {
    const app = getApp();
    const s = app.state!;
    this.tileImgs = []; this.decorImgs = []; this.motes = []; this.fogImgs = []; this.features = []; this.cityObjs = [];
    this.armies.clear();
    this.featureSig = ''; this.citySig = ''; this.season = '';
    this.mapW = s.width;
    this.worldW = HEX_W * (s.width + 0.5);
    this.viewH = (HEX * 1.5 * (s.height - 1) + HEX * 2) * K;

    s.tiles.forEach((_t, i) => {
      const { x, y } = this.pos(i);
      this.tileImgs.push(this.add.image(x, y, '__DEFAULT').setScale(INV, INV * K).setDepth(DEPTH.ground));
    });
    if (this.textures.exists('static-map')) this.textures.remove('static-map');
    this.textures.addCanvas('static-map', staticLayerCanvas(s.tiles, s.width, s.height));
    this.add.image(0, 0, 'static-map').setOrigin(0).setScale(INV, INV * K).setDepth(DEPTH.statics);
    // A talajra rajzolt rétegek a talajjal együtt rövidülnek.
    this.ownerG = this.add.graphics().setDepth(DEPTH.owner).setScale(1, K);
    this.hiG = this.add.graphics().setDepth(DEPTH.highlight).setScale(1, K);
    s.tiles.forEach((tile, i) => {
      const { x, y } = this.pos(i);
      this.decorImgs.push(this.add.image(x, y, '__DEFAULT').setOrigin(0.5, DECOR_ANCHOR_Y).setScale(INV)
        .setDepth(this.objectDepth(y, BIAS.decor)).setVisible(!tile.cityId));
    });
    this.labelLayer = this.add.container(0, 0).setDepth(DEPTH.labels);
    const animate = app.settings.quality !== 'low';
    if (animate) this.addAmbience(s);
    s.tiles.forEach((_t, i) => {
      const { x, y } = this.pos(i);
      const fog = this.add.image(x, y, `fog-${i % FOG_VARIANTS}`).setScale(INV, INV * K).setDepth(DEPTH.fog);
      if (animate) this.tweens.add({ targets: fog, scaleX: INV * 1.12, scaleY: INV * K * 1.12, duration: 4200 + (i % 7) * 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.fogImgs.push(fog);
    });
    this.selG = this.add.graphics().setDepth(DEPTH.selection).setScale(1, K);

    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.zoomAt(p.x, p.y, this.userZoom * (dy > 0 ? 0.88 : 1.14)));
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.onResize, this));

    this.userZoom = Math.max(this.minZoom(), Math.min(1.25, this.fitZoom() * 1.9));
    this.applyZoom();
    const cap = capitalOf(s, s.playerId);
    this.centerOn(cap ? cap.tile : Math.floor(s.tiles.length / 2));
    app.mapScene = this;
    this.refresh();
  }

  // ---------- Vetítés ----------
  /** A mező közepe a képernyő síkjában (a talaj rövidülésével). */
  private pos(tile: number) {
    const c = hexCenter(tile, HEX, this.mapW);
    return { x: c.x, y: c.y * K };
  }
  /** Az álló tárgyak sorrendje: ami lejjebb (a nézőhöz közelebb) áll, az takar. */
  private objectDepth(y: number, bias: number) {
    return DEPTH.objects + (y / this.viewH) * 0.9 + bias;
  }

  // ---------- Kamera ----------
  private dpr() { return pixelRatio(getApp().settings.quality); }
  private fitZoom() {
    const cam = this.cameras.main, d = this.dpr();
    return Math.min(cam.width / d / this.worldW, cam.height / d / this.viewH);
  }
  private minZoom() { return this.fitZoom() * 0.8; }
  private applyZoom() {
    this.userZoom = Phaser.Math.Clamp(this.userZoom, this.minZoom(), 2.6);
    this.cameras.main.setZoom(this.userZoom * this.dpr());
  }
  private clampScroll() {
    const cam = this.cameras.main;
    const cx = Phaser.Math.Clamp(cam.scrollX + cam.width / 2, 0, this.worldW);
    const cy = Phaser.Math.Clamp(cam.scrollY + cam.height / 2, 0, this.viewH);
    cam.setScroll(cx - cam.width / 2, cy - cam.height / 2);
    getApp().ui.minimapDirty();
  }
  /** A kamera által látott terület a térkép (rövidülés nélküli) koordinátáiban, a minitérképhez. */
  viewRect() {
    const cam = this.cameras.main, w = cam.width / cam.zoom, h = cam.height / cam.zoom;
    return { x: cam.scrollX + cam.width / 2 - w / 2, y: (cam.scrollY + cam.height / 2 - h / 2) / K, w, h: h / K };
  }
  private toWorld(px: number, py: number) {
    const cam = this.cameras.main;
    return { x: cam.scrollX + cam.width / 2 + (px - cam.width / 2) / cam.zoom, y: cam.scrollY + cam.height / 2 + (py - cam.height / 2) / cam.zoom };
  }
  private zoomAt(px: number, py: number, zoom: number) {
    const cam = this.cameras.main;
    const w = this.toWorld(px, py);
    this.userZoom = zoom;
    this.applyZoom();
    cam.setScroll(w.x - cam.width / 2 - (px - cam.width / 2) / cam.zoom, w.y - cam.height / 2 - (py - cam.height / 2) / cam.zoom);
    this.clampScroll();
    getApp().flag('camera');
  }
  zoomBy(factor: number) { const cam = this.cameras.main; this.zoomAt(cam.width / 2, cam.height / 2, this.userZoom * factor); }
  /** A térkép HUD által nem takart részének közepe (CSS-képpontban). */
  viewCenter() {
    const rect = (id: string) => document.getElementById(id)!.getBoundingClientRect();
    const top = rect('top').bottom, bottomBar = rect('bottom').top;
    const side = document.getElementById('side')!;
    let right = window.innerWidth, bottom = bottomBar;
    if (!side.classList.contains('empty')) {
      const r = side.getBoundingClientRect();
      if (r.width > window.innerWidth * 0.7) bottom = Math.min(bottom, r.top); else right = Math.min(right, r.left);
    }
    return { x: right / 2, y: (top + Math.max(top + 40, bottom)) / 2 };
  }
  centerOn(tile: number) {
    const { x, y } = this.pos(tile);
    const cam = this.cameras.main, c = this.viewCenter(), d = this.dpr();
    cam.setScroll(x - cam.width / 2 - (c.x * d - cam.width / 2) / cam.zoom, y - cam.height / 2 - (c.y * d - cam.height / 2) / cam.zoom);
    this.clampScroll();
  }
  private onResize() { this.applyZoom(); this.clampScroll(); }

  /** A képernyőpont alatti mező: a talaj síkjára visszavetítve a legközelebbi középpont. */
  private tileAt(px: number, py: number): number {
    const s = getApp().state!;
    const w = this.toWorld(px, py);
    const gy = w.y / K;
    let best = -1, bd = HEX * HEX;
    for (let i = 0; i < s.tiles.length; i++) {
      const c = hexCenter(i, HEX, s.width);
      const d = (c.x - w.x) ** 2 + (c.y - gy) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  // ---------- Bevitel ----------
  private onDown(p: Phaser.Input.Pointer) {
    getApp().audio.unlock();
    const p1 = this.input.pointer1, p2 = this.input.pointer2;
    if (p1.isDown && p2.isDown) {
      this.pinch = { active: true, dist: Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y), zoom: this.userZoom };
      this.drag.active = false; this.drag.moved = true;
      return;
    }
    this.drag = { active: true, moved: false, x: p.x, y: p.y, id: p.id };
  }

  private onMove(p: Phaser.Input.Pointer) {
    const p1 = this.input.pointer1, p2 = this.input.pointer2;
    if (this.pinch.active && p1.isDown && p2.isDown) {
      const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
      if (this.pinch.dist > 0) this.zoomAt((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, this.pinch.zoom * (dist / this.pinch.dist));
      return;
    }
    if (this.drag.active && p.id === this.drag.id && p.isDown) {
      const dx = p.x - this.drag.x, dy = p.y - this.drag.y;
      if (!this.drag.moved && Math.hypot(dx, dy) < 9 * this.dpr()) return;
      this.drag.moved = true;
      const cam = this.cameras.main;
      cam.setScroll(cam.scrollX - dx / cam.zoom, cam.scrollY - dy / cam.zoom);
      this.clampScroll();
      this.drag.x = p.x; this.drag.y = p.y;
      getApp().flag('camera');
      return;
    }
    if (!p.isDown && !p.wasTouch) {
      const h = this.tileAt(p.x, p.y);
      if (h !== this.hover) { this.hover = h; this.drawSelection(); }
    }
  }

  private onUp(p: Phaser.Input.Pointer) {
    if (this.pinch.active) {
      if (!this.input.pointer1.isDown && !this.input.pointer2.isDown) this.pinch.active = false;
      this.drag.active = false;
      return;
    }
    if (this.drag.active && p.id === this.drag.id && !this.drag.moved) {
      const tile = this.tileAt(p.x, p.y);
      if (tile >= 0) getApp().tileClicked(tile, p.rightButtonReleased());
    }
    this.drag.active = false;
  }

  // ---------- Rajzolás ----------
  /** Hatszög körvonala a talaj (rövidülés nélküli) koordinátáiban; a réteg maga rövidül. */
  private hexPoly(g: Phaser.GameObjects.Graphics, i: number, size: number, w: number) {
    const c = hexCenter(i, HEX, w);
    g.beginPath();
    hexCorners(c.x, c.y, size).forEach((pt, k) => (k ? g.lineTo(pt.x, pt.y) : g.moveTo(pt.x, pt.y)));
    g.closePath();
  }

  /** Hangulatelemek: vonuló felhőárnyékok, lebegő fényszemcsék, vízcsillanás. */
  private addAmbience(s: GameState) {
    for (let i = 0; i < 6; i++) {
      const y = (this.viewH / 6) * i + Math.random() * 80;
      const cloud = this.add.image(-400 - Math.random() * 600, y, 'cloud').setScale(2.2 + Math.random() * 1.6, 0.9 + Math.random() * 0.7).setDepth(DEPTH.clouds).setAlpha(0.55);
      this.tweens.add({ targets: cloud, x: this.worldW + 500, duration: 60000 + Math.random() * 50000, repeat: -1, delay: i * 5000 });
    }
    for (let i = 0; i < 34; i++) {
      const mote = this.add.image(Math.random() * this.worldW, Math.random() * this.viewH, 'mote-spring').setDepth(DEPTH.motes).setAlpha(0).setScale(0.5 + Math.random() * 0.6);
      this.motes.push(mote);
      this.tweens.add({ targets: mote, alpha: 0.85, y: mote.y - 30 - Math.random() * 40, x: mote.x + (Math.random() - 0.5) * 50, duration: 3200 + Math.random() * 3600, yoyo: true, repeat: -1, delay: Math.random() * 5000, ease: 'Sine.easeInOut' });
    }
    s.tiles.forEach((tile, i) => {
      if (!tile.river || i % 2) return;
      const { x, y } = this.pos(i);
      const glint = this.add.image(x + ((i * 13) % 20) - 10, y + 11 * K, 'glint').setDepth(DEPTH.glint).setAlpha(0).setScale(0.6, 0.25);
      this.tweens.add({ targets: glint, alpha: 0.9, scaleX: 1.2, duration: 900 + (i % 5) * 300, yoyo: true, repeat: -1, delay: (i * 370) % 4000, hold: 100, repeatDelay: 1500 + (i % 4) * 700 });
    });
  }

  private drawOwnership(s: GameState, explored: boolean[]) {
    const g = this.ownerG;
    g.clear();
    s.tiles.forEach((tile, i) => {
      if (!tile.owner || !explored[i]) return;
      const col = colorOf(tile.owner);
      this.hexPoly(g, i, HEX - 1, s.width);
      g.fillStyle(col, 0.13); g.fillPath();
      const c = hexCenter(i, HEX, s.width);
      const inner = hexCorners(c.x, c.y, HEX - 3.5);
      for (let e = 0; e < 6; e++) {
        const n = neighborAcrossEdge(i, e, s.width, s.height);
        if (n >= 0 && s.tiles[n].owner === tile.owner) continue;
        const a = inner[e], b = inner[(e + 1) % 6];
        g.lineStyle(13, col, 0.12); g.lineBetween(a.x, a.y, b.x, b.y);
        g.lineStyle(8, col, 0.22); g.lineBetween(a.x, a.y, b.x, b.y);
        g.lineStyle(5, 0x0c0a08, 0.55); g.lineBetween(a.x, a.y, b.x, b.y);
        g.lineStyle(2.6, col, 1); g.lineBetween(a.x, a.y, b.x, b.y);
        g.lineStyle(1, 0xffffff, 0.35); g.lineBetween(a.x, a.y, b.x, b.y);
      }
    });
  }

  private drawFeatures(s: GameState) {
    const sig = s.tiles.map((t, i) => `${t.resource ?? ''}${t.ruin ? 'r' : ''}${s.explored[i] ? 'e' : ''}`).join(',');
    if (sig === this.featureSig) return;
    this.featureSig = sig;
    for (const o of this.features) o.destroy();
    this.features = [];
    s.tiles.forEach((tile, i) => {
      if (!s.explored[i]) return;
      const { x, y } = this.pos(i);
      if (tile.ruin) this.features.push(this.add.image(x, y - 6, 'ruin').setScale(INV * 1.15).setDepth(this.objectDepth(y, BIAS.feature)));
      if (tile.resource) this.features.push(this.add.image(x - 32, y + 15, `res-${tile.resource}`).setScale(INV * 0.85).setDepth(this.objectDepth(y + 15, BIAS.feature)));
    });
  }

  private drawCities(s: GameState) {
    const sig = s.cities.map(c => `${c.id}:${c.owner}:${c.level}:${c.name}:${s.explored[c.tile] ? 1 : 0}`).join(',');
    if (sig === this.citySig) return;
    this.citySig = sig;
    for (const o of this.cityObjs) o.destroy();
    this.cityObjs = [];
    for (const c of s.cities) {
      // A feltáratlan vidék városa nem látszik: a magas épületek kilógnának a köd alól.
      if (!s.explored[c.tile]) continue;
      const { x, y } = this.pos(c.tile);
      const name = `city-${c.level}-${c.owner}`;
      const depth = this.objectDepth(y, BIAS.city);
      if (hasSprite(name)) {
        this.cityObjs.push(placeSprite(this.add.image(x, y, '__DEFAULT'), name, CITY_SCALE[c.level - 1]).setDepth(depth));
      } else {
        this.cityObjs.push(this.add.image(x, y - 14, `city-${c.level}`).setScale(INV * 1.22).setDepth(depth));
        this.cityObjs.push(this.add.image(x - 30, y - 34, `flag-${c.owner}`).setScale(INV).setDepth(depth));
      }
      const label = this.add.text(x, y + 38, (c.capitalOf ? '★ ' : '') + c.name, LABEL).setOrigin(0.5).setResolution(3);
      this.labelLayer.add(label);
      this.cityObjs.push(label);
    }
  }

  /** A sereg teste: frakciószínű talp, hadijelvény és az összetétel szerinti figurák. */
  private buildArmyBody(body: Phaser.GameObjects.Container, a: Army) {
    body.removeAll(true);
    const col = colorOf(a.owner);
    const base = this.add.graphics();
    base.fillStyle(0x0c0a08, 0.4); base.fillEllipse(0, 3, 64, 64 * K);
    base.fillStyle(col, 0.5); base.fillEllipse(0, 2, 56, 56 * K);
    base.lineStyle(2, col, 0.95); base.strokeEllipse(0, 2, 56, 56 * K);
    body.add(base);
    const figures = armyFigures(a).filter(type => hasSprite(`unit-${type}-${a.owner}`));
    if (!figures.length) {
      body.add(this.add.image(0, -14, `token-${a.owner}`).setScale(INV * 0.92));
      return;
    }
    if (hasSprite(`banner-${a.owner}`)) body.add(placeSprite(this.add.image(4, -12, '__DEFAULT'), `banner-${a.owner}`, UNIT_SCALE));
    const slots = SLOTS[figures.length - 1];
    figures.forEach((type, i) => body.add(placeSprite(this.add.image(slots[i].x, slots[i].y, '__DEFAULT'), `unit-${type}-${a.owner}`, UNIT_SCALE)));
  }

  private syncArmies(s: GameState, visible: boolean[]) {
    const alive = new Set<string>();
    for (const a of s.armies) {
      alive.add(a.id);
      const p = this.pos(a.tile);
      // Városban a sereg a város elé áll.
      const hasCity = !!s.tiles[a.tile].cityId;
      const tx = p.x + (hasCity ? 38 : 0), ty = p.y + (hasCity ? 14 : 2);
      const lx = tx + (hasCity ? 34 : 0), ly = ty + (hasCity ? -34 : 0);
      let v = this.armies.get(a.id);
      if (v && v.owner !== a.owner) { v.body.destroy(); v.tag.destroy(); this.armies.delete(a.id); v = undefined; }
      if (!v) {
        const body = this.add.container(tx, ty);
        const emblem = this.add.image(-17, 21, `token-${a.owner}`).setScale(INV * 0.34);
        const label = this.add.text(2, 21, '', { ...LABEL, fontSize: '12px' }).setOrigin(0.5).setResolution(3);
        const dot = this.add.circle(22, 21, 4.5, 0x7be08a).setStrokeStyle(1.5, 0x14100a);
        const tag = this.add.container(lx, ly, [emblem, label, dot]);
        this.labelLayer.add(tag);
        v = { body, tag, label, dot, owner: a.owner, sig: '' };
        this.armies.set(a.id, v);
      } else if (v.body.x !== tx || v.body.y !== ty) {
        this.tweens.killTweensOf([v.body, v.tag]);
        this.tweens.add({ targets: v.body, x: tx, y: ty, duration: 240, ease: 'Sine.easeOut' });
        this.tweens.add({ targets: v.tag, x: lx, y: ly, duration: 240, ease: 'Sine.easeOut' });
      }
      const sig = armyFigures(a).join(',');
      if (sig !== v.sig) { v.sig = sig; this.buildArmyBody(v.body, a); }
      v.body.setDepth(this.objectDepth(ty, BIAS.army));
      v.label.setText(String(armyMen(a)));
      v.dot.setVisible(a.owner === s.playerId && a.moves > 0);
      v.body.setVisible(visible[a.tile]);
      v.tag.setVisible(visible[a.tile]);
    }
    for (const [id, v] of this.armies) if (!alive.has(id)) { v.body.destroy(); v.tag.destroy(); this.armies.delete(id); }
  }

  private drawHighlights(s: GameState) {
    const app = getApp();
    const g = this.hiG;
    g.clear();
    if (app.supplyView && app.supplyNet) {
      app.supplyNet.forEach((lv, i) => {
        if (!lv || !s.explored[i]) return;
        this.hexPoly(g, i, HEX - 6, s.width);
        g.fillStyle(lv === 2 ? 0x59d98a : 0xe8c84a, 0.34); g.fillPath();
        const a = hexCenter(i, HEX, s.width);
        for (const n of neighbors(i, s.width, s.height)) {
          if (n < i || !app.supplyNet![n]) continue;
          const b = hexCenter(n, HEX, s.width);
          g.lineStyle(3, lv === 2 && app.supplyNet![n] === 2 ? 0xd8ffe6 : 0xfff0a8, 0.75); g.lineBetween(a.x, a.y, b.x, b.y);
        }
      });
      for (const a of s.armies) {
        if (a.owner !== s.playerId) continue;
        const c = hexCenter(a.tile, HEX, s.width);
        g.lineStyle(5, a.supply >= 60 ? 0x59d98a : a.supply >= 30 ? 0xe8c84a : 0xe2553f, 1);
        g.strokeCircle(c.x, c.y, 34);
      }
    }
    const reach = app.reach;
    if (reach) {
      for (const [i] of reach.moves) {
        this.hexPoly(g, i, HEX - 5, s.width);
        g.fillStyle(0xfff3c4, 0.1); g.fillPath();
        g.lineStyle(2, 0xfff3c4, 0.7); g.strokePath();
      }
      for (const i of reach.attacks) {
        this.hexPoly(g, i, HEX - 5, s.width);
        g.fillStyle(0xe2382b, 0.34); g.fillPath();
        g.lineStyle(3.5, 0xff6a55, 0.95); g.strokePath();
      }
      for (const i of reach.merges) {
        this.hexPoly(g, i, HEX - 5, s.width);
        g.fillStyle(0x4aa3ff, 0.3); g.fillPath();
        g.lineStyle(3, 0x8cc6ff, 0.95); g.strokePath();
      }
    }
  }

  private drawSelection() {
    const app = getApp();
    const s = app.state;
    const g = this.selG;
    g.clear();
    if (!s) return;
    for (const a of s.armies) {
      if (a.owner !== s.playerId || a.goto === null) continue;
      const from = hexCenter(a.tile, HEX, s.width), to = hexCenter(a.goto, HEX, s.width);
      g.lineStyle(3, 0xf3e3b0, 0.7); g.lineBetween(from.x, from.y, to.x, to.y);
      g.fillStyle(0xf3e3b0, 0.9); g.fillCircle(to.x, to.y, 6);
    }
    const reach = app.reach, army = app.activeArmyObj();
    if (reach && army && this.hover >= 0 && reach.moves.has(this.hover)) {
      g.lineStyle(4, 0xffffff, 0.9);
      let cur = this.hover;
      for (let guard = 0; guard < 30 && cur !== army.tile && cur >= 0; guard++) {
        const prev = reach.prev[cur];
        if (prev < 0) break;
        const a = hexCenter(cur, HEX, s.width), b = hexCenter(prev, HEX, s.width);
        g.lineBetween(a.x, a.y, b.x, b.y);
        cur = prev;
      }
    }
    if (app.selectedTile !== null) {
      this.hexPoly(g, app.selectedTile, HEX - 2, s.width);
      g.lineStyle(6, 0x14100a, 0.6); g.strokePath();
      g.lineStyle(3.5, 0xffd866, 1); g.strokePath();
    }
  }

  /** A teljes dinamikus réteg frissítése az aktuális játékállapotból. */
  refresh() {
    const app = getApp();
    const s = app.state;
    if (!s || !this.sys.isActive()) return;
    const season = seasonOf(s.turn);
    if (season !== this.season) {
      this.season = season;
      s.tiles.forEach((tile, i) => {
        this.tileImgs[i].setTexture(`g-${tile.terrain}-${season}-${i % GROUND_VARIANTS}`);
        this.decorImgs[i].setTexture(`d-${tile.terrain}-${season}-${i % TERRAIN_VARIANTS}`);
      });
      for (const m of this.motes) m.setTexture(`mote-${season}`);
    }
    // A feltáratlan mezők domborzata rejtve marad, különben a csúcsok kilógnának a köd alól.
    s.tiles.forEach((tile, i) => this.decorImgs[i].setVisible(!tile.cityId && s.explored[i]));
    this.drawOwnership(s, s.explored);
    this.drawFeatures(s);
    this.drawCities(s);
    this.syncArmies(s, app.visible);
    s.tiles.forEach((_t, i) => this.fogImgs[i].setAlpha(app.visible[i] ? 0 : s.explored[i] ? 0.5 : 1));
    this.drawHighlights(s);
    this.drawSelection();
  }

  /** Rövid villanás egy mezőn (csata, építkezés). */
  pulse(tile: number, color: number) {
    const s = getApp().state;
    if (!s || !this.sys.isActive()) return;
    const { x, y } = this.pos(tile);
    const ring = this.add.circle(x, y, 20, color, 0.5).setDepth(DEPTH.fx).setScale(1, K);
    this.tweens.add({ targets: ring, scaleX: 3.2, scaleY: 3.2 * K, alpha: 0, duration: 520, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
  }
}
