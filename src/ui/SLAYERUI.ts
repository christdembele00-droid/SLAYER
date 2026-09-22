import "./ui.css";

export type SlayerScreen = "home"|"match"|"team"|"modes"|"shop"|"missions"|"career"|"competitions"|"online"|"settings"|"pause"|"result"|"setpiece";
export type SlayerMatchAction = "Pass"|"Shoot"|"Control"|"Dribble"|"StandingTackle"|"ThroughBall"|"SlideTackle"|"Press";
export interface SlayerMoveInput { x:number; z:number; }

type TeamPlayer={id:string;name:string;pos:string;rating:number;form:number;starter:boolean};

export class SlayerUI {
  private readonly root:HTMLDivElement;
  private screen:SlayerScreen="home";
  private score={home:0,away:0,clock:"00:00",phase:"KICKOFF"};
  private matchScoreEl:HTMLElement|null=null;
  private matchPhaseEl:HTMLElement|null=null;
  private matchClockEl:HTMLElement|null=null;
  private joystickEl:HTMLElement|null=null;
  private joystickKnobEl:HTMLElement|null=null;
  private joystickPointerId:number|null=null;
  private perfEl:HTMLElement|null=null;
  private radarEl:HTMLElement|null=null;
  private modalFromMatch=false;
  private formationIndex=0;
  private resultTab:"stats"|"players"="stats";
  private draggingId:string|null=null;
  private setPieceDrawing=false;
  private setPiecePath:{x:number;y:number}[]=[];
  private abandonConfirm=false;
  private matchSettings={duration:10,extraTime:true,penalties:true,subs:5,form:"random",time:"day",weather:"clear",grass:"short-dry",stadium:"SLAYER Arena",ball:"SLAYER Pro",control:"virtual",passAssist:2,shotAssist:"manual",cursor:"semi",press:"individual",attack:"balanced",fps:60,quality:"high",dynamicResolution:true,camera:"broadcast",radar:true,commentary:"fr",music:55,commentaryVolume:85,crowd:80,effects:90};
  private menuSection:"modes"|"match-settings"|"controls"|"display"|"audio"="modes";
  private setOption<K extends keyof typeof this.matchSettings>(key:K,value:(typeof this.matchSettings)[K]):void{this.matchSettings[key]=value;this.render();}
  private optionButtons(key:string,values:string[],current:string):string{return values.map(v=>`<button class="option-chip ${v===current?"active":""}" data-option-key="${key}" data-option-value="${v}">${v}</button>`).join("");}

  private team:TeamPlayer[]=[
    {id:"p1",name:"K. N'GUESSAN",pos:"GB",rating:84,form:92,starter:true},
    {id:"p2",name:"A. KOUASSI",pos:"DD",rating:85,form:88,starter:true},
    {id:"p3",name:"M. TRAORÉ",pos:"DC",rating:86,form:91,starter:true},
    {id:"p4",name:"J. KOFFI",pos:"DC",rating:83,form:76,starter:true},
    {id:"p5",name:"S. DIARRA",pos:"DG",rating:81,form:68,starter:true},
    {id:"p6",name:"Y. FOFANA",pos:"MC",rating:88,form:94,starter:true},
    {id:"p7",name:"D. YAO",pos:"MC",rating:84,form:82,starter:true},
    {id:"p8",name:"R. KONÉ",pos:"MOC",rating:89,form:96,starter:true},
    {id:"p9",name:"B. COULIBALY",pos:"AD",rating:86,form:87,starter:true},
    {id:"p10",name:"I. BAKAYOKO",pos:"BU",rating:91,form:95,starter:true},
    {id:"p11",name:"E. SANGARÉ",pos:"AG",rating:87,form:84,starter:true},
    {id:"p12",name:"T. N'DRI",pos:"GB",rating:78,form:72,starter:false},
    {id:"p13",name:"F. TOURÉ",pos:"DC",rating:80,form:79,starter:false},
    {id:"p14",name:"A. KOFFI",pos:"MC",rating:82,form:86,starter:false},
    {id:"p15",name:"C. AMANI",pos:"AD",rating:79,form:65,starter:false},
    {id:"p16",name:"M. KONAN",pos:"BU",rating:83,form:90,starter:false}
  ];

  constructor(app:HTMLDivElement,private readonly onStartMatch:()=>void,private readonly onMatchAction?:(action:SlayerMatchAction)=>void,private readonly onSprint?:(pressed:boolean)=>void,private readonly onMove?:(move:SlayerMoveInput)=>void,private readonly onCameraMode?:(mode:"match"|"hero"|"setpiece")=>void){
    this.root=document.createElement("div"); this.root.className="slayer-ui"; app.appendChild(this.root); this.render();
  }

  setScreen(screen:SlayerScreen){this.screen=screen;this.abandonConfirm=false;this.onCameraMode?.(screen==="home"?"hero":screen==="setpiece"?"setpiece":"match");this.render();}
  openPause(){this.modalFromMatch=true;this.screen="pause";this.render();}
  openSetPiece(){this.screen="setpiece";this.render();}
  showResult(){this.screen="result";this.render();}
  updatePerformance(fps:number,frameMs:number,p95Ms:number,drawCalls:number,triangles:number,tier:string){
    if(this.perfEl)this.perfEl.textContent=`FPS ${fps.toFixed(0)} | ${frameMs.toFixed(1)}ms | P95 ${p95Ms.toFixed(1)}ms | GPU DC ${drawCalls} | TRI ${(triangles/1000).toFixed(0)}k | ${tier}`;
  }
  updateMatch(home:number,away:number,clock:string,phase:string){
    this.score={home,away,clock,phase};
    if(this.screen==="match"){this.matchScoreEl?.replaceChildren(document.createTextNode(`${home} — ${away}`));this.matchPhaseEl?.replaceChildren(document.createTextNode(phase));this.matchClockEl?.replaceChildren(document.createTextNode(clock));}
  }

  private formation():string{return ["4-3-3","4-4-2","3-5-2","4-2-3-1"][this.formationIndex];}
  private ovr():number{const starters=this.team.filter(p=>p.starter);return Math.round(starters.reduce((s,p)=>s+p.rating,0)/starters.length);}
  private formClass(v:number):string{return v>=85?"good":v>=70?"mid":"bad";}
  private title():string{return ({home:"Accueil",match:"Match",team:"Mon Équipe",modes:"Modes de Jeu",shop:"Boutique",missions:"Missions",career:"Carrière",competitions:"Compétitions",online:"En ligne",settings:"Paramètres",pause:"Pause",result:"Fin de match",setpiece:"Coup de pied arrêté"} as Record<SlayerScreen,string>)[this.screen];}

  private nav(label:string,screen:SlayerScreen){return `<button class="nav-item${this.screen===screen?" active":""}" data-screen="${screen}"><span>${label}</span></button>`;}

  private renderHome(){
    return `<section class="hub-hero">
      <div class="hero-copy"><div class="eyebrow">SLAYER / FOOTBALL HUB</div><h1>SLAYER</h1><p>THE GAME. THE PITCH. YOUR DECISION.</p>
      <button class="primary-cta" data-start="1"><span>JOUER</span><b>→</b></button>
      <div class="quick-meta"><span>OFFLINE READY</span><span>•</span><span>22 PLAYERS</span><span>•</span><span>60 FPS TARGET</span></div></div>
      <div class="hero-visual"><div class="hero-player-glow"></div><div class="hero-player"><div class="hero-head"></div><div class="hero-body"></div><div class="hero-shorts"></div><div class="hero-leg l"></div><div class="hero-leg r"></div><div class="hero-ball"></div></div><div class="hero-depth"></div><div class="visual-label">LIVE 3D PLAYER <b>●</b></div></div>
    </section>`;
  }

  private renderModes(){
    const section=this.menuSection;
    return `<section class="six-screen modes-dashboard">
      <div class="screen-header"><button class="icon-button" data-screen="home">←</button><div><div class="eyebrow">SLAYER / GAME CENTER</div><h2>MODES DE JEU</h2></div></div>
      <div class="mode-tabs">
        <button class="${section==="modes"?"active":""}" data-menu-section="modes">MODES</button>
        <button class="${section==="match-settings"?"active":""}" data-menu-section="match-settings">CONFIG MATCH</button>
        <button class="${section==="controls"?"active":""}" data-menu-section="controls">COMMANDES</button>
      </div>
      ${section==="modes"?`<div class="mode-grid realistic-mode-grid">
        <button class="mode-card featured mode-match" data-start="1"><small>OFFLINE / 11v11</small><b>MATCH RAPIDE</b><span>Coup d'envoi immédiat · ${this.matchSettings.duration} MIN</span></button>
        <button class="mode-card mode-dream"><small>TEAM BUILDING</small><b>DREAM TEAM</b><span>Ligue, événements PvP/IA, co-op, salles privées</span></button>
        <button class="mode-card mode-auth"><small>EXHIBITION</small><b>MATCH AUTHENTIQUE</b><span>Clubs, sélections, stades et paramètres réels</span></button>
        <button class="mode-card"><small>COMPÉTITION</small><b>COUPE</b><span>Tableau à élimination directe</span></button>
        <button class="mode-card"><small>SAISON</small><b>CHAMPIONNAT</b><span>Classement, journées, montée et descente</span></button>
        <button class="mode-card" data-screen="career"><small>MANAGEMENT</small><b>CARRIÈRE</b><span>Effectif, progression, tactique et résultats</span></button>
        <button class="mode-card"><small>SKILL LAB</small><b>ENTRAÎNEMENT</b><span>Libre · coups francs · corners · penalties · touches</span></button>
        <button class="mode-card"><small>ONLINE</small><b>PvP / CO-OP</b><span>Matchmaking, amis, 2v2/3v3 et salles</span></button>
      </div>`:section==="match-settings"?`<div class="settings-panel match-config">
        <article><b>FORMAT DU MATCH</b><label>DURÉE</label><div class="option-row">${this.optionButtons("duration",["5","8","10","12"],String(this.matchSettings.duration))}</div><label>PROLONGATIONS</label><div class="option-row">${this.optionButtons("extraTime",["on","off"],this.matchSettings.extraTime?"on":"off")}</div><label>PENALTYS</label><div class="option-row">${this.optionButtons("penalties",["on","off"],this.matchSettings.penalties?"on":"off")}</div><label>REMPLACEMENTS</label><div class="option-row">${this.optionButtons("subs",["3","4","5"],String(this.matchSettings.subs))}</div><label>FORME</label><div class="option-row">${this.optionButtons("form",["random","excellent","normal"],this.matchSettings.form)}</div></article>
        <article><b>ENVIRONNEMENT</b><label>MOMENT</label><div class="option-row">${this.optionButtons("time",["day","sunset","night"],this.matchSettings.time)}</div><label>MÉTÉO</label><div class="option-row">${this.optionButtons("weather",["clear","rain","snow"],this.matchSettings.weather)}</div><label>GAZON</label><div class="option-row">${this.optionButtons("grass",["short-dry","long-dry","short-wet"],this.matchSettings.grass)}</div><label>STADE</label><div class="option-row">${this.optionButtons("stadium",["SLAYER Arena","Abidjan Stadium","Metropolitan"],this.matchSettings.stadium)}</div><label>BALLON</label><div class="option-row">${this.optionButtons("ball",["SLAYER Pro","Classic","Match Ball"],this.matchSettings.ball)}</div></article>
      </div>`: `<div class="settings-panel controls-config">
        <article><b>COMMANDES</b><label>TYPE</label><div class="option-row">${this.optionButtons("control",["touch","virtual","gamepad"],this.matchSettings.control)}</div><label>ASSISTANCE PASSE</label><div class="option-row">${this.optionButtons("passAssist",["1","2","3","4"],String(this.matchSettings.passAssist))}</div><label>ASSISTANCE TIR</label><div class="option-row">${this.optionButtons("shotAssist",["assisted","manual"],this.matchSettings.shotAssist)}</div><label>CHANGEMENT JOUEUR</label><div class="option-row">${this.optionButtons("cursor",["auto","semi","manual"],this.matchSettings.cursor)}</div><label>PRESSING</label><div class="option-row">${this.optionButtons("press",["individual","double"],this.matchSettings.press)}</div></article>
        <article><b>TACTIQUE EN MATCH</b><label>BLOC ATTAQUE / DÉFENSE</label><div class="option-row">${this.optionButtons("attack",["defensive","balanced","offensive"],this.matchSettings.attack)}</div><div class="tactic-meter"><i style="width:${this.matchSettings.attack==="defensive"?28:this.matchSettings.attack==="offensive"?82:50}%"></i></div><p>Le curseur dynamique sera accessible pendant le match.</p></article>
      </div>`}
    </section>`;
  }

  private renderCareer(){
    return `<section class="six-screen career-dashboard"><div class="screen-header"><button class="icon-button" data-screen="home">←</button><div><div class="eyebrow">SLAYER / 05</div><h2>CARRIÈRE</h2></div><span class="career-season">SAISON 01</span></div>
    <div class="career-hero"><div><span class="eyebrow">OBJECTIF</span><h3>CONSTRUIRE UNE ÉQUIPE COMPÉTITIVE</h3><p>Gestion d'effectif, tactique, progression et résultats.</p></div><strong>12<br><small>JOURNÉES</small></strong></div>
    <div class="career-grid"><article><b>PROCHAIN MATCH</b><strong>SLAYER FC vs ABIDJAN XI</strong><span>Dimanche · 18:00</span></article><article><b>OBJECTIFS</b><span>Gagner 3 matchs</span><span>Marquer 8 buts</span><span>Conserver 2 clean sheets</span></article><article><b>PROGRESSION</b><strong>LV 12 → LV 13</strong><div class="progress"><i style="width:72%"></i></div><span>7 200 / 10 000 XP</span></article></div></section>`;
  }

  private renderSettings(){
    const section=this.menuSection;
    return `<section class="six-screen settings-dashboard"><div class="screen-header"><button class="icon-button" data-screen="home">←</button><div><div class="eyebrow">SLAYER / SYSTEM</div><h2>PARAMÈTRES</h2></div></div>
      <div class="mode-tabs">
        <button class="${section==="display"?"active":""}" data-menu-section="display">GRAPHISMES</button>
        <button class="${section==="audio"?"active":""}" data-menu-section="audio">AUDIO</button>
      </div>
      ${section==="display"?`<div class="settings-panel">
        <article><b>RENDU</b><label>FPS CIBLE</label><div class="option-row">${this.optionButtons("fps",["30","60","90","120"],String(this.matchSettings.fps))}</div><label>QUALITÉ</label><div class="option-row">${this.optionButtons("quality",["low","medium","high","ultra"],this.matchSettings.quality)}</div><label>RÉSOLUTION DYNAMIQUE</label><div class="option-row">${this.optionButtons("dynamicResolution",["on","off"],this.matchSettings.dynamicResolution?"on":"off")}</div><p class="tech-note">Le moteur natif Filament/Vulkan applique les options disponibles selon le GPU.</p></article>
        <article><b>PRÉSENTATION</b><label>CAMÉRA</label><div class="option-row">${this.optionButtons("camera",["broadcast","dynamic","overview","pro"],this.matchSettings.camera)}</div><label>RADAR</label><div class="option-row">${this.optionButtons("radar",["on","off"],this.matchSettings.radar?"on":"off")}</div><div class="graphics-preview"><div class="preview-pitch"><i></i><b></b><em></em></div><span>APERÇU RENDU 3D</span></div></article>
      </div>`: `<div class="settings-panel"><article><b>MIXEUR AUDIO</b><label>MUSIQUE <strong>${this.matchSettings.music}%</strong></label><input type="range" min="0" max="100" value="${this.matchSettings.music}" data-range="music"><label>COMMENTAIRES <strong>${this.matchSettings.commentaryVolume}%</strong></label><input type="range" min="0" max="100" value="${this.matchSettings.commentaryVolume}" data-range="commentaryVolume"><label>PUBLIC <strong>${this.matchSettings.crowd}%</strong></label><input type="range" min="0" max="100" value="${this.matchSettings.crowd}" data-range="crowd"><label>EFFETS / IMPACTS <strong>${this.matchSettings.effects}%</strong></label><input type="range" min="0" max="100" value="${this.matchSettings.effects}" data-range="effects"></article><article><b>COMMENTAIRES</b><label>PACK</label><div class="option-row">${this.optionButtons("commentary",["fr","en","es"],this.matchSettings.commentary)}</div><p>Les packs audio sont chargés localement lorsqu'ils sont disponibles.</p></article></div>`}
    </section>`;
  }

  private renderTeam(){
    const starters=this.team.filter(p=>p.starter);
    const bench=this.team.filter(p=>!p.starter);
    return `<div class="team-screen"><header class="screen-header"><button class="icon-button" data-screen="home">←</button><div class="ovr">OVR <strong>${this.ovr()}</strong></div><button class="save-team" data-screen="home">✓ SAUVEGARDER</button></header>
      <div class="formation-switch"><button data-formation="-1">‹</button><b>${this.formation()}</b><button data-formation="1">›</button></div>
      <div class="team-pitch"><div class="pitch-mid"></div><div class="pitch-circle"></div>
      ${starters.map((p,i)=>`<button draggable="true" class="player-dot dot-${i} ${this.formClass(p.form)}" data-player="${p.id}" title="${p.name}"><strong>${p.pos}</strong><span>${p.rating}</span><i style="width:${p.form}%"></i></button>`).join("")}</div>
      <div class="bench"><b>BANC / RÉSERVISTES</b>${bench.map(p=>`<button draggable="true" data-player="${p.id}" class="bench-player"><span class="mini-avatar">${p.name.split(" ").map(x=>x[0]).join("").slice(0,2)}</span><b>${p.pos}</b><span>${p.rating}</span></button>`).join("")}<button data-filter>FILTRES</button></div>
      <div class="team-help">Glisser un joueur sur un autre pour échanger • Glisser un remplaçant sur un titulaire pour remplacer</div></div>`;
  }

  private renderMatch(){
    return `<div class="match-overlay">
      <div class="match-topbar"><button class="icon-button" data-screen="home">←</button><div class="match-badge">SLAYER / LIVE</div>
      <div class="match-score"><span>HOME</span><strong data-match-score>${this.score.home} — ${this.score.away}</strong><span>AWAY</span><em data-match-phase>${this.score.phase}</em></div><div class="match-clock" data-match-clock>${this.score.clock}</div>
      <button class="match-top-action" data-pause>Ⅱ</button><button class="match-top-action" data-camera>CAM</button></div>
      <div class="perf-overlay" data-performance>PERF MONITOR</div>
      <div class="match-controls"><div class="virtual-joystick" data-joystick><div class="joystick-knob" data-joystick-knob></div></div>
      <div class="radar" data-radar><i></i><b></b></div><div class="touch-diamond">
      <button class="act up yellow" data-action="ThroughBall">↑<small>PROFONDE</small></button><button class="act left green" data-action="Pass">PASS</button>
      <button class="act down blue" data-action="Dribble" data-sprint>DRIBBLE</button><button class="act right red" data-action="Shoot">TIR</button></div></div>
      <div class="player-indicator"><span>PLAYER 01</span><i></i><b>STAMINA 92%</b></div></div>`;
  }

  private renderPause(){
    return `<div class="modal-screen"><div class="pause-card"><div class="eyebrow">SLAYER / PAUSE</div><h2>PAUSE</h2>
      <button class="modal-primary" data-resume>REPRENDRE LE MATCH</button><button data-screen="team">GESTION D’ÉQUIPE</button><button data-screen="settings">PARAMÈTRES</button>
      <button class="danger" data-abandon>ABANDONNER / QUITTER</button>
      <div class="live-stats"><b>STATISTIQUES EN DIRECT</b><span>Possession <strong>52%</strong> — <strong>48%</strong></span><span>Tirs <strong>6</strong> — <strong>4</strong></span><span>Fautes <strong>2</strong> — <strong>3</strong></span><span>Corners <strong>3</strong> — <strong>2</strong></span></div>
      ${this.abandonConfirm?'<div class="confirm-box"><b>Quitter le match ?</b><span>La progression de cette rencontre sera perdue.</span><button data-confirm-abandon>CONFIRMER</button><button data-cancel-abandon>ANNULER</button></div>':""}</div></div>`;
  }

  private renderResult(){
    const playerRows=this.team.filter(p=>p.starter).map(p=>`<div class="rating-row"><span>${p.pos}</span><b>${p.name}</b><strong>${(7.2+(p.rating%10)/10).toFixed(1)}</strong></div>`).join("");
    return `<div class="result-screen"><div class="result-card"><div class="result-hero"><div class="celebration-art">SLAYER</div></div><div class="eyebrow">SLAYER / FINAL</div><h2>${this.score.home>this.score.away?"VICTOIRE":this.score.home===this.score.away?"MATCH NUL":"DÉFAITE"}</h2>
      <div class="final-score">HOME <strong>${this.score.home} — ${this.score.away}</strong> AWAY</div><div class="result-tabs"><button class="${this.resultTab==="stats"?"active":""}" data-result-tab="stats">STATISTIQUES DU MATCH</button><button class="${this.resultTab==="players"?"active":""}" data-result-tab="players">NOTES DES JOUEURS</button></div>
      <div class="result-body">${this.resultTab==="stats"?'<div class="result-stats"><span>Possession</span><b>52% — 48%</b><span>Tirs cadrés</span><b>5 — 3</b><span>Passes réussies</span><b>87% — 82%</b><span>Arrêts</span><b>3 — 4</b></div>':`<div class="player-ratings">${playerRows}</div>`}<aside><b>RÉCOMPENSES</b><strong>+ 1 250 XP</strong><span>+ 320 pièces</span><span>Pass de Saison +12</span></aside></div>
      <button class="modal-primary" data-screen="home">CONTINUER »</button></div></div>`;
  }

  private renderSetPiece(){
    return `<div class="setpiece-screen"><button class="icon-button" data-screen="match">←</button><div class="setpiece-head"><span>COUP DE PIED ARRÊTÉ</span><b>JOUEUR 10 · 84 FK</b></div><button class="setpiece-tool left-tool" data-camera-rotate="-1">⟲</button><button class="setpiece-tool right-tool" data-camera-rotate="1">⟳</button>
      <canvas class="swipe-canvas" data-swipe-canvas></canvas><div class="swipe-zone">TRACE LA TRAJECTOIRE</div><div class="setpiece-actions"><button data-taker>CHANGER DE TIREUR</button><button data-combo>COMBINAISON</button></div></div>`;
  }

  private render(){
    this.root.className=`slayer-ui ${this.screen==="home"?"home-screen":this.screen==="match"?"match-screen":""}`;
    this.matchScoreEl=this.matchPhaseEl=this.matchClockEl=this.perfEl=this.joystickEl=this.joystickKnobEl=this.radarEl=null;
    if(this.screen==="match"){this.root.innerHTML=this.renderMatch();this.matchScoreEl=this.root.querySelector("[data-match-score]");this.matchPhaseEl=this.root.querySelector("[data-match-phase]");this.matchClockEl=this.root.querySelector("[data-match-clock]");this.perfEl=this.root.querySelector("[data-performance]");this.joystickEl=this.root.querySelector("[data-joystick]");this.joystickKnobEl=this.root.querySelector("[data-joystick-knob]");this.radarEl=this.root.querySelector("[data-radar]");this.bind();return;}
    if(this.screen==="pause"){this.root.innerHTML=this.renderPause();this.bind();return;}
    if(this.screen==="result"){this.root.innerHTML=this.renderResult();this.bind();return;}
    if(this.screen==="setpiece"){this.root.innerHTML=this.renderSetPiece();this.bind();this.bindSetPiece();return;}
    if(this.screen==="team"){this.root.innerHTML=this.renderTeam();this.bind();this.bindTeam();return;}
    const home=this.screen==="home";
    this.root.innerHTML='<div class="ui-backdrop"><div class="ui-grid"></div><div class="ui-noise"></div></div><header class="topbar"><div class="profile-card"><span class="profile-avatar">P1</span><div><b>PLAYER 01</b><small>LV 12 · 4 820 XP</small></div></div><div class="global-energy">ENDURANCE <span></span></div><div class="economy"><b>◈ 12 450</b><strong>✦ 860</strong><button data-screen="settings">⚙</button></div></header>'+ (home?this.renderHome():this.screen==="modes"?this.renderModes():this.screen==="career"?this.renderCareer():this.screen==="settings"?this.renderSettings():`<section class="subscreen"><div class="eyebrow">SLAYER / ${this.screen.toUpperCase()}</div><h2>${this.title()}</h2><p>Choisis et personnalise ton expérience SLAYER.</p><div class="feature-grid"><article class="feature-card"><b>MATCH</b><span>Simulation football temps réel.</span></article><article class="feature-card"><b>ÉQUIPE</b><span>Formation et composition.</span></article><article class="feature-card"><b>PROGRESSION</b><span>Objectifs, récompenses et carrière.</span></article></div></section>`)+ '<nav class="main-nav">'+this.nav("Accueil","home")+this.nav("Mon Équipe","team")+this.nav("Modes","modes")+this.nav("Carrière","career")+this.nav("Paramètres","settings")+'</nav><div class="news-tile">SLAYER / LIVE <b>Match · Équipe · Modes · Carrière · Paramètres</b></div>';
    this.bind();
  }

  private bind(){
    this.root.querySelectorAll<HTMLElement>("[data-menu-section]").forEach(el=>el.addEventListener("click",()=>{this.menuSection=el.dataset.menuSection as typeof this.menuSection;this.render();}));
    this.root.querySelectorAll<HTMLElement>("[data-option-key]").forEach(el=>el.addEventListener("click",()=>{const k=el.dataset.optionKey as keyof typeof this.matchSettings;const raw=el.dataset.optionValue??"";const current=this.matchSettings[k];let value:unknown=raw;if(typeof current==="number")value=Number(raw);else if(typeof current==="boolean")value=raw==="on";this.setOption(k,value as never);}));
    this.root.querySelectorAll<HTMLInputElement>("[data-range]").forEach(el=>el.addEventListener("input",()=>{const k=el.dataset.range as keyof typeof this.matchSettings;this.setOption(k,Number(el.value) as never);}));
    this.root.querySelectorAll<HTMLElement>("[data-screen]").forEach(el=>el.addEventListener("click",()=>this.setScreen(el.dataset.screen as SlayerScreen)));
    this.root.querySelector("[data-pause]")?.addEventListener("click",()=>this.openPause());
    this.root.querySelector("[data-result]")?.addEventListener("click",()=>this.showResult());
    this.root.querySelector("[data-resume]")?.addEventListener("click",()=>this.setScreen("match"));
    this.root.querySelector("[data-start]")?.addEventListener("click",()=>{this.onStartMatch();this.setScreen("match");});
    this.root.querySelectorAll<HTMLButtonElement>("[data-action]").forEach(b=>b.addEventListener("pointerdown",e=>{e.preventDefault();const a=b.dataset.action as SlayerMatchAction;this.onMatchAction?.(a);if(a==="Dribble")this.onSprint?.(true);}));
    this.root.querySelector("[data-camera]")?.addEventListener("click",()=>this.onCameraMode?.("match"));
    const sprint=this.root.querySelector("[data-sprint]") as HTMLButtonElement|null;
    sprint?.addEventListener("pointerup",()=>this.onSprint?.(false));
    sprint?.addEventListener("pointercancel",()=>this.onSprint?.(false));
    sprint?.addEventListener("pointerleave",()=>this.onSprint?.(false));
    const joystick=this.joystickEl,knob=this.joystickKnobEl;
    if(joystick&&knob){
      const move=(e:PointerEvent)=>{const r=joystick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,rad=r.width*.36;let x=e.clientX-cx,z=e.clientY-cy;const len=Math.hypot(x,z);if(len>rad){x*=rad/len;z*=rad/len;}knob.style.transform=`translate(${x}px,${z}px)`;this.onMove?.({x:x/rad,z:z/rad});};
      const reset=()=>{this.joystickPointerId=null;knob.style.transform="translate(0,0)";this.onMove?.({x:0,z:0});};
      joystick.addEventListener("pointerdown",e=>{e.preventDefault();this.joystickPointerId=e.pointerId;joystick.setPointerCapture(e.pointerId);move(e);});
      joystick.addEventListener("pointermove",e=>{if(e.pointerId===this.joystickPointerId)move(e);});joystick.addEventListener("pointerup",e=>{if(e.pointerId===this.joystickPointerId)reset();});joystick.addEventListener("pointercancel",reset);
    }
    this.root.querySelector("[data-abandon]")?.addEventListener("click",()=>{this.abandonConfirm=true;this.render();});
    this.root.querySelector("[data-cancel-abandon]")?.addEventListener("click",()=>{this.abandonConfirm=false;this.render();});
    this.root.querySelector("[data-confirm-abandon]")?.addEventListener("click",()=>this.setScreen("result"));
    this.root.querySelectorAll<HTMLElement>("[data-result-tab]").forEach(b=>b.addEventListener("click",()=>{this.resultTab=(b.dataset.resultTab as "stats"|"players");this.render();}));
  }

  private bindTeam(){
    this.root.querySelectorAll<HTMLElement>("[data-formation]").forEach(b=>b.addEventListener("click",()=>{this.formationIndex=(this.formationIndex+(Number(b.dataset.formation)||0)+4)%4;this.render();}));
    this.root.querySelectorAll<HTMLElement>("[data-player]").forEach(el=>{
      el.addEventListener("dragstart",()=>{this.draggingId=el.dataset.player??null;});
      el.addEventListener("dragover",e=>e.preventDefault());
      el.addEventListener("drop",e=>{e.preventDefault();const target=el.dataset.player;if(!this.draggingId||!target||target===this.draggingId)return;const a=this.team.find(p=>p.id===this.draggingId),b=this.team.find(p=>p.id===target);if(!a||!b)return;const starter=a.starter;a.starter=b.starter;b.starter=starter;this.draggingId=null;this.render();});
    });
    this.root.querySelector("[data-filter]")?.addEventListener("click",()=>{this.team.sort((a,b)=>b.rating-a.rating);this.render();});
  }

  private bindSetPiece(){
    const canvas=this.root.querySelector<HTMLCanvasElement>("[data-swipe-canvas]");if(!canvas)return;
    const resize=()=>{canvas.width=canvas.clientWidth*devicePixelRatio;canvas.height=canvas.clientHeight*devicePixelRatio;};resize();window.addEventListener("resize",resize,{once:true});
    const draw=()=>{const c=canvas.getContext("2d");if(!c)return;c.clearRect(0,0,canvas.width,canvas.height);c.lineWidth=5*devicePixelRatio;c.lineCap="round";c.strokeStyle="#00F0FF";if(this.setPiecePath.length<2)return;c.beginPath();this.setPiecePath.forEach((p,i)=>i?c.lineTo(p.x*devicePixelRatio,p.y*devicePixelRatio):c.moveTo(p.x*devicePixelRatio,p.y*devicePixelRatio));c.stroke();};
    canvas.addEventListener("pointerdown",e=>{this.setPieceDrawing=true;this.setPiecePath=[{x:e.offsetX,y:e.offsetY}];canvas.setPointerCapture(e.pointerId);draw();});
    canvas.addEventListener("pointermove",e=>{if(this.setPieceDrawing){this.setPiecePath.push({x:e.offsetX,y:e.offsetY});draw();}});
    canvas.addEventListener("pointerup",()=>{this.setPieceDrawing=false;});
    canvas.addEventListener("pointercancel",()=>{this.setPieceDrawing=false;});
    this.root.querySelector("[data-taker]")?.addEventListener("click",()=>this.root.querySelector(".setpiece-head b")!.textContent="JOUEUR 11 · 88 FK");
    this.root.querySelector("[data-combo]")?.addEventListener("click",e=>(e.currentTarget as HTMLElement).classList.toggle("active"));
    this.root.querySelectorAll("[data-camera-rotate]").forEach(b=>b.addEventListener("click",()=>this.root.querySelector(".setpiece-head")?.classList.toggle("rotated")));
  }
}
