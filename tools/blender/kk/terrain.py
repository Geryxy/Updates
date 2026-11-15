"""Terepmodellek: erdő, hegység, dombvidék, mocsár, síkság – évszakonként három változatban – és romok.

A talaj maga a játékban festett réteg; itt csak a rajta álló domborzat és növényzet készül.
"""
import math
import random

from . import core
from . import props as P
from .core import ball, blob, box, cyl, limb, mat, rock, xf  # noqa: F401
from .palette import SEASONS

import bmesh  # noqa: E402  (a core/bpy betöltése után érhető el)

HEX_R = 7.2
FRAME = 17.0
TARGET_Z = 3.0
TERRAINS = ('plains', 'forest', 'hills', 'mountain', 'swamp')
VARIANTS = 3
SNOW = {'spring': 0.0, 'summer': 0.0, 'autumn': 0.0, 'winter': 0.7}
HILL = {'spring': '#55803c', 'summer': '#56743a', 'autumn': '#76663a', 'winter': '#8f9a8a'}
# E magasság fölött marad meg a hó a csúcsokon.
SNOW_LINE = {'spring': 5.6, 'summer': 6.6, 'autumn': 6.0, 'winter': 1.6}


def _spots(rng, count, r0, r1, min_dist=0.0, taken=None):
    """Véletlen helyek a mező körgyűrűjében, egymástól adott távolságra."""
    out, taken = [], taken if taken is not None else []
    for _ in range(count * 40):
        if len(out) >= count:
            break
        a, d = rng.uniform(0, 2 * math.pi), math.sqrt(rng.uniform((r0 / r1) ** 2 if r1 else 0, 1)) * r1
        x, y = math.cos(a) * d, math.sin(a) * d
        if all((x - px) ** 2 + (y - py) ** 2 >= min_dist ** 2 for px, py in taken):
            out.append((x, y))
            taken.append((x, y))
    return sorted(out, key=lambda p: -p[1])


def peak(rng, r, h, material, seg=14, rings=6, lean=(0.0, 0.0)):
    """Csipkézett sziklacsúcs: gyűrűnként elforgatott, zajos kúp, váltakozó gerincekkel és vájatokkal."""
    bm = bmesh.new()
    apex = bm.verts.new((lean[0], lean[1], h))
    ridge = [1.0 + (0.24 if j % 2 == 0 else -0.14) * rng.uniform(0.6, 1.2) for j in range(seg)]
    levels = []
    for i in range(1, rings + 1):
        t = i / rings
        ring = []
        for j in range(seg):
            a = 2 * math.pi * (j + (0.5 if i % 2 else 0.0)) / seg + rng.uniform(-0.08, 0.08)
            rr = r * t ** 0.85 * ridge[j] * (1 + rng.uniform(-0.12, 0.12))
            z = 0.0 if i == rings else h * (1 - t ** rng.uniform(0.62, 0.95)) * (1 + rng.uniform(-0.1, 0.1))
            ring.append(bm.verts.new((lean[0] * (1 - t) + math.cos(a) * rr, lean[1] * (1 - t) + math.sin(a) * rr, max(0.0, z))))
        levels.append(ring)
    for j in range(seg):
        bm.faces.new((apex, levels[0][j], levels[0][(j + 1) % seg]))
    for i in range(rings - 1):
        for j in range(seg):
            a, b = levels[i][j], levels[i][(j + 1) % seg]
            c, d = levels[i + 1][(j + 1) % seg], levels[i + 1][j]
            bm.faces.new((a, d, c, b))
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return core.finish(bm, material, name='peak')


def mound(rng, r, h, material, seg=18, rings=7):
    """Lankás, füves domb harang alakú metszettel."""
    bm = bmesh.new()
    apex = bm.verts.new((0, 0, h))
    levels = []
    for i in range(1, rings + 1):
        t = i / rings
        ring = []
        for j in range(seg):
            a = 2 * math.pi * (j + (0.5 if i % 2 else 0.0)) / seg
            rr = r * t * (1 + rng.uniform(-0.07, 0.07))
            z = 0.0 if i == rings else h * (1 - t * t) ** 2 * (1 + rng.uniform(-0.05, 0.05))
            ring.append(bm.verts.new((math.cos(a) * rr, math.sin(a) * rr * 0.85, z)))
        levels.append(ring)
    for j in range(seg):
        bm.faces.new((apex, levels[0][j], levels[0][(j + 1) % seg]))
    for i in range(rings - 1):
        for j in range(seg):
            bm.faces.new((levels[i][j], levels[i + 1][j], levels[i + 1][(j + 1) % seg], levels[i][(j + 1) % seg]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return core.finish(bm, material, smooth=True, name='mound')


def dead_tree(rng, s=1.0, snow=0.0):
    bark = mat('#3a3028', noise=0.2, scale=9, snow=snow)
    top = (rng.uniform(-0.15, 0.15) * s, rng.uniform(-0.1, 0.1) * s, 2.5 * s)
    limb((0, 0, 0), top, 0.17 * s, 0.07 * s, bark, seg=7)
    for i in range(5):
        a = i * 1.3 + rng.uniform(-0.4, 0.4)
        z0 = (1.1 + i * 0.28) * s
        start = (top[0] * z0 / (2.5 * s), top[1] * z0 / (2.5 * s), z0)
        length = rng.uniform(0.6, 1.05) * s
        end = (start[0] + math.cos(a) * length, start[1] + math.sin(a) * length, z0 + rng.uniform(0.3, 0.75) * s)
        limb(start, end, 0.07 * s, 0.025 * s, bark, seg=5)
        if rng.random() < 0.6:
            tip = (end[0] + math.cos(a + 0.6) * 0.35 * s, end[1] + math.sin(a + 0.6) * 0.35 * s, end[2] + 0.3 * s)
            limb(end, tip, 0.03 * s, 0.012 * s, bark, seg=4)


def reeds(rng, season, count=6, s=1.0):
    stalk = mat({'spring': '#5f8a3c', 'summer': '#557a35', 'autumn': '#9a8a4a', 'winter': '#a39a78'}[season], noise=0.15, scale=12)
    head = mat('#5a3d22', noise=0.1)
    for _ in range(count):
        x, y = rng.uniform(-0.4, 0.4) * s, rng.uniform(-0.4, 0.4) * s
        h = rng.uniform(0.9, 1.6) * s
        lean = (rng.uniform(-0.15, 0.15), rng.uniform(-0.15, 0.15))
        limb((x, y, 0), (x + lean[0], y + lean[1], h), 0.035 * s, 0.022 * s, stalk, seg=4)
        if rng.random() < 0.7:
            limb((x + lean[0] * 0.95, y + lean[1] * 0.95, h * 0.95), (x + lean[0] * 1.1, y + lean[1] * 1.1, h * 1.2), 0.06 * s, 0.05 * s, head, seg=5)


def glow_mushrooms(rng, count=3):
    cap = mat('#10c890', emit='#00e0a0', strength=3.0, noise=0)
    stem = mat('#d8e8d8', noise=0.05)
    for _ in range(count):
        x, y, s = rng.uniform(-0.35, 0.35), rng.uniform(-0.35, 0.35), rng.uniform(0.7, 1.2)
        limb((x, y, 0), (x, y, 0.22 * s), 0.035 * s, 0.03 * s, stem, seg=5)
        ball(0.12 * s, (x, y, 0.24 * s), cap, scale=(1, 1, 0.6), seg=8)


def log_pile(rng):
    wood = mat('#5a3d22', noise=0.2, scale=10)
    for i, (dy, z) in enumerate(((-0.22, 0.14), (0.0, 0.14), (0.22, 0.14), (-0.11, 0.36), (0.11, 0.36))):
        limb((-0.7, dy, z), (0.7, dy, z), 0.13, 0.13, wood, seg=8)


def scarecrow(rng):
    wood = mat('#5a3d22', noise=0.2, scale=10)
    limb((0, 0, 0), (0, 0, 1.7), 0.05, 0.04, wood, seg=5)
    limb((-0.7, 0, 1.25), (0.7, 0, 1.25), 0.04, 0.04, wood, seg=5)
    cyl(0.3, 0.2, 0.75, (0, 0, 0.7), mat('#7a5a3a', noise=0.2, scale=10), seg=8)
    ball(0.2, (0, 0, 1.6), mat('#c9ac55', noise=0.15, scale=18), seg=8)
    cyl(0.34, 0.3, 0.04, (0, 0, 1.72), mat('#4a3626', noise=0.1), seg=10)
    cyl(0.18, 0.1, 0.2, (0, 0, 1.75), mat('#4a3626', noise=0.1), seg=8)


def flowers(rng, count, spread):
    for _ in range(count):
        a, d = rng.uniform(0, 6.28), rng.uniform(0, spread)
        ball(0.09, (math.cos(a) * d, math.sin(a) * d, 0.1), mat(rng.choice(['#f2e6a0', '#e98ab0', '#ffffff', '#c9a0f0']), noise=0), seg=6)


# ---------- Tereptípusok ----------
def forest(rng, season, v):
    snow = SNOW[season]
    share = (0.55, 0.85, 0.25)[v]
    taken = []
    for x, y in _spots(rng, 19 if v != 2 else 16, 0.0, 6.0, 1.25, taken):
        with xf((x, y, 0)):
            s = rng.uniform(1.7, 2.5)
            if rng.random() < share:
                P.conifer(rng, season, s, snow)
            else:
                blossom = season == 'spring' and rng.random() < 0.22
                P.broadleaf(rng, season, s * 0.95, snow, color=rng.choice(['#f2b6cf', '#fbe9f0']) if blossom else None)
    for x, y in _spots(rng, 5, 0.0, 5.8, 0.9, taken):
        with xf((x, y, 0)):
            P.bush(rng, season, rng.uniform(1.4, 2.0), snow)
    if v == 1:
        with xf((-1.2, -4.9, 0), 0.4):
            log_pile(rng)
    for x, y in _spots(rng, 3, 3.5, 6.0, 0.8, taken):
        with xf((x, y, 0)):
            P.boulders(rng, mat('#6a6a70', scale=4, bump=0.7, snow=snow), 2, 0.4, 0.4)


STONES = ('#4f596b', '#575d6d', '#4b5464')


def mountain(rng, season, v):
    layouts = (
        [(0.3, 1.0, 4.4, 10.4), (-3.3, -0.4, 3.2, 7.0), (3.6, -0.8, 3.0, 6.2)],
        [(-1.2, 0.8, 4.3, 9.8), (2.9, 0.5, 3.6, 8.2), (-0.2, -3.0, 2.6, 4.8)],
        [(1.0, 0.7, 4.6, 10.8), (-3.0, 1.3, 3.3, 7.6), (-1.6, -2.9, 2.5, 4.6), (3.5, -2.2, 2.3, 4.2)],
    )[v]
    for i, (x, y, r, h) in enumerate(layouts):
        stone = mat(STONES[(v + i) % 3], noise=0.26, scale=1.1, bump=1.0, snow=SNOW[season] * 0.75, snow_line=SNOW_LINE[season])
        with xf((x, y, 0), rng.uniform(0, 6.28)):
            peak(rng, r, h * rng.uniform(0.95, 1.05), stone, lean=(rng.uniform(-0.6, 0.6), rng.uniform(-0.4, 0.4)))
    boulder = mat('#5c5f66', noise=0.2, scale=3, bump=0.8, snow=SNOW[season])
    for x, y in _spots(rng, 10, 3.8, 6.3, 0.9):
        r = rng.uniform(0.35, 0.85)
        rock(r, (x, y, r * 0.35), boulder, rng, squash=0.8)
    for x, y in _spots(rng, 3 if v else 2, 4.6, 6.2, 1.2):
        if y < 1.5:
            with xf((x, y, 0)):
                P.conifer(rng, season, rng.uniform(1.4, 1.9), SNOW[season])


def hills(rng, season, v):
    snow = SNOW[season] * 1.15
    grass = mat(HILL[season], noise=0.24, scale=1.3, bump=0.45, rough=1.0, snow=snow)
    layouts = (
        [(-2.4, 1.6, 3.9, 2.1), (2.5, 0.9, 3.5, 1.8), (0.2, -2.6, 3.2, 1.4)],
        [(0.0, 1.8, 4.4, 2.4), (-3.0, -1.6, 3.0, 1.4), (3.0, -2.0, 3.1, 1.5)],
        [(-1.6, 0.4, 4.0, 1.9), (2.6, 2.2, 3.1, 1.7), (2.4, -2.4, 3.0, 1.3), (-3.4, -2.8, 2.4, 1.0)],
    )[v]
    crag = mat('#6e6c68', noise=0.22, scale=3, bump=0.8, snow=SNOW[season])
    for x, y, r, h in layouts:
        with xf((x, y, 0), rng.uniform(0, 6.28)):
            mound(rng, r, h, grass)
            # Sziklakibúvás a domb oldalán.
            for k in range(2):
                a = rng.uniform(0, 6.28)
                rr = rng.uniform(0.3, 0.5) * h
                rock(rr, (math.cos(a) * r * 0.42, math.sin(a) * r * 0.36, h * 0.5), crag, rng, squash=0.7)
    boulder = mat('#77736c', noise=0.2, scale=3, bump=0.8, snow=SNOW[season])
    for x, y in _spots(rng, 6, 1.0, 6.0, 1.0):
        r = rng.uniform(0.25, 0.55)
        rock(r, (x, y, r * 0.3), boulder, rng)
    for x, y, r, h in layouts:
        for k in range(3):
            a, d = rng.uniform(0, 6.28), rng.uniform(0.2, 0.6) * r
            z = h * (1 - (d / r) ** 2) ** 2
            with xf((x + math.cos(a) * d, y + math.sin(a) * d * 0.85, z - 0.08)):
                P.bush(rng, season, rng.uniform(0.9, 1.3), SNOW[season])
    for i, (x, y) in enumerate(_spots(rng, 4 if v == 2 else 3, 3.0, 6.0, 1.6)):
        with xf((x, y, 0)):
            if i % 2 == 0:
                P.tree(rng, season, rng.uniform(1.5, 2.0), 0.5, SNOW[season])
            else:
                P.bush(rng, season, rng.uniform(1.4, 2.0), SNOW[season])


def swamp(rng, season, v):
    snow = SNOW[season]
    taken = []
    for x, y in _spots(rng, (4, 3, 5)[v], 0.5, 5.6, 2.2, taken):
        with xf((x, y, 0), rng.uniform(0, 6.28)):
            dead_tree(rng, rng.uniform(1.5, 2.1), snow)
    for x, y in _spots(rng, 15, 0.0, 6.1, 0.95, taken):
        with xf((x, y, 0)):
            reeds(rng, season, rng.randint(6, 9), rng.uniform(1.4, 1.9))
    moss = mat({'spring': '#4f7a3a', 'summer': '#486f35', 'autumn': '#6a6a32', 'winter': '#7b8c7e'}[season], noise=0.2, scale=6, snow=snow)
    for x, y in _spots(rng, 5, 0.5, 5.8, 1.0, taken):
        blob(rng.uniform(0.7, 1.2), (x, y, 0.08), moss, rng, squash=0.4)
    if season != 'winter':
        for x, y in _spots(rng, 3, 1.0, 5.0, 1.5, taken):
            with xf((x, y, 0), scale=1.8):
                glow_mushrooms(rng, rng.randint(2, 4))
    if v == 1:
        with xf((1.5, -3.6, 0), -0.5):
            limb((-1.0, 0, 0.18), (1.1, 0.1, 0.24), 0.2, 0.16, mat('#3a3028', noise=0.2, scale=9, snow=snow), seg=8)


def plains(rng, season, v):
    snow = SNOW[season]
    taken = []
    if v == 0:
        for x, y in _spots(rng, 2, 1.5, 5.0, 3.0, taken):
            with xf((x, y, 0)):
                P.broadleaf(rng, season, rng.uniform(1.9, 2.4), snow)
        for x, y in _spots(rng, 4, 0.5, 5.6, 1.6, taken):
            with xf((x, y, 0)):
                P.bush(rng, season, rng.uniform(1.4, 2.0), snow)
    elif v == 1:
        straw = mat('#a8955c', rough=1.0, scale=18, bump=0.4, snow=snow)
        for x, y in ((-2.2, 1.0), (-1.1, 2.1)):
            blob(rng.uniform(0.62, 0.78), (x, y, 0.52), straw, rng, squash=1.1, rough=0.08)
        with xf((2.3, -1.4, 0), 0.3):
            scarecrow(rng)
        for x, y in _spots(rng, 3, 2.0, 5.6, 1.6, taken):
            with xf((x, y, 0)):
                P.bush(rng, season, rng.uniform(1.3, 1.8), snow)
    else:
        boulder = mat('#77736c', noise=0.2, scale=3, bump=0.8, snow=snow)
        for x, y, r in ((1.8, 1.6, 1.0), (2.9, 0.9, 0.6), (1.1, 0.7, 0.45)):
            rock(r, (x, y, r * 0.4), boulder, rng, squash=0.8)
        with xf((-2.6, 0.4, 0)):
            P.tree(rng, season, 2.2, 0.5, snow)
        for x, y in _spots(rng, 3, 1.0, 5.6, 1.8, taken):
            with xf((x, y, 0)):
                P.bush(rng, season, rng.uniform(1.3, 1.9), snow)
    if season == 'spring':
        for x, y in _spots(rng, 5, 0.5, 5.5, 1.2, taken):
            with xf((x, y, 0)):
                flowers(rng, rng.randint(4, 7), 0.7)
    if season == 'autumn' and v == 1:
        for x, y in _spots(rng, 5, 0.5, 3.0, 0.7, taken):
            ball(0.3, (x + 1.0, y - 3.0, 0.24), mat('#d9772a', noise=0.12, scale=8), scale=(1, 1, 0.8), seg=10)


def ruin(rng, v):
    """Ősi rom: megdőlt oszlopok, boltív, lehullott kövek és egy halványan izzó kristály."""
    stone = mat('#b9b4a6', noise=0.2, scale=3, bump=0.7)
    dark = mat('#8a8578', noise=0.2, scale=3, bump=0.7)
    ivy = mat('#3f7a35', scale=9)
    crystal = mat('#8fd8ff', emit='#6fc8ff', strength=7.0, noise=0)
    core.disc(2.9, (0, 0, 0.012), core.patch_mat('#7d7a70', 2.3), h=0.012, seg=40)

    def column(x, y, h, broken=True):
        cyl(0.36, 0.36, 0.16, (x, y, 0), dark, seg=10)
        cyl(0.27, 0.25, h, (x, y, 0.16), stone, seg=10)
        if not broken:
            cyl(0.36, 0.36, 0.16, (x, y, 0.16 + h), dark, seg=10)

    if v == 0:
        column(-1.5, 0.9, 2.6, broken=False)
        column(0.2, 1.3, 2.6, broken=False)
        box(2.4, 0.5, 0.36, (-0.65, 1.1, 2.92), dark, rot_z=math.atan2(0.4, 1.7))
        column(1.7, 0.4, 1.4)
        column(-0.7, -1.2, 0.9)
        column(1.2, -1.3, 1.9)
    else:
        for i in range(6):
            a = i * math.pi / 3 + 0.3
            column(math.cos(a) * 1.9, math.sin(a) * 1.9, (2.5, 1.2, 1.9, 0.7, 2.2, 1.5)[i], broken=i != 0)
        cyl(1.0, 1.1, 0.25, (0, 0, 0), dark, seg=8)
    for _ in range(7):
        a, d = rng.uniform(0, 6.28), rng.uniform(0.6, 2.6)
        s = rng.uniform(0.25, 0.5)
        box(s * 1.4, s, s * 0.8, (math.cos(a) * d, math.sin(a) * d, 0), stone, rot_z=rng.uniform(0, 3))
    for _ in range(5):
        a, d = rng.uniform(0, 6.28), rng.uniform(0.8, 2.4)
        blob(0.3, (math.cos(a) * d, math.sin(a) * d, 0.18), ivy, rng, squash=0.6)
    cyl(0.22, 0.0, 0.75, (0.1, -0.2, 0.2 if v else 0.0), crystal, seg=6, smooth=False)
    cyl(0.12, 0.0, 0.45, (0.38, -0.05, 0.2 if v else 0.0), crystal, seg=6, smooth=False)
    core.point_light((0.15, -0.3, 0.9), '#7fd0ff', 30.0, 0.2)


BUILDERS = dict(plains=plains, forest=forest, hills=hills, mountain=mountain, swamp=swamp)


def build(terrain, season, v):
    rng = random.Random(TERRAINS.index(terrain) * 1009 + v * 97 + 13)  # az elrendezés évszaktól független
    BUILDERS[terrain](rng, season, v)


def jobs():
    for season in SEASONS:
        for terrain in TERRAINS:
            for v in range(VARIANTS):
                yield dict(name=f'decor-{terrain}-{season}-{v}', page=f'terrain-{season}',
                           build=lambda t=terrain, s=season, i=v: build(t, s, i),
                           px=384, frame=FRAME, target_z=TARGET_Z, hex_r=HEX_R, samples=48, shadow=0.75)
    for v in range(2):
        yield dict(name=f'ruin-{v}', page='units', build=lambda i=v: ruin(random.Random(40 + i), i),
                   px=256, frame=9.0, target_z=1.4, hex_r=HEX_R, samples=56, shadow=0.75)

