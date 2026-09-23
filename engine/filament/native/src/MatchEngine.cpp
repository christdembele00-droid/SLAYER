#include "slayer_game.h"
#include <algorithm>
#include <cmath>

namespace slayer {

static float clampf(float v, float a, float b) {
    return std::max(a, std::min(b, v));
}

static float len(float x, float z) {
    return std::sqrt(x * x + z * z);
}

static void normalize(float& x, float& z) {
    const float d = len(x, z);
    if (d > 0.0001f) {
        x /= d;
        z /= d;
    }
}

static float approach(float v, float target, float rate, float dt) {
    const float d = target - v;
    const float m = rate * dt;
    return v + (std::abs(d) <= m ? d : (d > 0 ? m : -m));
}

MatchEngine::MatchEngine() {
    reset();
}

void MatchEngine::setSettings(const SlayerSettings& settings) {
    settings_ = settings;
    input_.selectedPlayer = state_.selected;
}

void MatchEngine::setupTeams() {
    // Original 4-3-3 match layout. Team 0 attacks +Z, team 1 attacks -Z.
    const float home[11][2] = {
        {0, -27}, {-9, -20}, {-3, -22}, {3, -22}, {9, -20},
        {-10, -10}, {0, -12}, {10, -10}, {-11, 1}, {0, 0}, {11, 1}
    };

    for (int i = 0; i < 22; ++i) {
        const int n = i % 11;
        float x = home[n][0];
        float z = home[n][1];
        if (i >= 11) z = -z;

        state_.players[i] = {
            x, 0.9f, z,
            0, 0, 0,
            1, 5.4f, 16.0f,
            static_cast<uint8_t>(i >= 11),
            static_cast<uint8_t>(n),
            false, false, false,
            PlayerAction::None
        };
    }

    state_.players[9].controlled = true;
}

void MatchEngine::reset() {
    state_ = MatchState{};
    setupTeams();
    state_.ball = {0, 0.22f, 0, 0, 0, 0, 0, 0, 0, false};
    state_.phase = MatchPhase::FirstHalf;
    state_.selected = 9;
    state_.possession = -1;
    state_.lastTouchTeam = 0;
    input_.selectedPlayer = 9;
    secondAccumulator_ = 0.0f;
    fixedAccumulator_ = 0.0f;
    phaseAccumulator_ = 0.0f;
    tackleCooldown_ = 0.0f;
}

void MatchEngine::setInput(const InputState& input) {
    input_ = input;
    if (input_.selectedPlayer >= 0 && input_.selectedPlayer < 22) {
        state_.selected = static_cast<uint32_t>(input_.selectedPlayer);
    }

    for (auto& p : state_.players) p.controlled = false;
    state_.players[state_.selected].controlled = true;
}

void MatchEngine::update(float dt) {
    if (state_.paused || state_.phase == MatchPhase::FullTime) return;

    dt = clampf(dt, 0.0f, 0.05f);
    tackleCooldown_ = std::max(0.0f, tackleCooldown_ - dt);

    if (state_.phase == MatchPhase::HalfTime) {
        phaseAccumulator_ += dt;
        if (phaseAccumulator_ >= 2.0f) {
            state_.phase = MatchPhase::SecondHalf;
            phaseAccumulator_ = 0.0f;
            secondAccumulator_ = 0.0f;
        } else {
            return;
        }
    }

    fixedAccumulator_ += dt;
    constexpr float FIXED_STEP = 1.0f / 60.0f;
    constexpr int MAX_STEPS = 4;
    int steps = 0;

    while (fixedAccumulator_ >= FIXED_STEP && steps < MAX_STEPS) {
        for (auto& p : state_.players) p.action = PlayerAction::None;

        updateControlled(FIXED_STEP);
        updateAI(FIXED_STEP);
        resolvePlayerCollisions();
        updateBall(FIXED_STEP);
        updateFatigue(FIXED_STEP);
        resolveRules();

        fixedAccumulator_ -= FIXED_STEP;
        ++steps;
    }

    // Drop excess simulation debt after a long stall instead of simulating a
    // huge burst of gameplay on the next rendered frame.
    if (steps == MAX_STEPS && fixedAccumulator_ > FIXED_STEP * MAX_STEPS) {
        fixedAccumulator_ = 0.0f;
    }

    secondAccumulator_ += dt;
    if (secondAccumulator_ >= 1.0f) {
        secondAccumulator_ -= 1.0f;
        ++state_.matchSeconds;

        const uint32_t halfSeconds =
            static_cast<uint32_t>(std::max(1, settings_.durationMinutes) * 60);

        if (state_.phase == MatchPhase::FirstHalf && state_.matchSeconds >= halfSeconds) {
            state_.phase = MatchPhase::HalfTime;
            phaseAccumulator_ = 0.0f;
        } else if (state_.phase == MatchPhase::SecondHalf &&
                   state_.matchSeconds >= halfSeconds * 2u) {
            if (settings_.extraTime) state_.phase = MatchPhase::ExtraTime;
            else if (settings_.penalties) state_.phase = MatchPhase::Penalties;
            else state_.phase = MatchPhase::FullTime;
        } else if (state_.phase == MatchPhase::ExtraTime &&
                   state_.matchSeconds >= halfSeconds * 2u + 30u * 60u) {
            if (settings_.penalties) state_.phase = MatchPhase::Penalties;
            else state_.phase = MatchPhase::FullTime;
        }
    }

    updateTactics();
}

void MatchEngine::updateControlled(float dt) {
    const uint32_t id = std::min<uint32_t>(state_.selected, 21);
    auto& p = state_.players[id];
    p.controlled = true;

    const float mx = clampf(input_.moveX, -1.0f, 1.0f);
    const float mz = clampf(input_.moveY, -1.0f, 1.0f);
    const float inputMagnitude = len(mx, mz);
    const float sprint =
        input_.sprint > 0.5f && p.stamina > 0.08f ? 1.35f : 1.0f;

    float tacticalMultiplier = 1.0f;
    if (settings_.attack == TacticalMode::UltraDefensive) tacticalMultiplier = 0.94f;
    if (settings_.attack == TacticalMode::UltraOffensive) tacticalMultiplier = 1.06f;

    const float targetX = mx * p.speed * sprint * tacticalMultiplier;
    const float targetZ = mz * p.speed * sprint * tacticalMultiplier;
    p.vx = approach(p.vx, targetX, p.acceleration, dt);
    p.vz = approach(p.vz, targetZ, p.acceleration, dt);
    p.x = clampf(p.x + p.vx * dt, -52.5f, 52.5f);
    p.z = clampf(p.z + p.vz * dt, -34.0f, 34.0f);

    const float ballDx = state_.ball.x - p.x;
    const float ballDz = state_.ball.z - p.z;
    const float ballDistance = len(ballDx, ballDz);

    if (input_.tackle > 0.5f && tackleCooldown_ <= 0.0f) {
        for (int i = 0; i < 22; ++i) {
            auto& opponent = state_.players[i];
            if (opponent.team == p.team) continue;

            const float dx = opponent.x - p.x;
            const float dz = opponent.z - p.z;
            const float distance = len(dx, dz);
            if (distance >= 1.65f) continue;

            float nx = dx;
            float nz = dz;
            normalize(nx, nz);

            state_.ball.x = opponent.x - nx * 0.55f;
            state_.ball.z = opponent.z - nz * 0.55f;
            state_.ball.y = 0.22f;
            state_.ball.vx = nx * 7.5f + p.vx * 0.15f;
            state_.ball.vz = nz * 7.5f + p.vz * 0.15f;
            state_.ball.vy = 1.1f;
            state_.ball.airborne = true;
            state_.possession = -1;

            opponent.vx *= 0.30f;
            opponent.vz *= 0.30f;

            p.action = PlayerAction::Tackle;
            ++state_.fouls;

            if (distance < 0.95f && ++state_.cards % 6u == 0u) {
                opponent.carded = true;
            }
            break;
        }
        tackleCooldown_ = 0.55f;
    }

    if (ballDistance < 1.45f) {
        state_.possession = static_cast<int16_t>(id);
        state_.lastTouchTeam = p.team;

        if (input_.pass > 0.5f) {
            int bestTarget = -1;
            float bestScore = -100000.0f;

            float passDx = mx;
            float passDz = mz;
            if (inputMagnitude < 0.15f) {
                passDx = p.team == 0 ? 1.0f : -1.0f;
                passDz = 0.0f;
            }
            normalize(passDx, passDz);

            for (int i = 0; i < 22; ++i) {
                if (i == static_cast<int>(id) || state_.players[i].team != p.team) continue;
                const auto& teammate = state_.players[i];
                const float dx = teammate.x - p.x;
                const float dz = teammate.z - p.z;
                const float distance = len(dx, dz);
                if (distance < 3.0f || distance > 30.0f) continue;

                float dirX = dx;
                float dirZ = dz;
                normalize(dirX, dirZ);
                const float forward = dirX * passDx + dirZ * passDz;
                const float score = forward * 10.0f - distance * 0.10f;
                if (score > bestScore) {
                    bestScore = score;
                    bestTarget = i;
                }
            }

            if (bestTarget >= 0) {
                const auto& target = state_.players[bestTarget];
                float dx = target.x - state_.ball.x;
                float dz = target.z - state_.ball.z;
                normalize(dx, dz);

                state_.ball.vx = dx * 17.0f;
                state_.ball.vz = dz * 17.0f;
                state_.ball.vy = 1.0f + std::min(1.2f, ballDistance * 0.25f);
                state_.ball.spinY = (target.x - p.x) * 0.35f;
                state_.ball.airborne = true;
                state_.possession = -1;
                p.action = PlayerAction::Pass;
            }
        } else if (input_.shoot > 0.5f) {
            const float goalZ = p.team == 0 ? 34.0f : -34.0f;
            const float targetX = clampf(-p.x * 0.12f, -2.7f, 2.7f);
            float dx = targetX - state_.ball.x;
            float dz = goalZ - state_.ball.z;
            normalize(dx, dz);

            const float power = 20.0f + std::min(7.0f, inputMagnitude * 5.0f);
            state_.ball.vx = dx * power;
            state_.ball.vz = dz * power;
            state_.ball.vy = 4.6f + std::min(2.0f, inputMagnitude);
            state_.ball.spinY = -mx * 5.0f;
            state_.ball.airborne = true;
            state_.possession = -1;
            p.action = PlayerAction::Shoot;
        } else if (inputMagnitude > 0.12f) {
            float dx = mx;
            float dz = mz;
            normalize(dx, dz);

            const float desiredX = p.x + dx * 0.95f;
            const float desiredZ = p.z + dz * 0.95f;
            state_.ball.x = desiredX;
            state_.ball.z = desiredZ;
            state_.ball.y = 0.22f;
            state_.ball.vx = p.vx;
            state_.ball.vz = p.vz;
            state_.ball.vy = 0.0f;
            state_.ball.airborne = false;
            p.action = PlayerAction::Dribble;
        }
    }
}

void MatchEngine::updateAI(float dt) {
    for (int i = 0; i < 22; ++i) {
        auto& p = state_.players[i];
        if (p.controlled) continue;

        const float attack = p.team == 0 ? 1.0f : -1.0f;
        const float bx = state_.ball.x;
        const float bz = state_.ball.z;
        const float dxBall = bx - p.x;
        const float dzBall = bz - p.z;
        const float ballDistance = len(dxBall, dzBall);

        // Role-aware home positions. This keeps defenders from collapsing onto
        // the ball while still allowing pressing and recovery behavior.
        static constexpr float roleX[11] = {0, -9, -3, 3, 9, -10, 0, 10, -11, 0, 11};
        static constexpr float roleZ[11] = {-27, -20, -22, -22, -20, -10, -12, -10, 1, 0, 1};

        float targetX = roleX[i % 11];
        float targetZ = roleZ[i % 11] * attack;

        const bool pressing =
            (p.team == 0 && state_.homeStyle == TacticalStyle::Pressing) ||
            (p.team == 1 && state_.awayStyle == TacticalStyle::Pressing);

        if (ballDistance < (pressing ? 22.0f : 14.0f)) {
            const float influence = pressing ? 0.50f : 0.25f;
            targetX += dxBall * influence;
            targetZ += dzBall * influence;
        }

        // Ball-side defensive shift.
        if (i % 11 <= 7 && ballDistance < 25.0f) {
            targetX += clampf(dxBall * 0.08f, -4.0f, 4.0f);
            targetZ += clampf(dzBall * 0.05f, -3.0f, 3.0f);
        }

        p.vx = approach(p.vx, (targetX - p.x) * 1.25f, 11.0f, dt);
        p.vz = approach(p.vz, (targetZ - p.z) * 1.25f, 11.0f, dt);

        if (ballDistance < (pressing ? 16.0f : 11.0f)) {
            p.vx = approach(p.vx, dxBall * 1.45f, 12.0f, dt);
            p.vz = approach(p.vz, dzBall * 1.45f, 12.0f, dt);
        }

        const float staminaFactor = p.stamina > 0.25f ? 1.0f : 0.72f;
        const float vmax = p.speed * staminaFactor;
        const float speed = len(p.vx, p.vz);
        if (speed > vmax) {
            p.vx *= vmax / speed;
            p.vz *= vmax / speed;
        }

        p.x = clampf(p.x + p.vx * dt, -52.5f, 52.5f);
        p.z = clampf(p.z + p.vz * dt, -34.0f, 34.0f);

        if (ballDistance < 1.25f && state_.ball.y <= 0.45f) {
            state_.possession = static_cast<int16_t>(i);
            state_.lastTouchTeam = p.team;
            p.action = PlayerAction::Dribble;

            const float goalZ = p.team == 0 ? 34.0f : -34.0f;
            const float distanceToGoal = std::abs(goalZ - p.z);

            if (distanceToGoal < 20.0f && (i % 11) >= 8) {
                float tx = clampf(-p.x * 0.10f, -2.7f, 2.7f);
                float bx = tx - state_.ball.x;
                float bzGoal = goalZ - state_.ball.z;
                normalize(bx, bzGoal);

                state_.ball.vx = bx * 18.0f;
                state_.ball.vz = bzGoal * 18.0f;
                state_.ball.vy = 4.0f;
                state_.ball.spinY = p.x * -0.35f;
                state_.ball.airborne = true;
                state_.possession = -1;
                p.action = PlayerAction::Shoot;
            } else {
                float dirX = p.vx;
                float dirZ = p.vz;
                if (len(dirX, dirZ) < 0.05f) {
                    dirX = 0.0f;
                    dirZ = attack;
                }
                normalize(dirX, dirZ);
                state_.ball.x = p.x + dirX * 0.82f;
                state_.ball.z = p.z + dirZ * 0.82f;
                state_.ball.y = 0.22f;
                state_.ball.vx = p.vx;
                state_.ball.vz = p.vz;
                state_.ball.vy = 0.0f;
                state_.ball.airborne = false;
            }
        }
    }
}

void MatchEngine::resolvePlayerCollisions() {
    constexpr float BODY_RADIUS = 0.68f;

    for (int i = 0; i < 22; ++i) {
        for (int j = i + 1; j < 22; ++j) {
            auto& a = state_.players[i];
            auto& b = state_.players[j];

            float dx = b.x - a.x;
            float dz = b.z - a.z;
            float distance = len(dx, dz);
            if (distance <= 0.001f || distance >= BODY_RADIUS * 2.0f) continue;

            const float penetration = BODY_RADIUS * 2.0f - distance;
            dx /= distance;
            dz /= distance;

            const float correction = penetration * 0.5f;
            a.x = clampf(a.x - dx * correction, -52.5f, 52.5f);
            a.z = clampf(a.z - dz * correction, -34.0f, 34.0f);
            b.x = clampf(b.x + dx * correction, -52.5f, 52.5f);
            b.z = clampf(b.z + dz * correction, -34.0f, 34.0f);

            const float relativeNormal =
                (b.vx - a.vx) * dx + (b.vz - a.vz) * dz;
            if (relativeNormal < 0.0f) {
                const float impulse = -relativeNormal * 0.35f;
                a.vx -= dx * impulse;
                a.vz -= dz * impulse;
                b.vx += dx * impulse;
                b.vz += dz * impulse;
            }
        }
    }
}

void MatchEngine::updateBall(float dt) {
    constexpr float g = -9.81f;

    const float damping = std::pow(0.992f, dt * 120.0f);
    state_.ball.vx *= damping;
    state_.ball.vz *= damping;

    state_.ball.vy += g * dt;

    // Magnus term: spin bends the trajectory rather than using a canned animation.
    const float magnusX = state_.ball.spinY * state_.ball.vz * 0.0015f * dt;
    const float magnusZ = state_.ball.spinY * state_.ball.vx * 0.0015f * dt;
    state_.ball.vx += magnusX;
    state_.ball.vz -= magnusZ;

    state_.ball.x += state_.ball.vx * dt;
    state_.ball.y += state_.ball.vy * dt;
    state_.ball.z += state_.ball.vz * dt;

    if (state_.ball.y < 0.22f) {
        state_.ball.y = 0.22f;
        if (std::abs(state_.ball.vy) > 1.0f) {
            state_.ball.vy = -state_.ball.vy * 0.48f;
            state_.ball.airborne = true;
        } else {
            state_.ball.vy = 0.0f;
            state_.ball.airborne = false;
        }
    }

    // Resolve a low-speed ball touch as possession only. Fast shots/passes keep
    // travelling until they hit a player or field boundary.
    if (!state_.ball.airborne && len(state_.ball.vx, state_.ball.vz) < 4.0f) {
        int nearest = -1;
        float nearestDistance = 1.30f;

        for (int i = 0; i < 22; ++i) {
            const auto& p = state_.players[i];
            const float d = len(state_.ball.x - p.x, state_.ball.z - p.z);
            if (d < nearestDistance) {
                nearestDistance = d;
                nearest = i;
            }
        }

        if (nearest >= 0) {
            state_.possession = static_cast<int16_t>(nearest);
            state_.lastTouchTeam = state_.players[nearest].team;
        }
    }

    // Side boundaries behave like the outside of the playable field.
    if (std::abs(state_.ball.x) > 52.5f) {
        state_.ball.x = clampf(state_.ball.x, -52.5f, 52.5f);
        state_.ball.vx = -state_.ball.vx * 0.65f;
        state_.possession = -1;
    }

    if (std::abs(state_.ball.z) > 34.0f) {
        const bool goalMouth =
            std::abs(state_.ball.x) < 3.66f && state_.ball.y < 2.44f;
        const bool crossesGoalLine = std::abs(state_.ball.z) >= 34.0f;
        const bool travellingIntoGoal =
            (state_.ball.z > 0.0f && state_.ball.vz > 0.0f) ||
            (state_.ball.z < 0.0f && state_.ball.vz < 0.0f);

        if (crossesGoalLine && goalMouth && travellingIntoGoal &&
            std::abs(state_.ball.vz) > 0.2f) {
            if (state_.ball.z > 0.0f) ++state_.homeScore;
            else ++state_.awayScore;

            state_.ball = {0, 0.22f, 0, 0, 0, 0, 0, 0, 0, false};
            state_.possession = -1;
            state_.selected = 9;
            for (auto& p : state_.players) p.controlled = false;
            state_.players[9].controlled = true;
            return;
        }

        state_.ball.z = clampf(state_.ball.z, -34.0f, 34.0f);
        state_.ball.vz = -state_.ball.vz * 0.65f;
        state_.possession = -1;
    }

    // When a valid owner exists and the ball is grounded, keep the ball within a
    // controlled dribble envelope. This is used for both human and AI carriers.
    if (state_.possession >= 0 && state_.possession < 22 &&
        !state_.ball.airborne) {
        auto& owner = state_.players[state_.possession];
        float dx = owner.vx;
        float dz = owner.vz;
        if (len(dx, dz) < 0.05f) {
            dx = owner.team == 0 ? 1.0f : -1.0f;
            dz = 0.0f;
        }
        normalize(dx, dz);

        state_.ball.x = owner.x + dx * 0.82f;
        state_.ball.z = owner.z + dz * 0.82f;
        state_.ball.y = 0.22f;
        state_.ball.vx = owner.vx;
        state_.ball.vz = owner.vz;
        state_.ball.vy = 0.0f;
    }
}

void MatchEngine::updateFatigue(float dt) {
    for (auto& p : state_.players) {
        const float effort =
            std::min(1.0f, std::sqrt(p.vx * p.vx + p.vz * p.vz) / p.speed);

        p.stamina = clampf(
            p.stamina - dt * (0.0009f + effort * 0.0018f),
            0.08f, 1.0f);

        if (effort < 0.12f) {
            p.stamina = clampf(p.stamina + dt * 0.0008f, 0.08f, 1.0f);
        }
    }
}

void MatchEngine::updateTactics() {
    for (auto& p : state_.players) p.speed = 5.4f;

    if (state_.homeStyle == TacticalStyle::Pressing) {
        for (int i = 0; i < 11; ++i) {
            state_.players[i].speed = 5.8f;
        }
    }

    if (state_.awayStyle == TacticalStyle::Pressing) {
        for (int i = 11; i < 22; ++i) {
            state_.players[i].speed = 5.8f;
        }
    }

    if (state_.homeStyle == TacticalStyle::Defensive) {
        for (int i = 0; i < 11; ++i) state_.players[i].speed = 5.0f;
    }

    if (state_.awayStyle == TacticalStyle::Defensive) {
        for (int i = 11; i < 22; ++i) state_.players[i].speed = 5.0f;
    }
}

void MatchEngine::resolveRules() {
    // Offside snapshot: attacking players are checked against the
    // second-last opponent plus the ball and the halfway line.
    for (int team = 0; team < 2; ++team) {
        const float attackZ = team == 0 ? 1.0f : -1.0f;

        float highest = -1000.0f;
        float secondHighest = -1000.0f;

        for (int i = 0; i < 22; ++i) {
            if (state_.players[i].team == team) continue;

            const float z = state_.players[i].z * attackZ;
            if (z > highest) {
                secondHighest = highest;
                highest = z;
            } else if (z > secondHighest) {
                secondHighest = z;
            }
        }

        if (secondHighest < -999.0f) secondHighest = 34.0f;

        const float ballZ = state_.ball.z * attackZ;

        for (int i = 0; i < 22; ++i) {
            auto& player = state_.players[i];
            if (player.team != team || player.role == 0) {
                player.offside = false;
                continue;
            }

            const float playerZ = player.z * attackZ;
            const bool inOppositionHalf = playerZ > 0.0f;
            const bool beyondSecondLast = playerZ > secondHighest + 0.2f;
            const bool aheadOfBall = playerZ > ballZ + 0.2f;

            player.offside =
                inOppositionHalf && beyondSecondLast && aheadOfBall;
        }
    }
}

void MatchEngine::snapshot(SlayerTransform* out, uint32_t capacity) const {
    if (!out) return;

    const uint32_t n = std::min<uint32_t>(capacity, 22);
    for (uint32_t i = 0; i < n; ++i) {
        const auto& p = state_.players[i];
        out[i] = {
            p.x, p.y, p.z,
            0, 0, 0, 1,
            static_cast<uint32_t>(p.action),
            0
        };
    }
}

} // namespace slayer
