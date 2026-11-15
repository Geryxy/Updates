import type Phaser from 'phaser';
import { AudioManager } from '../audio/AudioManager';
import { previewBattle } from '../game/CombatSystem';
import {
  Army, FactionId, GameState, armyAt, armyById, capitalOf, cityAt,
} from '../game/GameState';
import { Reach, executeMove, findPath, reachable } from '../game/MovementSystem';
import { NewGameOptions, newGame } from '../game/NewGame';
import { seasonOf } from '../game/SeasonSystem';
import { supplyNetwork } from '../game/SupplySystem';
import { endTurn } from '../game/TurnManager';
import { updateExplored } from '../game/VisionSystem';
import { t } from '../i18n';
import { isTauri, native } from '../platform/Platform';
import type { WorldMapScene } from '../scenes/WorldMapScene';
import { AUTO_SLOT, SaveManager } from '../storage/SaveManager';
import { Settings, loadSettings, saveSettings } from '../storage/Settings';
import { UI } from '../ui/UI';
import { createPhaser, resizePhaser } from './GameConfig';
import { setApp } from './context';

/**
 * Az alkalmazás vezérlője: összeköti a játékállapotot, a térképjelenetet és a kezelőfelületet.
 * A szabályokat kizárólag a game/ rendszerei módosítják; ez az osztály csak meghívja őket.
 */
export class GameApp {
  state: GameState | null = null;
  settings!: Settings;
  audio!: AudioManager;
  saves = new SaveManager();
  ui!: UI;
  phaser!: Phaser.Game;
  mapScene: WorldMapScene | null = null;
  selectedTile: number | null = null;
  activeArmy: string | null = null;
  visible: boolean[] = [];
  reach: Reach | null = null;
  supplyView = false;
  supplyNet: number[] | null = null;
  busy = false;
  private booted = false;
  private wantScene: 'Menu' | 'WorldMap' = 'Menu';

  async init() {
    setApp(this);
    (window as unknown as { kodKoronaja: GameApp }).kodKoronaja = this;
    this.settings = await loadSettings();
    this.audio = new AudioManager(this.settings);
    this.ui = new UI(this);
    const host = document.getElementById('game')!;
    this.phaser = createPhaser(host, this.settings.quality);
    const onResize = () => { resizePhaser(this.phaser, host, this.settings.quality); this.ui.render(); };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', () => setTimeout(onResize, 250));
    const unlock = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', () => { if (document.hidden) void this.autosave(); });
    this.audio.setTrack('menu');
    await this.ui.showMenu();
  }

  /** A BootScene jelzi, hogy a textúrák elkészültek. */
  onBooted() {
    this.booted = true;
    this.phaser.scene.start(this.wantScene);
    document.getElementById('boot')?.remove();
  }

  private switchScene(key: 'Menu' | 'WorldMap') {
    this.wantScene = key;
    if (!this.booted) return;
    const other = key === 'Menu' ? 'WorldMap' : 'Menu';
    this.mapScene = null;
    this.phaser.scene.stop(other);
    this.phaser.scene.stop(key);
    this.phaser.scene.start(key);
  }

  async updateSettings(patch: Partial<Settings>) {
    const qualityChanged = patch.quality !== undefined && patch.quality !== this.settings.quality;
    this.settings = { ...this.settings, ...patch };
    this.audio.apply(this.settings);
    await saveSettings(this.settings);
    if (patch.fullscreen !== undefined && isTauri) void native('set_fullscreen', { on: patch.fullscreen }).catch(() => undefined);
    if (qualityChanged) resizePhaser(this.phaser, document.getElementById('game')!, this.settings.quality);
  }

  // ---------- Játék indítása és elhagyása ----------
  startNew(opts: NewGameOptions) {
    this.enter(newGame(opts));
    void this.autosave();
  }

  enter(state: GameState) {
    this.state = state;
    this.activeArmy = null;
    this.supplyView = false;
    const cap = capitalOf(state, state.playerId);
    this.selectedTile = cap ? cap.tile : null;
    const home = cap ? armyAt(state, cap.tile) : undefined;
    this.activeArmy = home && home.owner === state.playerId ? home.id : null;
    this.audio.setTrack('game');
    this.ui.showGame();
    this.switchScene('WorldMap');
    this.changed();
    // A HUD kirajzolása után igazítjuk a kamerát a látható térképrész közepére.
    window.setTimeout(() => { if (this.selectedTile !== null) this.mapScene?.centerOn(this.selectedTile); }, 150);
    this.ui.afterTurn(null);
  }

  async toMenu() {
    await this.autosave();
    this.state = null;
    this.mapScene = null;
    this.audio.setTrack('menu');
    this.switchScene('Menu');
    await this.ui.showMenu();
  }

  async autosave() {
    if (this.state) await this.saves.save(AUTO_SLOT, this.state);
  }

  // ---------- Állapotfrissítés ----------
  activeArmyObj(): Army | null {
    const a = this.state && this.activeArmy ? armyById(this.state, this.activeArmy) : null;
    return a && a.owner === this.state!.playerId ? a : null;
  }

  /** Minden állapotváltozás után hívandó: újraszámolja a láthatóságot és frissíti a megjelenítést. */
  changed() {
    const s = this.state;
    if (!s) return;
    this.visible = updateExplored(s);
    const army = this.activeArmyObj();
    if (!army) this.activeArmy = null;
    this.reach = army && !s.outcome ? reachable(s, army) : null;
    this.supplyNet = this.supplyView ? supplyNetwork(s, s.playerId) : null;
    this.ui.render();
    this.mapScene?.refresh();
    if (s.outcome) this.ui.showOutcome();
  }

  flag(name: string) {
    const tut = this.state?.tutorial;
    if (tut && !tut.flags[name]) { tut.flags[name] = true; this.ui.tutorialProgress(); }
  }

  select(tile: number | null, army: string | null = null) {
    this.selectedTile = tile;
    this.activeArmy = army;
    this.changed();
  }

  focus(tile: number) {
    const s = this.state!;
    const a = armyAt(s, tile);
    this.select(tile, a && a.owner === s.playerId ? a.id : null);
    this.mapScene?.centerOn(tile);
  }

  /** Mezőre kattintás vagy koppintás. A másodlagos gomb (jobb klikk) közvetlen menetparancs. */
  tileClicked(tile: number, secondary: boolean) {
    const s = this.state;
    if (!s || this.busy || this.ui.modalOpen()) return;
    if (cityAt(s, tile)?.capitalOf === s.playerId) this.flag('capital');
    const army = this.activeArmyObj();
    if (army && tile !== army.tile && this.reach && !s.outcome) {
      if (this.reach.attacks.has(tile)) return this.ui.openModal('battle', { tile });
      if (this.reach.moves.has(tile) || this.reach.merges.has(tile) || secondary) return this.move(tile);
    }
    const here = armyAt(s, tile);
    if (here && here.owner === s.playerId && this.visible[tile]) {
      this.audio.play('click');
      return this.select(tile, here.id);
    }
    this.audio.play('click');
    if (tile === this.selectedTile && !army) return this.select(null);
    // Aktív hadsereg mellett a távoli mező csak kijelölődik; a panel felajánlja a menetelést.
    this.select(tile, army && tile !== army.tile ? army.id : null);
  }

  canMarch(tile: number): boolean {
    const s = this.state, army = this.activeArmyObj();
    return !!s && !!army && tile !== army.tile && !armyAt(s, tile) && !!findPath(s, army, tile);
  }

  /** Mozgás, egyesítés, támadás vagy többkörös menet végrehajtása az aktív hadsereggel. */
  move(target: number) {
    const s = this.state, army = this.activeArmyObj();
    if (!s || !army || s.outcome) return;
    const id = army.id;
    const res = executeMove(s, id, target);
    if (!res.ok) {
      this.audio.play('error');
      if (res.reason) this.ui.toast(res.reason);
      return this.changed();
    }
    const after = armyById(s, id);
    if (res.kind === 'attack') {
      this.audio.play('battle');
      this.mapScene?.pulse(target, 0xff5a3c);
      this.flag('fought');
    } else {
      this.audio.play('move');
      this.flag('moved');
    }
    this.selectedTile = after ? after.tile : res.kind === 'merge' ? target : this.selectedTile;
    this.activeArmy = after ? after.id : res.kind === 'merge' ? armyAt(s, target)?.id ?? null : null;
    this.changed();
    this.ui.showReports();
  }

  battlePreview(tile: number) {
    const army = this.activeArmyObj();
    return army && this.state ? previewBattle(this.state, army, tile) : null;
  }

  nextArmy() {
    const s = this.state;
    if (!s) return;
    const list = s.armies.filter(a => a.owner === s.playerId && a.moves > 0 && a.goto === null);
    if (!list.length) return this.ui.toast(t('ui.noIdleArmy'));
    const idx = list.findIndex(a => a.id === this.activeArmy);
    this.focus(list[(idx + 1) % list.length].tile);
  }

  toggleSupply() {
    this.supplyView = !this.supplyView;
    this.flag('supply');
    this.changed();
  }

  /** A kör lezárása: az AI lép, lezajlik az elszámolás, majd automatikus mentés készül. */
  endTurn() {
    const s = this.state;
    if (!s || this.busy || s.outcome) return;
    if (s.pendingEvent) return this.ui.openModal('event');
    this.busy = true;
    this.audio.play('turn');
    this.ui.setBusy(true);
    const seasonBefore = seasonOf(s.turn);
    window.setTimeout(() => {
      endTurn(s);
      this.busy = false;
      this.ui.setBusy(false);
      if (!armyById(s, this.activeArmy ?? '')) this.activeArmy = null;
      const seasonNow = seasonOf(s.turn);
      if (seasonNow !== seasonBefore && !s.outcome) this.audio.play('season');
      this.changed();
      void this.autosave();
      this.ui.afterTurn(seasonNow !== seasonBefore ? seasonNow : null);
    }, 260);
  }

  playerId(): FactionId { return this.state!.playerId; }
}
