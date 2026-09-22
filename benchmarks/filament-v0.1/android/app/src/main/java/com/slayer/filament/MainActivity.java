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
    private float moveX, moveY, sprint, pass, shoot, tackle;
    private int selectedPlayer = 9;

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
    private static native void nativeSetInput(float moveX, float moveY, float pass, float shoot, float sprint, float tackle, int selected);
    private static native void nativeResetMatch();

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
        addGameControls(root);
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
        passButton.setOnTouchListener((v,e)->{pass=e.getAction()==MotionEvent.ACTION_UP?0:1;nativeSetInput(moveX,moveY,pass,shoot,sprint,tackle,selectedPlayer);return true;});
        shootButton.setOnTouchListener((v,e)->{shoot=e.getAction()==MotionEvent.ACTION_UP?0:1;nativeSetInput(moveX,moveY,pass,shoot,sprint,tackle,selectedPlayer);return true;});
        sprintButton.setOnTouchListener((v,e)->{sprint=e.getAction()==MotionEvent.ACTION_UP?0:1;nativeSetInput(moveX,moveY,pass,shoot,sprint,tackle,selectedPlayer);return true;});
        Button reset=button(root,"RESTART",Gravity.TOP|Gravity.LEFT,24,130);
        reset.setOnClickListener(v->nativeResetMatch());
    }

    private Button button(FrameLayout root,String label,int gravity,int right,int bottom){
        Button b=new Button(this); b.setText(label); b.setTextSize(12); b.setTextColor(Color.WHITE); b.setBackgroundColor(0x88444444);
        FrameLayout.LayoutParams lp=new FrameLayout.LayoutParams(112,72,gravity); lp.rightMargin=right; lp.bottomMargin=bottom; root.addView(b,lp); return b;
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
