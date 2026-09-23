# SLAYER Android profiling

Build and install the Filament benchmark APK, then capture several runs.

Record:

- CPU frame time
- GPU frame time when timer queries are exposed
- FPS
- P95 frame time
- draw calls
- player count
- resolution scale
- thermal state

Test matrix:

- resolution: 100%, 90%, 80%, 70%
- players: 1, 11, 22, 50, 64

Do not treat desktop or CI timings as Android GPU measurements. The final performance claim must come from a physical Android device.
