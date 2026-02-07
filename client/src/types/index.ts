// ============================================================
// THE HOUSE — Democracy 4-Style Multiplayer Political Simulation
// Complete type system
// ============================================================

// ============================================================
// CORE SIMULATION: THE POLICY WEB
// Everything connects: Policies → Stats → Situations → Voter Groups
// ============================================================

export type NodeType = 'policy' | 'stat' | 'situation' | 'voter_group' | 'global';

/** A node in the simulation web. */
export interface SimNode {
  id: string;
  type: NodeType;
  name: string;
  value: number;        // 0–1 normalised
  prevValue: number;    // last tick value (for delta display)
  category?: string;
}

/** A weighted link between two simulation nodes. */
export interface SimLink {
  sourceId: string;
  targetId: string;
  multiplier: number;   // effect strength (negative = inverse)
  formula: LinkFormula;
  delay: number;        // rounds before effect begins
  inertia: number;      // 0–1, how quickly the target responds
}

export type LinkFormula = 'linear' | 'sqrt' | 'squared' | 'threshold' | 'inverse';

// ============================================================
// IDEOLOGY
// ============================================================

export type SocialIdeology = 'progressive' | 'conservative';
export type EconomicIdeology = 'market' | 'interventionist';

// ============================================================
// POLICIES — Adjustable sliders (the core of Democracy 4)
// ============================================================

export type PolicyCategory =
  | 'tax'
  | 'economy'
  | 'welfare'
  | 'health'
  | 'education'
  | 'law_order'
  | 'infrastructure'
  | 'environment'
  | 'foreign';

export interface PolicySlider {
  id: string;
  name: string;
  shortName: string;
  description: string;
  category: PolicyCategory;
  icon: string;             // emoji or short code
  minLabel: string;         // label at 0% e.g. "None"
  maxLabel: string;         // label at 100% e.g. "Maximum"
  currentValue: number;     // 0–1
  targetValue: number;      // government's intended value (transitions over rounds)
  defaultValue: number;     // starting position
  costPerPoint: number;     // annual budget cost at 100%
  implementationDelay: number;  // rounds for currentValue to reach targetValue
  effects: PolicyEffect[];
  // Ideological leaning: positive = left/progressive, negative = right/conservative
  ideologicalBias: { social: number; economic: number };  // -1 to +1
}

export interface PolicyEffect {
  targetId: string;      // stat, situation, or voter_group id
  multiplier: number;    // -1 to +1 effect strength
  formula: LinkFormula;
  delay: number;
  inertia: number;
}

// ============================================================
// STATISTICS — Computed values driven by policies
// ============================================================

export interface StatDefinition {
  id: string;
  name: string;
  icon: string;
  value: number;         // 0–1 normalised
  prevValue: number;
  defaultValue: number;
  displayFormat: 'percent' | 'currency' | 'index' | 'rate';
  displayMin: number;    // real world display range
  displayMax: number;
  isGood: boolean;       // true = higher is better (for colour coding)
  effects: PolicyEffect[];  // downstream effects on other nodes
}

// ============================================================
// SITUATIONS — Emerge dynamically when conditions are met
// ============================================================

export type SituationSeverity = 'crisis' | 'problem' | 'neutral' | 'good' | 'boom';

export interface SituationDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  severityType: SituationSeverity;
  triggerThreshold: number;    // activate when computed input > this
  deactivateThreshold: number; // deactivate when computed input < this
  inputs: { sourceId: string; weight: number }[];  // what causes this
  effects: PolicyEffect[];     // downstream effects when active
  headline: string;            // news headline when it triggers
  voterReactions: { groupId: string; delta: number }[];  // direct happiness impact
}

export interface ActiveSituation {
  definitionId: string;
  name: string;
  icon: string;
  severityType: SituationSeverity;
  severity: number;         // 0–1
  roundActivated: number;
  headline: string;
}

// ============================================================
// VOTER GROUPS — The electorate
// ============================================================

export interface VoterGroupDefinition {
  id: string;
  name: string;
  icon: string;
  description: string;
  basePopulation: number;   // percentage of electorate (can overlap)
  concerns: VoterConcern[];
  // Ideological leaning
  socialLeaning: number;    // -1 (conservative) to +1 (progressive)
  economicLeaning: number;  // -1 (market) to +1 (interventionist)
  // How much campaigning affects them
  persuadability: number;   // 0–1
  // What situations affect their membership size
  populationModifiers: { sourceId: string; weight: number }[];
}

export interface VoterConcern {
  nodeId: string;           // policy, stat, or situation they care about
  weight: number;           // how much they care (absolute importance)
  desiresHigh: boolean;     // true = happy when value is high
}

export interface VoterGroupState {
  id: string;
  name: string;
  icon: string;
  population: number;       // current effective population %
  happiness: number;        // -1 to +1
  prevHappiness: number;
  loyalty: Record<string, number>;  // playerId → loyalty from campaigning
  turnout: number;          // 0–1, how likely to vote (affected by happiness extremes)
}

// ============================================================
// DILEMMAS — Tough choice events for the government
// ============================================================

export interface DilemmaDefinition {
  id: string;
  name: string;
  headline: string;
  description: string;
  icon: string;
  choices: DilemmaChoice[];
  // Optional trigger condition
  condition?: { nodeId: string; operator: '>' | '<' | '>=' | '<='; value: number };
  // Only show once per game
  oneShot: boolean;
}

export interface DilemmaChoice {
  id: string;
  label: string;
  description: string;
  effects: { nodeId: string; delta: number; duration: number }[];
  voterReactions: { groupId: string; delta: number }[];
}

export interface PendingDilemma {
  definitionId: string;
  name: string;
  headline: string;
  description: string;
  icon: string;
  choices: DilemmaChoice[];
  roundTriggered: number;
}

// ============================================================
// SEAT MAP (Australian electorates)
// ============================================================

export type SeatId = string;
export type StateCode = 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT';

export interface Seat {
  id: SeatId;
  name: string;
  state: StateCode;
  margin: number;               // 0–100, lower = more marginal
  ownerPlayerId: string | null;
  // Layout
  chamberRow: number;
  chamberCol: number;
  chamberSide: 'left' | 'right' | 'crossbench';
  mapX: number;
  mapY: number;
  // Electorate demographics: which voter groups are strongest here
  demographics: { groupId: string; weight: number }[];
}

export interface StateInfo {
  code: StateCode;
  name: string;
  seatCount: number;
  ownedBy: Record<string, number>;  // playerId → seat count
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
// PHASES
// ============================================================

export type Phase =
  | 'waiting'
  | 'government_action'     // government adjusts policy sliders
  | 'opposition_action'     // opposition players choose actions simultaneously
  | 'simulation'            // effects propagate, voter groups update
  | 'dilemma'               // government resolves a dilemma
  | 'media_cycle'           // news focus shifts, spotlight on issues
  | 'election'              // seats contested
  | 'election_results'      // show election results
  | 'game_over';

// ============================================================
// PLAYER ACTIONS
// ============================================================

export type ActionType =
  | 'campaign'           // target a voter group, spend funds to build loyalty
  | 'shadow_policy'      // publicly propose an alternative slider position
  | 'attack_government'  // highlight a crisis/negative stat
  | 'fundraise'          // gain funds
  | 'coalition_deal'     // form alliance with another player
  | 'media_campaign'     // boost visibility, increase influence with media coverage
  | 'grassroots'         // cheap slow campaign targeting your ideological base
  | 'policy_research';   // reduce implementation delay of your next policy change

export interface PlayerAction {
  type: ActionType;
  targetGroupId?: string;       // for campaign, grassroots
  targetPolicyId?: string;      // for shadow_policy
  targetPlayerId?: string;      // for attack_government, coalition_deal
  proposedValue?: number;       // for shadow_policy (the slider value you'd set)
  targetStatId?: string;        // for attack_government
  targetSituationId?: string;   // for attack_government
}

export interface ActionResult {
  playerId: string;
  action: PlayerAction;
  success: boolean;
  description: string;
  effects: { type: string; amount: number }[];
}

// ============================================================
// POLICY ADJUSTMENT (government action)
// ============================================================

export interface PolicyAdjustment {
  policyId: string;
  newValue: number;  // 0–1 target
}

// ============================================================
// MEDIA CYCLE
// ============================================================

export interface MediaFocus {
  nodeId: string;
  nodeName: string;
  nodeType: NodeType;
  headline: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  amplification: number;  // multiplier on voter concern for this node
  roundsRemaining: number;
}

// ============================================================
// PLAYER STATE
// ============================================================

export interface Player {
  id: string;
  name: string;           // party name
  playerName: string;
  colorId: PartyColorId;
  color: string;

  socialIdeology: SocialIdeology;
  economicIdeology: EconomicIdeology;

  seats: number;
  funds: number;
  politicalCapital: number;  // spent to make policy changes (regenerates)

  isGovernment: boolean;
  isAI: boolean;
  aiPersonality?: AIPersonality;
  connected: boolean;
  isHost: boolean;

  // Simultaneous action tracking
  submittedActions: boolean;
  submittedAdjustments: boolean;

  // Shadow policies: what this player publicly proposes
  shadowPolicies: Record<string, number>;  // policyId → proposed value

  // Campaign influence per voter group
  voterInfluence: Record<string, number>;  // groupId → accumulated influence

  // Stats
  roundsAsGovernment: number;
  electionsWon: number;
  policiesChanged: number;
  crisisesManaged: number;

  // Scoring
  ideologyScore: number;        // how much policies align with ideology
  approvalRating: number;       // -1 to +1, computed from voter happiness
}

// ============================================================
// AI
// ============================================================

export type AIPersonality = 'hawk' | 'dove' | 'populist' | 'technocrat' | 'ideologue';
export type AIDifficulty = 'easy' | 'normal' | 'hard';

// ============================================================
// ELECTION
// ============================================================

export interface ElectionResult {
  round: number;
  seatChanges: { seatId: SeatId; from: string | null; to: string | null }[];
  voteShare: Record<string, number>;  // playerId → % of vote
  voterGroupVotes: Record<string, Record<string, number>>;  // groupId → playerId → votes
  newGovernmentId: string | null;
  swingSeats: number;
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

  // The Policy Web
  policies: Record<string, PolicySlider>;
  stats: Record<string, StatDefinition>;
  situations: ActiveSituation[];
  voterGroups: VoterGroupState[];

  // Media
  mediaFocus: MediaFocus[];

  // Dilemma
  pendingDilemma: PendingDilemma | null;
  resolvedDilemmas: string[];  // definition IDs

  // Board
  totalSeats: number;
  seats: Record<SeatId, Seat>;
  stateInfo: Record<StateCode, StateInfo>;

  // Actions this round
  governmentAdjustments: PolicyAdjustment[];
  oppositionActions: Record<string, PlayerAction[]>;  // playerId → actions
  roundResults: ActionResult[];

  // History
  policyHistory: { round: number; policyId: string; oldValue: number; newValue: number; playerId: string }[];
  statHistory: Record<string, number[]>;   // statId → array of values per round
  electionHistory: ElectionResult[];

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
// EVENTS LOG
// ============================================================

export type GameEvent =
  | { type: 'game_started'; timestamp: number; seed: string }
  | { type: 'player_joined'; timestamp: number; playerId: string; playerName: string; colorId: PartyColorId }
  | { type: 'round_started'; timestamp: number; round: number }
  | { type: 'phase_changed'; timestamp: number; from: Phase; to: Phase }
  | { type: 'policy_changed'; timestamp: number; playerId: string; policyId: string; policyName: string; oldValue: number; newValue: number }
  | { type: 'situation_triggered'; timestamp: number; situationId: string; name: string; headline: string; severity: SituationSeverity }
  | { type: 'situation_resolved'; timestamp: number; situationId: string; name: string }
  | { type: 'dilemma_presented'; timestamp: number; dilemmaId: string; name: string }
  | { type: 'dilemma_resolved'; timestamp: number; dilemmaId: string; choiceId: string; description: string }
  | { type: 'election_held'; timestamp: number; result: ElectionResult }
  | { type: 'government_formed'; timestamp: number; playerId: string; playerName: string; seats: number }
  | { type: 'media_spotlight'; timestamp: number; nodeId: string; headline: string; sentiment: string }
  | { type: 'campaign_action'; timestamp: number; playerId: string; targetGroup: string; effect: number }
  | { type: 'attack_action'; timestamp: number; attackerId: string; targetId: string; issue: string }
  | { type: 'seat_changed'; timestamp: number; seatId: SeatId; from: string | null; to: string | null }
  | { type: 'funds_changed'; timestamp: number; playerId: string; delta: number; reason: string }
  | { type: 'chat_message'; timestamp: number; senderId: string; recipientId: string | null; content: string }
  | { type: 'game_ended'; timestamp: number; winner: string; scores: PlayerScore[] };

// ============================================================
// SCORES
// ============================================================

export interface PlayerScore {
  playerId: string;
  playerName: string;
  partyName: string;
  color: string;
  seats: number;
  voteShare: number;
  ideologyScore: number;       // how well policies match ideology
  governmentBonus: number;     // bonus for time in government
  crisisPenalty: number;       // penalty for unresolved crises while in government
  voterApproval: number;       // average voter group happiness
  total: number;
}

// ============================================================
// CHAT
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
// GAME CONFIGURATION
// ============================================================

export interface GameConfig {
  totalSeats: number;
  totalRounds: number;
  electionCycle: number;
  actionsPerRound: number;         // actions for opposition players per round
  policyAdjustmentsPerRound: number;  // sliders government can change per round

  startingFunds: number;
  startingPoliticalCapital: number;
  incomePerSeat: number;
  capitalRegenPerRound: number;

  campaignCost: number;
  attackCost: number;
  mediaCampaignCost: number;
  fundraiseAmount: number;
  grassrootsCost: number;
  policyResearchCost: number;

  aiPlayerCount: number;
  aiDifficulty: AIDifficulty;

  majorityThreshold: number;

  enableDilemmas: boolean;
  enableMediaCycle: boolean;
  enableSituations: boolean;
  enableChat: boolean;
  simulationSpeed: number;    // 0.5–2.0 multiplier on effect propagation
}

// ============================================================
// SOCKET EVENTS
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
  'submit_policy_adjustments': (data: { adjustments: PolicyAdjustment[] }) => void;
  'submit_actions': (data: { actions: PlayerAction[] }) => void;
  'resolve_dilemma': (data: { choiceId: string }) => void;
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
  'dilemma_presented': (data: { dilemma: PendingDilemma }) => void;
  'simulation_tick': (data: { stats: Record<string, number>; situations: ActiveSituation[] }) => void;
}
