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

# The release archive may contain a top-level distribution directory.
# Search recursively so the build does not depend on that layout.
file(GLOB_RECURSE FILAMENT_LIB_CANDIDATES CONFIGURE_DEPENDS
    "${FILAMENT_DIST_DIR}/lib/${ANDROID_ABI}/libfilament.a"
    "${FILAMENT_DIST_DIR}/*/lib/${ANDROID_ABI}/libfilament.a"
    "${FILAMENT_DIST_DIR}/lib/${ANDROID_ABI}/libfilament.so"
    "${FILAMENT_DIST_DIR}/*/lib/${ANDROID_ABI}/libfilament.so"
)
file(GLOB_RECURSE UTILS_LIB_CANDIDATES CONFIGURE_DEPENDS
    "${FILAMENT_DIST_DIR}/lib/${ANDROID_ABI}/libutils.a"
    "${FILAMENT_DIST_DIR}/*/lib/${ANDROID_ABI}/libutils.a"
    "${FILAMENT_DIST_DIR}/lib/${ANDROID_ABI}/libutils.so"
    "${FILAMENT_DIST_DIR}/*/lib/${ANDROID_ABI}/libutils.so"
)

list(LENGTH FILAMENT_LIB_CANDIDATES FILAMENT_LIB_COUNT)
list(LENGTH UTILS_LIB_CANDIDATES UTILS_LIB_COUNT)

if(FILAMENT_LIB_COUNT EQUAL 0)
    message(FATAL_ERROR "Could not find libfilament.a under FILAMENT_DIST_DIR=${FILAMENT_DIST_DIR} for ABI=${ANDROID_ABI}")
endif()

if(UTILS_LIB_COUNT EQUAL 0)
    message(FATAL_ERROR "Could not find libutils.a under FILAMENT_DIST_DIR=${FILAMENT_DIST_DIR} for ABI=${ANDROID_ABI}")
endif()

list(GET FILAMENT_LIB_CANDIDATES 0 FILAMENT_LIB)
list(GET UTILS_LIB_CANDIDATES 0 UTILS_LIB)

message(STATUS "SLAYER Filament library: ${FILAMENT_LIB}")
message(STATUS "SLAYER Filament utils library: ${UTILS_LIB}")

target_link_libraries(slayer_filament_benchmark
    ${FILAMENT_LIB}
    ${UTILS_LIB}
    android
    log
)

target_compile_definitions(slayer_filament_benchmark PRIVATE
    SLAYER_FILAMENT_BENCHMARK=1
)