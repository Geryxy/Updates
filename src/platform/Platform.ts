/**
 * Platformréteg: a Windows-os Tauri alkalmazás és a böngészős (iPhone/PWA) változat
 * közötti különbségeket rejti el. A játéklogika ebből semmit sem lát.
 */
import { invoke } from '@tauri-apps/api/core';

export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
export const APP_VERSION: string = __APP_VERSION__;

export async function native<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return invoke<T>(cmd, args);
}

export const isTouch = typeof window !== 'undefined' && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window);
export const isStandalone = typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true);

export function registerServiceWorker() {
  if (isTauri || !('serviceWorker' in navigator) || import.meta.env.DEV) return;
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => undefined); });
}
