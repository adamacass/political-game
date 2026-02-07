// ============================================================
// THE HOUSE - Australian Political Strategy Game
// Complete type system for simultaneous-play strategy game
// ============================================================

// ============================================================
// IDEOLOGY
// ============================================================

export type SocialIdeology = 'progressive' | 'conservative';
export type EconomicIdeology = 'market' | 'interventionist';
export type IdeologyStance = 'favoured' | 'neutral' | 'opposed';

// ============================================================
// PHASES (simultaneous play model)
// ============================================================

export type Phase =
  | 'waiting'      // lobby, pre-game
  | 'planning'     // all players choose actions simultaneously
  | 'resolution'   // actions resolve, economy ticks
  | 'election'     // seats contested based on accumulated campaign + satisfaction
  | 'game_over';

// ============================================================
// ACTIONS
// ============================================================

export type ActionType =
  | 'campaign'         // target a state to build campaign influence
  | 'propose_policy'   // propose a policy for automatic vote
  | 'attack_ad'        // hurt opponent's approval
  | 'fundraise'        // gain funds
  | 'media_blitz'      // boost own approval
  | 'coalition_talk';  // build relationships with another player

/** What a player submits each round (up to actionsPerRound). */
export interface PlayerAction {
  type: ActionType;
  targetState?: StateCode;       // for campaign
  policyId?: string;             // for propose_policy
  targetPlayerId?: string;       // for attack_ad, coalition_talk
}

/** Result of a single resolved action. */
export interface ActionResult {
  playerId: string;
  action: PlayerAction;
  success: boolean;
  description: string;
  seatsCaptured?: number;
  approvalChange?: number;
  fundsChange?: number;
  policyPassed?: boolean;
}

export interface ActionCost {
  funds: number;
  description: string;
}

// ============================================================
// POLICIES (replaces Bills)
// ============================================================

export type PolicyCategory =
  | 'taxation'
  | 'healthcare'
  | 'education'
  | 'housing'
  | 'climate'
  | 'defence'
  | 'infrastructure'
  | 'welfare'
  | 'immigration'
  | 'trade';

export interface PolicyEffect {
  target: string;     // economic variable or sector name
  immediate: number;  // one-time impact when activated
  perPeriod: number;  // ongoing impact per round
  duration: number;   // how many rounds the effect lasts
  delay: number;      // rounds before activation
  uncertainty: number; // 0-1: random variance factor
}

export interface Policy {
  id: string;
  name: string;
  shortName: string;
  description: string;
  category: PolicyCategory;
  stanceTable: {
    progressive: IdeologyStance;
    conservative: IdeologyStance;
    market: IdeologyStance;
    interventionist: IdeologyStance;
  };
  budgetCost: number;             // annual budget impact (negative = spending, positive = revenue)
  economicEffects: PolicyEffect[];
  voterImpacts: { groupId: string; impact: number }[];
  implementationRounds: number;   // rounds before effects begin
  isLandmark: boolean;
}

/** A policy currently in effect. */
export interface ActivePolicy {
  policy: Policy;
  proposerId: string;
  roundPassed: number;
  roundsRemaining: number;
}

/** Result of an automatic policy vote. */
export interface PolicyVoteResult {
  policyId: string;
  policyName: string;
  proposerId: string;
  passed: boolean;
  supportSeats: number;
  opposeSeats: number;
  totalSeats: number;
}

// ============================================================
// SEAT MAP TYPES
// ============================================================

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
  margin: number;            // 0-100, lower = more marginal
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

// ============================================================
// PARTY COLORS
// ============================================================

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

// ============================================================
// POLITICAL EVENTS
// ============================================================

export interface PoliticalEvent {
  id: string;
  name: string;
  headline: string;
  description: string;
  category: 'scandal' | 'economic' | 'international' | 'social' | 'media' | 'disaster';
  effects: EventEffect[];
}

export interface EventEffect {
  target: 'leader' | 'trailer' | 'all' | 'random' | 'government';
  type: 'approval' | 'funds' | 'seats';
  amount: number;
  condition?: string;
}

// ============================================================
// AI
// ============================================================

export type AIStrategy = 'campaigner' | 'policy_wonk' | 'populist' | 'pragmatist';
export type AIDifficulty = 'easy' | 'normal' | 'hard';

// ============================================================
// PLAYER STATE
// ============================================================

export interface Player {
  id: string;
  name: string;
  playerName: string;
  colorId: PartyColorId;
  color: string;

  socialIdeology: SocialIdeology;
  economicIdeology: EconomicIdeology;

  seats: number;
  funds: number;
  approval: number;       // -100 to 100

  isAI: boolean;
  aiStrategy?: AIStrategy;

  connected: boolean;
  isHost: boolean;

  // Simultaneous play
  submittedActions: boolean;

  // Scoring
  policyScore: number;       // accumulated ideology alignment from passed policies
  governmentRounds: number;  // rounds spent as government leader

  // Campaign tracking: accumulated campaign effort per state
  campaignInfluence: Record<StateCode, number>;

  // Stats
  totalSeatsWon: number;
  totalSeatsLost: number;
  policiesProposed: number;
  policiesPassed: number;
}

// ============================================================
// CHAT MESSAGES
// ============================================================

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string | null;
  content: string;
  timestamp: number;
  isPrivate: boolean;
}

// ============================================================
// ECONOMIC STATE
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
// VOTER GROUPS
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
// SCORES
// ============================================================

export interface PlayerScore {
  playerId: string;
  seats: number;
  policyAlignment: number;
  economicPerformance: number;
  total: number;
}

// ============================================================
// ELECTION
// ============================================================

export interface ElectionResult {
  round: number;
  seatChanges: { seatId: SeatId; oldOwner: string | null; newOwner: string | null }[];
  governmentLeaderId: string | null;
  nationalSwing: Record<string, number>;
}

// ============================================================
// GAME STATE
// ============================================================

export interface GameState {
  roomId: string;
  seed: string;
  phase: Phase;
  round: number;
  totalRounds: number;

  players: Player[];

  // Board
  totalSeats: number;
  seats: Record<SeatId, Seat>;
  stateControl: Record<StateCode, StateControl>;

  // Policy system
  policyMenu: Policy[];             // all available policies
  activePolicies: ActivePolicy[];   // currently in effect
  policyHistory: PolicyVoteResult[];

  // Simultaneous actions
  roundActions: Record<string, PlayerAction[]>;  // playerId -> submitted actions
  lastRoundResults: ActionResult[];

  // Economy
  economy: EconomicStateData;
  economyHistory: EconomicStateData[];
  voterGroups: VoterGroupState[];

  // Government
  governmentLeaderId: string | null;
  nextElectionRound: number;
  electionCycle: number;
  electionHistory: ElectionResult[];

  // Events
  currentEvent: PoliticalEvent | null;
  pastEvents: PoliticalEvent[];

  // Log
  eventLog: GameEvent[];
  chatMessages: ChatMessage[];

  // Game over
  winner: string | null;
  finalScores: PlayerScore[] | null;

  // Lobby
  takenColors: PartyColorId[];
}

// ============================================================
// EVENTS (log entries)
// ============================================================

export type GameEvent =
  | { type: 'game_started'; timestamp: number; seed: string }
  | { type: 'player_joined'; timestamp: number; playerId: string; playerName: string; colorId: PartyColorId }
  | { type: 'round_started'; timestamp: number; round: number }
  | { type: 'actions_submitted'; timestamp: number; playerId: string; actionCount: number }
  | { type: 'action_resolved'; timestamp: number; result: ActionResult }
  | { type: 'policy_voted'; timestamp: number; result: PolicyVoteResult }
  | { type: 'seat_captured'; timestamp: number; seatId: SeatId; seatName: string; fromPlayerId: string | null; toPlayerId: string }
  | { type: 'seat_lost'; timestamp: number; seatId: SeatId; seatName: string; fromPlayerId: string; reason: string }
  | { type: 'election_held'; timestamp: number; result: ElectionResult }
  | { type: 'government_formed'; timestamp: number; leaderId: string; seats: number }
  | { type: 'event_occurred'; timestamp: number; eventId: string; eventName: string }
  | { type: 'approval_changed'; timestamp: number; playerId: string; delta: number; newApproval: number; reason: string }
  | { type: 'funds_changed'; timestamp: number; playerId: string; delta: number; newFunds: number; reason: string }
  | { type: 'state_control_changed'; timestamp: number; state: StateCode; oldController: string | null; newController: string | null }
  | { type: 'economic_update'; timestamp: number; economy: EconomicStateData }
  | { type: 'chat_message'; timestamp: number; senderId: string; recipientId: string | null; content: string }
  | { type: 'game_ended'; timestamp: number; winner: string; scores: PlayerScore[] }
  | { type: 'phase_changed'; timestamp: number; fromPhase: Phase; toPhase: Phase };

// ============================================================
// GAME CONFIGURATION
// ============================================================

export interface GameConfig {
  totalSeats: number;
  totalRounds: number;          // total rounds in game
  electionCycle: number;        // rounds between elections (default 4)
  actionsPerRound: number;      // actions each player gets per round (default 3)

  startingFunds: number;
  startingApproval: number;
  incomePerSeat: number;

  campaignCost: number;
  attackAdCost: number;
  mediaBlitzCost: number;
  fundraiseAmount: number;
  coalitionTalkCost: number;

  aiPlayerCount: number;
  aiDifficulty: AIDifficulty;

  majorityThreshold: number;    // seats for government (76)

  enableEvents: boolean;
  enableChat: boolean;
  enableEconomy: boolean;
  enableVoterGroups: boolean;
  economicVolatility: number;
}

// ============================================================
// SOCKET MESSAGES
// ============================================================

export interface ClientToServerEvents {
  'create_room': (data: {
    playerName: string;
    partyName: string;
    colorId?: PartyColorId;
    socialIdeology?: SocialIdeology;
    economicIdeology?: EconomicIdeology;
    configOverrides?: Partial<GameConfig>;
  }) => void;
  'join_room': (data: {
    roomId: string;
    playerName: string;
    partyName: string;
    colorId?: PartyColorId;
    socialIdeology?: SocialIdeology;
    economicIdeology?: EconomicIdeology;
  }) => void;
  'start_game': () => void;
  'submit_actions': (data: { actions: PlayerAction[] }) => void;
  'update_config': (data: { config: Partial<GameConfig> }) => void;
  'request_state': () => void;
  'send_chat': (data: { content: string; recipientId: string | null }) => void;
  'force_advance_phase': () => void;
  'restore_session': (data: { roomId: string; playerId: string }) => void;
}

export interface ServerToClientEvents {
  'room_created': (data: { roomId: string }) => void;
  'room_joined': (data: { roomId: string; playerId: string }) => void;
  'state_update': (data: { state: GameState; config: GameConfig }) => void;
  'error': (data: { message: string }) => void;
  'player_disconnected': (data: { playerId: string }) => void;
  'player_reconnected': (data: { playerId: string }) => void;
  'chat_message': (data: { message: ChatMessage }) => void;
  'available_colors': (data: { colors: PartyColorId[] }) => void;
  'session_restored': (data: { success: boolean; roomId: string }) => void;
}
