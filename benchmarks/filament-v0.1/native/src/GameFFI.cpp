#include "slayer_input.h"
#include <algorithm>
static slayer::MatchEngine g_game;
static slayer::InputState g_input;
extern "C" void slayer_game_reset(){g_game.reset();}
extern "C" void slayer_game_update(float dt){g_game.setInput(g_input);g_game.update(dt);}
extern "C" void slayer_game_set_input(float x,float y,float pass,float shoot,float sprint,float tackle,int selected){
    g_input.moveX=x;g_input.moveY=y;g_input.pass=pass;g_input.shoot=shoot;g_input.sprint=sprint;g_input.tackle=tackle;
    if(selected>=0&&selected<22)g_input.selectedPlayer=selected;
}
extern "C" void slayer_game_get_transforms(SlayerTransform* out,uint32_t capacity){g_game.snapshot(out,capacity);}
extern "C" void slayer_game_get_score(uint32_t* home,uint32_t* away,uint32_t* seconds){
    const auto&s=g_game.state();if(home)*home=s.homeScore;if(away)*away=s.awayScore;if(seconds)*seconds=s.matchSeconds;
}
