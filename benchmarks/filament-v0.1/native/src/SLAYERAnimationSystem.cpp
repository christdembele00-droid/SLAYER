#include "SLAYERAnimationSystem.h"
#include <algorithm>
#include <cmath>

namespace slayer {

void AnimationSystem::reset() {
    for (auto& p : players_) p = {};
}

void AnimationSystem::update(float dt, const std::array<float,22>& speed,
                             const std::array<uint8_t,22>& action) {
    for (size_t i=0; i<players_.size(); ++i) {
        auto& p = players_[i];
        const float s = std::max(0.0f, speed[i]);

        if (action[i] != 0) {
            p.action.state = static_cast<AnimationState>(
                std::min<uint8_t>(action[i], static_cast<uint8_t>(AnimationState::GoalkeeperSave)));
            p.action.weight = std::min(1.0f, p.action.weight + dt * 8.0f);
            p.action.normalizedTime += dt * 1.25f;
            if (p.action.normalizedTime >= 1.0f) {
                p.action.normalizedTime -= 1.0f;
                p.action.weight = 0.0f;
            }
        } else {
            p.action.weight = std::max(0.0f, p.action.weight - dt * 6.0f);
        }

        if (s < 0.15f) p.locomotion.state = AnimationState::Idle;
        else if (s < 2.0f) p.locomotion.state = AnimationState::Walk;
        else if (s < 5.5f) p.locomotion.state = AnimationState::Run;
        else p.locomotion.state = AnimationState::Sprint;

        p.locomotion.speed = std::clamp(0.75f + s * 0.12f, 0.75f, 1.8f);
        p.locomotion.normalizedTime =
            std::fmod(p.locomotion.normalizedTime + dt * p.locomotion.speed, 1.0f);
        p.blend = std::clamp(1.0f - p.action.weight * 0.65f, 0.25f, 1.0f);
    }
}

} // namespace slayer
