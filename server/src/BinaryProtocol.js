const VERSION = 1;
const MAX_PLAYERS = 22;
const HEADER_BYTES = 10;
const BALL_BYTES = 26;
const PLAYER_BYTES = 19;

export class BinaryProtocol {
    static serializeSnapshot(physics, lastProcessedSequence = 0) {
        const players = [...physics.players.values()].slice(0, MAX_PLAYERS);
        const size = HEADER_BYTES + BALL_BYTES + players.length * PLAYER_BYTES;
        const buffer = Buffer.allocUnsafe(size);
        let offset = 0;

        buffer.writeUInt8(VERSION, offset); offset += 1;
        buffer.writeUInt32BE(physics.serverTick >>> 0, offset); offset += 4;
        buffer.writeUInt32BE((lastProcessedSequence >>> 0), offset); offset += 4;
        buffer.writeUInt8(players.length, offset); offset += 1;

        buffer.writeFloatBE(physics.ball.x, offset); offset += 4;
        buffer.writeFloatBE(physics.ball.y, offset); offset += 4;
        buffer.writeFloatBE(physics.ball.z, offset); offset += 4;
        buffer.writeFloatBE(physics.ball.vx, offset); offset += 4;
        buffer.writeFloatBE(physics.ball.vy, offset); offset += 4;
        buffer.writeFloatBE(physics.ball.vz, offset); offset += 4;
        buffer.writeInt16BE(
            physics.ball.ownerId === null ? -1 : Number(physics.ball.ownerId),
            offset
        ); offset += 2;

        for (const p of players) {
            buffer.writeUInt16BE(Number(p.netId) & 0xffff, offset); offset += 2;
            buffer.writeUInt8(p.team === "away" ? 1 : 0, offset); offset += 1;
            buffer.writeFloatBE(p.x, offset); offset += 4;
            buffer.writeFloatBE(p.z, offset); offset += 4;
            buffer.writeFloatBE(p.rotationY, offset); offset += 4;

            let flags = 0;
            if (p.isTackling) flags |= 1;
            if (p.hasBall) flags |= 2;
            buffer.writeUInt32BE(flags >>> 0, offset); offset += 4;
        }

        return buffer;
    }
}

export default BinaryProtocol;
