// ============================================================
// CORE TYPES FOR POLITICAL BOARD GAME
// ============================================================

export type Issue = 'economy' | 'cost_of_living' | 'housing' | 'climate' | 'security';
export type SocialIdeology = 'progressive' | 'conservative';
export type EconomicIdeology = 'market' | 'interventionist';
export type IdeologyStance = 'favoured' | 'neutral' | 'opposed';
export type Phase = 'waiting' | 'draw' | 'campaign' | 'policy_proposal' | 'policy_vote' | 'policy_resolution' | 'wildcard_resolution' | 'issue_adjustment' | 'game_over';
export type CardType = 'campaign' | 'policy' | 'wildcard';
export type PCapType = 'mandate' | 'prime_ministership' | 'landmark_reform' | 'policy_win' | 'ideological_credibility';
export type IdeologyMode = 'random' | 'choose';

// ============================================================
// CARD DEFINITIONS
// ============================================================

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

// ============================================================
// CHAT MESSAGES
// ============================================================

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string | null; // null = global message
  content: string;
  timestamp: number;
  isPrivate: boolean;
}

// ============================================================
// PLAYER STATE
// ============================================================

export interface Player {
  id: string;
  name: string; // Party name (e.g., "Labor Party")
  playerName: string; // Human player name (e.g., "John")
  color: string;
  socialIdeology: SocialIdeology;
  economicIdeology: EconomicIdeology;
  seats: number;
  hand: (CampaignCard | PolicyCard)[];
  pCapCards: PCapCard[];
  connected: boolean;
}

// ============================================================
// GAME STATE
// ============================================================

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
  
  // Players
  players: Player[];
  turnOrder: string[];
  currentPlayerIndex: number;
  speakerIndex: number;
  
  // Decks
  campaignDeck: string[];
  campaignDiscard: string[];
  policyDeck: string[];
  policyDiscard: string[];
  wildcardDeck: string[];
  wildcardDiscard: string[];
  
  // Board state
  totalSeats: number;
  activeIssue: Issue;
  issueTrack: Issue[];
  
  // Current round tracking
  playersDrawn: string[];
  playersCampaigned: string[];
  proposedPolicy: PolicyCard | null;
  proposerId: string | null;
  votes: Vote[];
  pendingWildcard: WildcardCard | null;
  
  // Round metrics
  roundSeatChanges: Record<string, number>;
  
  // Ongoing effects
  activeEffects: { policyId: string; effectId: string; modifier: Record<string, number> }[];
  
  // Event log for replay
  eventLog: GameEvent[];
  
  // Chat messages
  chatMessages: ChatMessage[];
  
  // Game over data
  winner: string | null;
  finalScores: Record<string, number> | null;
}

// ============================================================
// EVENTS (for event sourcing / replay)
// ============================================================

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

// ============================================================
// GAME CONFIGURATION
// ============================================================

export interface GameConfig {
  // Core settings
  totalSeats: number;
  handLimit: number;
  maxRounds: number | null;
  
  // Ideology mode: 'random' = server assigns, 'choose' = player picks
  ideologyMode: IdeologyMode;
  
  // Agenda
  agendaBonus: number;
  
  // Campaign
  campaignCardsPerTurn: number;
  seatTransferRule: 'from_leader' | 'proportional' | 'from_all_equal';
  
  // Policy
  proposalsPerRound: number;
  policyProposalRule: 'speaker_only' | 'any_player';
  
  // Voting
  voteTieBreaker: 'fails' | 'speaker_decides';
  
  // Ideology rewards
  ideologyRewards: {
    singleFavoured: number;
    doubleFavoured: number;
    neutral: number;
    opposed: number;
  };
  
  // Contrary backlash
  contraryBacklashSeats: number;
  
  // Issue adjustment
  issueAdjustmentRule: 'most_seats_gained' | 'speaker_choice' | 'random';
  
  // Endgame
  mandateValue: number;
  pmValue: number;
  
  // Wildcard
  wildcardOnPolicyPass: boolean;
}

// ============================================================
// SOCKET MESSAGES
// ============================================================

export interface JoinRoomData {
  roomId: string;
  playerName: string;
  partyName: string;
  socialIdeology?: SocialIdeology;
  economicIdeology?: EconomicIdeology;
}

export interface CreateRoomData {
  playerName: string;
  partyName: string;
  configOverrides?: Partial<GameConfig>;
  socialIdeology?: SocialIdeology;
  economicIdeology?: EconomicIdeology;
}

export interface ClientToServerEvents {
  'join_room': (data: JoinRoomData) => void;
  'create_room': (data: CreateRoomData) => void;
  'start_game': () => void;
  'draw_card': (data: { deckType: 'campaign' | 'policy' }) => void;
  'play_campaign': (data: { cardId: string }) => void;
  'skip_campaign': () => void;
  'propose_policy': (data: { cardId: string }) => void;
  'skip_proposal': () => void;
  'cast_vote': (data: { vote: 'yes' | 'no' }) => void;
  'acknowledge_wildcard': () => void;
  'adjust_issue': (data: { direction: -1 | 0 | 1 }) => void;
  'update_config': (data: { config: Partial<GameConfig> }) => void;
  'request_state': () => void;
  'export_game': () => void;
  'send_chat': (data: { content: string; recipientId: string | null }) => void;
}

export interface ServerToClientEvents {
  'room_created': (data: { roomId: string }) => void;
  'room_joined': (data: { roomId: string; playerId: string }) => void;
  'state_update': (data: { state: GameState; config: GameConfig }) => void;
  'error': (data: { message: string }) => void;
  'game_exported': (data: { eventLog: GameEvent[]; config: GameConfig; seed: string; chatLog: ChatMessage[] }) => void;
  'player_disconnected': (data: { playerId: string }) => void;
  'player_reconnected': (data: { playerId: string }) => void;
  'chat_message': (data: { message: ChatMessage }) => void;
}

// ============================================================
// ANALYTICS
// ============================================================

export interface GameAnalytics {
  totalRounds: number;
  policiesProposed: number;
  policiesPassed: number;
  seatLeaderChanges: number;
  scoreBreakdown: Record<string, {
    proposerRewards: number;
    ideologyAlignment: number;
    endgameAwards: number;
    total: number;
  }>;
  seatHistoryPerRound: Record<string, number[]>;
  winnerWasSeatLeader: boolean;
}
