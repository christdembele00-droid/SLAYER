export type TacticalMode="balanced"|"high_press"|"low_block"|"counter";
export interface TacticalState { mode:TacticalMode; defensiveLine:number; pressure:number; width:number; }
export function tacticalState(mode:TacticalMode):TacticalState{
 switch(mode){case"high_press":return{mode,defensiveLine:.82,pressure:1,width:.78};case"low_block":return{mode,defensiveLine:.28,pressure:.35,width:.62};case"counter":return{mode,defensiveLine:.48,pressure:.58,width:.72};default:return{mode,defensiveLine:.55,pressure:.62,width:.7};}
}
