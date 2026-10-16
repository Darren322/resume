"""Generate the Midnight Systems Lab workstation asset.

Run with Blender 5.2 in background mode:
  Blender --background --python scripts/generate_workstation.py

Most furniture is authored from primitives. The lamp, monitor, laptop, phone,
mug, project folder, notebook and graduation cap are CC-BY Sketchfab models read from
`model-sources/` (gitignored; see `model-sources/CREDITS.tsv` and the site
credits). They are re-oriented, scaled into the desk's units and renamed to
the names the runtime looks up. Run `npm run optimize:desk` afterwards to
shrink textures and compress geometry.

Composition notes (the runtime camera looks down at ~63°):
- Everything a visitor should read lies flat or leans back, because an upright
  plane seen from 63° keeps only ~45% of its height.
- Each hotspot has a distinct silhouette from above, so four sections never
  read as four identical sheets of paper.
- Each hotspot carries a masking-tape label (`hotspot-tag-<id>`); the browser
  paints its text so copy stays in TypeScript, not in the GLB.
"""

from pathlib import Path
import bpy
import math
from mathutils import Euler, Matrix, Vector


ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "model-sources"
# Raw export (textures at source size); `npm run optimize:desk` writes public/assets/workstation.glb.
OUTPUT = SOURCES / "workstation.raw.glb"
DESK_TOP = 1.64


def material(name, color, metallic=0.0, roughness=0.55, emission=None, strength=2.4):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    principled = mat.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (*color, 1.0)
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Roughness"].default_value = roughness
    if emission:
        principled.inputs["Emission Color"].default_value = (*emission, 1.0)
        principled.inputs["Emission Strength"].default_value = strength
    return mat


SLATE = material("Graphite", (0.045, 0.055, 0.075), metallic=0.4, roughness=0.38)
ALUMINIUM = material("Aluminium", (0.4, 0.42, 0.46), metallic=0.45, roughness=0.5)
AQUA = material("Aqua", (0.06, 0.62, 0.72), metallic=0.2, roughness=0.28, emission=(0.04, 0.48, 0.6), strength=0.7)
EYE = material("Robot Eye", (0.3, 0.95, 1.0), metallic=0.0, roughness=0.2, emission=(0.2, 0.9, 1.0), strength=3.0)
AMBER = material("Coral Amber", (0.92, 0.28, 0.12), metallic=0.12, roughness=0.35, emission=(0.7, 0.12, 0.03), strength=0.5)
PAPER = material("Warm Paper", (0.86, 0.8, 0.7), metallic=0.0, roughness=0.86)
MANILA = material("Manila", (0.6, 0.45, 0.25), metallic=0.0, roughness=0.8)
CERAMIC = material("Ceramic", (0.82, 0.8, 0.76), metallic=0.0, roughness=0.35)
BULB = material("Bulb", (1.0, 0.82, 0.55), metallic=0.0, roughness=0.3, emission=(1.0, 0.72, 0.38), strength=6.0)
NIGHT_SKY = material("Night Window", (0.01, 0.025, 0.06), metallic=0.0, roughness=0.5, emission=(0.03, 0.07, 0.16), strength=1.2)
TAPE = material("Masking Tape", (0.86, 0.78, 0.6), metallic=0.0, roughness=0.9)
KEYCAP_BLUE = material("Cyan Blue Keycap", (0.016, 0.38, 0.69), metallic=0.05, roughness=0.4)
KEYBOARD_BASE = material("Keyboard Base", (0.012, 0.012, 0.016), metallic=0.2, roughness=0.5)
SWITCH = material("Switch Housing", (0.62, 0.64, 0.66), metallic=0.0, roughness=0.35)
DISPLAY = material("Keyboard Display", (0.62, 0.64, 0.6), metallic=0.0, roughness=0.4)
SURFACE = material("Reading Surface", (1.0, 0.0, 1.0), metallic=0.0, roughness=1.0)


def pbr_material(name, stem):
    """A Principled material from a Poly Haven (CC0) texture set in
    model-sources/textures: colour, OpenGL normal map, and the packed
    AO/roughness/metal map (G = roughness, B = metallic), as glTF expects."""
    folder = SOURCES / "textures"
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    principled = nodes.get("Principled BSDF")

    def image(suffix, colour):
        node = nodes.new("ShaderNodeTexImage")
        node.image = bpy.data.images.load(str(next(folder.glob(f"{stem}_{suffix}_*.jpg"))))
        node.image.colorspace_settings.name = "sRGB" if colour else "Non-Color"
        return node

    links.new(image("diff", True).outputs["Color"], principled.inputs["Base Color"])
    normal_map = nodes.new("ShaderNodeNormalMap")
    links.new(image("nor_gl", False).outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], principled.inputs["Normal"])
    separate = nodes.new("ShaderNodeSeparateColor")
    links.new(image("arm", False).outputs["Color"], separate.inputs["Color"])
    links.new(separate.outputs["Green"], principled.inputs["Roughness"])
    links.new(separate.outputs["Blue"], principled.inputs["Metallic"])
    return mat


def box_uv(obj, tile):
    """World-space box projection: each face takes UVs from the two axes it
    lies across, one texture repeat every `tile` desk units."""
    mesh = obj.data
    uv = mesh.uv_layers.active or mesh.uv_layers.new()
    for polygon in mesh.polygons:
        normal = polygon.normal
        axis = max(range(3), key=lambda index: abs(normal[index]))
        u_axis, v_axis = {0: (1, 2), 1: (0, 2), 2: (0, 1)}[axis]
        for loop_index in polygon.loop_indices:
            co = obj.matrix_world @ mesh.vertices[mesh.loops[loop_index].vertex_index].co
            uv.data[loop_index].uv = (co[u_axis] / tile, co[v_axis] / tile)


def apply_material(obj, mat):
    obj.data.materials.append(mat)
    return obj


def tag(obj, hotspot):
    if hotspot:
        obj["hotspotId"] = hotspot
    return obj


def bevel(obj, width, segments=2):
    if not width:
        return
    modifier = obj.modifiers.new("soft bevel", "BEVEL")
    modifier.width = width
    modifier.segments = segments
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def cube(name, location, scale, mat, bevel_width=0.025, hotspot=None, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = (scale[0] / 2, scale[1] / 2, scale[2] / 2)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    apply_material(obj, mat)
    bevel(obj, bevel_width)
    obj.rotation_euler = rotation
    return tag(obj, hotspot)


def cylinder(name, location, radius, depth, mat, vertices=24, rotation=(0, 0, 0), hotspot=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    apply_material(obj, mat)
    bevel(obj, min(radius * 0.16, 0.03))
    return tag(obj, hotspot)


def rod(name, start, end, radius, mat, hotspot=None):
    """A cylinder spanning two points, used for lamp arms, pens and cords."""
    start, end = Vector(start), Vector(end)
    direction = end - start
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=radius, depth=direction.length, location=(start + end) / 2)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    apply_material(obj, mat)
    return tag(obj, hotspot)


def sphere(name, location, scale, mat, hotspot=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.ops.object.shade_smooth()
    apply_material(obj, mat)
    return tag(obj, hotspot)


def flat_plane(name, location, width, depth, mat, hotspot=None, rotation_z=0.0, tilt_x=0.0):
    """A UV-stable plane whose texture top faces the back of the desk.

    `tilt_x` leans the plane up toward the viewer (90° = upright, facing front).
    """
    bpy.ops.mesh.primitive_plane_add(size=2, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = (width / 2, depth / 2, 1)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.rotation_euler = (math.radians(tilt_x), 0, rotation_z)
    apply_material(obj, mat)
    return tag(obj, hotspot)


def rounded_plane(name, location, width, depth, radius, mat, hotspot=None, rotation_z=0.0, tilt_x=0.0):
    """A flat rectangle with rounded corners (screens, glass)."""
    bpy.ops.mesh.primitive_plane_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = (width, depth, 1)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    corners = obj.modifiers.new("corners", "BEVEL")
    corners.affect = "VERTICES"
    corners.width = radius
    corners.segments = 10
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=corners.name)
    obj.rotation_euler = (math.radians(tilt_x), 0, rotation_z)
    apply_material(obj, mat)
    return tag(obj, hotspot)


def rounded_slab(name, location, width, depth, thickness, radius, mat, hotspot=None, rotation=(0, 0, 0), edge=0.008):
    """A rounded-rectangle body with real corner radii (phones, laptops, monitors),
    instead of a box whose bevel only softens its edges."""
    obj = rounded_plane(name, location, width, depth, radius, mat, hotspot)
    obj.rotation_euler = (0, 0, 0)
    shell = obj.modifiers.new("thickness", "SOLIDIFY")
    shell.thickness = thickness
    shell.offset = 0
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=shell.name)
    if edge:
        soften = obj.modifiers.new("edge", "BEVEL")
        soften.width = edge
        soften.segments = 2
        soften.limit_method = "ANGLE"
        bpy.ops.object.modifier_apply(modifier=soften.name)
    obj.rotation_euler = rotation
    return obj


def tape_label(hotspot, location, rotation_z=0.0):
    """Masking tape strip; the browser paints the section name onto it."""
    return flat_plane(f"hotspot-tag-{hotspot}", location, 1.05, 0.3, TAPE, hotspot, rotation_z)


def surface(hotspot, location, width, depth, rotation_z=0.0, tilt_x=0.0):
    """Invisible reading surface: where the browser lays the section's content
    when the artifact is held up. Its normal faces the viewer while held."""
    return flat_plane(f"surface-{hotspot}", location, width, depth, SURFACE, hotspot, rotation_z, tilt_x)


def empty(name, location=(0, 0, 0)):
    bpy.ops.object.empty_add(type="PLAIN_AXES", location=location)
    obj = bpy.context.object
    obj.name = name
    obj.empty_display_size = 0.08
    return obj


def parent_keep_world(child, parent):
    world = child.location.copy()
    child.parent = parent
    child.location = world - parent.location


def select_only(objs):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objs:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]


def bake(objs):
    """Apply object transforms into mesh data (custom normals included)."""
    select_only(objs)
    bpy.ops.object.make_single_user(type="SELECTED_OBJECTS", object=True, obdata=True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def transform(objs, matrix):
    for obj in objs:
        obj.matrix_world = matrix @ obj.matrix_world
    bake(objs)


def bounds(objs):
    points = [obj.matrix_world @ vertex.co for obj in objs for vertex in obj.data.vertices]
    low = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    high = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return low, high


def import_model(file, rotation=(0, 0, 0), drop=()):
    """Import a downloaded glTF, keep only its meshes (minus `drop` name
    fragments), and bake its node transforms plus `rotation` (degrees, XYZ).
    The result lives in world space with identity object transforms."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(SOURCES / file))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    meshes = [
        obj for obj in imported
        if obj.type == "MESH"
        and not any(part in obj.name for part in drop)
        and not any(modifier.type == "ARMATURE" for modifier in obj.modifiers)
    ]
    for obj in meshes:
        world = obj.matrix_world.copy()
        obj.parent = None
        obj.matrix_world = world
        for modifier in list(obj.modifiers):
            obj.modifiers.remove(modifier)
    for obj in imported:
        if obj not in meshes:
            bpy.data.objects.remove(obj, do_unlink=True)
    transform(meshes, Euler(tuple(math.radians(angle) for angle in rotation)).to_matrix().to_4x4())
    return meshes


def fit(objs, axis, size, place, stretch=(1, 1, 1), points=()):
    """Scale uniformly so the bounding box measures `size` along `axis` (then
    apply `stretch`), and move its footprint centre to `place=(x, y, bottom_z)`.
    Returns `points` carried through the same transform."""
    low, high = bounds(objs)
    scale = size / (high - low)["xyz".index(axis)]
    centre = Vector(((low.x + high.x) / 2, (low.y + high.y) / 2, low.z))
    matrix = (
        Matrix.Translation(Vector(place))
        @ Matrix.Diagonal((scale * stretch[0], scale * stretch[1], scale * stretch[2], 1))
        @ Matrix.Translation(-centre)
    )
    transform(objs, matrix)
    return [matrix @ Vector(point) for point in points]


def finalize(objs, prefix, hotspot=None, names=None):
    """Name meshes `<prefix>` (or `names[obj]` for parts the runtime looks up),
    put each origin at its geometry centre and tag the hotspot."""
    names = names or {}
    for obj in objs:
        obj.name = names.get(obj, prefix)
        obj.data.name = obj.name
        tag(obj, hotspot)
    select_only(objs)
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    return objs


def by_material(objs, name):
    """Meshes whose first material is `name` (Blender may add a .001 suffix)."""
    def matches(obj):
        material = obj.data.materials[0] if obj.data.materials else None
        return material is not None and (material.name == name or material.name.startswith(name + "."))
    return [obj for obj in objs if matches(obj)]


def rotate_about(objs, centre, degrees, axis="Z"):
    centre = Vector(centre)
    transform(objs, Matrix.Translation(centre) @ Matrix.Rotation(math.radians(degrees), 4, axis) @ Matrix.Translation(-centre))


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def build_room():
    # Dark, deep floor and one back wall: from above the desk floats in a lamp
    # pool, so there is no diorama box edge to explain. Both carry real (CC0)
    # surface texture; the runtime tints them down to midnight.
    box_uv(cube("room-floor", (0, 0, 0), (28, 18, 0.18), pbr_material("Midnight Floor", "concrete_floor_worn_001"), 0.0), 6.0)
    box_uv(cube("room-back-wall", (0, 3.9, 4.0), (28, 0.18, 8.0), pbr_material("Midnight Plaster", "painted_plaster_wall"), 0.0), 5.0)
    # A night window gives the cool counter-light its motivation.
    flat_plane("room-window-sky", (3.2, 3.79, 4.2), 3.6, 2.2, NIGHT_SKY, tilt_x=90)
    for x in (1.4, 3.2, 5.0):
        cube("room-window-mullion", (x, 3.76, 4.2), (0.08, 0.06, 2.3), SLATE, 0.0)
    for z in (3.1, 5.3):
        cube("room-window-mullion", (3.2, 3.76, z), (3.7, 0.06, 0.08), SLATE, 0.0)

    # Walnut veneer (CC0), grain running along the desk; one repeat per ~4 units.
    box_uv(cube("desk-top", (0, -0.55, DESK_TOP - 0.09), (10.8, 3.8, 0.18), pbr_material("Walnut Desk", "walnut_veneer_02"), 0.06), 4.0)
    for x in (-4.8, 4.8):
        cube("desk-leg", (x, -0.55, 0.78), (0.24, 2.8, 1.55), SLATE, 0.04)
    cube("desk-crossbar", (0, 0.35, 0.72), (9.6, 0.14, 0.14), SLATE, 0.02)


def build_lamp():
    """Luxo L-1 architect lamp clamped to the back edge of the desk. The shade
    marker anchors the runtime spotlight."""
    parts = import_model("lamp-luxo.glb")
    # Model units: clamp near the origin, head reaching +Y at ~0.7 high.
    clamp, head, bulb = Vector((0.0, -0.01, 0.0)), Vector((0.006, 0.13, 0.71)), Vector((0.006, 0.16, 0.68))
    scale = 3.2
    # Clamped to the back edge left of the monitor, its elbow out behind the
    # desk and its head reaching forward, so the light falls in front of the
    # monitor and never shadows the resume.
    turn = math.degrees(math.atan2(-1.0, 0.5)) - 90
    matrix = (
        Matrix.Translation((-4.3, 1.38, DESK_TOP))
        @ Matrix.Rotation(math.radians(turn), 4, "Z")
        @ Matrix.Diagonal((scale, scale, scale, 1))
        @ Matrix.Translation(-clamp)
    )
    transform(parts, matrix)
    finalize(parts, "desk-lamp-body")
    shade = empty("desk-lamp-shade", matrix @ head)
    # Parented so the optimiser never prunes the shade marker as an empty leaf.
    parent_keep_world(sphere("desk-lamp-bulb", matrix @ bulb, (0.09, 0.09, 0.09), BULB), shade)


def build_monitor():
    """A 34-inch 21:9 curved ultrawide. The panel tilts back 18° on its stand so
    the screen reads from above. Ambient only: the runtime paints a wallpaper."""
    tilt = 18
    x, y = -1.1, 0.72
    # Turned so the screen faces -Y (the viewer); the panel spans X.
    parts = import_model("monitor.glb", rotation=(0, 0, -90))
    screen = by_material(parts, "Material.003")[0]
    low, high = bounds([screen])
    # Re-project the screen's UVs (u across, v up) so the wallpaper maps straight on.
    uv = screen.data.uv_layers.active or screen.data.uv_layers.new()
    for loop in screen.data.loops:
        co = screen.data.vertices[loop.vertex_index].co
        uv.data[loop.index].uv = ((co.x - low.x) / (high.x - low.x), (co.z - low.z) / (high.z - low.z))
    panel = [obj for obj in parts if bounds([obj])[0].z > 0.8]
    # Tilt about the stand's mount, at the back of the panel.
    pivot = Matrix.Translation((0, 0.5, 1.9)) @ Matrix.Rotation(math.radians(-tilt), 4, "X") @ Matrix.Translation((0, -0.5, -1.9))
    transform(panel, pivot)
    # The source is 32:9; narrow it to 21:9.
    fit(parts, "z", 2.9, (x, y, DESK_TOP), stretch=(0.8, 1, 1))
    # The power LED ships very hot; at desk scale it should be a pinprick.
    for obj in parts:
        for material in obj.data.materials:
            principled = material.node_tree.nodes.get("Principled BSDF") if material and material.use_nodes else None
            if principled:
                principled.inputs["Emission Strength"].default_value *= 0.12
    finalize(parts, "overview-monitor", names={screen: "monitor-portfolio-screen"})


def build_laptop():
    """A MacBook Pro in space black, lid open. Front row: work is the second
    thing a recruiter reads."""
    x, y = 0.75, -1.15
    parts = import_model("laptop.glb")
    display = by_material(parts, "xelfFIHMTwrMhxW")[0]
    # Width 2.2 desk units; the base (not the leaning lid) centres on (x, y).
    low, high = bounds(parts)
    base_offset = (low.y + high.y) / 2 * (2.2 / (high.x - low.x))
    fit(parts, "x", 2.2, (x, y + base_offset, DESK_TOP))
    low, high = bounds([display])
    rise, run = high.z - low.z, high.y - low.y
    lean = math.atan2(run, rise)
    finalize(parts, "hotspot-work-laptop", "work", {display: "laptop-display"})
    normal = Vector((0, -math.cos(lean), math.sin(lean)))
    surface("work", (low + high) / 2 + normal * 0.02, high.x - low.x, math.hypot(rise, run), tilt_x=90 - math.degrees(lean))
    tape_label("work", (x - 0.35, y - 1.0, DESK_TOP + 0.005), math.radians(4))


def outline_slab(name, outline, z, height, mat, hotspot=None, edge=0.03):
    """A slab whose footprint is the polygon `outline` (counter-clockwise XY),
    from `z` up by `height`, with softened edges."""
    count = len(outline)
    verts = [(px, py, z) for px, py in outline] + [(px, py, z + height) for px, py in outline]
    faces = [tuple(reversed(range(count))), tuple(range(count, 2 * count))]
    faces += [(index, (index + 1) % count, count + (index + 1) % count, count + index) for index in range(count)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    apply_material(obj, mat)
    if edge:
        bevel(obj, edge, segments=3)
    box_uv(obj, 0.6)
    return tag(obj, hotspot)


def sculpted_key(name, location, size, height, mat, hotspot, rotation_z=0.0, taper=0.78):
    """A keycap that narrows toward its top, like a real sculpted profile."""
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = (size[0] / 2, size[1] / 2, height / 2)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for vertex in obj.data.vertices:
        if vertex.co.z > 0:
            vertex.co.x *= taper
            vertex.co.y *= taper
    apply_material(obj, mat)
    bevel(obj, 0.012)
    obj.rotation_euler = (0, 0, rotation_z)
    return tag(obj, hotspot)




def convex_hull(points):
    """Monotone-chain convex hull, counter-clockwise."""
    points = sorted(set(points))
    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lower, upper = [], []
    for point in points:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], point) <= 0:
            lower.pop()
        lower.append(point)
    for point in reversed(points):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], point) <= 0:
            upper.pop()
        upper.append(point)
    return lower[:-1] + upper[:-1]


def boolean(target, other, operation):
    modifier = target.modifiers.new("combine", "BOOLEAN")
    modifier.operation = operation
    modifier.object = other
    modifier.solver = "EXACT"
    select_only([target])
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.data.objects.remove(other, do_unlink=True)


def build_keyboard():
    """Darren's Corne Choc Pro: per half a matte-black case shaped around its
    keys (stepping with the column stagger and wrapping the thumb cluster),
    with a rim standing up around low-profile Choc keycaps in cyan, three thumb
    keys (the inner one a 1.5u turned inward) and a reflective display flush
    against the index column. No cable. Each keycap top carries a
    `keyboard-legend` plane the browser paints a skill onto."""
    y = 0.3
    pitch_x, pitch_y = 0.18, 0.17
    cap_w, cap_d, key_height = 0.172, 0.162, 0.04
    stagger = (0.0, 0.0, 0.045, 0.07, 0.045, 0.03)  # pinky → index
    thumbs = ((0.09, -0.375, 0, 1.0), (0.285, -0.395, -8, 1.0), (0.5, -0.335, -22, 1.5))
    # The display fills its column: as tall as the index keys, flush against them.
    display_x, display_y, display_w, display_d = 0.622, 0.065, 0.15, 0.37
    case_height, floor, wall = 0.105, 0.065, 0.03

    def column_x(col):
        return (col - 2.5) * pitch_x

    def main_outline(margin):
        """Counter-clockwise footprint of the key block plus display, `margin` out from the keys."""
        def span(col):
            # Steps between columns are chamfered, not vertical: a vertical
            # step reads as a slit in the case.
            chamfer = 0.012
            left = column_x(col) - (cap_w / 2 + margin if col == 0 else pitch_x / 2 - chamfer)
            right = column_x(col) + pitch_x / 2 - (chamfer if col < 5 else 0)
            return left, right

        # Along the bottom left → right, up past the display, then along the top right → left.
        bottom = [point for col in range(6) for point in ((span(col)[0], -pitch_y + stagger[col] - cap_d / 2 - margin), (span(col)[1], -pitch_y + stagger[col] - cap_d / 2 - margin))]
        top = [point for col in reversed(range(6)) for point in ((span(col)[1], pitch_y + stagger[col] + cap_d / 2 + margin), (span(col)[0], pitch_y + stagger[col] + cap_d / 2 + margin))]
        d_left, d_right = column_x(5) + pitch_x / 2, display_x + display_w / 2 + margin
        d_low, d_high = display_y - display_d / 2 - margin, display_y + display_d / 2 + margin
        ring = bottom + [(d_left, d_low), (d_right, d_low), (d_right, d_high), (d_left, d_high)] + top
        cleaned = []
        for point in ring:
            point = (round(point[0], 5), round(point[1], 5))
            if not cleaned or point != cleaned[-1]:
                cleaned.append(point)
        return cleaned[:-1] if cleaned[0] == cleaned[-1] else cleaned

    def thumb_outline(margin):
        corners = []
        for px, py, degrees, length in thumbs:
            depth = cap_d + (length - 1) * pitch_y
            turn = math.radians(degrees)
            for sx in (-1, 1):
                for sy in (-1, 1):
                    corner = Vector((sx * (cap_w / 2 + margin), sy * (depth / 2 + margin)))
                    corner.rotate(Matrix.Rotation(turn, 2))
                    corners.append((round(px + corner.x, 5), round(py + corner.y, 5)))
        # Reach up into the key block so the two shapes join cleanly.
        corners += [(-0.02, -0.2), (0.62, -0.2)]
        return convex_hull(corners)

    floor_top = DESK_TOP + floor
    for centre_x, side in ((2.2, 1), (3.8, -1)):
        def place(px, py):
            return (centre_x + side * px, y + py)

        def footprint(outline):
            points = [place(px, py) for px, py in outline]
            return list(reversed(points)) if side < 0 else points  # mirroring flips the winding

        name = "hotspot-skills-keyboard" if side > 0 else "keyboard-half"
        case = outline_slab(name, footprint(main_outline(wall + 0.005)), DESK_TOP, case_height, KEYBOARD_BASE, "skills", edge=0)
        boolean(case, outline_slab("thumb-shell", footprint(thumb_outline(wall + 0.005)), DESK_TOP, case_height, KEYBOARD_BASE, edge=0), "UNION")
        # The pocket the keys sit in: the same shapes, a wall's width tighter.
        pocket = outline_slab("pocket", footprint(main_outline(0.012)), floor_top, 0.2, KEYBOARD_BASE, edge=0)
        boolean(pocket, outline_slab("thumb-pocket", footprint(thumb_outline(0.012)), floor_top, 0.2, KEYBOARD_BASE, edge=0), "UNION")
        boolean(case, pocket, "DIFFERENCE")
        # Tidy the boolean result (no bevel: on boolean geometry it throws spikes).
        select_only([case])
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.remove_doubles(threshold=0.0005)
        bpy.ops.mesh.dissolve_degenerate(threshold=0.0005)
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode="OBJECT")
        for polygon in case.data.polygons:
            polygon.use_smooth = False
        box_uv(case, 0.6)

        display = place(display_x, display_y)
        # A raised display module, its glass close to the rim like the real board.
        cube("keyboard-display-bezel", (*display, floor_top + 0.0175), (display_w, display_d, 0.035), KEYBOARD_BASE, 0.004, "skills")
        flat_plane(f"keyboard-display-{'left' if side > 0 else 'right'}", (*display, floor_top + 0.0355), display_w - 0.025, display_d - 0.035, DISPLAY, "skills")
        keys = [(column_x(col), pitch_y * (1 - row) + stagger[col], 0, 1.0) for row in range(3) for col in range(6)]
        keys += list(thumbs)
        for index, (px, py, degrees, length) in enumerate(keys):
            kx, ky = place(px, py)
            turn = math.radians(degrees * side)
            thumb = index >= 18
            depth = cap_d + (length - 1) * pitch_y
            cube("keyboard-switch", (kx, ky, floor_top + 0.009), (0.15, 0.14, 0.018), SWITCH, 0.004, "skills", rotation=(0, 0, turn))
            sculpted_key("keyboard-thumb-key" if thumb else "keyboard-key", (kx, ky, floor_top + 0.02 + key_height / 2), (cap_w, depth), key_height, KEYCAP_BLUE, "skills", turn, taper=0.93)
            flat_plane("keyboard-legend", (kx, ky, floor_top + 0.02 + key_height + 0.002), cap_w * 0.93 - 0.012, depth - cap_w * 0.07 - 0.012, KEYCAP_BLUE, "skills", turn)
    surface("skills", (3.0, y - 0.05, DESK_TOP + 0.2), 2.9, 1.0)
    tape_label("skills", (3.0, y + 0.64, DESK_TOP + 0.005), math.radians(-3))

def build_projects():
    """A document folder with papers peeking out: reads as 'a body of work'."""
    x, y = -2.85, -1.2
    parts = import_model("folder.glb", rotation=(0, 0, 90))
    fit(parts, "x", 1.6, (x, y, DESK_TOP))
    rotate_about(parts, (x, y, DESK_TOP), -4)
    top = bounds(parts)[1].z
    finalize(parts, "projects-folder", "projects")
    # A clean brief laid on the folder: the page the project content prints onto.
    flat_plane("projects-brief", (x + 0.04, y - 0.02, top + 0.004), 1.24, 0.9, PAPER, "projects", math.radians(-2))
    surface("projects", (x + 0.04, y - 0.02, top + 0.01), 1.2, 0.86, math.radians(-2))
    tape_label("projects", (x + 0.05, y - 0.38, top + 0.008), math.radians(-6))


def build_teaching():
    """An open spiral notebook with a pen: reads as 'explaining things'."""
    x, y = -4.45, -1.45
    turn = -4
    rotation = math.radians(turn)
    parts = import_model("notebook.glb")
    fit(parts, "x", 1.6, (x, y, DESK_TOP))
    pages = [obj for obj in parts if obj.data.materials and obj.data.materials[0].name.startswith("M_Paper")]
    page_top = bounds(pages)[1].z
    rotate_about(parts, (x, y, DESK_TOP), turn)
    finalize(parts, "teaching-notebook", "teaching")
    # Handwritten notes laid on each page; the browser writes them.
    for side, name in ((-1, "left"), (1, "right")):
        offset = Vector((side * 0.375, 0, 0))
        offset.rotate(Euler((0, 0, rotation)))
        flat_plane(f"notebook-notes-{name}", (x + offset.x, y + offset.y, page_top + 0.003), 0.75, 0.9, PAPER, "teaching", rotation)
    rod("teaching-pen", (x + 0.15, y - 0.5, page_top + 0.03), (x + 0.72, y + 0.32, page_top + 0.03), 0.03, AMBER, "teaching")
    surface("teaching", (x, y, page_top + 0.012), 1.5, 0.9, rotation)
    tape_label("teaching", (x - 0.15, y + 0.8, DESK_TOP + 0.005), math.radians(3))


def build_profile():
    """A Letter-size resume lying flat (89% legible from above) with an ID badge on its corner.

    It sits front and centre under the lamp: the first thing a recruiter looks for."""
    x, y = -1.15, -1.35
    rotation = math.radians(-5)
    cube("profile-paper-backing", (x, y, DESK_TOP + 0.008), (1.28, 1.64, 0.012), MANILA, 0.0, "profile", rotation=(0, 0, rotation))
    flat_plane("profile-resume-paper", (x, y, DESK_TOP + 0.016), 1.24, 1.6, PAPER, "profile", rotation)
    surface("profile", (x, y, DESK_TOP + 0.02), 1.24, 1.6, rotation)
    badge = (x + 0.62, y + 0.66)
    badge_turn = math.radians(14)
    cube("profile-badge", (*badge, DESK_TOP + 0.035), (0.4, 0.56, 0.02), CERAMIC, 0.01, "profile", rotation=(0, 0, badge_turn))
    cube("profile-badge-stripe", (badge[0] + 0.04, badge[1] + 0.15, DESK_TOP + 0.047), (0.36, 0.11, 0.006), AQUA, 0.0, "profile", rotation=(0, 0, badge_turn))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.06, minor_radius=0.014, location=(badge[0] + 0.07, badge[1] + 0.3, DESK_TOP + 0.05))
    clip = bpy.context.object
    clip.name = "profile-badge-clip"
    apply_material(clip, ALUMINIUM)
    tag(clip, "profile")
    tape_label("profile", (x - 0.05, y - 0.97, DESK_TOP + 0.005), math.radians(-2))


def build_education():
    """A Dean's List certificate with the graduation cap resting on its corner."""
    x, y = 2.85, -1.3
    turn = math.radians(6)
    # Nanyang Poly's Director's List certificate, tucked beneath SMU's at an angle.
    under_turn = math.radians(-7)
    under = Vector((-0.12, 0.1, 0))
    cube("education-certificate", (x + under.x, y + under.y, DESK_TOP + 0.004), (1.26, 0.9, 0.008), PAPER, 0.003, "education", rotation=(0, 0, under_turn))
    flat_plane("education-certificate-face-2", (x + under.x, y + under.y, DESK_TOP + 0.0085), 1.24, 0.88, PAPER, "education", under_turn)
    cube("education-certificate", (x, y, DESK_TOP + 0.016), (1.26, 0.9, 0.012), PAPER, 0.004, "education", rotation=(0, 0, turn))
    surface("education", (x, y, DESK_TOP + 0.026), 1.26, 0.9, turn)
    # The printed face: the browser paints the Dean's List certificate onto it.
    flat_plane("education-certificate-face", (x, y, DESK_TOP + 0.023), 1.24, 0.88, PAPER, "education", turn)
    # Bottom right: the printed text runs down the left, the cap sits top right.
    seal = Vector((0.4, -0.26, 0))
    seal.rotate(Euler((0, 0, turn)))
    cylinder("education-seal", (x + seal.x, y + seal.y, DESK_TOP + 0.033), 0.11, 0.02, AMBER, vertices=24, hotspot="education")
    for side in (-1, 1):
        cube("education-seal-ribbon", (x + seal.x + side * 0.05, y + seal.y - 0.14, DESK_TOP + 0.028), (0.06, 0.2, 0.006), AMBER, 0.0, "education", rotation=(0, 0, math.radians(side * 14)))
    # A fabric mortarboard (CC-BY Sketchfab) resting on the certificate's corner,
    # its tassel falling toward the viewer.
    cap = import_model("grad-cap.glb", rotation=(0, 0, 200))
    fit(cap, "x", 1.0, (x + 0.6, y + 0.25, DESK_TOP + 0.015))
    finalize(cap, "education-cap", "education")
    tape_label("education", (x - 0.05, y - 0.7, DESK_TOP + 0.005), math.radians(-4))


def build_contact():
    """An iPhone 17 Pro Max in Deep Blue lying face up; the runtime paints its lock screen."""
    x, y = 4.75, -1.55
    turn = -12
    rotation = math.radians(turn)
    # Stood upright in the source with the screen facing -X; lay it face up, top to the back.
    parts = import_model("phone.glb", rotation=(0, 90, 90))
    screen = by_material(parts, "screen.001")[0]
    # The source is Cosmic Orange; Darren's phone is Deep Blue. Recolour every
    # untextured orange part (back, frame, camera surrounds).
    deep_blue = (0.018, 0.034, 0.085, 1.0)
    for obj in parts:
        for material in obj.data.materials:
            # Several of the source's shells face inward; single-sided they read as see-through.
            if material:
                material.use_backface_culling = False
            principled = material.node_tree.nodes.get("Principled BSDF") if material and material.use_nodes else None
            if not principled or principled.inputs["Base Color"].links:
                continue
            r, g, b, _ = principled.inputs["Base Color"].default_value
            if r > 0.15 and r > 2 * b and r > 1.3 * g:
                principled.inputs["Base Color"].default_value = deep_blue
    fit(parts, "y", 1.04, (x, y, DESK_TOP))
    # Point every face outward: the source's inward normals let depth-based
    # passes (AO) see straight through the phone.
    for obj in parts:
        select_only([obj])
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode="OBJECT")
    # The screen is a single sheet, so "outward" is ambiguous: face it up.
    if sum(polygon.normal.z for polygon in screen.data.polygons) < 0:
        screen.data.flip_normals()
    low, high = bounds([screen])
    width, length = high.x - low.x, high.y - low.y
    # Re-project the screen's UVs (u across, v toward the top) so the runtime's
    # painted lock screen maps straight onto the glass.
    uv = screen.data.uv_layers.active or screen.data.uv_layers.new()
    for loop in screen.data.loops:
        co = screen.data.vertices[loop.vertex_index].co
        uv.data[loop.index].uv = ((co.x - low.x) / width, (co.y - low.y) / length)
    rotate_about(parts, (x, y, DESK_TOP), turn)
    low, high = bounds([screen])
    centre = (low + high) / 2
    finalize(parts, "contact-phone", "contact", {screen: "contact-phone-screen"})
    surface("contact", (centre.x, centre.y, high.z + 0.006), width * 0.97, length * 0.97, rotation)
    tape_label("contact", (x - 0.1, y - 0.76, DESK_TOP + 0.005), math.radians(5))


def build_ambient_props():
    # Mug under the lamp: the runtime adds steam above `ambient-mug`.
    parts = import_model("mug.glb", rotation=(0, 0, -90))
    fit(parts, "z", 0.45, (-3.5, 0.35, DESK_TOP))
    for obj in parts:
        for material in obj.data.materials:
            # The source ships an alpha channel it never uses; keep the glaze opaque.
            principled = material.node_tree.nodes.get("Principled BSDF") if material and material.use_nodes else None
            if principled:
                for link in list(principled.inputs["Alpha"].links):
                    material.node_tree.links.remove(link)
                principled.inputs["Alpha"].default_value = 1.0
    finalize(parts, "ambient-mug")


def build_guide_robot():
    """A small desk-toy companion; the runtime turns its head toward hovered objects."""
    x, y = 4.7, 0.85
    cube("guide-robot-body", (x, y, DESK_TOP + 0.24), (0.5, 0.4, 0.42), CERAMIC, 0.08)
    for side in (-1, 1):
        cylinder("guide-robot-arm", (x + side * 0.3, y, DESK_TOP + 0.26), 0.06, 0.28, CERAMIC, vertices=12)
    head = empty("guide-robot-head", (x, y, DESK_TOP + 0.66))
    parts = [
        cube("guide-robot-head-shell", (x, y, DESK_TOP + 0.66), (0.64, 0.5, 0.42), CERAMIC, 0.1),
        cube("guide-robot-face", (x, y - 0.24, DESK_TOP + 0.66), (0.5, 0.04, 0.3), SLATE, 0.04),
        rod("guide-robot-antenna", (x, y, DESK_TOP + 0.86), (x, y, DESK_TOP + 1.04), 0.015, SLATE),
        sphere("guide-robot-antenna-tip", (x, y, DESK_TOP + 1.06), (0.05, 0.05, 0.05), AMBER),
    ]
    for side in (-1, 1):
        parts.append(sphere("guide-robot-eye", (x + side * 0.11, y - 0.265, DESK_TOP + 0.69), (0.045, 0.02, 0.055), EYE))
    for part in parts:
        parent_keep_world(part, head)


def group_hotspot_roots():
    hotspot_ids = ("projects", "work", "skills", "teaching", "education", "contact", "profile")
    roots = {}
    for hotspot_id in hotspot_ids:
        root = empty(f"hotspot-root-{hotspot_id}")
        root["hotspotId"] = hotspot_id
        roots[hotspot_id] = root
    for obj in list(bpy.data.objects):
        if obj.type == "EMPTY" or obj.parent is not None:
            continue
        hotspot_id = obj.get("hotspotId")
        if hotspot_id in roots:
            obj.parent = roots[hotspot_id]

    # The Three.js interaction animates each root as a single picked-up object.
    # Keep the pivot at the authored object's centroid rather than world origin,
    # so lift/tilt transforms never swing the whole desk zone through the room.
    for root in roots.values():
        children = [obj for obj in bpy.data.objects if obj.parent == root and obj.type != "EMPTY"]
        if not children:
            continue
        center = tuple(sum(obj.location[index] for obj in children) / len(children) for index in range(3))
        root.location = center
        for obj in children:
            obj.location = tuple(obj.location[index] - center[index] for index in range(3))


def main():
    clear_scene()
    build_room()
    build_lamp()
    build_monitor()
    build_laptop()
    build_keyboard()
    build_projects()
    build_teaching()
    build_profile()
    build_education()
    build_contact()
    build_ambient_props()
    build_guide_robot()
    # Image planes intentionally use placeholder materials in the GLB. The
    # browser applies the local sRGB artwork after load, avoiding embedded blob
    # URLs and keeping unmounts race-safe.
    group_hotspot_roots()

    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.engine = "BLENDER_EEVEE"
    scene.world.color = (0.012, 0.016, 0.03)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCES / "workstation.blend"))
    bpy.ops.export_scene.gltf(filepath=str(OUTPUT), export_format="GLB", export_apply=True, export_lights=False, export_cameras=False)
    print(f"WORKSTATION_GLTF={OUTPUT}")


if __name__ == "__main__":
    main()
