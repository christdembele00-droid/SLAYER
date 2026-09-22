# SLAYER — Asset Registry

## Production truth

| Asset | Required | Current state |
|---|---|---|
| Player hero | GLB/glTF + PBR + rig | NOT PRESENT |
| Player LOD | GLB/glTF + PBR | NOT PRESENT |
| Stadium | GLB/glTF + PBR | NOT PRESENT |
| Pitch PBR | textures + masks | NOT PRESENT |
| Goal/net | GLB/glTF | PROCEDURAL |
| Crowd | instanced/VAT-ready | PROCEDURAL |
| Football | GLB/glTF + PBR | PROCEDURAL |
| Animation clips | GLB/glTF clips | CODE/PROCEDURAL |

## Candidate sources

- 3DAssets.dev football stadium/club grounds — CC0 1.0.
- 3DAssets.dev full-size football goal — CC0 1.0.
- dLeom Soccer Ball — CC0.
- Meshy football-player listings — individual license must be verified before redistribution.

## Integration rule

An asset is NOT "integrated" until:

1. The binary asset is stored locally under `public/assets/3d/`.
2. Its source and license are recorded here.
3. `AssetPipeline` loads it successfully.
4. It appears in the actual Three.js scene.
5. It survives `npm run build`.
6. It is included in the Android build.
7. It is visually verified on a real Android device.

Remote CDN assets do not count as production integration because SLAYER's core match must work offline.

## Current status

**REAL PRODUCTION 3D ASSETS: NOT YET VALIDATED.**

The repository currently has the loading/integration pipeline, but the actual production-quality binary assets still need to be imported.
