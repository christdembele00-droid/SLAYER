#pragma once
#include <cstdint>
#include <array>
namespace slayer {
struct PlayerAttributes { float speed=1, acceleration=1, stamina=1, passing=1, shooting=1, dribbling=1, defending=1, strength=1, goalkeeping=1; };
struct TacticalPlan { int formation=433; float defensiveLine=0.5f, pressing=0.5f, width=0.5f, tempo=0.5f; bool offsideTrap=false, counterAttack=false; };
struct TeamState { std::array<PlayerAttributes,11> players{}; TacticalPlan tactics{}; };
struct GameplaySystems {
 bool dribbling=true, firstTouch=true, passing=true, shooting=true, heading=true, tackles=true, interceptions=true;
 bool fouls=true, cards=true, penalties=true, freeKicks=true, corners=true, throwIns=true, advantage=true;
 bool injuries=true, substitutions=true, extraTime=true, shootout=true;
 bool goalkeeperAI=true, teamAI=true, dynamicTactics=true, replay=true, broadcastCamera=true;
 bool weather=true, wetPitch=true, crowdSimulation=true, commentaryHooks=true;
};
}