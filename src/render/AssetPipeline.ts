import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export interface LoadedAsset{
  scene:THREE.Group;
  animations:THREE.AnimationClip[];
}

export class AssetPipeline{
  private readonly loader=new GLTFLoader();
  private readonly cache=new Map<string,Promise<LoadedAsset>>();

  load(url:string):Promise<LoadedAsset>{
    const cached=this.cache.get(url);
    if(cached) return cached;
    const request=this.loader.loadAsync(url).then(gltf=>{
      gltf.scene.traverse(object=>{
        const mesh=object as THREE.Mesh;
        if(!mesh.isMesh) return;
        mesh.castShadow=true;
        mesh.receiveShadow=true;
        const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
        for(const raw of materials){
          const material=raw as THREE.MeshStandardMaterial;
          if(material.isMeshStandardMaterial){
            material.envMapIntensity=1;
            material.roughness=THREE.MathUtils.clamp(material.roughness,.18,.95);
            material.metalness=THREE.MathUtils.clamp(material.metalness,0,1);
          }
        }
      });
      return {scene:gltf.scene,animations:gltf.animations};
    });
    this.cache.set(url,request);
    return request;
  }

  async loadGLB(url:string):Promise<THREE.Group>{
    return (await this.load(url)).scene;
  }

  clear(url?:string){
    if(url)this.cache.delete(url);
    else this.cache.clear();
  }
}
