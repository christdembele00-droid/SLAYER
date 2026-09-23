# SLAYER Filament V0.1 — Validation Status

| Item | Status |
|---|---|
| Isolated native module | IMPLEMENTED |
| Compact C ABI | IMPLEMENTED |
| Native C++20 match foundation | IMPLEMENTED |
| Filament native renderer | IMPLEMENTED |
| Vulkan backend | IMPLEMENTED |
| GLB loading | IMPLEMENTED |
| 22 player instances | IMPLEMENTED |
| Per-instance locomotion animation controllers | IMPLEMENTED |
| PBR pitch fallback | IMPLEMENTED |
| Android debug APK build | VERIFIED IN CI |
| Android release AAB build | AVAILABLE IN RELEASE WORKFLOW |
| 1-player FPS | NOT MEASURED ON TARGET DEVICE |
| 11-player FPS | NOT MEASURED ON TARGET DEVICE |
| 22-player FPS | NOT MEASURED ON TARGET DEVICE |
| Physical Android validation | NOT DONE |
| 60 FPS validation | NOT DONE |

This status intentionally distinguishes automated build validation from measured device performance.

## Backend policy

| Graphics API | Status |
|---|---|
| Filament | CANONICAL |
| Vulkan | REQUIRED FOR 3D NATIVE MATCH |
| OpenGL ES | NOT USED BY THE NATIVE MATCH |
| Three.js/WebGL | WEB PREVIEW ONLY |

The production Android release targets the native Filament/Vulkan application. The root Vite/Three.js application remains a web preview and development surface.
