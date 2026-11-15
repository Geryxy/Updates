import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { UNIT_TYPES } from '../src/data/units';
import manifest from '../src/render/sprites.json';
import { armyFigures } from '../src/scenes/figures';
import type { Army } from '../src/game/GameState';

const OWNERS = ['szikra', 'moha', 'vaskapu', 'volgyek', 'neutral'];
const sprites = manifest.sprites as unknown as Record<string, number[]>;

describe('3D-s képkészlet', () => {
  it('minden városszinthez és tulajdonoshoz van városkép (térképen és a felületen)', () => {
    for (const owner of OWNERS) for (let level = 1; level <= 5; level++) {
      const name = `city-${level}-${owner}`;
      expect(sprites[name], name).toBeDefined();
      expect(existsSync(`public/sprites/ui/${name}.webp`), `${name} felületi képe`).toBe(true);
    }
  });
  it('minden egységtípusnak külön modellje van minden tulajdonos színeiben', () => {
    for (const owner of OWNERS) {
      for (const type of UNIT_TYPES) {
        const name = `unit-${type}-${owner}`;
        expect(sprites[name], name).toBeDefined();
        expect(existsSync(`public/sprites/ui/${name}.webp`), `${name} felületi képe`).toBe(true);
      }
      expect(sprites[`banner-${owner}`]).toBeDefined();
    }
  });
  it('az atlaszlapok léteznek, a képek a lapon belül vannak, a talajpont értelmes', () => {
    for (const page of manifest.pages) expect(existsSync(`public/sprites/${page}`), page).toBe(true);
    for (const [name, [page, x, y, w, h, ax, ay, u]] of Object.entries(sprites)) {
      expect(page, name).toBeLessThan(manifest.pages.length);
      expect(x >= 0 && y >= 0 && w > 4 && h > 4 && x + w <= 2048 && y + h <= 2048, name).toBe(true);
      expect(ax > -8 && ax < w + 8 && ay > 0 && ay < h + 8, `${name} talajpontja`).toBe(true);
      expect(u).toBeGreaterThan(50);
    }
  });
});

describe('seregek megjelenítése figurákkal', () => {
  const army = (...types: [string, number][]): Army =>
    ({ id: 'a', owner: 'szikra', name: '', tile: 0, morale: 80, supply: 100, moves: 0, xp: 0, goto: null,
       squads: types.map(([type, count]) => ({ type, count })) } as Army);
  it('osztagonként egy figura, legfeljebb három', () => {
    expect(armyFigures(army(['scout', 100]))).toEqual(['scout']);
    expect(armyFigures(army(['militia', 100], ['militia', 100]))).toEqual(['militia', 'militia']);
    expect(armyFigures(army(['spear', 100], ['spear', 100], ['spear', 100], ['spear', 100])).length).toBe(3);
  });
  it('a figurák a sereg összetételét mutatják, a nagy testű egységek hátul állnak', () => {
    const figs = armyFigures(army(['militia', 100], ['militia', 100], ['spear', 100], ['scout', 100]));
    expect([...figs].sort()).toEqual(['militia', 'scout', 'spear']);
    const mixed = armyFigures(army(['spear', 100], ['cavalry', 90], ['siege', 80]));
    expect(mixed[mixed.length - 1]).toBe('spear');
  });
});
