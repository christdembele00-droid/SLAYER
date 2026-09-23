package com.slayer.filament;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.graphics.Canvas;
import android.graphics.Path;
import android.graphics.RectF;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.GridLayout;
import android.widget.LinearLayout;
import android.widget.ImageView;
import android.widget.ScrollView;
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

        final android.util.DisplayMetrics dm = activity.getResources().getDisplayMetrics();
        final int screenW = dm.widthPixels;
        final int screenH = dm.heightPixels;
        final int pad = Math.max(px(14), Math.round(screenW * 0.035f));

        menuOverlay = new FrameLayout(activity);
        menuOverlay.setBackgroundColor(0xFF050A12);

        ScrollView scroll = new ScrollView(activity);
        scroll.setFillViewport(true);
        scroll.setVerticalScrollBarEnabled(false);
        scroll.setOverScrollMode(View.OVER_SCROLL_NEVER);

        LinearLayout page = new LinearLayout(activity);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setPadding(0, 0, 0, px(14));

        // Header navigation bar.
        LinearLayout header = new LinearLayout(activity);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(pad, 0, pad, 0);
        android.graphics.drawable.GradientDrawable headerBg =
                new android.graphics.drawable.GradientDrawable();
        headerBg.setColor(0xCC07111E);
        header.setBackground(headerBg);

        ImageView logo = new ImageView(activity);
        logo.setImageResource(com.slayer.filament.R.drawable.ic_slayer);
        logo.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        header.addView(logo, new LinearLayout.LayoutParams(px(44), px(56)));

        TextView brand = label("SLAYER", 18f, true);
        brand.setLetterSpacing(.16f);
        LinearLayout.LayoutParams brandLp = new LinearLayout.LayoutParams(px(112), -1);
        brandLp.setMargins(px(4), 0, px(6), 0);
        header.addView(brand, brandLp);

        LinearLayout nav = new LinearLayout(activity);
        nav.setGravity(Gravity.CENTER_VERTICAL);
        nav.setOrientation(LinearLayout.HORIZONTAL);
        header.addView(nav, new LinearLayout.LayoutParams(0, -1, 1f));

        addNavItem(nav, "SLAYER WORLD", true);
        addNavItem(nav, "MISSIONS", false);
        addNavItem(nav, "SHOP", false);

        Button settings = roundMenuButton("⚙", 18f, 0xAA10263A, Color.WHITE);
        header.addView(settings, new LinearLayout.LayoutParams(px(50), px(50)));
        settings.setOnClickListener(v -> showSettingsCard());

        page.addView(header, new LinearLayout.LayoutParams(-1, px(64)));

        // Hero / feature area.
        final int heroH = Math.max(px(275), Math.min(px(390), Math.round(screenH * 0.56f)));
        FrameLayout hero = new FrameLayout(activity);
        hero.setBackgroundColor(0xFF071522);
        hero.addView(new HomeHeroView(activity), new FrameLayout.LayoutParams(-1, -1));

        View heroShade = new View(activity);
        android.graphics.drawable.GradientDrawable heroGradient =
                new android.graphics.drawable.GradientDrawable(
                        android.graphics.drawable.GradientDrawable.Orientation.TOP_BOTTOM,
                        new int[]{0x10000000, 0x42000000, 0xEE050A12});
        heroShade.setBackground(heroGradient);
        hero.addView(heroShade, new FrameLayout.LayoutParams(-1, -1));

        TextView update = label("SEASON 01  •  FOOTBALL 2026", 10f, true);
        update.setTextColor(0xFFE0B500);
        FrameLayout.LayoutParams up = new FrameLayout.LayoutParams(-2, px(30), Gravity.TOP | Gravity.LEFT);
        up.leftMargin = pad;
        up.topMargin = px(18);
        hero.addView(update, up);

        TextView feature = label("MATCHDAY", 36f, true);
        feature.setLetterSpacing(.08f);
        FrameLayout.LayoutParams fp = new FrameLayout.LayoutParams(-1, px(56), Gravity.BOTTOM | Gravity.LEFT);
        fp.leftMargin = pad;
        fp.rightMargin = pad;
        fp.bottomMargin = px(108);
        hero.addView(feature, fp);

        TextView matchup = label("ATLAS FC   0   —   0   LAGOON UNITED", 15f, true);
        matchup.setSingleLine(true);
        matchup.setEllipsize(android.text.TextUtils.TruncateAt.END);
        FrameLayout.LayoutParams mpp = new FrameLayout.LayoutParams(-1, px(40), Gravity.BOTTOM);
        mpp.leftMargin = pad;
        mpp.rightMargin = pad;
        mpp.bottomMargin = px(72);
        hero.addView(matchup, mpp);

        Button kickOff = homeActionButton("KICK OFF  〉", 15f, 0xFFE0B500, Color.BLACK);
        FrameLayout.LayoutParams kop = new FrameLayout.LayoutParams(px(190), px(54), Gravity.BOTTOM | Gravity.LEFT);
        kop.leftMargin = pad;
        kop.bottomMargin = px(12);
        hero.addView(kickOff, kop);
        kickOff.setOnClickListener(v -> onStartMatch.run());

        TextView hint = label("MATCH RAPIDE", 10f, true);
        hint.setTextColor(0xCCFFFFFF);
        FrameLayout.LayoutParams hp = new FrameLayout.LayoutParams(px(125), px(32), Gravity.BOTTOM | Gravity.LEFT);
        hp.leftMargin = px(220);
        hp.bottomMargin = px(23);
        hero.addView(hint, hp);

        page.addView(hero, new LinearLayout.LayoutParams(-1, heroH));

        // Competition / mode carousel row.
        LinearLayout sectionHeader = new LinearLayout(activity);
        sectionHeader.setGravity(Gravity.CENTER_VERTICAL);
        sectionHeader.setPadding(pad, px(10), pad, px(4));
        TextView section = label("MODES DE JEU", 11f, true);
        section.setTextColor(0xFFE6F7FF);
        section.setLetterSpacing(.14f);
        sectionHeader.addView(section, new LinearLayout.LayoutParams(0, px(34), 1f));
        TextView more = label("VOIR TOUT  ›", 10f, true);
        more.setTextColor(0xFFBFEFFF);
        sectionHeader.addView(more, new LinearLayout.LayoutParams(px(96), px(34)));
        page.addView(sectionHeader, new LinearLayout.LayoutParams(-1, px(48)));

        LinearLayout modeRow = new LinearLayout(activity);
        modeRow.setOrientation(LinearLayout.HORIZONTAL);
        modeRow.setPadding(pad, 0, pad, 0);
        addModeTile(modeRow, "CARRIÈRE", "◆", 0xFF173C55,
                () -> showModeScreen("CARRIÈRE", "CLUB  •  SAISON  •  CHAMPIONNAT  •  TRANSFERTS"));
        addModeTile(modeRow, "COMPÉTITION", "★", 0xFF164739,
                () -> showModeScreen("COMPÉTITION", "LIGUES  •  COUPES  •  TOURNOIS"));
        addModeTile(modeRow, "ÉQUIPE", "✦", 0xFF3B4524,
                () -> showModeScreen("ÉQUIPE", "EFFECTIF  •  TACTIQUES  •  KITS  •  PROGRESSION"));
        page.addView(modeRow, new LinearLayout.LayoutParams(-1, px(102)));

        LinearLayout bottom = new LinearLayout(activity);
        bottom.setOrientation(LinearLayout.HORIZONTAL);
        bottom.setGravity(Gravity.CENTER);
        bottom.setPadding(pad, px(10), pad, 0);
        Button profile = homeSecondaryButton("PROFIL", 0xAA10263A);
        Button training = homeSecondaryButton("ENTRAÎNEMENT", 0xAA10263A);
        Button other = homeSecondaryButton("AUTRES", 0xAA10263A);

        LinearLayout.LayoutParams b1 = new LinearLayout.LayoutParams(0, px(48), 1f);
        b1.setMargins(0, 0, px(5), 0);
        bottom.addView(profile, b1);
        LinearLayout.LayoutParams b2 = new LinearLayout.LayoutParams(0, px(48), 1f);
        b2.setMargins(px(5), 0, px(5), 0);
        bottom.addView(training, b2);
        LinearLayout.LayoutParams b3 = new LinearLayout.LayoutParams(0, px(48), 1f);
        b3.setMargins(px(5), 0, 0, 0);
        bottom.addView(other, b3);

        profile.setOnClickListener(v -> showModeScreen("PROFIL", "JOUEUR  •  PROGRESSION  •  STATISTIQUES"));
        training.setOnClickListener(v -> showModeScreen("ENTRAÎNEMENT", "TIR  •  PASSE  •  DRIBBLE  •  DÉFENSE"));
        other.setOnClickListener(v -> showModeScreen("AUTRES", "AIDE  •  INFORMATIONS  •  OPTIONS"));

        page.addView(bottom, new LinearLayout.LayoutParams(-1, px(58)));

        scroll.addView(page, new ScrollView.LayoutParams(-1, -1));
        menuOverlay.addView(scroll, new FrameLayout.LayoutParams(-1, -1));
        root.addView(menuOverlay, new FrameLayout.LayoutParams(-1, -1));
    }

    private void addNavItem(LinearLayout nav, String text, boolean active) {
        TextView item = label(text, active ? 9.5f : 8.8f, active);
        item.setGravity(Gravity.CENTER);
        item.setSingleLine(true);
        item.setTextColor(active ? Color.WHITE : 0x99FFFFFF);
        if (active) item.setBackgroundColor(0x2219A9D8);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, px(40), 1f);
        lp.setMargins(px(2), 0, px(2), 0);
        nav.addView(item, lp);
    }

    private void addModeTile(LinearLayout row, String title, String icon, int color, Runnable action) {
        LinearLayout tile = new LinearLayout(activity);
        tile.setOrientation(LinearLayout.VERTICAL);
        tile.setGravity(Gravity.LEFT | Gravity.BOTTOM);

        android.graphics.drawable.GradientDrawable bg = new android.graphics.drawable.GradientDrawable();
        bg.setColor(color);
        bg.setCornerRadius(px(18));
        bg.setStroke(px(1), 0x66FFFFFF);
        tile.setBackground(bg);
        tile.setClipToOutline(true);
        tile.setElevation(px(7));
        tile.setOnClickListener(v -> action.run());

        ModeArtView art = new ModeArtView(activity, icon);
        tile.addView(art, new LinearLayout.LayoutParams(-1, px(58)));

        TextView titleView = label(title, 11.5f, true);
        titleView.setGravity(Gravity.LEFT | Gravity.CENTER_VERTICAL);
        titleView.setSingleLine(true);
        titleView.setEllipsize(android.text.TextUtils.TruncateAt.END);
        titleView.setPadding(px(12), 0, px(8), 0);
        tile.addView(titleView, new LinearLayout.LayoutParams(-1, px(25)));

        TextView hint = label("OUVRIR  ›", 8.5f, true);
        hint.setTextColor(0xA6FFFFFF);
        hint.setGravity(Gravity.LEFT | Gravity.CENTER_VERTICAL);
        hint.setPadding(px(12), 0, 0, 0);
        tile.addView(hint, new LinearLayout.LayoutParams(-1, px(20)));

        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, px(102), 1f);
        lp.setMargins(px(4), px(4), px(4), px(4));
        row.addView(tile, lp);
    }

    private static final class ModeArtView extends View {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final String kind;
        private final Path path = new Path();

        ModeArtView(android.content.Context context, String kind) {
            super(context);
            this.kind = kind;
        }

        @Override
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            float w = getWidth(), h = getHeight();

            paint.setStyle(Paint.Style.FILL);
            paint.setShader(new LinearGradient(0, 0, w, h,
                    new int[]{0x22000000, 0x66000000}, null, Shader.TileMode.CLAMP));
            canvas.drawRect(0, 0, w, h, paint);
            paint.setShader(null);

            paint.setColor(0x55FFFFFF);
            paint.setStrokeWidth(Math.max(1.5f, w * .012f));
            paint.setStyle(Paint.Style.STROKE);

            // Mini football-pitch perspective.
            path.reset();
            path.moveTo(w*.05f, h*.82f);
            path.lineTo(w*.95f, h*.55f);
            path.lineTo(w*.95f, h*.98f);
            path.lineTo(w*.05f, h*.98f);
            path.close();
            canvas.drawPath(path, paint);

            if ("◆".equals(kind)) {
                // Career: player silhouette + rising progression line.
                paint.setStyle(Paint.Style.FILL);
                paint.setColor(0xD9FFFFFF);
                canvas.drawCircle(w*.48f, h*.31f, h*.11f, paint);
                path.reset();
                path.moveTo(w*.40f,h*.48f); path.lineTo(w*.30f,h*.88f);
                path.lineTo(w*.44f,h*.88f); path.lineTo(w*.50f,h*.66f);
                path.lineTo(w*.56f,h*.88f); path.lineTo(w*.70f,h*.88f);
                path.lineTo(w*.60f,h*.48f); path.close();
                canvas.drawPath(path, paint);

                paint.setColor(0xFFE0B500);
                paint.setStrokeWidth(Math.max(2, w*.02f));
                paint.setStyle(Paint.Style.STROKE);
                path.reset();
                path.moveTo(w*.66f,h*.67f); path.lineTo(w*.74f,h*.57f); path.lineTo(w*.82f,h*.61f); path.lineTo(w*.91f,h*.42f);
                canvas.drawPath(path, paint);
            } else if ("★".equals(kind)) {
                // Competition: trophy.
                paint.setStyle(Paint.Style.FILL);
                paint.setColor(0xFFE0B500);
                canvas.drawOval(new RectF(w*.39f,h*.25f,w*.61f,h*.40f), paint);
                canvas.drawRect(w*.43f,h*.35f,w*.57f,h*.68f, paint);
                canvas.drawRect(w*.33f,h*.66f,w*.67f,h*.73f, paint);
                paint.setStyle(Paint.Style.STROKE);
                paint.setStrokeWidth(Math.max(2,w*.018f));
                canvas.drawArc(new RectF(w*.22f,h*.28f,w*.48f,h*.53f), 70, 180, false, paint);
                canvas.drawArc(new RectF(w*.52f,h*.28f,w*.78f,h*.53f), -70, 180, false, paint);
            } else {
                // Team: tactical board with player nodes.
                paint.setStyle(Paint.Style.STROKE);
                paint.setStrokeWidth(Math.max(2,w*.015f));
                canvas.drawRect(w*.18f,h*.17f,w*.82f,h*.88f,paint);
                paint.setStyle(Paint.Style.FILL);
                paint.setColor(0xFFBFEFFF);
                float[][] pts={{.50f,.76f},{.30f,.64f},{.70f,.64f},{.23f,.43f},{.50f,.45f},{.77f,.43f},{.38f,.27f},{.62f,.27f}};
                for(float[] p:pts) canvas.drawCircle(w*p[0],h*p[1],Math.max(3,w*.035f),paint);
            }

            paint.setStyle(Paint.Style.FILL);
        }
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
        return homeSecondaryButton(text, 0xB30A1B2B);
    }

    private Button homeActionButton(String text, float size, int fill, int textColor) {
        Button b = new Button(activity);
        b.setText(text);
        b.setTextColor(textColor);
        b.setTextSize(size);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setAllCaps(false);
        b.setGravity(Gravity.CENTER);
        b.setPadding(0, 0, 0, 0);
        b.setStateListAnimator(null);
        android.graphics.drawable.GradientDrawable bg = new android.graphics.drawable.GradientDrawable();
        bg.setColor(fill);
        bg.setCornerRadius(px(18));
        bg.setStroke(px(2), 0x88FFFFFF);
        b.setBackground(bg);
        b.setElevation(px(6));
        return b;
    }

    private Button homeSecondaryButton(String text, int fill) {
        return homeActionButton(text, 12f, fill, Color.WHITE);
    }

    private Button roundMenuButton(String text, float size, int fill, int textColor) {
        Button b = new Button(activity);
        b.setText(text);
        b.setTextSize(size);
        b.setTextColor(textColor);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setGravity(Gravity.CENTER);
        b.setPadding(0, 0, 0, 0);
        b.setMinWidth(0);
        b.setMinHeight(0);
        b.setStateListAnimator(null);
        android.graphics.drawable.GradientDrawable bg = new android.graphics.drawable.GradientDrawable();
        bg.setShape(android.graphics.drawable.GradientDrawable.OVAL);
        bg.setColor(fill);
        bg.setStroke(px(2), 0x66FFFFFF);
        b.setBackground(bg);
        b.setElevation(px(5));
        return b;
    }


    private int px(float value) {
        android.util.DisplayMetrics dm = activity.getResources().getDisplayMetrics();
        float widthScale = dm.widthPixels / 600.0f;
        float heightScale = dm.heightPixels / 400.0f;
        float scale = Math.max(0.75f, Math.min(1.35f, Math.min(widthScale, heightScale)));
        return Math.max(1, Math.round(value * scale));
    }

    private static final class HomeHeroView extends View {
        private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Path path = new Path();

        HomeHeroView(android.content.Context context) {
            super(context);
        }

        @Override
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            final float w = getWidth();
            final float h = getHeight();

            android.graphics.LinearGradient sky = new android.graphics.LinearGradient(
                    0, 0, 0, h,
                    new int[]{0xFF061426, 0xFF123B5A, 0xFF071019},
                    null, Shader.TileMode.CLAMP);
            p.setShader(sky);
            canvas.drawRect(0, 0, w, h, p);
            p.setShader(null);

            // Stadium lamps.
            p.setColor(0xD8FFFFFF);
            for (int i = 0; i < 8; i++) {
                float x = w * (0.08f + i * 0.12f);
                canvas.drawCircle(x, h * (0.18f + (i % 2) * 0.025f), Math.max(2.5f, w * 0.006f), p);
            }

            // Pitch perspective.
            path.reset();
            path.moveTo(0, h * .63f);
            path.lineTo(w, h * .50f);
            path.lineTo(w, h);
            path.lineTo(0, h);
            path.close();
            p.setColor(0xCC0B6848);
            canvas.drawPath(path, p);

            p.setStyle(Paint.Style.STROKE);
            p.setStrokeWidth(Math.max(2, w * .003f));
            p.setColor(0x88DFFEF0);
            canvas.drawLine(w * .50f, h * .50f, w * .50f, h, p);
            canvas.drawOval(new RectF(w * .36f, h * .60f, w * .64f, h * .93f), p);
            p.setStyle(Paint.Style.FILL);

            // Stylised footballer.
            p.setColor(0xFF07111F);
            canvas.drawCircle(w * .50f, h * .33f, w * .045f, p);
            path.reset();
            path.moveTo(w*.46f, h*.40f);
            path.lineTo(w*.40f, h*.64f);
            path.lineTo(w*.47f, h*.64f);
            path.lineTo(w*.50f, h*.53f);
            path.lineTo(w*.53f, h*.64f);
            path.lineTo(w*.60f, h*.64f);
            path.lineTo(w*.54f, h*.40f);
            path.close();
            canvas.drawPath(path, p);

            // Football.
            p.setColor(Color.WHITE);
            canvas.drawCircle(w * .69f, h * .77f, w * .027f, p);
            p.setColor(0xFF132A3A);
            canvas.drawCircle(w * .69f, h * .77f, w * .009f, p);
        }
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
