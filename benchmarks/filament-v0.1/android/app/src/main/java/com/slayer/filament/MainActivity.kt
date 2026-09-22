package com.slayer.filament

import android.app.Activity
import android.os.Bundle
import android.view.SurfaceView
import com.google.android.filament.Engine
import com.google.android.filament.Renderer
import com.google.android.filament.SwapChain
import com.google.android.filament.View
import com.google.android.filament.Scene
import com.google.android.filament.Camera
import com.google.android.filament.LightManager
import com.google.android.filament.IndirectLight
import com.google.android.filament.utils.UiHelper
import com.google.android.filament.utils.Utils

class MainActivity : Activity() {
    private lateinit var surface: SurfaceView
    private lateinit var engine: Engine
    private lateinit var renderer: Renderer
    private lateinit var view: View
    private lateinit var scene: Scene
    private lateinit var camera: Camera
    private lateinit var swapChain: SwapChain
    private lateinit var uiHelper: UiHelper

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Utils.init()
        surface = SurfaceView(this)
        setContentView(surface)

        engine = Engine.create()
        renderer = engine.createRenderer()
        view = engine.createView()
        scene = engine.createScene()
        camera = engine.createCamera(engine.entityManager.create())
        swapChain = engine.createSwapChain(surface)
        view.scene = scene
        view.camera = camera

        camera.setProjection(
            45.0, 1.0, 0.1, 500.0,
            Camera.Fov.HORIZONTAL
        )
        camera.lookAt(0.0, 6.0, 16.0, 0.0, 0.0, 0.0)

        val sun = LightManager.Builder(LightManager.Type.SUN)
            .color(1.0f, 0.96f, 0.90f)
            .intensity(110000.0f)
            .direction(0.2f, -1.0f, -0.3f)
            .castShadows(true)
            .build(engine, engine.entityManager.create())
        scene.addEntity(sun)

        uiHelper = UiHelper(UiHelper.ContextErrorPolicy.DONT_CHECK)
        uiHelper.isOpaque = true
        uiHelper.attachTo(surface)
        uiHelper.renderCallback = object : UiHelper.RendererCallback {
            override fun onNativeWindowChanged(surface: android.view.Surface) {
                if (::swapChain.isInitialized) engine.destroySwapChain(swapChain)
                swapChain = engine.createSwapChain(surface)
            }

            override fun onDetachedFromSurface() {
                if (::swapChain.isInitialized) {
                    engine.destroySwapChain(swapChain)
                }
            }

            override fun onResized(width: Int, height: Int) {
                view.viewport = Viewport(0, 0, width, height)
            }
        }

        surface.post { renderFrame() }
    }

    private fun renderFrame() {
        if (!renderer.beginFrame(swapChain)) return
        renderer.render(view)
        renderer.endFrame()
        surface.postOnAnimation { renderFrame() }
    }

    override fun onDestroy() {
        if (::swapChain.isInitialized) engine.destroySwapChain(swapChain)
        if (::renderer.isInitialized) engine.destroyRenderer(renderer)
        if (::view.isInitialized) engine.destroyView(view)
        if (::scene.isInitialized) engine.destroyScene(scene)
        if (::camera.isInitialized) engine.destroyCamera(camera)
        if (::engine.isInitialized) engine.destroy()
        super.onDestroy()
    }
}
