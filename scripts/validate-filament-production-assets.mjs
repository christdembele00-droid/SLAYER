import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
const root=process.cwd(), out=join(root,"engine/filament/android/app/src/main/assets");
const catalog=JSON.parse(await readFile(join(root,"engine/filament/assets/production/CLOUDINARY_GRAPHICS_CATALOG.json"),"utf8"));
const manifest=JSON.parse(await readFile(join(out,"slayer-production-assets.json"),"utf8"));
if(catalog.renderer!=="filament-vulkan")throw new Error("Catalog renderer mismatch");
if(catalog.known_asset_count!==43)throw new Error("Cloudinary catalog count drift");
for(const x of Object.values(catalog.delivery_urls)){const u=new URL(x);if(u.hostname!=="res.cloudinary.com")throw new Error("Invalid Cloudinary URL");}
const required=["models/player.glb","models/pitch.glb","models/stadium.glb","models/ball.glb","models/goal.glb","models/animation_library.glb","ibl/orlando_stadium/orlando_stadium_1k_ibl.ktx","ibl/orlando_stadium/orlando_stadium_1k_skybox.ktx","ibl/stadium_01/stadium_01_1k_ibl.ktx","ibl/stadium_01/stadium_01_1k_skybox.ktx","materials/grass.filamat","materials/player_skin.filamat","materials/player_kit.filamat","textures/grass_basecolor_1k.png","textures/grass_normal_1k.png","textures/grass_roughness_1k.png","textures/jersey_basecolor_1k.png","textures/jersey_normal_1k.png","textures/jersey_roughness_1k.png","slayer-production-assets.json"];
for(const rel of required){const s=await stat(join(out,rel));if(s.size<128)throw new Error("Runtime asset too small: "+rel);}
for(const rel of required.filter(x=>x.endsWith(".glb"))){const b=await readFile(join(out,rel));if(b.subarray(0,4).toString("ascii")!=="glTF")throw new Error("Invalid GLB: "+rel);}
const magic=Buffer.from([0xAB,0x4B,0x54,0x58,0x20,0x31,0x31,0xBB]);
for(const rel of required.filter(x=>x.endsWith(".ktx"))){const b=await readFile(join(out,rel));if(!magic.equals(b.subarray(0,8)))throw new Error("Invalid KTX1: "+rel);}
if(manifest.renderer!=="filament-vulkan")throw new Error("Generated manifest mismatch");
console.log("SLAYER runtime asset validation: OK");
