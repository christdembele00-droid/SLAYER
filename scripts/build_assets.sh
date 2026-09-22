#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/benchmarks/filament-v0.1/android/app/src/main/assets"
SRC="$ROOT/benchmarks/filament-v0.1/assets/source"
MAT="$ROOT/benchmarks/filament-v0.1/native/materials"
MATC="${MATC:-matc}"
CMGEN="${CMGEN:-cmgen}"
ORLANDO_HDR_SOURCE="${ORLANDO_HDR_SOURCE:-$SRC/orlando_stadium_1k.exr}"
command -v "$MATC" >/dev/null || { echo "ERROR: matc not found"; exit 1; }
command -v "$CMGEN" >/dev/null || { echo "ERROR: cmgen not found"; exit 1; }
test -s "$ORLANDO_HDR_SOURCE" || { echo "ERROR: missing $ORLANDO_HDR_SOURCE"; exit 1; }
mkdir -p "$DEST/materials" "$DEST/ibl/orlando_stadium" "$DEST/models"
"$MATC" -p mobile -a vulkan -o "$DEST/materials/grass.filamat" "$MAT/grass.mat"
"$MATC" -p mobile -a vulkan -o "$DEST/materials/player_skin.filamat" "$MAT/player_skin.mat"
"$MATC" -p mobile -a vulkan -o "$DEST/materials/player_kit.filamat" "$MAT/player_kit.mat"
TMP="$(mktemp -d)";trap 'rm -rf "$TMP"' EXIT
"$CMGEN" --format=ktx --size=256 --extract-blur=0.1 --deploy="$TMP" "$ORLANDO_HDR_SOURCE"
IBL="$(find "$TMP" -maxdepth 1 -type f -name '*_ibl.ktx' | head -n1)"
SKY="$(find "$TMP" -maxdepth 1 -type f -name '*_skybox.ktx' | head -n1)"
test -s "$IBL" && test -s "$SKY" || { echo "ERROR: cmgen outputs missing";exit 1;}
cp "$IBL" "$DEST/ibl/orlando_stadium/orlando_stadium_ibl.ktx"
cp "$SKY" "$DEST/ibl/orlando_stadium/orlando_stadium_skybox.ktx"
for pair in "$ROOT/public/assets/3d/players/player-hero.glb:$DEST/models/player.glb" "$ROOT/public/assets/3d/stadium/stadium.glb:$DEST/models/stadium.glb";do
 src="${pair%%:*}";dst="${pair#*:}";test -s "$src"||{ echo "ERROR: missing GLB $src";exit 1;};cp "$src" "$dst"
done
echo "SLAYER asset build complete: $DEST"
