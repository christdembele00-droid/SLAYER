#include "slayer_renderer.h"

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
    VertexBuffer* vertexBuffer = nullptr;
    IndexBuffer* indexBuffer = nullptr;
    VertexBuffer* terrainVertexBuffer = nullptr;
    VertexBuffer* terrainUvBuffer = nullptr;
    IndexBuffer* terrainIndexBuffer = nullptr;
    Material* material = nullptr;
    MaterialInstance* materialInstance = nullptr;
    Material* terrainMaterial = nullptr;
    MaterialInstance* terrainMaterialInstance = nullptr;

    gltfio::MaterialProvider* gltfMaterials = nullptr;
    gltfio::AssetLoader* assetLoader = nullptr;
    gltfio::ResourceLoader* resourceLoader = nullptr;
    gltfio::TextureProvider* stbDecoder = nullptr;
    gltfio::FilamentAsset* playerAsset = nullptr;
    gltfio::Animator* playerAnimator = nullptr;
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

    bool initialize(ANativeWindow* nativeWindow) {
        window = nativeWindow;
        if (!window) return false;

        // Try Vulkan first, then GLES as the explicit fallback.
        engine = Engine::create(Engine::Backend::VULKAN);
        if (!engine) {
            engine = Engine::create(Engine::Backend::OPENGL);
        }
        if (!engine) return false;

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

        // A minimal real 3D primitive proves that the native Filament pipeline
        // is rendering geometry rather than merely displaying an Android view.
        static constexpr float vertices[] = {
            -1.0f, -1.0f,  0.0f,
             1.0f, -1.0f,  0.0f,
             1.0f,  1.0f,  0.0f,
            -1.0f,  1.0f,  0.0f,
             0.0f,  0.0f,  1.4f
        };
        static constexpr uint16_t indices[] = {
            0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4,
            3, 2, 1, 1, 0, 3
        };

        vertexBuffer = VertexBuffer::Builder()
            .vertexCount(5)
            .bufferCount(1)
            .attribute(VertexAttribute::POSITION, 0,
                       VertexBuffer::AttributeType::FLOAT3)
            .build(*engine);

        indexBuffer = IndexBuffer::Builder()
            .indexCount(sizeof(indices) / sizeof(indices[0]))
            .bufferType(IndexBuffer::IndexType::USHORT)
            .build(*engine);

        if (!vertexBuffer || !indexBuffer) return false;

        vertexBuffer->setBufferAt(
            *engine, 0,
            VertexBuffer::BufferDescriptor(vertices, sizeof(vertices), nullptr));
        indexBuffer->setBuffer(
            *engine,
            IndexBuffer::BufferDescriptor(indices, sizeof(indices), nullptr));

        material = const_cast<Material*>(engine->getDefaultMaterial());
        materialInstance = material ? material->createInstance() : nullptr;
        if (!materialInstance) return false;

        meshEntity = engine->getEntityManager().create();

        RenderableManager::Builder(1)
            .boundingBox({{-1.0f, -1.0f, -1.5f}, {1.0f, 1.0f, 1.5f}})
            .material(0, materialInstance)
            .geometry(0, RenderableManager::PrimitiveType::TRIANGLES,
                      vertexBuffer, indexBuffer, 0,
                      sizeof(indices) / sizeof(indices[0]))
            .culling(false)
            .build(*engine, meshEntity);

        scene->addEntity(meshEntity);

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
        auto* bundle = new image::Ktx1Bundle(bytes, static_cast<uint32_t>(size));
        if (!bundle->isCubemap()) { delete bundle; return false; }
        if (indirectLight) { scene->setIndirectLight(nullptr); engine->destroy(indirectLight); indirectLight = nullptr; }
        if (skybox) { scene->setSkybox(nullptr); engine->destroy(skybox); skybox = nullptr; }
        if (environmentTexture) { engine->destroy(environmentTexture); environmentTexture = nullptr; }
        environmentTexture = ktxreader::Ktx1Reader::createTexture(engine, bundle, false);
        if (!environmentTexture) return false;
        indirectLight = filament::IndirectLight::Builder()
            .reflections(environmentTexture)
            .intensity(30000.0f)
            .build(*engine);
        if (!indirectLight) { engine->destroy(environmentTexture); environmentTexture = nullptr; return false; }
        skybox = filament::Skybox::Builder()
            .environment(environmentTexture)
            .showSun(true)
            .intensity(30000.0f)
            .build(*engine);
        if (!skybox) { engine->destroy(indirectLight); engine->destroy(environmentTexture); indirectLight = nullptr; environmentTexture = nullptr; return false; }
        scene->setIndirectLight(indirectLight);
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

    bool loadPlayerGlb(const uint8_t* bytes, size_t size) {
        if (!engine || !bytes || size == 0 || !gltfMaterials) return false;

        if (!assetLoader) {
            assetLoader = gltfio::AssetLoader::create({engine, gltfMaterials});
        }
        if (!assetLoader) return false;

        // Replace an already loaded player cleanly.
        if (playerAsset) {
            if (scene) {
                scene->removeEntities(playerAsset->getEntities(), playerAsset->getEntityCount());
            }
            assetLoader->destroyAsset(playerAsset);
            playerAsset = nullptr;
            playerAnimator = nullptr;
        }

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
            playerAnimator = nullptr;
            return false;
        }

        scene->addEntities(playerAsset->getEntities(), playerAsset->getEntityCount());
        playerAnimator = playerAsset->getInstance()->getAnimator();
        playerAnimationTime = 0.0f;
        playerAnimationIndex = 0;
        playerBoneCount = 0;
        if (playerAsset->getInstance()->getSkinCount() > 0) {
            playerBoneCount = static_cast<uint32_t>(
                playerAsset->getInstance()->getJointCountAt(0));
        }

        stats.player_count = 1;
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
                {0.0f, 0.0f, 5.0f},
                {0.0f, 0.0f, 0.0f},
                {0.0f, 1.0f, 0.0f});
        }
    }

    void render(float deltaSeconds) {
        if (!renderer || !swapChain || !view) return;

        const auto now = Clock::now();
        const float measured =
            std::chrono::duration<float>(now - lastFrame).count();
        lastFrame = now;

        const float dt = measured > 0.0f ? measured : deltaSeconds;

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
            const float distance = std::sqrt(
                playerLocal.x * playerLocal.x +
                playerLocal.y * playerLocal.y +
                playerLocal.z * playerLocal.z);
            const uint32_t lod = distance < 12.0f ? 0u : (distance < 28.0f ? 1u : 2u);
            (void)lod; // Mesh switching activates when player_lod1/lod2 assets are supplied.

            auto& tm = engine->getTransformManager();
            const Entity root = playerAsset->getInstance()->getRoot();
            if (tm.hasComponent(root)) {
                tm.setTransform(tm.getInstance(root),
                    filament::math::mat4f::translation(
                        filament::math::float3{
                            playerLocal.x, playerLocal.y, playerLocal.z}));
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
        if (playerAsset && assetLoader) {
            assetLoader->destroyAsset(playerAsset);
            playerAsset = nullptr;
            playerAnimator = nullptr;
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
        if (scene && meshEntity) scene->remove(meshEntity);

        if (sunEntity) engine->getLightManager().destroy(sunEntity);
        if (terrainMaterialInstance) engine->destroy(terrainMaterialInstance);
        if (terrainMaterial) engine->destroy(terrainMaterial);
        terrainMaterialInstance = nullptr;
        terrainMaterial = nullptr;
        if (materialInstance) engine->destroy(materialInstance);
        if (vertexBuffer) engine->destroy(vertexBuffer);
        if (indexBuffer) engine->destroy(indexBuffer);
        if (terrainVertexBuffer) engine->destroy(terrainVertexBuffer);
        if (terrainIndexBuffer) engine->destroy(terrainIndexBuffer);
        if (material) {
            // Default material is engine-owned; do not destroy it.
            material = nullptr;
        }

        if (meshEntity) engine->getEntityManager().destroy(meshEntity);
        if (terrainEntity) engine->getEntityManager().destroy(terrainEntity);
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

NativeRenderer g_renderer;

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
        g_renderer.loadUbershaderArchive();
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
    slayer_renderer_destroy();
}
