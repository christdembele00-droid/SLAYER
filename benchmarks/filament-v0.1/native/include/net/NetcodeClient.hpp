#pragma once

#include <cstddef>
#include <cstdint>
#include <deque>
#include <vector>

namespace Slayer::Net {

struct Vec2 {
    float x{0.0f};
    float y{0.0f};
};

struct Vec3 {
    float x{0.0f};
    float y{0.0f};
    float z{0.0f};
};

struct InputCommand {
    uint32_t sequence{0};
    float moveX{0.0f};
    float moveZ{0.0f};
    bool kickPressed{false};
    bool tacklePressed{false};
    float kickPower{0.0f};
};

struct PlayerSnapshot {
    uint16_t networkId{0};
    uint8_t team{0};
    Vec3 position{};
    Vec3 velocity{};
    float rotationY{0.0f};
    uint32_t stateFlags{0};
};

struct AuthoritativeSnapshot {
    uint32_t serverTick{0};
    uint32_t lastProcessedSequence{0};
    Vec3 ballPosition{};
    Vec3 ballVelocity{};
    int16_t ballOwnerId{-1};
    std::vector<PlayerSnapshot> players;
};

class NetcodeClient {
public:
    static constexpr std::size_t INPUT_BUFFER_MAX = 128;
    static constexpr std::size_t SNAPSHOT_BUFFER_MAX = 32;
    static constexpr float PLAYER_SPEED = 6.5f;
    static constexpr float REMOTE_INTERPOLATION_DELAY = 0.100f;

    explicit NetcodeClient(uint16_t localNetworkId);

    InputCommand PredictLocalMovement(Vec2 rawInput, bool kick, bool tackle,
                                       float power, float dt);
    void OnServerSnapshot(const AuthoritativeSnapshot& snapshot);
    void Update(float dt);

    [[nodiscard]] Vec3 GetRenderPosition() const;
    [[nodiscard]] Vec3 GetPredictedVelocity() const { return m_predictedVelocity; }
    [[nodiscard]] const Vec3& GetBallPosition() const { return m_ballPosition; }
    [[nodiscard]] const std::vector<PlayerSnapshot>& GetInterpolatedRemotePlayers() const {
        return m_interpolatedPlayers;
    }

private:
    void Reconcile(const PlayerSnapshot& authoritativePlayer,
                   uint32_t acknowledgedSequence);
    void InterpolateRemoteEntities();
    static Vec3 SimulateInput(const Vec3& position, const InputCommand& input);

    uint16_t m_localNetworkId{0};
    uint32_t m_sequenceCounter{0};
    Vec3 m_predictedPosition{};
    Vec3 m_predictedVelocity{};
    Vec3 m_errorOffset{};
    Vec3 m_ballPosition{};

    std::deque<InputCommand> m_inputBuffer;
    std::deque<AuthoritativeSnapshot> m_snapshotHistory;
    std::vector<PlayerSnapshot> m_interpolatedPlayers;
};

} // namespace Slayer::Net
