# SLAYER native runtime assets

CI builds validated Android runtime assets from the central Cloudinary catalog.

Required assets include player.glb, pitch.glb, stadium.glb, ball.glb, goal.glb, animation library, dual IBL/skybox KTX sets, compiled PBR materials and texture maps.

There is no player.gltf or stadium.gltf runtime fallback. Missing required local assets are errors, and Cloudinary is not accessed during the first-frame match path.
