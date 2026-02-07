// Config loader for The House — Democracy 4-style multiplayer
import { GameConfig } from '../types';

export const DEFAULT_CONFIG: GameConfig = {
  totalSeats: 151,
  totalRounds: 16,
  electionCycle: 4,
  actionsPerRound: 3,
  policyAdjustmentsPerRound: 5,

  startingFunds: 50,
  startingPoliticalCapital: 10,
  incomePerSeat: 2,
  capitalRegenPerRound: 3,

  campaignCost: 8,
  attackCost: 6,
  mediaCampaignCost: 10,
  fundraiseAmount: 15,
  grassrootsCost: 4,
  policyResearchCost: 5,

  aiPlayerCount: 3,
  aiDifficulty: 'normal',

  majorityThreshold: 76,

  enableDilemmas: true,
  enableMediaCycle: true,
  enableSituations: true,
  enableChat: true,
  enableLeaders: true,
  simulationSpeed: 1.0,

  isSinglePlayer: false,
};

export function mergeConfig(overrides: Partial<GameConfig>): GameConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}
