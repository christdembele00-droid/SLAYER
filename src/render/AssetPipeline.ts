import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export interface LoadedAsset{
  scene:THREE.Group;
  animations:THREE.AnimationClip[];
}

export interface AssetLoadOptions{
  castShadow?:boolean;
  receiveShadow?:boolean;
  maxAnisotropy?:number;
  lodDistances?:number[];
}

export class AssetPipeline{
  private readonly loader=new GLTFLoader();
  private readonly cache=new Map<string,Promise<LoadedAsset>>();

  load(url:string,options:AssetLoadOptions={}):Promise<LoadedAsset>{
    const cached=this.cache.get(url);
    if(cached) return cached;
    const request=this.loader.loadAsync(url).then(gltf=>{
      const maxAnisotropy=options.maxAnisotropy??8;
      gltf.scene.traverse(object=>{
        const mesh=object as THREE.Mesh;
        if(!mesh.isMesh) return;
        mesh.castShadow=options.castShadow??true;
        mesh.receiveShadow=options.receiveShadow??true;
        const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
        for(const raw of materials){
          const material=raw as THREE.MeshStandardMaterial;
          if(!material.isMeshStandardMaterial) continue;
          material.envMapIntensity=1;
          material.roughness=THREE.MathUtils.clamp(material.roughness,.18,.95);
          material.metalness=THREE.MathUtils.clamp(material.metalness,0,1);
          const maps=[material.map,material.normalMap,material.roughnessMap,material.metalnessMap,material.aoMap];
          for(const map of maps) if(map) map.anisotropy=Math.min(maxAnisotropy, map.anisotropy||maxAnisotropy);
          if(material.map) material.map.colorSpace=THREE.SRGBColorSpace;
        }
      });
      return {scene:gltf.scene,animations:gltf.animations};
    });
    this.cache.set(url,request);
    return request;
  }

  async loadGLB(url:string,options:AssetLoadOptions={}):Promise<THREE.Group>{
    return (await this.load(url,options)).scene;
  }

  createLOD(levels:THREE.Object3D[],distances=[0,18,42]):THREE.LOD{
    const lod=new THREE.LOD();
    levels.forEach((level,index)=>lod.addLevel(level,distances[index]??distances[distances.length-1]??0));
    return lod;
  }

  prepareScene(root:THREE.Object3D,options:AssetLoadOptions={}):THREE.Object3D{
    root.traverse(object=>{
      const mesh=object as THREE.Mesh;
      if(mesh.isMesh){
        mesh.castShadow=options.castShadow??true;
        mesh.receiveShadow=options.receiveShadow??true;
        mesh.frustumCulled=true;
      }
    });
    return root;
  }

  clear(url?:string){
    if(url)this.cache.delete(url);
    else this.cache.clear();
  }
}
