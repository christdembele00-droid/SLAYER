#pragma once
#include <cstdint>
#include "slayer_game.h"
#ifdef __cplusplus
extern "C" {
#endif
void slayer_game_reset();
void slayer_game_update(float dt);
void slayer_game_set_input(float move_x,float move_y,float pass,float shoot,float sprint,float tackle,int selected);
void slayer_game_get_transforms(SlayerTransform* out,uint32_t capacity);
void slayer_game_get_score(uint32_t* home,uint32_t* away,uint32_t* seconds);
void slayer_game_set_settings(const slayer::SlayerSettings& settings);
#ifdef __cplusplus
}
#endif
