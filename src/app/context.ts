import type { GameApp } from './GameApp';

/** A futó alkalmazás példánya; a jelenetek és a panelek ezen keresztül érik el a vezérlőt. */
let instance: GameApp;
export const setApp = (a: GameApp) => { instance = a; };
export const getApp = (): GameApp => instance;
