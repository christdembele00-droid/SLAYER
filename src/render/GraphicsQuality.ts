import * as THREE from "three";

export type GraphicsTier="Low"|"Medium"|"High"|"Ultra";

export interface GraphicsProfile{
  pixelRatio:number;
  shadows:boolean;
  shadowMapSize:number;
  toneExposure:number;
  fogFar:number;
  anisotropy:number;
  crowdScale:number;
}

export function graphicsProfile(tier:GraphicsTier):GraphicsProfile{
  switch(tier){
    case "Low": return {pixelRatio:.68,shadows:false,shadowMapSize:512,toneExposure:1.04,fogFar:145,anisotropy:2,crowdScale:.45};
    case "Medium": return {pixelRatio:.82,shadows:true,shadowMapSize:1024,toneExposure:1.06,fogFar:190,anisotropy:4,crowdScale:.7};
    case "Ultra": return {pixelRatio:Math.min(window.devicePixelRatio,1.35),shadows:true,shadowMapSize:2048,toneExposure:1.1,fogFar:300,anisotropy:8,crowdScale:1};
    default: return {pixelRatio:.98,shadows:true,shadowMapSize:1536,toneExposure:1.08,fogFar:240,anisotropy:6,crowdScale:.9};
  }
}

export function configureShadow(light:THREE.DirectionalLight,size:number){
  light.castShadow=true;
  light.shadow.mapSize.set(size,size);
  light.shadow.camera.left=-80;
  light.shadow.camera.right=80;
  light.shadow.camera.top=100;
  light.shadow.camera.bottom=-100;
  light.shadow.camera.near=1;
  light.shadow.camera.far=180;
  light.shadow.bias=-0.00025;
}
