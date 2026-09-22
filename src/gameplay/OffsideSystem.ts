export function isOffside(x:number, ballX:number, secondLastDefenderX:number, attackingRight=true){
 const line=attackingRight?Math.max(ballX,secondLastDefenderX):Math.min(ballX,secondLastDefenderX);
 return attackingRight?x>line:x<line;
}
