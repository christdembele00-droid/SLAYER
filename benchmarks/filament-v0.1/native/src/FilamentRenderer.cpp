#include "slayer_renderer.h"

// This translation unit is deliberately isolated from the ABI bridge.
// The Filament engine, swap chain, scene, camera, gltfio AssetLoader and
// Animator will be wired here in the next benchmark step.
//
// Keeping the boundary separate lets us test the FFI without coupling
// Python memory ownership to Filament resource lifetime.

namespace slayer_filament_benchmark {

struct RendererConfig {
    bool prefer_vulkan = true;
    bool allow_opengl_fallback = true;
    uint32_t shadow_cascades = 2;
    uint32_t max_players = 22;
};

static constexpr RendererConfig kConfig{};

} // namespace slayer_filament_benchmark
