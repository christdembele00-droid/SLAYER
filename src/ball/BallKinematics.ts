import { BallContactType } from "./BallTypes";

export interface BallStrikeProfile {
  speed: number;
  lift: number;
  spin: number;
  dragMultiplier: number;
}

export function strikeProfile(type: BallContactType, power: number, wetness = 0): BallStrikeProfile {
  const p=Math.max(0,Math.min(1,power));
  const base=16+30*p;
  const profiles: Record<BallContactType, Partial<BallStrikeProfile>>={
    Control:{speed:0,lift:0,spin:0,dragMultiplier:1},
    Pass:{speed:11+17*p,lift:.04+.08*p,spin:.35,dragMultiplier:1},
    LongPass:{speed:16+25*p,lift:.16+.16*p,spin:.6,dragMultiplier:1},
    ThroughBall:{speed:14+23*p,lift:.08+.11*p,spin:.5,dragMultiplier:.95},
    Cross:{speed:15+22*p,lift:.22+.18*p,spin:.9,dragMultiplier:1},
    Shot:{speed:base,lift:.02+.1*p,spin:1.2,dragMultiplier:.92},
    Header:{speed:9+18*p,lift:.15+.16*p,spin:.2,dragMultiplier:1},
    Clearance:{speed:15+24*p,lift:.2+.18*p,spin:.3,dragMultiplier:1.05}
  };
  const profile=profiles[type];
  return {
    speed:profile.speed??base,
    lift:profile.lift??0,
    spin:(profile.spin??0)*(1-wetness*.25),
    dragMultiplier:(profile.dragMultiplier??1)*(1+wetness*.15)
  };
}
