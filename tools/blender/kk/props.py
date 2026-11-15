"""Újrahasználható építőelemek: zászlók, házak, sátrak, falak, tornyok, fák."""
import math

from . import core
from .core import ball, blob, box, cyl, gable, limb, mat, pyramid, quad, rock, xf
from .palette import LEAVES


def flag(m, h=1.0, w=0.7, loc=(0, 0, 0), thick=0.035):
    """Zászlórúd lobogóval; a lobogó a +X irányba áll."""
    x, y, z = loc
    limb((x, y, z), (x, y, z + h), thick, thick * 0.8, m.wood, seg=8)
    quad([(x + 0.02, y, z + h), (x + w, y, z + h - 0.05), (x + w * 0.8, y, z + h - w * 0.3),
          (x + w, y, z + h - w * 0.58), (x + 0.02, y, z + h - w * 0.6)], m.flag)
    ball(thick * 1.9, (x, y, z + h + thick), m.gold, seg=8)


def banner(m, h=2.2, w=0.6, loc=(0, 0, 0)):
    """Álló hadijelvény keresztrúddal (táborok és seregek jelzője)."""
    x, y, z = loc
    limb((x, y, z), (x, y, z + h), 0.05, 0.04, m.wood, seg=8)
    limb((x - w / 2, y, z + h - 0.12), (x + w / 2, y, z + h - 0.12), 0.03, 0.03, m.wood, seg=6)
    top, bottom = z + h - 0.14, z + h - 0.14 - w * 1.5
    quad([(x - w / 2, y - 0.02, top), (x + w / 2, y - 0.02, top), (x + w / 2, y - 0.02, bottom + w * 0.25),
          (x, y - 0.02, bottom), (x - w / 2, y - 0.02, bottom + w * 0.25)], m.flag)
    quad([(x - w * 0.18, y - 0.035, top - w * 0.35), (x + w * 0.18, y - 0.035, top - w * 0.35),
          (x + w * 0.18, y - 0.035, top - w * 0.8), (x - w * 0.18, y - 0.035, top - w * 0.8)], m.gold)
    ball(0.08, (x, y, z + h + 0.05), m.gold, seg=8)


def house(m, w=1.0, d=0.85, h=0.62, roof=None, rh=0.55, chimney=True, lit=True):
    """Lakóház nyeregtetővel; az ajtó a -Y, az oromfal a +X oldalon van."""
    box(w, d, h, (0, 0, 0), m.plaster)
    gable(w, d, rh, (0, 0, h), roof or m.roof)
    end = w / 2 + 0.075  # vakolt oromfal a tető vége előtt
    quad([(end, -d / 2 + 0.07, h + 0.02), (end, d / 2 - 0.07, h + 0.02), (end, 0, h + rh * 0.84)], m.plaster)
    box(0.17, 0.04, 0.32, (-w * 0.18, -d / 2 - 0.01, 0), m.dark)
    if lit:
        box(0.13, 0.04, 0.14, (w * 0.24, -d / 2 - 0.01, h * 0.42), m.glow)
        box(0.04, 0.13, 0.14, (w / 2 + 0.01, 0, h * 0.5), m.glow)
    if chimney:
        box(0.13, 0.13, rh * 0.9, (-w * 0.25, d * 0.18, h + rh * 0.3), m.stone)
    # Gerendák a sarkokon: favázas hatás.
    for sx in (-1, 1):
        box(0.05, 0.05, h, (sx * (w / 2 - 0.02), -d / 2 - 0.005, 0), m.wood)


def hall(m, w=1.9, d=1.2, h=0.95):
    """Nagyobb középület (céhház, tanácsház)."""
    house(m, w, d, h, roof=m.roof2, rh=0.85)
    for dx in (-0.5, 0.1, 0.6):
        box(0.14, 0.04, 0.3, (dx, -d / 2 - 0.01, h * 0.45), m.glow)


def chapel(m, h=1.0):
    """Kápolna toronnyal."""
    box(1.5, 0.9, h, (0.2, 0, 0), m.plaster)
    gable(1.5, 0.9, 0.7, (0.2, 0, h), m.roof)
    box(0.7, 0.7, h * 2.1, (-0.75, 0, 0), m.stone)
    pyramid(0.62, 1.1, (-0.75, 0, h * 2.1), m.roof)
    limb((-0.75, 0, h * 2.1 + 1.1), (-0.75, 0, h * 2.1 + 1.5), 0.025, 0.02, m.gold, seg=6)
    box(0.18, 0.04, 0.4, (-0.75, -0.36, h * 1.3), m.glow)
    for dx in (0.0, 0.5):
        box(0.14, 0.04, 0.34, (dx, -0.46, h * 0.4), m.glow)


def ridge_tent(m, w=1.25, d=1.05, h=0.82, cloth=None):
    """Egyszerű nyeregsátor; a bejárat a +X végén."""
    gable(w, d, h, (0, 0, 0), cloth or m.cloth, overhang=0.0)
    quad([(w / 2 + 0.01, -0.16, 0), (w / 2 + 0.01, 0.16, 0), (w / 2 + 0.01, 0, h * 0.62)], m.dark)
    for sx in (-1, 1):
        limb((sx * w / 2, 0, 0), (sx * w / 2, 0, h + 0.1), 0.025, 0.02, m.wood, seg=6)


def pavilion(m, r=0.85, h=0.6, flag_h=0.8):
    """Kerek vezéri sátor a frakció színében."""
    cyl(r, r * 0.94, h, (0, 0, 0), m.cloth, seg=14)
    for i in range(7):
        a = i * 2 * math.pi / 7
        box(0.12, 0.03, h, (math.cos(a) * r * 0.98, math.sin(a) * r * 0.98, 0), m.flag, rot_z=a + math.pi / 2)
    cyl(r * 1.12, 0.0, 0.75, (0, 0, h), m.flag, seg=14)
    quad([(0.1, -r * 0.97, 0), (0.42, -r * 0.9, 0), (0.26, -r * 0.94, h * 0.8)], m.dark)
    flag(m, flag_h, 0.5, (0, 0, h + 0.7))


def yurt(m, r=0.8):
    """Jurta: a Szabad Völgyek jellegzetes lakósátra."""
    cyl(r, r, 0.55, (0, 0, 0), m.cloth, seg=16)
    cyl(r * 1.05, r * 0.22, 0.42, (0, 0, 0.55), m.roof2, seg=16)
    cyl(r * 0.22, r * 0.22, 0.06, (0, 0, 0.97), m.dark, seg=10)
    cyl(r * 1.02, r * 1.02, 0.07, (0, 0, 0.3), m.flag, seg=16)
    box(0.26, 0.04, 0.4, (0.2, -r * 0.97, 0), m.wood, rot_z=0.25)


def campfire(m, light=45.0):
    for i in range(4):
        a = i * math.pi / 4
        limb((math.cos(a) * 0.3, math.sin(a) * 0.3, 0.05), (-math.cos(a) * 0.3, -math.sin(a) * 0.3, 0.09), 0.06, 0.05, m.wood, seg=6)
    for i in range(8):
        a = i * math.pi / 4
        rock_m = m.rock
        ball(0.08, (math.cos(a) * 0.42, math.sin(a) * 0.42, 0.04), rock_m, seg=6)
    cyl(0.17, 0.0, 0.5, (0, 0, 0.08), m.fire, seg=8)
    cyl(0.1, 0.0, 0.34, (0.1, 0.05, 0.08), m.fire, seg=6)
    core.point_light((0, 0, 0.5), '#ff9a40', light, 0.25)


def well(m):
    cyl(0.32, 0.32, 0.3, (0, 0, 0), m.stone, seg=12)
    cyl(0.24, 0.24, 0.31, (0, 0, 0), m.dark, seg=12)
    for sx in (-1, 1):
        limb((sx * 0.3, 0, 0.2), (sx * 0.3, 0, 0.85), 0.035, 0.03, m.wood, seg=6)
    gable(0.8, 0.5, 0.25, (0, 0, 0.85), m.roof, overhang=0.02)


def haystack(m, rng, r=0.36):
    blob(r, (0, 0, r * 0.75), m.straw, rng, squash=1.1, rough=0.1)


def barrel(m):
    cyl(0.14, 0.14, 0.3, (0, 0, 0), m.wood, seg=10)
    cyl(0.148, 0.148, 0.04, (0, 0, 0.2), m.iron, seg=10)


def crate(m, s=0.26, rot=0.0):
    box(s, s, s, (0, 0, 0), m.wood, rot_z=rot)


def stall(m, rng):
    """Piaci bódé színes ponyvával."""
    for sx in (-1, 1):
        for sy in (-1, 1):
            limb((sx * 0.38, sy * 0.26, 0), (sx * 0.38, sy * 0.26, 0.62 + (0.14 if sy > 0 else 0)), 0.025, 0.025, m.wood, seg=6)
    quad([(-0.46, -0.34, 0.6), (0.46, -0.34, 0.6), (0.46, 0.32, 0.8), (-0.46, 0.32, 0.8)], m.flag if rng.random() < 0.6 else m.cloth)
    box(0.7, 0.4, 0.3, (0, 0, 0), m.wood)
    for i in range(3):
        ball(0.07, (-0.22 + i * 0.22, -0.05, 0.36), mat(rng.choice(['#c9482a', '#e0a83a', '#7aa23a']), noise=0), seg=6)


def fence(m, points, h=0.32):
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        n = max(1, round(math.hypot(x1 - x0, y1 - y0) / 0.5))
        for i in range(n + 1):
            t = i / n
            limb((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 0), (x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, h), 0.03, 0.025, m.wood, seg=5)
        for z in (h * 0.45, h * 0.85):
            limb((x0, y0, z), (x1, y1, z), 0.018, 0.018, m.wood, seg=5)


def palisade(m, r, gate_angle=-math.pi / 2, gate_width=1.1, h=1.0, skip=None):
    """Cölöpfal körben; a kapunál megszakad."""
    n = round(2 * math.pi * r / 0.3)
    gap = gate_width / r / 2
    for i in range(n):
        a = i * 2 * math.pi / n
        da = (a - gate_angle + math.pi) % (2 * math.pi) - math.pi
        if abs(da) < gap or (skip and skip(a)):
            continue
        hh = h * (0.92 + 0.16 * ((i * 7919) % 10) / 10)
        x, y = math.cos(a) * r, math.sin(a) * r
        cyl(0.13, 0.12, hh, (x, y, 0), m.wood, seg=6, smooth=False)
        cyl(0.12, 0.0, 0.2, (x, y, hh), m.wood, seg=6, smooth=False)
    for s in (-1, 1):
        a = gate_angle + s * gap
        x, y = math.cos(a) * r, math.sin(a) * r
        cyl(0.17, 0.16, h * 1.45, (x, y, 0), m.wood, seg=8)
    a0, a1 = gate_angle - gap, gate_angle + gap
    limb((math.cos(a0) * r, math.sin(a0) * r, h * 1.35), (math.cos(a1) * r, math.sin(a1) * r, h * 1.35), 0.1, 0.1, m.wood, seg=8)


def watchtower(m, h=2.3):
    """Fa őrtorony ácsolt lábakon."""
    for sx in (-1, 1):
        for sy in (-1, 1):
            limb((sx * 0.42, sy * 0.42, 0), (sx * 0.3, sy * 0.3, h), 0.06, 0.05, m.wood, seg=6)
    limb((-0.4, -0.4, 0.2), (0.34, -0.34, h * 0.8), 0.03, 0.03, m.wood, seg=5)
    limb((0.4, -0.4, 0.2), (0.34, 0.34, h * 0.8), 0.03, 0.03, m.wood, seg=5)
    box(0.9, 0.9, 0.08, (0, 0, h), m.wood)
    for sx, sy, w, d in ((0, -0.43, 0.9, 0.05), (0, 0.43, 0.9, 0.05), (0.43, 0, 0.05, 0.9), (-0.43, 0, 0.05, 0.9)):
        box(w, d, 0.3, (sx, sy, h + 0.08), m.wood)
    for sx in (-1, 1):
        for sy in (-1, 1):
            limb((sx * 0.4, sy * 0.4, h + 0.08), (sx * 0.4, sy * 0.4, h + 0.85), 0.035, 0.035, m.wood, seg=5)
    pyramid(0.78, 0.55, (0, 0, h + 0.85), m.roof)
    flag(m, 0.6, 0.45, (0, 0, h + 1.38))


def crenels(x0, y0, x1, y1, z, material, spacing=0.52, size=(0.26, 0.26, 0.28)):
    length = math.hypot(x1 - x0, y1 - y0)
    n = max(2, round(length / spacing))
    rot = math.atan2(y1 - y0, x1 - x0)
    for i in range(n):
        t = (i + 0.5) / n
        box(size[0], size[1], size[2], (x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z), material, rot_z=rot)


def round_tower(m, r=0.8, h=2.7, roof=None, cone=1.5, banner_h=0.7, windows=True):
    """Kerek kőtorony pártázattal; roof=None esetén nyitott tetejű."""
    cyl(r * 1.08, r, h, (0, 0, 0), m.stone, seg=22)
    cyl(r * 1.2, r * 1.2, 0.26, (0, 0, h), m.stone, seg=22)
    for i in range(8):
        a = i * math.pi / 4
        box(0.25, 0.25, 0.28, (math.cos(a) * r * 1.05, math.sin(a) * r * 1.05, h + 0.26), m.stone, rot_z=a)
    top = h + 0.28
    if roof is not None:
        cyl(r, 0.0, cone, (0, 0, top), roof, seg=20)
        top += cone
    if windows:
        for a in (-math.pi / 2, 0.0):
            box(0.13, 0.13, 0.28, (math.cos(a) * r * 1.02, math.sin(a) * r * 1.02, h * 0.6), m.glow, rot_z=a)
    if banner_h:
        flag(m, banner_h, banner_h * 0.72, (0, 0, top))


def wall_ring(m, r, sides=8, h=1.4, thick=0.42, towers=(), tower_r=0.72, tower_h=2.5, gate=True, roof=None):
    """Sokszög alaprajzú kőfal; az elülső (-Y) oldal közepén kapuházzal."""
    step = 2 * math.pi / sides
    verts = [(-math.pi / 2 + (i + 0.5) * step) for i in range(sides)]
    pts = [(math.cos(a) * r, math.sin(a) * r) for a in verts]
    for i in range(sides):
        (x0, y0), (x1, y1) = pts[i - 1], pts[i]
        length = math.hypot(x1 - x0, y1 - y0)
        rot = math.atan2(y1 - y0, x1 - x0)
        box(length, thick, h, ((x0 + x1) / 2, (y0 + y1) / 2, 0), m.stone, rot_z=rot)
        crenels(x0, y0, x1, y1, h, m.stone)
    for i in range(sides):
        if i in towers:
            with xf((pts[i][0], pts[i][1], 0)):
                round_tower(m, tower_r, tower_h, roof if roof is not None else m.roof)
    if gate:
        # Az elülső oldal a 0. csúcs előtti él (az utolsó és a 0. csúcs között).
        (x0, y0), (x1, y1) = pts[-1], pts[0]
        with xf(((x0 + x1) / 2, (y0 + y1) / 2, 0)):
            gatehouse(m, h)
    return pts


def gatehouse(m, wall_h=1.4, w=1.5, d=0.95):
    h = wall_h * 1.55
    box(w, d, h, (0, 0, 0), m.keep)
    box(w + 0.2, d + 0.2, 0.22, (0, 0, h), m.stone)
    crenels(-w / 2 - 0.05, -d / 2 - 0.08, w / 2 + 0.05, -d / 2 - 0.08, h + 0.22, m.stone, spacing=0.42, size=(0.22, 0.2, 0.24))
    crenels(-w / 2 - 0.05, d / 2 + 0.08, w / 2 + 0.05, d / 2 + 0.08, h + 0.22, m.stone, spacing=0.42, size=(0.22, 0.2, 0.24))
    box(0.72, 0.06, 0.95, (0, -d / 2 - 0.01, 0), m.dark)
    limb((0, -d / 2 - 0.04, 0.95), (0, -d / 2 + 0.02, 0.95), 0.36, 0.36, m.dark, seg=16)
    for sx in (-1, 1):
        box(0.12, 0.05, 0.3, (sx * 0.52, -d / 2 - 0.01, h * 0.62), m.glow)
    flag(m, 0.7, 0.5, (-w / 2 + 0.12, -d / 2 + 0.1, h + 0.46))
    flag(m, 0.7, 0.5, (w / 2 - 0.12, -d / 2 + 0.1, h + 0.46))


def keep(m, w=2.3, h=3.4, rng=None):
    """Öregtorony; a tetőforma frakciónként más."""
    box(w, w, h, (0, 0, 0), m.keep)
    box(w + 0.34, w + 0.34, 0.3, (0, 0, h), m.stone)
    e = w / 2 + 0.1
    for x0, y0, x1, y1 in ((-e, -e, e, -e), (e, -e, e, e), (e, e, -e, e), (-e, e, -e, -e)):
        crenels(x0, y0, x1, y1, h + 0.3, m.stone)
    for z in (h * 0.38, h * 0.7):
        for dx in (-w * 0.26, 0.0, w * 0.26):
            box(0.15, 0.05, 0.34, (dx, -w / 2 - 0.01, z), m.glow)
            box(0.05, 0.15, 0.34, (w / 2 + 0.01, dx, z), m.glow)
    box(0.5, 0.06, 0.8, (0, -w / 2 - 0.01, 0), m.dark)
    top = h + 0.3
    if m.special == 'dome':
        cyl(w * 0.42, w * 0.42, 0.3, (0, 0, top), m.plaster, seg=20)
        ball(w * 0.44, (0, 0, top + 0.3), m.gold, scale=(1, 1, 0.95), seg=20)
        limb((0, 0, top + 0.6), (0, 0, top + 1.5), 0.04, 0.015, m.gold, seg=8)
        flag(m, 0.9, 0.7, (0, 0, top + 1.4))
    elif m.special == 'bastion':
        pyramid(w * 0.6, 1.2, (0, 0, top), m.roof)
        for sx in (-1, 1):
            for sy in (-1, 1):
                with xf((sx * e, sy * e, h - 0.7)):
                    cyl(0.3, 0.3, 1.5, (0, 0, 0), m.keep, seg=10)
                    cyl(0.34, 0.0, 0.7, (0, 0, 1.5), m.roof, seg=10)
        flag(m, 1.0, 0.8, (0, 0, top + 1.2))
    elif m.special == 'spire':
        pyramid(w * 0.62, 0.8, (0, 0, top), m.roof)
        cyl(w * 0.24, w * 0.22, 1.1, (0, 0, top + 0.5), m.plaster, seg=12)
        cyl(w * 0.3, 0.0, 2.3, (0, 0, top + 1.6), m.roof, seg=12)
        flag(m, 0.9, 0.7, (0, 0, top + 3.85))
    elif m.special == 'grove':
        pyramid(w * 0.68, 2.2, (0, 0, top), m.roof)
        ivy = mat('#3f7a35', scale=9)
        for i in range(8):
            # Borostyán a két látható homlokzaton.
            u, z = rng.uniform(-w * 0.42, w * 0.42), rng.uniform(0.3, h * 0.9)
            pos = (u, -w / 2 - 0.03, z) if i % 2 == 0 else (w / 2 + 0.03, u, z)
            blob(0.3, pos, ivy, rng, squash=1.25)
        flag(m, 1.0, 0.8, (0, 0, top + 2.15))
    else:
        pyramid(w * 0.64, 1.7, (0, 0, top), m.roof)
        flag(m, 1.0, 0.8, (0, 0, top + 1.65))


# ---------- Fák ----------
def conifer(rng, season, s=1.0, snow=0.0):
    # A tűlevelek meredekek: kevesebb hó marad meg rajtuk, a zöld is kilátszik.
    needle = mat(LEAVES[season][0], rough=0.9, scale=9, snow=snow * 0.62)
    limb((0, 0, 0), (0, 0, 0.5 * s), 0.08 * s, 0.05 * s, mat('#3d2814', scale=10), seg=7)
    tiers = 4
    for i in range(tiers):
        r = (0.56 - i * 0.11) * s
        cyl(r, 0.0, 0.7 * s, (0, 0, (0.3 + i * 0.4) * s), needle, seg=9, rot_z=rng.uniform(0, 1), smooth=False)


def broadleaf(rng, season, s=1.0, snow=0.0, color=None):
    trunk = mat('#3d2814', scale=10)
    limb((0, 0, 0), (0.02 * s, 0, 0.75 * s), 0.09 * s, 0.06 * s, trunk, seg=7)
    if season == 'winter':
        # Télen csupasz ágak, a tetejükön hóval.
        for i in range(6):
            a = i * 1.05 + rng.uniform(-0.3, 0.3)
            tip = (math.cos(a) * 0.45 * s, math.sin(a) * 0.45 * s, (1.15 + rng.uniform(0, 0.35)) * s)
            limb((0, 0, 0.7 * s), tip, 0.045 * s, 0.015 * s, trunk, seg=5)
            ball(0.07 * s, tip, mat('#eef3f6', noise=0), seg=6)
        return
    leaf = mat(color or rng.choice(LEAVES[season][1]), rough=0.9, scale=9, snow=snow)
    for dx, dy, dz, r in ((0, 0, 1.15, 0.5), (-0.3, 0.1, 0.95, 0.36), (0.32, -0.06, 0.98, 0.38), (0.04, 0.24, 1.45, 0.32), (-0.08, -0.26, 1.02, 0.3)):
        blob(r * s, (dx * s, dy * s, dz * s), leaf, rng, squash=0.88)


def tree(rng, season, s=1.0, conifer_share=0.6, snow=0.0):
    if rng.random() < conifer_share:
        conifer(rng, season, s * rng.uniform(0.9, 1.2), snow)
    else:
        broadleaf(rng, season, s * rng.uniform(0.85, 1.1), snow)


def bush(rng, season, s=1.0, snow=0.0):
    if season == 'winter':
        leaf = mat('#5b6b62', scale=9, snow=max(snow, 0.5))
    else:
        leaf = mat(rng.choice(LEAVES[season][1]), rough=0.9, scale=9, snow=snow)
    blob(0.28 * s, (0, 0, 0.2 * s), leaf, rng, squash=0.75)
    blob(0.2 * s, (0.22 * s, 0.05 * s, 0.15 * s), leaf, rng, squash=0.75)


def boulders(rng, material, count=3, spread=0.5, size=0.28):
    for _ in range(count):
        a, d = rng.uniform(0, 6.28), rng.uniform(0, spread)
        r = size * rng.uniform(0.6, 1.2)
        rock(r, (math.cos(a) * d, math.sin(a) * d, r * 0.35), material, rng)

