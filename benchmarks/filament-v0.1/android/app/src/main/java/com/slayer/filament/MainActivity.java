package com.slayer.filament;

import android.app.Activity;
import android.os.Bundle;
import android.view.SurfaceHolder;
import android.view.SurfaceView;
import android.view.Window;
import android.view.WindowManager;
import android.graphics.Color;
import android.view.Gravity;
import android.widget.FrameLayout;
import android.widget.TextView;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;

public final class MainActivity extends Activity {
    static {
        System.loadLibrary("slayer_filament_benchmark");
    }

    private SurfaceView surface;
    private TextView statsView;
    private long lastFrameNanos;

    private static native void nativeCreate(android.view.Surface surface);
    private static native boolean nativeLoadTerrainMaterial(byte[] data);
    private static native boolean nativeLoadEnvironment(byte[] data);
    private static native boolean nativeLoadPlayer(byte[] data);
    private static native boolean nativeLoadStadium(byte[] data);
    private static native float nativeGetFps();
    private static native float nativeGetFrameMs();
    private static native int nativeGetDrawCalls();
    private static native int nativeGetPlayerCount();
    private static native void nativeResize(int width, int height);
    private static native void nativeRender(float deltaSeconds);
    private static native void nativeDestroy();

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN);

        FrameLayout root = new FrameLayout(this);
        surface = new SurfaceView(this);
        root.addView(surface, new FrameLayout.LayoutParams(-1, -1));
        statsView = new TextView(this);
        statsView.setTextColor(Color.WHITE);
        statsView.setTextSize(13f);
        statsView.setPadding(16, 10, 16, 10);
        statsView.setBackgroundColor(0x66000000);
        FrameLayout.LayoutParams p = new FrameLayout.LayoutParams(-2, -2, Gravity.TOP | Gravity.RIGHT);
        p.topMargin = 18; p.rightMargin = 18;
        root.addView(statsView, p);
        surface.getHolder().addCallback(new SurfaceHolder.Callback() {
            @Override
            public void surfaceCreated(SurfaceHolder holder) {
                nativeCreate(holder.getSurface());
                loadBundledEnvironment();
                loadBundledTerrainMaterial();
                loadBundledStadium();
                loadBundledPlayer();
                lastFrameNanos = System.nanoTime();
                surface.postOnAnimation(frameRunnable);
            }

            @Override
            public void surfaceChanged(
                    SurfaceHolder holder, int format, int width, int height) {
                nativeResize(width, height);
            }

            @Override
            public void surfaceDestroyed(SurfaceHolder holder) {
                nativeDestroy();
            }
        });

        setContentView(root);
    }


    private void loadBundledEnvironment() {
        try (InputStream input = getAssets().open("ibl/stadium_ibl.ktx");
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
            if (!nativeLoadEnvironment(output.toByteArray())) {
                android.util.Log.w("SLAYER", "ibl/stadium_ibl.ktx could not be loaded");
            }
        } catch (IOException e) {
            android.util.Log.i("SLAYER", "No bundled IBL yet; keeping direct stadium lights");
        }
    }

    private void loadBundledStadium() {
        try (InputStream input = getAssets().open("models/stadium.glb");
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
            nativeLoadStadium(output.toByteArray());
        } catch (IOException e) {
            android.util.Log.i("SLAYER", "No bundled stadium.glb");
        }
    }

    private void loadBundledTerrainMaterial() {
        try (InputStream input = getAssets().open("materials/grass.filamat");
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[16 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
            if (!nativeLoadTerrainMaterial(output.toByteArray())) {
                android.util.Log.w("SLAYER", "materials/grass.filamat could not be loaded");
            }
        } catch (IOException e) {
            android.util.Log.i("SLAYER", "No compiled grass material yet; keeping default terrain");
        }
    }

    private void loadBundledPlayer() {
        try (InputStream input = getAssets().open("models/player.glb");
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
            boolean loaded = nativeLoadPlayer(output.toByteArray());
            if (!loaded) {
                android.util.Log.w("SLAYER", "models/player.glb could not be loaded");
            }
        } catch (IOException e) {
            android.util.Log.i("SLAYER", "No bundled player.glb yet; keeping native proxy");
        }
    }

    private final Runnable frameRunnable = new Runnable() {
        @Override
        public void run() {
            if (surface == null || !surface.getHolder().getSurface().isValid()) {
                return;
            }

            long now = System.nanoTime();
            float dt = (now - lastFrameNanos) / 1_000_000_000.0f;
            lastFrameNanos = now;

            nativeRender(dt);
            statsView.setText(String.format(java.util.Locale.US,
                    "SLAYER • FILAMENT / VULKAN\\n%.1f FPS • %.2f ms\\nDraws %d • Players %d",
                    nativeGetFps(), nativeGetFrameMs(), nativeGetDrawCalls(), nativeGetPlayerCount()));
            surface.postOnAnimation(this);
        }
    };

    @Override
    protected void onDestroy() {
        if (surface != null && surface.getHolder().getSurface().isValid()) {
            nativeDestroy();
        }
        surface = null;
        super.onDestroy();
    }
}
