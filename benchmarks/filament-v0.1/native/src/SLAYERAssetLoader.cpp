#include "SLAYERAssetLoader.hpp"
#include <android/log.h>
#include <filament/IndirectLight.h>
#include <filament/Skybox.h>
#include <image/Ktx1Bundle.h>
#include <ktxreader/Ktx1Reader.h>
#include <gltfio/materials/uberarchive.h>
namespace Slayer::Render {
static constexpr const char* TAG="SLAYER_ASSET";
SLAYERAssetLoader::SLAYERAssetLoader(filament::Engine* e,AAssetManager* a):m_engine(e),m_assetManager(a){
 if(!m_engine||!m_assetManager)return;
 m_materialProvider=gltfio::createUbershaderProvider(m_engine,UBERARCHIVE_DEFAULT_DATA,UBERARCHIVE_DEFAULT_SIZE);
 if(!m_materialProvider)return;
 m_gltfLoader=gltfio::AssetLoader::create({m_engine,m_materialProvider});
 gltfio::ResourceConfiguration cfg{};cfg.engine=m_engine;cfg.normalizeSkinningWeights=true;
 m_resourceLoader=new gltfio::ResourceLoader(cfg);m_stbDecoder=gltfio::createStbProvider(m_engine);
 if(m_stbDecoder){m_resourceLoader->addTextureProvider("image/png",m_stbDecoder);m_resourceLoader->addTextureProvider("image/jpeg",m_stbDecoder);m_resourceLoader->addTextureProvider("image/webp",m_stbDecoder);}
}
SLAYERAssetLoader::~SLAYERAssetLoader(){
 if(m_engine){if(m_skybox)m_engine->destroy(m_skybox);if(m_indirectLight)m_engine->destroy(m_indirectLight);if(m_skyboxTexture)m_engine->destroy(m_skyboxTexture);if(m_iblTexture)m_engine->destroy(m_iblTexture);}
 delete m_resourceLoader;delete m_stbDecoder;if(m_gltfLoader)gltfio::AssetLoader::destroy(&m_gltfLoader);
 if(m_materialProvider){m_materialProvider->destroyMaterials();delete m_materialProvider;}
}
bool SLAYERAssetLoader::readAsset(const std::string& p,std::vector<uint8_t>&o)const{
 o.clear();if(!m_assetManager)return false;AAsset*a=AAssetManager_open(m_assetManager,p.c_str(),AASSET_MODE_BUFFER);
 if(!a){__android_log_print(ANDROID_LOG_WARN,TAG,"Missing asset: %s",p.c_str());return false;}
 size_t n=static_cast<size_t>(AAsset_getLength(a));o.resize(n);int64_t r=AAsset_read(a,o.data(),n);AAsset_close(a);if(r!=static_cast<int64_t>(n)){o.clear();return false;}return true;
}
bool SLAYERAssetLoader::loadEnvironment(const std::string&p,filament::Scene*s){
 std::vector<uint8_t>d;if(!s||!readAsset(p,d))return false;image::Ktx1Bundle b(d.data(),static_cast<uint32_t>(d.size()));if(!b.isCubemap())return false;
 if(m_indirectLight){s->setIndirectLight(nullptr);m_engine->destroy(m_indirectLight);}if(m_iblTexture)m_engine->destroy(m_iblTexture);m_indirectLight=nullptr;m_iblTexture=nullptr;
 m_iblTexture=ktxreader::Ktx1Reader::createTexture(m_engine,&b,false);if(!m_iblTexture)return false;
 m_indirectLight=filament::IndirectLight::Builder().reflections(m_iblTexture).intensity(30000.0f).build(*m_engine);if(!m_indirectLight){m_engine->destroy(m_iblTexture);m_iblTexture=nullptr;return false;}s->setIndirectLight(m_indirectLight);return true;
}
bool SLAYERAssetLoader::loadSkybox(const std::string&p,filament::Scene*s){
 std::vector<uint8_t>d;if(!s||!readAsset(p,d))return false;image::Ktx1Bundle b(d.data(),static_cast<uint32_t>(d.size()));if(!b.isCubemap())return false;
 if(m_skybox){s->setSkybox(nullptr);m_engine->destroy(m_skybox);}if(m_skyboxTexture)m_engine->destroy(m_skyboxTexture);m_skybox=nullptr;m_skyboxTexture=nullptr;
 m_skyboxTexture=ktxreader::Ktx1Reader::createTexture(m_engine,&b,false);if(!m_skyboxTexture)return false;
 m_skybox=filament::Skybox::Builder().environment(m_skyboxTexture).showSun(true).intensity(30000.0f).build(*m_engine);if(!m_skybox){m_engine->destroy(m_skyboxTexture);m_skyboxTexture=nullptr;return false;}s->setSkybox(m_skybox);return true;
}
filament::Material* SLAYERAssetLoader::loadMaterial(const std::string&p){std::vector<uint8_t>d;if(!readAsset(p,d))return nullptr;return filament::Material::Builder().package(d.data(),d.size()).build(*m_engine);}
gltfio::FilamentAsset* SLAYERAssetLoader::loadGLB(const std::string&p){
 if(!m_gltfLoader||!m_resourceLoader)return nullptr;std::vector<uint8_t>d;if(!readAsset(p,d))return nullptr;
 auto*a=m_gltfLoader->createAsset(d.data(),static_cast<uint32_t>(d.size()));if(!a)return nullptr;if(!m_resourceLoader->loadResources(a)){m_gltfLoader->destroyAsset(a);return nullptr;}return a;
}
void SLAYERAssetLoader::destroyAsset(gltfio::FilamentAsset*&a){if(a&&m_gltfLoader)m_gltfLoader->destroyAsset(a);a=nullptr;}
}