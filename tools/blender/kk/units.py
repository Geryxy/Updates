"""Egységmodellek: minden egységtípus külön figura, frakciószínekben.

A figurák a -Y irányba néznek (a kép bal alsó sarka felé), a jobb kezük a -X,
a bal kezük (a pajzzsal) a +X oldalon van, így a pajzs és a fegyver is jól látszik.
"""
import math
import random

from . import core
from . import props as P
from .core import ball, box, cyl, limb, mat, quad, xf
from .palette import OWNERS, Mats

from mathutils import Matrix  # noqa: E402  (a core betöltése után érhető el)

HEX_R = 2.15      # ennyi világegység egy hatszögsugár: a figurák a városokhoz képest felnagyítva látszanak
FRAME = 4.6
TARGET_Z = 1.15
FACING = math.radians(6)

SKIN = '#e0b48a'
HORSES = {'szikra': '#8a4f2a', 'moha': '#5e3a22', 'vaskapu': '#2a2624', 'volgyek': '#e9e4da', 'neutral': '#8d8478'}


def _parts(m):
    return dict(
        skin=mat(SKIN, noise=0.05, rough=0.7),
        hair=mat('#3a2616', noise=0.1),
        trousers=mat('#3a2c20', noise=0.12),
        boots=mat('#231811', noise=0.08),
        leather=mat('#6b4a2a', noise=0.14, scale=9),
        tunic=m.flag,
        dark=m.flag_dark,
    )


def _arm(c, shoulder, hand, sleeve, bend=(0, 0.1, -0.12)):
    elbow = tuple((shoulder[i] + hand[i]) / 2 + bend[i] for i in range(3))
    ball(0.1, shoulder, sleeve, seg=10)
    limb(shoulder, elbow, 0.085, 0.07, sleeve, seg=8)
    limb(elbow, hand, 0.07, 0.06, sleeve, seg=8)
    ball(0.065, hand, c['skin'], seg=8)


def figure(m, head='hair', tunic=None, right_hand=(-0.36, -0.14, 0.95), left_hand=(0.36, -0.12, 1.0),
           cape=None, armor=False, mounted=False, apron=False):
    """Zömök, játékfigura-szerű ember. Visszaadja a két kéz helyét a felszereléshez."""
    c = _parts(m)
    tunic = tunic or c['tunic']
    base = 0.0
    if mounted:
        base = -0.62  # lovon ülve a törzs lejjebb kerül; a lábakat a lovas rajzolja
    else:
        for sx in (-1, 1):
            box(0.17, 0.3, 0.11, (sx * 0.13, -0.04, 0), c['boots'])
            limb((sx * 0.13, 0, 0.1), (sx * 0.12, 0, 0.8), 0.085, 0.1, c['trousers'], seg=8)
    with xf((0, 0, base)):
        with xf(matrix=Matrix.Diagonal((1, 0.74, 1, 1))):
            cyl(0.31, 0.24, 0.64, (0, 0, 0.7), tunic, seg=14)
            cyl(0.315, 0.315, 0.07, (0, 0, 0.86), c['leather'], seg=14)
            if armor:
                cyl(0.27, 0.25, 0.36, (0, 0, 0.99), m.iron, seg=14)
            if apron:
                cyl(0.32, 0.29, 0.5, (0, 0, 0.7), c['leather'], seg=14)
        r_sh, l_sh = (-0.27, 0, 1.3), (0.27, 0, 1.3)
        rh = (right_hand[0], right_hand[1], right_hand[2] - base) if mounted else right_hand
        lh = (left_hand[0], left_hand[1], left_hand[2] - base) if mounted else left_hand
        _arm(c, r_sh, rh, m.iron if armor else tunic)
        _arm(c, l_sh, lh, m.iron if armor else tunic)
        limb((0, 0, 1.3), (0, 0, 1.4), 0.09, 0.08, c['skin'], seg=8)
        ball(0.2, (0, 0, 1.55), c['skin'], seg=14)
        for sx in (-1, 1):
            ball(0.028, (sx * 0.075, -0.182, 1.585), c['boots'], seg=6)
        if head == 'hair':
            ball(0.205, (0, 0.035, 1.59), c['hair'], scale=(1, 1, 0.9), seg=12)
        elif head == 'hat':
            ball(0.205, (0, 0.035, 1.59), c['hair'], scale=(1, 1, 0.9), seg=12)
            cyl(0.36, 0.34, 0.035, (0, 0, 1.66), m.straw, seg=14)
            cyl(0.2, 0.12, 0.16, (0, 0, 1.69), m.straw, seg=12)
        elif head == 'helmet':
            ball(0.215, (0, 0.01, 1.6), m.iron, scale=(1, 1, 0.82), seg=12)
            cyl(0.27, 0.25, 0.03, (0, 0, 1.6), m.iron, seg=14)
        elif head == 'greathelm':
            cyl(0.215, 0.2, 0.3, (0, 0, 1.43), m.iron, seg=12)
            ball(0.2, (0, 0, 1.72), m.iron, scale=(1, 1, 0.5), seg=12)
            box(0.03, 0.02, 0.2, (0, -0.21, 1.5), m.dark)
            limb((0, 0.05, 1.8), (0, 0.3, 2.12), 0.06, 0.02, c['tunic'], seg=6)  # sisakforgó a frakció színében
        elif head == 'hood':
            ball(0.24, (0, 0.055, 1.58), cape or tunic, scale=(1, 1.0, 1.04), seg=12)
            cyl(0.15, 0.0, 0.3, (0, 0.17, 1.68), cape or tunic, seg=8)
            cyl(0.3, 0.25, 0.12, (0, 0.02, 1.3), cape or tunic, seg=12)
        elif head == 'cap':
            ball(0.205, (0, 0.035, 1.59), c['hair'], scale=(1, 1, 0.9), seg=12)
            ball(0.21, (0, 0, 1.63), c['tunic'], scale=(1, 1, 0.6), seg=12)
        if cape is not None:
            quad([(-0.26, 0.17, 1.34), (0.26, 0.17, 1.34), (0.34, 0.3, 0.5), (-0.34, 0.3, 0.5)], cape)
            quad([(-0.26, 0.17, 1.34), (-0.34, 0.3, 0.5), (-0.3, 0.05, 0.62), (-0.27, 0.0, 1.3)], cape)
            quad([(0.26, 0.17, 1.34), (0.27, 0.0, 1.3), (0.3, 0.05, 0.62), (0.34, 0.3, 0.5)], cape)
    return (right_hand, left_hand)


def spear_weapon(m, hand, length=2.35, lean=(0.0, -0.1)):
    x, y, z = hand
    bottom = (x - lean[0] * 0.4, y - lean[1] * 0.4, 0.04)
    top = (x + lean[0], y + lean[1], length)
    limb(bottom, top, 0.028, 0.024, m.wood, seg=6)
    limb(top, (top[0] + lean[0] * 0.12, top[1] + lean[1] * 0.12, length + 0.28), 0.055, 0.0, m.iron, seg=6)
    return top


def shield(m, hand, r=0.3, kite=True):
    x, y, z = hand
    with xf((x + 0.07, y, z + (0.02 if kite else 0)), matrix=None):
        with xf(matrix=Matrix.Diagonal((1, 1, 1.28 if kite else 1.0, 1))):
            limb((0, 0, 0), (0.05, 0, 0), r, r, m.flag, seg=16)
            limb((0.05, 0, 0), (0.07, 0, 0), r * 0.8, r * 0.8, m.flag_dark, seg=16)
            limb((-0.005, 0, 0), (0.0, 0, 0), r * 1.06, r * 1.06, m.iron, seg=16)
        ball(0.075, (0.085, 0, 0), m.gold, seg=8)


def militia(m, rng):
    """Milícia: parasztkatona szalmakalapban, vasvillával."""
    c = _parts(m)
    rh, _ = figure(m, head='hat', left_hand=(0.33, -0.2, 0.95))
    top = spear_weapon(m, rh, length=1.95, lean=(0.02, -0.06))
    for dx in (-0.09, 0.0, 0.09):
        limb((top[0] + dx, top[1], top[2] - 0.02), (top[0] + dx, top[1] - 0.01, top[2] + 0.3), 0.016, 0.006, m.iron, seg=5)
    limb((top[0] - 0.09, top[1], top[2]), (top[0] + 0.09, top[1], top[2]), 0.016, 0.016, m.iron, seg=5)
    # Kis fapajzs a bal karon.
    with xf((0.4, -0.2, 0.98)):
        limb((0, 0, 0), (0.045, 0, 0), 0.23, 0.23, m.wood, seg=12)
        ball(0.06, (0.06, 0, 0), m.iron, seg=6)
    box(0.2, 0.14, 0.22, (0.0, 0.2, 0.92), c['leather'])


def spearman(m, rng):
    """Lándzsás: sisakos gyalogos nagy pajzzsal és hosszú lándzsával."""
    rh, lh = figure(m, head='helmet', armor=True)
    spear_weapon(m, rh, length=2.5, lean=(-0.02, -0.12))
    shield(m, lh, r=0.3, kite=True)


def archer(m, rng):
    """Íjász: csuklyás lövész hosszú íjjal és tegezzel."""
    c = _parts(m)
    hood = mat('#3f4a2c', noise=0.12)
    bow = mat('#c9a26a', noise=0.1)
    lh = (0.52, -0.34, 1.15)
    figure(m, head='hood', cape=hood, right_hand=(-0.3, -0.22, 1.05), left_hand=lh)
    pts = []
    for i in range(9):
        t = -1 + i * 0.25
        pts.append((lh[0] + 0.03, lh[1] - 0.26 * (1 - t * t), lh[2] + 0.86 * t))
    for a, b in zip(pts, pts[1:]):
        limb(a, b, 0.034, 0.034, bow, seg=6)
    limb(pts[0], pts[-1], 0.01, 0.01, mat('#f1ead8', noise=0), seg=4)
    # Nyílvessző a jobb kézben.
    limb((-0.3, -0.22, 1.05), (-0.34, -0.62, 1.12), 0.014, 0.014, bow, seg=4)
    limb((-0.34, -0.62, 1.12), (-0.35, -0.72, 1.14), 0.03, 0.0, m.iron, seg=4)
    # Tegez a háton, tollas nyílvesszőkkel.
    limb((-0.1, 0.24, 0.82), (-0.22, 0.3, 1.5), 0.08, 0.09, c['leather'], seg=8)
    for dx in (-0.05, 0.0, 0.05):
        limb((-0.22 + dx, 0.3, 1.5), (-0.24 + dx, 0.32, 1.7), 0.016, 0.016, mat('#f1ead8', noise=0), seg=4)


def scout(m, rng):
    """Felderítő: köpenyes, csuklyás vándor lámpással és bottal."""
    c = _parts(m)
    rh = (-0.36, -0.2, 1.05)
    lh = (0.34, -0.3, 0.98)
    figure(m, head='hood', tunic=c['dark'], cape=m.flag, right_hand=rh, left_hand=lh)
    limb((rh[0], rh[1] + 0.05, 0.03), (rh[0], rh[1] - 0.06, 1.85), 0.034, 0.026, m.wood, seg=6)
    # Lámpás a bal kézben.
    limb((lh[0], lh[1], lh[2]), (lh[0], lh[1], lh[2] - 0.14), 0.008, 0.008, m.iron, seg=4)
    box(0.13, 0.13, 0.17, (lh[0], lh[1], lh[2] - 0.32), m.glow)
    box(0.15, 0.15, 0.03, (lh[0], lh[1], lh[2] - 0.15), m.iron)
    box(0.15, 0.15, 0.03, (lh[0], lh[1], lh[2] - 0.345), m.iron)
    core.point_light((lh[0], lh[1] - 0.1, lh[2] - 0.2), '#ffb860', 6.0, 0.08)
    # Hátizsák tekercselt pokróccal.
    box(0.3, 0.2, 0.34, (0, 0.24, 0.9), c['leather'])
    limb((-0.2, 0.26, 1.28), (0.2, 0.26, 1.28), 0.07, 0.07, mat('#8a8266', noise=0.1), seg=8)


def horse(m, color):
    coat = mat(color, noise=0.1, scale=7)
    dark = mat(core.shade(color, 0.45), noise=0.08)
    ball(1.0, (0, 0, 1.08), coat, scale=(0.36, 0.86, 0.42), seg=16)
    ball(1.0, (0, 0.03, 1.04), m.flag, scale=(0.385, 0.66, 0.37), seg=16)       # lótakaró a frakció színében
    cyl(0.39, 0.39, 0.05, (0, 0.03, 0.78), m.flag_dark, seg=4, rot_z=math.pi / 4)
    limb((0, -0.62, 1.2), (0, -0.98, 1.78), 0.22, 0.14, coat, seg=10)
    with xf((0, -1.12, 1.78)):
        ball(1.0, (0, -0.06, -0.04), coat, scale=(0.13, 0.3, 0.15), seg=10)
        for sx in (-1, 1):
            cyl(0.045, 0.0, 0.13, (sx * 0.07, 0.14, 0.08), coat, seg=5)
    limb((0, -0.62, 1.42), (0, -0.98, 1.95), 0.05, 0.04, dark, seg=6)             # sörény
    limb((0, 0.84, 1.22), (0, 1.08, 0.5), 0.075, 0.025, dark, seg=6)              # farok
    for sx in (-1, 1):
        for sy, fwd in ((-0.56, -0.05), (0.6, 0.05)):
            limb((sx * 0.2, sy, 0.9), (sx * 0.2, sy + fwd, 0.1), 0.1, 0.06, coat, seg=8)
            cyl(0.075, 0.085, 0.1, (sx * 0.2, sy + fwd, 0), dark, seg=8)
    box(0.34, 0.5, 0.08, (0, 0.05, 1.47), mat('#4a3020', noise=0.1))


def cavalry(m, rng):
    """Lovasság: páncélos lovag lótakarós harci ménen, zászlós kopjával."""
    c = _parts(m)
    horse(m, HORSES[m.owner])
    rh = (-0.4, -0.25, 1.75)
    lh = (0.36, -0.3, 1.75)
    with xf((0, 0.08, 1.42)):
        figure(m, head='greathelm', armor=True, mounted=True, right_hand=(rh[0], rh[1], rh[2] - 0.8), left_hand=(lh[0], lh[1], lh[2] - 0.8))
        for sx in (-1, 1):
            limb((sx * 0.17, 0, 0.12), (sx * 0.42, -0.18, -0.55), 0.1, 0.08, c['trousers'], seg=8)
            box(0.14, 0.26, 0.1, (sx * 0.43, -0.22, -0.66), c['boots'])
    tip = (rh[0] - 0.02, rh[1] - 1.35, rh[2] + 1.0)
    limb((rh[0] + 0.02, rh[1] + 0.9, rh[2] - 0.5), tip, 0.035, 0.026, m.wood, seg=6)
    limb(tip, (tip[0], tip[1] - 0.2, tip[2] + 0.15), 0.05, 0.0, m.iron, seg=6)
    quad([(tip[0], tip[1] + 0.1, tip[2] - 0.08), (tip[0], tip[1] + 0.5, tip[2] - 0.6),
          (tip[0], tip[1] + 0.52, tip[2] - 0.22), (tip[0], tip[1] + 0.3, tip[2] - 0.05)], m.flag)
    shield(m, (lh[0] + 0.02, lh[1] + 0.2, lh[2] - 0.2), r=0.24, kite=True)


def siege(m, rng):
    """Ostromgép: kerekes hajítógép kezelővel."""
    c = _parts(m)
    for sx in (-1, 1):
        box(0.14, 2.3, 0.14, (sx * 0.5, 0, 0.3), m.wood)
        limb((sx * 0.5, -0.15, 0.4), (sx * 0.5, -0.15, 1.6), 0.075, 0.065, m.wood, seg=6)
        limb((sx * 0.5, 0.75, 0.42), (sx * 0.5, -0.1, 1.45), 0.05, 0.05, m.wood, seg=6)
        for sy in (-0.8, 0.8):
            limb((sx * 0.6, sy, 0.3), (sx * 0.72, sy, 0.3), 0.3, 0.3, m.wood, seg=14)
            limb((sx * 0.72, sy, 0.3), (sx * 0.75, sy, 0.3), 0.09, 0.09, m.iron, seg=8)
    for sy in (-1.05, 0.0, 1.05):
        box(1.14, 0.14, 0.12, (0, sy, 0.3), m.wood)
    limb((-0.56, -0.15, 1.6), (0.56, -0.15, 1.6), 0.07, 0.07, m.wood, seg=6)
    # Hajítókar kanállal és kőgolyóval.
    limb((0, -0.5, 0.45), (0, 0.95, 2.0), 0.075, 0.055, m.wood, seg=6)
    ball(0.2, (0, 1.0, 2.02), m.wood, scale=(1, 1, 0.5), seg=10)
    ball(0.16, (0, 1.0, 2.12), m.rock, seg=8)
    limb((0, -0.15, 1.6), (0, -0.15, 1.2), 0.03, 0.03, mat('#cdbf9a', noise=0.1), seg=5)
    cyl(0.16, 0.16, 0.2, (0, -0.7, 0.37), mat('#cdbf9a', noise=0.1), seg=10)
    for i, (x, y) in enumerate(((0.95, 0.9), (1.15, 0.72), (0.98, 0.62))):
        ball(0.15, (x, y, 0.14), m.rock, seg=8)
    P.flag(m, 0.75, 0.5, (0.5, -0.15, 1.6))
    with xf((-1.05, -0.2, 0), 0.5):
        figure(m, head='cap', apron=True, right_hand=(-0.3, -0.3, 1.0), left_hand=(0.32, -0.25, 0.9))
        limb((-0.3, -0.3, 0.6), (-0.3, -0.36, 1.25), 0.02, 0.02, m.wood, seg=5)
        box(0.16, 0.1, 0.1, (-0.3, -0.37, 1.22), m.iron)


BUILDERS = dict(militia=militia, spear=spearman, archer=archer, cavalry=cavalry, siege=siege, scout=scout)
# Az ostromgép és a lovas alapból a -Y felé néz; a képen kissé elfordítva mutatnak jól.
TURN = dict(militia=FACING, spear=FACING, archer=FACING - 0.2, cavalry=math.radians(-36), siege=math.radians(-30), scout=FACING)


def build(kind, owner):
    rng = random.Random(OWNERS.index(owner) * 31 + len(kind))
    m = Mats(owner)
    with xf((0, 0, 0), TURN[kind]):
        BUILDERS[kind](m, rng)


def build_banner(owner):
    P.banner(Mats(owner), 2.3, 0.62)


def jobs():
    for owner in OWNERS:
        for kind in BUILDERS:
            yield dict(name=f'unit-{kind}-{owner}', page='units', build=lambda k=kind, o=owner: build(k, o),
                       px=384, frame=FRAME, target_z=TARGET_Z, hex_r=HEX_R, samples=64, ui=128, shadow=0.5)
        yield dict(name=f'banner-{owner}', page='units', build=lambda o=owner: build_banner(o),
                   px=384, frame=FRAME, target_z=TARGET_Z, hex_r=HEX_R, samples=48, shadow=0.5)
