import bpy
import sys

separator = sys.argv.index("--")
stadium_out = sys.argv[separator + 1]
crowd_out = sys.argv[separator + 2]

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def material(name, color, metallic=0.0, roughness=0.8):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1.0)
    m.metallic = metallic
    m.roughness = roughness
    return m

def cube(name, location, size, mat):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = (size[0] / 2.0, size[1] / 2.0, size[2] / 2.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return obj

def ico(name, location, radius, mat):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=radius, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return obj

def export_glb(path):
    bpy.ops.object.select_all(action="SELECT")
    bpy.context.view_layer.objects.active = bpy.context.selected_objects[0]
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
    )

# Original procedural stadium foundation.
reset()
shell = material("SLAYER_Stadium_Shell", (0.055, 0.07, 0.085), 0.35, 0.42)
tier = material("SLAYER_Stadium_Tier", (0.12, 0.15, 0.18), 0.10, 0.78)
roof = material("SLAYER_Stadium_Roof", (0.025, 0.035, 0.045), 0.55, 0.35)
field = material("SLAYER_Field_Base", (0.035, 0.22, 0.10), 0.0, 0.92)
light = material("SLAYER_Floodlight", (0.95, 0.86, 0.62), 0.0, 0.25)

cube("PitchBase", (0, -0.35, 0), (108, 0.7, 72), field)
for z in (-42, 42):
    for row in range(8):
        cube(f"Stand_{z}_{row}", (0, 1.5 + row * 1.45, z), (86, 1.2, 9), tier)
    cube(f"Roof_{z}", (0, 15.5, z * 1.1), (94, 1.1, 11), roof)
for x in (-52, 52):
    for row in range(8):
        cube(f"Stand_{x}_{row}", (x, 1.5 + row * 1.45, 0), (9, 1.2, 62), tier)
    cube(f"Roof_{x}", (x * 1.08, 15.5, 0), (11, 1.1, 76), roof)
for x, z in ((-50, -40), (-50, 40), (50, -40), (50, 40)):
    cube("FloodlightPole", (x, 12, z), (0.7, 24, 0.7), shell)
    cube("FloodlightBar", (x, 24, z), (7, 0.45, 0.8), light)
cube("Tunnel", (0, 2, -50), (10, 4, 6), shell)
export_glb(stadium_out)

# Original procedural crowd foundation.
reset()
skin = material("SLAYER_Crowd_Skin", (0.55, 0.38, 0.25), 0.0, 0.95)
club_a = material("SLAYER_Crowd_Atlas", (0.08, 0.25, 0.55), 0.0, 0.90)
club_b = material("SLAYER_Crowd_Lagoon", (0.04, 0.42, 0.44), 0.0, 0.90)

for side in (-1, 1):
    for row in range(5):
        y = 5.7 + row * 0.72
        for i in range(12):
            z = -33 + i * 6
            x = side * 43.0
            cloth = club_a if (i + row + side) % 2 == 0 else club_b
            cube("FanBody", (x, y, z), (0.30, 0.55, 0.22), cloth)
            ico("FanHead", (x, y + 0.38, z), 0.13, skin)
export_glb(crowd_out)
