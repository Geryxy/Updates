import type { Settings } from '../storage/Settings';

export type Sfx = 'click' | 'build' | 'battle' | 'victory' | 'defeat' | 'season' | 'move' | 'error' | 'coin' | 'turn';
type Track = 'menu' | 'game' | null;

const SCALE = [0, 2, 3, 5, 7, 8, 10]; // természetes moll
const freq = (semi: number) => 220 * Math.pow(2, semi / 12);

/**
 * Teljesen szintetizált hang (WebAudio): nincs letöltendő hangfájl, így offline is működik.
 * Mobilon a böngésző csak felhasználói interakció után enged hangot – az unlock() ezt kezeli.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private track: Track = null;
  private timer: number | null = null;
  private nextBeat = 0;
  private beat = 0;
  private settings: Settings;

  constructor(settings: Settings) { this.settings = settings; }

  /** Az első érintéskor/kattintáskor hívandó. */
  unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      const delay = this.ctx.createDelay(1);
      const fb = this.ctx.createGain();
      delay.delayTime.value = 0.42; fb.gain.value = 0.32;
      this.musicGain.connect(this.ctx.destination);
      this.musicGain.connect(delay); delay.connect(fb); fb.connect(delay); fb.connect(this.ctx.destination);
      this.sfxGain.connect(this.ctx.destination);
      this.apply(this.settings);
      this.schedule();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  apply(settings: Settings) {
    this.settings = settings;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicGain.gain.setTargetAtTime(settings.muted ? 0 : settings.music * 0.5, t, 0.05);
    this.sfxGain.gain.setTargetAtTime(settings.muted ? 0 : settings.sfx, t, 0.02);
  }

  setTrack(track: Track) {
    if (this.track === track) return;
    this.track = track;
    this.beat = 0;
    if (this.ctx) this.nextBeat = this.ctx.currentTime + 0.1;
  }

  private tone(dest: AudioNode, f: number, start: number, dur: number, vol: number, type: OscillatorType = 'sine', attack = 0.01) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type; osc.frequency.value = f;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(vol, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g); g.connect(dest);
    osc.start(start); osc.stop(start + dur + 0.05);
  }

  private noise(start: number, dur: number, vol: number, filterFreq: number, sweepTo?: number) {
    const ctx = this.ctx!;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.setValueAtTime(filterFreq, start);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, start + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filter); filter.connect(g); g.connect(this.sfxGain);
    src.start(start);
  }

  /** Egyszerű generatív zene: lassú akkordszőnyeg és hárfaszerű dallam. */
  private schedule() {
    if (this.timer !== null) return;
    this.timer = window.setInterval(() => {
      const ctx = this.ctx;
      if (!ctx || !this.track || ctx.state !== 'running') return;
      const beatLen = this.track === 'menu' ? 0.9 : 0.75;
      if (this.nextBeat < ctx.currentTime) this.nextBeat = ctx.currentTime + 0.05;
      while (this.nextBeat < ctx.currentTime + 0.6) {
        const b = this.beat++, t = this.nextBeat;
        const bar = Math.floor(b / 8) % 4;
        const root = [0, -4, -2, -7][bar] + (this.track === 'menu' ? -2 : 0);
        if (b % 8 === 0) for (const iv of [0, 7, 12, 15]) this.tone(this.musicGain, freq(root - 12 + iv), t, beatLen * 8.5, 0.05, 'triangle', 1.2);
        const pattern = this.track === 'menu' ? [0, 2, 4, 2, 5, 4, 2, 1] : [0, 4, 2, 5, 4, 2, 6, 4];
        const hash = (b * 2654435761) >>> 0;
        if (hash % 5 !== 0) {
          const deg = pattern[b % 8] + (hash % 7 === 0 ? 2 : 0);
          const semi = root + SCALE[deg % 7] + 12 * Math.floor(deg / 7) + 12;
          this.tone(this.musicGain, freq(semi), t, beatLen * 2.2, 0.07, 'sine', 0.008);
          this.tone(this.musicGain, freq(semi) * 2, t, beatLen * 0.8, 0.015, 'sine', 0.005);
        }
        this.nextBeat += beatLen;
      }
    }, 150);
  }

  play(sfx: Sfx) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.settings.muted || this.settings.sfx <= 0) return;
    const t = ctx.currentTime + 0.005;
    const d = this.sfxGain;
    switch (sfx) {
      case 'click': this.tone(d, 880, t, 0.06, 0.12, 'triangle', 0.002); break;
      case 'error': this.tone(d, 160, t, 0.18, 0.2, 'square', 0.005); break;
      case 'coin': this.tone(d, 1320, t, 0.12, 0.12, 'sine', 0.002); this.tone(d, 1760, t + 0.07, 0.2, 0.12, 'sine', 0.002); break;
      case 'move': this.noise(t, 0.09, 0.25, 300); this.noise(t + 0.12, 0.09, 0.2, 260); break;
      case 'turn': this.tone(d, 392, t, 0.5, 0.12, 'triangle', 0.01); this.tone(d, 294, t + 0.12, 0.7, 0.1, 'triangle', 0.01); break;
      case 'build':
        for (let i = 0; i < 3; i++) { this.noise(t + i * 0.16, 0.07, 0.5, 1800); this.tone(d, 520 - i * 30, t + i * 0.16, 0.08, 0.12, 'square', 0.002); }
        break;
      case 'battle':
        this.noise(t, 0.5, 0.5, 900, 200);
        for (let i = 0; i < 4; i++) this.tone(d, 900 + i * 240, t + 0.05 + i * 0.09, 0.14, 0.09, 'sawtooth', 0.002);
        this.tone(d, 70, t, 0.5, 0.35, 'sine', 0.005);
        break;
      case 'victory': [0, 4, 7, 12, 16].forEach((s, i) => this.tone(d, freq(s + 3), t + i * 0.14, i === 4 ? 1.2 : 0.3, 0.16, 'triangle', 0.01)); break;
      case 'defeat': [7, 3, 0, -5].forEach((s, i) => this.tone(d, freq(s - 12), t + i * 0.3, 0.8, 0.16, 'sawtooth', 0.03)); break;
      case 'season':
        this.noise(t, 1.4, 0.18, 400, 2400);
        [0, 7, 12].forEach((s, i) => this.tone(d, freq(s + 5), t + i * 0.1, 1.4, 0.07, 'sine', 0.3));
        break;
    }
  }
}
