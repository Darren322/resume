"""Generate the Midnight Systems Lab workstation asset.

Run with Blender 5.2 in background mode:
  Blender --background --python scripts/generate_workstation.py

The scene deliberately uses authored primitives and shared materials so the GLB
stays small, reproducible, and independent of external textures or trademarks.

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
from mathutils import Euler, Vector


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "assets" / "workstation.glb"
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


NIGHT = material("Midnight Room", (0.018, 0.024, 0.045), metallic=0.0, roughness=0.92)
WALNUT = material("Walnut Desk", (0.3, 0.15, 0.085), metallic=0.02, roughness=0.62)
SLATE = material("Graphite", (0.045, 0.055, 0.075), metallic=0.4, roughness=0.38)
ALUMINIUM = material("Aluminium", (0.4, 0.42, 0.46), metallic=0.45, roughness=0.5)
AQUA = material("Aqua", (0.06, 0.62, 0.72), metallic=0.2, roughness=0.28, emission=(0.04, 0.48, 0.6), strength=0.7)
EYE = material("Robot Eye", (0.3, 0.95, 1.0), metallic=0.0, roughness=0.2, emission=(0.2, 0.9, 1.0), strength=3.0)
KEYCAP = material("Keycap", (0.13, 0.15, 0.19), metallic=0.1, roughness=0.55)
SCREEN = material("Screen Glow", (0.02, 0.09, 0.12), metallic=0.0, roughness=0.6, emission=(0.05, 0.32, 0.42), strength=0.55)
AMBER = material("Coral Amber", (0.92, 0.28, 0.12), metallic=0.12, roughness=0.35, emission=(0.7, 0.12, 0.03), strength=0.5)
PAPER = material("Warm Paper", (0.86, 0.8, 0.7), metallic=0.0, roughness=0.86)
MANILA = material("Manila", (0.6, 0.45, 0.25), metallic=0.0, roughness=0.8)
TEAL_FOLDER = material("Teal Folder", (0.05, 0.36, 0.38), metallic=0.0, roughness=0.7)
CORAL_FOLDER = material("Coral Folder", (0.72, 0.24, 0.16), metallic=0.0, roughness=0.7)
RUBBER = material("Rubber", (0.04, 0.035, 0.04), metallic=0.0, roughness=0.8)
CERAMIC = material("Ceramic", (0.82, 0.8, 0.76), metallic=0.0, roughness=0.35)
COFFEE = material("Coffee", (0.09, 0.045, 0.02), metallic=0.0, roughness=0.15)
LAMP_METAL = material("Lamp Enamel", (0.04, 0.2, 0.22), metallic=0.55, roughness=0.32)
BULB = material("Bulb", (1.0, 0.82, 0.55), metallic=0.0, roughness=0.3, emission=(1.0, 0.72, 0.38), strength=6.0)
NIGHT_SKY = material("Night Window", (0.01, 0.025, 0.06), metallic=0.0, roughness=0.5, emission=(0.03, 0.07, 0.16), strength=1.2)
TAPE = material("Masking Tape", (0.86, 0.78, 0.6), metallic=0.0, roughness=0.9)
KEYCAP_BLUE = material("Cyan Blue Keycap", (0.016, 0.38, 0.69), metallic=0.05, roughness=0.4)
KEYBOARD_BASE = material("Keyboard Base", (0.012, 0.012, 0.016), metallic=0.2, roughness=0.5)
SURFACE = material("Reading Surface", (1.0, 0.0, 1.0), metallic=0.0, roughness=1.0)
PHONE_FRAME = material("Cosmic Orange Frame", (0.85, 0.24, 0.05), metallic=0.85, roughness=0.32)
GLASS_BLACK = material("Black Glass", (0.004, 0.004, 0.006), metallic=0.0, roughness=0.38)
SPACE_BLACK = material("Space Black", (0.032, 0.033, 0.037), metallic=0.6, roughness=0.36)
MAC_KEY = material("Mac Key", (0.008, 0.008, 0.009), metallic=0.0, roughness=0.62)


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


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def build_room():
    # Dark, deep floor and one back wall: from above the desk floats in a lamp
    # pool, so there is no diorama box edge to explain.
    cube("room-floor", (0, 0, 0), (28, 18, 0.18), NIGHT, 0.0)
    cube("room-back-wall", (0, 3.9, 4.0), (28, 0.18, 8.0), NIGHT, 0.0)
    # A night window gives the cool counter-light its motivation.
    flat_plane("room-window-sky", (3.2, 3.79, 4.2), 3.6, 2.2, NIGHT_SKY, tilt_x=90)
    for x in (1.4, 3.2, 5.0):
        cube("room-window-mullion", (x, 3.76, 4.2), (0.08, 0.06, 2.3), SLATE, 0.0)
    for z in (3.1, 5.3):
        cube("room-window-mullion", (3.2, 3.76, z), (3.7, 0.06, 0.08), SLATE, 0.0)

    cube("desk-top", (0, -0.55, DESK_TOP - 0.09), (10.8, 3.8, 0.18), WALNUT, 0.06)
    for x in (-4.8, 4.8):
        cube("desk-leg", (x, -0.55, 0.78), (0.24, 2.8, 1.55), SLATE, 0.04)
    cube("desk-crossbar", (0, 0.35, 0.72), (9.6, 0.14, 0.14), SLATE, 0.02)


def build_lamp():
    """Ambient architect lamp; its shade anchors the runtime spotlight."""
    base = (-4.7, 1.0)
    cylinder("desk-lamp-base", (*base, DESK_TOP + 0.05), 0.42, 0.1, LAMP_METAL, vertices=32)
    elbow = (-4.9, 0.9, 4.4)
    shade = Vector((-4.0, -0.35, 4.55))
    rod("desk-lamp-arm", (*base, DESK_TOP + 0.1), elbow, 0.045, LAMP_METAL)
    rod("desk-lamp-arm", elbow, shade, 0.04, LAMP_METAL)
    cylinder("desk-lamp-joint", elbow, 0.08, 0.12, LAMP_METAL, vertices=16, rotation=(0, math.pi / 2, 0))
    aim = Vector((-0.3, -1.0, DESK_TOP)) - shade
    bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=0.5, radius2=0.16, depth=0.6, location=shade, end_fill_type="NOTHING")
    cone = bpy.context.object
    cone.name = "desk-lamp-shade"
    # A cone's wide end is at -Z; aim -Z at the desk.
    cone.rotation_euler = (-aim).to_track_quat("Z", "Y").to_euler()
    apply_material(cone, LAMP_METAL)
    sphere("desk-lamp-bulb", shade + aim.normalized() * 0.16, (0.15, 0.15, 0.15), BULB)


def build_monitor():
    """A 34-inch 21:9 ultrawide, leaning back 20° so the screen reads from above.

    It is the "At a glance" overview: the elevator pitch for recruiters."""
    lean = math.radians(20)
    x, y = -1.1, 0.95
    width, height = 5.3, 2.32
    hinge_z = DESK_TOP + 0.4
    center = (x, y + math.sin(lean) * height / 2, hinge_z + math.cos(lean) * height / 2)
    rounded_slab("overview-monitor", center, width, height, 0.14, 0.06, SLATE, "overview", rotation=(math.pi / 2 - lean, 0, 0))
    screen_center = (center[0], center[1] - math.cos(lean) * 0.075, center[2] + math.sin(lean) * 0.075)
    flat_plane("monitor-portfolio-screen", screen_center, 5.12, 2.14, SLATE, "overview", tilt_x=90 - 20)
    surface("overview", (screen_center[0], screen_center[1] - 0.01, screen_center[2] + 0.003), 5.12, 2.14, tilt_x=90 - 20)
    rod("overview-monitor-neck", (x, y + 0.3, DESK_TOP), (x, y + 0.08, hinge_z + 0.25), 0.11, ALUMINIUM, "overview")
    rounded_slab("overview-monitor-foot", (x, y + 0.2, DESK_TOP + 0.03), 1.7, 0.8, 0.05, 0.3, ALUMINIUM, "overview")
    tape_label("overview", (x + 1.3, y - 0.36, DESK_TOP + 0.005), math.radians(-3))


def build_laptop():
    """A 14-inch MacBook Pro (M3 Pro) in space black: unibody, notch, black keys,
    speaker grilles either side and a wide trackpad. Front row: work is the
    second thing a recruiter reads."""
    x, y = 0.75, -1.15
    width, depth = 2.11, 1.49
    rounded_slab("hotspot-work-laptop", (x, y, DESK_TOP + 0.03), width, depth, 0.06, 0.07, SPACE_BLACK, "work")
    keys_y = y + 0.24
    for row in range(6):
        for col in range(12):
            key_w = 0.115 if row else 0.115
            cube("laptop-key", (x - 0.7 + col * 0.127, keys_y - 0.3 + row * 0.12, DESK_TOP + 0.062), (key_w, 0.1 if row else 0.05, 0.008), MAC_KEY, 0.006, "work")
    for side in (-1, 1):
        for dot_row in range(14):
            cube("laptop-speaker", (x + side * 0.93, keys_y - 0.33 + dot_row * 0.05, DESK_TOP + 0.061), (0.07, 0.012, 0.004), MAC_KEY, 0.0, "work")
    rounded_slab("laptop-trackpad", (x, y - 0.44, DESK_TOP + 0.061), 0.96, 0.52, 0.004, 0.035, SPACE_BLACK, "work", edge=0)
    lean = math.radians(20)
    lid_h = 1.43
    hinge = (x, y + depth / 2, DESK_TOP + 0.06)
    center = (x, hinge[1] + math.sin(lean) * lid_h / 2, hinge[2] + math.cos(lean) * lid_h / 2)
    rounded_slab("laptop-screen", center, width, lid_h, 0.04, 0.07, SPACE_BLACK, "work", rotation=(math.pi / 2 - lean, 0, 0))
    face = (center[0], center[1] - math.cos(lean) * 0.021, center[2] + math.sin(lean) * 0.021)
    rounded_plane("laptop-bezel", face, 2.05, 1.37, 0.06, GLASS_BLACK, "work", tilt_x=90 - 20)
    glow_center = (face[0], face[1] - math.cos(lean) * 0.002, face[2] + math.sin(lean) * 0.002 - 0.01)
    flat_plane("laptop-display", glow_center, 1.94, 1.26, SCREEN, "work", tilt_x=90 - 20)
    surface("work", (glow_center[0], glow_center[1] - 0.02, glow_center[2] + 0.006), 1.94, 1.26, tilt_x=90 - 20)
    notch_offset = 1.26 / 2 - 0.02
    notch = (glow_center[0], glow_center[1] + math.sin(lean) * notch_offset - math.cos(lean) * 0.004, glow_center[2] + math.cos(lean) * notch_offset)
    rounded_plane("laptop-notch", notch, 0.15, 0.045, 0.015, GLASS_BLACK, "work", tilt_x=90 - 20)
    for index, line_width in enumerate((1.1, 0.7, 0.9, 0.5)):
        offset = 0.3 - index * 0.17
        cube(
            "laptop-code-line",
            (x - 0.55 + line_width / 2, glow_center[1] - math.cos(lean) * 0.012 - math.sin(lean) * offset, glow_center[2] + math.cos(lean) * offset),
            (line_width, 0.01, 0.045),
            AQUA,
            0.0,
            "work",
            rotation=(-lean, 0, 0),
        )
    tape_label("work", (x - 0.62, y - 0.47, DESK_TOP + 0.065), math.radians(4))


def build_keyboard():
    """A split keyboard: black cases, blue keycaps, and an angled thumb cluster per half."""
    y = 0.3
    halves = (2.3, 3.65)
    for x in halves:
        left_half = x == halves[0]
        cube("hotspot-skills-keyboard" if left_half else "keyboard-half", (x, y, DESK_TOP + 0.06), (1.22, 1.1, 0.12), KEYBOARD_BASE, 0.045, "skills")
        for row in range(4):
            for col in range(6):
                key = (x - 0.42 + col * 0.17, y - 0.22 + row * 0.22)
                cube("keyboard-key", (*key, DESK_TOP + 0.15), (0.13, 0.16, 0.05), KEYCAP_BLUE, 0.012, "skills")
                # A printable keycap top: the browser paints skill legends onto these.
                flat_plane("keyboard-legend", (*key, DESK_TOP + 0.1765), 0.118, 0.148, KEYCAP_BLUE, "skills")
        inward = 1 if left_half else -1
        for index in range(3):
            thumb = (x + inward * (0.12 + index * 0.19), y - 0.46 - index * 0.02)
            cube(
                "keyboard-thumb-key",
                (*thumb, DESK_TOP + 0.15),
                (0.17, 0.15, 0.05),
                KEYCAP_BLUE,
                0.012,
                "skills",
                rotation=(0, 0, math.radians(-10 * inward)),
            )
            flat_plane("keyboard-legend", (*thumb, DESK_TOP + 0.1765), 0.158, 0.138, KEYCAP_BLUE, "skills", math.radians(-10 * inward))
    middle = sum(halves) / 2
    surface("skills", (middle, y, DESK_TOP + 0.19), 2.6, 1.1)
    tape_label("skills", (middle, y + 0.68, DESK_TOP + 0.005), math.radians(-3))


def build_projects():
    """A fanned stack of folders with coloured tabs: reads as 'a body of work'."""
    x, y = -2.85, -1.2
    folders = ((TEAL_FOLDER, -10), (CORAL_FOLDER, 4), (MANILA, -2))
    for index, (mat, degrees) in enumerate(folders):
        z = DESK_TOP + 0.03 + index * 0.06
        angle = math.radians(degrees)
        cube("projects-folder", (x + index * 0.05, y + index * 0.04, z), (1.35, 1.0, 0.05), mat, 0.015, "projects", rotation=(0, 0, angle))
        tab_offset = Vector((-0.4 + index * 0.4, 0.55, 0))
        tab_offset.rotate(Euler((0, 0, angle)))
        cube("projects-folder-tab", (x + index * 0.05 + tab_offset.x, y + index * 0.04 + tab_offset.y, z), (0.36, 0.14, 0.05), mat, 0.012, "projects", rotation=(0, 0, angle))
    cube("projects-sheet", (x + 0.3, y - 0.2, DESK_TOP + 0.075), (0.9, 0.7, 0.01), PAPER, 0.0, "projects", rotation=(0, 0, math.radians(14)))
    # A clean brief clipped on top of the stack: the page the project content prints onto.
    flat_plane("projects-brief", (x + 0.1, y + 0.06, DESK_TOP + 0.176), 1.2, 0.86, PAPER, "projects", math.radians(-2))
    surface("projects", (x + 0.1, y + 0.06, DESK_TOP + 0.18), 1.2, 0.86, math.radians(-2))
    tape_label("projects", (x + 0.05, y - 0.15, DESK_TOP + 0.19), math.radians(-6))


def build_teaching():
    """An open spiral notebook with a pen: reads as 'explaining things'."""
    x, y = -4.45, -1.45
    rotation = math.radians(-4)
    cube("teaching-notebook-cover", (x, y, DESK_TOP + 0.015), (1.6, 1.08, 0.03), SLATE, 0.01, "teaching", rotation=(0, 0, rotation))
    for side in (-1, 1):
        cube("teaching-notebook-page", (x + side * 0.39, y, DESK_TOP + 0.045), (0.74, 1.0, 0.03), PAPER, 0.01, "teaching", rotation=(0, side * math.radians(2), rotation))
        for line in range(5):
            width = 0.5 if line % 2 else 0.38
            cube("notebook-line", (x + side * 0.39 - 0.05, y + 0.3 - line * 0.15, DESK_TOP + 0.064), (width, 0.018, 0.004), AMBER if side < 0 else SLATE, 0.0, "teaching", rotation=(0, 0, rotation))
    for ring in range(8):
        cylinder("teaching-notebook-ring", (x, y - 0.42 + ring * 0.12, DESK_TOP + 0.07), 0.04, 0.12, ALUMINIUM, vertices=10, rotation=(0, math.pi / 2, 0), hotspot="teaching")
    rod("teaching-pen", (x + 0.15, y - 0.55, DESK_TOP + 0.09), (x + 0.75, y + 0.35, DESK_TOP + 0.09), 0.03, AMBER, "teaching")
    surface("teaching", (x, y, DESK_TOP + 0.075), 1.5, 1.0, rotation)
    tape_label("teaching", (x - 0.2, y + 0.68, DESK_TOP + 0.005), math.radians(3))


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
    """A certificate with the graduation cap resting on its corner: one academic group."""
    x, y = 2.85, -1.3
    turn = math.radians(6)
    cube("education-certificate", (x, y, DESK_TOP + 0.008), (1.26, 0.9, 0.014), PAPER, 0.004, "education", rotation=(0, 0, turn))
    surface("education", (x, y, DESK_TOP + 0.02), 1.26, 0.9, turn)
    for index, width in enumerate((0.7, 0.5, 0.6)):
        offset = Vector((-0.12, 0.22 - index * 0.13, 0))
        offset.rotate(Euler((0, 0, turn)))
        cube("education-cert-line", (x + offset.x, y + offset.y, DESK_TOP + 0.017), (width, 0.03, 0.004), SLATE, 0.0, "education", rotation=(0, 0, turn))
    seal = Vector((-0.38, -0.24, 0))
    seal.rotate(Euler((0, 0, turn)))
    cylinder("education-seal", (x + seal.x, y + seal.y, DESK_TOP + 0.025), 0.11, 0.02, AMBER, vertices=24, hotspot="education")
    for side in (-1, 1):
        cube("education-seal-ribbon", (x + seal.x + side * 0.05, y + seal.y - 0.14, DESK_TOP + 0.018), (0.06, 0.2, 0.006), AMBER, 0.0, "education", rotation=(0, 0, math.radians(side * 14)))
    cap = (x + 0.6, y + 0.25)
    cap_z = DESK_TOP + 0.015
    cylinder("education-cap-skull", (*cap, cap_z + 0.11), 0.28, 0.22, SLATE, hotspot="education")
    cube("education-cap-board", (*cap, cap_z + 0.24), (0.86, 0.86, 0.04), SLATE, 0.01, "education", rotation=(0, 0, math.radians(18)))
    cylinder("education-cap-button", (*cap, cap_z + 0.27), 0.04, 0.03, AMBER, vertices=12, hotspot="education")
    rod("education-tassel", (cap[0], cap[1], cap_z + 0.27), (cap[0] - 0.36, cap[1] - 0.3, cap_z + 0.25), 0.015, AMBER, "education")
    rod("education-tassel", (cap[0] - 0.36, cap[1] - 0.3, cap_z + 0.25), (cap[0] - 0.38, cap[1] - 0.33, cap_z + 0.03), 0.03, AMBER, "education")
    tape_label("education", (x - 0.05, y - 0.7, DESK_TOP + 0.005), math.radians(-4))


def build_contact():
    """A phone lying face up with a glowing screen."""
    x, y = 4.75, -1.55
    rotation = math.radians(-12)
    # Pro Max proportions (~0.48 : 1), rounded titanium-style frame, thin bezels.
    rounded_slab("contact-phone", (x, y, DESK_TOP + 0.036), 0.5, 1.04, 0.07, 0.08, PHONE_FRAME, "contact", rotation=(0, 0, rotation), edge=0.012)
    rounded_slab("contact-phone-glass", (x, y, DESK_TOP + 0.068), 0.484, 1.024, 0.006, 0.074, GLASS_BLACK, "contact", rotation=(0, 0, rotation), edge=0)
    rounded_plane("contact-phone-screen", (x, y, DESK_TOP + 0.0715), 0.45, 0.99, 0.058, SCREEN, "contact", rotation)
    surface("contact", (x, y, DESK_TOP + 0.078), 0.45, 0.99, rotation)
    island = Vector((0, 0.43, 0))
    island.rotate(Euler((0, 0, rotation)))
    rounded_slab("phone-dynamic-island", (x + island.x, y + island.y, DESK_TOP + 0.0735), 0.11, 0.032, 0.002, 0.0159, GLASS_BLACK, "contact", rotation=(0, 0, rotation), edge=0)
    cube("phone-notification", (x - 0.02, y + 0.24, DESK_TOP + 0.076), (0.36, 0.12, 0.004), AQUA, 0.0, "contact", rotation=(0, 0, rotation))
    tape_label("contact", (x - 0.1, y - 0.76, DESK_TOP + 0.005), math.radians(5))


def build_ambient_props():
    # Mug under the lamp: the runtime adds steam above `ambient-mug`.
    mug = (-3.55, 0.35)
    cylinder("ambient-mug", (*mug, DESK_TOP + 0.21), 0.24, 0.42, CERAMIC, vertices=32)
    cylinder("ambient-mug-coffee", (*mug, DESK_TOP + 0.4), 0.21, 0.02, COFFEE, vertices=32)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.13, minor_radius=0.035, location=(mug[0] + 0.27, mug[1], DESK_TOP + 0.22), rotation=(math.pi / 2, 0, 0))
    handle = bpy.context.object
    handle.name = "ambient-mug-handle"
    apply_material(handle, CERAMIC)


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
    hotspot_ids = ("overview", "projects", "work", "skills", "teaching", "education", "contact", "profile")
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
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "public" / "assets" / "workstation.blend"))
    bpy.ops.export_scene.gltf(filepath=str(OUTPUT), export_format="GLB", export_apply=True, export_lights=False, export_cameras=False)
    print(f"WORKSTATION_GLTF={OUTPUT}")


if __name__ == "__main__":
    main()
