#pragma once
#include <filament/Engine.h>
#include <filament/View.h>
#include <filament/Renderer.h>
#include "slayer_settings.h"

namespace slayer {
inline void applyMobileQuality(filament::Engine* engine, filament::View* view, filament::Renderer* renderer, const SlayerSettings& s) {
    if (!engine || !view || !renderer) return;
    filament::View::DynamicResolutionOptions drs{};
    drs.enabled=s.dynamicResolution;
    drs.homogeneousScaling=true;
    switch(s.quality){
        case QualityMode::Low: drs.minScale=.55f; drs.maxScale=.80f; drs.sharpness=.55f; drs.quality=filament::QualityLevel::LOW; break;
        case QualityMode::Medium: drs.minScale=.65f; drs.maxScale=.90f; drs.sharpness=.65f; drs.quality=filament::QualityLevel::LOW; break;
        case QualityMode::High: drs.minScale=.75f; drs.maxScale=1.0f; drs.sharpness=.75f; drs.quality=filament::QualityLevel::MEDIUM; break;
        case QualityMode::Ultra: drs.minScale=.85f; drs.maxScale=1.0f; drs.sharpness=.85f; drs.quality=filament::QualityLevel::HIGH; break;
    }
    view->setDynamicResolutionOptions(drs);
    filament::Renderer::FrameRateOptions fps{};
    fps.interval=s.targetFps<=30?2:1;
    fps.headRoomRatio=s.quality==QualityMode::Low?.12f:.05f;
    fps.scaleRate=.125f;
    fps.history=15;
    renderer->setFrameRateOptions(fps);
}
}