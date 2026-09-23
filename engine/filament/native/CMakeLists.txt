cmake_minimum_required(VERSION 3.22.1)
project(slayer_native_engine LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

if(NOT DEFINED FILAMENT_DIST_DIR OR FILAMENT_DIST_DIR STREQUAL "")
    message(FATAL_ERROR "FILAMENT_DIST_DIR must point to the extracted Filament Android native distribution")
endif()

file(GLOB_RECURSE FILAMENT_ENGINE_HEADERS CONFIGURE_DEPENDS
    "${FILAMENT_DIST_DIR}/include/filament/Engine.h"
    "${FILAMENT_DIST_DIR}/*/include/filament/Engine.h"
)
list(LENGTH FILAMENT_ENGINE_HEADERS FILAMENT_ENGINE_HEADER_COUNT)
if(FILAMENT_ENGINE_HEADER_COUNT EQUAL 0)
    message(FATAL_ERROR "Could not find Filament headers under FILAMENT_DIST_DIR=${FILAMENT_DIST_DIR}")
endif()
list(GET FILAMENT_ENGINE_HEADERS 0 FILAMENT_ENGINE_HEADER)
get_filename_component(FILAMENT_INCLUDE_DIR "${FILAMENT_ENGINE_HEADER}" DIRECTORY)
get_filename_component(FILAMENT_INCLUDE_DIR "${FILAMENT_INCLUDE_DIR}" DIRECTORY)

add_library(slayer_native_engine SHARED
    src/BridgeFFI.cpp
    src/MatchEngine.cpp
    src/GameFFI.cpp
    src/SLAYERGameSystems.cpp
    src/SLAYERFeatureRuntime.cpp
    src/SLAYERAnimationSystem.cpp
    src/SLAYERAssetLoader.cpp
    src/net/NetcodeClient.cpp
)

target_include_directories(slayer_native_engine PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${FILAMENT_INCLUDE_DIR}
)

set(FILAMENT_LIB_DIR "${FILAMENT_DIST_DIR}/filament/lib/${ANDROID_ABI}")
if(NOT IS_DIRECTORY "${FILAMENT_LIB_DIR}")
    message(FATAL_ERROR "Missing Filament library directory: ${FILAMENT_LIB_DIR}")
endif()

file(GLOB FILAMENT_STATIC_LIBS CONFIGURE_DEPENDS
    "${FILAMENT_LIB_DIR}/*.a"
)
list(LENGTH FILAMENT_STATIC_LIBS FILAMENT_STATIC_LIB_COUNT)
if(FILAMENT_STATIC_LIB_COUNT EQUAL 0)
    message(FATAL_ERROR "No Filament static libraries found in: ${FILAMENT_LIB_DIR}")
endif()

list(SORT FILAMENT_STATIC_LIBS)
message(STATUS "SLAYER Filament library directory: ${FILAMENT_LIB_DIR}")
message(STATUS "SLAYER Filament static libraries (${FILAMENT_STATIC_LIB_COUNT}):")
foreach(LIB_PATH IN LISTS FILAMENT_STATIC_LIBS)
    message(STATUS "  ${LIB_PATH}")
endforeach()

target_link_libraries(slayer_native_engine
    PRIVATE
    "-Wl,--start-group"
    ${FILAMENT_STATIC_LIBS}
    "-Wl,--end-group"
    android
    log
    vulkan
    EGL
    GLESv3
    jnigraphics
    dl
    m
    z
    c++_shared
)

# Filament Android static archives need their Android platform and C++ runtime
# dependencies resolved explicitly by the final SLAYER shared library.
target_link_options(slayer_native_engine PRIVATE
    "-Wl,--gc-sections"
    "-Wl,-z,max-page-size=16384"
    "-Wl,--error-limit=0"
)
target_compile_definitions(slayer_native_engine PRIVATE
    SLAYER_NATIVE_ENGINE=1
    SLAYER_VULKAN_ONLY=1
)

# -----------------------------------------------------------------------------
# Host-side asset compilation is performed by CI before the Android build.
# Runtime assets are validated and packaged into the APK; the canonical
# production path does not depend on first-frame remote downloads.
# -----------------------------------------------------------------------------

set(SLAYER_ASSET_SCRIPT "${CMAKE_CURRENT_SOURCE_DIR}/../../../scripts/build_assets.sh")
if(EXISTS "${SLAYER_ASSET_SCRIPT}")
    add_custom_target(CompileSlayerAssets
        COMMAND "${CMAKE_COMMAND}" -E echo "SLAYER: runtime fallback assets enabled; production asset build is external"
        VERBATIM
    )
    add_dependencies(slayer_native_engine CompileSlayerAssets)
endif()
