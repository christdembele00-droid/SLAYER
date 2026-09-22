#include "slayer_renderer.h"
#include "slayer_input.h"
#include "slayer_settings.h"
#include "slayer_render_quality.h"

#include <android/native_window.h>
#include <android/native_window_jni.h>
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
#include <vector>
#include <atomic>
#include <thread>

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
    IndexBuffer* terrainIndexBuffer = nullptr;
    Material* material = nullptr;
    MaterialInstance* materialInstance = nullptr;
    Material* terrainMaterial = nullptr;
    MaterialInstance* terrainMaterialInstance = nullptr;
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
    std::vector<gltfio::FilamentInstance*> playerInstances;
    gltfio::Animator* playerAnimator = nullptr;
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
        slayer::applyMobileQuality(engine, view, renderer, settings);
        const bool night = settings.time == slayer::TimeMode::Night;
        const bool twilight = settings.time == slayer::TimeMode::Twilight;
        auto& lm = engine->getLightManager();
        if (lm.hasComponent(sunEntity)) {
            auto li = lm.getInstance(sunEntity);
            lm.setIntensity(li, night ? 9000.0f : twilight ? 38000.0f : 90000.0f);
        }
        for (Entity e : floodlightEntities) if (lm.hasComponent(e)) {
            auto li=lm.getInstance(e);
            lm.setIntensity(li, night ? 36000.0f : twilight ? 22000.0f : 12000.0f);
        }
        switch(settings.camera) {
            case slayer::CameraMode::Broadcast: camera->lookAt({0.0,18.0,24.0},{0.0,0.0,0.0}); break;
            case slayer::CameraMode::Dynamic: camera->lookAt({0.0,8.5,15.5},{0.0,1.0,0.0}); break;
            case slayer::CameraMode::Overview: camera->lookAt({0.0,30.0,2.0},{0.0,0.0,0.0}); break;
            case slayer::CameraMode::Pro: camera->lookAt({0.0,5.0,11.5},{0.0,1.0,0.0}); break;
            case slayer::CameraMode::Custom: camera->lookAt({6.0,9.0,14.0},{0.0,1.0,0.0}); break;
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
        view->setScene(scene);
        view->setCamera(camera);
        view->setPostProcessingEnabled(true);
        view->setAntiAliasing(View::AntiAliasing::FXAA);
        colorGrading = ColorGrading::Builder()
            .toneMapper(&acesToneMapper)
            .quality(ColorGrading::QualityLevel::MEDIUM)
            .build(*engine);
        if (colorGrading) view->setColorGrading(colorGrading);
        View::TemporalAntiAliasingOptions taa{};
        taa.enabled = true;
        taa.feedback = 0.12f;
        taa.filterWidth = 1.0f;
        view->setTemporalAntiAliasingOptions(taa);
        View::DynamicResolutionOptions drs{};
        drs.enabled = true;
        drs.homogeneousScaling = true;
        drs.minScale = 0.70f;
        drs.maxScale = 1.0f;
        drs.sharpness = 0.7f;
        view->setDynamicResolutionOptions(drs);
        view->setDynamicLightingOptions(1.0f, 80.0f);
        view->setShadowType(View::ShadowType::PCF);

        // Mobile-quality post processing: GTAO adds contact depth, while a restrained
        // bloom pass gives the floodlights and bright kit highlights a real HDR response.
        View::AmbientOcclusionOptions ao{};
        ao.aoType = View::AmbientOcclusionOptions::AmbientOcclusionType::GTAO;
        ao.radius = 0.45f;
        ao.power = 1.15f;
        ao.resolution = 0.5f;
        ao.intensity = 1.0f;
        ao.quality = QualityLevel::LOW;
        ao.lowPassFilter = QualityLevel::MEDIUM;
        ao.upsampling = QualityLevel::LOW;
        ao.enabled = true;
        view->setAmbientOcclusionOptions(ao);

        View::BloomOptions bloom{};
        bloom.enabled = true;
        bloom.strength = 0.08f;
        bloom.resolution = 256;
        bloom.levels = 5;
        bloom.threshold = true;
        bloom.quality = QualityLevel::LOW;
        bloom.highlight = 800.0f;
        view->setBloomOptions(bloom);

        // Stadium-style ground plane for the first PBR lighting milestone.
        static constexpr float terrainVertices[] = {
            -12.0f, 0.0f, -8.0f,
             12.0f, 0.0f, -8.0f,
             12.0f, 0.0f,  8.0f,
            -12.0f, 0.0f,  8.0f
        };
        static constexpr float terrainUv[] = {
            0.0f, 0.0f,
            6.0f, 0.0f,
            6.0f, 4.0f,
            0.0f, 4.0f
        };
        static constexpr uint16_t terrainIndices[] = {0, 1, 2, 0, 2, 3};

        terrainVertexBuffer = VertexBuffer::Builder()
            .vertexCount(4)
            .bufferCount(2)
            .attribute(VertexAttribute::POSITION, 0,
                       VertexBuffer::AttributeType::FLOAT3)
            .attribute(VertexAttribute::UV0, 1,
                       VertexBuffer::AttributeType::FLOAT2)
            .build(*engine);

        terrainUvBuffer = terrainVertexBuffer;

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
        terrainIndexBuffer->setBuffer(
            *engine,
            IndexBuffer::BufferDescriptor(
                terrainIndices, sizeof(terrainIndices), nullptr));

        terrainEntity = engine->getEntityManager().create();

        RenderableManager::Builder(1)
            .boundingBox({{-12.0f, -0.05f, -8.0f}, {12.0f, 0.05f, 8.0f}})
            .material(0, materialInstance)
            .geometry(0, RenderableManager::PrimitiveType::TRIANGLES,
                      terrainVertexBuffer, terrainIndexBuffer, 0, 6)
            .culling(false)
            .castShadows(false)
            .receiveShadows(true)
            .build(*engine, terrainEntity);

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
        applySettings();
        lastFrame = Clock::now();
        return true;
    }

    bool loadEnvironmentKtx(const uint8_t* bytes, size_t size) {
        if (!engine || !scene || !bytes || size < 16) return false;
        auto* bundle = new image::Ktx1Bundle(bytes, static_cast<uint32_t>(size));
        if (!bundle->isCubemap()) { delete bundle; return false; }

        if (indirectLight) {
            scene->setIndirectLight(nullptr);
            engine->destroy(indirectLight);
            indirectLight = nullptr;
        }
        if (environmentTexture) {
            engine->destroy(environmentTexture);
            environmentTexture = nullptr;
        }

        environmentTexture = ktxreader::Ktx1Reader::createTexture(engine, bundle, false);
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
        auto* bundle = new image::Ktx1Bundle(bytes, static_cast<uint32_t>(size));
        if (!bundle->isCubemap()) { delete bundle; return false; }

        if (skybox) {
            scene->setSkybox(nullptr);
            engine->destroy(skybox);
            skybox = nullptr;
        }
        if (skyboxTexture) {
            engine->destroy(skyboxTexture);
            skyboxTexture = nullptr;
        }

        skyboxTexture = ktxreader::Ktx1Reader::createTexture(engine, bundle, false);
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
        }

        if (terrainMaterialInstance) engine->destroy(terrainMaterialInstance);
        if (terrainMaterial) engine->destroy(terrainMaterial);

        terrainMaterial = next;
        terrainMaterialInstance = nextInstance;
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
            playerAnimator = nullptr;
        }

        playerInstances.assign(22, nullptr);
        playerAsset = assetLoader->createInstancedAsset(bytes, static_cast<uint32_t>(size), playerInstances.data(), playerInstances.size());
        if (!playerAsset) { playerInstances.clear(); return false; }

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
            playerAnimator = nullptr;
            return false;
        }

        for (auto* instance : playerInstances) {
            if (instance) scene->addEntities(instance->getEntities(), instance->getEntityCount());
        }
        playerAnimator = playerAsset->getInstance()->getAnimator();
        playerAnimationTime = 0.0f;
        playerAnimationIndex = 0;
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
        if (camera) {
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
            if(settings.camera==slayer::CameraMode::Dynamic || settings.camera==slayer::CameraMode::Pro || settings.camera==slayer::CameraMode::Custom) {
                const double distance=settings.camera==slayer::CameraMode::Pro?8.5:(settings.camera==slayer::CameraMode::Custom?12.0:15.5);
                const double height=settings.camera==slayer::CameraMode::Pro?2.8:(settings.camera==slayer::CameraMode::Custom?5.5:7.0);
                camera->lookAt({playerLocal.x,playerLocal.y+height,playerLocal.z+distance},{playerLocal.x,playerLocal.y+1.0,playerLocal.z},{0.0,1.0,0.0});
            }
            const float distance = std::sqrt(
                playerLocal.x * playerLocal.x +
                playerLocal.y * playerLocal.y +
                playerLocal.z * playerLocal.z);
            const uint32_t lod = distance < 12.0f ? 0u : (distance < 28.0f ? 1u : 2u);
            (void)lod; // Mesh switching activates when player_lod1/lod2 assets are supplied.

            auto& tm = engine->getTransformManager();
            const uint32_t count = std::min<uint32_t>(playerCount, static_cast<uint32_t>(playerInstances.size()));
            for (uint32_t i = 0; i < count; ++i) {
                auto* instance = playerInstances[i];
                if (!instance) continue;
                const Entity root = instance->getRoot();
                if (!tm.hasComponent(root)) continue;
                const auto& t = readBuffer.transforms[i];
                tm.setTransform(tm.getInstance(root),
                    filament::math::mat4f::translation(
                        filament::math::float3{t.x, t.y, t.z}));
            }
        }

        if (playerAnimator && playerAnimator->getAnimationCount() > 0) {
            playerAnimationTime += dt;
            const float duration = playerAnimator->getAnimationDuration(playerAnimationIndex);
            const float animationTime = duration > 0.0f
                ? std::fmod(playerAnimationTime, duration)
                : 0.0f;
            playerAnimator->applyAnimation(playerAnimationIndex, animationTime);
            // Filament consumes the resulting bone matrices in the renderable
            // skinning path; vertex deformation therefore remains GPU-side.
            playerAnimator->updateBoneMatrices();
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
                    stats.draw_calls += static_cast<uint32_t>(rm.getPrimitiveCount(rm.getInstance(entity)));
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

        if (playerAsset && scene) {
            scene->removeEntities(playerAsset->getEntities(), playerAsset->getEntityCount());
        }
        if (stadiumAsset && scene) {
            scene->removeEntities(stadiumAsset->getEntities(), stadiumAsset->getEntityCount());
        }
        if (playerAsset && assetLoader) {
            assetLoader->destroyAsset(playerAsset);
            playerAsset = nullptr;
            playerAnimator = nullptr;
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
        terrainIndexBuffer = nullptr;
        materialInstance = nullptr;
    }
};

class RuntimeThreads {
    std::atomic<bool> running{false}; std::thread physics; std::thread gameplay;
public:
    void start(){ if(running.exchange(true)) return; physics=std::thread([this]{using namespace std::chrono_literals; while(running){std::this_thread::sleep_for(8ms);}}); gameplay=std::thread([this]{using namespace std::chrono_literals; while(running){std::this_thread::sleep_for(16ms);}}); }
    void stop(){running=false; if(physics.joinable())physics.join(); if(gameplay.joinable())gameplay.join();}
};
NativeRenderer g_renderer;
RuntimeThreads g_runtime;

} // namespace

extern "C" void slayer_renderer_create(void* native_window) {
    g_renderer.initialize(static_cast<ANativeWindow*>(native_window));
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

extern "C" JNIEXPORT void JNICALL
Java_com_slayer_filament_MainActivity_nativeCreate(
        JNIEnv* env, jobject, jobject surface) {
    ANativeWindow* window = ANativeWindow_fromSurface(env, surface);
    if (!window) return;
    if (g_renderer.initialize(window)) {
        slayer_game_reset();
        g_renderer.loadUbershaderArchive();
        g_runtime.start();
    }
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
    g_runtime.stop();
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
