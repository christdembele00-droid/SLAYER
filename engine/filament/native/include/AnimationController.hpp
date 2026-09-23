#pragma once
#include <algorithm>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <gltfio/Animator.h>
namespace Slayer::Animation {
enum class PlayerAnimState:uint8_t{IDLE=0,WALK=1,RUN=2,KICK=3,TACKLE=4};
class AnimationController final{
public:
 explicit AnimationController(filament::gltfio::Animator*a=nullptr):m_animator(a){}
 void setAnimator(filament::gltfio::Animator*a){m_animator=a;m_state=PlayerAnimState::IDLE;m_clip=0;m_time=0;}
 void update(float speed,bool kick,bool tackle,float dt){
  if(!m_animator||m_animator->getAnimationCount()==0)return;const size_t n=m_animator->getAnimationCount();PlayerAnimState next=PlayerAnimState::IDLE;
  if(kick&&n>3)next=PlayerAnimState::KICK;else if(tackle&&n>4)next=PlayerAnimState::TACKLE;else if(speed>4.5f)next=PlayerAnimState::RUN;else if(speed>0.1f)next=PlayerAnimState::WALK;
  const size_t clip=std::min(static_cast<size_t>(next),n-1);if(next!=m_state||clip!=m_clip){m_state=next;m_clip=clip;m_time=0;}
  const float d=m_animator->getAnimationDuration(m_clip);m_time+=std::max(0.0f,dt);m_animator->applyAnimation(m_clip,d>0?std::fmod(m_time,d):0);m_animator->updateBoneMatrices();
 }
private:filament::gltfio::Animator*m_animator{};PlayerAnimState m_state{PlayerAnimState::IDLE};size_t m_clip{};float m_time{};
};
}