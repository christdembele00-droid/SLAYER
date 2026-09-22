# SLAYER — Native Football Engine

## Runtime
Android NDK / C++ / Filament / Vulkan, JNI surface bridge.

## Render
PBR multi-layer terrain, wetness controls, skin/cloth/eye/hair material hooks, HDR IBL, sun/moon, 4–8 stadium spots, dynamic shadows, TAA/FXAA, SSAO/GTAO, ACES, motion blur and DoF.

## Animation
gltfio Animator, GPU skinning, state blending, motion database, foot IK and ball-impact IK.

## Simulation
Fixed physics tick, Magnus ball model, friction/restitution profiles, simplified player collision volumes and net simulation interface.

## AI
Team shape, pressing, offside line, runs into space, rule/foul/penalty hooks, player attributes and fatigue.

## Presentation
Broadcast camera modes, radar/scoreboard/power/stamina HUD model, replay hooks.

## Audio
Spatial event interface for kick, post, whistle, tackle, goal and crowd intensity.

## Performance
Dedicated physics/gameplay workers, frame metrics, LOD and ASTC pipeline hooks.

### Validation
The engine is only considered production-ready after Android hardware validation confirms the actual APK renders the scene, assets are present, and target frame-time is measured on-device. Code presence alone is not a visual-quality proof.
