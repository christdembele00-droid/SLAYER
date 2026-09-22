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
)

target_include_directories(slayer_filament_benchmark PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${FILAMENT_INCLUDE_DIR}
)

# Filament's Android native archive is a collection of static libraries.
# libfilament.a intentionally does not contain every backend / utility implementation,
# so linking only libfilament.a + libutils.a leaves many symbols unresolved.
# The official Filament Android build links these components together.
set(FILAMENT_LIB_DIR "${FILAMENT_DIST_DIR}/filament/lib/${ANDROID_ABI}")

function(import_filament_static NAME)
    set(LIB_PATH "${FILAMENT_LIB_DIR}/lib${NAME}.a")
    if(NOT EXISTS "${LIB_PATH}")
        message(FATAL_ERROR "Missing Filament library: ${LIB_PATH}")
    endif()
    add_library("filament_${NAME}" STATIC IMPORTED GLOBAL)
    set_target_properties("filament_${NAME}" PROPERTIES
        IMPORTED_LOCATION "${LIB_PATH}"
        INTERFACE_INCLUDE_DIRECTORIES "${FILAMENT_INCLUDE_DIR}"
    )
endfunction()

# Core runtime + backend dependencies used by Engine::create(VULKAN/OPENGL).
foreach(LIB_NAME
    filament
    backend
    bluevk
    bluegl
    vkshaders
    filabridge
    filaflat
    ibl-lite
    math
    utils
    perfetto
    smol-v
    zstd
)
    import_filament_static(${LIB_NAME})
endforeach()

message(STATUS "SLAYER Filament library directory: ${FILAMENT_LIB_DIR}")

# Static-library ordering is significant. A linker group lets lld rescan the
# Filament archives until all inter-library references are resolved.
target_link_libraries(slayer_filament_benchmark
    PRIVATE
    "-Wl,--start-group"
    filament_filament
    filament_backend
    filament_bluevk
    filament_bluegl
    filament_vkshaders
    filament_filabridge
    filament_filaflat
    filament_ibl-lite
    filament_math
    filament_utils
    filament_perfetto
    filament_smol-v
    filament_zstd
    "-Wl,--end-group"
    android
    log
    GLESv3
    EGL
)
target_compile_definitions(slayer_filament_benchmark PRIVATE
    SLAYER_FILAMENT_BENCHMARK=1
)