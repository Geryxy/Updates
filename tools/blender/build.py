"""A Köd Koronája 3D-s képeinek előállítása.

Használat (a tároló gyökeréből):
    pip install bpy pillow
    python tools/blender/build.py                 # minden hiányzó vagy elavult kép
    python tools/blender/build.py --only 'city-5-*'   # csak a mintára illők
    python tools/blender/build.py --force         # minden újrarenderelése
    python tools/blender/build.py --pack-only     # csak az atlaszok újracsomagolása

Kimenet: public/sprites/*.webp (képatlaszok és felületi képek), src/render/sprites.json (leíró).
"""
import argparse
import fnmatch
import hashlib
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
CACHE = os.path.join(HERE, '.cache')
sys.path.insert(0, HERE)

from kk import atlas, core  # noqa: E402


def collect():
    from kk import cities
    modules = [cities]
    for optional in ('units', 'terrain'):
        try:
            modules.append(__import__(f'kk.{optional}', fromlist=[optional]))
        except ImportError:
            pass
    jobs = []
    for module in modules:
        with open(module.__file__, 'rb') as f:
            source = f.read()
        for job in module.jobs():
            job['module'] = source
            jobs.append(job)
    return jobs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', action='append', default=[])
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--pack-only', action='store_true')
    args = ap.parse_args()
    os.makedirs(CACHE, exist_ok=True)

    shared = b''
    for name in ('core.py', 'props.py', 'palette.py'):
        with open(os.path.join(HERE, 'kk', name), 'rb') as f:
            shared += f.read()

    jobs = collect()
    meta, rendered, started = {}, 0, time.time()
    initialised = False
    for job in jobs:
        name = job['name']
        png, info_path = os.path.join(CACHE, f'{name}.png'), os.path.join(CACHE, f'{name}.json')
        digest = hashlib.sha1(shared + job['module'] + repr((job['px'], job['frame'], job['target_z'], job['samples'])).encode()).hexdigest()
        info = None
        if os.path.exists(png) and os.path.exists(info_path):
            with open(info_path, encoding='utf-8') as f:
                info = json.load(f)
        selected = not args.only or any(fnmatch.fnmatch(name, pat) for pat in args.only)
        stale = info is None or info.get('digest') != digest
        if not args.pack_only and selected and (stale or args.force):
            if not initialised:
                core.init()
                initialised = True
            t0 = time.time()
            core.clear()
            job['build']()
            res = core.render(png, job['px'], job['frame'], job['target_z'], job['samples'], **job.get('render', {}))
            info = dict(digest=digest, ax=res['ax'], ay=res['ay'], u=res['ppu'] * job['hex_r'])
            with open(info_path, 'w', encoding='utf-8') as f:
                json.dump(info, f)
            rendered += 1
            print(f'✓ {name} ({time.time() - t0:.1f} s)', flush=True)
        if info is None:
            print(f'– {name}: még nincs lerenderelve, kimarad az atlaszból')
            continue
        meta[name] = dict(page=job['page'], ax=info['ax'], ay=info['ay'], u=info['u'], ui=job.get('ui'), shadow=job.get('shadow', 1.0))

    print(f'{rendered} kép renderelve {time.time() - started:.0f} s alatt; csomagolás…')
    atlas.build(CACHE, os.path.join(ROOT, 'public', 'sprites'), os.path.join(ROOT, 'src', 'render', 'sprites.json'),
                meta, core.TILT_DEG, core.GROUND_K)


if __name__ == '__main__':
    main()
