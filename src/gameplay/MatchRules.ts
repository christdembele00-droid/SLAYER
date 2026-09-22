export type FoulSeverity="none"|"foul"|"yellow"|"red";
export interface MatchEvent { type:"offside"|"foul"|"penalty"|"goal"; playerId?:string; severity?:FoulSeverity; }
export function foulDecision(contactSpeed:number, insidePenalty:boolean):MatchEvent{
 if(contactSpeed<1.5)return{type:"foul",severity:"none"};
 if(insidePenalty)return{type:"penalty",severity:"foul"};
 return{type:"foul",severity:contactSpeed>4?"yellow":"foul"};
}
