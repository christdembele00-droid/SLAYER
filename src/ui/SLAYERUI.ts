import "./ui.css";

export type SlayerScreen = "home" | "match" | "team" | "career" | "competitions" | "online" | "settings";

const icon = (name: string) => {
  const paths: Record<string,string> = {
    play: '<path d="M8 5.2v13.6L19 12 8 5.2Z" fill="currentColor"/>',
    users: '<path d="M16 20v-1.7a3.6 3.6 0 0 0-3.6-3.6H6.6A3.6 3.6 0 0 0 3 18.3V20"/><circle cx="9.5" cy="7.5" r="3.5"/><path d="M17 11a3 3 0 1 0 0-6"/><path d="M21 20v-1.5a3.4 3.4 0 0 0-2.5-3.3"/>',
    trophy: '<path d="M8 4h8v4.5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H4v1.5a4 4 0 0 0 4 4M16 6h4v1.5a4 4 0 0 1-4 4M12 12.5V17M8.5 20h7"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.8 9h16.4M3.8 15h16.4M12 3.5c2.2 2.4 3.3 5.2 3.3 8.5S14.2 18.1 12 20.5C9.8 18.1 8.7 15.3 8.7 12S9.8 5.9 12 3.5Z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1a1.8 1.8 0 0 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3.1 1.2v.2a1.8 1.8 0 0 1-3.6 0v-.2A1.8 1.8 0 0 0 7.1 17l-.1.1a1.8 1.8 0 1 1-2.5-2.5l.1-.1A1.8 1.8 0 0 0 3.4 11H3.2a1.8 1.8 0 0 1 0-3.6h.2A1.8 1.8 0 0 0 4.6 4.3l-.1-.1A1.8 1.8 0 1 1 7 1.7l.1.1A1.8 1.8 0 0 0 10.2.6V.4a1.8 1.8 0 0 1 3.6 0v.2a1.8 1.8 0 0 0 3.1 1.2l.1-.1a1.8 1.8 0 1 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 1.2 3.1h.2a1.8 1.8 0 0 1 0 3.6h-.2a1.8 1.8 0 0 0-1.2 3.1Z"/>',
    arrow: '<path d="M5 12h13M13 6l6 6-6 6"/>'
  };
  return '<svg viewBox="0 0 24 24" aria-hidden="true">'+(paths[name]??paths.play)+'</svg>';
};

export class SlayerUI {
  private root: HTMLDivElement;
  private screen: SlayerScreen = "home";
  private onStartMatch: () => void;

  constructor(app: HTMLDivElement, onStartMatch: () => void) {
    this.root = document.createElement("div");
    this.root.className = "slayer-ui";
    this.onStartMatch = onStartMatch;
    app.appendChild(this.root);
    this.render();
  }

  setScreen(screen: SlayerScreen) {
    this.screen = screen;
    this.render();
  }

  private nav(label: string, screen: SlayerScreen, iconName: string) {
    const active = this.screen === screen ? " active" : "";
    return '<button class="nav-item'+active+'" data-screen="'+screen+'"><span class="nav-icon">'+icon(iconName)+'</span><span>'+label+'</span></button>';
  }

  private render() {
    if (this.screen === "match") {
      this.root.innerHTML = '<div class="match-overlay"><div class="match-topbar"><button class="icon-button" data-screen="home">←</button><div class="match-badge">MATCH</div><div class="match-score"><b>HOME</b><strong>0 — 0</strong><b>AWAY</b></div><div class="match-clock">00:00</div></div><div class="match-controls"><div class="radar"><span></span><i></i></div><div class="touch-actions"><button>PASS</button><button>SHOOT</button><button>SPRINT</button></div></div></div>';
      this.bind();
      return;
    }

    const hero = this.screen === "home"
      ? '<section class="hero"><div class="hero-copy"><div class="eyebrow">NEXT GENERATION FOOTBALL SIMULATION</div><h1>SLAYER</h1><p>THE GAME. THE PITCH. YOUR DECISION.</p><button class="primary-cta" data-start="1">'+icon("play")+'<span>PLAY MATCH</span>'+icon("arrow")+'</button><div class="quick-meta"><span>OFFLINE READY</span><span>•</span><span>22 PLAYERS</span><span>•</span><span>60 FPS TARGET</span></div></div><div class="hero-visual"><div class="stadium-glow"></div><div class="pitch-card"><div class="pitch-lines"></div><div class="pitch-box left"></div><div class="pitch-box right"></div><div class="pitch-player p1"></div><div class="pitch-player p2"></div><div class="pitch-player p3"></div><div class="pitch-ball"></div></div><div class="visual-label">LIVE MATCH ENGINE <b>●</b></div></div></section>'
      : '<section class="subscreen"><div class="eyebrow">SLAYER / '+this.screen.toUpperCase()+'</div><h2>'+this.screenTitle()+'</h2><p>'+this.screenDescription()+'</p><div class="feature-grid">'+this.cardsForScreen()+'</div></section>';

    this.root.innerHTML = '<div class="ui-backdrop"><div class="ui-grid"></div><div class="ui-noise"></div></div><header class="topbar"><div class="brand"><span class="brand-mark">S</span><span>SLAYER</span><small>0.1</small></div><div class="profile"><span class="profile-dot"></span><span>PLAYER 01</span><span class="chevron">⌄</span></div></header>'+hero+'<nav class="main-nav">'+this.nav("Home","home","play")+this.nav("Team","team","users")+this.nav("Career","career","trophy")+this.nav("Competitions","competitions","trophy")+this.nav("Online","online","globe")+this.nav("Settings","settings","settings")+'</nav>';
    this.bind();
  }

  private screenTitle() {
    const titles: Record<string,string> = {team:"YOUR TEAM",career:"CAREER MODE",competitions:"COMPETITIONS",online:"ONLINE HUB",settings:"SETTINGS"};
    return titles[this.screen] ?? "SLAYER";
  }

  private screenDescription() {
    const descriptions: Record<string,string> = {
      team:"Manage your squad, formation, roles and tactical identity.",
      career:"Build a club, develop players and progress through seasons.",
      competitions:"Choose a competition and take your team to the next match.",
      online:"Matchmaking, friends and connected football.",
      settings:"Graphics, audio, controls and gameplay configuration."
    };
    return descriptions[this.screen] ?? "";
  }

  private cardsForScreen() {
    const cards: Record<string,string[]> = {
      team:["SQUAD","FORMATION","TACTICS"],
      career:["SEASON","TRAINING","TRANSFERS"],
      competitions:["QUICK CUP","LEAGUE","TOURNAMENT"],
      online:["MATCHMAKING","FRIENDS","SYNC"],
      settings:["GRAPHICS","AUDIO","CONTROLS"]
    };
    return (cards[this.screen]??[]).map((x,i)=>'<button class="feature-card"><span class="card-index">0'+(i+1)+'</span><strong>'+x+'</strong><span class="card-arrow">↗</span></button>').join("");
  }

  private bind() {
    this.root.querySelectorAll<HTMLElement>("[data-screen]").forEach(el => {
      el.addEventListener("click", () => this.setScreen(el.dataset.screen as SlayerScreen));
    });
    this.root.querySelector<HTMLElement>("[data-start]")?.addEventListener("click", () => {
      this.onStartMatch();
      this.setScreen("match");
    });
  }
}
