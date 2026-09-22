import * as THREE from "three";

export class MatchPresentation{
  readonly group=new THREE.Group();
  private readonly ring:THREE.Mesh;
  private readonly floodlights:THREE.PointLight[]=[];
  private time=0;
  constructor(){
    const ringMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.045,side:THREE.DoubleSide,depthWrite:false});
    this.ring=new THREE.Mesh(new THREE.RingGeometry(60,105,128),ringMat);
    this.ring.rotation.x=-Math.PI/2;
    this.ring.position.y=.015;
    this.group.add(this.ring);
    for(const [x,z] of [[-34,-48],[-34,48],[34,-48],[34,48]]){
      const light=new THREE.PointLight(0xffe7b0,.35,75,2);
      light.position.set(x,22,z);
      this.floodlights.push(light);
      this.group.add(light);
    }
  }
  update(dt:number,wetness:number):void{
    this.time+=dt;
    const material=this.ring.material as THREE.MeshBasicMaterial;
    material.opacity=.035+Math.sin(this.time*.8)*.008;
    for(const light of this.floodlights) light.intensity=.28+wetness*.08+Math.sin(this.time*1.7)*.025;
  }
}
