import * as THREE from "three";

export class CrowdSystem {
  readonly group = new THREE.Group();
  private phase = 0;

  constructor(count = 1400) {
    const geo = new THREE.CapsuleGeometry(.12,.22,3,5);
    const mat = new THREE.MeshStandardMaterial({color:0x77828c,roughness:.95});
    const mesh = new THREE.InstancedMesh(geo,mat,count);
    const o = new THREE.Object3D();

    for(let i=0;i<count;i++){
      const side=i%4;
      const row=Math.floor(i/4)%7;
      const lane=Math.floor(i/28);
      if(side<2){
        o.position.set((i%2?1:-1)*(35+lane*1.1),1.1+row*.72,((i*13)%100)-50);
      }else{
        o.position.set(((i*17)%76)-38,1.1+row*.72,(side===2?-1:1)*(54+lane*.65));
      }
      const scale=.75+((i*37)%20)/100;
      o.scale.set(scale,scale,scale);
      o.updateMatrix();
      mesh.setMatrixAt(i,o.matrix);
    }
    mesh.instanceMatrix.needsUpdate=true;
    this.group.add(mesh);
  }

  update(dt:number,intensity:number){
    this.phase+=dt*(1+intensity*4);
    this.group.position.y=Math.sin(this.phase)*.025;
  }
}
