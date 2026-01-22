import * as fs from 'fs';
import * as path from 'path';
import { 
  GameConfig, 
  CampaignCard, 
  PolicyCard, 
  WildcardCard,
  Issue
} from '../types';

// Default game configuration
export const DEFAULT_CONFIG: GameConfig = {
  totalSeats: 50,
  handLimit: 5,
  maxRounds: null,
  
  ideologyMode: 'random',
  
  agendaBonus: 1,
  
  campaignCardsPerTurn: 1,
  seatTransferRule: 'from_leader',
  
  proposalsPerRound: 1,
  policyProposalRule: 'speaker_only',
  
  voteTieBreaker: 'fails',
  
  ideologyRewards: {
    singleFavoured: 1,
    doubleFavoured: 2,
    neutral: 0,
    opposed: 0,
  },
  
  contraryBacklashSeats: 1,
  
  issueAdjustmentRule: 'most_seats_gained',
  
  mandateValue: 5,
  pmValue: 4,
  
  wildcardOnPolicyPass: true,
};

// Card data storage
let campaignCards: CampaignCard[] = [];
let policyCards: PolicyCard[] = [];
let wildcardCards: WildcardCard[] = [];

export function loadCardData(configDir: string): void {
  const campaignPath = path.join(configDir, 'cards', 'campaign.json');
  const policyPath = path.join(configDir, 'cards', 'policy.json');
  const wildcardPath = path.join(configDir, 'cards', 'wildcard.json');

  try {
    if (fs.existsSync(campaignPath)) {
      campaignCards = JSON.parse(fs.readFileSync(campaignPath, 'utf-8'));
      console.log(`Loaded ${campaignCards.length} campaign cards`);
    }
    if (fs.existsSync(policyPath)) {
      policyCards = JSON.parse(fs.readFileSync(policyPath, 'utf-8'));
      console.log(`Loaded ${policyCards.length} policy cards`);
    }
    if (fs.existsSync(wildcardPath)) {
      wildcardCards = JSON.parse(fs.readFileSync(wildcardPath, 'utf-8'));
      console.log(`Loaded ${wildcardCards.length} wildcard cards`);
    }
  } catch (error) {
    console.error('Error loading card data:', error);
  }
  
  if (campaignCards.length === 0 || policyCards.length === 0 || wildcardCards.length === 0) {
    loadDefaultCards();
  }
}

function loadDefaultCards(): void {
  if (campaignCards.length === 0) {
    campaignCards = generateDefaultCampaignCards();
  }
  if (policyCards.length === 0) {
    policyCards = generateDefaultPolicyCards();
  }
  if (wildcardCards.length === 0) {
    wildcardCards = generateDefaultWildcardCards();
  }
  console.log('Loaded default card sets');
}

function generateDefaultCampaignCards(): CampaignCard[] {
  const cards: CampaignCard[] = [];
  const issues: Issue[] = ['economy', 'cost_of_living', 'housing', 'climate', 'security'];
  
  let id = 1;
  
  // Basic cards with issue bonuses
  issues.forEach(issue => {
    cards.push({
      id: `campaign_${id++}`,
      name: `${capitalizeIssue(issue)} Focus`,
      description: `Campaign on ${issue}. +1 seat, +1 if agenda matches.`,
      seatDelta: 1,
      issue: issue,
    });
    cards.push({
      id: `campaign_${id++}`,
      name: `${capitalizeIssue(issue)} Push`,
      description: `Strong ${issue} message. +2 seats, +1 if agenda matches.`,
      seatDelta: 2,
      issue: issue,
    });
  });
  
  // Generic strong cards
  for (let i = 0; i < 5; i++) {
    cards.push({
      id: `campaign_${id++}`,
      name: 'Media Blitz',
      description: 'Broad media campaign. +2 seats.',
      seatDelta: 2,
    });
  }
  
  // Conditional cards
  cards.push({
    id: `campaign_${id++}`,
    name: 'Underdog Rally',
    description: '+1 seat, +2 if not leading.',
    seatDelta: 1,
    conditional: { type: 'underdog_bonus', modifier: 2 },
  });
  cards.push({
    id: `campaign_${id++}`,
    name: 'Front-Runner Defense',
    description: '+2 seats, -1 if you are leading.',
    seatDelta: 2,
    conditional: { type: 'leader_penalty', modifier: -1 },
  });
  
  // Weaker filler cards
  for (let i = 0; i < 8; i++) {
    cards.push({
      id: `campaign_${id++}`,
      name: 'Local Outreach',
      description: 'Grassroots organizing. +1 seat.',
      seatDelta: 1,
    });
  }
  
  return cards;
}

function generateDefaultPolicyCards(): PolicyCard[] {
  const cards: PolicyCard[] = [];
  let id = 1;
  
  // Economy policies
  cards.push({
    id: `policy_${id++}`,
    name: 'Corporate Tax Cut',
    description: 'Reduce corporate taxes to spur investment.',
    issue: 'economy',
    proposerReward: 'policy_win',
    proposerRewardValue: 2,
    stanceTable: {
      progressive: 'opposed',
      conservative: 'favoured',
      market: 'favoured',
      interventionist: 'opposed',
    },
  });
  
  cards.push({
    id: `policy_${id++}`,
    name: 'Workers Rights Act',
    description: 'Strengthen union protections and minimum wage.',
    issue: 'economy',
    proposerReward: 'policy_win',
    proposerRewardValue: 2,
    stanceTable: {
      progressive: 'favoured',
      conservative: 'opposed',
      market: 'opposed',
      interventionist: 'favoured',
    },
  });
  
  // Cost of living policies
  cards.push({
    id: `policy_${id++}`,
    name: 'Grocery Price Caps',
    description: 'Regulate essential food prices.',
    issue: 'cost_of_living',
    proposerReward: 'policy_win',
    proposerRewardValue: 2,
    stanceTable: {
      progressive: 'favoured',
      conservative: 'opposed',
      market: 'opposed',
      interventionist: 'favoured',
    },
  });
  
  cards.push({
    id: `policy_${id++}`,
    name: 'Tax Relief Package',
    description: 'Broad tax cuts for middle income earners.',
    issue: 'cost_of_living',
    proposerReward: 'policy_win',
    proposerRewardValue: 2,
    stanceTable: {
      progressive: 'neutral',
      conservative: 'favoured',
      market: 'favoured',
      interventionist: 'neutral',
    },
  });
  
  // Housing policies
  cards.push({
    id: `policy_${id++}`,
    name: 'Public Housing Investment',
    description: 'Build new public housing stock.',
    issue: 'housing',
    proposerReward: 'policy_win',
    proposerRewardValue: 2,
    stanceTable: {
      progressive: 'favoured',
      conservative: 'neutral',
      market: 'opposed',
      interventionist: 'favoured',
    },
  });
  
  cards.push({
    id: `policy_${id++}`,
    name: 'Zoning Deregulation',
    description: 'Remove barriers to new development.',
    issue: 'housing',
    proposerReward: 'policy_win',
    proposerRewardValue: 2,
    stanceTable: {
      progressive: 'neutral',
      conservative: 'favoured',
      market: 'favoured',
      interventionist: 'opposed',
    },
  });
  
  // Climate policies
  cards.push({
    id: `policy_${id++}`,
    name: 'Carbon Tax',
    description: 'Price carbon emissions to reduce pollution.',
    issue: 'climate',
    proposerReward: 'landmark_reform',
    proposerRewardValue: 3,
    stanceTable: {
      progressive: 'favoured',
      conservative: 'opposed',
      market: 'neutral',
      interventionist: 'favoured',
    },
  });
  
  cards.push({
    id: `policy_${id++}`,
    name: 'Nuclear Energy Investment',
    description: 'Invest in nuclear power plants.',
    issue: 'climate',
    proposerReward: 'policy_win',
    proposerRewardValue: 2,
    stanceTable: {
      progressive: 'opposed',
      conservative: 'favoured',
      market: 'favoured',
      interventionist: 'neutral',
    },
  });
  
  // Security policies
  cards.push({
    id: `policy_${id++}`,
    name: 'Defense Spending Boost',
    description: 'Increase military budget.',
    issue: 'security',
    proposerReward: 'policy_win',
    proposerRewardValue: 2,
    stanceTable: {
      progressive: 'opposed',
      conservative: 'favoured',
      market: 'neutral',
      interventionist: 'neutral',
    },
  });
  
  cards.push({
    id: `policy_${id++}`,
    name: 'Cybersecurity Act',
    description: 'Strengthen digital infrastructure protection.',
    issue: 'security',
    proposerReward: 'policy_win',
    proposerRewardValue: 2,
    stanceTable: {
      progressive: 'neutral',
      conservative: 'neutral',
      market: 'neutral',
      interventionist: 'favoured',
    },
  });
  
  // Add duplicates for variety
  const basePolicies = [...cards];
  basePolicies.forEach(policy => {
    cards.push({
      ...policy,
      id: `policy_${id++}`,
    });
  });
  
  return cards;
}

function generateDefaultWildcardCards(): WildcardCard[] {
  const cards: WildcardCard[] = [];
  let id = 1;
  
  cards.push({
    id: `wildcard_${id++}`,
    name: 'Media Scandal',
    description: 'The leader faces damaging coverage. Leader loses 2 seats.',
    effect: { type: 'leader_erosion', seatDelta: -2 },
  });
  
  cards.push({
    id: `wildcard_${id++}`,
    name: 'Economic Downturn',
    description: 'Recession fears hit all parties. Everyone loses 1 seat.',
    effect: { type: 'all_players', seatDelta: -1 },
  });
  
  cards.push({
    id: `wildcard_${id++}`,
    name: 'Popular Support',
    description: 'Your policy resonates widely. Proposer gains 1 seat.',
    effect: { type: 'proposer', seatDelta: 1 },
  });
  
  cards.push({
    id: `wildcard_${id++}`,
    name: 'Agenda Alignment',
    description: 'If policy matches agenda, proposer gains 2 seats. Otherwise, leader loses 1.',
    effect: { type: 'issue_conditional', seatDelta: -1, issueBonus: 2 },
  });
  
  cards.push({
    id: `wildcard_${id++}`,
    name: 'Voter Apathy',
    description: 'Disengagement affects the front-runner. Leader loses 1 seat.',
    effect: { type: 'leader_erosion', seatDelta: -1 },
  });
  
  // Duplicate some for deck size
  const baseCards = [...cards];
  baseCards.forEach(card => {
    cards.push({
      ...card,
      id: `wildcard_${id++}`,
    });
  });
  
  return cards;
}

function capitalizeIssue(issue: Issue): string {
  return issue.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

// Getters
export function getCampaignCards(): CampaignCard[] {
  return [...campaignCards];
}

export function getPolicyCards(): PolicyCard[] {
  return [...policyCards];
}

export function getWildcardCards(): WildcardCard[] {
  return [...wildcardCards];
}

export function getCampaignCard(id: string): CampaignCard | undefined {
  return campaignCards.find(c => c.id === id);
}

export function getPolicyCard(id: string): PolicyCard | undefined {
  return policyCards.find(c => c.id === id);
}

export function getWildcardCard(id: string): WildcardCard | undefined {
  return wildcardCards.find(c => c.id === id);
}

export function mergeConfig(overrides: Partial<GameConfig>): GameConfig {
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
    ideologyRewards: {
      ...DEFAULT_CONFIG.ideologyRewards,
      ...(overrides.ideologyRewards || {}),
    },
  };
}
