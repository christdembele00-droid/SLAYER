export interface FrameBudget{fps:number;frameMs:number;cpuMs:number;gpuMs:number;memoryMB:number;}
export function classifyFrame(b:FrameBudget){return b.frameMs<=16.67&&b.gpuMs<=12?"60FPS_TARGET":"OPTIMIZE";}
