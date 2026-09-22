export interface PerformanceSnapshot{
  fps:number;
  frameMs:number;
  averageMs:number;
  p95Ms:number;
}

export class PerformanceMonitor{
  private frames=0;
  private elapsed=0;
  private samples:number[]=[];
  private last:PerformanceSnapshot={fps:0,frameMs:0,averageMs:0,p95Ms:0};

  sample(frameMs:number,delta:number):PerformanceSnapshot{
    const ms=Math.max(0.01,frameMs);
    this.samples.push(ms);
    if(this.samples.length>120)this.samples.shift();
    this.frames++;
    this.elapsed+=delta;
    if(this.elapsed>=.5){
      const sorted=[...this.samples].sort((a,b)=>a-b);
      const average=this.samples.reduce((a,b)=>a+b,0)/this.samples.length;
      const p95=sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))];
      this.last={
        fps:1000/average,
        frameMs:ms,
        averageMs:average,
        p95Ms:p95
      };
      this.frames=0;
      this.elapsed=0;
    }else{
      this.last={...this.last,frameMs:ms};
    }
    return this.last;
  }
}
