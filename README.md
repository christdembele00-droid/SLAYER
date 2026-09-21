# SLAYER

Ultra-modern football simulation project built as a code-first web application.

## Architecture

SLAYER is engine-independent at the gameplay level. The core simulation is separated from the rendering layer so the football logic can evolve without being tied to a visual editor.

- Core language: TypeScript
- 3D rendering: Three.js
- Runtime: modern web browser
- Repository: christdembele00-droid/SLAYER
- Default branch: main
- Build/deployment target: web first, Android wrapper later if required
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

These phases remain the project specification. The rendering technology can change without discarding the gameplay architecture.

## Current implementation — Phase 1

Phase 1 currently contains:

- Match phases and periods
- Match configuration
- Match score
- Match clock
- Match event bus
- Match rules
- Match engine
- Initial browser 3D scene
- Initial pitch and ball rendering

## Development principle

We build the real SLAYER project directly. No separate throwaway engine test project is required.

Next implementation target:

**Phase 1 → restart system → player foundation → ball physics → player ↔ ball interaction.**
