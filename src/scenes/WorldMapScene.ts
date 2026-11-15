import Phaser from 'phaser';
import { pixelRatio } from '../app/GameConfig';
import { getApp } from '../app/context';
import { FACTIONS, NEUTRAL_COLOR } from '../data/factions';
import { GameState, OwnerId, armyMen, capitalOf } from '../game/GameState';
import { seasonOf } from '../game/SeasonSystem';
import { DECOR_ANCHOR_Y, staticLayerCanvas } from '../render/TerrainArt';
import { HEX, HEX_W, TEX_SCALE } from '../render/TextureFactory';
import { hexCenter, hexCorners, neighborAcrossEdge, neighbors } from '../world/HexMap';
import { FOG_VARIANTS, GROUND_VARIANTS, TERRAIN_VARIANTS } from './BootScene';

const INV = 1 / TEX_SCALE;
const colorOf = (o: OwnerId | null) => (o && o !== 'neutral' ? FACTIONS[o].color : NEUTRAL_COLOR);
const LABEL: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'Georgia, "Times New Roman", serif', fontSize: '13px', color: '#f6ecd0', stroke: '#14100a', strokeThickness: 4,
};

interface ArmyView { box: Phaser.GameObjects.Container; token: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; dot: Phaser.GameObjects.Arc; owner: OwnerId }

/** A stratégiai világtérkép megjelenítése és kezelése (egér, görgő, érintés, kétujjas nagyítás). */
export class WorldMapScene extends Phaser.Scene {
  private tileImgs: Phaser.GameObjects.Image[] = [];
  private decorImgs: Phaser.GameObjects.Image[] = [];
  private motes: Phaser.GameObjects.Image[] = [];
  private fogImgs: Phaser.GameObjects.Image[] = [];
  private ownerG!: Phaser.GameObjects.Graphics;
  private hiG!: Phaser.GameObjects.Graphics;
  private selG!: Phaser.GameObjects.Graphics;
  private featureLayer!: Phaser.GameObjects.Container;
  private cityLayer!: Phaser.GameObjects.Container;
  private armyLayer!: Phaser.GameObjects.Container;
  private armies = new Map<string, ArmyView>();
  private featureSig = '';
  private citySig = '';
  private season = '';
  private worldW = HEX_W * 11.5;
  private worldH = HEX * 1.5 * 10 + HEX * 2;
  private userZoom = 1;
  private drag = { active: false, moved: false, x: 0, y: 0, id: -1 };
  private pinch = { active: false, dist: 0, zoom: 1 };
  private hover = -1;

  constructor() { super('WorldMap'); }

  create() {
    const app = getApp();
    const s = app.state!;
    this.tileImgs = []; this.decorImgs = []; this.motes = []; this.fogImgs = []; this.armies.clear();
    this.featureSig = ''; this.citySig = ''; this.season = '';
    this.worldW = HEX_W * (s.width + 0.5);
    this.worldH = HEX * 1.5 * (s.height - 1) + HEX * 2;

    s.tiles.forEach((_t, i) => {
      const { x, y } = hexCenter(i, HEX, s.width);
      this.tileImgs.push(this.add.image(x, y, '__DEFAULT').setScale(INV).setDepth(0));
    });
    if (this.textures.exists('static-map')) this.textures.remove('static-map');
    this.textures.addCanvas('static-map', staticLayerCanvas(s.tiles, s.width, s.height));
    this.add.image(0, 0, 'static-map').setOrigin(0).setScale(INV).setDepth(1);
    this.ownerG = this.add.graphics().setDepth(2);
    this.hiG = this.add.graphics().setDepth(3);
    this.featureLayer = this.add.container(0, 0).setDepth(4.5);
    s.tiles.forEach((tile, i) => {
      const { x, y } = hexCenter(i, HEX, s.width);
      this.decorImgs.push(this.add.image(x, y, '__DEFAULT').setOrigin(0.5, DECOR_ANCHOR_Y).setScale(INV).setDepth(4 + y * 0.0001).setVisible(!tile.cityId));
    });
    this.cityLayer = this.add.container(0, 0).setDepth(5);
    this.armyLayer = this.add.container(0, 0).setDepth(6);
    const animate = app.settings.quality !== 'low';
    if (animate) this.addAmbience(s);
    s.tiles.forEach((_t, i) => {
      const { x, y } = hexCenter(i, HEX, s.width);
      const fog = this.add.image(x, y, `fog-${i % FOG_VARIANTS}`).setScale(INV).setDepth(7);
      if (animate) this.tweens.add({ targets: fog, scale: INV * 1.12, duration: 4200 + (i % 7) * 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.fogImgs.push(fog);
    });
    this.selG = this.add.graphics().setDepth(8);

    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.zoomAt(p.x, p.y, this.userZoom * (dy > 0 ? 0.88 : 1.14)));
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.onResize, this));

    this.userZoom = Math.max(this.minZoom(), Math.min(1.15, this.fitZoom() * 1.9));
    this.applyZoom();
    const cap = capitalOf(s, s.playerId);
    this.centerOn(cap ? cap.tile : Math.floor(s.tiles.length / 2));
    app.mapScene = this;
    this.refresh();
  }

  // ---------- Kamera ----------
  private dpr() { return pixelRatio(getApp().settings.quality); }
  private fitZoom() {
    const cam = this.cameras.main, d = this.dpr();
    return Math.min(cam.width / d / this.worldW, cam.height / d / this.worldH);
  }
  private minZoom() { return this.fitZoom() * 0.8; }
  private applyZoom() {
    this.userZoom = Phaser.Math.Clamp(this.userZoom, this.minZoom(), 2.6);
    this.cameras.main.setZoom(this.userZoom * this.dpr());
  }
  private clampScroll() {
    const cam = this.cameras.main;
    const cx = Phaser.Math.Clamp(cam.scrollX + cam.width / 2, 0, this.worldW);
    const cy = Phaser.Math.Clamp(cam.scrollY + cam.height / 2, 0, this.worldH);
    cam.setScroll(cx - cam.width / 2, cy - cam.height / 2);
    getApp().ui.minimapDirty();
  }
  /** A kamera által látott világrész (a minitérkép keretéhez). */
  viewRect() {
    const cam = this.cameras.main, w = cam.width / cam.zoom, h = cam.height / cam.zoom;
    return { x: cam.scrollX + cam.width / 2 - w / 2, y: cam.scrollY + cam.height / 2 - h / 2, w, h };
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
    const { x, y } = hexCenter(tile, HEX, getApp().state!.width);
    const cam = this.cameras.main, c = this.viewCenter(), d = this.dpr();
    cam.setScroll(x - cam.width / 2 - (c.x * d - cam.width / 2) / cam.zoom, y - cam.height / 2 - (c.y * d - cam.height / 2) / cam.zoom);
    this.clampScroll();
  }
  private onResize() { this.applyZoom(); this.clampScroll(); }

  private tileAt(px: number, py: number): number {
    const s = getApp().state!;
    const w = this.toWorld(px, py);
    let best = -1, bd = HEX * HEX;
    for (let i = 0; i < s.tiles.length; i++) {
      const c = hexCenter(i, HEX, s.width);
      const d = (c.x - w.x) ** 2 + (c.y - w.y) ** 2;
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
  private hexPoly(g: Phaser.GameObjects.Graphics, i: number, size: number, w: number) {
    const c = hexCenter(i, HEX, w);
    g.beginPath();
    hexCorners(c.x, c.y, size).forEach((pt, k) => (k ? g.lineTo(pt.x, pt.y) : g.moveTo(pt.x, pt.y)));
    g.closePath();
  }

  /** Hangulatelemek: vonuló felhőárnyékok, lebegő fényszemcsék, vízcsillanás. */
  private addAmbience(s: GameState) {
    for (let i = 0; i < 6; i++) {
      const y = (this.worldH / 6) * i + Math.random() * 120;
      const cloud = this.add.image(-400 - Math.random() * 600, y, 'cloud').setScale(2.2 + Math.random() * 1.6, 1.3 + Math.random()).setDepth(6.4).setAlpha(0.55);
      this.tweens.add({ targets: cloud, x: this.worldW + 500, duration: 60000 + Math.random() * 50000, repeat: -1, delay: i * 5000 });
    }
    for (let i = 0; i < 34; i++) {
      const mote = this.add.image(Math.random() * this.worldW, Math.random() * this.worldH, 'mote-spring').setDepth(6.6).setAlpha(0).setScale(0.5 + Math.random() * 0.6);
      this.motes.push(mote);
      this.tweens.add({ targets: mote, alpha: 0.85, y: mote.y - 30 - Math.random() * 40, x: mote.x + (Math.random() - 0.5) * 50, duration: 3200 + Math.random() * 3600, yoyo: true, repeat: -1, delay: Math.random() * 5000, ease: 'Sine.easeInOut' });
    }
    s.tiles.forEach((tile, i) => {
      if (!tile.river || i % 2) return;
      const { x, y } = hexCenter(i, HEX, s.width);
      const glint = this.add.image(x + ((i * 13) % 20) - 10, y + 11, 'glint').setDepth(1.5).setAlpha(0).setScale(0.6, 0.35);
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
    const sig = s.tiles.map(t => `${t.resource ?? ''}${t.ruin ? 'r' : ''}`).join(',');
    if (sig === this.featureSig) return;
    this.featureSig = sig;
    this.featureLayer.removeAll(true);
    s.tiles.forEach((tile, i) => {
      const { x, y } = hexCenter(i, HEX, s.width);
      if (tile.ruin) this.featureLayer.add(this.add.image(x, y - 2, 'ruin').setScale(INV * 1.15));
      if (tile.resource) this.featureLayer.add(this.add.image(x - 30, y + 24, `res-${tile.resource}`).setScale(INV * 0.85));
    });
  }

  private drawCities(s: GameState) {
    const sig = s.cities.map(c => `${c.id}:${c.owner}:${c.level}:${c.name}`).join(',');
    if (sig === this.citySig) return;
    this.citySig = sig;
    this.cityLayer.removeAll(true);
    for (const c of s.cities) {
      const { x, y } = hexCenter(c.tile, HEX, s.width);
      this.cityLayer.add(this.add.image(x, y - 14, `city-${c.level}`).setScale(INV * 1.22));
      this.cityLayer.add(this.add.image(x - 30, y - 34, `flag-${c.owner}`).setScale(INV));
      const label = this.add.text(x, y + 30, (c.capitalOf ? '★ ' : '') + c.name, LABEL).setOrigin(0.5).setResolution(3);
      this.cityLayer.add(label);
    }
  }

  private syncArmies(s: GameState, visible: boolean[]) {
    const alive = new Set<string>();
    for (const a of s.armies) {
      alive.add(a.id);
      const { x, y } = hexCenter(a.tile, HEX, s.width);
      const hasCity = !!s.tiles[a.tile].cityId;
      const tx = x + (hasCity ? 30 : 0), ty = y + (hasCity ? -6 : -4);
      let v = this.armies.get(a.id);
      if (v && v.owner !== a.owner) { v.box.destroy(); this.armies.delete(a.id); v = undefined; }
      if (!v) {
        const token = this.add.image(0, 0, `token-${a.owner}`).setScale(INV * 0.92);
        const label = this.add.text(0, 24, '', { ...LABEL, fontSize: '12px' }).setOrigin(0.5).setResolution(3);
        const dot = this.add.circle(15, -20, 5, 0x7be08a).setStrokeStyle(1.5, 0x14100a);
        const box = this.add.container(tx, ty, [token, label, dot]);
        this.armyLayer.add(box);
        v = { box, token, label, dot, owner: a.owner };
        this.armies.set(a.id, v);
      } else if (v.box.x !== tx || v.box.y !== ty) {
        this.tweens.killTweensOf(v.box);
        this.tweens.add({ targets: v.box, x: tx, y: ty, duration: 240, ease: 'Sine.easeOut' });
      }
      v.label.setText(String(armyMen(a)));
      v.dot.setVisible(a.owner === s.playerId && a.moves > 0);
      v.box.setVisible(visible[a.tile]);
    }
    for (const [id, v] of this.armies) if (!alive.has(id)) { v.box.destroy(); this.armies.delete(id); }
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
        g.strokeCircle(c.x, c.y - 4, 30);
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
    s.tiles.forEach((tile, i) => this.decorImgs[i].setVisible(!tile.cityId));
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
    const { x, y } = hexCenter(tile, HEX, s.width);
    const ring = this.add.circle(x, y, 20, color, 0.5).setDepth(9);
    this.tweens.add({ targets: ring, scale: 3.2, alpha: 0, duration: 520, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
  }
}
