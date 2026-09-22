#!/usr/bin/env python3
"""Compile SLAYER Filament .mat sources with the matching Filament matc."""
from __future__ import annotations
import os, shutil, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "benchmarks" / "filament-v0.1" / "materials"
OUT = ROOT / "benchmarks" / "filament-v0.1" / "android" / "app" / "src" / "main" / "assets" / "materials"

def find_matc() -> Path:
    candidates = []
    for key in ("FILAMENT_MATC", "FILAMENT_TOOLS_DIR", "FILAMENT_DIST_DIR"):
        value = os.environ.get(key)
        if not value: continue
        p = Path(value)
        if key == "FILAMENT_MATC": candidates.append(p)
        else: candidates += [p / "bin" / "matc", p / "tools" / "matc"]
    which = shutil.which("matc")
    if which: candidates.append(Path(which))
    for p in candidates:
        if p.is_file(): return p
    raise SystemExit("matc introuvable: définis FILAMENT_MATC vers matc de la même release Filament que le runtime SLAYER.")

def main() -> None:
    matc = find_matc()
    OUT.mkdir(parents=True, exist_ok=True)
    for name in ("grass.mat", "player_skin.mat", "player_kit.mat"):
        source = SRC / name
        target = OUT / source.with_suffix('.filamat').name
        cmd = [str(matc), "-p", "mobile", "-a", "vulkan", "-o", str(target), str(source)]
        print("[SLAYER]", " ".join(map(str, cmd)))
        subprocess.run(cmd, check=True)
    print("[SLAYER] compiled materials ->", OUT)

if __name__ == "__main__": main()
