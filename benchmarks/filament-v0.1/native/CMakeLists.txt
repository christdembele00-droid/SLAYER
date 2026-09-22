cmake_minimum_required(VERSION 3.22.1)
project(slayer_filament_benchmark LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

add_library(slayer_filament_benchmark SHARED
    src/BridgeFFI.cpp
    src/FilamentRenderer.cpp
)

target_include_directories(slayer_filament_benchmark
    PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

# The Filament distribution is supplied externally by the build environment.
# FILAMENT_DIST_DIR must point at the Android installation produced by
# Filament's build.sh / CMake Android build.
if(NOT DEFINED FILAMENT_DIST_DIR)
    message(FATAL_ERROR "FILAMENT_DIST_DIR must point to the Filament Android distribution")
endif()

target_include_directories(slayer_filament_benchmark PRIVATE
    ${FILAMENT_DIST_DIR}/include
)

target_link_directories(slayer_filament_benchmark PRIVATE
    ${FILAMENT_DIST_DIR}/lib/${ANDROID_ABI}
)

# The first ABI bridge build deliberately links only the native bridge.
# Filament/gltfio linkage is enabled once the Android host/sample shell is
# present; this avoids claiming a working renderer before the native library
# distribution has actually been built.
target_compile_definitions(slayer_filament_benchmark PRIVATE
    SLAYER_FILAMENT_BENCHMARK=1
)

target_link_libraries(slayer_filament_benchmark
    android
    log
)
