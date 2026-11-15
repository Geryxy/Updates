import type { GameApp } from '../app/GameApp';
import { Season } from '../game/GameState';
import { seasonOf } from '../game/SeasonSystem';
import { t } from '../i18n';
import { isTauri } from '../platform/Platform';
import './ArmyPanel';
import './CityPanel';
import './DiplomacyPanel';
import './ResearchPanel';
import { renderBottom, renderTop } from './HUD';
import { menuState, refreshSlots, renderMenu } from './MenuScreen';
import { playOutcomeSound } from './Modals';
import { settingsInput } from './SettingsPanel';
import { renderSide } from './SidePanel';
import { ICON } from './dom';
import { actions, modals } from './registry';
import { TUTORIAL_STEPS, advanceTutorial } from './Tasks';

interface OpenModal { name: string; data: Record<string, unknown> }

/** A DOM-alapú kezelőfelület kerete: képernyők, sávok, felugró ablakok, billentyűk. */
export class UI {
  private el = {
    hud: document.getElementById('hud')!, top: document.getElementById('top')!, side: document.getElementById('side')!,
    bottom: document.getElementById('bottom')!, screen: document.getElementById('screen')!, modal: document.getElementById('modal-root')!,
    toast: document.getElementById('toast')!, busy: document.getElementById('busy')!, fx: document.getElementById('season-fx')!,
  };
  private modal: OpenModal | null = null;
  private queue: OpenModal[] = [];
  private toastTimer = 0;
  private outcomeShown = false;

  constructor(private app: GameApp) {
    actions.open = (_a, [name, back]) => this.openModal(name, back ? { back } : {});
    actions['modal:close'] = () => this.closeModal();
    actions.deselect = a => a.select(null);
    document.addEventListener('click', e => this.onClick(e));
    document.addEventListener('input', e => this.onInput(e));
    document.addEventListener('change', e => this.onInput(e));
    document.addEventListener('keydown', e => this.onKey(e));
    // iOS Safari: a lap saját nagyítási és visszarugózó gesztusainak tiltása.
    document.addEventListener('gesturestart', e => e.preventDefault());
    document.addEventListener('dblclick', e => e.preventDefault());
    this.el.busy.innerHTML = `<div>${ICON.hourglass}<span>${t('ui.aiTurn')}</span></div>`;
  }

  // ---------- Képernyők ----------
  async showMenu() {
    this.modal = null; this.queue = []; this.outcomeShown = false;
    menuState.view = 'main';
    await refreshSlots(this.app);
    this.el.hud.hidden = true;
    this.el.screen.hidden = false;
    this.el.fx.className = '';
    this.render();
  }

  showGame() {
    this.modal = null; this.queue = []; this.outcomeShown = false;
    this.el.screen.hidden = true;
    this.el.hud.hidden = false;
  }

  render() {
    const app = this.app;
    if (!app.state) {
      this.el.screen.innerHTML = renderMenu();
    } else {
      this.el.top.innerHTML = renderTop(app);
      const side = renderSide(app);
      const scroll = this.el.side.scrollTop;
      this.el.side.innerHTML = side;
      this.el.side.classList.toggle('empty', !side);
      this.el.side.scrollTop = scroll;
      this.el.bottom.innerHTML = renderBottom(app);
      this.el.fx.className = `fx-${seasonOf(app.state.turn)}${app.settings.quality === 'low' ? ' still' : ''}`;
    }
    this.renderModal();
  }

  // ---------- Felugró ablakok ----------
  modalOpen() { return !!this.modal; }

  openModal(name: string, data: Record<string, unknown> = {}, queued = false) {
    if (!modals[name]) return;
    if (name === 'economy') this.app.flag('economy');
    if (queued && this.modal) { this.queue.push({ name, data }); return; }
    this.modal = { name, data };
    this.renderModal(true);
  }

  closeModal(all = false) {
    if (all) this.queue = [];
    this.modal = this.queue.shift() ?? null;
    this.renderModal(true);
  }

  private renderModal(resetScroll = false) {
    const root = this.el.modal;
    if (!this.modal) { root.innerHTML = ''; root.hidden = true; return; }
    const def = modals[this.modal.name];
    const body = root.querySelector('.modal');
    const scroll = !resetScroll && body ? body.scrollTop : 0;
    root.hidden = false;
    root.innerHTML = `<div class="backdrop${def.locked ? ' locked' : ''}"><div class="modal${def.wide ? ' wide' : ''} m-${this.modal.name}" role="dialog" aria-modal="true">
      ${def.locked ? '' : `<button class="x" data-act="modal:close" title="${t('ui.close')}">${ICON.close}</button>`}
      ${def.render(this.app, this.modal.data)}</div></div>`;
    const now = root.querySelector('.modal');
    if (now) now.scrollTop = scroll;
  }

  /** A kör végén és betöltéskor: jelentések, ajánlatok, események sorban egymás után. */
  afterTurn(newSeason: Season | null) {
    const s = this.app.state;
    if (!s) return;
    this.tutorialProgress();
    if (s.outcome) return;
    if (newSeason) this.toast(`${t(`season.${newSeason}`)} – ${t(`season.${newSeason}.fx`)}`, 5200);
    this.showReports();
    if (s.proposals.length) this.openModal('proposal', {}, true);
    if (s.pendingEvent) this.openModal('event', {}, true);
  }

  showReports() {
    const s = this.app.state;
    if (!s) return;
    for (const report of s.reports.splice(0)) this.openModal('report', { report }, true);
  }

  showOutcome() {
    if (this.outcomeShown || !this.app.state?.outcome) return;
    this.outcomeShown = true;
    playOutcomeSound(this.app);
    this.openModal('end', {}, true);
  }

  tutorialProgress() {
    const s = this.app.state;
    if (!s?.tutorial) return;
    const fresh = s.tutorial.step === 0 && !s.tutorial.flags.intro;
    if (fresh) s.tutorial.flags.intro = true;
    if (advanceTutorial(s) || fresh) {
      this.app.audio.play('coin');
      this.el.bottom.innerHTML = renderBottom(this.app);
      this.openModal('tutorial', {}, true);
      if (s.tutorial.step >= TUTORIAL_STEPS) this.toast(t('tut.done'), 5000);
    }
  }

  toast(text: string, ms = 2600) {
    if (!text) return;
    const el = this.el.toast;
    el.textContent = text;
    el.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => el.classList.remove('show'), ms);
  }

  setBusy(on: boolean) { this.el.busy.hidden = !on; }

  // ---------- Események ----------
  private onClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.classList?.contains('backdrop') && !target.classList.contains('locked')) return this.closeModal();
    const el = target.closest?.('[data-act]') as HTMLElement | null;
    if (!el || (el as HTMLButtonElement).disabled) return;
    const fn = actions[el.dataset.act!];
    if (!fn) return;
    this.app.audio.unlock();
    if (!el.classList.contains('quiet')) this.app.audio.play('click');
    fn(this.app, (el.dataset.arg ?? '').split('|'), el);
  }

  private onInput(e: Event) {
    const el = e.target as HTMLInputElement;
    if (el.dataset?.input === 'settings') settingsInput(this.app, el.dataset.arg!, el);
  }

  private onKey(e: KeyboardEvent) {
    const app = this.app;
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return;
    if (e.key === 'F11' && isTauri) {
      e.preventDefault();
      return void app.updateSettings({ fullscreen: !app.settings.fullscreen });
    }
    if (e.key === 'Escape') {
      if (this.modal) { if (!modals[this.modal.name].locked) this.closeModal(); }
      else if (!app.state) { if (menuState.view === 'new') { menuState.view = 'main'; this.render(); } }
      else if (app.activeArmy || app.selectedTile !== null) app.select(null);
      else this.openModal('gamemenu');
      return;
    }
    if (!app.state || e.ctrlKey || e.metaKey || e.altKey) {
      if (app.state && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); actions['saves:save'](app, ['slot1'], document.body); }
      return;
    }
    if (this.modal) {
      if (e.key === 'Enter' && this.modal.name === 'report') this.closeModal();
      return;
    }
    const open = (name: string) => this.openModal(name);
    switch (e.key.toLowerCase()) {
      case 'enter': case 'e': app.endTurn(); break;
      case 'd': open('diplomacy'); break;
      case 'k': case 'r': open('research'); break;
      case 'g': open('economy'); break;
      case 'l': open('log'); break;
      case 'u': app.toggleSupply(); break;
      case 'n': case 'tab': e.preventDefault(); app.nextArmy(); break;
      case 'c': actions.home(app, [], document.body); break;
      case '+': case '=': app.mapScene?.zoomBy(1.25); break;
      case '-': app.mapScene?.zoomBy(0.8); break;
      case 'f1': e.preventDefault(); open('help'); break;
    }
  }
}
