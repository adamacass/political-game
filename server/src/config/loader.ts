// Config loader for The House
import { GameConfig } from '../types';

export const DEFAULT_CONFIG: GameConfig = {
  totalSeats: 151,
  totalRounds: 12,
  electionCycle: 4,
  actionsPerRound: 3,

  startingFunds: 30,
  startingApproval: 50,
  incomePerSeat: 2,

  campaignCost: 8,
  attackAdCost: 10,
  mediaBlitzCost: 12,
  fundraiseAmount: 12,
  coalitionTalkCost: 5,

  aiPlayerCount: 1,
  aiDifficulty: 'normal',

  majorityThreshold: 76,

  enableEvents: true,
  enableChat: true,
  enableEconomy: true,
  enableVoterGroups: true,
  economicVolatility: 1.0,
};

export function mergeConfig(overrides: Partial<GameConfig>): GameConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}
