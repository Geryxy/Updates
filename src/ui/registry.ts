import type { GameApp } from '../app/GameApp';

export type ActionFn = (app: GameApp, args: string[], el: HTMLElement) => void;
export interface ModalDef {
  render(app: GameApp, data: Record<string, unknown>): string;
  /** A játékosnak döntenie kell: nem zárható be a háttérre kattintva vagy ESC-kel. */
  locked?: boolean;
  wide?: boolean;
}

/** A panelek ide regisztrálják a gombjaik műveleteit és a felugró ablakaikat. */
export const actions: Record<string, ActionFn> = {};
export const modals: Record<string, ModalDef> = {};
