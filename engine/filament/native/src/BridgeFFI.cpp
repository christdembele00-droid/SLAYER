#include "slayer_renderer.h"
#include "slayer_input.h"
#include "slayer_settings.h"
#include "slayer_render_quality.h"
#include "AnimationController.hpp"
#include "CameraSystem.hpp"
#include "SLAYERAssetLoader.hpp"

#include <android/native_window.h>
#include <android/native_window_jni.h>
#include <android/log.h>
#include <jni.h>

#include <gltfio/AssetLoader.h>
#include <gltfio/Animator.h>
#include <gltfio/FilamentAsset.h>
#include <gltfio/FilamentInstance.h>
#include <gltfio/MaterialProvider.h>
#include <gltfio/ResourceLoader.h>
#include <gltfio/TextureProvider.h>
#include <gltfio/materials/uberarchive.h>

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <memory>
#include <vector>
#include <atomic>

#include <filament/Camera.h>
#include <filament/IndirectLight.h>
#include <filament/Skybox.h>
#include <filament/ColorGrading.h>
#include <filament/ToneMapper.h>
#include <filament/Engine.h>
#include <filament/IndexBuffer.h>
#include <filament/Material.h>
#include <filament/RenderableManager.h>
#include <filament/Renderer.h>
#include <filament/Scene.h>
#include <filament/SwapChain.h>
#include <filament/VertexBuffer.h>
#include <filament/View.h>
#include <filament/Viewport.h>
#include <filament/TransformManager.h>
#include <filament/TextureSampler.h>
#include <math/mat4.h>
#include <filament/LightManager.h>
#include <utils/EntityManager.h>
#include <image/Ktx1Bundle.h>
#include <ktxreader/Ktx1Reader.h>

namespace {

using namespace filament;
using namespace utils;
using Clock = std::chrono::steady_clock;

struct NativeRenderer {
    Engine* engine = nullptr;
    Renderer* renderer = nullptr;
    SwapChain* swapChain = nullptr;
    View* view = nullptr;
    Scene* scene = nullptr;
    Camera* camera = nullptr;
    ColorGrading* colorGrading = nullptr;
    ACESToneMapper acesToneMapper{};
    std::unique_ptr<Slayer::Camera::BroadcastCamera> broadcastCamera;
    std::vector<std::unique_ptr<Slayer::Animation::AnimationController>> animationControllers;

    Entity cameraEntity{};
    Entity meshEntity{};
    Entity terrainEntity{};
    Entity sunEntity{};
    Entity floodlightEntities[4]{};
    IndirectLight* indirectLight = nullptr;
    Skybox* skybox = nullptr;
    Texture* environmentTexture = nullptr;
    Texture* skyboxTexture = nullptr;
    VertexBuffer* vertexBuffer = nullptr;
    IndexBuffer* indexBuffer = nullptr;
    VertexBuffer* terrainVertexBuffer = nullptr;
    VertexBuffer* terrainUvBuffer = nullptr;
    VertexBuffer* terrainTangentBuffer = nullptr;
    IndexBuffer* terrainIndexBuffer = nullptr;
    Material* material = nullptr;
    MaterialInstance* materialInstance = nullptr;
    Material* terrainMaterial = nullptr;
    MaterialInstance* terrainMaterialInstance = nullptr;
    Texture* terrainBaseColor = nullptr;
    Texture* terrainNormal = nullptr;
    Texture* terrainRoughness = nullptr;
    Entity weatherEntity{};
    VertexBuffer* weatherVertexBuffer = nullptr;
    IndexBuffer* weatherIndexBuffer = nullptr;
    MaterialInstance* weatherMaterialInstance = nullptr;
    float weatherTime = 0.0f;

    gltfio::MaterialProvider* gltfMaterials = nullptr;
    gltfio::AssetLoader* assetLoader = nullptr;
    gltfio::ResourceLoader* resourceLoader = nullptr;
    gltfio::TextureProvider* stbDecoder = nullptr;
    gltfio::FilamentAsset* playerAsset = nullptr;
    gltfio::FilamentAsset* stadiumAsset = nullptr;
    gltfio::FilamentAsset* ballAsset = nullptr;
    gltfio::FilamentAsset* goalAsset = nullptr;
    std::vector<gltfio::FilamentInstance*> playerInstances;
    std::vector<gltfio::FilamentInstance*> goalInstances;
    slayer::SlayerSettings settings{};
    float playerAnimationTime = 0.0f;
    uint32_t playerAnimationIndex = 0;

    ANativeWindow* window = nullptr;
    uint32_t width = 1;
    uint32_t height = 1;

    SlayerFrameStats stats{};
    Clock::time_point lastFrame = Clock::now();
    std::vector<float> history;

    static constexpr uint32_t MAX_PLAYERS = 64;
    struct PlayerBuffer {
        SlayerTransform transforms[MAX_PLAYERS]{};
        uint32_t count = 0;
    };
    PlayerBuffer playerBuffers[3]{};
    std::atomic<uint32_t> publishedPlayerBuffer{0};
    std::atomic<uint32_t> renderReadingBuffer{0xffffffffu};
    uint32_t writerBuffer = 1;
    uint32_t playerBoneCount = 0;
    float previousPlayerX[MAX_PLAYERS]{};
    float previousPlayerZ[MAX_PLAYERS]{};
    float playerAnimationAccumulator[MAX_PLAYERS]{};
    uint32_t renderFrameIndex = 0;
    bool havePreviousPlayers = false;

    void applyWeatherVisuals() {
        if (!engine || !weatherEntity) return;
        auto& rm = engine->getRenderableManager();
        if (!rm.hasComponent(weatherEntity)) return;
        auto& tm = engine->getTransformManager();
        auto ti = tm.getInstance(weatherEntity);
        if (settings.weather == slayer::WeatherMode::Clear) {
            tm.setTransform(ti, filament::math::mat4f::translation(filament::math::float3{0.0f, -100.0f, 0.0f}));
        } else {
            const float y = -1.0f + std::fmod(weatherTime * (settings.weather == slayer::WeatherMode::Rain ? 5.5f : 1.2f), 12.0f);
            tm.setTransform(ti, filament::math::mat4f::translation(filament::math::float3{0.0f, y, 0.0f}));
        }
    }

    void applySettings() {
        if (!engine || !view || !camera || !renderer) return;

        // Conservative Android startup path. Keep Vulkan scene creation and
        // camera/light setup independent from optional post-processing features;
        // unsupported combinations of GTAO/TAA/bloom on mobile drivers must not
        // be able to terminate the match before its first frame.
        const bool night = settings.time == slayer::TimeMode::Night;
        const bool twilight = settings.time == slayer::TimeMode::Twilight;
        auto& lm = engine->getLightManager();

        if (lm.hasComponent(sunEntity)) {
            auto li = lm.getInstance(sunEntity);
            lm.setIntensity(li, night ? 9000.0f : twilight ? 38000.0f : 90000.0f);
        }
        for (Entity e : floodlightEntities) if (lm.hasComponent(e)) {
            auto li = lm.getInstance(e);
            lm.setIntensity(li, night ? 36000.0f : twilight ? 22000.0f : 12000.0f);
        }

        switch(settings.camera) {
            case slayer::CameraMode::Broadcast:
                if (broadcastCamera) view->setCamera(broadcastCamera->getCamera());
                break;
            case slayer::CameraMode::Dynamic:
            case slayer::CameraMode::Overview:
            case slayer::CameraMode::Pro:
            case slayer::CameraMode::Custom:
                view->setCamera(camera);
                break;
        }

        if (settings.camera == slayer::CameraMode::Overview) {
            camera->lookAt({0.0,30.0,2.0},{0.0,0.0,0.0});
        } else if (settings.camera == slayer::CameraMode::Pro) {
            camera->lookAt({0.0,5.0,11.5},{0.0,1.0,0.0});
        } else if (settings.camera == slayer::CameraMode::Custom) {
            camera->lookAt({6.0,9.0,14.0},{0.0,1.0,0.0});
        } else if (settings.camera == slayer::CameraMode::Dynamic) {
            camera->lookAt({0.0,8.5,15.5},{0.0,1.0,0.0});
        }

        applyWeatherVisuals();
    }

    void setSettings(const slayer::SlayerSettings& next) {
        settings = next;
        if (engine) applySettings();
    }

    bool initialize(ANativeWindow* nativeWindow) {
        window = nativeWindow;
        if (!window) return false;

        // SLAYER is Vulkan-only. Filament owns the graphics backend;
        // OpenGL ES is deliberately not a production fallback.
        engine = Engine::create(Engine::Backend::VULKAN);
        if (!engine) {
            __android_log_print(ANDROID_LOG_ERROR, "SLAYER",
                "Filament Vulkan backend could not be created");
            return false;
        }

        swapChain = engine->createSwapChain(window);
        renderer = engine->createRenderer();
        view = engine->createView();
        scene = engine->createScene();

        if (!swapChain || !renderer || !view || !scene) return false;

        cameraEntity = engine->getEntityManager().create();
        camera = engine->createCamera(cameraEntity);
        broadcastCamera = std::make_unique<Slayer::Camera::BroadcastCamera>(engine);
        view->setScene(scene);
        view->setCamera(camera);

        // Keep first-frame Android startup deliberately minimal. Advanced
        // post-processing and dynamic-resolution settings are enabled only
        // after the basic Vulkan renderer is stable.
        view->setPostProcessingEnabled(false);

        camera->setProjection(
            45.0,
            1.0,
            0.1, 200.0,
            Camera::Fov::VERTICAL);
        camera->lookAt(
            {0.0f, 6.0f, 12.0f},
            {0.0f, 1.0f, 0.0f},
            {0.0f, 1.0f, 0.0f});
        broadcastCamera->setAspectRatio(1.0f);

        // Stadium-style ground plane for the first PBR lighting milestone.
        static constexpr float terrainVertices[] = {
            -52.5f, 0.0f, -34.0f,
             52.5f, 0.0f, -34.0f,
             52.5f, 0.0f,  34.0f,
            -52.5f, 0.0f,  34.0f
        };
        static constexpr float terrainUv[] = {
            0.0f, 0.0f,
            21.0f, 0.0f,
            21.0f, 13.6f,
            0.0f, 13.6f
        };
        static constexpr float terrainTangents[] = {
            1.0f, 0.0f, 0.0f, 1.0f,
            1.0f, 0.0f, 0.0f, 1.0f,
            1.0f, 0.0f, 0.0f, 1.0f,
            1.0f, 0.0f, 0.0f, 1.0f
        };
        static constexpr uint16_t terrainIndices[] = {0, 1, 2, 0, 2, 3};

        terrainVertexBuffer = VertexBuffer::Builder()
            .vertexCount(4)
            .bufferCount(3)
            .attribute(VertexAttribute::POSITION, 0,
                       VertexBuffer::AttributeType::FLOAT3)
            .attribute(VertexAttribute::UV0, 1,
                       VertexBuffer::AttributeType::FLOAT2)
            .attribute(VertexAttribute::TANGENTS, 2,
                       VertexBuffer::AttributeType::FLOAT4)
            .build(*engine);

        terrainUvBuffer = terrainVertexBuffer;
        terrainTangentBuffer = terrainVertexBuffer;

        terrainIndexBuffer = IndexBuffer::Builder()
            .indexCount(6)
            .bufferType(IndexBuffer::IndexType::USHORT)
            .build(*engine);

        if (!terrainVertexBuffer || !terrainIndexBuffer) return false;

        terrainVertexBuffer->setBufferAt(
            *engine, 0,
            VertexBuffer::BufferDescriptor(
                terrainVertices, sizeof(terrainVertices), nullptr));
        terrainVertexBuffer->setBufferAt(
            *engine, 1,
            VertexBuffer::BufferDescriptor(
                terrainUv, sizeof(terrainUv), nullptr));
        terrainVertexBuffer->setBufferAt(
            *engine, 2,
            VertexBuffer::BufferDescriptor(
                terrainTangents, sizeof(terrainTangents), nullptr));
        terrainIndexBuffer->setBuffer(
            *engine,
            IndexBuffer::BufferDescriptor(
                terrainIndices, sizeof(terrainIndices), nullptr));

        terrainEntity = engine->getEntityManager().create();
        scene->addEntity(terrainEntity);

        // Lightweight native weather pass: real line geometry is used instead of a UI placeholder.
        static constexpr float weatherVertices[] = {
            -10.0f, 11.0f, -7.0f, -10.0f,  9.0f, -7.0f,
             -5.0f, 12.0f, -2.0f,  -5.0f, 10.0f, -2.0f,
              0.0f, 11.5f,  3.0f,   0.0f,  9.5f,  3.0f,
              5.0f, 12.0f,  6.0f,   5.0f, 10.0f,  6.0f,
              9.0f, 10.5f, -5.0f,   9.0f,  8.5f, -5.0f
        };
        static constexpr uint16_t weatherIndices[] = {0,1,2,3,4,5,6,7,8,9};
        weatherVertexBuffer = VertexBuffer::Builder().vertexCount(10).bufferCount(1)
            .attribute(VertexAttribute::POSITION,0,VertexBuffer::AttributeType::FLOAT3).build(*engine);
        weatherIndexBuffer = IndexBuffer::Builder().indexCount(10).bufferType(IndexBuffer::IndexType::USHORT).build(*engine);
        weatherEntity = engine->getEntityManager().create();
        if (weatherVertexBuffer && weatherIndexBuffer) {
            weatherVertexBuffer->setBufferAt(*engine,0,VertexBuffer::BufferDescriptor(weatherVertices,sizeof(weatherVertices),nullptr));
            weatherIndexBuffer->setBuffer(*engine,IndexBuffer::BufferDescriptor(weatherIndices,sizeof(weatherIndices),nullptr));
            weatherMaterialInstance = material ? material->createInstance() : nullptr;
            if (weatherMaterialInstance) {
                RenderableManager::Builder(1).boundingBox({{-12,-2,-8},{12,14,8}})
                    .material(0,weatherMaterialInstance)
                    .geometry(0,RenderableManager::PrimitiveType::LINES,weatherVertexBuffer,weatherIndexBuffer,0,10)
                    .culling(false).castShadows(false).build(*engine,weatherEntity);
                scene->addEntity(weatherEntity);
            }
        }

        // One dominant stadium key light for this first lighting milestone.
        sunEntity = engine->getEntityManager().create();

        LightManager::Builder(LightManager::Type::SUN)
            .color({1.0f, 0.94f, 0.88f})
            .intensity(90000.0f)
            .direction({0.45f, -0.85f, -0.35f})
            .sunAngularRadius(1.0f)
            .castShadows(true)
            .build(*engine, sunEntity);

        scene->addEntity(sunEntity);

        // Four stadium floodlights. They provide the night-stadium lighting
        // foundation while remaining cheap enough for the mobile benchmark.
        const float lightPositions[4][3] = {
            {-10.0f, 7.0f, -6.0f}, {10.0f, 7.0f, -6.0f},
            {-10.0f, 7.0f,  6.0f}, {10.0f, 7.0f,  6.0f}
        };
        const float lightDirections[4][3] = {
            { 0.45f, -0.80f,  0.35f}, {-0.45f, -0.80f,  0.35f},
            { 0.45f, -0.80f, -0.35f}, {-0.45f, -0.80f, -0.35f}
        };
        for (int i = 0; i < 4; ++i) {
            floodlightEntities[i] = engine->getEntityManager().create();
            LightManager::Builder(LightManager::Type::SPOT)
                .color({0.92f, 0.97f, 1.0f})
                .intensity(18000.0f)
                .position({lightPositions[i][0], lightPositions[i][1], lightPositions[i][2]})
                .direction({lightDirections[i][0], lightDirections[i][1], lightDirections[i][2]})
                .spotLightCone(0.45f, 0.75f)
                .castShadows(true)
                .build(*engine, floodlightEntities[i]);
            scene->addEntity(floodlightEntities[i]);
        }

        setSize(1, 1);
        lastFrame = Clock::now();
        return true;
    }

    bool loadEnvironmentKtx(const uint8_t* bytes, size_t size) {
        if (!engine || !scene || !bytes || size < 16) return false;
        image::Ktx1Bundle bundle(bytes, static_cast<uint32_t>(size));
        if (!bundle.isCubemap()) return false;

        if (indirectLight) {
            scene->setIndirectLight(nullptr);
            engine->destroy(indirectLight);
            indirectLight = nullptr;
        }
        if (environmentTexture) {
            engine->destroy(environmentTexture);
            environmentTexture = nullptr;
        }

        environmentTexture = ktxreader::Ktx1Reader::createTexture(engine, &bundle, false);
        if (!environmentTexture) return false;

        indirectLight = filament::IndirectLight::Builder()
            .reflections(environmentTexture)
            .intensity(30000.0f)
            .build(*engine);

        if (!indirectLight) {
            engine->destroy(environmentTexture);
            environmentTexture = nullptr;
            return false;
        }

        scene->setIndirectLight(indirectLight);
        return true;
    }

    bool loadSkyboxKtx(const uint8_t* bytes, size_t size) {
        if (!engine || !scene || !bytes || size < 16) return false;
        image::Ktx1Bundle bundle(bytes, static_cast<uint32_t>(size));
        if (!bundle.isCubemap()) return false;

        if (skybox) {
            scene->setSkybox(nullptr);
            engine->destroy(skybox);
            skybox = nullptr;
        }
        if (skyboxTexture) {
            engine->destroy(skyboxTexture);
            skyboxTexture = nullptr;
        }

        skyboxTexture = ktxreader::Ktx1Reader::createTexture(engine, &bundle, false);
        if (!skyboxTexture) return false;

        skybox = filament::Skybox::Builder()
            .environment(skyboxTexture)
            .showSun(true)
            .intensity(30000.0f)
            .build(*engine);

        if (!skybox) {
            engine->destroy(skyboxTexture);
            skyboxTexture = nullptr;
            return false;
        }

        scene->setSkybox(skybox);
        return true;
    }

    bool loadTerrainMaterial(const uint8_t* bytes, size_t size) {
        if (!engine || !bytes || size == 0 || !terrainEntity) return false;

        Material* next = Material::Builder()
            .package(bytes, size)
            .build(*engine);
        if (!next) return false;

        MaterialInstance* nextInstance = next->createInstance();
        if (!nextInstance) {
            engine->destroy(next);
            return false;
        }

        auto& rm = engine->getRenderableManager();
        if (rm.hasComponent(terrainEntity)) {
            auto instance = rm.getInstance(terrainEntity);
            rm.setMaterialInstanceAt(instance, 0, nextInstance);
        } else if (terrainEntity && terrainVertexBuffer && terrainIndexBuffer) {
            const auto built = RenderableManager::Builder(1)
                .boundingBox({{-52.5f, -0.05f, -34.0f}, {52.5f, 0.05f, 34.0f}})
                .material(0, nextInstance)
                .geometry(0, RenderableManager::PrimitiveType::TRIANGLES,
                          terrainVertexBuffer, terrainIndexBuffer, 0, 6)
                .culling(false)
                .castShadows(false)
                .receiveShadows(true)
                .build(*engine, terrainEntity);
            if (!built) {
                engine->destroy(nextInstance);
                engine->destroy(next);
                return false;
            }
        }

        if (terrainBaseColor) engine->destroy(terrainBaseColor);
        if (terrainNormal) engine->destroy(terrainNormal);
        if (terrainRoughness) engine->destroy(terrainRoughness);
        terrainBaseColor = nullptr;
        terrainNormal = nullptr;
        terrainRoughness = nullptr;
        if (terrainMaterialInstance) engine->destroy(terrainMaterialInstance);
        if (terrainMaterial) engine->destroy(terrainMaterial);

        terrainMaterial = next;
        terrainMaterialInstance = nextInstance;
        return true;
    }

    Texture* decodePngTexture(const uint8_t* bytes, size_t size, bool srgb) {
        if (!engine || !bytes || size == 0) return nullptr;
        if (!stbDecoder) {
            stbDecoder = gltfio::createStbProvider(engine);
            if (!stbDecoder) return nullptr;
        }

        // Flush any completed textures left by an earlier asynchronous decode.
        stbDecoder->updateQueue();
        while (stbDecoder->popTexture() != nullptr) {}

        const auto flags = srgb
            ? gltfio::TextureProvider::TextureFlags::sRGB
            : gltfio::TextureProvider::TextureFlags::NONE;
        Texture* texture = stbDecoder->pushTexture(
            bytes, size, "image/png", flags);
        if (!texture) return nullptr;

        stbDecoder->waitForCompletion();
        stbDecoder->updateQueue();

        Texture* completed = nullptr;
        while ((completed = stbDecoder->popTexture()) != nullptr) {
            if (completed == texture) return texture;
        }

        engine->destroy(texture);
        return nullptr;
    }

    bool loadTerrainTextures(
            const uint8_t* baseColor, size_t baseColorSize,
            const uint8_t* normal, size_t normalSize,
            const uint8_t* roughness, size_t roughnessSize) {
        if (!engine || !terrainMaterialInstance) return false;

        Texture* nextBaseColor = decodePngTexture(baseColor, baseColorSize, true);
        Texture* nextNormal = decodePngTexture(normal, normalSize, false);
        Texture* nextRoughness = decodePngTexture(roughness, roughnessSize, false);
        if (!nextBaseColor || !nextNormal || !nextRoughness) {
            if (nextBaseColor) engine->destroy(nextBaseColor);
            if (nextNormal) engine->destroy(nextNormal);
            if (nextRoughness) engine->destroy(nextRoughness);
            return false;
        }

        TextureSampler sampler(
            TextureSampler::MinFilter::LINEAR_MIPMAP_LINEAR,
            TextureSampler::MagFilter::LINEAR,
            TextureSampler::WrapMode::REPEAT);
        sampler.setAnisotropy(8.0f);

        terrainMaterialInstance->setParameter("baseColor", nextBaseColor, sampler);
        terrainMaterialInstance->setParameter("normal", nextNormal, sampler);
        terrainMaterialInstance->setParameter("roughness", nextRoughness, sampler);
        terrainMaterialInstance->setParameter("roughnessScale", 1.0f);

        if (terrainBaseColor) engine->destroy(terrainBaseColor);
        if (terrainNormal) engine->destroy(terrainNormal);
        if (terrainRoughness) engine->destroy(terrainRoughness);
        terrainBaseColor = nextBaseColor;
        terrainNormal = nextNormal;
        terrainRoughness = nextRoughness;
        return true;
    }

    bool loadUbershaderArchive() {
        if (!engine) return false;

        if (gltfMaterials) {
            gltfMaterials->destroyMaterials();
            delete gltfMaterials;
            gltfMaterials = nullptr;
        }

        gltfMaterials = gltfio::createUbershaderProvider(
            engine,
            UBERARCHIVE_DEFAULT_DATA,
            UBERARCHIVE_DEFAULT_SIZE);
        return gltfMaterials != nullptr;
    }

    bool loadStadiumGlb(const uint8_t* bytes, size_t size) {
        if (!engine || !bytes || size == 0 || !gltfMaterials) return false;
        if (!assetLoader) assetLoader = gltfio::AssetLoader::create({engine, gltfMaterials});
        if (!assetLoader) return false;

        if (stadiumAsset) {
            scene->removeEntities(stadiumAsset->getEntities(), stadiumAsset->getEntityCount());
            assetLoader->destroyAsset(stadiumAsset);
            stadiumAsset = nullptr;
        }

        stadiumAsset = assetLoader->createAsset(bytes, static_cast<uint32_t>(size));
        if (!stadiumAsset) return false;

        if (!resourceLoader) {
            gltfio::ResourceConfiguration config{};
            config.engine = engine;
            config.normalizeSkinningWeights = true;
            resourceLoader = new gltfio::ResourceLoader(config);
            stbDecoder = gltfio::createStbProvider(engine);
            if (stbDecoder) {
                resourceLoader->addTextureProvider("image/png", stbDecoder);
                resourceLoader->addTextureProvider("image/jpeg", stbDecoder);
            }
        }

        if (!resourceLoader->loadResources(stadiumAsset)) {
            assetLoader->destroyAsset(stadiumAsset);
            stadiumAsset = nullptr;
            return false;
        }

        scene->addEntities(stadiumAsset->getEntities(), stadiumAsset->getEntityCount());
        return true;
    }

    bool loadBallGlb(const uint8_t* bytes, size_t size) {
        if (!engine || !bytes || size == 0 || !gltfMaterials) return false;
        if (!assetLoader) assetLoader = gltfio::AssetLoader::create({engine, gltfMaterials});
        if (!assetLoader) return false;

        if (ballAsset) {
            if (scene) scene->removeEntities(ballAsset->getEntities(), ballAsset->getEntityCount());
            assetLoader->destroyAsset(ballAsset);
            ballAsset = nullptr;
        }

        ballAsset = assetLoader->createAsset(bytes, static_cast<uint32_t>(size));
        if (!ballAsset) return false;

        if (!resourceLoader) {
            gltfio::ResourceConfiguration config{};
            config.engine = engine;
            config.normalizeSkinningWeights = true;
            resourceLoader = new gltfio::ResourceLoader(config);
            stbDecoder = gltfio::createStbProvider(engine);
            if (stbDecoder) {
                resourceLoader->addTextureProvider("image/png", stbDecoder);
                resourceLoader->addTextureProvider("image/jpeg", stbDecoder);
                resourceLoader->addTextureProvider("image/webp", stbDecoder);
            }
        }

        if (!resourceLoader->loadResources(ballAsset)) {
            assetLoader->destroyAsset(ballAsset);
            ballAsset = nullptr;
            return false;
        }

        scene->addEntities(ballAsset->getEntities(), ballAsset->getEntityCount());
        return true;
    }

    bool loadGoalGlb(const uint8_t* bytes, size_t size) {
        if (!engine || !bytes || size == 0 || !gltfMaterials) return false;
        if (!assetLoader) assetLoader = gltfio::AssetLoader::create({engine, gltfMaterials});
        if (!assetLoader) return false;

        if (goalAsset) {
            if (scene) {
                for (auto* instance : goalInstances) {
                    if (instance) scene->removeEntities(instance->getEntities(), instance->getEntityCount());
                }
            }
            assetLoader->destroyAsset(goalAsset);
            goalAsset = nullptr;
            goalInstances.clear();
        }

        goalInstances.clear();
        goalInstances.reserve(2);

        // Build and load the source asset before creating the second goal
        // instance, matching gltfio's resource lifecycle.
        goalAsset = assetLoader->createAsset(bytes, static_cast<uint32_t>(size));
        if (!goalAsset) return false;

        if (!resourceLoader) {
            gltfio::ResourceConfiguration config{};
            config.engine = engine;
            config.normalizeSkinningWeights = true;
            resourceLoader = new gltfio::ResourceLoader(config);
            stbDecoder = gltfio::createStbProvider(engine);
            if (stbDecoder) {
                resourceLoader->addTextureProvider("image/png", stbDecoder);
                resourceLoader->addTextureProvider("image/jpeg", stbDecoder);
                resourceLoader->addTextureProvider("image/webp", stbDecoder);
            }
        }

        if (!resourceLoader->loadResources(goalAsset)) {
            assetLoader->destroyAsset(goalAsset);
            goalAsset = nullptr;
            goalInstances.clear();
            return false;
        }

        goalInstances.push_back(goalAsset->getInstance());
        auto* secondGoal = assetLoader->createInstance(goalAsset);
        if (!secondGoal) {
            goalInstances.clear();
            assetLoader->destroyAsset(goalAsset);
            goalAsset = nullptr;
            return false;
        }
        goalInstances.push_back(secondGoal);

        for (auto* instance : goalInstances) {
            if (instance) scene->addEntities(instance->getEntities(), instance->getEntityCount());
        }
        return true;
    }

    bool loadPlayerGlb(const uint8_t* bytes, size_t size) {
        if (!engine || !bytes || size == 0 || !gltfMaterials) return false;

        if (!assetLoader) {
            assetLoader = gltfio::AssetLoader::create({engine, gltfMaterials});
        }
        if (!assetLoader) return false;

        // Replace an already loaded player cleanly.
        if (playerAsset) {
            if (scene) {
                for (auto* instance : playerInstances) {
                if (instance) scene->removeEntities(instance->getEntities(), instance->getEntityCount());
            }
            }
            assetLoader->destroyAsset(playerAsset);
            playerAsset = nullptr;
            playerInstances.clear();
            animationControllers.clear();
        }

        playerInstances.clear();
        playerInstances.reserve(22);

        // Build and fully load the source asset before creating additional
        // instances. gltfio expects resources to be finalized before instances
        // are used by the renderer.
        playerAsset = assetLoader->createAsset(bytes, static_cast<uint32_t>(size));
        if (!playerAsset) return false;

        if (!resourceLoader) {
            gltfio::ResourceConfiguration config{};
            config.engine = engine;
            config.normalizeSkinningWeights = true;
            resourceLoader = new gltfio::ResourceLoader(config);

            stbDecoder = gltfio::createStbProvider(engine);
            if (stbDecoder) {
                resourceLoader->addTextureProvider("image/png", stbDecoder);
                resourceLoader->addTextureProvider("image/jpeg", stbDecoder);
            }
        }

        // A GLB normally contains its binary buffer and can also embed textures.
        // ResourceLoader still finalizes GPU buffers/textures and creates the
        // Animator used by the render loop.
        if (!resourceLoader->loadResources(playerAsset)) {
            assetLoader->destroyAsset(playerAsset);
            playerAsset = nullptr;
            animationControllers.clear();
            return false;
        }

        playerInstances.push_back(playerAsset->getInstance());
        for (size_t i = 1; i < 22; ++i) {
            auto* instance = assetLoader->createInstance(playerAsset);
            if (!instance) {
                playerInstances.clear();
                assetLoader->destroyAsset(playerAsset);
                playerAsset = nullptr;
                animationControllers.clear();
                return false;
            }
            playerInstances.push_back(instance);
        }

        for (auto* instance : playerInstances) {
            if (instance) scene->addEntities(instance->getEntities(), instance->getEntityCount());
        }
        animationControllers.clear();
        animationControllers.reserve(playerInstances.size());
        for (auto* instance : playerInstances) {
            auto* animator = instance ? instance->getAnimator() : nullptr;
            animationControllers.emplace_back(std::make_unique<Slayer::Animation::AnimationController>(animator));
        }
        havePreviousPlayers = false;
        std::fill(std::begin(playerAnimationAccumulator), std::end(playerAnimationAccumulator), 0.0f);
        playerAnimationTime = 0.0f;
        playerAnimationIndex = 0;
        renderFrameIndex = 0;
        playerBoneCount = 0;
        if (playerAsset->getInstance()->getSkinCount() > 0) {
            playerBoneCount = static_cast<uint32_t>(
                playerAsset->getInstance()->getJointCountAt(0));
        }

        stats.player_count = static_cast<uint32_t>(playerInstances.size());
        return true;
    }

    void setSize(uint32_t w, uint32_t h) {
        width = std::max(1u, w);
        height = std::max(1u, h);
        if (view) view->setViewport({0, 0, width, height});
        if (broadcastCamera) broadcastCamera->setAspectRatio(static_cast<float>(width) / static_cast<float>(height));
        if (camera && !broadcastCamera) {
            camera->setProjection(
                45.0,
                static_cast<double>(width) / static_cast<double>(height),
                0.1, 100.0,
                Camera::Fov::VERTICAL);
            camera->lookAt(
                {0.0f, 3.2f, 10.5f},
                {0.0f, 1.0f, 0.0f},
                {0.0f, 1.0f, 0.0f});
        }
    }

    void render(float deltaSeconds) {
        ++renderFrameIndex;
        slayer_game_update(deltaSeconds);
        SlayerTransform gameTransforms[22]{};
        slayer_game_get_transforms(gameTransforms, 22);
        slayer_renderer_set_players(gameTransforms, 22);
        if (!renderer || !swapChain || !view) return;

        const auto now = Clock::now();
        const float measured =
            std::chrono::duration<float>(now - lastFrame).count();
        lastFrame = now;

        const float dt = measured > 0.0f ? measured : deltaSeconds;
        weatherTime += dt;
        applyWeatherVisuals();

        // Triple-buffered immutable snapshot. The renderer copies only from
        // the published buffer while the writer uses a different buffer.
        SlayerTransform playerLocal{};
        uint32_t playerCount = 0;
        const uint32_t readIndex =
            publishedPlayerBuffer.load(std::memory_order_acquire);
        renderReadingBuffer.store(readIndex, std::memory_order_release);
        const PlayerBuffer& readBuffer = playerBuffers[readIndex];
        playerCount = readBuffer.count;
        if (playerCount > 0) playerLocal = readBuffer.transforms[0];
        renderReadingBuffer.store(0xffffffffu, std::memory_order_release);
        if (playerAsset && playerCount > 0) {
            if (settings.camera == slayer::CameraMode::Broadcast && broadcastCamera) {
                float ballX = 0.0f, ballY = 0.22f, ballZ = 0.0f;
                slayer_game_get_ball(&ballX, &ballY, &ballZ);
                broadcastCamera->update(
                    playerLocal.x, playerLocal.y, playerLocal.z,
                    ballX, ballY, ballZ, dt);
            } else if(settings.camera==slayer::CameraMode::Dynamic || settings.camera==slayer::CameraMode::Pro || settings.camera==slayer::CameraMode::Custom) {
                const double distance=settings.camera==slayer::CameraMode::Pro?8.5:(settings.camera==slayer::CameraMode::Custom?12.0:15.5);
                const double height=settings.camera==slayer::CameraMode::Pro?2.8:(settings.camera==slayer::CameraMode::Custom?5.5:7.0);
                camera->lookAt({playerLocal.x,playerLocal.y+height,playerLocal.z+distance},{playerLocal.x,playerLocal.y+1.0,playerLocal.z},{0.0,1.0,0.0});
            }
            // Geometry LOD assets are generated by the production pipeline when possible.
            // Until a memory-safe multi-mesh swap path is enabled, runtime LOD is applied to
            // animation cadence so distant players consume substantially less CPU while their
            // transforms remain fully synchronized.

            auto& tm = engine->getTransformManager();
            const uint32_t count = std::min<uint32_t>(playerCount, static_cast<uint32_t>(playerInstances.size()));
            for (uint32_t i = 0; i < count; ++i) {
                auto* instance = playerInstances[i];
                if (!instance) continue;
                const Entity root = instance->getRoot();
                if (!tm.hasComponent(root)) continue;
                const auto& t = readBuffer.transforms[i];
                float facingX = 0.0f;
                float facingZ = 1.0f;
                if (havePreviousPlayers) {
                    facingX = t.x - previousPlayerX[i];
                    facingZ = t.z - previousPlayerZ[i];
                }
                if (std::abs(facingX) + std::abs(facingZ) < 0.0001f) {
                    facingX = 0.0f;
                    facingZ = 1.0f;
                }
                const float facingAngle = std::atan2(facingX, facingZ);
                const auto rotation = filament::math::mat4f::rotation(
                    facingAngle, filament::math::float3{0.0f, 1.0f, 0.0f});
                const auto translation = filament::math::mat4f::translation(
                    filament::math::float3{t.x, t.y, t.z});
                tm.setTransform(tm.getInstance(root), translation * rotation);
            }
        }

        float ballX = 0.0f, ballY = 0.22f, ballZ = 0.0f;
        slayer_game_get_ball(&ballX, &ballY, &ballZ);
        if (ballAsset) {
            const Entity root = ballAsset->getRoot();
            auto& tm = engine->getTransformManager();
            if (tm.hasComponent(root)) {
                tm.setTransform(
                    tm.getInstance(root),
                    filament::math::mat4f::translation(
                        filament::math::float3{ballX, ballY, ballZ}));
            }
        }

        if (goalAsset && goalInstances.size() == 2) {
            auto& tm = engine->getTransformManager();
            const float goalPositions[2] = {-34.0f, 34.0f};
            for (size_t i = 0; i < goalInstances.size(); ++i) {
                auto* instance = goalInstances[i];
                if (!instance) continue;
                const Entity root = instance->getRoot();
                if (!tm.hasComponent(root)) continue;
                const float z = goalPositions[i];
                const float angle = i == 0 ? 3.1415926535f : 0.0f;
                const auto rotation = filament::math::mat4f::rotation(
                    angle, filament::math::float3{0.0f, 1.0f, 0.0f});
                const auto translation = filament::math::mat4f::translation(
                    filament::math::float3{0.0f, 0.0f, z});
                tm.setTransform(tm.getInstance(root), translation * rotation);
            }
        }

        const uint32_t animCount = std::min<uint32_t>(
            playerCount, static_cast<uint32_t>(animationControllers.size()));
        if (animCount > 0 && dt > 0.0001f) {
            const auto quality = slayer::graphics::profile(settings.quality);
            for (uint32_t i = 0; i < animCount && i < MAX_PLAYERS; ++i) {
                const auto& current = readBuffer.transforms[i];
                float speed = 0.0f;
                if (havePreviousPlayers) {
                    const float dx = current.x - previousPlayerX[i];
                    const float dz = current.z - previousPlayerZ[i];
                    speed = std::sqrt(dx * dx + dz * dz) / dt;
                }
                previousPlayerX[i] = current.x;
                previousPlayerZ[i] = current.z;

                const float distance = slayer::graphics::normalizedDistance(
                    current.x, current.z, playerLocal.x, playerLocal.z);
                const uint32_t lod = slayer::graphics::animationLod(
                    distance, quality, renderFrameIndex);
                playerAnimationAccumulator[i] += dt;
                const float interval = slayer::graphics::animationInterval(lod, quality);
                if (playerAnimationAccumulator[i] >= interval && animationControllers[i]) {
                    const float animationDt = playerAnimationAccumulator[i];
                    playerAnimationAccumulator[i] = 0.0f;
                    const uint32_t actionId = current.anim_id;
                    const bool kick =
                        actionId == static_cast<uint32_t>(slayer::PlayerAction::Pass) ||
                        actionId == static_cast<uint32_t>(slayer::PlayerAction::Shoot);
                    const bool tackle =
                        actionId == static_cast<uint32_t>(slayer::PlayerAction::Tackle);
                    animationControllers[i]->update(speed, kick, tackle, animationDt);
                }
            }
            havePreviousPlayers = true;
        }

        stats.frame_ms = dt * 1000.0f;
        stats.fps = dt > 0.0f ? 1.0f / dt : 0.0f;
        // Renderer::FrameInfo is the authoritative GPU timing source when the
        // backend exposes timer queries. Keep the CPU frame time as fallback.
        const auto frameHistory = renderer->getFrameInfoHistory(4);
        if (!frameHistory.empty()) {
            const auto &fi = frameHistory.back();
            if (fi.denoisedGpuFrameDuration > 0) {
                stats.frame_ms = static_cast<float>(fi.denoisedGpuFrameDuration) / 1000000.0f;
                stats.fps = stats.frame_ms > 0.0f ? 1000.0f / stats.frame_ms : 0.0f;
            }
        }
        stats.player_count = playerCount;
        stats.draw_calls = 0;
        if (scene) {
            const auto& rm = engine->getRenderableManager();
            scene->forEach([&](Entity entity) {
                if (rm.hasComponent(entity)) {
                    // One renderable is a stable CPU-side proxy for a draw submission.
                    // GPU command count can vary by material variants and backend batching.
                    ++stats.draw_calls;
                }
            });
        }
        // Triangle count is intentionally left unreported until the asset
        // pipeline exposes primitive index counts without guessing. Never
        // publish a fabricated GPU metric.
        stats.triangles = 0;

        history.push_back(stats.frame_ms);
        if (history.size() > 120) history.erase(history.begin());
        auto sorted = history;
        std::sort(sorted.begin(), sorted.end());
        if (!sorted.empty()) {
            const size_t i = static_cast<size_t>(
                0.95 * static_cast<double>(sorted.size() - 1));
            stats.p95_ms = sorted[i];
        }

        if (renderer->beginFrame(swapChain)) {
            Renderer::ClearOptions clear{};
            clear.clear = true;
            clear.discard = true;
            clear.clearColor = {0.035, 0.045, 0.060, 1.0};
            renderer->setClearOptions(clear);
            renderer->render(view);
            renderer->endFrame();
        }
    }

    void shutdown() {
        if (!engine) return;

        broadcastCamera.reset();
        animationControllers.clear();

        if (playerAsset && scene) {
            scene->removeEntities(playerAsset->getEntities(), playerAsset->getEntityCount());
        }
        if (ballAsset && scene) {
            scene->removeEntities(ballAsset->getEntities(), ballAsset->getEntityCount());
        }
        if (goalAsset && scene) {
            for (auto* instance : goalInstances) {
                if (instance) scene->removeEntities(instance->getEntities(), instance->getEntityCount());
            }
        }
        if (stadiumAsset && scene) {
            scene->removeEntities(stadiumAsset->getEntities(), stadiumAsset->getEntityCount());
        }
        if (playerAsset && assetLoader) {
            assetLoader->destroyAsset(playerAsset);
            playerAsset = nullptr;

        }
        if (ballAsset && assetLoader) {
            assetLoader->destroyAsset(ballAsset);
            ballAsset = nullptr;
        }
        if (goalAsset && assetLoader) {
            assetLoader->destroyAsset(goalAsset);
            goalAsset = nullptr;
            goalInstances.clear();
        }
        if (stadiumAsset && assetLoader) {
            assetLoader->destroyAsset(stadiumAsset);
            stadiumAsset = nullptr;
        }
        if (resourceLoader) {
            delete resourceLoader;
            resourceLoader = nullptr;
        }
        if (stbDecoder) {
            delete stbDecoder;
            stbDecoder = nullptr;
        }
        if (assetLoader) {
            gltfio::AssetLoader::destroy(&assetLoader);
        }
        if (gltfMaterials) {
            gltfMaterials->destroyMaterials();
            delete gltfMaterials;
            gltfMaterials = nullptr;
        }

        if (scene && sunEntity) scene->remove(sunEntity);
        for (Entity e : floodlightEntities) {
            if (scene && e) scene->remove(e);
            if (e) engine->getLightManager().destroy(e);
        }
        if (scene && terrainEntity) scene->remove(terrainEntity);
        if (scene && weatherEntity) scene->remove(weatherEntity);
        if (scene && meshEntity) scene->remove(meshEntity);

        if (sunEntity) engine->getLightManager().destroy(sunEntity);
        if (terrainMaterialInstance) engine->destroy(terrainMaterialInstance);
        if (terrainMaterial) engine->destroy(terrainMaterial);
        terrainMaterialInstance = nullptr;
        terrainMaterial = nullptr;
        if (materialInstance) engine->destroy(materialInstance);
        if (vertexBuffer) engine->destroy(vertexBuffer);
        if (indexBuffer) engine->destroy(indexBuffer);
        if (weatherMaterialInstance) engine->destroy(weatherMaterialInstance);
        if (weatherVertexBuffer) engine->destroy(weatherVertexBuffer);
        if (weatherIndexBuffer) engine->destroy(weatherIndexBuffer);
        if (terrainVertexBuffer) engine->destroy(terrainVertexBuffer);
        if (terrainIndexBuffer) engine->destroy(terrainIndexBuffer);
        if (material) {
            // Default material is engine-owned; do not destroy it.
            material = nullptr;
        }

        if (meshEntity) engine->getEntityManager().destroy(meshEntity);
        if (terrainEntity) engine->getEntityManager().destroy(terrainEntity);
        if (weatherEntity) engine->getEntityManager().destroy(weatherEntity);
        if (sunEntity) engine->getEntityManager().destroy(sunEntity);
        if (cameraEntity) {
            engine->destroyCameraComponent(cameraEntity);
            engine->getEntityManager().destroy(cameraEntity);
        }

        if (view) {
            view->setColorGrading(nullptr);
            engine->destroy(view);
        }
        if (colorGrading) {
            engine->destroy(colorGrading);
            colorGrading = nullptr;
        }
        if (scene) engine->destroy(scene);
        if (renderer) engine->destroy(renderer);
        if (swapChain) engine->destroy(swapChain);

        Engine::destroy(&engine);

        if (window) {
            ANativeWindow_release(window);
            window = nullptr;
        }

        renderer = nullptr;
        swapChain = nullptr;
        view = nullptr;
        scene = nullptr;
        camera = nullptr;
        vertexBuffer = nullptr;
        indexBuffer = nullptr;
        terrainVertexBuffer = nullptr;
        terrainUvBuffer = nullptr;
        terrainTangentBuffer = nullptr;
        terrainIndexBuffer = nullptr;
        materialInstance = nullptr;
    }
};
NativeRenderer g_renderer;

} // namespace

extern "C" bool slayer_renderer_create(void* native_window) {
    if (g_renderer.engine) return true;
    return g_renderer.initialize(static_cast<ANativeWindow*>(native_window));
}

extern "C" void slayer_renderer_resize(uint32_t width, uint32_t height) {
    g_renderer.setSize(width, height);
}

extern "C" void slayer_renderer_set_players(
        const SlayerTransform* transforms, uint32_t count) {
    const uint32_t n = std::min(count, NativeRenderer::MAX_PLAYERS);
    const uint32_t published =
        g_renderer.publishedPlayerBuffer.load(std::memory_order_acquire);
    const uint32_t reading =
        g_renderer.renderReadingBuffer.load(std::memory_order_acquire);

    uint32_t target = (g_renderer.writerBuffer + 1u) % 3u;
    for (uint32_t i = 0; i < 3; ++i) {
        const uint32_t candidate = (target + i) % 3u;
        if (candidate != published && candidate != reading) {
            target = candidate;
            break;
        }
    }

    auto& buffer = g_renderer.playerBuffers[target];
    buffer.count = 0;
    if (transforms && n > 0) {
        std::copy_n(transforms, n, buffer.transforms);
        buffer.count = n;
    }

    std::atomic_thread_fence(std::memory_order_release);
    g_renderer.publishedPlayerBuffer.store(target, std::memory_order_release);
    g_renderer.writerBuffer = target;
    g_renderer.stats.player_count = transforms ? n : 0;
}

extern "C" void slayer_renderer_set_settings(const slayer::SlayerSettings& settings) { g_renderer.setSettings(settings); }

extern "C" void slayer_renderer_render(float delta_seconds) {
    g_renderer.render(delta_seconds);
}

extern "C" SlayerFrameStats slayer_renderer_stats(void) {
    return g_renderer.stats;
}

extern "C" void slayer_renderer_destroy(void) {
    g_renderer.shutdown();
}

extern "C" JNIEXPORT jboolean JNICALL
Java_com_slayer_filament_MainActivity_nativeCreate(
        JNIEnv* env, jobject, jobject surface) {
    if (!env || !surface) return JNI_FALSE;
    ANativeWindow* window = ANativeWindow_fromSurface(env, surface);
    if (!window) return JNI_FALSE;
    if (!slayer_renderer_create(window)) {
        g_renderer.shutdown();
        return JNI_FALSE;
    }
    slayer_game_reset();
    if (!g_renderer.loadUbershaderArchive()) {
        g_renderer.shutdown();
        return JNI_FALSE;
    }
    return JNI_TRUE;
}

extern "C" JNIEXPORT jboolean JNICALL
Java_com_slayer_filament_MainActivity_nativeLoadEnvironment(
        JNIEnv* env, jobject, jbyteArray data) {
    if (!env || !data) return JNI_FALSE;
    const jsize size = env->GetArrayLength(data);
    if (size <= 0) return JNI_FALSE;
    jbyte* raw = env->GetByteArrayElements(data, nullptr);
    if (!raw) return JNI_FALSE;
    const bool ok = g_renderer.loadEnvironmentKtx(
        reinterpret_cast<const uint8_t*>(raw), static_cast<size_t>(size));
    env->ReleaseByteArrayElements(data, raw, JNI_ABORT);
    return ok ? JNI_TRUE : JNI_FALSE;
}

extern "C" JNIEXPORT jboolean JNICALL
Java_com_slayer_filament_MainActivity_nativeLoadSkybox(JNIEnv* env, jobject, jbyteArray data) {
    if (!env || !data) return JNI_FALSE;
    const jsize size = env->GetArrayLength(data);
    if (size <= 0) return JNI_FALSE;
    jbyte* raw = env->GetByteArrayElements(data, nullptr);
    if (!raw) return JNI_FALSE;
    const bool ok = g_renderer.loadSkyboxKtx(
        reinterpret_cast<const uint8_t*>(raw), static_cast<size_t>(size));
    env->ReleaseByteArrayElements(data, raw, JNI_ABORT);
    return ok ? JNI_TRUE : JNI_FALSE;
}

extern "C" JNIEXPORT jboolean JNICALL
Java_com_slayer_filament_MainActivity_nativeLoadTerrainMaterial(
        JNIEnv* env, jobject, jbyteArray data) {
    if (!env || !data) return JNI_FALSE;
    const jsize size = env->GetArrayLength(data);
    if (size <= 0) return JNI_FALSE;
    jbyte* raw = env->GetByteArrayElements(data, nullptr);
    if (!raw) return JNI_FALSE;
    const bool ok = g_renderer.loadTerrainMaterial(
        reinterpret_cast<const uint8_t*>(raw), static_cast<size_t>(size));
    env->ReleaseByteArrayElements(data, raw, JNI_ABORT);
    return ok ? JNI_TRUE : JNI_FALSE;
}

extern "C" JNIEXPORT jboolean JNICALL
Java_com_slayer_filament_MainActivity_nativeLoadTerrainTextures(
        JNIEnv* env, jobject, jbyteArray baseColor, jbyteArray normal, jbyteArray roughness) {
    if (!env || !baseColor || !normal || !roughness) return JNI_FALSE;

    const jsize baseSize = env->GetArrayLength(baseColor);
    const jsize normalSize = env->GetArrayLength(normal);
    const jsize roughnessSize = env->GetArrayLength(roughness);
    if (baseSize <= 0 || normalSize <= 0 || roughnessSize <= 0) return JNI_FALSE;

    jbyte* baseRaw = env->GetByteArrayElements(baseColor, nullptr);
    jbyte* normalRaw = env->GetByteArrayElements(normal, nullptr);
    jbyte* roughRaw = env->GetByteArrayElements(roughness, nullptr);
    if (!baseRaw || !normalRaw || !roughRaw) {
        if (baseRaw) env->ReleaseByteArrayElements(baseColor, baseRaw, JNI_ABORT);
        if (normalRaw) env->ReleaseByteArrayElements(normal, normalRaw, JNI_ABORT);
        if (roughRaw) env->ReleaseByteArrayElements(roughness, roughRaw, JNI_ABORT);
        return JNI_FALSE;
    }

    const bool ok = g_renderer.loadTerrainTextures(
        reinterpret_cast<const uint8_t*>(baseRaw), static_cast<size_t>(baseSize),
        reinterpret_cast<const uint8_t*>(normalRaw), static_cast<size_t>(normalSize),
        reinterpret_cast<const uint8_t*>(roughRaw), static_cast<size_t>(roughnessSize));

    env->ReleaseByteArrayElements(baseColor, baseRaw, JNI_ABORT);
    env->ReleaseByteArrayElements(normal, normalRaw, JNI_ABORT);
    env->ReleaseByteArrayElements(roughness, roughRaw, JNI_ABORT);
    return ok ? JNI_TRUE : JNI_FALSE;
}

extern "C" JNIEXPORT jboolean JNICALL
Java_com_slayer_filament_MainActivity_nativeLoadStadium(
        JNIEnv* env, jobject, jbyteArray data) {
    if (!env || !data) return JNI_FALSE;
    const jsize size = env->GetArrayLength(data);
    if (size <= 0) return JNI_FALSE;
    jbyte* raw = env->GetByteArrayElements(data, nullptr);
    if (!raw) return JNI_FALSE;
    const bool ok = g_renderer.loadStadiumGlb(reinterpret_cast<const uint8_t*>(raw), static_cast<size_t>(size));
    env->ReleaseByteArrayElements(data, raw, JNI_ABORT);
    return ok ? JNI_TRUE : JNI_FALSE;
}

extern "C" JNIEXPORT jboolean JNICALL
Java_com_slayer_filament_MainActivity_nativeLoadBall(
        JNIEnv* env, jobject, jbyteArray data) {
    if (!env || !data) return JNI_FALSE;
    const jsize size = env->GetArrayLength(data);
    if (size <= 0) return JNI_FALSE;
    jbyte* raw = env->GetByteArrayElements(data, nullptr);
    if (!raw) return JNI_FALSE;
    const bool ok = g_renderer.loadBallGlb(
        reinterpret_cast<const uint8_t*>(raw),
        static_cast<size_t>(size));
    env->ReleaseByteArrayElements(data, raw, JNI_ABORT);
    return ok ? JNI_TRUE : JNI_FALSE;
}

extern "C" JNIEXPORT jboolean JNICALL
Java_com_slayer_filament_MainActivity_nativeLoadGoal(
        JNIEnv* env, jobject, jbyteArray data) {
    if (!env || !data) return JNI_FALSE;
    const jsize size = env->GetArrayLength(data);
    if (size <= 0) return JNI_FALSE;
    jbyte* raw = env->GetByteArrayElements(data, nullptr);
    if (!raw) return JNI_FALSE;
    const bool ok = g_renderer.loadGoalGlb(
        reinterpret_cast<const uint8_t*>(raw),
        static_cast<size_t>(size));
    env->ReleaseByteArrayElements(data, raw, JNI_ABORT);
    return ok ? JNI_TRUE : JNI_FALSE;
}

extern "C" JNIEXPORT jboolean JNICALL
Java_com_slayer_filament_MainActivity_nativeLoadPlayer(
        JNIEnv* env, jobject, jbyteArray data) {
    if (!env || !data) return JNI_FALSE;
    const jsize size = env->GetArrayLength(data);
    if (size <= 0) return JNI_FALSE;

    jbyte* raw = env->GetByteArrayElements(data, nullptr);
    if (!raw) return JNI_FALSE;

    const bool ok = g_renderer.loadPlayerGlb(
        reinterpret_cast<const uint8_t*>(raw),
        static_cast<size_t>(size));

    env->ReleaseByteArrayElements(data, raw, JNI_ABORT);
    return ok ? JNI_TRUE : JNI_FALSE;
}


extern "C" JNIEXPORT jint JNICALL
Java_com_slayer_filament_MainActivity_nativeGetHomeScore(JNIEnv*, jobject) {
    uint32_t home = 0;
    slayer_game_get_score(&home, nullptr, nullptr);
    return static_cast<jint>(home);
}

extern "C" JNIEXPORT jint JNICALL
Java_com_slayer_filament_MainActivity_nativeGetAwayScore(JNIEnv*, jobject) {
    uint32_t away = 0;
    slayer_game_get_score(nullptr, &away, nullptr);
    return static_cast<jint>(away);
}

extern "C" JNIEXPORT void JNICALL
Java_com_slayer_filament_MainActivity_nativeResize(
        JNIEnv*, jobject, jint width, jint height) {
    slayer_renderer_resize(
        static_cast<uint32_t>(std::max(1, width)),
        static_cast<uint32_t>(std::max(1, height)));
}

extern "C" JNIEXPORT void JNICALL
Java_com_slayer_filament_MainActivity_nativeRender(
        JNIEnv*, jobject, jfloat deltaSeconds) {
    slayer_renderer_render(deltaSeconds);
}

extern "C" JNIEXPORT void JNICALL
Java_com_slayer_filament_MainActivity_nativeDestroy(
        JNIEnv*, jobject) {
    slayer_renderer_destroy();
}



extern "C" JNIEXPORT void JNICALL
Java_com_slayer_filament_MainActivity_nativeSetInput(
        JNIEnv*, jobject, jfloat moveX, jfloat moveY, jfloat pass,
        jfloat shoot, jfloat sprint, jfloat tackle, jint selected) {
    slayer_game_set_input(moveX, moveY, pass, shoot, sprint, tackle, selected);
}

extern "C" JNIEXPORT void JNICALL
Java_com_slayer_filament_MainActivity_nativeSetSettings(JNIEnv*, jobject, jint duration, jboolean extraTime, jboolean penalties, jint substitutions, jint conditionRandom, jint timeMode, jint weatherMode, jint grassMode, jint stadium, jint ball, jint control, jint passAssist, jint shotAssist, jint cursor, jint pressing, jint attack, jint targetFps, jint quality, jboolean dynamicResolution, jint cameraMode, jboolean radar, jint commentary, jfloat music, jfloat commentaryVolume, jfloat crowd, jfloat effects) {
    slayer::SlayerSettings s{};
    s.durationMinutes=std::clamp((int)duration,5,12); s.extraTime=extraTime; s.penalties=penalties; s.substitutions=std::clamp((int)substitutions,3,5); s.randomCondition=conditionRandom!=0;
    s.time=(slayer::TimeMode)std::clamp((int)timeMode,0,2); s.weather=(slayer::WeatherMode)std::clamp((int)weatherMode,0,2); s.grass=(slayer::GrassMode)std::clamp((int)grassMode,0,2);
    s.stadium=stadium; s.ball=ball; s.control=(slayer::ControlMode)std::clamp((int)control,0,2); s.passAssist=std::clamp((int)passAssist,1,4); s.shotAssist=(slayer::ShotAssistMode)std::clamp((int)shotAssist,0,1); s.cursor=(slayer::CursorMode)std::clamp((int)cursor,0,2); s.pressing=(slayer::PressMode)std::clamp((int)pressing,0,1); s.attack=(slayer::TacticalMode)std::clamp((int)attack,0,2); s.targetFps=targetFps; s.quality=(slayer::QualityMode)std::clamp((int)quality,0,3); s.dynamicResolution=dynamicResolution; s.camera=(slayer::CameraMode)std::clamp((int)cameraMode,0,4); s.radar=radar; s.commentaryLanguage=commentary; s.musicVolume=music; s.commentaryVolume=commentaryVolume; s.crowdVolume=crowd; s.effectsVolume=effects;
    slayer_renderer_set_settings(s);
    slayer_game_set_settings(s);
}

extern "C" JNIEXPORT void JNICALL
Java_com_slayer_filament_MainActivity_nativeResetMatch(JNIEnv*, jobject) {
    slayer_game_reset();
}

extern "C" JNIEXPORT jfloat JNICALL
Java_com_slayer_filament_MainActivity_nativeGetFps(JNIEnv*, jobject) {
    return g_renderer.stats.fps;
}

extern "C" JNIEXPORT jfloat JNICALL
Java_com_slayer_filament_MainActivity_nativeGetFrameMs(JNIEnv*, jobject) {
    return g_renderer.stats.frame_ms;
}

extern "C" JNIEXPORT jint JNICALL
Java_com_slayer_filament_MainActivity_nativeGetDrawCalls(JNIEnv*, jobject) {
    return static_cast<jint>(g_renderer.stats.draw_calls);
}

extern "C" JNIEXPORT jint JNICALL
Java_com_slayer_filament_MainActivity_nativeGetPlayerCount(JNIEnv*, jobject) {
    return static_cast<jint>(g_renderer.stats.player_count);
}
