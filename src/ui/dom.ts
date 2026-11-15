import { RES_KEYS, Resources } from '../game/GameState';
import { t } from '../i18n';
import { resIconUrl } from '../render/TextureFactory';

export const esc = (v: unknown) => String(v).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
export const fmt = (n: number) => Math.floor(n).toLocaleString('hu-HU');
export const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
export const pct = (v: number) => `${Math.round(v * 100)}%`;

export const resIcon = (k: keyof Resources) => `<img class="ico" src="${resIconUrl(k)}" alt="${t(`res.${k}`)}" title="${t(`res.${k}`)}">`;

/** Költség megjelenítése; a hiányzó tételek pirossal jelennek meg. */
export function costHtml(cost: Partial<Resources>, have?: Resources): string {
  const parts = RES_KEYS.filter(k => cost[k]).map(k =>
    `<span class="cost${have && have[k] < cost[k]! ? ' lack' : ''}">${resIcon(k)}${cost[k]}</span>`);
  return parts.length ? `<span class="costs">${parts.join('')}</span>` : '';
}

export function gainHtml(res: Partial<Resources>): string {
  return RES_KEYS.filter(k => res[k]).map(k =>
    `<span class="cost ${res[k]! < 0 ? 'neg' : 'pos'}">${resIcon(k)}${signed(res[k]!)}</span>`).join('');
}

export const bar = (value: number, cls = '') =>
  `<span class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, Math.round(value)))}%"></i></span>`;

interface BtnOpts { arg?: string; cls?: string; disabled?: boolean; title?: string }
/** Műveletgomb. A letiltott gomb megmutatja az okát (title + alsó sor). */
export function btn(label: string, act: string, o: BtnOpts = {}): string {
  return `<button class="btn ${o.cls ?? ''}" data-act="${act}"${o.arg !== undefined ? ` data-arg="${esc(o.arg)}"` : ''}${o.disabled ? ' disabled' : ''}${o.title ? ` title="${esc(o.title)}"` : ''}>${label}</button>`;
}

const svg = (d: string) => `<svg class="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICON = {
  diplomacy: svg('<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/><path d="M9 8h6M9 11h4"/>'),
  research: svg('<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M8 15h8"/>'),
  economy: svg('<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7"/><path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>'),
  supply: svg('<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8 17c5 0 3-10 8-10"/>'),
  menu: svg('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  next: svg('<path d="M5 12h13M13 6l6 6-6 6"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  home: svg('<path d="M4 11l8-7 8 7"/><path d="M6 10v9h12v-9"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  tasks: svg('<path d="M5 6l2 2 3-3M5 13l2 2 3-3M5 20l2 2 3-3M13 7h7M13 14h7M13 21h7" transform="translate(0 -2)"/>'),
  hourglass: svg('<path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9"/>'),
};
