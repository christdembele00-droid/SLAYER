import { describe, expect, it } from "vitest";
import { PlayerSystem } from "../src/player/PlayerSystem";
import { PlayerFactory } from "../src/player/PlayerFactory";
import { FullMatchSetup } from "../src/match/FullMatchSetup";
import { BallSystem } from "../src/ball/BallSystem";
import { InteractionSystem } from "../src/interaction/InteractionSystem";
import { GameplaySystem } from "../src/gameplay/GameplaySystem";
import { FootballAI } from "../src/ai/FootballAI";
import { WorldSystem } from "../src/world/WorldSystems";
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
});