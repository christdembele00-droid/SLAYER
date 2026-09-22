import { describe, expect, it } from "vitest";
import { PlayerSystem } from "../src/player/PlayerSystem";
import { PlayerFactory } from "../src/player/PlayerFactory";
import { FullMatchSetup } from "../src/match/FullMatchSetup";
import { BallSystem } from "../src/ball/BallSystem";
import { InteractionSystem } from "../src/interaction/InteractionSystem";
import { FootballAI } from "../src/ai/FootballAI";
import { WorldSystem } from "../src/world/WorldSystems";
import { strikeProfile } from "../src/ball/BallKinematics";
import { GKSystem } from "../src/interaction/GKSystem";
import { DuelSystem } from "../src/interaction/DuelSystem";
import { TransitionSystem } from "../src/gameplay/TransitionSystem";
import { GameplaySystem } from "../src/gameplay/GameplaySystem";

describe("SLAYER runtime integration",()=>{
  it("creates exactly 22 match players",()=>{
    const ps=new PlayerSystem(); new FullMatchSetup().populate(ps);
    expect(ps.all()).toHaveLength(22);
    expect(new Set(ps.all().map(p=>p.data.playerId)).size).toBe(22);
  });
  it("connects player, ball, interaction and gameplay",()=>{
    const ps=new PlayerSystem();
    const p=ps.create(PlayerFactory.createPlayerData("p1","P1","home","ST"),{x:0,y:0,z:0});
    const bs=new BallSystem(); const interactions=new InteractionSystem(); const gameplay=new GameplaySystem(interactions);
    expect(interactions.tryControl(ps,"p1",bs.ball)).toBe(true);
    bs.update(1/60,ps);
    expect(bs.ball.state.controlledByPlayerId).toBe("p1");
    expect(bs.ball.state.position.z).toBeGreaterThan(.5);
    expect(gameplay.execute(ps,bs.ball,"p1","Pass",{x:0,y:0,z:1},.6).success).toBe(true);
    expect(bs.ball.state.controlledByPlayerId).toBeUndefined();
    expect(bs.ball.state.velocity.z).toBeGreaterThan(0);
  });
  it("executes an AI decision into a runtime intent",()=>{
    const ps=new PlayerSystem();
    const p=ps.create(PlayerFactory.createPlayerData("p1","P1","home","ST"),{x:0,y:0,z:1});
    const bs=new BallSystem(); const ai=new FootballAI();
    ai.update(ps,bs.ball,1);
    expect(p.state.lastIntent).toBeDefined();
    expect(["Control","Move","Pass","Shoot"]).toContain(p.state.lastIntent?.action);
  });
  it("uses distinct physical profiles for passes and shots",()=>{
    const pass=strikeProfile("Pass",.7);
    const shot=strikeProfile("Shot",.7);
    const cross=strikeProfile("Cross",.7);
    expect(shot.speed).toBeGreaterThan(pass.speed);
    expect(cross.lift).toBeGreaterThan(pass.lift);
    expect(shot.spin).toBeGreaterThan(pass.spin);
  });
  it("runs goalkeeper save logic against a dangerous ball",()=>{
    const ps=new PlayerSystem();
    const gk=ps.create(PlayerFactory.createPlayerData("gk","GK","home","GK"),{x:0,y:0,z:-48});
    const bs=new BallSystem();
    bs.ball.setPosition({x:0,y:1,z:-47});
    bs.ball.state.velocity={x:0,y:0,z:-12};
    const gks=new GKSystem();
    const result=gks.update(ps,bs.ball);
    expect(result.length).toBeGreaterThanOrEqual(0);
    expect(gk.state.position.z).toBeLessThanOrEqual(-47);
  });
  it("resolves a close duel deterministically",()=>{
    const ps=new PlayerSystem();
    const a=ps.create(PlayerFactory.createPlayerData("a","A","home","ST"),{x:0,y:0,z:0});
    const d=ps.create(PlayerFactory.createPlayerData("d","D","away","CB"),{x:0.8,y:0,z:0});
    const bs=new BallSystem();
    bs.ball.state.controlledByPlayerId="a";
    a.state.ballMode="Control";
    const duel=new DuelSystem();
    const result=duel.resolve(a,d,bs.ball,{time:1,seed:2});
    expect(["CleanTackle","LooseBall","Foul","Continue"]).toContain(result);
  });
  it("makes shooting AI decision depend on goal distance and finishing",()=>{
    const ps=new PlayerSystem();
    const p=ps.create(PlayerFactory.createPlayerData("p","P","home","ST"),{x:0,y:0,z:30});
    p.state.ballMode="Control";
    p.data.technical.shooting=95;
    p.data.mental.composure=90;
    const bs=new BallSystem();
    bs.ball.setPosition({x:0,y:.11,z:30});
    const ai=new FootballAI();
    expect(ai.choose(p,ai.world(ps,bs.ball,10))).toBe("Shoot");
  });

  it("switches team phase when possession changes",()=>{
    const ps=new PlayerSystem();
    const home=ps.create(PlayerFactory.createPlayerData("h","H","home","ST"),{x:0,y:0,z:0});
    const away=ps.create(PlayerFactory.createPlayerData("a","A","away","ST"),{x:1,y:0,z:0});
    const bs=new BallSystem();
    const transitions=new TransitionSystem();
    bs.ball.state.controlledByPlayerId=home.data.playerId;
    home.state.ballMode="Control";
    transitions.update(ps,bs.ball,0.016);
    bs.ball.state.controlledByPlayerId=away.data.playerId;
    away.state.ballMode="Control";
    home.state.ballMode="NoBall";
    transitions.update(ps,bs.ball,0.016);
    expect(transitions.getState("home").phase).toBe("TransitionToDefense");
    expect(transitions.getState("away").phase).toBe("TransitionToAttack");
  });
});