// ============================================================
// THE HOUSE - Client-side types (mirror of server types)
// ============================================================

export type Issue = 'economy' | 'health' | 'housing' | 'climate' | 'security' | 'education';
export type SocialIdeology = 'progressive' | 'conservative';
export type EconomicIdeology = 'market' | 'interventionist';
export type IdeologyStance = 'favoured' | 'neutral' | 'opposed';

export type Phase =
  | 'waiting'
  | 'budget'
  | 'action'
  | 'legislation_propose'
  | 'legislation_vote'
  | 'legislation_result'
  | 'event'
  | 'game_over';

export type ActionType =
  | 'campaign'
  | 'policy_speech'
  | 'attack_ad'
  | 'fundraise'
  | 'media_blitz'
  | 'pork_barrel';

export type PCapType = 'mandate' | 'prime_ministership' | 'legislation' | 'state_control' | 'approval_bonus';

export type SeatId = string;
export type StateCode = 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT';
export type EconBucket = 'LEFT' | 'CENTER' | 'RIGHT';
export type SocialBucket = 'PROG' | 'CENTER' | 'CONS';

export interface SeatIdeology {
  econ: EconBucket;
  social: SocialBucket;
}

export interface Seat {
  id: SeatId;
  name: string;
  state: StateCode;
  x: number;
  y: number;
  chamberRow: number;
  chamberCol: number;
  chamberSide: 'left' | 'right' | 'crossbench';
  ideology: SeatIdeology;
  ownerPlayerId: string | null;
  margin: number;
  lastCampaignedBy: string | null;
  contested: boolean;
  mapX: number;
  mapY: number;
}

export interface StateControl {
  state: StateCode;
  controllerId: string | null;
  seatCount: number;
  totalSeats: number;
}

export const PARTY_COLORS = [
  { id: 'labor', hex: '#CC2936', name: 'Labor Red' },
  { id: 'liberal', hex: '#1B3A8C', name: 'Liberal Blue' },
  { id: 'greens', hex: '#10A651', name: 'Greens' },
  { id: 'national', hex: '#0D5E3B', name: 'National Green' },
  { id: 'teal', hex: '#008B8B', name: 'Teal Independent' },
  { id: 'orange', hex: '#D4710E', name: 'Centre Alliance' },
  { id: 'purple', hex: '#6A1B78', name: 'Purple' },
  { id: 'gold', hex: '#B8860B', name: 'Gold' },
] as const;

export type PartyColorId = typeof PARTY_COLORS[number]['id'];

export interface Bill {
  id: string;
  name: string;
  shortName: string;
  description: string;
  issue: Issue;
  stanceTable: {
    progressive: IdeologyStance;
    conservative: IdeologyStance;
    market: IdeologyStance;
    interventionist: IdeologyStance;
  };
  budgetImpact: number;
  approvalImpact: number;
  pCapReward: number;
  isLandmark: boolean;
}

export interface PoliticalEvent {
  id: string;
  name: string;
  headline: string;
  description: string;
  category: 'scandal' | 'economic' | 'international' | 'social' | 'media' | 'disaster';
  effects: EventEffect[];
}

export interface EventEffect {
  target: 'leader' | 'trailer' | 'all' | 'random' | 'proposer';
  type: 'approval' | 'funds' | 'seats';
  amount: number;
  condition?: string;
}

export interface PlayerAction {
  type: ActionType;
  playerId: string;
  targetSeatId?: SeatId;
  targetPlayerId?: string;
  fundsSpent?: number;
  result?: ActionResult;
  timestamp: number;
}

export interface ActionResult {
  success: boolean;
  message: string;
  seatCaptured?: boolean;
  approvalChange?: number;
  fundsChange?: number;
  pCapChange?: number;
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

export interface HistorySnapshot {
  round: number;
  timestamp: number;
  activeIssue: Issue;
  seatCounts: Record<string, number>;
  approvalRatings: Record<string, number>;
  fundBalances: Record<string, number>;
  pCapTotals: Record<string, number>;
  billResult: BillResult | null;
  eventOccurred: string | null;
  actionsPerformed: PlayerAction[];
}

export interface BillResult {
  billId: string;
  billName: string;
  proposerId: string;
  passed: boolean;
  yesWeight: number;
  noWeight: number;
  voterBreakdown: { playerId: string; vote: 'aye' | 'no'; seatWeight: number }[];
}

export interface Player {
  id: string;
  name: string;
  playerName: string;
  colorId: PartyColorId;
  color: string;
  symbolId: string;
  socialIdeology: SocialIdeology;
  economicIdeology: EconomicIdeology;
  seats: number;
  funds: number;
  approval: number;
  pcap: number;
  actionPoints: number;
  maxActionPoints: number;
  connected: boolean;
  isHost: boolean;
  actionsThisRound: PlayerAction[];
  hasProposed: boolean;
  hasVoted: boolean;
  totalSeatsWon: number;
  totalSeatsLost: number;
  billsProposed: number;
  billsPassed: number;
  campaignsRun: number;
}

export interface PendingLegislation {
  bill: Bill;
  proposerId: string;
  votes: LegislationVote[];
  amendments: string[];
}

export interface LegislationVote {
  playerId: string;
  vote: 'aye' | 'no';
  seatWeight: number;
}

// ============================================================
// ECONOMIC STATE (from white paper economic domain)
// ============================================================

export interface EconomicStateData {
  gdpGrowth: number;
  unemployment: number;
  inflation: number;
  publicDebt: number;
  budgetBalance: number;
  consumerConfidence: number;
  businessConfidence: number;
  interestRate: number;
  sectors: Record<string, number>;
}

// ============================================================
// VOTER GROUPS (from white paper voter domain)
// ============================================================

export interface VoterGroupState {
  id: string;
  name: string;
  population: number;
  satisfaction: number;
  leaningPartyId: string | null;
  topConcerns: { variable: string; satisfaction: number }[];
}

// ============================================================
// GAME STATE
// ============================================================

export interface GameState {
  roomId: string;
  seed: string;
  phase: Phase;
  round: number;
  maxRounds: number;
  players: Player[];
  turnOrder: string[];
  currentPlayerIndex: number;
  speakerIndex: number;
  totalSeats: number;
  seats: Record<SeatId, Seat>;
  stateControl: Record<StateCode, StateControl>;
  activeIssue: Issue;
  nationalBudget: number;
  budgetSurplus: boolean;
  economy: EconomicStateData;
  voterGroups: VoterGroupState[];
  availableBills: Bill[];
  pendingLegislation: PendingLegislation | null;
  passedBills: Bill[];
  failedBills: Bill[];
  currentEvent: PoliticalEvent | null;
  pastEvents: PoliticalEvent[];
  playersActed: string[];
  roundActions: PlayerAction[];
  eventLog: GameEvent[];
  chatMessages: ChatMessage[];
  history: HistorySnapshot[];
  winner: string | null;
  finalScores: Record<string, number> | null;
  takenColors: PartyColorId[];
}

export type GameEvent =
  | { type: 'game_started'; timestamp: number; seed: string; config: string }
  | { type: 'player_joined'; timestamp: number; playerId: string; playerName: string; partyName: string; colorId: PartyColorId }
  | { type: 'round_started'; timestamp: number; round: number; activeIssue: Issue }
  | { type: 'budget_distributed'; timestamp: number; amounts: Record<string, number> }
  | { type: 'action_performed'; timestamp: number; action: PlayerAction }
  | { type: 'seat_captured'; timestamp: number; seatId: SeatId; seatName: string; fromPlayerId: string | null; toPlayerId: string }
  | { type: 'seat_lost'; timestamp: number; seatId: SeatId; seatName: string; fromPlayerId: string; reason: string }
  | { type: 'bill_proposed'; timestamp: number; playerId: string; billId: string }
  | { type: 'vote_cast'; timestamp: number; playerId: string; vote: 'aye' | 'no'; seatWeight: number }
  | { type: 'bill_resolved'; timestamp: number; billId: string; passed: boolean; yesWeight: number; noWeight: number }
  | { type: 'pcap_awarded'; timestamp: number; playerId: string; amount: number; reason: string }
  | { type: 'event_occurred'; timestamp: number; eventId: string; eventName: string }
  | { type: 'approval_changed'; timestamp: number; playerId: string; delta: number; newApproval: number; reason: string }
  | { type: 'funds_changed'; timestamp: number; playerId: string; delta: number; newFunds: number; reason: string }
  | { type: 'issue_changed'; timestamp: number; oldIssue: Issue; newIssue: Issue; reason: string }
  | { type: 'state_control_changed'; timestamp: number; state: StateCode; oldController: string | null; newController: string | null }
  | { type: 'chat_message'; timestamp: number; senderId: string; recipientId: string | null; content: string }
  | { type: 'game_ended'; timestamp: number; winner: string; scores: Record<string, number> }
  | { type: 'phase_changed'; timestamp: number; fromPhase: Phase; toPhase: Phase }
  | { type: 'economic_update'; timestamp: number; economy: EconomicStateData };

export interface GameConfig {
  totalSeats: number;
  maxRounds: number;
  actionPointsPerRound: number;
  startingFunds: number;
  startingApproval: number;
  incomePerSeat: number;
  campaignBaseCost: number;
  campaignBaseChance: number;
  attackAdCost: number;
  mediaBlitzCost: number;
  porkBarrelCost: number;
  fundraiseAmount: number;
  mandateValue: number;
  pmValue: number;
  billPoolSize: number;
  majorityThreshold: number;
  enableEvents: boolean;
  enableChat: boolean;
  enableEconomy: boolean;
  enableVoterGroups: boolean;
  seatIdeologyMode: 'random' | 'realistic';
  stateControlValue: number;
  economicVolatility: number;
}
