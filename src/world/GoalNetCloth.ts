import * as THREE from "three";

export class GoalNetCloth {
  readonly mesh: THREE.Mesh;
  private readonly rest: THREE.Vector3[];
  private readonly velocity: THREE.Vector3[];
  private readonly positions: THREE.BufferAttribute;
  private readonly width: number;
  private readonly height: number;
  private readonly cols: number;
  private readonly rows: number;

  constructor(width=7.32,height=2.44,depth=2) {
    this.width=width; this.height=height; this.cols=18; this.rows=8;
    const geo=new THREE.PlaneGeometry(width,height,this.cols,this.rows);
    this.positions=geo.getAttribute("position") as THREE.BufferAttribute;
    this.rest=Array.from({length:(this.cols+1)*(this.rows+1)},(_,i)=>{
      const x=i%(this.cols+1), y=Math.floor(i/(this.cols+1));
      return new THREE.Vector3(this.width*(x/this.cols-.5),this.height*y/this.rows,0);
    });
    this.velocity=this.rest.map(()=>new THREE.Vector3());
    this.mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0xffffff,wireframe:true,transparent:true,opacity:.65}));
    this.mesh.position.y=height/2;
    void depth;
  }

  impact(point:THREE.Vector3,force:number){
    const local=point.clone().sub(this.mesh.position);
    for(let i=0;i<this.rest.length;i++){
      const d=this.rest[i].distanceTo(local);
      if(d<1.8){
        const k=Math.max(0,1-d/1.8);
        this.velocity[i].add(new THREE.Vector3(local.x,local.y,0).normalize().multiplyScalar(Math.min(8,force*4*k)));
      }
    }
  }

  update(dt:number){
    const damping=Math.exp(-5*dt);
    for(let i=0;i<this.rest.length;i++){
      const p=this.rest[i], v=this.velocity[i];
      const target=p.clone();
      const attraction=target.clone().sub(new THREE.Vector3(this.positions.getX(i),this.positions.getY(i),this.positions.getZ(i))).multiplyScalar(6*dt);
      v.add(attraction);
      v.multiplyScalar(damping);
      this.positions.setXYZ(i,this.positions.getX(i)+v.x*dt,this.positions.getY(i)+v.y*dt,this.positions.getZ(i)+v.z*dt);
    }
    this.positions.needsUpdate=true;
    this.mesh.geometry.computeVertexNormals();
  }
}