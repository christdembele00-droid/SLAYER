import * as THREE from "three";

export class CrowdSystem {
  readonly group = new THREE.Group();
  private phase = 0;

  constructor(count = 1400) {
    const geo = new THREE.CapsuleGeometry(.12,.22,3,5);
    const mat = new THREE.MeshStandardMaterial({color:0xffffff,roughness:.95,vertexColors:true});
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
      const palette=[0x6f7f8b,0x9b4d4d,0x3e6fa3,0xb89b55,0x7b5fa3];
      mesh.setColorAt(i,new THREE.Color(palette[i%palette.length]));
    }
    mesh.instanceMatrix.needsUpdate=true;
    if(mesh.instanceColor) mesh.instanceColor.needsUpdate=true;
    this.group.add(mesh);
  }

  update(dt:number,intensity:number){
    this.phase+=dt*(1+intensity*4);
    this.group.position.y=Math.sin(this.phase)*.025;
  }
}
