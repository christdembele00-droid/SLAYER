import "./ui.css";

export type SlayerScreen = "home"|"match"|"team"|"career"|"competitions"|"online"|"settings";
export type SlayerMatchAction = "Pass"|"Shoot"|"Control";
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

  updateMatch(home: number, away: number, clock: string, phase: string) {
    this.score = { home, away, clock, phase };
    if (this.screen !== "match") return;
    if (this.matchScoreEl && this.matchPhaseEl && this.matchClockEl) {
      this.matchScoreEl.textContent = home + " — " + away;
      this.matchPhaseEl.textContent = phase;
      this.matchClockEl.textContent = clock;
    }
  }

  private nav(label: string, screen: SlayerScreen) {
    return '<button class="nav-item' + (this.screen === screen ? " active" : "") + '" data-screen="' + screen + '"><span>' + label + "</span></button>";
  }

  private render() {
    this.matchScoreEl = null;
    this.matchPhaseEl = null;
    this.matchClockEl = null;

    if (this.screen === "match") {
      this.root.innerHTML =
        '<div class="match-overlay">' +
          '<div class="match-topbar">' +
            '<button class="icon-button" data-screen="home" aria-label="Back">←</button>' +
            '<div class="match-badge">SLAYER / LIVE</div>' +
            '<div class="match-score"><span>HOME</span><strong data-match-score>' + this.score.home + " — " + this.score.away + '</strong><span>AWAY</span></div>' +
            '<div class="match-phase" data-match-phase>' + this.score.phase + "</div>" +
            '<div class="match-clock" data-match-clock>' + this.score.clock + "</div>" +
          "</div>" +
          '<div class="match-controls">' +
            '<div class="radar"><i></i><b></b></div>' +
            '<div class="touch-actions">' +
              '<button type="button" data-action="Pass">PASS</button>' +
              '<button type="button" class="accent" data-action="Shoot">SHOOT</button>' +
              '<button type="button" data-sprint="1">SPRINT</button>' +
            "</div>" +
          "</div>" +
        "</div>";
      this.matchScoreEl = this.root.querySelector("[data-match-score]");
      this.matchPhaseEl = this.root.querySelector("[data-match-phase]");
      this.matchClockEl = this.root.querySelector("[data-match-clock]");
      this.joystickEl = this.root.querySelector("[data-joystick]");
      this.joystickKnobEl = this.root.querySelector("[data-joystick-knob]");
      this.bind();
      return;
    }

    const home = this.screen === "home";
    const content = home
      ? '<section class="hero"><div class="hero-copy"><div class="eyebrow">NEXT GENERATION FOOTBALL SIMULATION</div><h1>SLAYER</h1><p>THE GAME. THE PITCH. YOUR DECISION.</p><button class="primary-cta" data-start="1"><span>PLAY MATCH</span><b>→</b></button><div class="quick-meta"><span>OFFLINE READY</span><span>•</span><span>22 PLAYERS</span><span>•</span><span>60 FPS TARGET</span></div></div><div class="hero-visual"><div class="stadium-glow"></div><div class="pitch-card"><div class="pitch-lines"></div><div class="pitch-box left"></div><div class="pitch-box right"></div><div class="pitch-player p1"></div><div class="pitch-player p2"></div><div class="pitch-player p3"></div><div class="pitch-ball"></div></div><div class="visual-label">LIVE MATCH ENGINE <b>●</b></div></div></section>'
      : '<section class="subscreen"><div class="eyebrow">SLAYER / ' + this.screen.toUpperCase() + '</div><h2>' + this.title() + '</h2><p>' + this.description() + '</p><div class="feature-grid">' + this.cards() + "</div></section>";

    this.root.innerHTML =
      '<div class="ui-backdrop"><div class="ui-grid"></div><div class="ui-noise"></div></div>' +
      '<header class="topbar"><div class="brand"><span class="brand-mark">S</span><span>SLAYER</span><small>0.1</small></div><div class="profile"><span class="profile-dot"></span><span>PLAYER 01</span></div></header>' +
      content +
      '<nav class="main-nav">' +
        this.nav("Home","home") + this.nav("Team","team") + this.nav("Career","career") +
        this.nav("Competitions","competitions") + this.nav("Online","online") + this.nav("Settings","settings") +
      "</nav>";
    this.bind();
  }

  private title() {
    return ({team:"YOUR TEAM",career:"CAREER MODE",competitions:"COMPETITIONS",online:"ONLINE HUB",settings:"SETTINGS"} as Record<string,string>)[this.screen] ?? "SLAYER";
  }

  private description() {
    return ({team:"Squad, formation, roles and tactical identity.",career:"Build a club and progress through seasons.",competitions:"Leagues, cups and tournaments.",online:"Matchmaking, friends and connected football.",settings:"Graphics, audio, controls and gameplay."} as Record<string,string>)[this.screen] ?? "";
  }

  private cards() {
    return ({"team":["SQUAD","FORMATION","TACTICS"],"career":["SEASON","TRAINING","TRANSFERS"],"competitions":["QUICK CUP","LEAGUE","TOURNAMENT"],"online":["MATCHMAKING","FRIENDS","SYNC"],"settings":["GRAPHICS","AUDIO","CONTROLS"]} as Record<string,string[]>)[this.screen]?.map((x,i)=>'<button class="feature-card"><span>0' + (i+1) + "</span><strong>" + x + "</strong><b>↗</b></button>").join("") ?? "";
  }

  private bind() {
    this.root.querySelectorAll<HTMLElement>("[data-screen]").forEach(el =>
      el.addEventListener("click", () => this.setScreen(el.dataset.screen as SlayerScreen))
    );

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
