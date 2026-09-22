package com.slayer.filament;

import android.app.Activity;
import android.os.Bundle;
import android.view.SurfaceView;
import android.view.Window;
import android.view.WindowManager;

import com.google.android.filament.Engine;
import com.google.android.filament.Renderer;
import com.google.android.filament.Scene;
import com.google.android.filament.SwapChain;
import com.google.android.filament.View;
import com.google.android.filament.Camera;

public final class MainActivity extends Activity {
    private Engine engine;
    private Renderer renderer;
    private SwapChain swapChain;
    private View view;
    private SurfaceView surface;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);

        surface = new SurfaceView(this);
        setContentView(surface);

        engine = Engine.create();
        renderer = engine.createRenderer();
        swapChain = engine.createSwapChain(surface.getSurface());
        view = engine.createView();
        Scene scene = engine.createScene();
        Camera camera = engine.createCamera(engine.getEntityManager().create());
        view.setScene(scene);
        view.setCamera(camera);
        camera.lookAt(0.0, 1.5, 8.0, 0.0, 1.0, 0.0);
        camera.setProjection(45.0, (double) Math.max(1, surface.getWidth()) / Math.max(1, surface.getHeight()), 0.1, 200.0);

        surface.getHolder().addCallback(new android.view.SurfaceHolder.Callback() {
            public void surfaceCreated(android.view.SurfaceHolder h) { }
            public void surfaceChanged(android.view.SurfaceHolder h, int f, int w, int hgt) {
                if (swapChain != null) view.setViewport(new com.google.android.filament.Viewport(0, 0, w, hgt));
                camera.setProjection(45.0, (double)Math.max(1,w)/Math.max(1,hgt), 0.1, 200.0);
            }
            public void surfaceDestroyed(android.view.SurfaceHolder h) { }
        });
    }

    @Override protected void onResume() {
        super.onResume();
        if (surface != null) surface.post(frameRunnable);
    }

    private final Runnable frameRunnable = new Runnable() {
        @Override public void run() {
            if (renderer != null && swapChain != null) {
                if (renderer.beginFrame(swapChain)) {
                    renderer.render(view);
                    renderer.endFrame();
                }
            }
            if (surface != null) surface.postDelayed(this, 16);
        }
    };

    @Override protected void onDestroy() {
        if (engine != null) {
            if (swapChain != null) engine.destroySwapChain(swapChain);
            if (view != null) engine.destroyView(view);
            if (renderer != null) engine.destroyRenderer(renderer);
            engine.destroy();
        }
        super.onDestroy();
    }
}
