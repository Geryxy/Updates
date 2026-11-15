"""Közös modellező- és renderelőkód a Köd Koronája 3D-s képeihez (Blender, bpy modul).

A játék térképe döntött felülnézetű: a talaj függőlegesen GROUND_K-szorosára rövidül,
a magasságok HEIGHT_K-szorosan látszanak. Minden kép ugyanazzal a kameraszöggel és
megvilágítással készül, ezért a külön renderelt modellek egy világnak látszanak.
"""
import math

import bpy  # a bpy betöltése teszi elérhetővé a bmesh és a mathutils modult
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

TILT_DEG = 50.0
TILT = math.radians(TILT_DEG)
GROUND_K = math.cos(TILT)
HEIGHT_K = math.sin(TILT)
YAW = math.radians(32.0)


def lin(hex_color):
    """sRGB hexa szín -> lineáris RGBA (a Blender lineáris színekkel számol)."""
    h = hex_color.lstrip('#')
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*out, 1.0)


def shade(hex_color, factor):
    """Szín sötétítése (factor < 1) vagy világosítása (factor > 1)."""
    h = hex_color.lstrip('#')
    rgb = [int(h[i:i + 2], 16) for i in (0, 2, 4)]
    if factor <= 1:
        rgb = [round(c * factor) for c in rgb]
    else:
        rgb = [round(c + (255 - c) * (factor - 1)) for c in rgb]
    return '#' + ''.join(f'{max(0, min(255, c)):02x}' for c in rgb)


# ---------- Anyagok ----------
_materials = {}


def _principled(nt):
    bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    out = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'), None)
    if out is None:
        out = nt.nodes.new('ShaderNodeOutputMaterial')
    if bsdf is None:
        bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
        nt.links.new(bsdf.outputs[0], out.inputs[0])
    return bsdf, out


def mat(base, rough=0.85, noise=0.16, scale=6.0, bump=0.0, emit=None, strength=0.0, metallic=0.0,
        snow=0.0, snow_line=None, key=None):
    """Anyag procedurális színváltozatossággal.

    noise: a szín szórása (0 = egyszínű); bump: felületi érdesség;
    snow: a felfelé néző felületek behavazottsága (0..1); snow_line: e magasság fölött hósapka.
    """
    key = key or (base, rough, noise, scale, bump, emit, strength, metallic, snow, snow_line)
    cached = _materials.get(key)
    if cached is not None:
        return cached
    m = bpy.data.materials.new(f'm{len(_materials)}')
    if not m.node_tree:
        m.use_nodes = True
    nt = m.node_tree
    bsdf, out = _principled(nt)
    bsdf.inputs['Base Color'].default_value = lin(base)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metallic
    if emit:
        bsdf.inputs['Emission Color'].default_value = lin(emit)
        bsdf.inputs['Emission Strength'].default_value = strength
    if noise > 0:
        tex = nt.nodes.new('ShaderNodeTexNoise')
        tex.inputs['Scale'].default_value = scale
        tex.inputs['Detail'].default_value = 5.0
        ramp = nt.nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].position = 0.3
        ramp.color_ramp.elements[0].color = lin(shade(base, 1 - noise * 1.5))
        ramp.color_ramp.elements[1].position = 0.72
        ramp.color_ramp.elements[1].color = lin(shade(base, 1 + noise))
        nt.links.new(tex.outputs[0], ramp.inputs[0])
        nt.links.new(ramp.outputs[0], bsdf.inputs['Base Color'])
    if bump > 0:
        fine = nt.nodes.new('ShaderNodeTexNoise')
        fine.inputs['Scale'].default_value = scale * 5
        node = nt.nodes.new('ShaderNodeBump')
        node.inputs['Strength'].default_value = bump
        nt.links.new(fine.outputs[0], node.inputs['Height'])
        nt.links.new(node.outputs[0], bsdf.inputs['Normal'])
    if snow > 0 or snow_line is not None:
        white = nt.nodes.new('ShaderNodeBsdfPrincipled')
        white.inputs['Base Color'].default_value = lin('#eef3f6')
        white.inputs['Roughness'].default_value = 0.6
        geo = nt.nodes.new('ShaderNodeNewGeometry')
        sep_n = nt.nodes.new('ShaderNodeSeparateXYZ')
        nt.links.new(geo.outputs['Normal'], sep_n.inputs[0])
        up = nt.nodes.new('ShaderNodeMapRange')
        up.clamp = True
        t0 = 1.0 - 1.15 * snow if snow > 0 else 2.0
        up.inputs['From Min'].default_value = t0
        up.inputs['From Max'].default_value = t0 + 0.22
        nt.links.new(sep_n.outputs['Z'], up.inputs['Value'])
        factor = up.outputs[0]
        if snow_line is not None:
            sep_p = nt.nodes.new('ShaderNodeSeparateXYZ')
            nt.links.new(geo.outputs['Position'], sep_p.inputs[0])
            wobble = nt.nodes.new('ShaderNodeTexNoise')
            wobble.inputs['Scale'].default_value = 1.4
            add = nt.nodes.new('ShaderNodeMath')
            add.operation = 'MULTIPLY_ADD'
            add.inputs[1].default_value = 2.4
            nt.links.new(wobble.outputs[0], add.inputs[0])
            nt.links.new(sep_p.outputs['Z'], add.inputs[2])
            high = nt.nodes.new('ShaderNodeMapRange')
            high.clamp = True
            high.inputs['From Min'].default_value = snow_line + 1.0
            high.inputs['From Max'].default_value = snow_line + 1.5
            nt.links.new(add.outputs[0], high.inputs['Value'])
            # A meredek sziklafalon nem marad meg a hó.
            steep = nt.nodes.new('ShaderNodeMapRange')
            steep.clamp = True
            steep.inputs['From Min'].default_value = 0.1
            steep.inputs['From Max'].default_value = 0.28
            nt.links.new(sep_n.outputs['Z'], steep.inputs['Value'])
            cap = nt.nodes.new('ShaderNodeMath')
            cap.operation = 'MULTIPLY'
            nt.links.new(high.outputs[0], cap.inputs[0])
            nt.links.new(steep.outputs[0], cap.inputs[1])
            both = nt.nodes.new('ShaderNodeMath')
            both.operation = 'MAXIMUM'
            nt.links.new(factor, both.inputs[0])
            nt.links.new(cap.outputs[0], both.inputs[1])
            factor = both.outputs[0]
        mix = nt.nodes.new('ShaderNodeMixShader')
        nt.links.new(factor, mix.inputs[0])
        nt.links.new(bsdf.outputs[0], mix.inputs[1])
        nt.links.new(white.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], out.inputs[0])
    _materials[key] = m
    return m


def patch_mat(base, radius, soft=0.35, rough=1.0, scale=3.0):
    """Lágy szélű talajfolt (pl. kitaposott tér): a közepe fedő, a széle átlátszóba megy át."""
    key = ('patch', base, radius, soft, rough, scale)
    if key in _materials:
        return _materials[key]
    m = bpy.data.materials.new(f'm{len(_materials)}')
    if not m.node_tree:
        m.use_nodes = True
    nt = m.node_tree
    bsdf, _ = _principled(nt)
    bsdf.inputs['Roughness'].default_value = rough
    tex = nt.nodes.new('ShaderNodeTexNoise')
    tex.inputs['Scale'].default_value = scale
    tex.inputs['Detail'].default_value = 6.0
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.3
    ramp.color_ramp.elements[0].color = lin(shade(base, 0.72))
    ramp.color_ramp.elements[1].position = 0.72
    ramp.color_ramp.elements[1].color = lin(shade(base, 1.14))
    nt.links.new(tex.outputs[0], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], bsdf.inputs['Base Color'])
    coord = nt.nodes.new('ShaderNodeTexCoord')
    length = nt.nodes.new('ShaderNodeVectorMath')
    length.operation = 'LENGTH'
    nt.links.new(coord.outputs['Object'], length.inputs[0])
    edge = nt.nodes.new('ShaderNodeTexNoise')
    edge.inputs['Scale'].default_value = 1.1
    wob = nt.nodes.new('ShaderNodeMath')
    wob.operation = 'MULTIPLY_ADD'
    wob.inputs[1].default_value = radius * 0.5
    nt.links.new(edge.outputs[0], wob.inputs[0])
    nt.links.new(length.outputs['Value'], wob.inputs[2])
    alpha = nt.nodes.new('ShaderNodeMapRange')
    alpha.clamp = True
    alpha.inputs['From Min'].default_value = radius * (1 - soft) + radius * 0.25
    alpha.inputs['From Max'].default_value = radius * 1.25
    alpha.inputs['To Min'].default_value = 1.0
    alpha.inputs['To Max'].default_value = 0.0
    nt.links.new(wob.outputs[0], alpha.inputs['Value'])
    nt.links.new(alpha.outputs[0], bsdf.inputs['Alpha'])
    _materials[key] = m
    return m


# ---------- Transzformációs verem: csoportok elhelyezése ----------
_stack = [Matrix.Identity(4)]


class xf:
    """`with xf((x, y, z), rot_z, scale):` – a blokkban létrehozott testek együtt mozdulnak."""

    def __init__(self, loc=(0, 0, 0), rot_z=0.0, scale=1.0, matrix=None):
        self.m = matrix if matrix is not None else (
            Matrix.Translation(loc) @ Matrix.Rotation(rot_z, 4, 'Z') @ Matrix.Scale(scale, 4))

    def __enter__(self):
        _stack.append(_stack[-1] @ self.m)

    def __exit__(self, *exc):
        _stack.pop()


def _finish(name, bm, material, local, smooth):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material)
    if smooth:
        me.shade_smooth()
        if smooth is not True:
            me.set_sharp_from_angle(angle=math.radians(smooth))
    ob = bpy.data.objects.new(name, me)
    ob.matrix_world = _stack[-1] @ local
    bpy.context.scene.collection.objects.link(ob)
    return ob


def finish(bm, material, loc=(0, 0, 0), rot_z=0.0, smooth=False, name='mesh'):
    """Saját építésű bmesh háló elhelyezése a jelenetben (az aktuális csoporton belül)."""
    return _finish(name, bm, material, Matrix.Translation(loc) @ Matrix.Rotation(rot_z, 4, 'Z'), smooth)


def box(sx, sy, sz, loc, material, rot_z=0.0, name='box'):
    """Téglatest; a loc z-értéke az ALJA."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(0, 0, sz / 2), verts=bm.verts)
    return _finish(name, bm, material, Matrix.Translation(loc) @ Matrix.Rotation(rot_z, 4, 'Z'), False)


def cyl(r1, r2, h, loc, material, seg=20, rot_z=0.0, smooth=40, name='cyl'):
    """Henger, csonkakúp vagy kúp (r2 = 0); a loc z-értéke az ALJA."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r1, radius2=r2, depth=h)
    bmesh.ops.translate(bm, vec=(0, 0, h / 2), verts=bm.verts)
    return _finish(name, bm, material, Matrix.Translation(loc) @ Matrix.Rotation(rot_z, 4, 'Z'), smooth)


def limb(p0, p1, r0, r1, material, seg=10, name='limb'):
    """Elkeskenyedő henger két pont között (végtag, rúd, gerenda)."""
    a, b = Vector(p0), Vector(p1)
    d = b - a
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r0, radius2=r1, depth=d.length)
    local = Matrix.Translation((a + b) / 2) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    return _finish(name, bm, material, local, 40)


def ball(r, loc, material, scale=(1, 1, 1), seg=14, rot_z=0.0, name='ball'):
    """Gömb vagy ellipszoid; a loc a KÖZEPE."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=max(6, seg * 2 // 3), radius=r)
    bmesh.ops.scale(bm, vec=scale, verts=bm.verts)
    return _finish(name, bm, material, Matrix.Translation(loc) @ Matrix.Rotation(rot_z, 4, 'Z'), True)


def rock(r, loc, material, rng, squash=0.75, detail=2, rough=0.2, name='rock'):
    """Szabálytalan, lapolt szikla."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=detail, radius=r)
    for v in bm.verts:
        v.co *= 1 + rng.uniform(-rough, rough)
        v.co.z *= squash
    return _finish(name, bm, material, Matrix.Translation(loc) @ Matrix.Rotation(rng.uniform(0, 6.28), 4, 'Z'), False)


def blob(r, loc, material, rng, squash=0.85, rough=0.15, name='blob'):
    """Lágy, szabálytalan gömb (lombkorona, bokor)."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=r)
    for v in bm.verts:
        v.co *= 1 + rng.uniform(-rough, rough)
        v.co.z *= squash
    return _finish(name, bm, material, Matrix.Translation(loc) @ Matrix.Rotation(rng.uniform(0, 6.28), 4, 'Z'), True)


def gable(w, d, h, loc, material, rot_z=0.0, overhang=0.07, name='gable'):
    """Nyeregtető: a gerinc az X tengely mentén fut; a loc z-értéke az ALJA."""
    x, y = w / 2 + overhang, d / 2 + overhang
    bm = bmesh.new()
    v = [bm.verts.new(p) for p in ((-x, -y, 0), (x, -y, 0), (x, y, 0), (-x, y, 0), (-x, 0, h), (x, 0, h))]
    for f in ((0, 1, 5, 4), (2, 3, 4, 5), (1, 2, 5), (3, 0, 4), (3, 2, 1, 0)):
        bm.faces.new([v[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _finish(name, bm, material, Matrix.Translation(loc) @ Matrix.Rotation(rot_z, 4, 'Z'), False)


def pyramid(r, h, loc, material, rot_z=math.pi / 4, sides=4, name='pyramid'):
    """Gúlatető (r = a sarkok távolsága a középponttól)."""
    return cyl(r, 0.0, h, loc, material, seg=sides, rot_z=rot_z, smooth=False, name=name)


def disc(r, loc, material, h=0.02, seg=40, name='disc'):
    return cyl(r, r, h, loc, material, seg=seg, smooth=False, name=name)


def quad(points, material, name='quad'):
    """Tetszőleges négyszög (pl. zászló, ponyva) a megadott sarkokkal."""
    bm = bmesh.new()
    bm.faces.new([bm.verts.new(p) for p in points])
    return _finish(name, bm, material, Matrix.Identity(4), False)


def point_light(loc, color, energy, radius=0.2):
    """Pontfény (tábortűz, fáklya) az aktuális csoport helyén."""
    light = bpy.data.lights.new('point', 'POINT')
    light.energy = energy
    light.color = lin(color)[:3]
    light.shadow_soft_size = radius
    ob = bpy.data.objects.new('point', light)
    ob.matrix_world = _stack[-1] @ Matrix.Translation(loc)
    bpy.context.scene.collection.objects.link(ob)


# ---------- Jelenet, fények, kamera ----------
def init():
    """Egyszer hívandó: üres jelenet és renderbeállítások."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _materials.clear()
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.02
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 4
    scene.cycles.filter_width = 1.3
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.compression = 20
    try:
        scene.view_settings.look = 'AgX - Medium High Contrast'
    except TypeError:
        pass
    world = bpy.data.worlds.new('world')
    if not world.node_tree:
        world.use_nodes = True
    bg = next((n for n in world.node_tree.nodes if n.type == 'BACKGROUND'), None)
    if bg is None:
        bg = world.node_tree.nodes.new('ShaderNodeBackground')
        out = world.node_tree.nodes.new('ShaderNodeOutputWorld')
        world.node_tree.links.new(bg.outputs[0], out.inputs[0])
    bg.inputs[0].default_value = lin('#51669a')
    bg.inputs[1].default_value = 0.5
    scene.world = world


def clear():
    """A jelenet kiürítése két kép között (az anyagok megmaradnak)."""
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for block in (bpy.data.meshes, bpy.data.lights, bpy.data.cameras):
        for item in list(block):
            block.remove(item)
    del _stack[1:]


def yawed(v, yaw):
    c, s = math.cos(yaw), math.sin(yaw)
    return Vector((v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]))


def _sun(direction, color, energy, angle, shadow=True):
    light = bpy.data.lights.new('sun', 'SUN')
    light.energy = energy
    light.use_shadow = shadow
    light.color = lin(color)[:3]
    light.angle = math.radians(angle)
    ob = bpy.data.objects.new('sun', light)
    ob.rotation_euler = direction.normalized().to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.collection.objects.link(ob)


def render(path, px, frame, target_z=0.0, samples=48, yaw=YAW, key=4.4, rim=1.4):
    """Négyzetes, átlátszó hátterű kép a közös kameraszögből.

    frame: a kép szélessége világegységben; target_z: a kép közepére kerülő magasság.
    Visszaadja a talajpont (origó) helyét a képen és a képpont/világegység arányt.
    """
    scene = bpy.context.scene
    _sun(yawed((0.8, 0.45, -1.0), yaw), '#ffd9a6', key, 7)     # meleg főfény a néző felől, balról
    _sun(yawed((-0.7, -0.8, -0.45), yaw), '#7f9cff', rim, 20, shadow=False)  # hideg ellenfény hátulról, árnyék nélkül

    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=frame * 2)
    me = bpy.data.meshes.new('catcher')
    bm.to_mesh(me)
    bm.free()
    catcher = bpy.data.objects.new('catcher', me)
    catcher.is_shadow_catcher = True
    scene.collection.objects.link(catcher)

    cam_data = bpy.data.cameras.new('cam')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = frame
    cam = bpy.data.objects.new('cam', cam_data)
    forward = yawed((0, math.sin(TILT), -math.cos(TILT)), yaw)
    cam.location = Vector((0, 0, target_z)) - forward * 60
    cam.rotation_euler = forward.to_track_quat('-Z', 'Y').to_euler()
    scene.collection.objects.link(cam)
    scene.camera = cam

    scene.cycles.samples = samples
    scene.render.resolution_x = px
    scene.render.resolution_y = px
    scene.render.resolution_percentage = 100
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    ppu = px / frame
    return {'w': px, 'h': px, 'ax': px / 2, 'ay': px / 2 + target_z * HEIGHT_K * ppu, 'ppu': ppu}
