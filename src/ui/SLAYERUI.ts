import "./ui.css";

export type SlayerScreen = "home"|"match"|"team"|"career"|"competitions"|"online"|"settings";

export class SlayerUI {
  private root: HTMLDivElement;
  private screen: SlayerScreen = "home";
  private score = { home: 0, away: 0, clock: "00:00", phase: "KICKOFF" };

  constructor(app: HTMLDivElement, private readonly onStartMatch: () => void) {
    this.root=document.createElement("div");
    this.root.className="slayer-ui";
    app.appendChild(this.root);
    this.render();
  }

  setScreen(screen: SlayerScreen){ this.screen=screen; this.render(); }

  updateMatch(home:number,away:number,clock:string,phase:string){
    this.score={home,away,clock,phase};
    if(this.screen==="match") this.render();
  }

  private nav(label:string,screen:SlayerScreen){
    return '<button class="nav-item'+(this.screen===screen?" active":"")+'" data-screen="'+screen+'"><span>'+label+'</span></button>';
  }

  private render(){
    if(this.screen==="match"){
      this.root.innerHTML='<div class="match-overlay"><div class="match-topbar"><button class="icon-button" data-screen="home">←</button><div class="match-badge">SLAYER / LIVE</div><div class="match-score"><span>HOME</span><strong>'+this.score.home+' — '+this.score.away+'</strong><span>AWAY</span></div><div class="match-phase">'+this.score.phase+'</div><div class="match-clock">'+this.score.clock+'</div></div><div class="match-bottom"><div class="radar"><i></i><b></b></div><div class="touch-actions"><button>PASS</button><button class="accent">SHOOT</button><button>SPRINT</button></div></div></div>';
      this.bind();
      return;
    }
    const home=this.screen==="home";
    const content=home
      ? '<section class="hero"><div class="hero-copy"><div class="eyebrow">NEXT GENERATION FOOTBALL SIMULATION</div><h1>SLAYER</h1><p>THE GAME. THE PITCH. YOUR DECISION.</p><button class="primary-cta" data-start="1"><span>PLAY MATCH</span><b>→</b></button><div class="quick-meta"><span>OFFLINE READY</span><span>•</span><span>22 PLAYERS</span><span>•</span><span>60 FPS TARGET</span></div></div><div class="hero-visual"><div class="stadium-glow"></div><div class="pitch-card"><div class="pitch-lines"></div><div class="pitch-box left"></div><div class="pitch-box right"></div><div class="pitch-player p1"></div><div class="pitch-player p2"></div><div class="pitch-player p3"></div><div class="pitch-ball"></div></div><div class="visual-label">LIVE MATCH ENGINE <b>●</b></div></div></section>'
      : '<section class="subscreen"><div class="eyebrow">SLAYER / '+this.screen.toUpperCase()+'</div><h2>'+this.title()+'</h2><p>'+this.description()+'</p><div class="feature-grid">'+this.cards()+'</div></section>';
    this.root.innerHTML='<div class="ui-backdrop"><div class="ui-grid"></div><div class="ui-noise"></div></div><header class="topbar"><div class="brand"><span class="brand-mark">S</span><span>SLAYER</span><small>0.1</small></div><div class="profile"><span class="profile-dot"></span><span>PLAYER 01</span></div></header>'+content+'<nav class="main-nav">'+this.nav("Home","home")+this.nav("Team","team")+this.nav("Career","career")+this.nav("Competitions","competitions")+this.nav("Online","online")+this.nav("Settings","settings")+'</nav>';
    this.bind();
  }

  private title(){return ({team:"YOUR TEAM",career:"CAREER MODE",competitions:"COMPETITIONS",online:"ONLINE HUB",settings:"SETTINGS"} as Record<string,string>)[this.screen]??"SLAYER";}
  private description(){return ({team:"Squad, formation, roles and tactical identity.",career:"Build a club and progress through seasons.",competitions:"Leagues, cups and tournaments.",online:"Matchmaking, friends and connected football.",settings:"Graphics, audio, controls and gameplay."} as Record<string,string>)[this.screen]??"";}
  private cards(){return ({"team":["SQUAD","FORMATION","TACTICS"],"career":["SEASON","TRAINING","TRANSFERS"],"competitions":["QUICK CUP","LEAGUE","TOURNAMENT"],"online":["MATCHMAKING","FRIENDS","SYNC"],"settings":["GRAPHICS","AUDIO","CONTROLS"]} as Record<string,string[]>)[this.screen]?.map((x,i)=>'<button class="feature-card"><span>0'+(i+1)+'</span><strong>'+x+'</strong><b>↗</b></button>').join("")??"";}

  private bind(){
    this.root.querySelectorAll<HTMLElement>("[data-screen]").forEach(el=>el.addEventListener("click",()=>this.setScreen(el.dataset.screen as SlayerScreen)));
    this.root.querySelector<HTMLElement>("[data-start]")?.addEventListener("click",()=>{this.onStartMatch();this.setScreen("match");});
  }
}
