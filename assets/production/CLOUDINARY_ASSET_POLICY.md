# SLAYER — Cloudinary asset policy

Cloudinary is the remote media/asset distribution layer. It does not replace the Android Filament asset pipeline.

## Folders

- slayer/profiles
- slayer/emblems
- slayer/kits
- slayer/stadium
- slayer/players
- slayer/environment

## Runtime rule

The native renderer consumes packaged/validated GLB, KTX and material assets. Cloudinary is used to host and distribute source/remote assets and metadata; the build pipeline converts or packages the assets needed by Filament.

## Security

The Cloudinary API secret must never be placed in Android, C++, JavaScript, GitHub source files or public configuration. Signed upload signatures are generated server-side.

## Production asset flow

Cloudinary
  -> asset catalog / backend
  -> download/cache
  -> validation
  -> GLB/KTX/material packaging
  -> Android assets
  -> Filament/Vulkan

Remote runtime downloads must never block the first frame of a match. A validated local asset remains the deterministic fallback.
