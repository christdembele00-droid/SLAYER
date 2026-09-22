/**
 * SLAYER authoritative 11v11 simulation.
 * Fixed 60 Hz. Client input is a request; the server owns the resulting state.
 */

const PITCH_HALF_LENGTH = 52.0;
const PITCH_HALF_WIDTH = 34.0;
const GOAL_WIDTH = 7.32;
const GOAL_HEIGHT = 2.44;
const BALL_RADIUS = 0.11;
const BALL_DRAG_PER_TICK = 0.982;
const BALL_GRAVITY = -9.81;
const BALL_RESTITUTION = 0.65;
const POSSESSION_RADIUS = 1.20;
const MAX_PLAYER_SPEED = 7.5;
const MAX_KICK_FORCE = 35.0;
const MAX_KICK_POWER = 1.0;
const MAX_INPUT_GAP = 32;

function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : 0));
}

function magnitude2(x, z) {
    return Math.hypot(x, z);
}

export class ServerPhysics {
    constructor() {
        this.ball = {
            x: 0, y: BALL_RADIUS, z: 0,
            vx: 0, vy: 0, vz: 0,
            spinX: 0, spinY: 0, spinZ: 0,
            ownerId: null
        };
        this.players = new Map();
        this.serverTick = 0;
        this.lastGoal = null;
    }

    addPlayer(netId, team, role = "ST") {
        if (this.players.size >= 22 && !this.players.has(netId)) {
            return false;
        }

        const teamCount = [...this.players.values()]
            .filter(p => p.team === team).length;
        if (teamCount >= 11 && !this.players.has(netId)) {
            return false;
        }

        this.players.set(netId, {
            netId, team, role,
            x: team === "home" ? -10 : 10,
            y: 0,
            z: 0,
            vx: 0, vz: 0,
            rotationY: team === "home" ? 0 : Math.PI,
            isTackling: false,
            hasBall: false,
            lastSequence: 0,
            suspiciousInputs: 0,
            connected: true
        });
        return true;
    }

    removePlayer(netId) {
        if (this.ball.ownerId === netId) {
            this.ball.ownerId = null;
        }
        this.players.delete(netId);
    }

    processInput(netId, input = {}) {
        const player = this.players.get(netId);
        if (!player) return false;

        const sequence = Math.max(0, Math.floor(Number(input.sequence) || 0));
        if (sequence <= player.lastSequence ||
            sequence - player.lastSequence > MAX_INPUT_GAP) {
            player.suspiciousInputs++;
            return false;
        }
        player.lastSequence = sequence;

        const rawX = clamp(input.moveX, -1, 1);
        const rawZ = clamp(input.moveZ, -1, 1);
        const length = magnitude2(rawX, rawZ);
        const dirX = length > 1 ? rawX / length : rawX;
        const dirZ = length > 1 ? rawZ / length : rawZ;

        const sprint = input.sprint ? 1.0 : 0.0;
        const speed = sprint ? Math.min(7.0, MAX_PLAYER_SPEED) : 4.5;

        player.vx = dirX * speed;
        player.vz = dirZ * speed;

        if (length > 0.001) {
            player.rotationY = Math.atan2(dirX, dirZ);
        }

        player.isTackling = Boolean(input.tackle);
        player.requestKick = Boolean(input.kick || input.shoot);
        player.requestKickPower = clamp(input.kickPower ?? input.power ?? 0, 0, MAX_KICK_POWER);
        return true;
    }

    step(dt = 1 / 60) {
        const fixedDt = 1 / 60;
        this.serverTick++;

        for (const player of this.players.values()) {
            player.x = clamp(player.x + player.vx * fixedDt, -PITCH_HALF_LENGTH, PITCH_HALF_LENGTH);
            player.z = clamp(player.z + player.vz * fixedDt, -PITCH_HALF_WIDTH, PITCH_HALF_WIDTH);
        }

        this.resolvePlayerCollisions();
        this.processRequestedKicks();
        this.stepBall(fixedDt);
        this.resolvePossession();
    }

    processRequestedKicks() {
        for (const player of this.players.values()) {
            if (!player.requestKick) continue;
            player.requestKick = false;
            if (this.ball.ownerId !== player.netId) continue;

            const power = player.requestKickPower * MAX_KICK_FORCE;
            this.ball.ownerId = null;
            this.ball.vx = Math.sin(player.rotationY) * power;
            this.ball.vz = Math.cos(player.rotationY) * power;
            this.ball.vy = power * 0.25;
            this.ball.spinX = 0;
            this.ball.spinY = clamp(power * 0.30, 0, 12);
            this.ball.spinZ = 0;
        }
    }

    stepBall(dt) {
        if (this.ball.ownerId !== null) {
            const owner = this.players.get(this.ball.ownerId);
            if (!owner) {
                this.ball.ownerId = null;
            } else {
                this.ball.x = owner.x + Math.sin(owner.rotationY) * 0.55;
                this.ball.z = owner.z + Math.cos(owner.rotationY) * 0.55;
                this.ball.y = BALL_RADIUS;
                this.ball.vx = owner.vx;
                this.ball.vy = 0;
                this.ball.vz = owner.vz;
                return;
            }
        }

        this.ball.vx *= BALL_DRAG_PER_TICK;
        this.ball.vz *= BALL_DRAG_PER_TICK;
        this.ball.vy += BALL_GRAVITY * dt;

        // Simplified Magnus force from spin around the vertical axis.
        this.ball.vx += this.ball.spinY * this.ball.vz * 0.0015 * dt;
        this.ball.vz -= this.ball.spinY * this.ball.vx * 0.0015 * dt;

        this.ball.x += this.ball.vx * dt;
        this.ball.y += this.ball.vy * dt;
        this.ball.z += this.ball.vz * dt;

        if (this.ball.y <= BALL_RADIUS) {
            this.ball.y = BALL_RADIUS;
            this.ball.vy = Math.abs(this.ball.vy) > 1
                ? -this.ball.vy * BALL_RESTITUTION
                : 0;
        }

        this.resolvePitchAndGoalCollisions();
    }

    resolvePitchAndGoalCollisions() {
        if (Math.abs(this.ball.x) > PITCH_HALF_LENGTH) {
            this.ball.x = clamp(this.ball.x, -PITCH_HALF_LENGTH, PITCH_HALF_LENGTH);
            this.ball.vx *= -BALL_RESTITUTION;
        }

        if (Math.abs(this.ball.z) <= PITCH_HALF_WIDTH) return;

        const inGoalMouth =
            Math.abs(this.ball.x) <= GOAL_WIDTH / 2 &&
            this.ball.y <= GOAL_HEIGHT;

        if (inGoalMouth && Math.abs(this.ball.z) > PITCH_HALF_WIDTH) {
            const homeGoal = this.ball.z > 0;
            this.lastGoal = { team: homeGoal ? "home" : "away", tick: this.serverTick };
            this.resetAfterGoal();
            return;
        }

        this.ball.z = clamp(this.ball.z, -PITCH_HALF_WIDTH, PITCH_HALF_WIDTH);
        this.ball.vz *= -BALL_RESTITUTION;
    }

    resolvePlayerCollisions() {
        const players = [...this.players.values()];
        const minDistance = 0.55;

        for (let i = 0; i < players.length; i++) {
            for (let j = i + 1; j < players.length; j++) {
                const a = players[i];
                const b = players[j];
                let dx = b.x - a.x;
                let dz = b.z - a.z;
                const distance = Math.hypot(dx, dz);
                if (distance <= 0 || distance >= minDistance) continue;

                dx /= distance;
                dz /= distance;
                const push = (minDistance - distance) * 0.5;
                a.x -= dx * push;
                a.z -= dz * push;
                b.x += dx * push;
                b.z += dz * push;
            }
        }
    }

    resolvePossession() {
        for (const p of this.players.values()) p.hasBall = false;
        if (this.ball.ownerId !== null) {
            const owner = this.players.get(this.ball.ownerId);
            if (owner) owner.hasBall = true;
            return;
        }

        let candidate = null;
        let best = POSSESSION_RADIUS;
        for (const p of this.players.values()) {
            const distance = Math.hypot(this.ball.x - p.x, this.ball.z - p.z);
            const tackleBonus = p.isTackling ? 0.25 : 0;
            const allowed = POSSESSION_RADIUS + tackleBonus;
            if (distance <= allowed && distance < best) {
                best = distance;
                candidate = p;
            }
        }

        if (candidate) {
            this.ball.ownerId = candidate.netId;
            candidate.hasBall = true;
        }
    }

    resetAfterGoal() {
        this.ball = {
            x: 0, y: BALL_RADIUS, z: 0,
            vx: 0, vy: 0, vz: 0,
            spinX: 0, spinY: 0, spinZ: 0,
            ownerId: null
        };
        for (const p of this.players.values()) p.hasBall = false;
    }
}

export default ServerPhysics;
