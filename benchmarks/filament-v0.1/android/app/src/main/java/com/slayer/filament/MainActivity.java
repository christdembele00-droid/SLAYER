package com.slayer.filament;

import android.app.Activity;
import android.os.Bundle;
import android.view.SurfaceHolder;
import android.view.SurfaceView;
import android.view.Window;
import android.view.WindowManager;
import android.view.MotionEvent;
import android.view.View;
import android.widget.Button;
import android.graphics.Color;
import android.view.Gravity;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.content.Intent;
import android.net.Uri;
import java.io.ByteArrayOutputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.io.FileOutputStream;
import java.io.PrintWriter;
import java.util.Locale;

public final class MainActivity extends Activity {
    static {
        System.loadLibrary("slayer_filament_benchmark");
    }

    private SurfaceView surface;
    private TextView statsView;
    private long lastFrameNanos;
    private float moveX, moveY, sprint, pass, shoot, tackle;
    private int selectedPlayer = 9;
    private int testScenario = 0;
    private long testStartNanos = 0L;
    private Uri testLogUri;
    private int testPhase = 0;

    private static native void nativeCreate(android.view.Surface surface);
    private static native boolean nativeLoadTerrainMaterial(byte[] data);
    private static native boolean nativeLoadEnvironment(byte[] data);
    private static native boolean nativeLoadSkybox(byte[] data);
    private static native boolean nativeLoadPlayer(byte[] data);
    private static native boolean nativeLoadStadium(byte[] data);
    private static native float nativeGetFps();
    private static native float nativeGetFrameMs();
    private static native int nativeGetDrawCalls();
    private static native int nativeGetPlayerCount();
    private static native int nativeGetHomeScore();
    private static native int nativeGetAwayScore();
    private static native void nativeResize(int width, int height);
    private static native void nativeRender(float deltaSeconds);
    private static native void nativeDestroy();
    private static native void nativeSetInput(float moveX, float moveY, float pass, float shoot, float sprint, float tackle, int selected);
    private static native void nativeResetMatch();
    private static native void nativeSetSettings(int duration, boolean extraTime, boolean penalties, int substitutions, int conditionRandom,
            int timeMode, int weatherMode, int grassMode, int stadium, int ball, int control, int passAssist, int shotAssist,
            int cursor, int pressing, int attack, int targetFps, int quality, boolean dynamicResolution, int cameraMode,
            boolean radar, int commentary, float music, float commentaryVolume, float crowd, float effects);

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        testScenario = readTestScenario(getIntent());
        testLogUri = getIntent().getData();
        if (testScenario > 0) {
            android.util.Log.i("SLAYER_TEST", "Starting Game Loop scenario " + testScenario);
        }

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
        addGameControls(root);
        surface.getHolder().addCallback(new SurfaceHolder.Callback() {
            @Override
            public void surfaceCreated(SurfaceHolder holder) {
                nativeCreate(holder.getSurface());
                nativeSetSettings(10, true, true, 5, 1, 0, 0, 0, 0, 0, 1, 2, 0, 1, 0, 1, 60, 2, true, 0, true, 0, .55f, .85f, .80f, .90f);
                loadBundledEnvironment();
                loadBundledTerrainMaterial();
                loadBundledStadium();
                loadBundledPlayer();
                lastFrameNanos = System.nanoTime();
                testStartNanos = lastFrameNanos;
                surface.postOnAnimation(frameRunnable);
            }

            @Override
            public void surfaceChanged(SurfaceHolder holder, int format, int width, int height) {
                nativeResize(width, height);
            }

            @Override
            public void surfaceDestroyed(SurfaceHolder holder) {
                nativeDestroy();
            }
        });

        setContentView(root);
    }

    private int readTestScenario(Intent intent) {
        if (!"com.google.intent.action.TEST_LOOP".equals(intent.getAction())) return 0;
        return intent.getIntExtra("scenario", 1);
    }

    private void addGameControls(FrameLayout root) {
        TextView stick = new TextView(this);
        stick.setText("◉"); stick.setTextSize(38); stick.setTextColor(Color.WHITE);
        stick.setGravity(Gravity.CENTER); stick.setBackgroundColor(0x55333333);
        FrameLayout.LayoutParams sp = new FrameLayout.LayoutParams(180,180,Gravity.BOTTOM|Gravity.LEFT);
        sp.leftMargin=28; sp.bottomMargin=36; root.addView(stick,sp);
        stick.setOnTouchListener((v,e)->{
            if(e.getAction()==MotionEvent.ACTION_UP){moveX=moveY=0;}
            else {float cx=90,cy=90; moveX=Math.max(-1,Math.min(1,(e.getX()-cx)/70)); moveY=Math.max(-1,Math.min(1,(e.getY()-cy)/70));}
            nativeSetInput(moveX,moveY,pass,shoot,sprint,tackle,selectedPlayer); return true;
        });
        Button passButton=button(root,"PASS",Gravity.BOTTOM|Gravity.RIGHT,250,36);
        Button shootButton=button(root,"TIR",Gravity.BOTTOM|Gravity.RIGHT,125,130);
        Button sprintButton=button(root,"SPRINT",Gravity.BOTTOM|Gravity.RIGHT,260,150);
        Button tackleButton=button(root,"TACLE",Gravity.BOTTOM|Gravity.RIGHT,390,36);
        passButton.setOnTouchListener((v,e)->{pass=e.getAction()==MotionEvent.ACTION_UP?0:1;nativeSetInput(moveX,moveY,pass,shoot,sprint,tackle,selectedPlayer);return true;});
        shootButton.setOnTouchListener((v,e)->{shoot=e.getAction()==MotionEvent.ACTION_UP?0:1;nativeSetInput(moveX,moveY,pass,shoot,sprint,tackle,selectedPlayer);return true;});
        sprintButton.setOnTouchListener((v,e)->{sprint=e.getAction()==MotionEvent.ACTION_UP?0:1;nativeSetInput(moveX,moveY,pass,shoot,sprint,tackle,selectedPlayer);return true;});
        tackleButton.setOnTouchListener((v,e)->{tackle=e.getAction()==MotionEvent.ACTION_UP?0:1;nativeSetInput(moveX,moveY,pass,shoot,sprint,tackle,selectedPlayer);return true;});
        Button reset=button(root,"RESTART",Gravity.TOP|Gravity.LEFT,24,130);
        reset.setOnClickListener(v->nativeResetMatch());
    }

    private Button button(FrameLayout root,String label,int gravity,int right,int bottom){
        Button b=new Button(this); b.setText(label); b.setTextSize(12); b.setTextColor(Color.WHITE); b.setBackgroundColor(0x88444444);
        FrameLayout.LayoutParams lp=new FrameLayout.LayoutParams(112,72,gravity); lp.rightMargin=right; lp.bottomMargin=bottom; root.addView(b,lp); return b;
    }

    private void applyGameLoopScenario(long elapsedMs) {
        if (testScenario <= 0 || elapsedMs < 250) return;

        switch (testScenario) {
            case 1: // player-experience: movement + all action controls
                if (elapsedMs < 1800) nativeSetInput(0.85f, -0.20f, 0, 0, 1, 0, selectedPlayer);
                else if (elapsedMs < 2600) nativeSetInput(0, 0, 1, 0, 0, 0, selectedPlayer);
                else if (elapsedMs < 3600) nativeSetInput(0.55f, 0.10f, 0, 1, 1, 0, selectedPlayer);
                else if (elapsedMs < 4500) nativeSetInput(-0.45f, 0.0f, 0, 0, 0, 1, selectedPlayer);
                else if (elapsedMs < 5200) nativeSetInput(0, 0, 0, 0, 0, 0, selectedPlayer);
                else finishGameLoop("player_experience");
                break;
            case 2: // GPU compatibility
                nativeSetInput(0.45f, 0.35f, 0, 0, 1, 0, selectedPlayer);
                if (elapsedMs >= 15000) finishGameLoop("gpu_compatibility");
                break;
            case 3: // performance
                nativeSetInput(0.70f, -0.25f, 0, 0, 1, 0, selectedPlayer);
                if (elapsedMs >= 30000) finishGameLoop("performance");
                break;
            case 4: // compatibility / repeated control and render cycle
                if ((elapsedMs / 700) % 2 == 0) nativeSetInput(0.35f, 0, 1, 0, 0, 0, selectedPlayer);
                else nativeSetInput(0, 0, 0, 1, 0, 1, selectedPlayer);
                if (elapsedMs >= 10000) finishGameLoop("compatibility");
                break;
            case 5: // full match smoke loop
                nativeSetInput(0.6f, 0, 0, 0, 1, 0, selectedPlayer);
                if (elapsedMs >= 60000) finishGameLoop("full_match_smoke");
                break;
            default:
                finishGameLoop("unknown");
                break;
        }
    }

    private void finishGameLoop(String name) {
        if (testPhase != 0) return;
        testPhase = 1;
        long elapsedMs = (System.nanoTime() - testStartNanos) / 1_000_000L;
        String json = String.format(Locale.US,
                "{\"name\":\"SLAYER %s\",\"scenario\":%d,\"elapsed_ms\":%d,\"fps\":%.2f,\"frame_ms\":%.3f,\"draw_calls\":%d,\"players\":%d,\"home_score\":%d,\"away_score\":%d,\"input_path\":\"native_game_loop\"}",
                name, testScenario, elapsedMs, nativeGetFps(), nativeGetFrameMs(), nativeGetDrawCalls(),
                nativeGetPlayerCount(), nativeGetHomeScore(), nativeGetAwayScore());
        writeTestLog(json);
        android.util.Log.i("SLAYER_TEST", json);
        finish();
    }

    private void writeTestLog(String json) {
        if (testLogUri == null) return;
        try (FileOutputStream output = new FileOutputStream(
                getContentResolver().openAssetFileDescriptor(testLogUri, "w").getFileDescriptor())) {
            output.write(json.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        } catch (Exception e) {
            android.util.Log.w("SLAYER_TEST", "Could not write Test Lab output", e);
        }
    }

    private void loadBundledEnvironment() {
        try {
            byte[] ibl = readAssetBytes("ibl/orlando_stadium/orlando_stadium_1k_ibl.ktx");
            byte[] skybox = readAssetBytes("ibl/orlando_stadium/orlando_stadium_1k_skybox.ktx");
            if (!nativeLoadEnvironment(ibl)) android.util.Log.w("SLAYER", "Orlando Stadium IBL could not be loaded");
            if (!nativeLoadSkybox(skybox)) android.util.Log.w("SLAYER", "Orlando Stadium skybox could not be loaded");
        } catch (IOException e) {
            android.util.Log.i("SLAYER", "No generated Orlando Stadium IBL; keeping direct stadium lights");
        }
    }

    private byte[] readAssetBytes(String path) throws IOException {
        try (InputStream input = getAssets().open(path);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
            return output.toByteArray();
        }
    }

    private void loadBundledStadium() {
        try {
            byte[] data = readAssetBytes("models/pitch.glb");
            if (!nativeLoadStadium(data)) android.util.Log.w("SLAYER", "Bundled stadium asset could not be loaded");
        } catch (IOException e) {
            android.util.Log.i("SLAYER", "No bundled pitch/stadium asset");
        }
    }

    private void loadBundledTerrainMaterial() {
        try (InputStream input = getAssets().open("materials/grass.filamat");
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[16 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
            if (!nativeLoadTerrainMaterial(output.toByteArray())) android.util.Log.w("SLAYER", "materials/grass.filamat could not be loaded");
        } catch (IOException e) {
            android.util.Log.i("SLAYER", "No compiled grass material yet; keeping default terrain");
        }
    }

    private void loadBundledPlayer() {
        try {
            byte[] data;
            try {
                data = readAssetBytes("models/player.glb");
            } catch (IOException missingGlb) {
                data = readAssetBytes("models/player.gltf");
            }
            if (!nativeLoadPlayer(data)) android.util.Log.w("SLAYER", "Bundled player asset could not be loaded");
        } catch (IOException e) {
            android.util.Log.i("SLAYER", "No bundled player asset");
        }
    }

    private final Runnable frameRunnable = new Runnable() {
        @Override
        public void run() {
            if (surface == null || !surface.getHolder().getSurface().isValid()) return;
            long now = System.nanoTime();
            float dt = (now - lastFrameNanos) / 1_000_000_000.0f;
            lastFrameNanos = now;
            nativeRender(dt);
            statsView.setText(String.format(Locale.US,
                    "SLAYER • FILAMENT / VULKAN\\n%.1f FPS • %.2f ms\\nScore %d - %d\\nDraws %d • Players %d",
                    nativeGetFps(), nativeGetFrameMs(), nativeGetHomeScore(), nativeGetAwayScore(), nativeGetDrawCalls(), nativeGetPlayerCount()));
            applyGameLoopScenario((System.nanoTime() - testStartNanos) / 1_000_000L);
            surface.postOnAnimation(this);
        }
    };

    @Override
    protected void onDestroy() {
        if (surface != null && surface.getHolder().getSurface().isValid()) nativeDestroy();
        surface = null;
        super.onDestroy();
    }
}