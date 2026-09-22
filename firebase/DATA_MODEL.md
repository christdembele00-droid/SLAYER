# SLAYER Firebase data model

## slayerProfiles/{uid}

- displayName
- avatarUrl
- teamId
- emblemUrl
- kitTextureUrl
- updatedAt

## slayerRooms/{roomId}

- match_id
- status: LOBBY | READY | IN_GAME | FINISHED
- created_by
- created_at

The authoritative per-frame match state is not stored in Firestore.

## slayerRooms/{roomId}/messages/{messageId}

- uid
- name
- text
- type: chat | quick
- created_at

Quick-chat messages are short, pre-approved UI messages in the client. WebSocket events are used for transient in-match communication; Firestore is the persistent chat layer.
