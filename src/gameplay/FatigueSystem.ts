import { PlayerStats } from "./PlayerStats";
export function effectiveStats(base:PlayerStats, fatigue01:number):PlayerStats{
 const f=Math.max(0,Math.min(1,fatigue01));
 const physical=1-0.22*f, technical=1-0.10*f;
 return {...base,speed:base.speed*physical,acceleration:base.acceleration*physical,stamina:base.stamina,pass:base.pass*technical,shot:base.shot*technical,control:base.control*technical};
}
