#pragma once
#include <filament/Engine.h>
#include <filament/View.h>
#include <filament/Renderer.h>
#include "slayer_settings.h"

namespace slayer {

// Centralized mobile rendering policy. The renderer remains Vulkan/PBR; this
// function only changes quality/performance knobs so every scene uses the
// same policy.
inline void applyMobileQuality(
        filament::Engine* engine,
        filament::View* view,
        filament::Renderer* renderer,
        const SlayerSettings& s) {
    if (!engine || !view || !renderer) return;

    filament::View::DynamicResolutionOptions drs{};
    drs.enabled = s.dynamicResolution;
    drs.homogeneousScaling = true;

    switch (s.quality) {
        case QualityMode::Low:
            drs.minScale = 0.55f;
            drs.maxScale = 0.80f;
            drs.sharpness = 0.55f;
            drs.quality = filament::QualityLevel::LOW;
            break;
        case QualityMode::Medium:
            drs.minScale = 0.65f;
            drs.maxScale = 0.90f;
            drs.sharpness = 0.65f;
            drs.quality = filament::QualityLevel::LOW;
            break;
        case QualityMode::High:
            drs.minScale = 0.75f;
            drs.maxScale = 1.00f;
            drs.sharpness = 0.75f;
            drs.quality = filament::QualityLevel::MEDIUM;
            break;
        case QualityMode::Ultra:
            drs.minScale = 0.85f;
            drs.maxScale = 1.00f;
            drs.sharpness = 0.85f;
            drs.quality = filament::QualityLevel::HIGH;
            break;
    }
    view->setDynamicResolutionOptions(drs);

    filament::Renderer::FrameRateOptions fps{};
    fps.interval = s.targetFps <= 30 ? 2 : 1;
    fps.headRoomRatio = s.quality == QualityMode::Low ? 0.12f : 0.05f;
    fps.scaleRate = 0.125f;
    fps.history = 15;
    renderer->setFrameRateOptions(fps);

    // Temporal AA is valuable for the broadcast camera and thin stadium
    // geometry. Keep it disabled only on Low to protect frame time.
    filament::View::TemporalAntiAliasingOptions taa{};
    taa.enabled = s.quality != QualityMode::Low;
    taa.feedback = s.quality == QualityMode::Ultra ? 0.08f : 0.12f;
    taa.filterWidth = 1.0f;
    view->setTemporalAntiAliasingOptions(taa);

    // PCF is the baseline mobile shadow path. Higher presets can use the
    // higher quality shadow path exposed by Filament without changing assets.
    switch (s.quality) {
        case QualityMode::Low:
            view->setShadowType(filament::View::ShadowType::PCF);
            break;
        case QualityMode::Medium:
        case QualityMode::High:
        case QualityMode::Ultra:
            view->setShadowType(filament::View::ShadowType::PCF);
            break;
    }
}

} // namespace slayer
