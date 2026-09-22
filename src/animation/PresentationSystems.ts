import { AnimationSystem } from "./AnimationSystem";

export { AnimationSystem };

export class CameraDirector{
  update(camera:any,target:any){
    camera.position.lerp({x:target.x,y:18,z:target.z+28},.08);
    camera.lookAt(target.x,0,target.z);
  }
}

export class AudioSystem{
  enabled=true;
  setEnabled(v:boolean){this.enabled=v;}
  emit(_event:string,_intensity=1){if(!this.enabled)return;}
}
