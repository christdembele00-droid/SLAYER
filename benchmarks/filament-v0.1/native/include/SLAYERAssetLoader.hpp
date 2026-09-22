#pragma once
#include <android/asset_manager.h>
#include <cstdint>
#include <string>
#include <vector>
#include <filament/Engine.h>
#include <filament/Material.h>
#include <filament/Scene.h>
#include <gltfio/AssetLoader.h>
#include <gltfio/FilamentAsset.h>
#include <gltfio/MaterialProvider.h>
#include <gltfio/ResourceLoader.h>
#include <gltfio/TextureProvider.h>
namespace Slayer::Render {
class SLAYERAssetLoader final {
public:
    SLAYERAssetLoader(filament::Engine*, AAssetManager*);
    ~SLAYERAssetLoader();
    SLAYERAssetLoader(const SLAYERAssetLoader&) = delete;
    SLAYERAssetLoader& operator=(const SLAYERAssetLoader&) = delete;
    bool loadEnvironment(const std::string&, filament::Scene*);
    bool loadSkybox(const std::string&, filament::Scene*);
    filament::Material* loadMaterial(const std::string&);
    gltfio::FilamentAsset* loadGLB(const std::string&);
    void destroyAsset(gltfio::FilamentAsset*&);
private:
    bool readAsset(const std::string&, std::vector<uint8_t>&) const;
    filament::Engine* m_engine{};
    AAssetManager* m_assetManager{};
    gltfio::MaterialProvider* m_materialProvider{};
    gltfio::AssetLoader* m_gltfLoader{};
    gltfio::ResourceLoader* m_resourceLoader{};
    gltfio::TextureProvider* m_stbDecoder{};
    filament::Texture* m_iblTexture{};
    filament::Texture* m_skyboxTexture{};
    filament::IndirectLight* m_indirectLight{};
    filament::Skybox* m_skybox{};
};
}