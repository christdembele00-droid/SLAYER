import * as THREE from "three";
export class GoalNetCloth{readonly mesh:THREE.Mesh;private velocity:THREE.Vector3[]=[];
constructor(width=7.32,height=2.44,depth=2){const geo=new THREE.PlaneGeometry(width,height,18,8);this.mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0xffffff,wireframe:true,transparent:true,opacity:.65}));this.mesh.position.y=height/2;this.velocity=Array.from({length:(18+1)*(8+1)},()=>new THREE.Vector3())}
impact(point:THREE.Vector3,force:number){this.mesh.position.addScaledVector(point.clone().normalize(),Math.min(.3,force*.01))}
update(dt:number){this.mesh.position.multiplyScalar(Math.max(0,1-dt*3));}}