#pragma once

#include <algorithm>

#include <filament/Engine.h>
#include <filament/View.h>
#include <filament/Renderer.h>

#include "slayer_settings.h"
#include "SLAYERGraphicsProfile.hpp"

namespace slayer {

// Centralized mobile rendering policy. The renderer remains Vulkan/PBR;
// this function selects a coherent quality profile for every scene.
inline void applyMobileQuality(
        filament::Engine* engine,
        filament::View* view,
        filament::Renderer* renderer,
        const SlayerSettings& s) {
    if (!engine || !view || !renderer) return;

    const auto q = graphics::profile(s.quality);

    filament::View::DynamicResolutionOptions drs{};
    drs.enabled = s.dynamicResolution;
    drs.homogeneousScaling = true;
    drs.minScale = q.minResolutionScale;
    drs.maxScale = q.maxResolutionScale;
    drs.sharpness = q.sharpness;
    drs.quality = s.quality == QualityMode::Ultra
        ? filament::QualityLevel::HIGH
        : s.quality == QualityMode::High
            ? filament::QualityLevel::MEDIUM
            : filament::QualityLevel::LOW;
    view->setDynamicResolutionOptions(drs);

    filament::Renderer::FrameRateOptions fps{};
    fps.interval = s.targetFps <= 30 ? 2 : 1;
    fps.headRoomRatio = s.quality == QualityMode::Low ? 0.12f
                                                       : s.quality == QualityMode::Ultra ? 0.035f : 0.05f;
    fps.scaleRate = 0.125f;
    fps.history = s.quality == QualityMode::Ultra ? 20 : 15;
    renderer->setFrameRateOptions(fps);

    filament::View::TemporalAntiAliasingOptions taa{};
    taa.enabled = s.quality != QualityMode::Low;
    taa.feedback = q.taaFeedback;
    taa.filterWidth = 1.0f;
    view->setTemporalAntiAliasingOptions(taa);

    filament::View::AmbientOcclusionOptions ao{};
    ao.aoType = filament::View::AmbientOcclusionOptions::AmbientOcclusionType::GTAO;
    ao.radius = q.aoRadius;
    ao.power = q.aoPower;
    ao.resolution = q.aoResolution;
    ao.intensity = s.quality == QualityMode::Low ? 0.65f : 1.0f;
    ao.quality = s.quality == QualityMode::Ultra
        ? filament::QualityLevel::MEDIUM
        : filament::QualityLevel::LOW;
    ao.lowPassFilter = s.quality == QualityMode::Ultra
        ? filament::QualityLevel::HIGH
        : filament::QualityLevel::MEDIUM;
    ao.upsampling = s.quality == QualityMode::Ultra
        ? filament::QualityLevel::MEDIUM
        : filament::QualityLevel::LOW;
    ao.enabled = s.quality != QualityMode::Low || q.aoPower > 0.0f;
    view->setAmbientOcclusionOptions(ao);

    filament::View::BloomOptions bloom{};
    bloom.enabled = q.bloomStrength > 0.0f;
    bloom.strength = q.bloomStrength;
    bloom.resolution = q.bloomResolution;
    bloom.levels = q.bloomLevels;
    bloom.threshold = true;
    bloom.quality = s.quality == QualityMode::Ultra
        ? filament::QualityLevel::MEDIUM
        : filament::QualityLevel::LOW;
    bloom.highlight = s.quality == QualityMode::Ultra ? 650.0f : 800.0f;
    view->setBloomOptions(bloom);

    // PCF is the stable baseline for a wide range of mobile Vulkan GPUs.
    // The geometry/material/IBL pipeline still scales with the chosen profile.
    view->setShadowType(filament::View::ShadowType::PCF);
}

} // namespace slayer
