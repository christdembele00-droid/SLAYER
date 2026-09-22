if (process.env.SLAYER_FETCH_WEB_ASSETS !== "1") {\n  console.log("[SLAYER assets] Web asset download disabled; using bundled/fallback assets.");\n  process.exit(0);\n}\n\nimport { mkdir, writeFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";

const assets = [
  {
    path: "public/assets/3d/players/player-hero.glb",
    url: "https://raw.githubusercontent.com/Seyamalam/blood-league-kickoff/main/public/assets/vendor/quaternius/night-striker.glb",
    sha256: "a466828c67a4acc9b2413212ce6d9cde235e3aed9b675680c14fd9673858f118",
  },
  {
    path: "public/assets/3d/animations/universal-animation-library.glb",
    url: "https://raw.githubusercontent.com/Seyamalam/blood-league-kickoff/main/public/assets/vendor/quaternius/universal-animation-library.glb",
    sha256: "4c748767741a3e495d89667b9a218b690ba9810b9517a12e960780e3ca72c4e9",
  },
  {
    path: "public/assets/3d/stadium/stadium.glb",
    url: "https://cdn.3dassets.dev/assets/19143/v1/model.glb",
    sha256: null,
  },
];

async function fetchAsset(asset){
  const file=join(process.cwd(),asset.path);
  try{
    const s=await stat(file);
    if(s.size>0){
      if(asset.sha256){
        const data=await import("node:fs/promises").then(fs=>fs.readFile(file));
        const hash=createHash("sha256").update(data).digest("hex");
        if(hash===asset.sha256) return;
      }else return;
    }
  }catch{}
  const response=await fetch(asset.url);
  if(!response.ok) throw new Error(`Asset download failed ${response.status}: ${asset.url}`);
  const buffer=Buffer.from(await response.arrayBuffer());
  if(buffer.length<128) throw new Error(`Invalid GLB payload: ${asset.path}`);
  if(asset.sha256){
    const hash=createHash("sha256").update(buffer).digest("hex");
    if(hash!==asset.sha256) throw new Error(`SHA-256 mismatch for ${asset.path}: ${hash}`);
  }
  await mkdir(dirname(file),{recursive:true});
  await writeFile(file,buffer);
  console.log(`[SLAYER assets] fetched ${asset.path} (${buffer.length} bytes)`);
}

for(const asset of assets) await fetchAsset(asset);
