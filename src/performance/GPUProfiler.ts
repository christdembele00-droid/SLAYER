import * as THREE from "three";

export interface GPUProfile{
  drawCalls:number;
  triangles:number;
  geometries:number;
  textures:number;
  frameMs:number;
  fps:number;
  p95Ms:number;
}

export class GPUProfiler{
  private readonly frameTimes:number[]=[];
  private elapsed=0;
  private last:GPUProfile={
    drawCalls:0,triangles:0,geometries:0,textures:0,
    frameMs:0,fps:0,p95Ms:0
  };

  sample(renderer:THREE.WebGLRenderer,frameMs:number,delta:number):GPUProfile{
    this.frameTimes.push(Math.max(.01,frameMs));
    if(this.frameTimes.length>180)this.frameTimes.shift();
    this.elapsed+=delta;

    if(this.elapsed>=.5){
      const sorted=[...this.frameTimes].sort((a,b)=>a-b);
      const average=this.frameTimes.reduce((a,b)=>a+b,0)/this.frameTimes.length;
      const p95=sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))];
      const info=renderer.info;
      this.last={
        drawCalls:info.render.calls,
        triangles:info.render.triangles,
        geometries:info.memory.geometries,
        textures:info.memory.textures,
        frameMs,
        fps:1000/average,
        p95Ms:p95
      };
      this.elapsed=0;
    }else{
      this.last={...this.last,frameMs};
    }
    return this.last;
  }
}
