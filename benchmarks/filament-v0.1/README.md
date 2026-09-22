# SLAYER — Filament V0.1 Android Benchmark

This benchmark is isolated from the production renderer. It exists to measure whether a native Filament renderer is a viable candidate for SLAYER before any migration.

## Target

V0.1 measures the native rendering path with:

- Android ARM64
- Filament
- Vulkan only; no OpenGL ES fallback
- glTF / GLB assets
- PBR materials
- skeletal animation
- 1 / 11 / 22 visible player instances
- ball and pitch
- camera and lighting
- frame-time telemetry

## Important status

This branch is a **benchmark scaffold**, not yet a validated 60 FPS result.

The official Filament Android build currently requires Android Studio, Android SDK, NDK 29+, Java 21, CMake 3.22.1+ and Ninja. The benchmark keeps Filament as an external build dependency instead of copying its source into SLAYER.

## Build strategy

1. Clone a pinned Filament revision in CI/local tooling.
2. Build Filament for arm64-v8a.
3. Build the benchmark against the generated Filament distribution.
4. Install the APK on a physical Android device.
5. Record FPS, p95 frame time, draw calls, triangles and APK size.
6. Repeat at 1, 11 and 22 players.

The renderer is implemented, but do not call it "60 FPS validated" until step 4 has been performed on a physical device. Devices without Vulkan must fail initialization rather than silently falling back.

## Architecture

```
Python simulation bridge
        |
        | compact C ABI
        v
Native C++ renderer
        |
        +-- Filament Engine
        +-- gltfio
        +-- PBR
        +-- skeletal animation
        +-- Vulkan / OpenGL ES
        |
        v
Android Surface
```

## FFI rule

No JSON, Python objects, or per-frame heap allocations cross the boundary.

The intended bridge payload is a contiguous array of compact transforms:

```
[x, y, z, qx, qy, qz, qw, anim_id, anim_time]
```

The first implementation uses a C ABI and an owned native snapshot buffer. A true zero-copy shared buffer will only be enabled after lifetime/thread-safety rules are proven.

## Success criteria

| Metric | Target |
|---|---:|
| Android ABI | arm64-v8a |
| Frame budget | 16.67 ms |
| Target FPS | 60 |
| Players | 22 |
| Rendering | PBR |
| Animation | GPU/native pipeline |
| JSON per frame | 0 |
| Production migration | 0 until benchmark passes |

## Sources

Filament's current Android build documentation specifies NDK 29+, Java 21, ARM64 as the primary Android target, and the host-tool/native-library build sequence required before Android samples. See the official Filament documentation before updating the pinned revision.
