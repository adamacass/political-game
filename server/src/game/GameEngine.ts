// ============================================================
// THE HOUSE - Australian Political Strategy Game
// GameEngine: Simultaneous-play strategy with elections & economy
// ============================================================

import {
  GameState, GameConfig, Player, Phase, ActionType,
  GameEvent, SocialIdeology, EconomicIdeology, ChatMessage,
  PartyColorId, PARTY_COLORS, IdeologyStance,
  Seat, SeatId, StateCode, StateControl, EconomicStateData, VoterGroupState,
  Policy, PolicyEffect, ActivePolicy, PolicyVoteResult, PolicyCategory,
  PoliticalEvent, EventEffect,
  PlayerAction, ActionResult, ActionCost,
  PlayerScore, ElectionResult, AIStrategy, AIDifficulty,
} from '../types';
import { SeededRNG } from './rng';
import {
  generateSeatMap, computePlayerSeatCounts, recomputeChamberPositions,
  transferSeat, getPlayerSeats, computeStateControl, compareStateControl,
} from './mapGen';
import { getAllPolicies } from './policies';
import { getAllEvents } from './events';
import { EconomicEngine, ActiveEffect } from './economicEngine';
import { VoterEngine, PartyProfile } from './voterEngine';

// ============================================================
// CONSTANTS
// ============================================================

const AI_NAMES: { name: string; party: string; strategy: AIStrategy }[] = [
  { name: 'Margaret', party: 'Unity Party', strategy: 'pragmatist' },
  { name: 'Kevin', party: 'Peoples Alliance', strategy: 'populist' },
  { name: 'Julia', party: 'Reform Movement', strategy: 'policy_wonk' },
  { name: 'Tony', party: 'Freedom Coalition', strategy: 'campaigner' },
  { name: 'Malcolm', party: 'National Front', strategy: 'pragmatist' },
];

const AI_IDEOLOGIES: { social: SocialIdeology; economic: EconomicIdeology }[] = [
  { social: 'conservative', economic: 'market' },
  { social: 'progressive', economic: 'interventionist' },
  { social: 'progressive', economic: 'market' },
  { social: 'conservative', economic: 'interventionist' },
  { social: 'progressive', economic: 'interventionist' },
];

const ALL_STATES: StateCode[] = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

const DEFAULT_CONFIG: GameConfig = {
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

// ============================================================
// GAME ENGINE
// ============================================================

export class GameEngine {
  private state: GameState;
  private config: GameConfig;
  private rng: SeededRNG;
  private allPolicies: Policy[];
  private allEvents: PoliticalEvent[];
  private economicEngine: EconomicEngine | null = null;
  private voterEngine: VoterEngine | null = null;
  private activePolicyEffects: ActiveEffect[] = [];

  constructor(roomId: string, config: Partial<GameConfig> = {}, seed?: string) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rng = new SeededRNG(seed);
    this.allPolicies = getAllPolicies();
    this.allEvents = getAllEvents();
    this.state = this.createInitialState(roomId);
  }

  // ----------------------------------------------------------
  // State creation
  // ----------------------------------------------------------

  private createInitialState(roomId: string): GameState {
    return {
      roomId,
      seed: this.rng.getSeed(),
      phase: 'waiting',
      round: 0,
      totalRounds: this.config.totalRounds,

      players: [],

      totalSeats: this.config.totalSeats,
      seats: {},
      stateControl: {} as Record<StateCode, StateControl>,

      policyMenu: [],
      activePolicies: [],
      policyHistory: [],

      roundActions: {},
      lastRoundResults: [],

      economy: {
        gdpGrowth: 2.5, unemployment: 5.0, inflation: 2.0,
        publicDebt: 60, budgetBalance: 0,
        consumerConfidence: 50, businessConfidence: 50, interestRate: 3.0,
        sectors: {
          manufacturing: 50, services: 50, finance: 50, technology: 50,
          healthcare: 50, education: 50, housing: 50, energy: 50, agriculture: 50,
        },
      },
      economyHistory: [],
      voterGroups: [],

      governmentLeaderId: null,
      nextElectionRound: this.config.electionCycle,
      electionCycle: this.config.electionCycle,
      electionHistory: [],

      currentEvent: null,
      pastEvents: [],

      eventLog: [],
      chatMessages: [],

      winner: null,
      finalScores: null,

      takenColors: [],
    };
  }

  // ----------------------------------------------------------
  // Public accessors
  // ----------------------------------------------------------

  getState(): GameState { return { ...this.state }; }
  getConfig(): GameConfig { return { ...this.config }; }

  getAvailableColors(): PartyColorId[] {
    const allColorIds = PARTY_COLORS.map(c => c.id) as PartyColorId[];
    return allColorIds.filter(id => !this.state.takenColors.includes(id));
  }

  getEventLog(): GameEvent[] { return [...this.state.eventLog]; }

  // ----------------------------------------------------------
  // Lobby management
  // ----------------------------------------------------------

  addPlayer(
    id: string,
    playerName: string,
    partyName: string,
    colorId?: PartyColorId,
    _symbolId?: string,
    socialIdeology?: SocialIdeology,
    economicIdeology?: EconomicIdeology,
  ): Player | null {
    if (this.state.phase !== 'waiting') return null;
    if (this.state.players.length >= 6) return null;
    if (this.state.players.find(p => p.id === id)) return null;

    const availableColors = this.getAvailableColors();
    const finalColorId: PartyColorId =
      colorId && !this.state.takenColors.includes(colorId) ? colorId : availableColors[0];
    if (!finalColorId) return null;
    this.state.takenColors.push(finalColorId);

    const colorEntry = PARTY_COLORS.find(c => c.id === finalColorId);
    const colorHex = colorEntry?.hex || '#666666';

    const isHost = this.state.players.length === 0;

    const player: Player = {
      id,
      name: partyName || `Party ${this.state.players.length + 1}`,
      playerName: playerName || `Player ${this.state.players.length + 1}`,
      colorId: finalColorId,
      color: colorHex,
      socialIdeology: socialIdeology || 'progressive',
      economicIdeology: economicIdeology || 'market',
      seats: 0,
      funds: 0,
      approval: this.config.startingApproval,
      isAI: false,
      connected: true,
      isHost,
      submittedActions: false,
      policyScore: 0,
      governmentRounds: 0,
      campaignInfluence: {} as Record<StateCode, number>,
      totalSeatsWon: 0,
      totalSeatsLost: 0,
      policiesProposed: 0,
      policiesPassed: 0,
    };

    // Initialize campaign influence for all states
    for (const st of ALL_STATES) {
      player.campaignInfluence[st] = 0;
    }

    this.state.players.push(player);

    this.logEvent({
      type: 'player_joined',
      timestamp: Date.now(),
      playerId: id,
      playerName: player.playerName,
      colorId: finalColorId,
    });

    return player;
  }

  removePlayer(id: string): boolean {
    const idx = this.state.players.findIndex(p => p.id === id);
    if (idx === -1) return false;

    if (this.state.phase === 'waiting') {
      this.state.takenColors = this.state.takenColors.filter(
        c => c !== this.state.players[idx].colorId,
      );
      this.state.players.splice(idx, 1);
      if (this.state.players.length > 0 && !this.state.players.some(p => p.isHost)) {
        this.state.players[0].isHost = true;
      }
    } else {
      this.state.players[idx].connected = false;
    }

    return true;
  }

  reconnectPlayer(id: string): boolean {
    const player = this.state.players.find(p => p.id === id);
    if (!player) return false;
    player.connected = true;
    return true;
  }

  addChatMessage(message: ChatMessage): void {
    if (!this.config.enableChat) return;
    this.state.chatMessages.push(message);
    this.logEvent({
      type: 'chat_message',
      timestamp: Date.now(),
      senderId: message.senderId,
      recipientId: message.recipientId,
      content: message.content,
    });
  }

  updateConfig(updates: Partial<GameConfig>): void {
    if (this.state.phase !== 'waiting') return;
    this.config = { ...this.config, ...updates };
    this.state.totalRounds = this.config.totalRounds;
    this.state.electionCycle = this.config.electionCycle;
    this.state.nextElectionRound = this.config.electionCycle;
  }

  // ----------------------------------------------------------
  // Game start
  // ----------------------------------------------------------

  startGame(): boolean {
    if (this.state.phase !== 'waiting') return false;

    // Need at least 1 human player
    const humanCount = this.state.players.filter(p => !p.isAI).length;
    if (humanCount < 1) return false;

    // Add AI players
    this.addAIPlayers();

    // Total players check
    if (this.state.players.length < 2) return false;

    const playerIds = this.state.players.map(p => p.id);

    // Generate the Australian electoral seat map
    this.state.seats = generateSeatMap({
      seatCount: this.config.totalSeats,
      seed: this.rng.getSeed(),
      playerIds,
      ideologyMode: 'realistic',
    });

    // Initialize economic engine
    if (this.config.enableEconomy) {
      this.economicEngine = new EconomicEngine({
        policyStrength: this.config.economicVolatility,
        seed: this.rng.getSeed(),
      });
      this.state.economy = this.economicEngine.getState();
      this.state.economyHistory = [{ ...this.state.economy, sectors: { ...this.state.economy.sectors } }];
    }

    // Initialize voter engine
    if (this.config.enableVoterGroups) {
      this.voterEngine = new VoterEngine(this.rng.getSeed());
      const economicValues = this.flattenEconomicState(this.state.economy);
      this.voterEngine.updateSatisfaction(economicValues);
      this.state.voterGroups = this.voterEngine.getGroupSummaries();
    }

    // Policy menu = all available policies
    this.state.policyMenu = this.allPolicies;

    // Distribute starting funds
    for (const player of this.state.players) {
      player.funds = this.config.startingFunds;
      player.approval = this.config.startingApproval;
    }

    // Sync seat counts
    this.syncPlayerSeatCounts();

    // Compute initial state control & chamber layout
    this.state.stateControl = computeStateControl(this.state.seats);
    recomputeChamberPositions(this.state.seats, computePlayerSeatCounts(this.state.seats));

    // Determine initial government
    this.updateGovernmentLeader();

    // Begin round 1
    this.state.round = 1;
    this.state.nextElectionRound = this.config.electionCycle;

    this.logEvent({ type: 'game_started', timestamp: Date.now(), seed: this.rng.getSeed() });
    this.logEvent({ type: 'round_started', timestamp: Date.now(), round: 1 });

    // Distribute first round income
    this.distributeIncome();

    // Enter planning phase
    this.setPhase('planning');

    // AI players submit immediately
    this.processAIActions();

    return true;
  }

  private addAIPlayers(): void {
    const aiCount = this.config.aiPlayerCount;
    const humanCount = this.state.players.length;

    for (let i = 0; i < aiCount && (humanCount + i) < 6; i++) {
      const aiDef = AI_NAMES[i % AI_NAMES.length];
      const aiIdeology = AI_IDEOLOGIES[i % AI_IDEOLOGIES.length];
      const availableColors = this.getAvailableColors();
      if (availableColors.length === 0) break;

      const colorId = availableColors[0];
      this.state.takenColors.push(colorId);
      const colorEntry = PARTY_COLORS.find(c => c.id === colorId);

      const player: Player = {
        id: `ai_${i}_${Date.now()}`,
        name: aiDef.party,
        playerName: aiDef.name,
        colorId,
        color: colorEntry?.hex || '#666666',
        socialIdeology: aiIdeology.social,
        economicIdeology: aiIdeology.economic,
        seats: 0,
        funds: 0,
        approval: this.config.startingApproval,
        isAI: true,
        aiStrategy: aiDef.strategy,
        connected: true,
        isHost: false,
        submittedActions: false,
        policyScore: 0,
        governmentRounds: 0,
        campaignInfluence: {} as Record<StateCode, number>,
        totalSeatsWon: 0,
        totalSeatsLost: 0,
        policiesProposed: 0,
        policiesPassed: 0,
      };

      for (const st of ALL_STATES) {
        player.campaignInfluence[st] = 0;
      }

      this.state.players.push(player);

      this.logEvent({
        type: 'player_joined',
        timestamp: Date.now(),
        playerId: player.id,
        playerName: player.playerName,
        colorId,
      });
    }
  }

  // ----------------------------------------------------------
  // Simultaneous action submission
  // ----------------------------------------------------------

  submitActions(playerId: string, actions: PlayerAction[]): boolean {
    if (this.state.phase !== 'planning') return false;

    const player = this.state.players.find(p => p.id === playerId);
    if (!player) return false;
    if (player.submittedActions) return false;

    // Validate action count
    if (actions.length > this.config.actionsPerRound) return false;

    // Validate each action
    for (const action of actions) {
      if (!this.validateAction(player, action)) return false;
    }

    // Check total costs don't exceed funds
    let totalCost = 0;
    for (const action of actions) {
      totalCost += this.getActionCost(action.type).funds;
    }
    if (totalCost > player.funds) return false;

    // Store actions
    this.state.roundActions[playerId] = actions;
    player.submittedActions = true;

    this.logEvent({
      type: 'actions_submitted',
      timestamp: Date.now(),
      playerId,
      actionCount: actions.length,
    });

    // Check if all players have submitted
    const allSubmitted = this.state.players.every(p => p.submittedActions || !p.connected);
    if (allSubmitted) {
      this.resolveRound();
    }

    return true;
  }

  private validateAction(player: Player, action: PlayerAction): boolean {
    switch (action.type) {
      case 'campaign':
        return !!action.targetState && ALL_STATES.includes(action.targetState);
      case 'propose_policy':
        if (!action.policyId) return false;
        // Can't propose already-active policies
        if (this.state.activePolicies.some(ap => ap.policy.id === action.policyId)) return false;
        return this.allPolicies.some(p => p.id === action.policyId);
      case 'attack_ad':
        if (!action.targetPlayerId) return false;
        return action.targetPlayerId !== player.id &&
               this.state.players.some(p => p.id === action.targetPlayerId);
      case 'fundraise':
      case 'media_blitz':
      case 'coalition_talk':
        return true;
      default:
        return false;
    }
  }

  getActionCost(actionType: ActionType): ActionCost {
    switch (actionType) {
      case 'campaign':
        return { funds: this.config.campaignCost, description: 'Campaign in a state' };
      case 'propose_policy':
        return { funds: 0, description: 'Propose a policy' };
      case 'attack_ad':
        return { funds: this.config.attackAdCost, description: 'Run attack ads' };
      case 'fundraise':
        return { funds: 0, description: 'Fundraise' };
      case 'media_blitz':
        return { funds: this.config.mediaBlitzCost, description: 'Media blitz' };
      case 'coalition_talk':
        return { funds: this.config.coalitionTalkCost, description: 'Coalition building' };
      default:
        return { funds: 0, description: '' };
    }
  }

  // ----------------------------------------------------------
  // Round resolution
  // ----------------------------------------------------------

  private resolveRound(): void {
    this.setPhase('resolution');
    const results: ActionResult[] = [];

    // Gather all submitted actions
    const allActions: { player: Player; action: PlayerAction }[] = [];
    for (const player of this.state.players) {
      const actions = this.state.roundActions[player.id] || [];
      for (const action of actions) {
        allActions.push({ player, action });
      }
    }

    // Resolution order: fundraise → campaign → policy → attack_ad → media_blitz → coalition
    const order: ActionType[] = ['fundraise', 'campaign', 'propose_policy', 'attack_ad', 'media_blitz', 'coalition_talk'];

    for (const actionType of order) {
      const actionsOfType = allActions.filter(a => a.action.type === actionType);
      for (const { player, action } of actionsOfType) {
        const cost = this.getActionCost(action.type);
        player.funds -= cost.funds;

        const result = this.executeAction(player, action);
        results.push(result);

        this.logEvent({ type: 'action_resolved', timestamp: Date.now(), result });
      }
    }

    this.state.lastRoundResults = results;

    // Tick economy
    this.tickEconomy();

    // Random event (50% chance each round)
    if (this.config.enableEvents && this.allEvents.length > 0 && this.rng.random() < 0.5) {
      const event = this.rng.pick(this.allEvents);
      this.state.currentEvent = event;
      this.applyEventEffects(event);
      this.state.pastEvents.push(event);
      this.logEvent({ type: 'event_occurred', timestamp: Date.now(), eventId: event.id, eventName: event.name });
    }

    // Update government leader
    this.updateGovernmentLeader();

    // Track government rounds for scoring
    if (this.state.governmentLeaderId) {
      const gov = this.state.players.find(p => p.id === this.state.governmentLeaderId);
      if (gov) gov.governmentRounds++;
    }

    // Check for election
    const isElectionRound = this.state.round % this.config.electionCycle === 0;
    if (isElectionRound) {
      this.resolveElection();
    }

    // Check game end
    if (this.state.round >= this.config.totalRounds) {
      this.endGame();
      return;
    }

    // Advance to next round
    this.advanceToNextRound();
  }

  private executeAction(player: Player, action: PlayerAction): ActionResult {
    switch (action.type) {
      case 'campaign':
        return this.executeCampaign(player, action.targetState!);
      case 'propose_policy':
        return this.executeProposePolicy(player, action.policyId!);
      case 'attack_ad':
        return this.executeAttackAd(player, action.targetPlayerId!);
      case 'fundraise':
        return this.executeFundraise(player);
      case 'media_blitz':
        return this.executeMediaBlitz(player);
      case 'coalition_talk':
        return this.executeCoalitionTalk(player, action.targetPlayerId);
      default:
        return { playerId: player.id, action, success: false, description: 'Unknown action' };
    }
  }

  // ----------------------------------------------------------
  // Action executors
  // ----------------------------------------------------------

  private executeCampaign(player: Player, targetState: StateCode): ActionResult {
    const action: PlayerAction = { type: 'campaign', targetState };

    // Add campaign influence to the state
    const influenceGain = 10 + Math.floor(player.approval / 10);
    player.campaignInfluence[targetState] = (player.campaignInfluence[targetState] || 0) + influenceGain;

    // Voter satisfaction modifier
    let satisfactionBonus = 0;
    if (this.voterEngine && this.config.enableVoterGroups) {
      const nationalSat = this.voterEngine.getNationalSatisfaction();
      const isGovernment = this.state.governmentLeaderId === player.id;
      satisfactionBonus = isGovernment ? (nationalSat - 50) / 10 : (50 - nationalSat) / 10;
    }

    // Try to flip a marginal seat in the target state
    const stateSeats = Object.values(this.state.seats).filter(
      s => s.state === targetState && s.ownerPlayerId && s.ownerPlayerId !== player.id,
    );

    if (stateSeats.length === 0) {
      return {
        playerId: player.id, action, success: true,
        description: `Built campaign presence in ${targetState}.`,
      };
    }

    // Sort by margin (most marginal first)
    stateSeats.sort((a, b) => a.margin - b.margin);
    const targetSeat = stateSeats[0];

    // Success chance
    let chance = 30 + (player.approval / 4) + satisfactionBonus;
    if (this.checkIdeologyMatch(player, targetSeat)) chance += 12;
    if (targetSeat.margin < 25) chance += 15;
    chance = Math.max(10, Math.min(85, chance));

    const roll = this.rng.random() * 100;
    if (roll < chance) {
      const prevOwner = targetSeat.ownerPlayerId;
      transferSeat(this.state.seats, targetSeat.id, player.id);
      targetSeat.margin = 15 + this.rng.randomInt(0, 20);
      targetSeat.contested = true;
      targetSeat.lastCampaignedBy = player.id;

      player.approval = Math.min(100, player.approval + 2);
      player.totalSeatsWon++;

      const loser = this.state.players.find(p => p.id === prevOwner);
      if (loser) loser.totalSeatsLost++;

      this.syncPlayerSeatCounts();
      this.checkStateControlChanges();
      recomputeChamberPositions(this.state.seats, computePlayerSeatCounts(this.state.seats));

      this.logEvent({
        type: 'seat_captured', timestamp: Date.now(),
        seatId: targetSeat.id, seatName: targetSeat.name,
        fromPlayerId: prevOwner, toPlayerId: player.id,
      });

      return {
        playerId: player.id, action, success: true,
        description: `Won ${targetSeat.name} in ${targetState}!`,
        seatsCaptured: 1, approvalChange: 2,
      };
    }

    player.approval = Math.max(-100, player.approval - 1);
    return {
      playerId: player.id, action, success: true,
      description: `Campaigned in ${targetState}. Built influence but no seats flipped.`,
      approvalChange: -1,
    };
  }

  private executeProposePolicy(player: Player, policyId: string): ActionResult {
    const action: PlayerAction = { type: 'propose_policy', policyId };
    const policy = this.allPolicies.find(p => p.id === policyId);
    if (!policy) {
      return { playerId: player.id, action, success: false, description: 'Policy not found' };
    }

    // Check if already active
    if (this.state.activePolicies.some(ap => ap.policy.id === policyId)) {
      return { playerId: player.id, action, success: false, description: 'Policy already active' };
    }

    player.policiesProposed++;

    // Automatic chamber vote
    const voteResult = this.automaticPolicyVote(policy, player.id);

    this.state.policyHistory.push(voteResult);
    this.logEvent({ type: 'policy_voted', timestamp: Date.now(), result: voteResult });

    if (voteResult.passed) {
      player.policiesPassed++;

      // Add to active policies
      const activePolicy: ActivePolicy = {
        policy,
        proposerId: player.id,
        roundPassed: this.state.round,
        roundsRemaining: policy.isLandmark ? 8 : 5,
      };
      this.state.activePolicies.push(activePolicy);

      // Create economic effects
      if (this.economicEngine && this.config.enableEconomy) {
        for (const effect of policy.economicEffects) {
          this.activePolicyEffects.push({
            policyId: policy.id,
            effect,
            turnsRemaining: effect.duration,
            delayRemaining: effect.delay,
          });
        }
      }

      // Score policy alignment
      const alignment = this.computePolicyAlignmentScore(policy, player);
      player.policyScore += alignment * (policy.isLandmark ? 3 : 1);

      // Approval boost from passing legislation
      const approvalBoost = policy.isLandmark ? 4 : 2;
      player.approval = Math.min(100, player.approval + approvalBoost);

      return {
        playerId: player.id, action, success: true, policyPassed: true,
        description: `${policy.shortName} passed ${voteResult.supportSeats}-${voteResult.opposeSeats}!`,
        approvalChange: approvalBoost,
      };
    }

    // Failed to pass
    player.approval = Math.max(-100, player.approval - 2);
    return {
      playerId: player.id, action, success: true, policyPassed: false,
      description: `${policy.shortName} defeated ${voteResult.supportSeats}-${voteResult.opposeSeats}.`,
      approvalChange: -2,
    };
  }

  private executeAttackAd(player: Player, targetPlayerId: string): ActionResult {
    const action: PlayerAction = { type: 'attack_ad', targetPlayerId };
    const target = this.state.players.find(p => p.id === targetPlayerId);
    if (!target) {
      return { playerId: player.id, action, success: false, description: 'Target not found' };
    }

    const damage = 6 + this.rng.randomInt(0, 8);
    target.approval = Math.max(-100, target.approval - damage);

    this.logEvent({
      type: 'approval_changed', timestamp: Date.now(),
      playerId: target.id, delta: -damage, newApproval: target.approval,
      reason: `Attack ad from ${player.name}`,
    });

    // 20% backlash
    let backlash = 0;
    if (this.rng.random() < 0.2) {
      backlash = 3;
      player.approval = Math.max(-100, player.approval - backlash);
    }

    return {
      playerId: player.id, action, success: true,
      description: `Attack ads hit ${target.name} for -${damage} approval.${backlash ? ' Backlash: -3.' : ''}`,
      approvalChange: -damage,
    };
  }

  private executeFundraise(player: Player): ActionResult {
    const action: PlayerAction = { type: 'fundraise' };
    const amount = this.config.fundraiseAmount + Math.floor(player.seats / 10);
    player.funds += amount;

    // Small approval cost
    player.approval = Math.max(-100, player.approval - 1);

    this.logEvent({
      type: 'funds_changed', timestamp: Date.now(),
      playerId: player.id, delta: amount, newFunds: player.funds,
      reason: 'Fundraising',
    });

    return {
      playerId: player.id, action, success: true,
      description: `Raised $${amount} in campaign funds.`,
      fundsChange: amount, approvalChange: -1,
    };
  }

  private executeMediaBlitz(player: Player): ActionResult {
    const action: PlayerAction = { type: 'media_blitz' };
    const boost = 6 + this.rng.randomInt(0, 6);
    player.approval = Math.min(100, player.approval + boost);

    this.logEvent({
      type: 'approval_changed', timestamp: Date.now(),
      playerId: player.id, delta: boost, newApproval: player.approval,
      reason: 'Media blitz',
    });

    return {
      playerId: player.id, action, success: true,
      description: `Media blitz boosted approval by +${boost}.`,
      approvalChange: boost,
    };
  }

  private executeCoalitionTalk(player: Player, targetPlayerId?: string): ActionResult {
    const action: PlayerAction = { type: 'coalition_talk', targetPlayerId };

    // Coalition talks provide small approval boost and build goodwill
    const boost = 3 + this.rng.randomInt(0, 3);
    player.approval = Math.min(100, player.approval + boost);

    if (targetPlayerId) {
      const target = this.state.players.find(p => p.id === targetPlayerId);
      if (target) {
        target.approval = Math.min(100, target.approval + 1);
      }
    }

    return {
      playerId: player.id, action, success: true,
      description: `Coalition building. Approval +${boost}.`,
      approvalChange: boost,
    };
  }

  // ----------------------------------------------------------
  // Automatic policy vote
  // ----------------------------------------------------------

  private automaticPolicyVote(policy: Policy, proposerId: string): PolicyVoteResult {
    let supportSeats = 0;
    let opposeSeats = 0;
    let totalSeats = 0;

    for (const seat of Object.values(this.state.seats)) {
      if (!seat.ownerPlayerId) continue;
      totalSeats++;

      const ideologyAlignment = this.computeSeatPolicyAlignment(seat, policy);

      // Party loyalty factor
      let loyalty = 0;
      if (seat.ownerPlayerId === proposerId) {
        loyalty = 0.6; // Strong party discipline
      } else if (seat.ownerPlayerId === this.state.governmentLeaderId && proposerId === this.state.governmentLeaderId) {
        loyalty = 0.4; // Government backbench
      } else {
        loyalty = -0.2; // Opposition lean
      }

      const voteScore = loyalty + ideologyAlignment * 0.5;

      // Add small randomness
      const noise = (this.rng.random() - 0.5) * 0.15;

      if (voteScore + noise > 0) {
        supportSeats++;
      } else {
        opposeSeats++;
      }
    }

    return {
      policyId: policy.id,
      policyName: policy.shortName,
      proposerId,
      passed: supportSeats > opposeSeats,
      supportSeats,
      opposeSeats,
      totalSeats,
    };
  }

  private computeSeatPolicyAlignment(seat: Seat, policy: Policy): number {
    let score = 0;

    // Social alignment
    if (seat.ideology.social === 'PROG') {
      if (policy.stanceTable.progressive === 'favoured') score += 1;
      else if (policy.stanceTable.progressive === 'opposed') score -= 1;
    } else if (seat.ideology.social === 'CONS') {
      if (policy.stanceTable.conservative === 'favoured') score += 1;
      else if (policy.stanceTable.conservative === 'opposed') score -= 1;
    }

    // Economic alignment
    if (seat.ideology.econ === 'RIGHT') {
      if (policy.stanceTable.market === 'favoured') score += 1;
      else if (policy.stanceTable.market === 'opposed') score -= 1;
    } else if (seat.ideology.econ === 'LEFT') {
      if (policy.stanceTable.interventionist === 'favoured') score += 1;
      else if (policy.stanceTable.interventionist === 'opposed') score -= 1;
    }

    return score / 2; // Normalize to [-1, 1]
  }

  computePolicyAlignmentScore(policy: Policy, player: Player): number {
    let score = 0;

    const socialStance = player.socialIdeology === 'progressive'
      ? policy.stanceTable.progressive
      : policy.stanceTable.conservative;
    const econStance = player.economicIdeology === 'market'
      ? policy.stanceTable.market
      : policy.stanceTable.interventionist;

    if (socialStance === 'favoured') score += 1;
    else if (socialStance === 'opposed') score -= 1;
    if (econStance === 'favoured') score += 1;
    else if (econStance === 'opposed') score -= 1;

    return score; // Range: -2 to 2
  }

  // ----------------------------------------------------------
  // Election system
  // ----------------------------------------------------------

  private resolveElection(): void {
    const seatChanges: ElectionResult['seatChanges'] = [];

    // For each seat, determine if it flips based on campaign influence,
    // voter satisfaction, and approval ratings
    for (const seat of Object.values(this.state.seats)) {
      if (!seat.ownerPlayerId) continue;

      const currentOwner = this.state.players.find(p => p.id === seat.ownerPlayerId);
      if (!currentOwner) continue;

      // Calculate retention score for current owner
      let retentionScore = seat.margin * 0.3; // Incumbency advantage from margin
      retentionScore += (currentOwner.approval + 100) / 200 * 20; // Approval 0-20
      retentionScore += (currentOwner.campaignInfluence[seat.state] || 0) * 0.2;

      // Check each challenger
      let bestChallenger: Player | null = null;
      let bestChallengeScore = 0;

      for (const challenger of this.state.players) {
        if (challenger.id === currentOwner.id) continue;

        let score = 0;
        score += (challenger.approval + 100) / 200 * 20; // Approval 0-20
        score += (challenger.campaignInfluence[seat.state] || 0) * 0.3;
        if (this.checkIdeologyMatch(challenger, seat)) score += 8;

        // Voter satisfaction swing
        if (this.voterEngine) {
          const nationalSat = this.voterEngine.getNationalSatisfaction();
          const isGovIncumbent = this.state.governmentLeaderId === currentOwner.id;
          if (isGovIncumbent && nationalSat < 45) {
            score += (45 - nationalSat) * 0.3; // Anti-incumbent swing
          }
        }

        // Random factor
        score += this.rng.random() * 8;

        if (score > bestChallengeScore) {
          bestChallengeScore = score;
          bestChallenger = challenger;
        }
      }

      // Seat flips if challenger score beats retention + threshold
      const flipThreshold = 5;
      if (bestChallenger && bestChallengeScore > retentionScore + flipThreshold) {
        const oldOwner = seat.ownerPlayerId;
        transferSeat(this.state.seats, seat.id, bestChallenger.id);
        seat.margin = 10 + this.rng.randomInt(0, 15);
        seat.contested = true;

        bestChallenger.totalSeatsWon++;
        if (currentOwner) currentOwner.totalSeatsLost++;

        seatChanges.push({
          seatId: seat.id,
          oldOwner,
          newOwner: bestChallenger.id,
        });
      }
    }

    // Sync everything
    this.syncPlayerSeatCounts();
    this.checkStateControlChanges();
    recomputeChamberPositions(this.state.seats, computePlayerSeatCounts(this.state.seats));

    // Update government
    this.updateGovernmentLeader();

    // Compute national swing
    const nationalSwing: Record<string, number> = {};
    for (const player of this.state.players) {
      const gained = seatChanges.filter(c => c.newOwner === player.id).length;
      const lost = seatChanges.filter(c => c.oldOwner === player.id).length;
      nationalSwing[player.id] = gained - lost;
    }

    const electionResult: ElectionResult = {
      round: this.state.round,
      seatChanges,
      governmentLeaderId: this.state.governmentLeaderId,
      nationalSwing,
    };

    this.state.electionHistory.push(electionResult);
    this.logEvent({ type: 'election_held', timestamp: Date.now(), result: electionResult });

    // Reset campaign influence after election
    for (const player of this.state.players) {
      for (const st of ALL_STATES) {
        player.campaignInfluence[st] = Math.floor((player.campaignInfluence[st] || 0) * 0.3);
      }
    }

    // Decay active policy durations
    this.state.activePolicies = this.state.activePolicies.filter(ap => {
      ap.roundsRemaining--;
      return ap.roundsRemaining > 0;
    });
  }

  // ----------------------------------------------------------
  // Economy
  // ----------------------------------------------------------

  private tickEconomy(): void {
    if (!this.economicEngine || !this.config.enableEconomy) return;

    const newState = this.economicEngine.tick(this.activePolicyEffects);
    this.state.economy = newState;
    this.state.economyHistory.push({
      ...newState,
      sectors: { ...newState.sectors },
    });

    this.logEvent({
      type: 'economic_update',
      timestamp: Date.now(),
      economy: { ...newState, sectors: { ...newState.sectors } },
    });

    // Update voter satisfaction
    if (this.voterEngine && this.config.enableVoterGroups) {
      const economicValues = this.flattenEconomicState(this.state.economy);
      this.voterEngine.updateSatisfaction(economicValues);

      // Populate voter group summaries with party leanings
      const summaries = this.voterEngine.getGroupSummaries();
      const parties = this.buildPartyProfiles();
      if (parties.length > 0) {
        const voteShares = this.voterEngine.calculateVoteShares(parties);
        for (const summary of summaries) {
          let maxShare = 0;
          let leaningId: string | null = null;
          for (const [partyId, shares] of Object.entries(voteShares)) {
            const share = shares[summary.id] ?? 0;
            if (share > maxShare) {
              maxShare = share;
              leaningId = partyId;
            }
          }
          summary.leaningPartyId = leaningId;
        }
      }
      this.state.voterGroups = summaries;
    }

    // Clean up expired policy effects
    this.activePolicyEffects = this.activePolicyEffects.filter(
      e => e.delayRemaining > 0 || e.turnsRemaining > 0,
    );
  }

  private flattenEconomicState(econ: EconomicStateData): Record<string, number> {
    return {
      gdpGrowth: econ.gdpGrowth,
      unemployment: econ.unemployment,
      inflation: econ.inflation,
      publicDebt: econ.publicDebt,
      budgetBalance: econ.budgetBalance,
      consumerConfidence: econ.consumerConfidence,
      businessConfidence: econ.businessConfidence,
      interestRate: econ.interestRate,
      ...econ.sectors,
    };
  }

  private buildPartyProfiles(): PartyProfile[] {
    const total = this.state.players.reduce((s, p) => s + p.seats, 0) || 1;
    const sorted = [...this.state.players].sort((a, b) => b.seats - a.seats);

    return sorted.map((p, i) => ({
      id: p.id,
      socialPosition: p.socialIdeology === 'progressive' ? 0.4 : -0.4,
      economicPosition: p.economicIdeology === 'interventionist' ? 0.4 : -0.4,
      isGovernment: i === 0,
      isMainOpposition: i === 1,
      seatShare: p.seats / total,
    }));
  }

  // ----------------------------------------------------------
  // Events
  // ----------------------------------------------------------

  private applyEventEffects(event: PoliticalEvent): void {
    for (const effect of event.effects) {
      const targets = this.resolveEventTargets(effect.target);

      for (const target of targets) {
        switch (effect.type) {
          case 'approval':
            target.approval = Math.max(-100, Math.min(100, target.approval + effect.amount));
            this.logEvent({
              type: 'approval_changed', timestamp: Date.now(),
              playerId: target.id, delta: effect.amount, newApproval: target.approval,
              reason: `Event: ${event.name}`,
            });
            break;
          case 'funds':
            target.funds = Math.max(0, target.funds + effect.amount);
            this.logEvent({
              type: 'funds_changed', timestamp: Date.now(),
              playerId: target.id, delta: effect.amount, newFunds: target.funds,
              reason: `Event: ${event.name}`,
            });
            break;
          case 'seats':
            if (effect.amount > 0) {
              this.gainRandomSeats(target.id, effect.amount);
            } else if (effect.amount < 0) {
              this.loseRandomSeats(target.id, Math.abs(effect.amount));
            }
            this.syncPlayerSeatCounts();
            this.checkStateControlChanges();
            recomputeChamberPositions(this.state.seats, computePlayerSeatCounts(this.state.seats));
            break;
        }
      }
    }
  }

  private resolveEventTargets(target: EventEffect['target']): Player[] {
    switch (target) {
      case 'leader': {
        const leader = this.getSeatLeader();
        return leader ? [leader] : [];
      }
      case 'trailer': {
        if (this.state.players.length === 0) return [];
        const sorted = [...this.state.players].sort((a, b) => a.seats - b.seats);
        return [sorted[0]];
      }
      case 'all':
        return [...this.state.players];
      case 'random':
        return this.state.players.length > 0 ? [this.rng.pick(this.state.players)] : [];
      case 'government': {
        const gov = this.state.players.find(p => p.id === this.state.governmentLeaderId);
        return gov ? [gov] : [];
      }
      default:
        return [];
    }
  }

  // ----------------------------------------------------------
  // AI
  // ----------------------------------------------------------

  private processAIActions(): void {
    for (const player of this.state.players) {
      if (!player.isAI || player.submittedActions) continue;

      const actions = this.generateAIActions(player);
      this.submitActions(player.id, actions);
    }
  }

  private generateAIActions(player: Player): PlayerAction[] {
    const actions: PlayerAction[] = [];
    const maxActions = this.config.actionsPerRound;
    let remainingFunds = player.funds;

    // Simple AI: strategy-weighted action selection
    const weights = this.getStrategyWeights(player.aiStrategy || 'pragmatist');

    for (let i = 0; i < maxActions; i++) {
      const action = this.pickAIAction(player, weights, remainingFunds, actions);
      if (action) {
        actions.push(action);
        remainingFunds -= this.getActionCost(action.type).funds;
      }
    }

    return actions;
  }

  private getStrategyWeights(strategy: AIStrategy): Record<ActionType, number> {
    switch (strategy) {
      case 'campaigner':
        return { campaign: 2.0, propose_policy: 0.5, attack_ad: 1.5, fundraise: 1.0, media_blitz: 0.8, coalition_talk: 0.3 };
      case 'policy_wonk':
        return { campaign: 0.8, propose_policy: 2.5, attack_ad: 0.3, fundraise: 0.8, media_blitz: 0.5, coalition_talk: 1.0 };
      case 'populist':
        return { campaign: 1.2, propose_policy: 1.5, attack_ad: 1.0, fundraise: 0.8, media_blitz: 1.5, coalition_talk: 0.5 };
      case 'pragmatist':
      default:
        return { campaign: 1.2, propose_policy: 1.2, attack_ad: 1.0, fundraise: 1.0, media_blitz: 1.0, coalition_talk: 0.8 };
    }
  }

  private pickAIAction(
    player: Player,
    weights: Record<ActionType, number>,
    remainingFunds: number,
    alreadyChosen: PlayerAction[],
  ): PlayerAction | null {
    const candidates: { action: PlayerAction; utility: number }[] = [];
    const noise = this.config.aiDifficulty === 'easy' ? 0.3
                : this.config.aiDifficulty === 'hard' ? 0.05 : 0.15;

    // Campaign
    if (remainingFunds >= this.config.campaignCost) {
      const bestState = this.getBestCampaignState(player);
      if (bestState) {
        candidates.push({
          action: { type: 'campaign', targetState: bestState },
          utility: weights.campaign * (1 + (this.rng.random() - 0.5) * noise * 2),
        });
      }
    }

    // Propose policy
    const alreadyProposed = alreadyChosen.filter(a => a.type === 'propose_policy').map(a => a.policyId);
    const activeIds = this.state.activePolicies.map(ap => ap.policy.id);
    const availablePolicies = this.allPolicies.filter(
      p => !activeIds.includes(p.id) && !alreadyProposed.includes(p.id),
    );
    if (availablePolicies.length > 0) {
      // Pick best-aligned policy
      const scored = availablePolicies.map(p => ({
        policy: p,
        score: this.computePolicyAlignmentScore(p, player),
      })).sort((a, b) => b.score - a.score);
      const bestPolicy = scored[0].policy;

      candidates.push({
        action: { type: 'propose_policy', policyId: bestPolicy.id },
        utility: weights.propose_policy * (1 + (this.rng.random() - 0.5) * noise * 2),
      });
    }

    // Attack ad
    if (remainingFunds >= this.config.attackAdCost) {
      const opponents = this.state.players.filter(p => p.id !== player.id);
      if (opponents.length > 0) {
        // Target the closest competitor
        opponents.sort((a, b) => b.seats - a.seats);
        candidates.push({
          action: { type: 'attack_ad', targetPlayerId: opponents[0].id },
          utility: weights.attack_ad * (1 + (this.rng.random() - 0.5) * noise * 2),
        });
      }
    }

    // Fundraise
    candidates.push({
      action: { type: 'fundraise' },
      utility: weights.fundraise * (remainingFunds < 15 ? 1.5 : 0.8) * (1 + (this.rng.random() - 0.5) * noise * 2),
    });

    // Media blitz
    if (remainingFunds >= this.config.mediaBlitzCost) {
      candidates.push({
        action: { type: 'media_blitz' },
        utility: weights.media_blitz * (player.approval < 30 ? 1.5 : 0.8) * (1 + (this.rng.random() - 0.5) * noise * 2),
      });
    }

    // Coalition talk
    if (remainingFunds >= this.config.coalitionTalkCost) {
      candidates.push({
        action: { type: 'coalition_talk' },
        utility: weights.coalition_talk * (1 + (this.rng.random() - 0.5) * noise * 2),
      });
    }

    if (candidates.length === 0) return null;

    // Pick highest utility
    candidates.sort((a, b) => b.utility - a.utility);
    return candidates[0].action;
  }

  private getBestCampaignState(player: Player): StateCode | null {
    let bestState: StateCode | null = null;
    let bestScore = -Infinity;

    for (const state of ALL_STATES) {
      const stateSeats = Object.values(this.state.seats).filter(s => s.state === state);
      const contestable = stateSeats.filter(
        s => s.ownerPlayerId && s.ownerPlayerId !== player.id,
      );
      if (contestable.length === 0) continue;

      const avgMargin = contestable.reduce((sum, s) => sum + s.margin, 0) / contestable.length;
      const myInfluence = player.campaignInfluence[state] || 0;

      // Prefer states with many contestable, low-margin seats and low existing influence
      const score = contestable.length * 3 + (100 - avgMargin) * 0.5 - myInfluence * 0.1;
      if (score > bestScore) {
        bestScore = score;
        bestState = state;
      }
    }

    return bestState;
  }

  // ----------------------------------------------------------
  // Round transition
  // ----------------------------------------------------------

  private advanceToNextRound(): void {
    this.state.round++;

    // Clear round state
    this.state.roundActions = {};
    this.state.currentEvent = null;
    for (const player of this.state.players) {
      player.submittedActions = false;
    }

    this.logEvent({ type: 'round_started', timestamp: Date.now(), round: this.state.round });

    // Distribute income
    this.distributeIncome();

    // Enter planning phase
    this.setPhase('planning');

    // AI immediately submits
    this.processAIActions();
  }

  private distributeIncome(): void {
    for (const player of this.state.players) {
      const income = Math.max(5, this.config.incomePerSeat * player.seats);
      player.funds += income;

      this.logEvent({
        type: 'funds_changed', timestamp: Date.now(),
        playerId: player.id, delta: income, newFunds: player.funds,
        reason: `Income: ${this.config.incomePerSeat}/seat x ${player.seats} seats (min 5)`,
      });
    }
  }

  // ----------------------------------------------------------
  // Game end & scoring
  // ----------------------------------------------------------

  private endGame(): void {
    const scores = this.computeScores();
    this.state.finalScores = scores;

    // Winner is highest total score
    const sorted = [...scores].sort((a, b) => b.total - a.total);
    const winner = sorted[0];
    this.state.winner = winner.playerId;

    this.setPhase('game_over');

    this.logEvent({
      type: 'game_ended',
      timestamp: Date.now(),
      winner: winner.playerId,
      scores,
    });
  }

  private computeScores(): PlayerScore[] {
    return this.state.players.map(player => {
      // Seat score: 2 points per seat
      const seatScore = player.seats * 2;

      // Policy alignment: accumulated from passed policies
      const policyAlignment = Math.round(player.policyScore * 10) / 10;

      // Economic performance: bonus for government leader based on economy
      let economicPerformance = 0;
      if (player.governmentRounds > 0) {
        const econ = this.state.economy;
        if (econ.gdpGrowth > 2.5) economicPerformance += 5;
        else if (econ.gdpGrowth < 1) economicPerformance -= 3;

        if (econ.unemployment < 5) economicPerformance += 4;
        else if (econ.unemployment > 7) economicPerformance -= 3;

        if (econ.inflation >= 1 && econ.inflation <= 3) economicPerformance += 3;
        else if (econ.inflation > 5) economicPerformance -= 3;

        if (econ.consumerConfidence > 55) economicPerformance += 2;
      }

      return {
        playerId: player.id,
        seats: seatScore,
        policyAlignment,
        economicPerformance,
        total: seatScore + policyAlignment + economicPerformance,
      };
    });
  }

  // ----------------------------------------------------------
  // Force advance (host override)
  // ----------------------------------------------------------

  forceAdvancePhase(): boolean {
    if (this.state.phase === 'planning') {
      // Auto-submit empty actions for anyone who hasn't submitted
      for (const player of this.state.players) {
        if (!player.submittedActions) {
          this.state.roundActions[player.id] = [];
          player.submittedActions = true;
        }
      }
      this.resolveRound();
      return true;
    }
    if (this.state.phase === 'resolution') {
      // Auto-advance past resolution display
      if (this.state.round >= this.config.totalRounds) {
        this.endGame();
      } else {
        this.advanceToNextRound();
      }
      return true;
    }
    return false;
  }

  // ----------------------------------------------------------
  // Utility methods
  // ----------------------------------------------------------

  private setPhase(phase: Phase): void {
    const old = this.state.phase;
    this.state.phase = phase;
    if (old !== phase) {
      this.logEvent({ type: 'phase_changed', timestamp: Date.now(), fromPhase: old, toPhase: phase });
    }
  }

  private logEvent(event: GameEvent): void {
    this.state.eventLog.push(event);
  }

  private syncPlayerSeatCounts(): void {
    const counts = computePlayerSeatCounts(this.state.seats);
    for (const player of this.state.players) {
      player.seats = counts[player.id] || 0;
    }
  }

  private getSeatLeader(): Player | null {
    if (this.state.players.length === 0) return null;
    return [...this.state.players].sort((a, b) => b.seats - a.seats)[0];
  }

  private updateGovernmentLeader(): void {
    const leader = this.getSeatLeader();
    const oldLeader = this.state.governmentLeaderId;
    this.state.governmentLeaderId = leader?.id || null;

    if (leader && leader.id !== oldLeader) {
      this.logEvent({
        type: 'government_formed', timestamp: Date.now(),
        leaderId: leader.id, seats: leader.seats,
      });
    }
  }

  private checkIdeologyMatch(player: Player, seat: Seat): boolean {
    const econMatch =
      (player.economicIdeology === 'market' && seat.ideology.econ === 'RIGHT') ||
      (player.economicIdeology === 'interventionist' && seat.ideology.econ === 'LEFT');
    const socialMatch =
      (player.socialIdeology === 'progressive' && seat.ideology.social === 'PROG') ||
      (player.socialIdeology === 'conservative' && seat.ideology.social === 'CONS');
    return econMatch || socialMatch;
  }

  private checkStateControlChanges(): void {
    const oldControl = this.state.stateControl;
    const newControl = computeStateControl(this.state.seats);
    const changes = compareStateControl(oldControl, newControl);

    for (const { playerId, state } of changes.gained) {
      this.logEvent({
        type: 'state_control_changed', timestamp: Date.now(),
        state, oldController: oldControl[state]?.controllerId || null, newController: playerId,
      });
    }
    for (const { playerId, state } of changes.lost) {
      this.logEvent({
        type: 'state_control_changed', timestamp: Date.now(),
        state, oldController: playerId, newController: newControl[state]?.controllerId || null,
      });
    }

    this.state.stateControl = newControl;
  }

  private gainRandomSeats(playerId: string, amount: number): void {
    const available = Object.values(this.state.seats).filter(
      s => s.ownerPlayerId && s.ownerPlayerId !== playerId,
    );
    const shuffled = this.rng.shuffle([...available]);
    const toGain = Math.min(amount, shuffled.length);

    for (let i = 0; i < toGain; i++) {
      transferSeat(this.state.seats, shuffled[i].id, playerId);
    }
  }

  private loseRandomSeats(playerId: string, amount: number): void {
    const owned = Object.values(this.state.seats).filter(s => s.ownerPlayerId === playerId);
    const shuffled = this.rng.shuffle([...owned]);
    const toLose = Math.min(amount, shuffled.length);
    const opponents = this.state.players.filter(p => p.id !== playerId);

    for (let i = 0; i < toLose; i++) {
      if (opponents.length > 0) {
        const recipient = opponents[i % opponents.length];
        transferSeat(this.state.seats, shuffled[i].id, recipient.id);
      }
    }
  }
}
