import { hu } from './hu';

export type Dict = Record<string, string>;
const dictionaries: Record<string, Dict> = { hu };
let current: Dict = hu;

/** Nyelvváltás: új szótárat a `dictionaries` táblába kell felvenni (pl. en.ts). */
export function setLanguage(lang: string) {
  current = dictionaries[lang] ?? hu;
}

export function t(key: string, params?: Record<string, string | number>): string {
  let text = current[key] ?? hu[key] ?? key;
  if (params) for (const k in params) text = text.split(`{${k}}`).join(String(params[k]));
  return text;
}
export const hasKey = (key: string) => key in hu;
