#pragma once
#include <cstdint>
#include "slayer_renderer.h"
#include "slayer_settings.h"

namespace slayer {

enum class MatchPhase : uint8_t { PreKickoff, FirstHalf, HalfTime, SecondHalf, ExtraTime, Penalties, FullTime };
enum class TacticalStyle : uint8_t { Balanced, Possession, Pressing, Counter, Defensive };

struct InputState {
    float moveX=0, moveY=0, pass=0, shoot=0, sprint=0, tackle=0;
    int selectedPlayer=0;
};

struct BallState {
    float x=0, y=0.22f, z=0;
    float vx=0, vy=0, vz=0;
    float spinX=0, spinY=0, spinZ=0;
    bool airborne=false;
};

struct PlayerState {
    float x=0,y=0.9f,z=0;
    float vx=0,vy=0,vz=0;
    float stamina=1;
    float speed=5.4f;
    float acceleration=16.0f;
    uint8_t team=0;
    uint8_t role=0;
    bool controlled=false;
    bool offside=false;
    bool carded=false;
};

struct MatchState {
    MatchPhase phase=MatchPhase::PreKickoff;
    TacticalStyle homeStyle=TacticalStyle::Balanced;
    TacticalStyle awayStyle=TacticalStyle::Balanced;
    PlayerState players[22]{};
    BallState ball{};
    uint32_t homeScore=0, awayScore=0;
    uint32_t matchSeconds=0;
    uint32_t fouls=0;
    uint32_t cards=0;
    uint32_t selected=0;
    bool paused=false;
};

class MatchEngine {
public:
    MatchEngine();
    void reset();
    void setInput(const InputState& input);
    void setSettings(const SlayerSettings& settings);
    const SlayerSettings& settings() const { return settings_; }
    void update(float dt);
    void snapshot(SlayerTransform* out, uint32_t capacity) const;
    const MatchState& state() const { return state_; }
private:
    void updateControlled(float dt);
    void updateAI(float dt);
    void updateBall(float dt);
    void resolveRules();
    void updateFatigue(float dt);
    void updateTactics();
    void setupTeams();
    MatchState state_{};
    InputState input_{};
    float secondAccumulator_=0;
    float fixedAccumulator_=0;
    float phaseAccumulator_=0;
    SlayerSettings settings_{};
};

} // namespace slayer
