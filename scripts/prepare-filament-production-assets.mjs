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
  animation2: "https://res.cloudinary.com/bk4jm7px/raw/upload/v1790124661/slayer/players/animations/universal_animation_library_2_standard",
  fieldZip: "https://res.cloudinary.com/bk4jm7px/raw/upload/v1790111012/slayer/stadium/models/soccer_field_cc0.zip",
  environment: "https://res.cloudinary.com/bk4jm7px/raw/upload/v1790111036/slayer/stadium/ibl/orlando_stadium_1k.exr",
  // Cloudinary public_id is extensionless; keep the remote URL exact and\n  // give the local download its EXR extension for cmgen/tooling.\n  environment2: "https://res.cloudinary.com/bk4jm7px/raw/upload/v1790125054/slayer/stadium/ibl/stadium_01_1k",
  grassBaseColor: "https://res.cloudinary.com/bk4jm7px/image/upload/v1790124684/slayer/stadium/textures/leafy_grass_diff_1k.png",
  grassNormal: "https://res.cloudinary.com/bk4jm7px/image/upload/v1790124688/slayer/stadium/textures/leafy_grass_nor_gl_1k.png",
  grassRoughness: "https://res.cloudinary.com/bk4jm7px/image/upload/v1790124694/slayer/stadium/textures/leafy_grass_rough_1k.png",
  jerseyBaseColor: "https://res.cloudinary.com/bk4jm7px/image/upload/v1790125058/slayer/players/textures/kits/cotton_jersey_diff_1k.png",
  jerseyNormal: "https://res.cloudinary.com/bk4jm7px/image/upload/v1790125063/slayer/players/textures/kits/cotton_jersey_nor_gl_1k.png",
  jerseyRoughness: "https://res.cloudinary.com/bk4jm7px/image/upload/v1790125067/slayer/players/textures/kits/cotton_jersey_rough_1k.png",
  ballZip: "https://res.cloudinary.com/bk4jm7px/raw/upload/v1790125238/slayer/ball/models/football_balloon_cc0",
  goalZip: "https://res.cloudinary.com/bk4jm7px/raw/upload/v1790125246/slayer/stadium/models/soccer_goal_cc0",
  particleZip: "https://res.cloudinary.com/bk4jm7px/raw/upload/v1790125253/slayer/effects/particles/kenney_particle_pack_cc0",
  rainZip: "https://res.cloudinary.com/bk4jm7px/raw/upload/v1790125258/slayer/effects/weather/rain_drop_cc0",
};

function signedCloudinaryRawUrl(url) {
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!secret) {
    throw new Error(
      "Cloudinary returned 401 for a production raw asset. Set the GitHub Actions secret CLOUDINARY_API_SECRET so CI can generate a signed delivery URL."
    );
  }

  const parsed = new URL(url);
  const marker = "/raw/upload/";
  const index = parsed.pathname.indexOf(marker);
  if (index < 0) throw new Error(`Unsupported Cloudinary delivery URL: ${url}`);

  const deliveryPath = parsed.pathname.slice(index + marker.length);
  const signature = createHash("sha1")
    .update(`${deliveryPath}${secret}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
    .slice(0, 8);

  parsed.pathname =
    parsed.pathname.slice(0, index + marker.length) +
    `s--${signature}--/` +
    deliveryPath;
  return parsed.toString();
}

async function download(url, file) {
  await mkdir(dirname(file), { recursive: true });

  let response = await fetch(url);
  if (response.status === 401 && url.includes("/raw/upload/")) {
    response = await fetch(signedCloudinaryRawUrl(url));
  }

  if (!response.ok) {
    throw new Error(`Cloudinary download failed: ${response.status} ${url}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 128) throw new Error(`Asset too small: ${file}`);
  await writeFile(file, bytes);
  return bytes;
}

async function sha256(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

async function findExecutable(name) {
  try {
    await exec("which", [name]);
    return name;
  } catch {}

  if (process.env.FILAMENT_TOOLS_DIR) {
    const candidate = join(process.env.FILAMENT_TOOLS_DIR, name);
    try {
      await stat(candidate);
      return candidate;
    } catch {}
  }

  return null;
}

async function ensureFile(file, label) {
  const info = await stat(file);
  if (info.size < 128) {
    throw new Error(`${label} is unexpectedly small: ${info.size} bytes`);
  }
}

async function extractZipEntry(zipFile, entry, destination) {
  await mkdir(dirname(destination), { recursive: true });
  await exec("unzip", ["-p", zipFile, entry], {
    maxBuffer: 128 * 1024 * 1024,
  }).then(({ stdout }) => {
    if (!stdout) throw new Error(`unzip returned an empty asset: ${entry}`);
    return writeFile(destination, stdout);
  });
}

async function prepareModelFromZip(zipFile, destination, label) {
  const entries = (await exec("unzip", ["-Z1", zipFile])).stdout
    .split("\n").map(x => x.trim()).filter(Boolean).filter(x => !x.endsWith("/"));
  const glbEntry = entries.find(x => x.toLowerCase().endsWith(".glb"));
  if (glbEntry) {
    await extractZipEntry(zipFile, glbEntry, destination);
    await ensureFile(destination, label);
    return { mode: "glb", source: glbEntry };
  }

  const gltfEntry = entries.find(x => x.toLowerCase().endsWith(".gltf"));
  const objEntry = entries.find(x => x.toLowerCase().endsWith(".obj"));
  const sourceEntry = gltfEntry || objEntry;
  const tool = await findExecutable("gltfpack");
  if (!sourceEntry || !tool) {
    throw new Error("Unable to convert " + label + ": no GLB and no gltfpack-compatible model.");
  }

  const extractDir = join(tmp, label.replace(/[^a-z0-9_-]/gi, "_"));
  await mkdir(extractDir, { recursive: true });
  await exec("unzip", ["-q", zipFile, "-d", extractDir]);
  const sourcePath = join(extractDir, sourceEntry);
  await exec(tool, ["-i", sourcePath, "-o", destination, "-noq"], {
    maxBuffer: 64 * 1024 * 1024,
  });
  await ensureFile(destination, label);
  return { mode: "converted", source: sourceEntry };
}

await mkdir(out, { recursive: true });
const tmp = join(root, ".slayer-asset-cache");
const fieldSourceDir = join(tmp, "soccer_field_source");
await mkdir(fieldSourceDir, { recursive: true });

const playerFile = join(out, "models/player.glb");
const playerLod1File = join(out, "models/player_lod1.glb");
const playerLod2File = join(out, "models/player_lod2.glb");
const animationFile = join(out, "models/animation_library.glb");
const animationFile2 = join(out, "models/animation_library_2_standard");
const grassBaseColorFile = join(out, "textures/grass_basecolor_1k.png");
const grassNormalFile = join(out, "textures/grass_normal_1k.png");
const grassRoughnessFile = join(out, "textures/grass_roughness_1k.png");
const jerseyBaseColorFile = join(out, "textures/jersey_basecolor_1k.png");
const jerseyNormalFile = join(out, "textures/jersey_normal_1k.png");
const jerseyRoughnessFile = join(out, "textures/jersey_roughness_1k.png");
const ballZip = join(tmp, "football_balloon_cc0.zip");
const goalZip = join(tmp, "soccer_goal_cc0.zip");
const particleZip = join(out, "effects/particle_pack_cc0.zip");
const rainZip = join(out, "effects/rain_drop_cc0.zip");
const ballModel = join(out, "models/ball.glb");
const goalModel = join(out, "models/goal.glb");
const envExr2 = join(tmp, "stadium_01_1k.exr");
const fieldZip = join(tmp, "soccer_field_cc0.zip");
const envExr = join(tmp, "orlando_stadium_1k.exr");

await download(cloudinary.player, playerFile);
await download(cloudinary.animation, animationFile);
await download(cloudinary.animation2, animationFile2);
await download(cloudinary.fieldZip, fieldZip);
await download(cloudinary.environment, envExr);
await download(cloudinary.environment2, envExr2);
await download(cloudinary.grassBaseColor, grassBaseColorFile);
await download(cloudinary.grassNormal, grassNormalFile);
await download(cloudinary.grassRoughness, grassRoughnessFile);
await download(cloudinary.jerseyBaseColor, jerseyBaseColorFile);
await download(cloudinary.jerseyNormal, jerseyNormalFile);
await download(cloudinary.jerseyRoughness, jerseyRoughnessFile);
await download(cloudinary.ballZip, ballZip);
await download(cloudinary.goalZip, goalZip);
await download(cloudinary.particleZip, particleZip);
await download(cloudinary.rainZip, rainZip);

// Generate geometry LODs from the same source player when the Filament host
// tool is available. LOD assets are deliberately optional: the runtime uses
// animation-rate LOD today, avoiding a 3x instance-memory multiplier.
const gltfpack = await findExecutable("gltfpack");
if (gltfpack) {
  try {
    await exec(gltfpack, ["-i", playerFile, "-o", playerLod1File, "-km", "-si", "0.55"], {
      maxBuffer: 64 * 1024 * 1024,
    });
    await exec(gltfpack, ["-i", playerFile, "-o", playerLod2File, "-km", "-si", "0.30"], {
      maxBuffer: 64 * 1024 * 1024,
    });
    await ensureFile(playerLod1File, "Player LOD1 GLB");
    await ensureFile(playerLod2File, "Player LOD2 GLB");
    console.log("Generated player geometry LODs with gltfpack.");
  } catch (error) {
    console.log("gltfpack LOD generation skipped:", error.message);
  }
} else {
  console.log("gltfpack not available; keeping runtime animation-rate LOD only.");
}

await mkdir(join(out, "effects"), { recursive: true });
const ballInfo = await prepareModelFromZip(ballZip, ballModel, "Ball GLB");
const goalInfo = await prepareModelFromZip(goalZip, goalModel, "Goal GLB");
console.log("Prepared ball:", JSON.stringify(ballInfo));
console.log("Prepared goal:", JSON.stringify(goalInfo));

const zipList = (await exec("unzip", ["-Z1", fieldZip])).stdout
  .split("\n")
  .map(x => x.trim())
  .filter(Boolean);

console.log("Cloudinary pitch archive entries:");
console.log(zipList.join("\n"));

const normalized = zipList.filter(x => !x.endsWith("/"));
const glb = normalized.find(x => x.toLowerCase().endsWith(".glb"));
const gltf = normalized.find(x => x.toLowerCase().endsWith(".gltf"));
const obj = normalized.find(x => x.toLowerCase().endsWith(".obj"));
const fbx = normalized.find(x => x.toLowerCase().endsWith(".fbx"));

const extractedPitch = join(out, "models/pitch.glb");

if (glb) {
  await extractZipEntry(fieldZip, glb, extractedPitch);
  console.log(`Using GLB pitch source: ${glb}`);
} else {
  await exec("unzip", ["-q", fieldZip, "-d", fieldSourceDir]);

  const source = gltf || obj;
  if (gltf || obj) {
    const gltfpack = await findExecutable("gltfpack");
    if (!gltfpack) {
      throw new Error("soccer_field_cc0.zip contains a GLTF/OBJ model. Filament gltfpack is required to convert it to GLB.");
    }
    const source = gltf || obj;
    const sourcePath = join(fieldSourceDir, source);
    await exec(gltfpack, [
      "-i",
      sourcePath,
      "-o",
      extractedPitch,
      "-noq",
    ], {
      maxBuffer: 64 * 1024 * 1024,
    });
    console.log(`Converted ${source} to production GLB with gltfpack`);
  } else if (fbx) {
    const blender = await findExecutable("blender");
    if (!blender) {
      throw new Error("soccer_field_cc0.zip contains an FBX model. Blender is required to convert FBX to GLB.");
    }
    const sourcePath = join(fieldSourceDir, fbx);
    const blenderScript = join(fieldSourceDir, "export_fbx_to_glb.py");
    await writeFile(blenderScript, `import bpy\nimport sys\n\nseparator = sys.argv.index("--")\ninput_path = sys.argv[separator + 1]\noutput_path = sys.argv[separator + 2]\n\nbpy.ops.wm.read_factory_settings(use_empty=True)\nbpy.ops.import_scene.fbx(filepath=input_path, use_custom_normals=True)\nbpy.ops.export_scene.gltf(filepath=output_path, export_format="GLB", export_image_format="AUTO", export_materials="EXPORT", export_cameras=False, export_lights=False)\n`);
    await mkdir(dirname(extractedPitch), { recursive: true });
    const blenderResult = await exec(blender, [
      "--background",
      "--python",
      blenderScript,
      "--",
      sourcePath,
      extractedPitch,
    ], { maxBuffer: 128 * 1024 * 1024 });
    if (blenderResult.stdout) console.log(blenderResult.stdout);
    if (blenderResult.stderr) console.error(blenderResult.stderr);
    await ensureFile(extractedPitch, "Blender-exported pitch GLB");
    console.log(`Converted ${fbx} to production GLB with Blender: ${extractedPitch}`);
  } else {
    throw new Error(
      `No supported 3D model found in soccer_field_cc0.zip. Entries:\n${normalized.join("\n")}`
    );
  }
}

await ensureFile(extractedPitch, "Pitch GLB");

const blenderFoundation = await findExecutable("blender");
if (!blenderFoundation) throw new Error("Blender is required for SLAYER procedural stadium/crowd foundations");
const foundationStadium = join(out, "models/stadium.glb");
const foundationCrowd = join(out, "crowd/crowd.glb");
await mkdir(dirname(foundationStadium), { recursive: true });
await mkdir(dirname(foundationCrowd), { recursive: true });
await exec(blenderFoundation, [
  "--background",
  "--python",
  join(root, "scripts/generate_slayer_foundations.py"),
  "--",
  foundationStadium,
  foundationCrowd,
], { maxBuffer: 64 * 1024 * 1024 });
await ensureFile(foundationStadium, "Procedural stadium GLB");
await ensureFile(foundationCrowd, "Procedural crowd GLB");
const pitchData = await readFile(extractedPitch);
if (pitchData.subarray(0, 4).toString() !== "glTF") {
  throw new Error("Generated pitch asset is not a valid GLB");
}

const matc = await findExecutable("matc");
if (!matc) {
  throw new Error("matc is required to compile SLAYER PBR material definitions");
}

const materialSourceDir = join(root, "benchmarks/filament-v0.1/native/materials");
const materialDefinitions = [
  ["grass.mat", "grass.filamat"],
  ["player_skin.mat", "player_skin.filamat"],
  ["player_kit.mat", "player_kit.filamat"],
];
const materialOutDir = join(out, "materials");
await mkdir(materialOutDir, { recursive: true });
for (const [sourceName, outputName] of materialDefinitions) {
  const sourcePath = join(materialSourceDir, sourceName);
  const outputPath = join(materialOutDir, outputName);
  await ensureFile(sourcePath, sourceName);
  await exec(matc, [
    "-p", "mobile",
    "-a", "vulkan",
    "-o", outputPath,
    sourcePath,
  ], { maxBuffer: 16 * 1024 * 1024 });
  await ensureFile(outputPath, outputName);
  console.log("Compiled PBR material:", outputName);
}

const cmgen = await findExecutable("cmgen");
if (!cmgen) {
  throw new Error("cmgen is required to generate the Android KTX IBL/Skybox");
}

const iblDir = join(out, "ibl/orlando_stadium");
const iblDir2 = join(out, "ibl/stadium_01");
await mkdir(iblDir, { recursive: true });
await mkdir(iblDir2, { recursive: true });
await exec(cmgen, ["--quiet", "-f", "ktx", "-x", iblDir, envExr]);

const generated = [
  join(iblDir, "orlando_stadium_1k_ibl.ktx"),
  join(iblDir, "orlando_stadium_1k_skybox.ktx"),
];

console.log("cmgen output tree:");
try {
  const { stdout } = await exec("find", [iblDir, "-maxdepth", "3", "-type", "f", "-print"]);
  console.log(stdout || "(no KTX files found)");
} catch (error) {
  console.log(error.stdout || error.message);
}

async function locateKtx(directory, expected, suffix) {
  try {
    await ensureFile(expected, "Generated KTX asset");
    return expected;
  } catch {}

  const { stdout } = await exec("find", [directory, "-type", "f", "-name", "*" + suffix + ".ktx"]);
  const candidates = stdout.split("\n").map(x => x.trim()).filter(Boolean);
  if (candidates.length !== 1) {
    throw new Error("cmgen did not produce a unique " + suffix + ".ktx file. Found: " + (candidates.join(", ") || "none"));
  }
  return candidates[0];
}

const resolvedIbl = await locateKtx(iblDir, generated[0], "_ibl");
const resolvedSkybox = await locateKtx(iblDir, generated[1], "_skybox");

if (resolvedIbl !== generated[0]) await exec("cp", [resolvedIbl, generated[0]]);
if (resolvedSkybox !== generated[1]) await exec("cp", [resolvedSkybox, generated[1]]);

for (const file of generated) {
  await ensureFile(file, "Generated KTX asset");
}

const secondIbl = join(iblDir2, "stadium_01_1k_ibl.ktx");
const secondSkybox = join(iblDir2, "stadium_01_1k_skybox.ktx");
await exec(cmgen, ["--quiet", "-f", "ktx", "-x", iblDir2, envExr2]);
const secondIblResolved = await locateKtx(iblDir2, secondIbl, "_ibl");
const secondSkyboxResolved = await locateKtx(iblDir2, secondSkybox, "_skybox");
if (secondIblResolved !== secondIbl) await exec("cp", [secondIblResolved, secondIbl]);
if (secondSkyboxResolved !== secondSkybox) await exec("cp", [secondSkyboxResolved, secondSkybox]);

const manifest = {
  generated_at: new Date().toISOString(),
  source: "Cloudinary SLAYER asset catalog",
  renderer: "Filament Vulkan",
  assets: {
    player: { path: "models/player.glb", sha256: await sha256(playerFile) },
    player_lod1: {
      path: "models/player_lod1.glb",
      generated: Boolean(await stat(playerLod1File).catch(() => null)),
      ...(await stat(playerLod1File).catch(() => null) ? { sha256: await sha256(playerLod1File) } : {}),
    },
    player_lod2: {
      path: "models/player_lod2.glb",
      generated: Boolean(await stat(playerLod2File).catch(() => null)),
      ...(await stat(playerLod2File).catch(() => null) ? { sha256: await sha256(playerLod2File) } : {}),
    },
    pitch: { path: "models/pitch.glb", sha256: await sha256(extractedPitch) },
    animation_library: {
      path: "models/animation_library.glb",
      sha256: await sha256(animationFile),
    },
    animation_library_2_standard: {
      path: "models/animation_library_2_standard",
      sha256: await sha256(animationFile2),
    },
    grass_pbr: {
      baseColor: "textures/grass_basecolor_1k.png",
      normal: "textures/grass_normal_1k.png",
      roughness: "textures/grass_roughness_1k.png"
    },
    jersey_pbr: {
      baseColor: "textures/jersey_basecolor_1k.png",
      normal: "textures/jersey_normal_1k.png",
      roughness: "textures/jersey_roughness_1k.png"
    },
    secondary_stadium_ibl: {
      ibl: "ibl/stadium_01/stadium_01_1k_ibl.ktx",
      skybox: "ibl/stadium_01/stadium_01_1k_skybox.ktx"
    },
    stadium_foundation: { path: "models/stadium.glb", source: "procedural-original" },
    crowd_foundation: { path: "crowd/crowd.glb", source: "procedural-original" },
    ball: { path: "models/ball.glb", source: ballInfo.source, mode: ballInfo.mode, sha256: await sha256(ballModel) },
    goal: { path: "models/goal.glb", source: goalInfo.source, mode: goalInfo.mode, sha256: await sha256(goalModel) },
    particle_pack: { path: "effects/particle_pack_cc0.zip", sha256: await sha256(particleZip) },
    rain_particle: { path: "effects/rain_drop_cc0.zip", sha256: await sha256(rainZip) },
    ibl: { path: "ibl/orlando_stadium/orlando_stadium_1k_ibl.ktx" },
    skybox: { path: "ibl/orlando_stadium/orlando_stadium_1k_skybox.ktx" },
  },
  materials: {
    grass: { path: "materials/grass.filamat" },
    player_skin: { path: "materials/player_skin.filamat" },
    player_kit: { path: "materials/player_kit.filamat" },
  },
};

await writeFile(
  join(out, "slayer-production-assets.json"),
  JSON.stringify(manifest, null, 2) + "\n"
);

console.log(JSON.stringify(manifest, null, 2));
