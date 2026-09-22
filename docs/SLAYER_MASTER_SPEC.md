# SLAYER — MASTER SPECIFICATION

SLAYER is an original football game project. The target is a complete playable mobile football product, not a rendering benchmark.

## Runtime
C++/NDK, Filament/Vulkan renderer, Android JNI, multithreaded simulation, fixed-step physics, GPU skinning, LOD, ASTC pipeline, performance telemetry.

## Match
11v11, ball physics, player collision, dribbling, first touch, passing, shooting, heading, tackles, interceptions, goalkeeper, fouls, cards, penalties, free kicks, corners, throw-ins, advantage, substitutions, injuries, extra time and penalty shootouts.

## AI
Individual attributes, role-based positioning, team blocks, defensive line, pressing, marking, coverage, runs, cross runs, space creation, transition play, goalkeeper decisions, dynamic tactics and fatigue.

## Presentation
Broadcast camera, tactical camera, set-piece cameras, replay/slow motion hooks, HUD, radar, score, clock, stamina, event notifications, crowd/audio hooks, weather and wet-pitch rendering.

## Product
Quick Match, Friendly, Training, Cup, League, Season and Career foundations; player/team profiles; progression; statistics; save system; settings.

## Online extension
Architecture leaves a deterministic simulation boundary for future accounts, cloud synchronization, matchmaking, friends and competitive online play.

## Engineering rule
No feature is considered production-complete merely because a source file exists. Build, integration and device validation are required before claiming operational status.
