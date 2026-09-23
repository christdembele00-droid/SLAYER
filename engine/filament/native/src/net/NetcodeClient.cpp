#include "net/NetcodeClient.hpp"

#include <algorithm>
#include <cmath>

namespace Slayer::Net {

namespace {
float clamp(float v, float lo, float hi) {
    return std::max(lo, std::min(hi, v));
}

float lengthXZ(const Vec3& v) {
    return std::sqrt(v.x * v.x + v.z * v.z);
}

Vec3 add(const Vec3& a, const Vec3& b) {
    return {a.x + b.x, a.y + b.y, a.z + b.z};
}

Vec3 subtract(const Vec3& a, const Vec3& b) {
    return {a.x - b.x, a.y - b.y, a.z - b.z};
}

Vec3 multiply(const Vec3& v, float s) {
    return {v.x * s, v.y * s, v.z * s};
}

} // namespace

NetcodeClient::NetcodeClient(uint16_t localNetworkId)
    : m_localNetworkId(localNetworkId) {}

InputCommand NetcodeClient::PredictLocalMovement(
    Vec2 rawInput, bool kick, bool tackle, float power, float dt) {

    dt = clamp(dt, 0.0f, 0.05f);

    const float inputLength = std::sqrt(
        rawInput.x * rawInput.x + rawInput.y * rawInput.y);

    if (inputLength > 1.0f) {
        rawInput.x /= inputLength;
        rawInput.y /= inputLength;
    }

    InputCommand cmd{};
    cmd.sequence = ++m_sequenceCounter;
    cmd.moveX = rawInput.x;
    cmd.moveZ = rawInput.y;
    cmd.kickPressed = kick;
    cmd.tacklePressed = tackle;
    cmd.kickPower = clamp(power, 0.0f, 1.0f);

    m_predictedPosition = SimulateInput(m_predictedPosition, cmd);
    m_predictedVelocity = {
        cmd.moveX * PLAYER_SPEED,
        0.0f,
        cmd.moveZ * PLAYER_SPEED
    };

    m_inputBuffer.push_back(cmd);
    while (m_inputBuffer.size() > INPUT_BUFFER_MAX) {
        m_inputBuffer.pop_front();
    }

    return cmd;
}

Vec3 NetcodeClient::SimulateInput(const Vec3& position, const InputCommand& input) {
    // dt is supplied by the caller and is intentionally not trusted by the
    // server. The client uses a fixed local frame duration for prediction.
    constexpr float PREDICTION_DT = 1.0f / 60.0f;
    Vec3 result = position;
    result.x += input.moveX * PLAYER_SPEED * PREDICTION_DT;
    result.z += input.moveZ * PLAYER_SPEED * PREDICTION_DT;
    return result;
}

void NetcodeClient::OnServerSnapshot(const AuthoritativeSnapshot& snapshot) {
    m_ballPosition = snapshot.ballPosition;

    m_snapshotHistory.push_back(snapshot);
    while (m_snapshotHistory.size() > SNAPSHOT_BUFFER_MAX) {
        m_snapshotHistory.pop_front();
    }

    for (const auto& player : snapshot.players) {
        if (player.networkId == m_localNetworkId) {
            Reconcile(player, snapshot.lastProcessedSequence);
            break;
        }
    }

    InterpolateRemoteEntities();
}

void NetcodeClient::Reconcile(const PlayerSnapshot& authoritativePlayer,
                              uint32_t acknowledgedSequence) {
    while (!m_inputBuffer.empty() &&
           m_inputBuffer.front().sequence <= acknowledgedSequence) {
        m_inputBuffer.pop_front();
    }

    Vec3 replayed = authoritativePlayer.position;
    for (const auto& input : m_inputBuffer) {
        replayed = SimulateInput(replayed, input);
    }

    const Vec3 correction = subtract(replayed, m_predictedPosition);
    const float correctionLength = lengthXZ(correction);

    // The authoritative state becomes the simulation base. The offset is only
    // visual smoothing; it never changes server authority.
    m_predictedPosition = replayed;

    if (correctionLength < 2.0f) {
        m_errorOffset = add(m_errorOffset, correction);
    } else {
        m_errorOffset = {};
    }

    m_predictedVelocity = authoritativePlayer.velocity;
}

void NetcodeClient::Update(float dt) {
    dt = clamp(dt, 0.0f, 0.1f);
    const float smoothing = 1.0f - std::exp(-15.0f * dt);
    m_errorOffset = multiply(m_errorOffset, 1.0f - smoothing);
    InterpolateRemoteEntities();
}

void NetcodeClient::InterpolateRemoteEntities() {
    m_interpolatedPlayers.clear();
    if (m_snapshotHistory.empty()) {
        return;
    }

    if (m_snapshotHistory.size() == 1) {
        for (const auto& p : m_snapshotHistory.back().players) {
            if (p.networkId != m_localNetworkId) {
                m_interpolatedPlayers.push_back(p);
            }
        }
        return;
    }

    // The history is ordered by server tick. Rendering uses a stable midpoint
    // between the two latest authoritative states until a timestamped clock is
    // wired to the Android render loop.
    const auto& older = m_snapshotHistory[m_snapshotHistory.size() - 2];
    const auto& newer = m_snapshotHistory.back();

    for (const auto& p1 : newer.players) {
        if (p1.networkId == m_localNetworkId) {
            continue;
        }

        PlayerSnapshot out = p1;
        for (const auto& p0 : older.players) {
            if (p0.networkId != p1.networkId) {
                continue;
            }

            out.position.x = p0.position.x * 0.5f + p1.position.x * 0.5f;
            out.position.y = p0.position.y * 0.5f + p1.position.y * 0.5f;
            out.position.z = p0.position.z * 0.5f + p1.position.z * 0.5f;
            out.rotationY = p0.rotationY * 0.5f + p1.rotationY * 0.5f;
            break;
        }
        m_interpolatedPlayers.push_back(out);
    }
}

Vec3 NetcodeClient::GetRenderPosition() const {
    return add(m_predictedPosition, m_errorOffset);
}

} // namespace Slayer::Net
