#include "slayer_game.h"
#include <algorithm>
#include <cmath>

namespace slayer {
static float clampf(float v,float a,float b){return std::max(a,std::min(b,v));}
static float len(float x,float z){return std::sqrt(x*x+z*z);}
static float approach(float v,float target,float rate,float dt){
    float d=target-v, m=rate*dt;
    return v+(std::abs(d)<=m?d:(d>0?m:-m));
}

MatchEngine::MatchEngine(){ reset(); }

void MatchEngine::setSettings(const SlayerSettings& settings){ settings_=settings; input_.selectedPlayer=state_.selected; }


void MatchEngine::setupTeams(){
    // Original 4-3-3 match layout. Team 0 attacks +Z, team 1 attacks -Z.
    const float home[11][2]={{0,-27},{-9,-20},{-3,-22},{3,-22},{9,-20},{-10,-10},{0,-12},{10,-10},{-11,1},{0,0},{11,1}};
    for(int i=0;i<22;i++){
        int n=i%11; float x=home[n][0], z=home[n][1];
        if(i>=11) z=-z;
        state_.players[i]={x,0.9f,z,0,0,0,1,5.4f,16.0f,(uint8_t)(i>=11), (uint8_t)n,false,false,false};
    }
    state_.players[9].controlled=true;
}

void MatchEngine::reset(){
    state_=MatchState{};
    setupTeams();
    state_.ball={0,0.22f,0,0,0,0,0,0,0,false};
    state_.phase=MatchPhase::FirstHalf;
    state_.selected=9;
    input_.selectedPlayer=9;
    state_.selected=9;
    secondAccumulator_=fixedAccumulator_=0;
}

void MatchEngine::setInput(const InputState& input){
    input_=input;
    if(input_.selectedPlayer>=0 && input_.selectedPlayer<22){
        state_.selected=static_cast<uint32_t>(input_.selectedPlayer);
    }
    for(auto& p:state_.players) p.controlled=false;
    state_.players[state_.selected].controlled=true;
}

void MatchEngine::update(float dt){
    if(state_.paused || state_.phase==MatchPhase::FullTime) return;
    dt=clampf(dt,0.0f,0.05f);
    fixedAccumulator_+=dt;
    while(fixedAccumulator_>=0.008f){
        const float h=0.008f;
        updateControlled(h); updateAI(h); updateBall(h); updateFatigue(h); resolveRules();
        fixedAccumulator_-=h;
    }
    secondAccumulator_+=dt;
    if(secondAccumulator_>=1.0f){
        secondAccumulator_-=1.0f; state_.matchSeconds++;
            const uint32_t halfSeconds=static_cast<uint32_t>(std::max(1,settings_.durationMinutes)*60);
        if(state_.matchSeconds==halfSeconds) state_.phase=MatchPhase::HalfTime;
        if(state_.matchSeconds>=halfSeconds*2u){
            if(settings_.extraTime) state_.phase=MatchPhase::ExtraTime;
            else if(settings_.penalties) state_.phase=MatchPhase::Penalties;
            else state_.phase=MatchPhase::FullTime;
        }
        if(state_.phase==MatchPhase::ExtraTime && state_.matchSeconds>=halfSeconds*2u+30u*60u){
            if(settings_.penalties) state_.phase=MatchPhase::Penalties;
            else state_.phase=MatchPhase::FullTime;
        }
    }
    updateTactics();
}

void MatchEngine::updateControlled(float dt){
    uint32_t id=std::min<uint32_t>(state_.selected,21);
    auto &p=state_.players[id];
    p.controlled=true;
    float mx=clampf(input_.moveX,-1,1), mz=clampf(input_.moveY,-1,1);
    float sprint= input_.sprint>0.5f && p.stamina>0.08f ? 1.35f:1.0f;
    if(settings_.attack==TacticalMode::UltraDefensive) sprint*=0.94f;
    if(settings_.attack==TacticalMode::UltraOffensive) sprint*=1.06f;
    float targetX=mx*p.speed*sprint, targetZ=mz*p.speed*sprint;
    p.vx=approach(p.vx,targetX,p.acceleration,dt);
    p.vz=approach(p.vz,targetZ,p.acceleration,dt);
    p.x=clampf(p.x+p.vx*dt,-52.5f,52.5f);
    p.z=clampf(p.z+p.vz*dt,-34.0f,34.0f);
    float dx=state_.ball.x-p.x,dz=state_.ball.z-p.z;
    if(input_.tackle>0.5f){
        for(int i=0;i<22;i++){
            auto& opponent=state_.players[i];
            if(opponent.team==p.team) continue;
            const float odx=opponent.x-p.x, odz=opponent.z-p.z;
            if(len(odx,odz)<1.6f){
                const float inv=1.0f/std::max(0.001f,len(odx,odz));
                state_.ball.x=opponent.x + odx*0.25f;
                state_.ball.z=opponent.z + odz*0.25f;
                state_.ball.y=0.22f;
                state_.ball.vx=odx*inv*7.0f;
                state_.ball.vz=odz*inv*7.0f;
                state_.ball.vy=1.0f;
                opponent.vx*=0.35f;
                opponent.vz*=0.35f;
                break;
            }
        }
    }
    if(len(dx,dz)<1.45f){
        if(input_.pass>0.5f){
            const float assist=1.0f+0.08f*clampf(static_cast<float>(settings_.passAssist),0.0f,4.0f);
            state_.ball.vx=mx*18.0f*assist; state_.ball.vz=mz*18.0f*assist+4.0f; state_.ball.vy=1.4f;
        }
        if(input_.shoot>0.5f){
            float goalZ=(p.team==0?34.0f:-34.0f);
            float aim=(settings_.shotAssist==ShotAssistMode::Assisted)?1.12f:1.0f;
            state_.ball.vx=(state_.ball.x-p.x)*4*aim; state_.ball.vz=(goalZ-p.z)*1.7f*aim; state_.ball.vy=4.2f;
        }
    }
}

void MatchEngine::updateAI(float dt){
    for(int i=0;i<22;i++){
        auto &p=state_.players[i]; if(p.controlled) continue;
        float tx=p.x,tz=p.z;
        float bx=state_.ball.x,bz=state_.ball.z;
        bool own=p.team==(state_.ball.vz>=0?0:1);
        if(len(bx-p.x,bz-p.z)<18){tx=bx;tz=bz;}
        else {
            float attack=p.team==0?1:-1;
            tx += (bx-p.x)*0.10f;
            tz += attack*(2.0f+(i%3));
            if(!own) tz += -attack*2.0f;
        }
        p.vx=approach(p.vx,(tx-p.x)*1.2f,10,dt);
        p.vz=approach(p.vz,(tz-p.z)*1.2f,10,dt);
        float vmax=p.speed*(p.stamina>0.25f?1.0f:0.72f);
        float s=len(p.vx,p.vz); if(s>vmax){p.vx*=vmax/s;p.vz*=vmax/s;}
        p.x=clampf(p.x+p.vx*dt,-52.5f,52.5f);
        p.z=clampf(p.z+p.vz*dt,-34.0f,34.0f);
        if(len(bx-p.x,bz-p.z)<1.2f && p.team==(state_.ball.x>0?0:1)){
            state_.ball.vz=(p.team==0?10:-10); state_.ball.vy=1.0f;
        }
    }
}

void MatchEngine::updateBall(float dt){
    constexpr float g=-9.81f;
    state_.ball.vx*=std::pow(0.992f,dt*120); state_.ball.vz*=std::pow(0.992f,dt*120);
    state_.ball.vy+=g*dt;
    // Magnus term: spin bends the trajectory instead of using a canned animation.
    state_.ball.vx += state_.ball.spinY*state_.ball.vz*0.0015f*dt;
    state_.ball.vz -= state_.ball.spinY*state_.ball.vx*0.0015f*dt;
    state_.ball.x+=state_.ball.vx*dt; state_.ball.y+=state_.ball.vy*dt; state_.ball.z+=state_.ball.vz*dt;
    if(state_.ball.y<0.22f){
        state_.ball.y=0.22f;
        if(std::abs(state_.ball.vy)>1) state_.ball.vy=-state_.ball.vy*0.48f;
        else { state_.ball.vy=0; state_.ball.airborne=false; }
    }
    if(std::abs(state_.ball.x)>52.5f){state_.ball.x=clampf(state_.ball.x,-52.5f,52.5f);state_.ball.vx=-state_.ball.vx*0.65f;}
    if(std::abs(state_.ball.z)>34.0f){
        const bool goalMouth=std::abs(state_.ball.x)<3.66f && state_.ball.y<2.44f;
        const bool crossedGoalLine=std::abs(state_.ball.z)>=34.0f;
        if(crossedGoalLine && goalMouth && std::abs(state_.ball.vz)>0.2f){
            if((state_.ball.z>0 && state_.ball.vz>0) || (state_.ball.z<0 && state_.ball.vz<0)){
                if(state_.ball.z>0) ++state_.homeScore; else ++state_.awayScore;
                state_.ball={0,0.22f,0,0,0,0,0,0,0,false};
                state_.selected=9;
                for(auto& p:state_.players) p.controlled=false;
                state_.players[9].controlled=true;
                return;
            }
        }
        state_.ball.z=clampf(state_.ball.z,-34.0f,34.0f);
        state_.ball.vz=-state_.ball.vz*0.65f;
    }
}

void MatchEngine::updateFatigue(float dt){
    for(auto &p:state_.players){
        float effort=std::min(1.0f,std::sqrt(p.vx*p.vx+p.vz*p.vz)/p.speed);
        p.stamina=clampf(p.stamina-dt*(0.0009f+effort*0.0018f),0.08f,1.0f);
        if(effort<0.12f) p.stamina=clampf(p.stamina+dt*0.0008f,0.08f,1.0f);
    }
}

void MatchEngine::updateTactics(){
    // Dynamic tactical block: pressing expands the active defensive radius.
    if(state_.homeStyle==TacticalStyle::Pressing){
        for(int i=0;i<11;i++) if(!state_.players[i].controlled) state_.players[i].speed=5.8f;
    }
    if(state_.awayStyle==TacticalStyle::Defensive){
        for(int i=11;i<22;i++) state_.players[i].speed=5.0f;
    }
}

void MatchEngine::resolveRules(){
    // Compact offside model: attackers cannot remain beyond the second-last
    // opponent while the ball is played forward.
    for(int team=0;team<2;team++){
        float attackZ=team==0?1.0f:-1.0f;
        float secondLast=team==0?34.0f:-34.0f;
        float keeperLine=secondLast;
        float second=secondLast;
        for(int i=0;i<22;i++) if(state_.players[i].team!=team){
            float z=state_.players[i].z*attackZ;
            if(z>keeperLine){second=keeperLine;keeperLine=z;}
        }
        (void)second;
        for(int i=0;i<22;i++) if(state_.players[i].team==team && i%11!=9){
            state_.players[i].offside=(state_.players[i].z*attackZ>second+0.2f && state_.ball.z*attackZ<state_.players[i].z*attackZ);
        }
    }
}

void MatchEngine::snapshot(SlayerTransform* out,uint32_t capacity) const{
    if(!out)return;
    uint32_t n=std::min<uint32_t>(capacity,22);
    for(uint32_t i=0;i<n;i++){
        const auto&p=state_.players[i];
        out[i]={p.x,p.y,p.z,0,0,0,1,0,0};
    }
}
} // namespace slayer
