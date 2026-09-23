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
    private FrameLayout root;
    private FrameLayout menuOverlay;
    private TextView loadingText;
    private boolean menuVisible = false;
    private boolean matchStarted = false;
    private boolean nativeReady = false;
    private View menuBackground;
    private long menuOpenedAt = 0L;
    private View activePage = null;
    private FrameLayout gameControls = null;

    private static native boolean nativeCreate(android.view.Surface surface);
    private static native boolean nativeLoadTerrainMaterial(byte[] data);
    private static native boolean nativeLoadEnvironment(byte[] data);
    private static native boolean nativeLoadSkybox(byte[] data);
    private static native boolean nativeLoadPlayer(byte[] data);
    private static native boolean nativeLoadStadium(byte[] data);
    private static native boolean nativeLoadBall(byte[] data);
    private static native boolean nativeLoadGoal(byte[] data);
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

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN);

        root = new FrameLayout(this);

        surface = new SurfaceView(this);
        root.addView(surface, new FrameLayout.LayoutParams(-1, -1));

        statsView = new TextView(this);
        statsView.setTextColor(Color.WHITE);
        statsView.setTextSize(12f);
        statsView.setPadding(uiPx(18), uiPx(12), uiPx(18), uiPx(12));
        statsView.setBackgroundColor(0x66000000);
        statsView.setVisibility(View.GONE);
        FrameLayout.LayoutParams statsParams =
                new FrameLayout.LayoutParams(-2, -2, Gravity.TOP | Gravity.RIGHT);
        statsParams.topMargin = uiPx(18);
        statsParams.rightMargin = uiPx(18);
        root.addView(statsView, statsParams);

        surface.getHolder().addCallback(new SurfaceHolder.Callback() {
            @Override
            public void surfaceCreated(SurfaceHolder holder) {
                android.util.Log.i("SLAYER", "Android surface ready; native engine deferred");
                if (testScenario > 0) {
                    startMatch();
                } else {
                    showSplashAndLoading();
                }
            }

            @Override
            public void surfaceChanged(SurfaceHolder holder, int format, int width, int height) {
                if (nativeReady) nativeResize(width, height);
            }

            @Override
            public void surfaceDestroyed(SurfaceHolder holder) {
                if (nativeReady) {
                    nativeDestroy();
                    nativeReady = false;
                }
                matchStarted = false;
                menuVisible = false;
                removeGameControls();
                if (statsView != null) statsView.setVisibility(View.GONE);
            }
        });

        setContentView(root);
    }

    private void showSplashAndLoading() {
        menuVisible = false;

        final FrameLayout splash = new FrameLayout(this);
        splash.setBackgroundColor(Color.BLACK);

        TextView logo = menuLabel("SLAYER", 46f, true);
        logo.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(-1, -2, Gravity.CENTER);
        splash.addView(logo, lp);

        TextView sub = menuLabel("FOOTBALL 2026", 14f, false);
        sub.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams sp = new FrameLayout.LayoutParams(-1, uiPx(50), Gravity.CENTER);
        sp.topMargin = uiPx(92);
        splash.addView(sub, sp);

        root.addView(splash, new FrameLayout.LayoutParams(-1, -1));
        splash.postDelayed(() -> {
            if (splash.getParent() != null) root.removeView(splash);
            showLoadingScreen();
        }, 2000L);
    }

    private void showLoadingScreen() {
        final FrameLayout loading = new FrameLayout(this);
        loading.setBackgroundColor(0xFF06101C);

        TextView title = menuLabel("SLAYER", 30f, true);
        title.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams tp = new FrameLayout.LayoutParams(-1, uiPx(70), Gravity.TOP);
        tp.topMargin = uiPx(42);
        loading.addView(title, tp);

        TextView scene = menuLabel("STADE  •  ATLAS FC  ×  LAGOON UNITED", 13f, false);
        scene.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams sc = new FrameLayout.LayoutParams(-1, uiPx(50), Gravity.CENTER);
        sc.topMargin = -uiPx(40);
        loading.addView(scene, sc);

        loadingText = menuLabel("CHARGEMENT\n\n● ● ●", 18f, true);
        loadingText.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams cp = new FrameLayout.LayoutParams(-1, uiPx(180), Gravity.CENTER);
        loading.addView(loadingText, cp);

        TextView status = menuLabel("Préparation de l'expérience SLAYER", 12f, false);
        status.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams st = new FrameLayout.LayoutParams(-1, uiPx(50), Gravity.BOTTOM);
        st.bottomMargin = uiPx(48);
        loading.addView(status, st);

        root.addView(loading, new FrameLayout.LayoutParams(-1, -1));

        // No network is required for the menu. The game enters the native renderer
        // only when the user explicitly launches a match.
        loading.postDelayed(() -> {
            if (loading.getParent() != null) root.removeView(loading);
            showMainMenu();
        }, 1600L);
    }

    private void showMainMenu() {
        if (activePage != null && activePage.getParent() != null) root.removeView(activePage);
        activePage = null;
        if (menuOverlay != null) root.removeView(menuOverlay);

        menuVisible = true;
        matchStarted = false;
        statsView.setVisibility(View.GONE);
        menuOpenedAt = System.nanoTime();

        menuOverlay = new FrameLayout(this);

        // Football-style dark navy + electric blue + yellow accent palette,
        // inspired by modern football game menus without copying branded assets.
        menuBackground = new MenuBackgroundView(this);
        menuOverlay.addView(menuBackground, new FrameLayout.LayoutParams(-1, -1));

        View shade = new View(this);
        shade.setBackgroundColor(0x55000000);
        menuOverlay.addView(shade, new FrameLayout.LayoutParams(-1, -1));

        TextView brand = menuLabel("SLAYER", 30f, true);
        FrameLayout.LayoutParams bp = new FrameLayout.LayoutParams(uiPx(300), uiPx(64), Gravity.TOP | Gravity.LEFT);
        bp.leftMargin = uiPx(28); bp.topMargin = uiPx(18);
        menuOverlay.addView(brand, bp);

        TextView season = menuLabel("FOOTBALL 2026", 12f, false);
        season.setTextColor(0xFFFFFF66);
        FrameLayout.LayoutParams sep = new FrameLayout.LayoutParams(uiPx(220), uiPx(40), Gravity.TOP | Gravity.LEFT);
        sep.leftMargin = uiPx(32); sep.topMargin = uiPx(70);
        menuOverlay.addView(season, sep);

        Button settings = menuButton("⚙", 22f);
        FrameLayout.LayoutParams setp = new FrameLayout.LayoutParams(uiPx(70), uiPx(60), Gravity.TOP | Gravity.RIGHT);
        setp.rightMargin = uiPx(22); setp.topMargin = uiPx(18);
        menuOverlay.addView(settings, setp);
        settings.setOnClickListener(v -> showSettingsCard());

        TextView hero = menuLabel("MATCHDAY", 12f, true);
        hero.setTextColor(0xFFFFFF66);
        hero.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams hp = new FrameLayout.LayoutParams(-1, 40, Gravity.TOP);
        hp.topMargin = uiPx(112);
        menuOverlay.addView(hero, hp);

        TextView teams = menuLabel("ATLAS FC     VS     LAGOON UNITED", 20f, true);
        teams.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams teamsP = new FrameLayout.LayoutParams(-1, 60, Gravity.TOP);
        teamsP.topMargin = uiPx(142);
        menuOverlay.addView(teams, teamsP);

        Button quick = menuButton("▶  MATCH RAPIDE", 18f);
        quick.setTextColor(Color.BLACK);
        quick.setBackgroundColor(0xFFFFD400);
        FrameLayout.LayoutParams qp = new FrameLayout.LayoutParams(uiPx(390), uiPx(70), Gravity.TOP | Gravity.CENTER_HORIZONTAL);
        qp.topMargin = uiPx(225);
        menuOverlay.addView(quick, qp);
        quick.setOnClickListener(v -> startMatch());

        // Two-column mode grid: no overlapping text and no accidental horizontal stacking.
        addModeCard("CARRIÈRE", 20, 310, 250, 64, () -> showModeScreen("CARRIÈRE",
                "CLUB  •  SAISON  •  CHAMPIONNAT  •  TRANSFERTS"));
        addModeCard("COMPÉTITION", 285, 310, 250, 64, () -> showModeScreen("COMPÉTITION",
                "LIGUES  •  COUPES  •  TOURNOIS"));
        addModeCard("ENTRAÎNEMENT", 20, 386, 250, 64, () -> showModeScreen("ENTRAÎNEMENT",
                "TIR  •  PASSE  •  DRIBBLE  •  DÉFENSE"));
        addModeCard("ÉQUIPE", 285, 386, 250, 64, () -> showModeScreen("ÉQUIPE",
                "EFFECTIF  •  TACTIQUES  •  KITS  •  PROGRESSION"));

        Button profile = menuButton("PROFIL", 13f);
        FrameLayout.LayoutParams pp = new FrameLayout.LayoutParams(uiPx(150), uiPx(48), Gravity.BOTTOM | Gravity.LEFT);
        pp.leftMargin = uiPx(22); pp.bottomMargin = uiPx(20);
        menuOverlay.addView(profile, pp);
        profile.setOnClickListener(v -> showModeScreen("PROFIL", "JOUEUR  •  PROGRESSION  •  STATISTIQUES"));

        Button other = menuButton("AUTRES", 13f);
        FrameLayout.LayoutParams op = new FrameLayout.LayoutParams(uiPx(150), uiPx(48), Gravity.BOTTOM | Gravity.RIGHT);
        op.rightMargin = uiPx(22); op.bottomMargin = uiPx(20);
        menuOverlay.addView(other, op);
        other.setOnClickListener(v -> showModeScreen("AUTRES", "AIDE  •  INFORMATIONS  •  OPTIONS"));

        root.addView(menuOverlay, new FrameLayout.LayoutParams(-1, -1));
    }

    private void addModeCard(String text, int left, int top, int width, int height, Runnable action) {
        Button b = menuButton(text, 14f);
        FrameLayout.LayoutParams p = new FrameLayout.LayoutParams(uiPx(width), uiPx(height), Gravity.TOP | Gravity.LEFT);
        p.leftMargin = uiPx(left);
        p.topMargin = uiPx(top);
        menuOverlay.addView(b, p);
        b.setOnClickListener(v -> action.run());
    }

    private void showModeScreen(String title, String details) {
        final FrameLayout page = new FrameLayout(this);
        page.setBackgroundColor(0xFF07111E);

        TextView t = menuLabel(title, 30f, true);
        FrameLayout.LayoutParams tp = new FrameLayout.LayoutParams(-1, uiPx(70), Gravity.TOP);
        tp.topMargin = uiPx(42); tp.leftMargin = uiPx(30);
        page.addView(t, tp);

        TextView d = menuLabel(details, 15f, false);
        d.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams dp = new FrameLayout.LayoutParams(-1, uiPx(160), Gravity.CENTER);
        page.addView(d, dp);

        Button back = menuButton("‹  RETOUR", 14f);
        FrameLayout.LayoutParams bp = new FrameLayout.LayoutParams(uiPx(170), uiPx(56), Gravity.BOTTOM | Gravity.LEFT);
        bp.leftMargin = uiPx(24); bp.bottomMargin = uiPx(24);
        page.addView(back, bp);
        back.setOnClickListener(v -> {
            root.removeView(page);
            showMainMenu();
        });

        activePage = page;
        root.addView(page, new FrameLayout.LayoutParams(-1, -1));
    }

    private void showSettingsCard() {
        showModeScreen("PARAMÈTRES", "GRAPHISMES  •  VULKAN  •  COMMANDES  •  AUDIO");
    }

    private void startMatch() {
        if (matchStarted) return;
        matchStarted = true;
        menuVisible = false;

        if (menuOverlay != null) {
            root.removeView(menuOverlay);
            menuOverlay = null;
        }

        statsView.setVisibility(View.VISIBLE);

        // Initialize the native renderer only now. This isolates the menu from
        // missing/invalid production assets and prevents the app from closing
        // while the player is still on the home screen.
        if (!nativeReady) {
            android.view.Surface nativeSurface = surface.getHolder().getSurface();
            if (nativeSurface == null || !nativeSurface.isValid()) {
                matchStarted = false;
                menuVisible = true;
                showMainMenu();
                android.widget.Toast.makeText(this, "Surface graphique indisponible. Réessayez.", android.widget.Toast.LENGTH_SHORT).show();
                return;
            }
            if (!nativeCreate(nativeSurface)) {
                matchStarted = false;
                menuVisible = true;
                statsView.setVisibility(View.GONE);
                showMainMenu();
                android.widget.Toast.makeText(this, "Vulkan indisponible sur cet appareil.", android.widget.Toast.LENGTH_LONG).show();
                return;
            }
            nativeReady = true;
            nativeSetSettings(10, true, true, 5, 1, 0, 0, 0, 0, 0, 1, 2, 0, 1, 0, 1,
                    60, 2, true, 0, true, 0, .55f, .85f, .80f, .90f);
            loadBundledEnvironment();
            loadBundledTerrainMaterial();
            loadBundledStadium();
            loadBundledBallAndGoals();
            loadBundledPlayer();
            android.util.Log.i("SLAYER", "Native match renderer initialized");
        } else {
            nativeResetMatch();
        }

        removeGameControls();
        addGameControls(root);
        lastFrameNanos = System.nanoTime();
        testStartNanos = lastFrameNanos;
        surface.postOnAnimation(frameRunnable);
    }

    private static final class MenuBackgroundView extends View {
        private final android.graphics.Paint paint = new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);
        private final android.graphics.LinearGradient gradient;

        MenuBackgroundView(android.content.Context context) {
            super(context);
            gradient = new android.graphics.LinearGradient(
                    0, 0, 0, 900,
                    new int[]{0xFF04101C, 0xFF0A3151, 0xFF02070D},
                    null, android.graphics.Shader.TileMode.CLAMP);
        }

        @Override
        protected void onDraw(android.graphics.Canvas canvas) {
            super.onDraw(canvas);
            paint.setShader(gradient);
            canvas.drawRect(0, 0, getWidth(), getHeight(), paint);
            paint.setShader(null);

            // Abstract stadium lights / pitch perspective, so the menu is never
            // an empty black screen while real 3D menu art is being integrated.
            paint.setColor(0x332FA8FF);
            canvas.drawOval(-180, getHeight() - 260, getWidth() + 180, getHeight() + 220, paint);
            paint.setColor(0x55FFFFFF);
            for (int i = 0; i < 8; i++) {
                float x = 30 + i * (getWidth() - 60) / 7f;
                canvas.drawCircle(x, 120 + (i % 2) * 18, 3.5f, paint);
            }
            paint.setStyle(android.graphics.Paint.Style.STROKE);
            paint.setStrokeWidth(2);
            paint.setColor(0x3388CCFF);
            canvas.drawArc(-getWidth(), getHeight() - 300, getWidth() * 2, getHeight() + 300, 190, 160, false, paint);
            paint.setStyle(android.graphics.Paint.Style.FILL);
        }
    }

    private TextView menuLabel(String text, float size, boolean bold) {
        TextView v = new TextView(this);
        v.setText(text);
        v.setTextColor(Color.WHITE);
        v.setTextSize(size);
        v.setGravity(Gravity.CENTER_VERTICAL);
        if (bold) v.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        return v;
    }

    private Button menuButton(String text, float size) {
        Button b = new Button(this);
        b.setText(text);
        b.setTextColor(Color.WHITE);
        b.setTextSize(size);
        b.setAllCaps(false);
        b.setGravity(Gravity.CENTER);
        b.setBackgroundColor(0xB31B1D22);
        return b;
    }

    private void showModeMessage(String title, String details) {
        android.widget.Toast.makeText(this, title + " — " + details, android.widget.Toast.LENGTH_SHORT).show();
    }

    private int readTestScenario(Intent intent) {
        if (!"com.google.intent.action.TEST_LOOP".equals(intent.getAction())) return 0;
        return intent.getIntExtra("scenario", 1);
    }

    private void addGameControls(FrameLayout root) {
        TextView stick = new TextView(this);
        stick.setText("◉");
        stick.setTextSize(38);
        stick.setTextColor(Color.WHITE);
        stick.setGravity(Gravity.CENTER);
        stick.setBackgroundColor(0x55333333);
        if (gameControls != null) root.removeView(gameControls);
        gameControls = new FrameLayout(this);
        root.addView(gameControls, new FrameLayout.LayoutParams(-1, -1));
        FrameLayout controlRoot = gameControls;
        FrameLayout.LayoutParams sp =
                new FrameLayout.LayoutParams(uiPx(180), uiPx(180), Gravity.BOTTOM | Gravity.LEFT);
        sp.leftMargin = uiPx(28);
        sp.bottomMargin = uiPx(36);
        controlRoot.addView(stick, sp);

        stick.setOnTouchListener((v, e) -> {
            if (e.getAction() == MotionEvent.ACTION_UP || e.getAction() == MotionEvent.ACTION_CANCEL || e.getAction() == MotionEvent.ACTION_POINTER_UP) {
                moveX = moveY = 0;
            } else {
                float cx = v.getWidth() * 0.5f, cy = v.getHeight() * 0.5f;
                float radius = Math.max(1.0f, Math.min(v.getWidth(), v.getHeight()) * 0.39f);
                moveX = Math.max(-1, Math.min(1, (e.getX() - cx) / radius));
                moveY = Math.max(-1, Math.min(1, (e.getY() - cy) / radius));
            }
            nativeSetInput(moveX, moveY, pass, shoot, sprint, tackle, selectedPlayer);
            return true;
        });

        Button passButton = button(controlRoot, "PASS", Gravity.BOTTOM | Gravity.RIGHT, 250, 36);
        Button shootButton = button(controlRoot, "TIR", Gravity.BOTTOM | Gravity.RIGHT, 125, 130);
        Button sprintButton = button(controlRoot, "SPRINT", Gravity.BOTTOM | Gravity.RIGHT, 260, 150);
        Button tackleButton = button(controlRoot, "TACKLE", Gravity.BOTTOM | Gravity.RIGHT, 390, 36);

        passButton.setOnTouchListener((v, e) -> {
            pass = (e.getAction() == MotionEvent.ACTION_UP || e.getAction() == MotionEvent.ACTION_CANCEL || e.getAction() == MotionEvent.ACTION_POINTER_UP) ? 0 : 1;
            nativeSetInput(moveX, moveY, pass, shoot, sprint, tackle, selectedPlayer);
            return true;
        });
        shootButton.setOnTouchListener((v, e) -> {
            shoot = (e.getAction() == MotionEvent.ACTION_UP || e.getAction() == MotionEvent.ACTION_CANCEL || e.getAction() == MotionEvent.ACTION_POINTER_UP) ? 0 : 1;
            nativeSetInput(moveX, moveY, pass, shoot, sprint, tackle, selectedPlayer);
            return true;
        });
        sprintButton.setOnTouchListener((v, e) -> {
            sprint = (e.getAction() == MotionEvent.ACTION_UP || e.getAction() == MotionEvent.ACTION_CANCEL || e.getAction() == MotionEvent.ACTION_POINTER_UP) ? 0 : 1;
            nativeSetInput(moveX, moveY, pass, shoot, sprint, tackle, selectedPlayer);
            return true;
        });
        tackleButton.setOnTouchListener((v, e) -> {
            tackle = (e.getAction() == MotionEvent.ACTION_UP || e.getAction() == MotionEvent.ACTION_CANCEL || e.getAction() == MotionEvent.ACTION_POINTER_UP) ? 0 : 1;
            nativeSetInput(moveX, moveY, pass, shoot, sprint, tackle, selectedPlayer);
            return true;
        });

        Button reset = button(controlRoot, "RESTART", Gravity.TOP | Gravity.LEFT, 24, 130);
        reset.setOnClickListener(v -> nativeResetMatch());
    }

    private Button button(FrameLayout root,String label,int gravity,int right,int bottom){
        Button b=new Button(this);
        b.setText(label); b.setTextSize(12); b.setTextColor(Color.WHITE); b.setBackgroundColor(0x88444444);
        FrameLayout.LayoutParams lp=new FrameLayout.LayoutParams(uiPx(112),uiPx(72),gravity);
        lp.rightMargin=uiPx(right); lp.bottomMargin=uiPx(bottom);
        root.addView(b,lp); return b;
    }

    private int uiPx(float value) {
        android.util.DisplayMetrics dm = getResources().getDisplayMetrics();
        float widthScale = dm.widthPixels / 600.0f;
        float heightScale = dm.heightPixels / 400.0f;
        float scale = Math.max(0.75f, Math.min(1.35f, Math.min(widthScale, heightScale)));
        return Math.max(1, Math.round(value * scale));
    }

    private void removeGameControls() {
        if (gameControls != null) {
            root.removeView(gameControls);
            gameControls = null;
        }
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

    private void loadBundledBallAndGoals() {
        try {
            byte[] ball = readAssetBytes("models/ball.glb");
            if (!nativeLoadBall(ball)) android.util.Log.w("SLAYER", "Bundled ball asset could not be loaded");
        } catch (IOException e) {
            android.util.Log.i("SLAYER", "No bundled production ball asset");
        }

        try {
            byte[] goal = readAssetBytes("models/goal.glb");
            if (!nativeLoadGoal(goal)) android.util.Log.w("SLAYER", "Bundled goal asset could not be loaded");
        } catch (IOException e) {
            android.util.Log.i("SLAYER", "No bundled production goal asset");
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
            if (!nativeReady || !matchStarted) return;
            long now = System.nanoTime();
            float dt = (now - lastFrameNanos) / 1_000_000_000.0f;
            lastFrameNanos = now;
            nativeRender(dt);
            if (matchStarted) statsView.setText(String.format(Locale.US,
                    "SLAYER • FILAMENT / VULKAN\\n%.1f FPS • %.2f ms\\nScore %d - %d\\nDraws %d • Players %d",
                    nativeGetFps(), nativeGetFrameMs(), nativeGetHomeScore(), nativeGetAwayScore(), nativeGetDrawCalls(), nativeGetPlayerCount()));
            applyGameLoopScenario((System.nanoTime() - testStartNanos) / 1_000_000L);
            surface.postOnAnimation(this);
        }
    };

    @Override
    public void onBackPressed() {
        if (matchStarted && !menuVisible) {
            surface.removeCallbacks(frameRunnable);
            removeGameControls();
            matchStarted = false;
            menuVisible = true;
            statsView.setVisibility(View.GONE);
            showMainMenu();
            return;
        }
        if (activePage != null && activePage.getParent() != null) {
            root.removeView(activePage);
            activePage = null;
            showMainMenu();
            return;
        }
        if (menuVisible) {
            super.onBackPressed();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onPause() {
        if (surface != null) surface.removeCallbacks(frameRunnable);
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (surface != null && nativeReady && matchStarted) surface.postOnAnimation(frameRunnable);
    }

    @Override
    protected void onDestroy() {
        if (nativeReady) {
            nativeDestroy();
            nativeReady = false;
        }
        surface = null;
        super.onDestroy();
    }
}