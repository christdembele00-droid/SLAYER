# SLAYER PBR / stadium rendering pipeline

## Player materials

Use a skinned glTF/GLB with separate material slots for skin, cloth and hard accessories.

Skin uses player_skin.mat:
- base color
- tangent-space normal map
- AO
- thickness
- subtle subsurface scattering

Kit uses player_kit.mat:
- base color
- normal map
- AO
- cloth sheen
- subtle cloth subsurface response

## Stadium and accessories

Use Filament lit materials for standard PBR surfaces:
- metallic/roughness
- normal maps
- AO
- clear coat only where physically justified

Skin, grass and cloth remain non-metallic.

## Terrain

grass.mat supports:
- repeated normal map
- AO map
- wetness control
- mowing stripe fallback
- lower roughness when wet

The procedural grass fallback remains useful until real maps are supplied.

## Lighting and post-processing

The native renderer already enables:
- Vulkan backend
- TAA + FXAA
- dynamic resolution
- GTAO
- restrained bloom
- ACES tone mapping
- PCF shadow filtering
- one directional sun
- four stadium spotlights
- KTX IBL -> IndirectLight + Skybox

## Anime energy

Characters remain physically based. The anime identity is reserved for VFX:
- speed lines
- aura
- shot impact
- goal energy
- camera shake
- high-contrast UI

## Asset requirement

Material definitions are source files. They must be compiled with the Filament matc version matching the runtime before deployment. Real textures and GLB assets are still required; source definitions do not fabricate those binary assets.
