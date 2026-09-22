# SLAYER — Asset Registry

## Production truth

| Asset | Required | Current state |
|---|---|---|
| Player hero | GLB/glTF + PBR + rig | BUILD-FETCHED / RUNTIME WIRED |
| Player LOD | Real lower-detail GLB | NOT YET GENERATED |
| Stadium | GLB/glTF + PBR | BUILD-FETCHED / RUNTIME WIRED |
| Pitch PBR | textures + masks | NOT PRESENT |
| Goal/net | GLB/glTF | PROCEDURAL |
| Crowd | instanced/VAT-ready | PROCEDURAL |
| Football | GLB/glTF + PBR | PROCEDURAL |
| Animation clips | GLB/glTF clips | BUILD-FETCHED / RUNTIME WIRED |

## Verified sources

### Player
Quaternius Universal Base Characters, CC0 1.0. Game-ready, rigged humanoid characters compatible with retargeting. Runtime file: `public/assets/3d/players/player-hero.glb`.

### Animation
Quaternius Universal Animation Library, CC0 1.0. Runtime file: `public/assets/3d/animations/universal-animation-library.glb`. Locomotion includes Idle, Walk, Jog and Sprint clips.

### Stadium
3DAssets.dev assembled soccer club ground, CC0 1.0 Universal. Runtime file: `public/assets/3d/stadium/stadium.glb`. The published asset is a self-contained GLB with embedded textures.

## Integration rule

An asset is **INTEGRATED** only when:

1. the build places the binary under `public/assets/3d/`;
2. its source and license are recorded here;
3. GLTFLoader loads it successfully;
4. it appears in the actual Three.js scene;
5. `npm run build` succeeds;
6. it is included in the Android build;
7. it is visually verified on a real Android device.

## Current status

Real CC0 GLB assets are now wired into the production build/runtime path.

Still not validated: Android visual QA, measured 60 FPS, real lower-detail player LODs, professional PBR pitch textures, and football-specific mocap/contact animations.

The build downloads the assets first, then Vite bundles the resulting local files. Runtime does not depend on the remote CDN.
