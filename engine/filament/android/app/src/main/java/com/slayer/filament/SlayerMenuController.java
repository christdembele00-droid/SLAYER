package com.slayer.filament;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.TextView;

final class SlayerMenuController {
    private final Activity activity;
    private final FrameLayout root;
    private final TextView statsView;
    private final Runnable onStartMatch;

    private FrameLayout menuOverlay;
    private View activePage;
    private boolean menuVisible;

    SlayerMenuController(Activity activity, FrameLayout root, TextView statsView, Runnable onStartMatch) {
        this.activity = activity;
        this.root = root;
        this.statsView = statsView;
        this.onStartMatch = onStartMatch;
    }

    boolean isMenuVisible() {
        return menuVisible;
    }

    boolean hasActivePage() {
        return activePage != null && activePage.getParent() != null;
    }

    void clear() {
        if (menuOverlay != null && menuOverlay.getParent() != null) root.removeView(menuOverlay);
        if (activePage != null && activePage.getParent() != null) root.removeView(activePage);
        menuOverlay = null;
        activePage = null;
        menuVisible = false;
    }

    void hideAll() {
        clear();
        menuVisible = false;
    }

    void showSplashAndLoading() {
        clear();
        final FrameLayout splash = new FrameLayout(activity);
        splash.setBackgroundColor(Color.BLACK);

        TextView logo = label("SLAYER", 46f, true);
        logo.setGravity(Gravity.CENTER);
        splash.addView(logo, new FrameLayout.LayoutParams(-1, -2, Gravity.CENTER));

        TextView sub = label("FOOTBALL 2026", 14f, false);
        sub.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams sp = new FrameLayout.LayoutParams(-1, px(50), Gravity.CENTER);
        sp.topMargin = px(92);
        splash.addView(sub, sp);

        root.addView(splash, new FrameLayout.LayoutParams(-1, -1));
        splash.postDelayed(() -> {
            if (splash.getParent() != null) root.removeView(splash);
            showLoadingScreen();
        }, 2000L);
    }

    private void showLoadingScreen() {
        final FrameLayout loading = new FrameLayout(activity);
        loading.setBackgroundColor(0xFF06101C);

        TextView title = label("SLAYER", 30f, true);
        title.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams tp = new FrameLayout.LayoutParams(-1, px(70), Gravity.TOP);
        tp.topMargin = px(42);
        loading.addView(title, tp);

        TextView scene = label("STADE  •  ATLAS FC  ×  LAGOON UNITED", 13f, false);
        scene.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams sc = new FrameLayout.LayoutParams(-1, px(50), Gravity.CENTER);
        sc.topMargin = -px(40);
        loading.addView(scene, sc);

        TextView loadingText = label("CHARGEMENT\n\n● ● ●", 18f, true);
        loadingText.setGravity(Gravity.CENTER);
        loading.addView(loadingText, new FrameLayout.LayoutParams(-1, px(180), Gravity.CENTER));

        TextView status = label("Préparation de l'expérience SLAYER", 12f, false);
        status.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams st = new FrameLayout.LayoutParams(-1, px(50), Gravity.BOTTOM);
        st.bottomMargin = px(48);
        loading.addView(status, st);

        root.addView(loading, new FrameLayout.LayoutParams(-1, -1));
        loading.postDelayed(() -> {
            if (loading.getParent() != null) root.removeView(loading);
            showMainMenu();
        }, 1600L);
    }

    void showMainMenu() {
        clear();
        menuVisible = true;
        statsView.setVisibility(View.GONE);

        menuOverlay = new FrameLayout(activity);
        menuOverlay.addView(new MenuBackgroundView(activity), new FrameLayout.LayoutParams(-1, -1));

        View shade = new View(activity);
        shade.setBackgroundColor(0x55000000);
        menuOverlay.addView(shade, new FrameLayout.LayoutParams(-1, -1));

        TextView brand = label("SLAYER", 30f, true);
        FrameLayout.LayoutParams bp = new FrameLayout.LayoutParams(px(300), px(64), Gravity.TOP | Gravity.LEFT);
        bp.leftMargin = px(28);
        bp.topMargin = px(18);
        menuOverlay.addView(brand, bp);

        TextView season = label("FOOTBALL 2026", 12f, false);
        season.setTextColor(0xFFFFFF66);
        FrameLayout.LayoutParams sep = new FrameLayout.LayoutParams(px(220), px(40), Gravity.TOP | Gravity.LEFT);
        sep.leftMargin = px(32);
        sep.topMargin = px(70);
        menuOverlay.addView(season, sep);

        Button settings = button("⚙", 22f);
        FrameLayout.LayoutParams setp = new FrameLayout.LayoutParams(px(70), px(60), Gravity.TOP | Gravity.RIGHT);
        setp.rightMargin = px(22);
        setp.topMargin = px(18);
        menuOverlay.addView(settings, setp);
        settings.setOnClickListener(v -> showSettingsCard());

        TextView hero = label("MATCHDAY", 12f, true);
        hero.setTextColor(0xFFFFFF66);
        hero.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams hp = new FrameLayout.LayoutParams(-1, px(40), Gravity.TOP);
        hp.topMargin = px(112);
        menuOverlay.addView(hero, hp);

        TextView teams = label("ATLAS FC  •  VS  •  LAGOON UNITED", 17f, true);
        teams.setGravity(Gravity.CENTER);
        teams.setMaxLines(1);
        teams.setEllipsize(android.text.TextUtils.TruncateAt.END);
        FrameLayout.LayoutParams teamsP = new FrameLayout.LayoutParams(-1, px(54), Gravity.TOP);
        teamsP.leftMargin = px(12);
        teamsP.rightMargin = px(12);
        teamsP.topMargin = px(142);
        menuOverlay.addView(teams, teamsP);

        Button quick = button("▶  MATCH RAPIDE", 17f);
        quick.setTextColor(Color.BLACK);
        quick.setBackgroundColor(0xFFFFD400);
        android.util.DisplayMetrics qdm = activity.getResources().getDisplayMetrics();
        int qWidth = Math.min(Math.round(qdm.widthPixels * 0.78f), px(390));
        FrameLayout.LayoutParams qp = new FrameLayout.LayoutParams(Math.max(px(190), qWidth), px(64), Gravity.TOP | Gravity.CENTER_HORIZONTAL);
        qp.topMargin = px(225);
        menuOverlay.addView(quick, qp);
        quick.setOnClickListener(v -> onStartMatch.run());

        addModeCard("CARRIÈRE", 20, 310, 250, 64, () -> showModeScreen("CARRIÈRE",
                "CLUB  •  SAISON  •  CHAMPIONNAT  •  TRANSFERTS"));
        addModeCard("COMPÉTITION", 285, 310, 250, 64, () -> showModeScreen("COMPÉTITION",
                "LIGUES  •  COUPES  •  TOURNOIS"));
        addModeCard("ENTRAÎNEMENT", 20, 386, 250, 64, () -> showModeScreen("ENTRAÎNEMENT",
                "TIR  •  PASSE  •  DRIBBLE  •  DÉFENSE"));
        addModeCard("ÉQUIPE", 285, 386, 250, 64, () -> showModeScreen("ÉQUIPE",
                "EFFECTIF  •  TACTIQUES  •  KITS  •  PROGRESSION"));

        Button profile = button("PROFIL", 13f);
        FrameLayout.LayoutParams pp = new FrameLayout.LayoutParams(px(150), px(48), Gravity.BOTTOM | Gravity.LEFT);
        pp.leftMargin = px(22);
        pp.bottomMargin = px(20);
        menuOverlay.addView(profile, pp);
        profile.setOnClickListener(v -> showModeScreen("PROFIL", "JOUEUR  •  PROGRESSION  •  STATISTIQUES"));

        Button other = button("AUTRES", 13f);
        FrameLayout.LayoutParams op = new FrameLayout.LayoutParams(px(150), px(48), Gravity.BOTTOM | Gravity.RIGHT);
        op.rightMargin = px(22);
        op.bottomMargin = px(20);
        menuOverlay.addView(other, op);
        other.setOnClickListener(v -> showModeScreen("AUTRES", "AIDE  •  INFORMATIONS  •  OPTIONS"));

        root.addView(menuOverlay, new FrameLayout.LayoutParams(-1, -1));
    }

    private void addModeCard(String text, int left, int top, int width, int height, Runnable action) {
        Button b = button(text, 14f);
        android.util.DisplayMetrics dm = activity.getResources().getDisplayMetrics();
        int screenWidth = Math.max(320, dm.widthPixels);
        int outer = Math.max(px(14), Math.round(screenWidth * 0.045f));
        int gap = Math.max(px(8), Math.round(screenWidth * 0.025f));
        int cardWidth = Math.max(px(120), (screenWidth - (outer * 2) - gap) / 2);
        int cardHeight = Math.max(px(52), Math.min(px(height), Math.round(cardWidth * 0.26f)));
        int column = left > 200 ? 1 : 0;
        int row = top > 350 ? 1 : 0;
        int x = outer + column * (cardWidth + gap);
        int y = Math.max(px(300), px(300) + row * (cardHeight + gap));
        FrameLayout.LayoutParams p = new FrameLayout.LayoutParams(cardWidth, cardHeight, Gravity.TOP | Gravity.LEFT);
        p.leftMargin = x;
        p.topMargin = y;
        menuOverlay.addView(b, p);
        b.setOnClickListener(v -> action.run());
    }

    private void showModeScreen(String title, String details) {
        clear();
        menuVisible = false;

        final FrameLayout page = new FrameLayout(activity);
        page.setBackgroundColor(0xFF07111E);

        TextView t = label(title, 30f, true);
        FrameLayout.LayoutParams tp = new FrameLayout.LayoutParams(-1, px(70), Gravity.TOP);
        tp.topMargin = px(42);
        tp.leftMargin = px(30);
        page.addView(t, tp);

        TextView d = label(details, 15f, false);
        d.setGravity(Gravity.CENTER);
        page.addView(d, new FrameLayout.LayoutParams(-1, px(160), Gravity.CENTER));

        Button back = button("‹  RETOUR", 14f);
        FrameLayout.LayoutParams bp = new FrameLayout.LayoutParams(px(170), px(56), Gravity.BOTTOM | Gravity.LEFT);
        bp.leftMargin = px(24);
        bp.bottomMargin = px(24);
        page.addView(back, bp);
        back.setOnClickListener(v -> showMainMenu());

        activePage = page;
        root.addView(page, new FrameLayout.LayoutParams(-1, -1));
    }

    private void showSettingsCard() {
        showModeScreen("PARAMÈTRES", "GRAPHISMES  •  VULKAN  •  COMMANDES  •  AUDIO");
    }

    private TextView label(String text, float size, boolean bold) {
        TextView v = new TextView(activity);
        v.setText(text);
        v.setTextColor(Color.WHITE);
        v.setTextSize(size);
        v.setGravity(Gravity.CENTER_VERTICAL);
        if (bold) v.setTypeface(Typeface.DEFAULT_BOLD);
        return v;
    }

    private Button button(String text, float size) {
        Button b = new Button(activity);
        b.setText(text);
        b.setTextColor(Color.WHITE);
        b.setTextSize(size);
        b.setAllCaps(false);
        b.setGravity(Gravity.CENTER);
        b.setBackgroundColor(0xB31B1D22);
        return b;
    }

    private int px(float value) {
        android.util.DisplayMetrics dm = activity.getResources().getDisplayMetrics();
        float widthScale = dm.widthPixels / 600.0f;
        float heightScale = dm.heightPixels / 400.0f;
        float scale = Math.max(0.75f, Math.min(1.35f, Math.min(widthScale, heightScale)));
        return Math.max(1, Math.round(value * scale));
    }

    private static final class MenuBackgroundView extends View {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final LinearGradient gradient;

        MenuBackgroundView(android.content.Context context) {
            super(context);
            gradient = new LinearGradient(
                    0, 0, 0, 900,
                    new int[]{0xFF04101C, 0xFF0A3151, 0xFF02070D},
                    null, Shader.TileMode.CLAMP);
        }

        @Override
        protected void onDraw(android.graphics.Canvas canvas) {
            super.onDraw(canvas);
            paint.setShader(gradient);
            canvas.drawRect(0, 0, getWidth(), getHeight(), paint);
            paint.setShader(null);
            paint.setColor(0x332FA8FF);
            canvas.drawOval(-180, getHeight() - 260, getWidth() + 180, getHeight() + 220, paint);
            paint.setColor(0x55FFFFFF);
            for (int i = 0; i < 8; i++) {
                float x = 30 + i * (getWidth() - 60) / 7f;
                canvas.drawCircle(x, 120 + (i % 2) * 18, 3.5f, paint);
            }
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(2);
            paint.setColor(0x3388CCFF);
            canvas.drawArc(-getWidth(), getHeight() - 300, getWidth() * 2, getHeight() + 300, 190, 160, false, paint);
            paint.setStyle(Paint.Style.FILL);
        }
    }
}
