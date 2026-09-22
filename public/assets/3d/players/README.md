# SLAYER — Production player assets

Place the licensed binary GLB files in this directory.

Expected:
- player-hero.glb — high-detail rigged player
- player-lod1.glb — medium-detail player
- player-lod2.glb — low-detail player

The runtime loads these locally so the core match remains offline.

## Integration truth
These files are intentionally not fabricated by the repository automation. A GLB is considered integrated only after the binary exists, loads through AssetPipeline, appears in the match scene, builds into Android, and is visually verified on a real device.
