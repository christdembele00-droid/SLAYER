#pragma once

#include <algorithm>
#include <cmath>
#include <cstdint>

#include "slayer_settings.h"

namespace slayer::graphics {

struct QualityProfile {
    const char* name;
    float minResolutionScale;
    float maxResolutionScale;
    float sharpness;
    float taaFeedback;
    float aoRadius;
    float aoPower;
    float aoResolution;
    float bloomStrength;
    uint32_t bloomResolution;
    uint32_t bloomLevels;
    float playerLod0Distance;
    float playerLod1Distance;
    float animationLod0Hz;
    float animationLod1Hz;
    float animationLod2Hz;
};

inline QualityProfile profile(QualityMode mode) {
    switch (mode) {
        case QualityMode::Low:
            return {
                "low",
                0.55f, 0.82f, 0.55f, 0.16f,
                0.30f, 0.95f, 0.35f,
                0.00f, 128u, 3u,
                10.0f, 24.0f,
                30.0f, 20.0f, 10.0f
            };
        case QualityMode::Medium:
            return {
                "medium",
                0.65f, 0.92f, 0.65f, 0.12f,
                0.38f, 1.05f, 0.45f,
                0.045f, 192u, 4u,
                12.0f, 28.0f,
                60.0f, 30.0f, 15.0f
            };
        case QualityMode::High:
            return {
                "high",
                0.75f, 1.00f, 0.76f, 0.10f,
                0.44f, 1.12f, 0.50f,
                0.075f, 256u, 5u,
                14.0f, 32.0f,
                60.0f, 30.0f, 20.0f
            };
        case QualityMode::Ultra:
        default:
            return {
                "ultra",
                0.86f, 1.00f, 0.86f, 0.075f,
                0.50f, 1.18f, 0.65f,
                0.11f, 384u, 6u,
                16.0f, 38.0f,
                60.0f, 30.0f, 20.0f
            };
    }
}

inline uint32_t animationLod(
        float distance,
        const QualityProfile& p,
        uint32_t frameIndex) {
    if (distance < p.playerLod0Distance) return 0u;
    if (distance < p.playerLod1Distance) return 1u;
    return (frameIndex & 1u) ? 3u : 2u;
}

inline float animationInterval(
        uint32_t lod,
        const QualityProfile& p) {
    const float hz = lod == 0u ? p.animationLod0Hz :
                     lod == 1u ? p.animationLod1Hz :
                                  p.animationLod2Hz;
    return 1.0f / std::max(1.0f, hz);
}

inline float normalizedDistance(
        float x,
        float z,
        float targetX,
        float targetZ) {
    const float dx = x - targetX;
    const float dz = z - targetZ;
    return std::sqrt(dx * dx + dz * dz);
}

} // namespace slayer::graphics
