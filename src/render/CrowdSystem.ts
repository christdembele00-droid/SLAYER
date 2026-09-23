import * as THREE from "three";
export class CrowdSystem{
  readonly group=new THREE.Group();private phase=0;private readonly mesh:THREE.InstancedMesh;private readonly anchors:Float32Array;private readonly count:number;private accumulator=0;private readonly dummy=new THREE.Object3D();
  constructor(count=1800){
    this.count=count;const geo=new THREE.CapsuleGeometry(.10,.24,3,6),mat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.92,vertexColors:true});
    this.mesh=new THREE.InstancedMesh(geo,mat,count);this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.anchors=new Float32Array(count*4);
    const o=new THREE.Object3D(),palette=[0x6c7880,0xb04d55,0x3e70a8,0xb7a063,0x68528e,0x8f9a9d];
    for(let i=0;i<count;i++){
      const side=i%4,row=Math.floor(i/4)%9,lane=Math.floor(i/36);let x=0,z=0;
      if(side<2){x=(side?1:-1)*(35+lane*.92);z=-49+(i*19)%98;}else{z=(side===2?-1:1)*(54+lane*.58);x=-40+(i*23)%80;}
      const y=1.25+row*.72,s=.72+((i*37)%24)/100;o.position.set(x,y,z);o.scale.set(s,s,s);o.rotation.y=((i*17)%360)*Math.PI/180;o.updateMatrix();this.mesh.setMatrixAt(i,o.matrix);this.mesh.setColorAt(i,new THREE.Color(palette[i%palette.length]));
      this.anchors[i*4]=x;this.anchors[i*4+1]=y;this.anchors[i*4+2]=z;this.anchors[i*4+3]=(i%9)*.47;
    }
    this.mesh.instanceMatrix.needsUpdate=true;if(this.mesh.instanceColor)this.mesh.instanceColor.needsUpdate=true;this.group.add(this.mesh);
  }
  update(dt:number,intensity:number){
    this.phase+=dt*(1+intensity*5);
    this.accumulator+=dt;
    if(this.accumulator<.10) return;
    this.accumulator=0;
    const o=this.dummy;
    for(let i=0;i<this.count;i++){const x=this.anchors[i*4],y=this.anchors[i*4+1],z=this.anchors[i*4+2],p=this.anchors[i*4+3];o.position.set(x,y+Math.sin(this.phase+p)*(.018+intensity*.045),z);o.scale.setScalar(.72+((i*37)%24)/100);o.rotation.y=Math.sin(this.phase*.35+p)*.08;o.updateMatrix();this.mesh.setMatrixAt(i,o.matrix);}
    this.mesh.instanceMatrix.needsUpdate=true;
  }
}