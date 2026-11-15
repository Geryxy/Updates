"""Városmodellek: öt szint (tábor, falu, kisváros, nagyváros, királyi központ), frakciónként saját stílussal."""
import math
import random

from . import props as P
from .core import box, disc, mat, patch_mat, xf
from .palette import OWNERS, Mats

FRAME = 17.0      # a kép szélessége világegységben (a hatszög sugara 7,2 egység)
TARGET_Z = 3.2
HEX_R = 7.2


def _ground(radius, color='#6b5236'):
    disc(radius * 1.3, (0, 0, 0.012), patch_mat(color, radius), h=0.012, seg=48)


def _scatter_trees(rng, count, r0, r1, a0=0.3, a1=math.pi - 0.3, s=1.7):
    """Örökzöldek a település mögött (a kép hátsó ívén), hogy minden évszakhoz illjenek."""
    for _ in range(count):
        a, d = rng.uniform(a0, a1), rng.uniform(r0, r1)
        with xf((math.cos(a) * d, math.sin(a) * d, 0)):
            P.conifer(rng, 'summer', s * rng.uniform(0.8, 1.15))


def _houses(m, rng, spots, roofs=None):
    for x, y, rot in spots:
        with xf((x, y, 0), rot + rng.uniform(-0.12, 0.12)):
            roof = (roofs or [m.roof, m.roof, m.roof2])[rng.randrange(3 if not roofs else len(roofs))]
            P.house(m, rng.uniform(0.9, 1.15), rng.uniform(0.78, 0.92), rng.uniform(0.56, 0.7), roof=roof, chimney=rng.random() < 0.7)


def camp(m, rng):
    """1. szint – Tábor: sátrak tábortűz körül, hadijelvény, készletek."""
    _ground(3.0)
    with xf((0.1, -0.5, 0)):
        P.campfire(m)
    with xf((-0.5, 1.5, 0)):
        P.pavilion(m)
    tents = [(-2.0, -0.4), (1.9, 0.5), (0.9, -2.1), (-1.3, -2.2)]
    for x, y in tents:
        rot = math.atan2(-0.5 - y, 0.1 - x)
        with xf((x, y, 0), rot):
            if m.special == 'spire':
                P.yurt(m, 0.72)
            else:
                P.ridge_tent(m, cloth=m.cloth if rng.random() < 0.6 else mat('#b9a37a', scale=6, noise=0.12))
    with xf((1.7, 1.9, 0)):
        P.banner(m, 2.3, 0.62)
    for x, y, r in ((2.5, -1.0, 0.2), (2.75, -0.75, 0.9), (2.4, -0.55, 1.4)):
        with xf((x, y, 0), r):
            P.crate(m)
    for x, y in ((-2.6, 0.9), (-2.85, 0.65)):
        with xf((x, y, 0)):
            P.barrel(m)
    P.palisade(m, 3.35, gate_angle=-math.pi / 2, gate_width=0.0, h=0.75,
               skip=lambda a: not (0.35 < a < math.pi - 0.35))
    _scatter_trees(rng, 4 if m.special == 'grove' else 2, 3.9, 4.6)


def village(m, rng):
    """2. szint – Falu: házak a kút körül, szénaboglyák, bekerített föld."""
    _ground(3.9)
    with xf((0, -0.2, 0)):
        P.well(m)
    spots = [(-2.2, 0.6, 0.15), (-0.6, 2.2, -0.1), (1.5, 1.9, 0.2), (2.5, -0.1, -0.2), (-1.9, -1.9, 0.25)]
    if m.special == 'spire':
        for x, y in ((1.5, 1.9), (-1.9, -1.9)):
            with xf((x, y, 0), rng.uniform(0, 1)):
                P.yurt(m, 0.8)
        spots = [s for s in spots if (s[0], s[1]) not in ((1.5, 1.9), (-1.9, -1.9))]
    _houses(m, rng, spots, roofs=[m.thatch, m.roof, m.thatch] if m.owner in ('neutral', 'moha') else None)
    for x, y in ((0.9, -2.3), (1.45, -2.55), (1.0, -2.9)):
        with xf((x, y, 0)):
            P.haystack(m, rng)
    P.fence(m, [(2.1, -1.5), (3.4, -1.9), (3.1, -3.0), (1.9, -2.6)])
    box(1.15, 0.95, 0.03, (2.65, -2.25, 0.02), mat('#8a7a34', scale=22, bump=0.4), rot_z=0.3)
    with xf((-0.9, -0.9, 0)):
        P.banner(m, 2.0, 0.55)
    if m.special == 'bastion':
        with xf((0.6, 0.9, 0)):
            P.watchtower(m, 2.0)
    if m.special == 'dome':
        with xf((0.9, -0.9, 0), 0.4):
            P.stall(m, rng)
    _scatter_trees(rng, 6 if m.special == 'grove' else 3, 3.6, 4.7)


def town(m, rng):
    """3. szint – Kisváros: cölöpfal kapuval, őrtornyok, kápolna, piactér."""
    _ground(5.0)
    P.palisade(m, 4.55, h=1.05)
    for a in (math.radians(-55), math.radians(145)):
        with xf((math.cos(a) * 4.0, math.sin(a) * 4.0, 0)):
            P.watchtower(m, 2.2)
    with xf((0.4, 1.6, 0)):
        P.chapel(m)
    _houses(m, rng, [(-2.6, 0.6, 0.1), (-2.2, 2.3, -0.15), (2.4, 1.4, 0.2), (2.9, -0.4, -0.1), (-2.9, -1.3, 0.2),
                     (1.6, -2.3, 0.0), (-1.3, -2.7, -0.2), (-1.0, 0.2, 0.3)])
    with xf((0.5, -0.7, 0)):
        P.well(m)
    for x, y, r in ((-0.6, -1.4, 0.3), (1.4, -0.9, -0.4)):
        with xf((x, y, 0), r):
            P.stall(m, rng)
    for sx in (-1, 1):
        with xf((sx * 0.9, -4.5, 0)):
            P.flag(m, 1.9, 0.7)
    if m.special == 'spire':
        P.fence(m, [(1.2, 2.6), (2.6, 2.9), (3.0, 2.0)])
    _scatter_trees(rng, 5 if m.special == 'grove' else 2, 5.0, 5.7, s=1.8)


def city(m, rng):
    """4. szint – Nagyváros: kőfal négy toronnyal, kapuház, tanácsház, kis vár."""
    _ground(5.7, '#6f5a40')
    P.wall_ring(m, 5.05, sides=8, towers=(1, 3, 5, 7) if m.special != 'bastion' else (0, 1, 3, 4, 6, 7), tower_h=2.5)
    with xf((0.2, 1.5, 0)):
        P.keep(m, 1.7, 2.5, rng)
    with xf((-2.3, 0.4, 0), 0.1):
        P.chapel(m, 0.9)
    with xf((2.3, 0.0, 0), -0.1):
        P.hall(m, 1.7, 1.1, 0.85)
    _houses(m, rng, [(-2.7, 2.2, 0.1), (2.6, 2.3, -0.2), (-3.1, -1.4, 0.15), (3.2, -1.7, -0.1), (-1.5, -2.4, 0.0),
                     (1.5, -2.6, 0.1), (-0.9, -0.8, -0.2), (1.0, -1.1, 0.3)])
    for x, y, r in ((0.1, -2.2, 0.2), (-0.2, -3.4, -0.2)):
        with xf((x, y, 0), r):
            P.stall(m, rng)
    _scatter_trees(rng, 4 if m.special == 'grove' else 0, 5.8, 6.3, s=1.9)


def capital(m, rng):
    """5. szint – Királyi központ: nyolcszögű várfal tornyokkal, öregtorony, paloták."""
    _ground(6.2, '#6f5a40')
    towers = tuple(range(8)) if m.special == 'bastion' else (0, 1, 2, 4, 5, 7)
    P.wall_ring(m, 5.55, sides=8, h=1.6, towers=towers, tower_r=0.78, tower_h=2.9)
    with xf((0.1, 1.3, 0)):
        P.keep(m, 2.5, 3.7, rng)
    with xf((-2.9, 0.6, 0), 0.1):
        P.chapel(m, 1.05)
    with xf((2.9, 0.5, 0), -0.05):
        P.hall(m, 1.9, 1.2, 0.95)
    with xf((-0.3, -2.2, 0), 0.0):
        P.hall(m, 1.6, 1.0, 0.8)
    _houses(m, rng, [(-3.3, 2.6, 0.1), (3.2, 2.7, -0.2), (-3.7, -1.5, 0.15), (3.7, -1.3, -0.1), (-2.0, -3.3, 0.05),
                     (1.8, -3.4, 0.1), (-2.0, -1.0, -0.2), (1.9, -1.4, 0.25), (-1.6, 3.4, 0.0), (1.5, 3.5, 0.1)])
    for x, y, r in ((0.9, -3.3, 0.3), (-0.9, -3.9, -0.2), (0.3, -0.5, 0.5)):
        with xf((x, y, 0), r):
            P.stall(m, rng)
    for sx in (-1, 1):
        with xf((sx * 1.3, -5.9, 0)):
            P.banner(m, 2.4, 0.6)
    _scatter_trees(rng, 5 if m.special == 'grove' else 0, 6.3, 6.7, s=1.9)


BUILDERS = (camp, village, town, city, capital)


def build(level, owner, snow=0.0):
    rng = random.Random(level * 131 + OWNERS.index(owner) * 17)
    BUILDERS[level - 1](Mats(owner, snow), rng)


def jobs():
    for owner in OWNERS:
        for level in range(1, 6):
            yield dict(name=f'city-{level}-{owner}', page='main', build=lambda l=level, o=owner: build(l, o),
                       px=512, frame=FRAME, target_z=TARGET_Z, hex_r=HEX_R, samples=56, ui=260, shadow=0.8)
