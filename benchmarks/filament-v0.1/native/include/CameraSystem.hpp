#pragma once
#include <algorithm>
#include <cmath>
#include <filament/Camera.h>
#include <filament/Engine.h>
#include <utils/EntityManager.h>
namespace Slayer::Camera {
class BroadcastCamera final {
public:
 explicit BroadcastCamera(filament::Engine* engine):m_engine(engine){
  if(!m_engine)return;
  m_entity=m_engine->getEntityManager().create();
  m_camera=m_engine->createCamera(m_entity);
 }
 ~BroadcastCamera(){if(!m_engine)return;if(m_camera)m_engine->destroyCameraComponent(m_entity);m_engine->getEntityManager().destroy(m_entity);}
 void setAspectRatio(float a){m_aspect=std::max(0.1f,a);}
 void update(float px,float py,float pz,float bx,float by,float bz,float dt){
  dt=std::clamp(dt,0.0f,0.05f);float kf=1.0f-std::exp(-8.0f*dt),kp=1.0f-std::exp(-6.0f*dt);
  const float fx=(px*0.65f+bx*0.35f),fy=(py*0.65f+by*0.35f),fz=(pz*0.65f+bz*0.35f);
  m_fx+= (fx-m_fx)*kf;m_fy+=(fy-m_fy)*kf;m_fz+=(fz-m_fz)*kf;
  const float tx=m_fx,ty=m_fy,tz=m_fz;const float cx=tx,cy=ty+18.0f,cz=tz+22.0f;
  m_cx+=(cx-m_cx)*kp;m_cy+=(cy-m_cy)*kp;m_cz+=(cz-m_cz)*kp;
  m_camera->lookAt({m_cx,m_cy,m_cz},{m_fx,m_fy,m_fz},{0.0f,1.0f,0.0f});
  const float dx=px-bx,dy=py-by,dz=pz-bz;const float dist=std::sqrt(dx*dx+dy*dy+dz*dz);
  const float target=std::clamp(45.0f+dist*0.5f,40.0f,60.0f);
  m_fov+=(target-m_fov)*(1.0f-std::exp(-4.0f*dt));
  m_camera->setProjection(m_fov,m_aspect,0.1,200.0,filament::Camera::Fov::VERTICAL);
 }
 filament::Camera* getCamera()const{return m_camera;}
private:
 filament::Engine* m_engine{};utils::Entity m_entity{};filament::Camera* m_camera{};
 float m_aspect{16.0f/9.0f},m_fov{45.0f},m_fx{},m_fy{},m_fz{},m_cx{},m_cy{18.0f},m_cz{22.0f};
};
}