#pragma once
#include <cstdint>

namespace slayer {

enum class AudioCue : uint8_t {
    None, Kick, Pass, Shot, Tackle, Whistle,
    CrowdLow, CrowdBuild, CrowdGoal, GoalSting,
    Save, Foul, Card, MenuMove, MenuConfirm
};

struct AudioCueRequest {
    AudioCue cue = AudioCue::None;
    float volume = 1.0f;
    float pan = 0.0f;
};

} // namespace slayer
