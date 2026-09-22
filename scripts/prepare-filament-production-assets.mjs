import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const root = process.cwd();
const out = join(root, "benchmarks/filament-v0.1/android/app/src/main/assets");

const cloudinary = {
  player: "https://res.cloudinary.com/bk4jm7px/raw/upload/v1790110996/slayer/players/models/player_base.glb",
  animation: "https://res.cloudinary.com/bk4jm7px/raw/upload/v1790111001/slayer/players/animations/universal_animation_library_mannequin.glb",
  fieldZip: "https://res.cloudinary.com/bk4jm7px/raw/upload/v1790111012/slayer/stadium/models/soccer_field_cc0.zip",
  environment: "https://res.cloudinary.com/bk4jm7px/raw/upload/v1790111036/slayer/stadium/ibl/orlando_stadium_1k.exr",
};

async function download(url, file) {
  await mkdir(dirname(file), { recursive: true });
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Cloudinary download failed: ${response.status} ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 128) throw new Error(`Asset too small: ${file}`);
  await writeFile(file, bytes);
  return bytes;
}

async function sha256(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

async function findExecutable(name) {
  try { await exec("which", [name]); return name; } catch {}
  if (process.env.FILAMENT_TOOLS_DIR) {
    const candidate = join(process.env.FILAMENT_TOOLS_DIR, name);
    try { await stat(candidate); return candidate; } catch {}
  }
  return null;
}

await mkdir(out, { recursive: true });
const tmp = join(root, ".slayer-asset-cache");
await mkdir(tmp, { recursive: true });

const playerFile = join(out, "models/player.glb");
const animationFile = join(out, "models/animation_library.glb");
const fieldZip = join(tmp, "soccer_field_cc0.zip");
const envExr = join(tmp, "orlando_stadium_1k.exr");

await download(cloudinary.player, playerFile);
await download(cloudinary.animation, animationFile);
await download(cloudinary.fieldZip, fieldZip);
await download(cloudinary.environment, envExr);

const zipList = (await exec("unzip", ["-Z1", fieldZip])).stdout
  .split("\n").map(x => x.trim()).filter(Boolean);
const glb = zipList.find(x => x.toLowerCase().endsWith(".glb"));
if (!glb) throw new Error("No GLB found in soccer_field_cc0.zip");
await exec("unzip", ["-p", fieldZip, glb]).then(async r => {
  const data = Buffer.from(r.stdout, "binary");
  if (data.length < 128 || data.subarray(0,4).toString() !== "glTF") {
    throw new Error("Extracted pitch asset is not a valid GLB");
  }
  await writeFile(join(out, "models/pitch.glb"), data);
});

const cmgen = await findExecutable("cmgen");
if (!cmgen) throw new Error("cmgen is required to generate the Android KTX IBL/Skybox");
const iblDir = join(out, "ibl/orlando_stadium");
await mkdir(iblDir, { recursive: true });
await exec(cmgen, ["--quiet", "-f", "ktx", "-x", iblDir, envExr]);

const generated = [
  join(iblDir, "orlando_stadium_1k_ibl.ktx"),
  join(iblDir, "orlando_stadium_1k_skybox.ktx")
];
if (!(await Promise.all(generated.map(async f => { try { await stat(f); return true; } catch { return false; } })) ).every(Boolean)) {
  throw new Error("cmgen did not generate both IBL and skybox KTX files");
}

const manifest = {
  generated_at: new Date().toISOString(),
  source: "Cloudinary SLAYER asset catalog",
  renderer: "Filament Vulkan",
  assets: {
    player: { path: "models/player.glb", sha256: await sha256(playerFile) },
    pitch: { path: "models/pitch.glb", sha256: await sha256(join(out, "models/pitch.glb")) },
    animation_library: { path: "models/animation_library.glb", sha256: await sha256(animationFile) },
    ibl: { path: "ibl/orlando_stadium/orlando_stadium_1k_ibl.ktx" },
    skybox: { path: "ibl/orlando_stadium/orlando_stadium_1k_skybox.ktx" }
  }
};
await writeFile(join(out, "slayer-production-assets.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify(manifest, null, 2));
