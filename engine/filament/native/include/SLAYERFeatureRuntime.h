#pragma once

#include <cstdint>
#include <array>

namespace slayer {

enum class GameMode : uint8_t {
    QuickMatch,
    CustomMatch,
    Tournament,
    Career,
    Online
};

enum class AudioEvent : uint8_t {
    None,
    Kick,
    Pass,
    Shot,
    Goal,
    Whistle,
    CrowdReaction,
    Foul,
    Card,
    Substitution
};

struct CareerProfile {
    uint32_t season = 1;
    uint32_t matches = 0;
    uint32_t wins = 0;
    uint32_t draws = 0;
    uint32_t losses = 0;
};

struct OnlineSession {
    bool connected = false;
    bool authoritative = false;
    uint32_t localTick = 0;
    uint32_t remoteTick = 0;
};

class FeatureRuntime {
public:
    void reset();
    void setMode(GameMode mode);
    GameMode mode() const { return mode_; }

    void pushAudioEvent(AudioEvent event);
    AudioEvent consumeAudioEvent();

    CareerProfile& career() { return career_; }
    const CareerProfile& career() const { return career_; }

    OnlineSession& online() { return online_; }
    const OnlineSession& online() const { return online_; }

private:
    GameMode mode_ = GameMode::QuickMatch;
    CareerProfile career_{};
    OnlineSession online_{};
    std::array<AudioEvent, 32> audioQueue_{};
    uint32_t audioRead_ = 0;
    uint32_t audioWrite_ = 0;
};

} // namespace slayer
