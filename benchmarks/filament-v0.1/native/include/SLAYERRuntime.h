#pragma once
#include <cstdint>
namespace slayer {
struct RuntimeConfig { int targetFps=60; bool dynamicResolution=true; bool astc=true; bool gpuSkinning=true; bool multithreaded=true; };
struct PerformanceTelemetry { float fps=0, frameMs=0, cpuMs=0, gpuMs=0; uint32_t drawCalls=0, triangles=0; };
}
