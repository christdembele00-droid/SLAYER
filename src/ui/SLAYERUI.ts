import "./ui.css";

export type SlayerScreen = "home"|"match"|"team"|"modes"|"shop"|"missions"|"career"|"competitions"|"online"|"settings"|"pause"|"result"|"setpiece";
export type SlayerMatchAction = "Pass"|"Shoot"|"Control"|"Dribble"|"StandingTackle";
export interface SlayerMoveInput { x:number; z:number; }

export class SlayerUI {
  private readonly root: HTMLDivElement;
  private screen: SlayerScreen = "home";
  private score = { home: 0, away: 0, clock: "00:00", phase: "KICKOFF" };
  private matchScoreEl: HTMLElement | null = null;
  private matchPhaseEl: HTMLElement | null = null;
  private matchClockEl: HTMLElement | null = null;
  private joystickEl: HTMLElement | null = null;
  private joystickKnobEl: HTMLElement | null = null;
  private joystickPointerId: number | null = null;
  private perfEl: HTMLElement | null = null;
  private modalFromMatch = false;

  constructor(
    app: HTMLDivElement,
    private readonly onStartMatch: () => void,
    private readonly onMatchAction?: (action: SlayerMatchAction) => void,
    private readonly onSprint?: (pressed: boolean) => void,
    private readonly onMove?: (move: SlayerMoveInput) => void
  ) {
    this.root = document.createElement("div");
    this.root.className = "slayer-ui";
    app.appendChild(this.root);
    this.render();
  }

  setScreen(screen: SlayerScreen) {
    if (this.screen === screen) return;
    this.screen = screen;
    this.render();
  }

  openPause() { this.modalFromMatch = true; this.screen = "pause"; this.render(); }
  openSetPiece() { this.screen = "setpiece"; this.render(); }
  showResult() { this.screen = "result"; this.render(); }

  updatePerformance(fps:number, frameMs:number, p95Ms:number, drawCalls:number, triangles:number, tier:string) {
    if (!this.perfEl) return;
    this.perfEl.textContent = `FPS ${fps.toFixed(0)}  |  ${frameMs.toFixed(1)}ms  |  P95 ${p95Ms.toFixed(1)}ms  |  DC ${drawCalls}  |  TRI ${(triangles/1000).toFixed(0)}k  |  ${tier}`;
  }

  updateMatch(home: number, away: number, clock: string, phase: string) {
    this.score = { home, away, clock, phase };
    if (this.screen !== "match") return;
    if (this.matchScoreEl && this.matchPhaseEl && this.matchClockEl) {
      this.matchScoreEl.textContent = home + " — " + away;
      this.matchPhaseEl.textContent = phase;
      this.matchClockEl.textContent = clock;
    }
  }

  private title(): string {
    const titles: Record<SlayerScreen,string> = {home:"Accueil",match:"Match",team:"Mon Équipe",modes:"Modes",shop:"Boutique",missions:"Missions",career:"Carrière",competitions:"Compétitions",online:"En ligne",settings:"Paramètres",pause:"Pause",result:"Résultat",setpiece:"Coup de pied arrêté"};
    return titles[this.screen];
  }

  private description(): string {
    const descriptions: Record<SlayerScreen,string> = {home:"Prépare ton prochain match.",match:"Match en direct.",team:"Formation et gestion de ton équipe.",modes:"Choisis ton expérience de jeu.",shop:"Personnalisation et contenus.",missions:"Objectifs et progression.",career:"Construis ta carrière.",competitions:"Compétitions et tournois.",online:"Fonctions multijoueur.",settings:"Réglages de l'application.",pause:"Le match est temporairement arrêté.",result:"Résumé de la rencontre.",setpiece:"Prépare ton coup de pied arrêté."};
    return descriptions[this.screen];
  }

  private cards(): string {
    return '<article class="feature-card"><b>SLAYER ENGINE</b><span>Simulation football et rendu temps réel.</span></article>' +
      '<article class="feature-card"><b>22 PLAYERS</b><span>Architecture prête pour une équipe complète.</span></article>' +
      '<article class="feature-card"><b>ANDROID</b><span>Pipeline natif en préparation avec Filament.</span></article>';
  }

  private nav(label: string, screen: SlayerScreen) {
    return '<button class="nav-item' + (this.screen === screen ? " active" : "") + '" data-screen="' + screen + '"><span>' + label + "</span></button>";
  }

  private render() {
    this.matchScoreEl = null; this.matchPhaseEl = null; this.matchClockEl = null; this.perfEl = null;
    if (this.screen === "match") {
      this.root.innerHTML =
        '<div class="match-overlay">' +
          '<div class="match-topbar"><button class="icon-button" data-screen="home">←</button><div class="match-badge">SLAYER / LIVE</div>' +
          '<div class="match-score"><span>HOME</span><strong data-match-score>' + this.score.home + " — " + this.score.away + '</strong><span>AWAY</span></div>' +
          '<div class="match-clock" data-match-clock>' + this.score.clock + '</div><button class="match-top-action" data-pause>Ⅱ</button><button class="match-top-action" data-camera>CAM</button></div>' +
          '<div class="perf-overlay" data-performance>PERF MONITOR</div>' +
          '<div class="match-controls"><div class="virtual-joystick" data-joystick><div class="joystick-knob" data-joystick-knob></div></div>' +
          '<div class="radar"><i></i><b></b></div><div class="touch-diamond">' +
          '<button class="act up" data-action="ThroughBall">↟<small>THROUGH</small></button><button class="act left" data-action="Pass">PASS</button>' +
          '<button class="act down" data-action="Dribble">DRIBBLE</button><button class="act right accent" data-action="Shoot">SHOOT</button></div></div>' +
          '<div class="player-indicator"><span>PLAYER 01</span><i></i></div></div>';
      this.perfEl=this.root.querySelector("[data-performance]"); this.matchScoreEl=this.root.querySelector("[data-match-score]");
      this.matchClockEl=this.root.querySelector("[data-match-clock]"); this.joystickEl=this.root.querySelector("[data-joystick]");
      this.joystickKnobEl=this.root.querySelector("[data-joystick-knob]"); this.bind(); return;
    }
    if (this.screen === "pause") {
      this.root.innerHTML='<div class="modal-screen"><div class="pause-card"><div class="eyebrow">SLAYER / PAUSE</div><h2>PAUSE</h2><button class="modal-primary" data-resume>REPRENDRE LE MATCH</button><button data-screen="team">GESTION D’ÉQUIPE</button><button data-screen="settings">PARAMÈTRES</button><button class="danger" data-result>ABANDONNER / QUITTER</button><div class="live-stats"><b>STATISTIQUES EN DIRECT</b><span>Possession&nbsp;&nbsp; 52% — 48%</span><span>Tirs&nbsp;&nbsp; 6 — 4</span><span>Fautes&nbsp;&nbsp; 2 — 3</span><span>Corners&nbsp;&nbsp; 3 — 2</span></div></div></div>'; this.bind(); return;
    }
    if (this.screen === "result") {
      this.root.innerHTML='<div class="result-screen"><div class="result-card"><div class="eyebrow">SLAYER / FINAL</div><h2>RÉSULTAT FINAL</h2><div class="final-score">HOME <strong>'+this.score.home+' — '+this.score.away+'</strong> AWAY</div><div class="result-tabs"><button>STATISTIQUES DU MATCH</button><button>NOTES DES JOUEURS</button></div><div class="result-body"><div><span>Possession</span><b>52% — 48%</b><span>Tirs cadrés</span><b>5 — 3</b><span>Passes réussies</span><b>87% — 82%</b><span>Arrêts</span><b>3 — 4</b></div><aside><b>RÉCOMPENSES</b><strong>+ 1 250 XP</strong><span>+ 320 pièces</span><span>Pass de Saison +12</span></aside></div><button class="modal-primary" data-screen="home">CONTINUER  »</button></div></div>'; this.bind(); return;
    }
    if (this.screen === "setpiece") {
      this.root.innerHTML='<div class="setpiece-screen"><button class="icon-button" data-screen="match">←</button><div class="setpiece-head"><span>COUP DE PIED ARRÊTÉ</span><b>JOUEUR 10 · 84 FK</b></div><button class="setpiece-tool left-tool">⟲</button><button class="setpiece-tool right-tool">⟳</button><div class="swipe-zone">TRACE LA TRAJECTOIRE</div><div class="setpiece-actions"><button>CHANGER DE TIREUR</button><button>COMBINAISON</button></div></div>'; this.bind(); return;
    }
    if (this.screen === "team") {
      const spots=["GB","DD","DC","DC","DG","MC","MC","MOC","AD","BU","AG"];
      this.root.innerHTML='<div class="team-screen"><header class="screen-header"><button class="icon-button" data-screen="home">←</button><div class="ovr">OVR <strong>85</strong></div><button class="save-team" data-screen="home">✓ SAUVEGARDER</button></header><div class="formation-switch"><button>‹</button><b>4-3-3</b><button>›</button></div><div class="team-pitch"><div class="pitch-mid"></div>'+spots.map((p,i)=>'<button class="player-dot dot-'+i+'"><strong>'+p+'</strong><span>'+(82+i%7)+'</span><i></i></button>').join('')+'</div><div class="bench"><b>BANC</b><button>GB 78</button><button>DC 80</button><button>MC 81</button><button>AD 79</button><button>BU 83</button><button>FILTRES</button></div></div>'; this.bind(); return;
    }
    const home=this.screen==="home";
    const content=home
      ? '<section class="hub-hero"><div class="hero-copy"><div class="eyebrow">SLAYER / FOOTBALL HUB</div><h1>SLAYER</h1><p>THE GAME. THE PITCH. YOUR DECISION.</p><button class="primary-cta" data-start="1"><span>JOUER</span><b>→</b></button><div class="quick-meta"><span>OFFLINE READY</span><span>•</span><span>22 PLAYERS</span><span>•</span><span>60 FPS TARGET</span></div></div><div class="hero-visual"><div class="stadium-glow"></div><div class="pitch-card"></div><div class="visual-label">LIVE 3D MATCH ENGINE <b>●</b></div></div></section>'
      : '<section class="subscreen"><div class="eyebrow">SLAYER / '+this.screen.toUpperCase()+'</div><h2>'+this.title()+'</h2><p>'+this.description()+'</p><div class="feature-grid">'+this.cards()+'</div></section>';
    this.root.innerHTML='<div class="ui-backdrop"><div class="ui-grid"></div><div class="ui-noise"></div></div><header class="topbar"><div class="profile-card"><span class="profile-avatar">P1</span><div><b>PLAYER 01</b><small>LV 12 · 4 820 XP</small></div></div><div class="global-energy">ENDURANCE <span></span></div><div class="economy"><b>◈ 12 450</b><strong>✦ 860</strong><button data-screen="settings">⚙</button></div></header>'+content+'<nav class="main-nav">'+this.nav("Accueil","home")+this.nav("Mon Équipe","team")+this.nav("Modes","modes")+this.nav("Boutique","shop")+this.nav("Missions","missions")+'</nav><div class="news-tile">NEWS / BOUTIQUE <b>Nouveaux maillots · Événement du week-end</b></div>';
    this.bind();
  }

  private bind() {
    this.root.querySelectorAll<HTMLElement>("[data-screen]").forEach(el =>
      el.addEventListener("click", () => this.setScreen(el.dataset.screen as SlayerScreen))
    );

    this.root.querySelector<HTMLElement>("[data-pause]")?.addEventListener("click", () => this.openPause());
    this.root.querySelector<HTMLElement>("[data-result]")?.addEventListener("click", () => this.showResult());
    this.root.querySelector<HTMLElement>("[data-resume]")?.addEventListener("click", () => this.setScreen("match"));
    this.root.querySelector<HTMLElement>("[data-start]")?.addEventListener("click", () => {
      this.onStartMatch();
      this.setScreen("match");
    });

    this.root.querySelectorAll<HTMLButtonElement>("[data-action]").forEach(button => {
      const action = button.dataset.action as SlayerMatchAction;
      button.addEventListener("pointerdown", event => {
        event.preventDefault();
        this.onMatchAction?.(action);
      });
    });

    const joystick = this.joystickEl;
    const knob = this.joystickKnobEl;
    if (joystick && knob) {
      const move = (event: PointerEvent) => {
        const rect = joystick.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const radius = rect.width * .36;
        let x = event.clientX - cx;
        let z = event.clientY - cy;
        const length = Math.hypot(x, z);
        if (length > radius) { x *= radius / length; z *= radius / length; }
        knob.style.transform = "translate(" + x + "px, " + z + "px)";
        this.onMove?.({x:x/radius,z:z/radius});
      };
      const reset = () => {
        this.joystickPointerId = null;
        knob.style.transform = "translate(0, 0)";
        this.onMove?.({x:0,z:0});
      };
      joystick.addEventListener("pointerdown", event => {
        event.preventDefault();
        this.joystickPointerId = event.pointerId;
        joystick.setPointerCapture(event.pointerId);
        move(event);
      });
      joystick.addEventListener("pointermove", event => {
        if (event.pointerId === this.joystickPointerId) move(event);
      });
      joystick.addEventListener("pointerup", event => {
        if (event.pointerId === this.joystickPointerId) reset();
      });
      joystick.addEventListener("pointercancel", reset);
    }

    const sprint = this.root.querySelector<HTMLButtonElement>("[data-sprint]");
    if (sprint) {
      const release = () => this.onSprint?.(false);
      sprint.addEventListener("pointerdown", event => {
        event.preventDefault();
        this.onSprint?.(true);
      });
      sprint.addEventListener("pointerup", release);
      sprint.addEventListener("pointercancel", release);
      sprint.addEventListener("pointerleave", release);
    }
  }
}
