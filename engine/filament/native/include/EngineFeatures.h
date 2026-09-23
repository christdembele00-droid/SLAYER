#pragma once
namespace slayer {
struct EngineFeatures {
 bool vulkan=true, pbr=true, ibl=true, shadows=true, taa=true, ssao=true, aces=true;
 bool motionBlur=true, dof=true, lod=true, astc=true, gpuSkinning=true;
 bool ballMagnus=true, playerCollisions=true, offside=true, fatigue=true;
};
}
