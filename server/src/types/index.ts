// ============================================================
// CORE TYPES FOR POLITICAL BOARD GAME
// ============================================================

export type Issue = 'economy' | 'cost_of_living' | 'housing' | 'climate' | 'security';
export type SocialIdeology = 'progressive' | 'conservative';
export type EconomicIdeology = 'market' | 'interventionist';
export type IdeologyStance = 'favoured' | 'neutral' | 'opposed';
export type Phase =
  | 'waiting'
  | 'draw'
  | 'negotiation'
  | 'campaign'
  | 'campaign_targeting'
  | 'seat_capture'          // NEW: Player selecting seats to capture
  | 'policy_proposal'
  | 'policy_vote'
  | 'policy_resolution'
  | 'agenda_selection'      // NEW: Proposer picks new agenda after matching policy
  | 'wildcard_resolution'
  | 'game_over';
export type CardType = 'campaign' | 'policy' | 'wildcard';
export type PCapType = 'mandate' | 'prime_ministership' | 'landmark_reform' | 'policy_win' | 'ideological_credibility' | 'state_control';
export type IdeologyMode = 'random' | 'choose' | 'derived';  // NEW: derived mode
export type SeatIdeologyMode = 'random' | 'realistic';  // NEW: Seat ideology distribution mode

// ============================================================
// SEAT MAP TYPES (Australian Electoral Map)
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
  x: number;        // 0-100 relative coordinate on map
  y: number;        // 0-100 relative coordinate on map
  ideology: SeatIdeology;
  ownerPlayerId: string | null;
  // Artwork (optional, for future implementation)
  artworkUrl?: string;           // URL to seat artwork/icon
  thumbnailUrl?: string;         // URL to smaller thumbnail
}

// Pending seat capture state machine
export interface PendingSeatCapture {
  actorId: string;
  cardId: string;
  cardName: string;
  remaining: number;           // Seats left to capture
  ideologyAxis: 'econ' | 'social';
  ideologyBucket: EconBucket | SocialBucket;
  eligibleSeatIds: SeatId[];   // Precomputed eligible seats
}

// State control tracking (player who has majority of seats in a state)
export interface StateControl {
  state: StateCode;
  controllerId: string | null;  // Player ID who controls the state (null if tied/no majority)
  seatCount: number;            // Seats owned by controller
  totalSeats: number;           // Total seats in state
}

// Party colors available for selection
export const PARTY_COLORS = [
  { id: 'red', hex: '#E53935', name: 'Red' },
  { id: 'blue', hex: '#1E88E5', name: 'Blue' },
  { id: 'green', hex: '#43A047', name: 'Green' },
  { id: 'orange', hex: '#FB8C00', name: 'Orange' },
  { id: 'purple', hex: '#8E24AA', name: 'Purple' },
  { id: 'teal', hex: '#00897B', name: 'Teal' },
  { id: 'pink', hex: '#D81B60', name: 'Pink' },
  { id: 'indigo', hex: '#3949AB', name: 'Indigo' },
] as const;

export type PartyColorId = typeof PARTY_COLORS[number]['id'];

// ============================================================
// CARD DEFINITIONS
// ============================================================

export interface CampaignCard {
  id: string;
  name: string;
  description: string;
  seatDelta: number;
  issue?: Issue;
  policyLink?: string;  // Links to policy ID for synergy bonus
  stanceTable?: {       // Ideology stances for campaigns
    progressive: IdeologyStance;
    conservative: IdeologyStance;
    market: IdeologyStance;
    interventionist: IdeologyStance;
  };
  conditional?: {
    type: 'leader_penalty' | 'underdog_bonus' | 'issue_match';
    modifier: number;
  };
  // NEW: Ideology for seat capture targeting
  ideology?: {
    econ?: EconBucket;
    social?: SocialBucket;
  };
  // Artwork (optional)
  artworkUrl?: string;           // URL to card artwork
  thumbnailUrl?: string;         // URL to smaller thumbnail
}

export interface PolicyCard {
  id: string;
  name: string;
  description: string;
  issue: Issue;
  proposerReward: PCapType;
  proposerRewardValue: number;
  campaignLinks?: string[];  // Campaign IDs that synergize
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
  // Artwork (optional)
  artworkUrl?: string;           // URL to card artwork
  thumbnailUrl?: string;         // URL to smaller thumbnail
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
  // Artwork (optional)
  artworkUrl?: string;           // URL to card artwork
  thumbnailUrl?: string;         // URL to smaller thumbnail
}

export interface PCapCard {
  type: PCapType;
  value: number;
  name: string;
  source: string;
  roundAwarded: number;
}

// ============================================================
// HAND CARD WITH METADATA
// ============================================================

export interface HandCard {
  card: CampaignCard | PolicyCard;
  isNew: boolean;        // Marked as newly drawn (for UI highlighting)
  drawnRound: number;    // Round when card was drawn
}

// ============================================================
// DERIVED IDEOLOGY PROFILE
// ============================================================

export interface IdeologyProfile {
  // Track votes and proposals by stance
  progressiveActions: number;
  conservativeActions: number;
  marketActions: number;
  interventionistActions: number;
  
  // Calculated percentages (0-100)
  socialScore: number;      // 0 = conservative, 100 = progressive
  economicScore: number;    // 0 = market, 100 = interventionist
  
  // Dominant ideology labels (derived)
  dominantSocial: SocialIdeology | 'neutral';
  dominantEconomic: EconomicIdeology | 'neutral';
}

// ============================================================
// NEGOTIATION / CARD TRADING
// ============================================================

export type TradeOfferStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'countered';

export interface TradeOffer {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  offeredCardIds: string[];      // Cards being offered
  requestedCardIds: string[];    // Cards being requested
  status: TradeOfferStatus;
  timestamp: number;
  expiresAt: number;
  counterOfferId?: string;       // If this is a counter to another offer
}

export interface NegotiationState {
  activeOffers: TradeOffer[];
  completedTrades: {
    offer: TradeOffer;
    completedAt: number;
  }[];
  playersReady: string[];        // Players who've marked ready to proceed
}

// ============================================================
// CAMPAIGN TARGETING
// ============================================================

export interface PendingCampaign {
  playerId: string;
  cardId: string;
  card: CampaignCard;
  calculatedDelta: number;       // Seats to gain
  agendaBonus: number;
  requiresTarget: boolean;       // True if delta > 0 and multiple opponents
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
// HISTORY SNAPSHOT (for worm graph)
// ============================================================

export interface CampaignPlayedRecord {
  playerId: string;
  cardId: string;
  cardName: string;
  seatDelta: number;
  agendaBonus: number;
  targetId?: string;             // NEW: Who was targeted
}

export interface PolicyResultRecord {
  cardId: string;
  cardName: string;
  proposerId: string;
  passed: boolean;
  yesVotes: number;
  noVotes: number;
  voterBreakdown: { playerId: string; vote: 'yes' | 'no'; seatWeight: number }[];
}

export interface WildcardRecord {
  cardId: string;
  cardName: string;
  effects: { playerId: string; seatDelta: number }[];
}

export interface TradeRecord {
  fromPlayerId: string;
  toPlayerId: string;
  cardsExchanged: number;
}

export interface PCapChangeRecord {
  playerId: string;
  pCapDelta: number;
  seatDelta: number;
  reason: string;
  changeType: 'award' | 'penalty';
  timestamp: number;
}

export interface HistorySnapshot {
  round: number;
  timestamp: number;
  activeIssue: Issue;
  seatCounts: Record<string, number>;
  pCapCounts: Record<string, number>;
  ideologyProfiles: Record<string, IdeologyProfile>;
  campaignsPlayed: CampaignPlayedRecord[];
  policyResult: PolicyResultRecord | null;
  wildcardDrawn: WildcardRecord | null;
  tradesCompleted: TradeRecord[];
  issueChangedTo: Issue | null;
  pCapChanges: PCapChangeRecord[];
}

// ============================================================
// PLAYER STATE
// ============================================================

export interface Player {
  id: string;
  name: string;              // Party name
  playerName: string;        // Human player name
  colorId: PartyColorId;     // Selected color ID
  color: string;             // Hex color
  symbolId: string;          // Selected political symbol ID

  // Ideology (fixed or derived based on mode)
  socialIdeology: SocialIdeology;
  economicIdeology: EconomicIdeology;
  ideologyProfile: IdeologyProfile;   // Action-based tracking

  seats: number;
  hand: HandCard[];          // Includes metadata
  pCapCards: PCapCard[];
  connected: boolean;

  // Round state
  hasSkippedThisRound: boolean;    // For skip & replace limit
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

  // NEW: Australian Electoral Map - Seat ownership is authoritative source of truth
  seats: Record<SeatId, Seat>;
  mapSeed: string;

  // State control tracking (for PCap awards)
  stateControl: Record<StateCode, StateControl>;

  // Current round tracking
  playersDrawn: string[];
  playersCampaigned: string[];
  proposedPolicy: PolicyCard | null;
  proposerId: string | null;
  votes: Vote[];
  pendingWildcard: WildcardCard | null;

  // NEW: Campaign targeting
  pendingCampaign: PendingCampaign | null;

  // NEW: Seat capture targeting
  pendingSeatCapture: PendingSeatCapture | null;

  // NEW: Negotiation state
  negotiation: NegotiationState;
  
  // Track campaigns for policy synergy
  campaignsPlayedByPlayer: Record<string, string[]>;
  
  // Round metrics
  roundSeatChanges: Record<string, number>;
  roundCampaignsPlayed: CampaignPlayedRecord[];
  roundPolicyResult: PolicyResultRecord | null;
  roundWildcardDrawn: WildcardRecord | null;
  roundIssueChangedTo: Issue | null;
  roundTradesCompleted: TradeRecord[];
  roundPCapChanges: PCapChangeRecord[];
  
  // Ongoing effects
  activeEffects: { policyId: string; effectId: string; modifier: Record<string, number> }[];
  
  // Event log
  eventLog: GameEvent[];
  
  // Chat messages
  chatMessages: ChatMessage[];
  
  // History snapshots
  history: HistorySnapshot[];
  
  // Game over data
  winner: string | null;
  finalScores: Record<string, number> | null;
  
  // Taken colors (for lobby)
  takenColors: PartyColorId[];
}

// ============================================================
// EVENTS
// ============================================================

export type GameEvent =
  | { type: 'game_started'; timestamp: number; seed: string; config: string }
  | { type: 'player_joined'; timestamp: number; playerId: string; playerName: string; partyName: string; colorId: PartyColorId; symbolId: string }
  | { type: 'round_started'; timestamp: number; round: number; activeIssue: Issue }
  | { type: 'card_drawn'; timestamp: number; playerId: string; cardType: 'campaign' | 'policy'; cardId: string }
  | { type: 'card_replaced'; timestamp: number; playerId: string; discardedCardId: string; newCardId: string; newCardType: 'campaign' | 'policy' }
  | { type: 'campaign_played'; timestamp: number; playerId: string; cardId: string; seatDelta: number; agendaBonus: number; targetId?: string }
  | { type: 'policy_proposed'; timestamp: number; playerId: string; cardId: string }
  | { type: 'vote_cast'; timestamp: number; playerId: string; vote: 'yes' | 'no'; seatWeight: number }
  | { type: 'policy_resolved'; timestamp: number; passed: boolean; yesVotes: number; noVotes: number }
  | { type: 'pcap_awarded'; timestamp: number; playerId: string; pCapType: PCapType; value: number; reason: string }
  | { type: 'wildcard_drawn'; timestamp: number; playerId: string; cardId: string }
  | { type: 'wildcard_resolved'; timestamp: number; cardId: string; effects: { playerId: string; seatDelta: number }[] }
  | { type: 'seats_changed'; timestamp: number; playerId: string; delta: number; newTotal: number; reason: string }
  | { type: 'seat_captured'; timestamp: number; seatId: SeatId; seatName: string; fromPlayerId: string | null; toPlayerId: string; ideology: SeatIdeology }
  | { type: 'issue_changed'; timestamp: number; oldIssue: Issue; newIssue: Issue; changedBy: string }
  | { type: 'chat_message'; timestamp: number; senderId: string; recipientId: string | null; content: string }
  | { type: 'card_refilled'; timestamp: number; playerId: string; cardType: 'campaign' | 'policy'; cardId: string }
  | { type: 'trade_offered'; timestamp: number; offerId: string; fromPlayerId: string; toPlayerId: string }
  | { type: 'trade_accepted'; timestamp: number; offerId: string }
  | { type: 'trade_rejected'; timestamp: number; offerId: string }
  | { type: 'trade_completed'; timestamp: number; offerId: string; fromPlayerId: string; toPlayerId: string; cardsExchanged: number }
  | { type: 'ideology_updated'; timestamp: number; playerId: string; profile: IdeologyProfile }
  | { type: 'negotiation_ready'; timestamp: number; playerId: string }
  | { type: 'game_ended'; timestamp: number; winner: string; scores: Record<string, number> }
  | { type: 'phase_skipped'; timestamp: number; fromPhase: Phase }
  | { type: 'speaker_tiebreak'; timestamp: number; speakerId: string; decision: 'passed' | 'failed' }
  | { type: 'agenda_selection_triggered'; timestamp: number; playerId: string; reason: string }
  | { type: 'policy_synergy'; timestamp: number; playerId: string; campaignId: string; policyId: string };

// ============================================================
// GAME CONFIGURATION
// ============================================================

export interface GameConfig {
  totalSeats: number;
  handLimit: number;
  maxRounds: number | null;
  ideologyMode: IdeologyMode;
  agendaBonus: number;
  campaignCardsPerTurn: number;
  seatTransferRule: 'from_leader' | 'proportional' | 'from_all_equal' | 'player_choice';  // NEW: player_choice
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
  autoRefillHand: boolean;
  
  // NEW options
  enableNegotiation: boolean;           // Allow card trading phase
  negotiationTimeLimit: number;         // Seconds for negotiation (0 = unlimited until all ready)
  enableSeatTargeting: boolean;         // Allow choosing who to take seats from
  allowSkipReplace: boolean;            // Allow skipping turn to replace a card
  skipReplacesPerRound: number;         // Max skip-replaces per player per round

  // Seat map options
  seatIdeologyMode: SeatIdeologyMode;   // Random (state-grouped) vs Realistic (voting pattern based)
  stateControlValue: number;            // PCap value for gaining control of a state
}

// ============================================================
// SOCKET MESSAGES
// ============================================================

export interface JoinRoomData {
  roomId: string;
  playerName: string;
  partyName: string;
  colorId?: PartyColorId;
  symbolId?: string;
  socialIdeology?: SocialIdeology;
  economicIdeology?: EconomicIdeology;
}

export interface CreateRoomData {
  playerName: string;
  partyName: string;
  colorId?: PartyColorId;
  symbolId?: string;
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
  'select_campaign_target': (data: { targetPlayerId: string }) => void;
  'skip_campaign': () => void;
  'skip_and_replace': (data: { cardId: string }) => void;
  'propose_policy': (data: { cardId: string }) => void;
  'skip_proposal': () => void;
  'cast_vote': (data: { vote: 'yes' | 'no' }) => void;
  'acknowledge_wildcard': () => void;
  'adjust_issue': (data: { direction: -1 | 0 | 1 }) => void;
  'update_config': (data: { config: Partial<GameConfig> }) => void;
  'request_state': () => void;
  'export_game': () => void;
  'send_chat': (data: { content: string; recipientId: string | null }) => void;
  'select_new_agenda': (data: { issue: Issue }) => void;
  'force_advance_phase': () => void;

  // Seat capture (Australian map)
  'resolve_capture_seat': (data: { seatId: SeatId }) => void;

  // Negotiation
  'make_trade_offer': (data: { toPlayerId: string; offeredCardIds: string[]; requestedCardIds: string[] }) => void;
  'respond_to_offer': (data: { offerId: string; accept: boolean }) => void;
  'cancel_offer': (data: { offerId: string }) => void;
  'negotiation_ready': () => void;
}

export interface ServerToClientEvents {
  'room_created': (data: { roomId: string }) => void;
  'room_joined': (data: { roomId: string; playerId: string }) => void;
  'state_update': (data: { state: GameState; config: GameConfig }) => void;
  'error': (data: { message: string }) => void;
  'game_exported': (data: { eventLog: GameEvent[]; config: GameConfig; seed: string; chatLog: ChatMessage[]; history: HistorySnapshot[] }) => void;
  'player_disconnected': (data: { playerId: string }) => void;
  'player_reconnected': (data: { playerId: string }) => void;
  'chat_message': (data: { message: ChatMessage }) => void;
  'trade_offer_received': (data: { offer: TradeOffer }) => void;
  'trade_offer_updated': (data: { offer: TradeOffer }) => void;
  'available_colors': (data: { colors: PartyColorId[] }) => void;
}

// ============================================================
// ANALYTICS
// ============================================================

export interface GameAnalytics {
  totalRounds: number;
  policiesProposed: number;
  policiesPassed: number;
  seatLeaderChanges: number;
  tradesCompleted: number;
  scoreBreakdown: Record<string, {
    proposerRewards: number;
    ideologyAlignment: number;
    endgameAwards: number;
    total: number;
  }>;
  seatHistoryPerRound: Record<string, number[]>;
  winnerWasSeatLeader: boolean;
}
