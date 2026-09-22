# SLAYER Filament material build

SLAYER uses Filament 1.77.0 with Vulkan only. Filament material definitions are compiled by `matc` into `.filamat` packages. Use `matc` from the same Filament release as the runtime libraries.

## Compile
```bash
FILAMENT_MATC=/path/to/filament/bin/matc python scripts/build_filament_materials.py
```

Windows PowerShell:
```powershell
$env:FILAMENT_MATC="C:\path\to\filament\bin\matc.exe"
python scripts/build_filament_materials.py
```

Outputs are placed in `benchmarks/filament-v0.1/android/app/src/main/assets/materials/`.

Expected packages: `grass.filamat`, `player_skin.filamat`, `player_kit.filamat`.

`MainActivity` already loads `grass.filamat` through the native Vulkan renderer. Skin and kit packages stay separate until the real GLB exposes stable material slots and real texture maps.

## Real assets still required
- grass base-color, normal and AO maps;
- player skin base-color, normal, AO and thickness maps;
- kit base-color, normal and AO maps;
- animated GLB with UVs and tangents.

Only add assets whose licenses permit redistribution. Record their license in the asset manifest.

Generated `.filamat` binaries are build outputs and are not committed by this change.
