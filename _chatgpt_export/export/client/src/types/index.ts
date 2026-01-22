// ============================================================
// CORE TYPES FOR POLITICAL BOARD GAME - CLIENT
// ============================================================

export type Issue = 'economy' | 'cost_of_living' | 'housing' | 'climate' | 'security';
export type SocialIdeology = 'progressive' | 'conservative';
export type EconomicIdeology = 'market' | 'interventionist';
export type IdeologyStance = 'favoured' | 'neutral' | 'opposed';
export type Phase = 'waiting' | 'draw' | 'campaign' | 'policy_proposal' | 'policy_vote' | 'policy_resolution' | 'wildcard_resolution' | 'issue_adjustment' | 'game_over';
export type CardType = 'campaign' | 'policy' | 'wildcard';
export type PCapType = 'mandate' | 'prime_ministership' | 'landmark_reform' | 'policy_win' | 'ideological_credibility';
export type IdeologyMode = 'random' | 'choose';

export interface CampaignCard {
  id: string;
  name: string;
  description: string;
  seatDelta: number;
  issue?: Issue;
  conditional?: {
    type: 'leader_penalty' | 'underdog_bonus' | 'issue_match';
    modifier: number;
  };
}

export interface PolicyCard {
  id: string;
  name: string;
  description: string;
  issue: Issue;
  proposerReward: PCapType;
  proposerRewardValue: number;
  stanceTable: {
    progressive: IdeologyStance;
    conservative: IdeologyStance;
    market: IdeologyStance;
    interventionist: IdeologyStance;
  };
  ongoingEffect?: {
    id: string;
    description: string;
    modifier: Record<string, number>;
  };
}

export interface WildcardCard {
  id: string;
  name: string;
  description: string;
  effect: {
    type: 'leader_erosion' | 'all_players' | 'proposer' | 'issue_conditional';
    seatDelta: number;
    issue?: Issue;
    issueBonus?: number;
  };
}

export interface PCapCard {
  type: PCapType;
  value: number;
  name: string;
  source: string;
  roundAwarded: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string | null;
  content: string;
  timestamp: number;
  isPrivate: boolean;
}

export interface Player {
  id: string;
  name: string;
  playerName: string;
  color: string;
  socialIdeology: SocialIdeology;
  economicIdeology: EconomicIdeology;
  seats: number;
  hand: (CampaignCard | PolicyCard)[];
  pCapCards: PCapCard[];
  connected: boolean;
}

export interface Vote {
  playerId: string;
  vote: 'yes' | 'no';
  seatWeight: number;
}

export interface GameState {
  roomId: string;
  seed: string;
  phase: Phase;
  round: number;
  players: Player[];
  turnOrder: string[];
  currentPlayerIndex: number;
  speakerIndex: number;
  campaignDeck: string[];
  campaignDiscard: string[];
  policyDeck: string[];
  policyDiscard: string[];
  wildcardDeck: string[];
  wildcardDiscard: string[];
  totalSeats: number;
  activeIssue: Issue;
  issueTrack: Issue[];
  playersDrawn: string[];
  playersCampaigned: string[];
  proposedPolicy: PolicyCard | null;
  proposerId: string | null;
  votes: Vote[];
  pendingWildcard: WildcardCard | null;
  roundSeatChanges: Record<string, number>;
  activeEffects: { policyId: string; effectId: string; modifier: Record<string, number> }[];
  eventLog: GameEvent[];
  chatMessages: ChatMessage[];
  winner: string | null;
  finalScores: Record<string, number> | null;
}

export type GameEvent = 
  | { type: 'game_started'; timestamp: number; seed: string; config: string }
  | { type: 'player_joined'; timestamp: number; playerId: string; playerName: string; partyName: string }
  | { type: 'round_started'; timestamp: number; round: number; activeIssue: Issue }
  | { type: 'card_drawn'; timestamp: number; playerId: string; cardType: 'campaign' | 'policy'; cardId: string }
  | { type: 'campaign_played'; timestamp: number; playerId: string; cardId: string; seatDelta: number; agendaBonus: number }
  | { type: 'policy_proposed'; timestamp: number; playerId: string; cardId: string }
  | { type: 'vote_cast'; timestamp: number; playerId: string; vote: 'yes' | 'no'; seatWeight: number }
  | { type: 'policy_resolved'; timestamp: number; passed: boolean; yesVotes: number; noVotes: number }
  | { type: 'pcap_awarded'; timestamp: number; playerId: string; type: PCapType; value: number; reason: string }
  | { type: 'wildcard_drawn'; timestamp: number; playerId: string; cardId: string }
  | { type: 'wildcard_resolved'; timestamp: number; cardId: string; effects: { playerId: string; seatDelta: number }[] }
  | { type: 'seats_changed'; timestamp: number; playerId: string; delta: number; newTotal: number; reason: string }
  | { type: 'issue_changed'; timestamp: number; oldIssue: Issue; newIssue: Issue; changedBy: string }
  | { type: 'chat_message'; timestamp: number; senderId: string; recipientId: string | null; content: string }
  | { type: 'game_ended'; timestamp: number; winner: string; scores: Record<string, number> };

export interface GameConfig {
  totalSeats: number;
  handLimit: number;
  maxRounds: number | null;
  ideologyMode: IdeologyMode;
  agendaBonus: number;
  campaignCardsPerTurn: number;
  seatTransferRule: 'from_leader' | 'proportional' | 'from_all_equal';
  proposalsPerRound: number;
  policyProposalRule: 'speaker_only' | 'any_player';
  voteTieBreaker: 'fails' | 'speaker_decides';
  ideologyRewards: {
    singleFavoured: number;
    doubleFavoured: number;
    neutral: number;
    opposed: number;
  };
  contraryBacklashSeats: number;
  issueAdjustmentRule: 'most_seats_gained' | 'speaker_choice' | 'random';
  mandateValue: number;
  pmValue: number;
  wildcardOnPolicyPass: boolean;
}
