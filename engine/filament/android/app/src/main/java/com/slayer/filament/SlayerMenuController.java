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

        menuOverlay = new FrameLayout(activity);
        menuOverlay.setBackgroundColor(0xFF02070D);

        SlayerHomeView home = new SlayerHomeView(
                activity,
                () -> onStartMatch.run(),
                () -> showSettingsCard(),
                mode -> {
                    switch (mode) {
                        case 1:
                            showModeScreen("CARRIÈRE", "CLUB  •  SAISON  •  CHAMPIONNAT  •  TRANSFERTS");
                            break;
                        case 2:
                            showModeScreen("COMPÉTITION", "LIGUES  •  COUPES  •  TOURNOIS");
                            break;
                        case 3:
                            showModeScreen("ÉQUIPE", "EFFECTIF  •  TACTIQUES  •  KITS  •  PROGRESSION");
                            break;
                        case 4:
                            showModeScreen("ENTRAÎNEMENT", "TIR  •  PASSE  •  DRIBBLE  •  DÉFENSE");
                            break;
                        case 5:
                            showModeScreen("PROFIL", "JOUEUR  •  PROGRESSION  •  STATISTIQUES");
                            break;
                        default:
                            showModeScreen("AUTRES", "AIDE  •  INFORMATIONS  •  OPTIONS");
                            break;
                    }
                });
        menuOverlay.addView(home, new FrameLayout.LayoutParams(-1, -1));
        root.addView(menuOverlay, new FrameLayout.LayoutParams(-1, -1));
    }

    private static final class SlayerHomeView extends View {
        interface Action { void run(); }
        interface ModeAction { void open(int mode); }

        private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Path path = new Path();
        private final RectF rect = new RectF();
        private final Action quickMatch;
        private final Action settings;
        private final ModeAction modeAction;
        private float density;

        SlayerHomeView(Activity activity, Action quickMatch, Action settings, ModeAction modeAction) {
            super(activity);
            this.quickMatch = quickMatch;
            this.settings = settings;
            this.modeAction = modeAction;
            density = getResources().getDisplayMetrics().density;
            setClickable(true);
        }

        private float d(float v) { return v * density; }

        @Override
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            final float w = getWidth();
            final float h = getHeight();
            final float top = d(70);
            final float bottom = d(70);

            // Cinematic blue/green background.
            p.setShader(new LinearGradient(
                    0, 0, w, h,
                    new int[]{0xFF02060C, 0xFF08233A, 0xFF052316},
                    new float[]{0f, .52f, 1f},
                    Shader.TileMode.CLAMP));
            canvas.drawRect(0, 0, w, h, p);
            p.setShader(null);

            // Stadium lights.
            p.setColor(0xCCBFEFFF);
            for (int i = 0; i < 9; i++) {
                float x = w * (.035f + i * .115f);
                float y = d(88) + (i % 2) * d(10);
                canvas.drawCircle(x, y, d(2.1f), p);
            }

            // Pitch perspective.
            path.reset();
            path.moveTo(0, h*.58f);
            path.lineTo(w, h*.47f);
            path.lineTo(w, h);
            path.lineTo(0, h);
            path.close();
            p.setShader(new LinearGradient(0, h*.45f, 0, h,
                    0xFF0B704D, 0xFF03150F, Shader.TileMode.CLAMP));
            canvas.drawPath(path, p);
            p.setShader(null);

            p.setStyle(Paint.Style.STROKE);
            p.setStrokeWidth(d(2));
            p.setColor(0x79D8FFF0);
            canvas.drawLine(w*.5f, h*.48f, w*.5f, h);
            canvas.drawOval(new RectF(w*.28f, h*.57f, w*.72f, h*.93f), p);
            p.setStyle(Paint.Style.FILL);

            // Header.
            round(canvas, 0, 0, w, top, 0xDD03101C, d(17), 0x4CBFEFFF);
            drawLogo(canvas, d(12), d(12), d(44));
            text(canvas, "SLAYER", d(62), d(31), d(18), true, Color.WHITE);
            text(canvas, "FOOTBALL 2026", d(62), d(49), d(7.5f), true, 0xFFBFEFFF);

            nav(canvas, "ACCUEIL", w*.22f, d(13), w*.13f, true);
            nav(canvas, "MISSIONS", w*.36f, d(13), w*.14f, false);
            nav(canvas, "SHOP", w*.51f, d(13), w*.11f, false);

            // Economy area.
            round(canvas, w*.65f, d(13), w-d(54), d(57), 0x990A2237, d(17), 0x35BFEFFF);
            textCenter(canvas, "◎ 12 450    ✦ 125", (w*.65f + w-d(54))/2f, d(39), d(8), true, Color.WHITE);

            // Settings ring.
            p.setStyle(Paint.Style.STROKE);
            p.setStrokeWidth(d(2));
            p.setColor(0xB8E8FAFF);
            canvas.drawCircle(w-d(26), d(35), d(14), p);
            canvas.drawCircle(w-d(26), d(35), d(4), p);
            p.setStyle(Paint.Style.FILL);

            // Hero hierarchy.
            text(canvas, "SEASON 01", d(20), top+d(44), d(9), true, 0xFFE0B500);
            text(canvas, "MATCHDAY", d(20), top+d(88), d(33), true, Color.WHITE);
            text(canvas, "ATLAS FC      VS      LAGOON UNITED", d(20), top+d(116), d(10), true, 0xFFD6F7FF);

            drawPlayer(canvas, w*.64f, top+d(18), Math.min(w,h)*.40f);
            drawBall(canvas, w*.72f, top+d(235), d(17));

            // Primary CTA.
            float ctaY = h-d(139);
            round(canvas, d(20), ctaY, d(218), ctaY+d(56), 0xFFE0B500, d(15), 0xFFFFFFFF);
            text(canvas, "▶", d(40), ctaY+d(35), d(16), true, Color.BLACK);
            text(canvas, "KICK OFF", d(68), ctaY+d(29), d(14), true, Color.BLACK);
            text(canvas, "MATCH RAPIDE", d(68), ctaY+d(44), d(7.5f), true, 0xFF413500);

            // Modes strip.
            float modeY = h-d(69);
            text(canvas, "MODES", d(20), modeY-d(14), d(9), true, 0xDDF0FAFF);
            float gap = d(7);
            float total = w-d(40);
            float cw = (total-gap*2)/3f;
            tile(canvas, d(20), modeY, cw, d(58), 1, "CARRIÈRE", "◆", 0xFF113A53);
            tile(canvas, d(20)+cw+gap, modeY, cw, d(58), 2, "COMPÉT.", "★", 0xFF155143);
            tile(canvas, d(20)+(cw+gap)*2, modeY, cw, d(58), 3, "ÉQUIPE", "✦", 0xFF3D4825);
        }

        private void drawPlayer(Canvas c, float cx, float y, float s) {
            p.setColor(0xF2070F19);
            c.drawCircle(cx, y+s*.14f, s*.105f, p);

            path.reset();
            path.moveTo(cx-s*.10f, y+s*.27f);
            path.lineTo(cx-s*.22f, y+s*.68f);
            path.lineTo(cx-s*.07f, y+s*.68f);
            path.lineTo(cx, y+s*.52f);
            path.lineTo(cx+s*.06f, y+s*.83f);
            path.lineTo(cx+s*.22f, y+s*.83f);
            path.lineTo(cx+s*.09f, y+s*.27f);
            path.close();
            c.drawPath(path, p);

            p.setStyle(Paint.Style.STROKE);
            p.setStrokeWidth(s*.025f);
            p.setColor(0x82BFEFFF);
            c.drawLine(cx-s*.09f, y+s*.35f, cx-s*.30f, y+s*.53f, p);
            c.drawLine(cx+s*.08f, y+s*.35f, cx+s*.27f, y+s*.16f, p);
            p.setStyle(Paint.Style.FILL);

            // Jersey stripe and luminous rim.
            p.setColor(0xCC0E7090);
            c.drawRect(cx-s*.085f, y+s*.30f, cx+s*.075f, y+s*.48f, p);
        }

        private void drawBall(Canvas c, float cx, float cy, float rad) {
            p.setColor(Color.WHITE);
            c.drawCircle(cx, cy, rad, p);
            p.setColor(0xFF0A2235);
            c.drawCircle(cx, cy, rad*.34f, p);
            p.setStyle(Paint.Style.STROKE);
            p.setStrokeWidth(d(2));
            p.setColor(0x99E0B500);
            c.drawCircle(cx, cy, rad+d(10), p);
            p.setStyle(Paint.Style.FILL);
        }

        private void tile(Canvas c,float x,float y,float ww,float hh,int mode,String title,String icon,int fill) {
            round(c,x,y,x+ww,y+hh,fill,d(14),0x59FFFFFF);
            p.setColor(0x20000000);
            c.drawCircle(x+ww*.17f,y+hh*.5f,hh*.28f,p);
            text(c,icon,x+ww*.11f,y+hh*.60f,hh*.30f,true,0xFFF3FCFF);
            text(c,title,x+ww*.38f,y+hh*.45f,d(8.5f),true,Color.WHITE);
            text(c,"OUVRIR  ›",x+ww*.38f,y+hh*.68f,d(6.5f),true,0xA9E8FAFF);
        }

        private void nav(Canvas c,String label,float x,float y,float ww,boolean active) {
            round(c,x,y,x+ww,y+d(42),active ? 0x3319A9D8 : 0x00000000,
                    d(13),active ? 0x48BFEFFF : 0);
            textCenter(c,label,x+ww/2f,y+d(27),d(8),true,active ? Color.WHITE : 0x8FFFFFFF);
        }

        private void round(Canvas c,float l,float t,float rr,float b,int fill,float radius,int stroke) {
            p.setStyle(Paint.Style.FILL);
            p.setColor(fill);
            rect.set(l,t,rr,b);
            c.drawRoundRect(rect,radius,radius,p);
            if(stroke!=0){
                p.setStyle(Paint.Style.STROKE);
                p.setStrokeWidth(d(1.2f));
                p.setColor(stroke);
                c.drawRoundRect(rect,radius,radius,p);
                p.setStyle(Paint.Style.FILL);
            }
        }

        private void drawLogo(Canvas c,float x,float y,float size) {
            android.graphics.drawable.Drawable logo =
                    getResources().getDrawable(com.slayer.filament.R.drawable.ic_slayer);
            logo.setBounds((int)x,(int)y,(int)(x+size),(int)(y+size));
            logo.draw(c);
        }

        private void text(Canvas c,String s,float x,float y,float size,boolean bold,int color) {
            p.setStyle(Paint.Style.FILL);
            p.setShader(null);
            p.setColor(color);
            p.setTextSize(size);
            p.setTypeface(bold ? Typeface.DEFAULT_BOLD : Typeface.DEFAULT);
            p.setTextAlign(Paint.Align.LEFT);
            c.drawText(s,x,y,p);
        }

        private void textCenter(Canvas c,String s,float x,float y,float size,boolean bold,int color) {
            p.setStyle(Paint.Style.FILL);
            p.setShader(null);
            p.setColor(color);
            p.setTextSize(size);
            p.setTypeface(bold ? Typeface.DEFAULT_BOLD : Typeface.DEFAULT);
            p.setTextAlign(Paint.Align.CENTER);
            c.drawText(s,x,y,p);
        }

        @Override
        public boolean onTouchEvent(MotionEvent e) {
            if(e.getAction()!=MotionEvent.ACTION_UP) return true;
            float x=e.getX(), y=e.getY(), w=getWidth(), h=getHeight();

            if(x>w-d(60) && y<d(70)){
                settings.run();
                return true;
            }
            if(x>=d(15) && x<=d(225) && y>h-d(155) && y<h-d(70)){
                quickMatch.run();
                return true;
            }

            float gap=d(7), cw=(w-d(40)-gap*2)/3f, modeY=h-d(69);
            for(int i=0;i<3;i++){
                float left=d(20)+(cw+gap)*i;
                if(x>=left && x<=left+cw && y>=modeY && y<=modeY+d(58)){
                    modeAction.open(i+1);
                    return true;
                }
            }

            if(y>h-d(60)){
                modeAction.open(x<w*.33f ? 4 : (x<w*.66f ? 5 : 6));
            }
            return true;
        }
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
