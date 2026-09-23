# SLAYER Native Engine - Filament/Vulkan

This directory is the canonical native Android game renderer.

Stack: Android ARM64, C++20, CMake, NDK 29, Google Filament 1.77, Vulkan only, glTF/GLB, gltfio, PBR, HDR IBL/KTX, ACES, TAA, GTAO, bloom, dynamic resolution and animation LOD.

CI prepares and validates runtime assets before building debug. The dedicated release workflow alone produces signed APK/AAB files.

The Android application ID remains com.slayer.filament because it is the Firebase-registered Android application.

No OpenGL ES fallback exists in the native match renderer. Unsupported Vulkan devices must fail initialization.

Only original, CC0 or properly licensed assets may ship. The project contains production foundations; final authored HD content is still required for a finished visual release.

Engineering target: 60 FPS / 16.67 ms. Physical Android measurement is still required.
