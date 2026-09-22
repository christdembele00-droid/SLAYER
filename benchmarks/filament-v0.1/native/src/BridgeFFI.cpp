#include "slayer_renderer.h"

#include <android/native_window.h>
#include <android/native_window_jni.h>
#include <jni.h>

#include <gltfio/AssetLoader.h>
#include <gltfio/Animator.h>
#include <gltfio/FilamentAsset.h>
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
    VertexBuffer* vertexBuffer = nullptr;
    IndexBuffer* indexBuffer = nullptr;
    VertexBuffer* terrainVertexBuffer = nullptr;
    IndexBuffer* terrainIndexBuffer = nullptr;
    Material* material = nullptr;
    MaterialInstance* materialInstance = nullptr;

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
    SlayerTransform playerSnapshot[MAX_PLAYERS]{};
    uint32_t playerSnapshotCount = 0;
    std::atomic<uint64_t> playerSnapshotSequence{0};

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
        static constexpr uint16_t terrainIndices[] = {0, 1, 2, 0, 2, 3};

        terrainVertexBuffer = VertexBuffer::Builder()
            .vertexCount(4)
            .bufferCount(1)
            .attribute(VertexAttribute::POSITION, 0,
                       VertexBuffer::AttributeType::FLOAT3)
            .build(*engine);

        terrainIndexBuffer = IndexBuffer::Builder()
            .indexCount(6)
            .bufferType(IndexBuffer::IndexType::USHORT)
            .build(*engine);

        if (!terrainVertexBuffer || !terrainIndexBuffer) return false;

        terrainVertexBuffer->setBufferAt(
            *engine, 0,
            VertexBuffer::BufferDescriptor(
                terrainVertices, sizeof(terrainVertices), nullptr));
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

        // Consume the latest lock-free player snapshot. The render thread never
        // waits for simulation/FFI writers.
        SlayerTransform playerLocal{};
        uint32_t playerCount = 0;
        // Lock-free sequence snapshot: the render thread retries only if a
        // writer modified the snapshot while it was being copied.
        for (;;) {
            const uint64_t before = playerSnapshotSequence.load(std::memory_order_acquire);
            if (before & 1u) continue;
            playerCount = playerSnapshotCount;
            if (playerCount > 0) playerLocal = playerSnapshot[0];
            const uint64_t after = playerSnapshotSequence.load(std::memory_order_acquire);
            if (before == after) break;
        }
        if (playerAsset && playerCount > 0) {
            auto &tm = engine->getTransformManager();
            const Entity root = playerAsset->getEntities()[0];
            if (tm.hasComponent(root)) {
                tm.setTransform(tm.getInstance(root), filament::math::mat4f::translation({
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
        stats.player_count = playerAsset ? 1u : 0u;
        stats.draw_calls = playerAsset ? 3u : 2u;
        stats.triangles = playerAsset ? 8u : 8u;

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
    g_renderer.playerSnapshotSequence.fetch_add(1, std::memory_order_acq_rel);
    if (transforms && n > 0) {
        std::copy_n(transforms, n, g_renderer.playerSnapshot);
    }
    g_renderer.playerSnapshotCount = transforms ? n : 0;
    g_renderer.playerSnapshotSequence.fetch_add(1, std::memory_order_release);
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
