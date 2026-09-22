# SLAYER player asset pipeline

Expected production asset:

android/app/src/main/assets/models/player.glb

Recommended content:

- skinned mesh
- skeleton
- PBR base color
- normal map
- roughness/metallic data
- production animations
- valid skin weights

Target budgets:

| LOD | triangles | bones |
|---|---:|---:|
| LOD0 | ~12000 | ~80 |
| LOD1 | ~5000 | ~40 |
| LOD2 | ~1500 | reduced |

LOD distance thresholds are 12 m and 28 m in the native benchmark. The current renderer records the actual joint count from the loaded glTF skin.

Real LOD switching requires the corresponding LOD meshes; the repository does not invent binary player assets.
