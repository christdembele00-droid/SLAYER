# SLAYER

Native high-end football simulation targeting Android with Filament + Vulkan.

## Architecture

SLAYER is engine-independent at the gameplay level. The core simulation is separated from the rendering layer so the football logic can evolve without being tied to a visual editor.

- Gameplay/simulation: native C++ systems
- 3D rendering: Google Filament
- Graphics backend: Vulkan on Android
- Runtime: native Android + CMake/NDK
- Repository: christdembele00-droid/SLAYER
- Default branch: main
- Canonical renderer: benchmarks/filament-v0.1/
- Assets: external/licensed 3D assets; no requirement to model everything manually

## 15-phase product architecture

1. Core Match
2. Player System
3. Ball System
4. Player ↔ Ball
5. Gameplay
6. AI & Tactics
7. Animation & Motion
8. Camera / Broadcast
9. Stadium / Atmosphere
10. Audio
11. Optimization / Netcode
12. Game Modes
13. Career
14. Online
15. Release / QA

These phases remain the project specification. Filament is the rendering engine and Vulkan is the graphics backend. Three.js/WebGL is no longer part of the canonical renderer.

## Current implementation — Phase 1

Phase 1 currently contains:

- Match phases and periods
- Match configuration
- Match score
- Match clock
- Match event bus
- Match rules
- Match engine
- Native Android/Vulkan renderer scaffold
- Filament PBR/IBL pipeline
- glTF/GLB player and stadium loading path
- 22-player instancing path
- Dynamic resolution, TAA/FXAA, GTAO and bloom
- Native match/gameplay bridge

## Development principle

We build the real SLAYER project directly. No separate throwaway engine test project is required.

Next implementation target:

**Phase 1 → restart system → player foundation → ball physics → player ↔ ball interaction.**
