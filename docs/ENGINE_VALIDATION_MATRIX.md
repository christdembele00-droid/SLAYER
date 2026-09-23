# SLAYER - Engine validation matrix

| Layer | CI validation | Physical validation |
| --- | --- | --- |
| TypeScript | build and tests | N/A |
| Python | compile, unit tests, Docker | production environment |
| Firebase | package ID cross-check | sign-in flow |
| Cloudinary | catalog and asset integrity | signed upload flow |
| Filament | pinned version and SHA-256 | N/A |
| Vulkan renderer | native debug build | required |
| 22 players | load and animation path | FPS, p95, thermal, memory |
| Gameplay | domain tests | complete match |
| Store | idempotency tests | Play test purchase |

Green CI does not by itself prove 60 FPS or final AAA visual content.
