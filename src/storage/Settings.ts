import { isTauri, native } from '../platform/Platform';

export interface Settings {
  music: number;
  sfx: number;
  muted: boolean;
  fullscreen: boolean;
  /** Ablakméret ablakos módban (csak Windows). */
  windowSize: string;
  quality: 'low' | 'medium' | 'high';
}

export const DEFAULT_SETTINGS: Settings = { music: 0.5, sfx: 0.7, muted: false, fullscreen: false, windowSize: '1280x720', quality: 'high' };
export const WINDOW_SIZES = ['1024x640', '1280x720', '1366x768', '1600x900', '1920x1080'];
const KEY = 'kod-koronaja-settings';

function sanitize(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Settings>;
  const num = (v: unknown, d: number) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : d);
  return {
    music: num(r.music, DEFAULT_SETTINGS.music),
    sfx: num(r.sfx, DEFAULT_SETTINGS.sfx),
    muted: r.muted === true,
    fullscreen: r.fullscreen === true,
    windowSize: WINDOW_SIZES.includes(r.windowSize ?? '') ? r.windowSize! : DEFAULT_SETTINGS.windowSize,
    quality: r.quality === 'low' || r.quality === 'medium' ? r.quality : 'high',
  };
}

/** A launcher és a játék ugyanazt a beállításfájlt használja, így nem mondhatnak ellent egymásnak. */
export async function loadSettings(): Promise<Settings> {
  try {
    const text = isTauri ? await native<string | null>('settings_read') : localStorage.getItem(KEY);
    return sanitize(text ? JSON.parse(text) : null);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  const text = JSON.stringify(s);
  try {
    if (isTauri) await native('settings_write', { data: text });
    else localStorage.setItem(KEY, text);
  } catch { /* a beállítás mentése nem kritikus */ }
}
