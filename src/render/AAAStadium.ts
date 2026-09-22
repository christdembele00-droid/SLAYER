import * as THREE from "three";

export class AAAStadium {
  readonly group = new THREE.Group();

  constructor(){
    this.addStand("north",0,7,58,90,12);
    this.addStand("south",0,7,-58,90,12);
    this.addStand("west",-40,7,0,12,105);
    this.addStand("east",40,7,0,12,105);
    this.addFloodlights();
    this.addGoals();
    this.addTunnel();
  }

  private addStand(_name:string,x:number,y:number,z:number,w:number,d:number){
    const standMat=new THREE.MeshStandardMaterial({color:0x20282d,roughness:.8,metalness:.08});
    const tierMat=new THREE.MeshStandardMaterial({color:0x354047,roughness:.75});
    const base=new THREE.Mesh(new THREE.BoxGeometry(w,14,d),standMat);
    base.position.set(x,y,z);
    this.group.add(base);
    for(let row=0;row<5;row++){
      const tier=new THREE.Mesh(new THREE.BoxGeometry(w*.88,1.2,d*.7),tierMat);
      tier.position.set(x,4+row*1.65,z);
      this.group.add(tier);
    }
    const roof=new THREE.Mesh(new THREE.BoxGeometry(w+4,1.4,d+3),standMat);
    roof.position.set(x,16,z);
    this.group.add(roof);
  }

  private addFloodlights(){
    const poleMat=new THREE.MeshStandardMaterial({color:0x59636a,roughness:.5,metalness:.7});
    const lampMat=new THREE.MeshBasicMaterial({color:0xfff2c4});
    for(const x of [-34,34]){
      for(const z of [-48,48]){
        const pole=new THREE.Mesh(new THREE.CylinderGeometry(.18,.28,24,8),poleMat);
        pole.position.set(x,12,z);
        this.group.add(pole);
        const lamp=new THREE.Mesh(new THREE.BoxGeometry(4,.35,1),lampMat);
        lamp.position.set(x*.98,23.5,z*.98);
        this.group.add(lamp);
      }
    }
  }

  private addGoals(){
    const postMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.28,metalness:.15});
    for(const z of [-52.5,52.5]){
      for(const x of [-3.66,3.66]){
        const p=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,2.44,12),postMat);
        p.position.set(x,1.22,z); this.group.add(p);
      }
      const bar=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,7.32,12),postMat);
      bar.rotation.z=Math.PI/2; bar.position.set(0,2.44,z); this.group.add(bar);
    }
  }

  private addTunnel(){
    const mat=new THREE.MeshStandardMaterial({color:0x11171a,roughness:.8});
    const tunnel=new THREE.Mesh(new THREE.BoxGeometry(8,4,5),mat);
    tunnel.position.set(0,2,-47);
    this.group.add(tunnel);
  }
}
