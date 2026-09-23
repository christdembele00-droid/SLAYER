#include "SLAYERFeatureRuntime.h"

namespace slayer {

void FeatureRuntime::reset() {
    mode_ = GameMode::QuickMatch;
    career_ = {};
    online_ = {};
    audioQueue_.fill(AudioEvent::None);
    audioRead_ = audioWrite_ = 0;
}

void FeatureRuntime::setMode(GameMode mode) {
    mode_ = mode;
}

void FeatureRuntime::pushAudioEvent(AudioEvent event) {
    if (event == AudioEvent::None) return;
    const uint32_t next = (audioWrite_ + 1u) % static_cast<uint32_t>(audioQueue_.size());
    if (next == audioRead_) {
        audioRead_ = (audioRead_ + 1u) % static_cast<uint32_t>(audioQueue_.size());
    }
    audioQueue_[audioWrite_] = event;
    audioWrite_ = next;
}

AudioEvent FeatureRuntime::consumeAudioEvent() {
    if (audioRead_ == audioWrite_) return AudioEvent::None;
    const AudioEvent event = audioQueue_[audioRead_];
    audioQueue_[audioRead_] = AudioEvent::None;
    audioRead_ = (audioRead_ + 1u) % static_cast<uint32_t>(audioQueue_.size());
    return event;
}

} // namespace slayer
