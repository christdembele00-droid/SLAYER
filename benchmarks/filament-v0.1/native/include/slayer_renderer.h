#pragma once

#include <cstdint>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct SlayerTransform {
    float x;
    float y;
    float z;
    float qx;
    float qy;
    float qz;
    float qw;
    uint32_t anim_id;
    float anim_time;
} SlayerTransform;

typedef struct SlayerFrameStats {
    float fps;
    float frame_ms;
    float p95_ms;
    uint32_t draw_calls;
    uint32_t triangles;
    uint32_t player_count;
} SlayerFrameStats;

void slayer_renderer_create(void* native_window);
void slayer_renderer_resize(uint32_t width, uint32_t height);
void slayer_renderer_set_players(const SlayerTransform* transforms, uint32_t count);
void slayer_renderer_render(float delta_seconds);
SlayerFrameStats slayer_renderer_stats(void);
void slayer_renderer_destroy(void);

#ifdef __cplusplus
}
#endif
