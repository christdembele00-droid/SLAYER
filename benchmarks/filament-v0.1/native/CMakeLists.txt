cmake_minimum_required(VERSION 3.22.1)
project(slayer_filament_benchmark LANGUAGES CXX)

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

add_library(slayer_filament_benchmark SHARED
    src/BridgeFFI.cpp
    src/MatchEngine.cpp
    src/GameFFI.cpp
    src/SLAYERGameSystems.cpp
    src/SLAYERFeatureRuntime.cpp
    src/SLAYERAnimationSystem.cpp
    src/net/NetcodeClient.cpp
)

target_include_directories(slayer_filament_benchmark PRIVATE
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

target_link_libraries(slayer_filament_benchmark
    PRIVATE
    "-Wl,--start-group"
    ${FILAMENT_STATIC_LIBS}
    "-Wl,--end-group"
    android
    log
    vulkan
)
target_compile_definitions(slayer_filament_benchmark PRIVATE
    SLAYER_FILAMENT_BENCHMARK=1
    SLAYER_VULKAN_ONLY=1
)

# -----------------------------------------------------------------------------
# Host-side Filament asset compilation
#
# The runtime and host tools MUST come from the same Filament release.
# CI exports MATC and CMGEN explicitly. Local builds can provide FILAMENT_TOOLS_DIR
# or MATC/CMGEN environment variables.
# -----------------------------------------------------------------------------

set(ASSETS_OUT_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../android/app/src/main/assets")
set(MATERIALS_OUT_DIR "${ASSETS_OUT_DIR}/materials")
set(IBL_OUT_DIR "${ASSETS_OUT_DIR}/ibl/orlando_stadium")
set(IBL_SOURCE "${CMAKE_CURRENT_SOURCE_DIR}/../assets/source/orlando_stadium_1k.exr")

if(DEFINED ENV{MATC} AND EXISTS "$ENV{MATC}")
    set(MATC_EXECUTABLE "$ENV{MATC}")
elseif(DEFINED FILAMENT_TOOLS_DIR AND EXISTS "${FILAMENT_TOOLS_DIR}/bin/matc")
    set(MATC_EXECUTABLE "${FILAMENT_TOOLS_DIR}/bin/matc")
else()
    find_program(MATC_EXECUTABLE matc HINTS "$ENV{FILAMENT_DIR}/bin")
endif()

if(NOT MATC_EXECUTABLE)
    message(FATAL_ERROR "SLAYER: matc not found. Set MATC, FILAMENT_TOOLS_DIR or FILAMENT_DIR.")
endif()

if(DEFINED ENV{CMGEN} AND EXISTS "$ENV{CMGEN}")
    set(CMGEN_EXECUTABLE "$ENV{CMGEN}")
elseif(DEFINED FILAMENT_TOOLS_DIR AND EXISTS "${FILAMENT_TOOLS_DIR}/bin/cmgen")
    set(CMGEN_EXECUTABLE "${FILAMENT_TOOLS_DIR}/bin/cmgen")
else()
    find_program(CMGEN_EXECUTABLE cmgen HINTS "$ENV{FILAMENT_DIR}/bin")
endif()

if(NOT CMGEN_EXECUTABLE)
    message(FATAL_ERROR "SLAYER: cmgen not found. Set CMGEN, FILAMENT_TOOLS_DIR or FILAMENT_DIR.")
endif()

file(MAKE_DIRECTORY "${MATERIALS_OUT_DIR}" "${IBL_OUT_DIR}")

set(GRASS_FILAMAT "${MATERIALS_OUT_DIR}/grass.filamat")
set(PLAYER_SKIN_FILAMAT "${MATERIALS_OUT_DIR}/player_skin.filamat")
set(PLAYER_KIT_FILAMAT "${MATERIALS_OUT_DIR}/player_kit.filamat")

add_custom_command(
    OUTPUT "${GRASS_FILAMAT}"
    COMMAND "${MATC_EXECUTABLE}" -p mobile -a vulkan -S
            -o "${GRASS_FILAMAT}"
            "${CMAKE_CURRENT_SOURCE_DIR}/../materials/grass.mat"
    DEPENDS "${CMAKE_CURRENT_SOURCE_DIR}/../materials/grass.mat"
    VERBATIM
    COMMENT "SLAYER: compiling grass.mat -> grass.filamat (Vulkan)"
)

add_custom_command(
    OUTPUT "${PLAYER_SKIN_FILAMAT}"
    COMMAND "${MATC_EXECUTABLE}" -p mobile -a vulkan -S
            -o "${PLAYER_SKIN_FILAMAT}"
            "${CMAKE_CURRENT_SOURCE_DIR}/../materials/player_skin.mat"
    DEPENDS "${CMAKE_CURRENT_SOURCE_DIR}/../materials/player_skin.mat"
    VERBATIM
    COMMENT "SLAYER: compiling player_skin.mat -> player_skin.filamat (Vulkan)"
)

add_custom_command(
    OUTPUT "${PLAYER_KIT_FILAMAT}"
    COMMAND "${MATC_EXECUTABLE}" -p mobile -a vulkan -S
            -o "${PLAYER_KIT_FILAMAT}"
            "${CMAKE_CURRENT_SOURCE_DIR}/../materials/player_kit.mat"
    DEPENDS "${CMAKE_CURRENT_SOURCE_DIR}/../materials/player_kit.mat"
    VERBATIM
    COMMENT "SLAYER: compiling player_kit.mat -> player_kit.filamat (Vulkan)"
)

set(IBL_WORK_DIR "${CMAKE_CURRENT_BINARY_DIR}/orlando_stadium_ibl")
set(IBL_KTX "${IBL_OUT_DIR}/orlando_stadium_ibl.ktx")
set(SKYBOX_KTX "${IBL_OUT_DIR}/orlando_stadium_skybox.ktx")

if(EXISTS "${IBL_SOURCE}")
    add_custom_command(
        OUTPUT "${IBL_KTX}" "${SKYBOX_KTX}"
        COMMAND "${CMAKE_COMMAND}" -E make_directory "${IBL_WORK_DIR}"
        COMMAND "${CMGEN_EXECUTABLE}"
                --quiet
                --format=ktx
                --size=256
                --extract-blur=0.1
                --deploy="${IBL_WORK_DIR}"
                "${IBL_SOURCE}"
        COMMAND "${CMAKE_COMMAND}" -E copy_if_different
                "${IBL_WORK_DIR}/orlando_stadium_1k_ibl.ktx"
                "${IBL_KTX}"
        COMMAND "${CMAKE_COMMAND}" -E copy_if_different
                "${IBL_WORK_DIR}/orlando_stadium_1k_skybox.ktx"
                "${SKYBOX_KTX}"
        DEPENDS "${IBL_SOURCE}"
        VERBATIM
        COMMENT "SLAYER: generating Orlando Stadium IBL + skybox KTX"
    )
else()
    message(FATAL_ERROR
        "SLAYER: missing IBL source ${IBL_SOURCE}. "
        "Place the CC0 Orlando Stadium EXR there before building.")
endif()

add_custom_target(CompileSlayerAssets ALL
    DEPENDS
        "${GRASS_FILAMAT}"
        "${PLAYER_SKIN_FILAMAT}"
        "${PLAYER_KIT_FILAMAT}"
        "${IBL_KTX}"
        "${SKYBOX_KTX}"
)

add_dependencies(slayer_filament_benchmark CompileSlayerAssets)
