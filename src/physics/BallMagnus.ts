export interface Vec3{x:number;y:number;z:number}
export function applyMagnus(v:Vec3, spin:Vec3, dt:number, coefficient=.055):Vec3{
 return {x:v.x+coefficient*(spin.y*v.z-spin.z*v.y)*dt,y:v.y+coefficient*(spin.z*v.x-spin.x*v.z)*dt,z:v.z+coefficient*(spin.x*v.y-spin.y*v.x)*dt};
}
