#include "slayer_renderer.h"

#include <algorithm>
#include <chrono>
#include <vector>

namespace {
std::vector<SlayerTransform> g_snapshot;
SlayerFrameStats g_stats{};

using Clock = std::chrono::steady_clock;
Clock::time_point g_last = Clock::now();
std::vector<float> g_frameHistory;

void updateStats(float dt) {
    if (dt <= 0.0f) return;
    g_stats.frame_ms = dt * 1000.0f;
    g_stats.fps = 1.0f / dt;
    g_frameHistory.push_back(g_stats.frame_ms);
    if (g_frameHistory.size() > 120) {
        g_frameHistory.erase(g_frameHistory.begin());
    }

    auto sorted = g_frameHistory;
    std::sort(sorted.begin(), sorted.end());
    if (!sorted.empty()) {
        const size_t index = static_cast<size_t>(0.95 * static_cast<double>(sorted.size() - 1));
        g_stats.p95_ms = sorted[index];
    }
}
}

extern "C" void slayer_renderer_create(void* /*native_window*/) {
    g_snapshot.clear();
    g_frameHistory.clear();
    g_stats = {};
    g_last = Clock::now();
}

extern "C" void slayer_renderer_resize(uint32_t /*width*/, uint32_t /*height*/) {
}

extern "C" void slayer_renderer_set_players(
        const SlayerTransform* transforms,
        uint32_t count) {
    if (!transforms || count == 0) {
        g_snapshot.clear();
        g_stats.player_count = 0;
        return;
    }

    g_snapshot.assign(transforms, transforms + count);
    g_stats.player_count = count;
}

extern "C" void slayer_renderer_render(float delta_seconds) {
    // V0.1 bridge measurement path.
    // Filament scene ownership is intentionally kept in the native renderer
    // layer so this ABI never serializes per-player Python objects.
    const auto now = Clock::now();
    const float measured = std::chrono::duration<float>(now - g_last).count();
    g_last = now;
    updateStats(measured > 0.0f ? measured : delta_seconds);
}

extern "C" SlayerFrameStats slayer_renderer_stats(void) {
    return g_stats;
}

extern "C" void slayer_renderer_destroy(void) {
    g_snapshot.clear();
    g_frameHistory.clear();
}
