const VERSION=1,MAX_PLAYERS=22,HEADER=10,BALL=26,PLAYER=19;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class BinaryProtocol{
 static serializeSnapshot(physics,ack=0,baseline=null){const ps=[...physics.players.values()].slice(0,MAX_PLAYERS);const full=HEADER+BALL+ps.length*PLAYER;const b=Buffer.allocUnsafe(full);let o=0;b.writeUInt8(VERSION,o++);b.writeUInt32BE(physics.serverTick>>>0,o);o+=4;b.writeUInt32BE(ack>>>0,o);o+=4;b.writeUInt8(ps.length,o++);const q=physics.ball;[q.x,q.y,q.z,q.vx,q.vy,q.vz].forEach(v=>{b.writeFloatBE(v,o);o+=4;});b.writeInt16BE(q.ownerId===null?-1:Number(q.ownerId),o);o+=2;for(const p of ps){b.writeUInt16BE(p.netId&65535,o);o+=2;b.writeUInt8(p.team==="away"?1:0,o++);b.writeFloatBE(p.x,o);o+=4;b.writeFloatBE(p.z,o);o+=4;b.writeFloatBE(p.rotationY,o);o+=4;let f=0;if(p.isTackling)f|=1;if(p.hasBall)f|=2;b.writeUInt32BE(f,o);o+=4;}return b;}
}
export default BinaryProtocol;
