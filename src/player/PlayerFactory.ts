import { PlayerData } from "./PlayerTypes";

const physical = (overrides: Partial<PlayerData["physical"]> = {}): PlayerData["physical"] => ({
  acceleration: 8,
  maxSpeed: 8.5,
  sprintSpeed: 8.5,
  agility: 75,
  balance: 75,
  strength: 70,
  jump: 70,
  stamina: 100,
  ...overrides
});

const technical = (overrides: Partial<PlayerData["technical"]> = {}): PlayerData["technical"] => ({
  passing: 70,
  shooting: 70,
  ballControl: 70,
  dribbling: 70,
  crossing: 65,
  tackling: 65,
  heading: 65,
  ...overrides
});

const mental = (overrides: Partial<PlayerData["mental"]> = {}): PlayerData["mental"] => ({
  vision: 70,
  reactions: 70,
  positioning: 70,
  composure: 70,
  decisions: 70,
  aggression: 60,
  ...overrides
});

export function createPlayerData(
  playerId: string,
  name: string,
  teamId: string,
  position: PlayerData["position"],
  overrides: Partial<PlayerData> = {}
): PlayerData {
  return {
    playerId,
    name,
    position,
    preferredFoot: "right",
    height: 1.80,
    weight: 75,
    teamId,
    physical: { ...physical(), ...overrides.physical },
    technical: { ...technical(), ...overrides.technical },
    mental: { ...mental(), ...overrides.mental },
    goalkeeper: overrides.goalkeeper
  };
}