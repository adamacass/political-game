// Config loader - simplified for The House (no more card loading)
import { GameConfig } from '../types';

export const DEFAULT_CONFIG: GameConfig = {
  totalSeats: 151,
  maxRounds: 12,
  actionPointsPerRound: 3,
  startingFunds: 30,
  startingApproval: 50,
  incomePerSeat: 2,
  campaignBaseCost: 8,
  campaignBaseChance: 35,
  attackAdCost: 10,
  mediaBlitzCost: 12,
  porkBarrelCost: 15,
  fundraiseAmount: 12,
  mandateValue: 5,
  pmValue: 4,
  billPoolSize: 3,
  majorityThreshold: 76,
  enableEvents: true,
  enableChat: true,
  enableEconomy: true,
  enableVoterGroups: true,
  seatIdeologyMode: 'realistic',
  stateControlValue: 2,
  economicVolatility: 1.0,
};

export function mergeConfig(overrides: Partial<GameConfig>): GameConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}
