import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export class AssetPipeline{
  private readonly loader=new GLTFLoader();

  async loadGLB(url:string):Promise<THREE.Group>{
    const gltf=await this.loader.loadAsync(url);
    gltf.scene.traverse(object=>{
      const mesh=object as THREE.Mesh;
      if(mesh.isMesh){
        mesh.castShadow=true;
        mesh.receiveShadow=true;
        const material=mesh.material as THREE.MeshStandardMaterial;
        if(material?.isMeshStandardMaterial){
          material.envMapIntensity=1;
          material.roughness=Math.min(.95,Math.max(.18,material.roughness));
        }
      }
    });
    return gltf.scene;
  }
}
