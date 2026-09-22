# SLAYER backend data architecture

## Firebase / Firestore

Firestore stores persistent online metadata, not the real-time 22-player simulation.

Use it for:
- authenticated player profiles
- settings/profile metadata
- rooms/lobbies metadata
- chat/messages
- cosmetic/asset catalog metadata
- Cloudinary asset references

Do not use Firestore for:
- per-frame player transforms
- ball physics ticks
- authoritative match state
- latency-sensitive replication

## Cloudinary

Cloudinary stores and distributes media/source assets such as:
- profile images
- club emblems
- kit textures
- stadium media
- player/source asset packages where appropriate

Cloudinary credentials stay server-side.

## Real-time match

The authoritative match path remains:

Android C++20
  -> WebSocket
  -> authoritative match server
  -> replication/interpolation
  -> Android C++20
  -> Filament
  -> Vulkan

This separation keeps Firestore and Cloudinary from becoming frame-synchronization dependencies.
