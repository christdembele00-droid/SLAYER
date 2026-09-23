# Android Filament V0.1

This is the native Android renderer target for SLAYER's Filament migration.

Build prerequisites follow Filament's current Android requirements: Java 21, Android SDK, NDK 29+, CMake 3.22.1+.

The app deliberately starts with an empty PBR-capable Filament scene. The next native renderer commit loads the licensed SLAYER player/pitch GLBs through gltfio and adds the 1/11/22-player benchmark.

Build:

```bash
./gradlew assembleDebug
```

Expected ABI: arm64-v8a.
