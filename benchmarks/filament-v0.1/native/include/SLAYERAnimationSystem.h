#pragma once
#include <cstdint>
#include <array>

namespace slayer {

enum class AnimationState : uint8_t {
    Idle, Walk, Run, Sprint, Accelerate, Decelerate, Turn,
    Pass, Shoot, Cross, Header, Dribble, Tackle, Intercept,
    Jump, Fall, Celebrate, GoalkeeperSave
};

struct AnimationLayer {
    AnimationState state = AnimationState::Idle;
    float normalizedTime = 0.0f;
    float speed = 1.0f;
    float weight = 1.0f;
};

struct PlayerAnimationState {
    AnimationLayer locomotion{};
    AnimationLayer upperBody{};
    AnimationLayer action{};
    float blend = 1.0f;
};

class AnimationSystem {
public:
    void reset();
    void update(float dt, const std::array<float,22>& speed,
                const std::array<uint8_t,22>& action);
    const PlayerAnimationState& player(uint32_t index) const { return players_[index % 22]; }

private:
    std::array<PlayerAnimationState,22> players_{};
};

} // namespace slayer
