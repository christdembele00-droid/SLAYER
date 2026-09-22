#include "slayer_renderer.h"

#include <android/native_window.h>
#include <android/native_window_jni.h>
#include <jni.h>

#include <algorithm>
#include <chrono>
#include <cstdint>
#include <vector>

#include <filament/Camera.h>
#include <filament/Engine.h>
#include <filament/IndexBuffer.h>
#include <filament/Material.h>
#include <filament/RenderableManager.h>
#include <filament/Renderer.h>
#include <filament/Scene.h>
#include <filament/SwapChain.h>
#include <filament/VertexBuffer.h>
#include <filament/View.h>
#include <backend/DriverEnums.h>
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

    Entity cameraEntity{};
    Entity meshEntity{};
    VertexBuffer* vertexBuffer = nullptr;
    IndexBuffer* indexBuffer = nullptr;
    Material* material = nullptr;
    MaterialInstance* materialInstance = nullptr;

    ANativeWindow* window = nullptr;
    uint32_t width = 1;
    uint32_t height = 1;

    SlayerFrameStats stats{};
    Clock::time_point lastFrame = Clock::now();
    std::vector<float> history;

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

        setSize(1, 1);
        lastFrame = Clock::now();
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
        stats.frame_ms = dt * 1000.0f;
        stats.fps = dt > 0.0f ? 1.0f / dt : 0.0f;
        stats.player_count = 0;
        stats.draw_calls = 1;
        stats.triangles = 6;

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

        if (scene && meshEntity) scene->remove(meshEntity);

        if (materialInstance) engine->destroy(materialInstance);
        if (vertexBuffer) engine->destroy(vertexBuffer);
        if (indexBuffer) engine->destroy(indexBuffer);
        if (material) {
            // Default material is engine-owned; do not destroy it.
            material = nullptr;
        }

        if (meshEntity) engine->getEntityManager().destroy(meshEntity);
        if (cameraEntity) {
            engine->destroyCameraComponent(cameraEntity);
            engine->getEntityManager().destroy(cameraEntity);
        }

        if (view) engine->destroy(view);
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
    g_renderer.stats.player_count = transforms ? count : 0;
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
    g_renderer.initialize(window);
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
