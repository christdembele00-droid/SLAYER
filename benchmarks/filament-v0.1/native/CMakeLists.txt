cmake_minimum_required(VERSION 3.22.1)
project(slayer_filament_benchmark LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

if(NOT DEFINED FILAMENT_DIST_DIR OR FILAMENT_DIST_DIR STREQUAL "")
    message(FATAL_ERROR "FILAMENT_DIST_DIR must point to the extracted Filament Android native distribution")
endif()

set(FILAMENT_LIB_DIR "${FILAMENT_DIST_DIR}/lib/${ANDROID_ABI}")
set(FILAMENT_INCLUDE_DIR "${FILAMENT_DIST_DIR}/include")

add_library(slayer_filament_benchmark SHARED
    src/BridgeFFI.cpp
)

target_include_directories(slayer_filament_benchmark PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${FILAMENT_INCLUDE_DIR}
)

find_library(FILAMENT_LIB filament PATHS ${FILAMENT_LIB_DIR} NO_DEFAULT_PATH REQUIRED)
find_library(UTILS_LIB utils PATHS ${FILAMENT_LIB_DIR} NO_DEFAULT_PATH REQUIRED)

target_link_libraries(slayer_filament_benchmark
    ${FILAMENT_LIB}
    ${UTILS_LIB}
    android
    log
)

target_compile_definitions(slayer_filament_benchmark PRIVATE
    SLAYER_FILAMENT_BENCHMARK=1
)
