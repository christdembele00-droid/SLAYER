# SLAYER online architecture

SLAYER stays native C++20 + Filament + Vulkan. Firebase and Cloudinary are service layers, not rendering dependencies.

## Outside match
- Firebase Authentication: identity and ID tokens.
- Firestore: rooms, profiles, team chat and quick-chat history.
- Cloudinary: profile images, team emblems and kit textures.
- Never ship Cloudinary API secrets or Firebase Admin credentials in the Android APK.

## During match
Android client -> WebSocket -> authoritative server -> snapshots -> native C++ gameplay/rendering.
The server owns the authoritative tick and match state. The client can predict the local player and reconcile snapshots.

The prototype server runs at 20 Hz. It is a networking foundation, not a finished competitive 11v11 physics simulation; server-side collision, ball authority, validated physics, lag compensation, anti-cheat and reconnect handling remain required.

## Cloudinary
Use /media/signature for signed uploads. The Android client uploads directly to Cloudinary; the API secret stays on the server. Store public IDs/URLs in Firestore.

## Firebase
Authenticate on Android, then send the Firebase ID token to SLAYER services. Firestore must not receive per-frame transforms.

## Quick chat
Use message type quick for short pre-approved messages. Transient in-match events can use WebSocket without writing every frame to Firestore.
