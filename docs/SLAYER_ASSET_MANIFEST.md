# SLAYER Asset Manifest

## Integrated assets

| Asset | Source | License | Location |
|---|---|---|---|
| Player base GLB | Quaternius Universal Base Characters Standard | CC0 | Cloudinary: `slayer/players/models/player_base.glb` |
| Universal animation mannequin GLB | Quaternius Universal Animation Library distribution | CC0 | Cloudinary: `slayer/players/animations/universal_animation_library_mannequin.glb` |
| Animation Library Standard glTF | Quaternius Universal Animation Library Standard | CC0 | Cloudinary: `slayer/players/animations/animation_library_standard.gltf` |
| Orlando Stadium 1K IBL | Poly Haven | CC0 | Cloudinary: `slayer/stadium/ibl/orlando_stadium_1k.exr` |
| Soccer field model | Tiko479 / OpenGameArt | CC0 | Cloudinary: `slayer/stadium/models/soccer_field_cc0.zip` |
| Leafy grass reference texture | Poly Haven | CC0 | Cloudinary: `slayer/stadium/textures/grass_leafy_preview.png` |
| Atlas FC crest | SLAYER original | Original | Cloudinary: `slayer/emblems/atlas_fc` |
| Lagoon United crest | SLAYER original | Original | Cloudinary: `slayer/emblems/lagoon_united` |
| Fictional roster | SLAYER original | Original | Cloudinary: `slayer/players/roster/slayer_roster.json` |

## Important integration notes

- Rendering remains **Filament + Vulkan only**.
- The Quaternius player is a base character, not a real footballer likeness.
- Club crests are original SLAYER designs; no real club trademark is bundled.
- Player names in the roster are fictional.
- The OpenGameArt field is a lightweight CC0 base and is not yet the final photorealistic stadium.
- The Orlando Stadium HDRI is used as environment lighting; it is not a complete 3D stadium.
- Cloudinary's current free upload limit prevented direct upload of the 84 MB 4K Orlando Stadium EXR, so the 1K EXR is used for the first integration pass.
- The Standard animation glTF references an external binary buffer. The GLTF is stored in Cloudinary, but the matching .bin still needs to be packaged in a format Cloudinary accepts or bundled with the native application before Filament can load that animation file directly.

## Still required for the final high-end asset pass

- Dedicated footballer outfit/kit meshes.
- Football-specific animation retargeting: sprint, jog, acceleration, deceleration, turn, pass, shot, control, dribble, tackle, header, goalkeeper and celebrations.
- Final PBR turf set: base color, normal, roughness, AO and optional height/detail.
- Final stadium GLB with goals, nets, stands, lights and crowd geometry.
- Optimized IBL/KTX package generated for Filament.
- LOD variants and mobile texture budgets.
