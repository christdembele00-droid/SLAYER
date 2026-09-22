import { QualityTier } from "../world/WorldTypes";

export class QualityManager {
  tier: QualityTier = "High";
  private history: number[] = [];
  private stableTime = 0;

  update(frameMs: number, delta = 1 / 60): void {
    this.history.push(frameMs);
    if (this.history.length > 90) this.history.shift();
    const avg = this.history.reduce((a,b)=>a+b,0)/this.history.length;
    if (avg > 22.5) {
      this.tier = "Low";
      this.stableTime = 0;
    } else if (avg > 18.5) {
      this.tier = "Medium";
      this.stableTime = 0;
    } else if (avg < 14.5) {
      this.stableTime += delta;
      if (this.stableTime > 2) this.tier = "Ultra";
    } else {
      this.stableTime = 0;
      this.tier = "High";
    }
  }

  pixelRatio(): number {
    switch(this.tier){
      case "Low": return .72;
      case "Medium": return .82;
      case "High": return .95;
      case "Ultra": return Math.min(window.devicePixelRatio,1.25);
    }
  }

  targetFrameMs(): number { return 1000/60; }
}
