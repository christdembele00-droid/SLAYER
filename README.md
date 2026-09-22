# SLAYER

SLAYER is the full 3D football game project — not only the current playable match prototype.

## Product scope

**SLAYER = MATCH ENGINE + TRAINING + COMPETITIONS + LEAGUES + CAREER + TRANSFERS + PROGRESSION + ONLINE + PRESENTATION + PERSISTENCE + COMPLETE BRANDING.**

### Core football
- Native C++20 match engine
- 60 Hz gameplay simulation
- Ball physics, possession, passes, shots, rebounds and tackles
- Player movement, attributes, AI/tactics and 22-player match foundation
- Touch controls and player selection
- Broadcast camera
- Skeletal animation pipeline
- Match score, clock, events and rules

### Game modes
- Quick Match
- Free Training
- Training exercises and progression
- Cups and tournaments
- National leagues
- Multiple divisions
- Promotion/relegation
- Season calendars and standings
- Continental competitions

### Career / multi-season
- Club selection/creation
- Multiple seasons
- Season objectives
- Squad management
- Player development
- Form and progression
- Transfers
- Recruitment and departures
- Contracts and finances
- Trophies and historical statistics
- End-of-season transition into the next season

The first persistent career domain foundation is implemented in `server/career.py`, with league scheduling in `server/competition.py` and training evaluation in `server/training.py`.

### Online
- Firebase Authentication for identity
- Authoritative WebSocket match server
- Matchmaking
- Client prediction
- Server reconciliation
- Interpolation / replication
- Reconnection
- Firestore for persistent metadata only
- Cloudinary for distributed assets/media
- Never use Firestore for 60 Hz match state

### Graphics / presentation
- Native Android
- C++20 + CMake/NDK
- Google Filament
- Vulkan backend
- PBR materials
- IBL/HDRI + KTX
- GLB/glTF assets
- Dynamic resolution
- TAA/FXAA
- GTAO
- Bloom
- Tone mapping
- Shadows
- Stadium atmosphere, crowd, flags, boards and later weather/day-night systems
- Android optimization with LOD/texture compression/GPU-memory budgets

### Branding
The SLAYER identity is part of the product:
- Main SLAYER logo
- Android launcher icon
- Splash/startup branding
- Main-menu branding
- Club emblems
- Competition emblems
- Kit badges

The current native Android launcher uses the bundled SLAYER vector icon.

## Architecture

```
Android UI / game screens
        |
        v
Native C++20 game core
        |
        +--> MatchEngine / gameplay / AI / physics
        +--> Training / competitions / career / transfers / progression
        +--> Online client
        |
        v
Filament
        |
        v
Vulkan
```

Persistent services are separate from frame-critical gameplay:

```
Firebase Auth ---- identity
Firestore -------- career/profile/metadata persistence
Cloudinary ------- source/distributed assets
WebSocket -------- authoritative live match
```

## Validation rule

A successful CI build validates a technical layer; it does **not** by itself mean that the whole game is finished.

SLAYER is considered **playable** only after:
1. Native Filament/Vulkan Android APK builds successfully.
2. APK installs and launches on a real Android device.
3. First frame loads without missing critical assets.
4. Match controls drive the native C++ game core.
5. Ball/player gameplay works through a complete match.
6. Training can be entered and completed.
7. Competition/league flow produces fixtures and standings.
8. Career persists across a season transition.
9. Transfer/progression systems pass their domain tests.
10. Online connection/matchmaking/reconciliation are tested.
11. Menus → match → pause → resume → result work end-to-end.
12. No blocking crash/fetch/asset error remains on the target device.

## Current state

The repository currently contains a playable match foundation and the first server-side foundations for training, competitions, career and progression. The remaining systems must be integrated end-to-end and validated on Android before SLAYER can honestly be declared ready to play.

## CI

GitHub Actions validates web, server, Android and native Filament builds. The server test job covers matchmaking plus career, training and competition domain tests. The Filament job builds the native Vulkan APK and prepares the production asset pipeline.

Three.js/WebGL is not the canonical renderer. The native Filament/Vulkan path is the target renderer.

CI validation trigger: 2026-09-22T21:50:01.238Z
