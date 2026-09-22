export type AnimationState="Idle"|"Walk"|"Jog"|"Run"|"Sprint"|"Brake"|"Turn"|"Backpedal"|"Strafe"|"Control"|"Pass"|"Shoot"|"Tackle"|"Header"|"Fall"|"Recover";

export interface AnimationInput{
  speed:number;
  direction:number;
  acceleration:number;
  rotation:number;
  turnRate:number;
  ballMode:string;
  action:string;
  stamina:number;
  distanceToBall:number;
}

export interface AnimationFrame{
  state:AnimationState;
  speed:number;
  acceleration:number;
  turnRate:number;
  stridePhase:number;
  legSwing:number;
  bodyLean:number;
  turnLean:number;
  actionWeight:number;
  ballDistance:number;
}
