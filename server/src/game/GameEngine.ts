// ============================================================
// THE HOUSE - Australian Political Strategy Game
// GameEngine: Action-based gameplay system (replaces card-based)
// ============================================================

import {
  GameState, GameConfig, Player, Issue, Phase, ActionType,
  GameEvent, SocialIdeology, EconomicIdeology, ChatMessage,
  HistorySnapshot, BillResult, PartyColorId, PARTY_COLORS,
  Seat, SeatId, StateCode, StateControl, EconomicStateData, VoterGroupState,
  Bill, PoliticalEvent, EventEffect,
  PlayerAction, ActionResult, ActionCost,
  PendingLegislation, LegislationVote,
} from '../types';
import { SeededRNG } from './rng';
import {
  generateSeatMap, computePlayerSeatCounts, recomputeChamberPositions,
  transferSeat, getPlayerSeats, computeStateControl, compareStateControl,
} from './mapGen';
import { getAllBills } from './bills';
import { getAllEvents } from './events';
import { EconomicEngine, ActiveEffect } from './economicEngine';
import { VoterEngine, PartyProfile } from './voterEngine';

// ============================================================
// CONSTANTS
// ============================================================

const ISSUES: Issue[] = ['economy', 'health', 'housing', 'climate', 'security', 'education'];

const DEFAULT_CONFIG: GameConfig = {
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

// ============================================================
// GAME ENGINE
// ============================================================

export class GameEngine {
  private state: GameState;
  private config: GameConfig;
  private rng: SeededRNG;
  private allBills: Bill[];
  private allEvents: PoliticalEvent[];
  private currentRoundBillResult: BillResult | null = null;
  private economicEngine: EconomicEngine | null = null;
  private voterEngine: VoterEngine | null = null;
  private activePolicyEffects: ActiveEffect[] = [];

  constructor(roomId: string, config: Partial<GameConfig> = {}, seed?: string) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rng = new SeededRNG(seed);
    this.allBills = getAllBills();
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
      maxRounds: this.config.maxRounds,

      players: [],
      turnOrder: [],
      currentPlayerIndex: 0,
      speakerIndex: 0,

      totalSeats: this.config.totalSeats,
      seats: {},
      stateControl: {} as Record<StateCode, StateControl>,
      activeIssue: 'economy',

      nationalBudget: 0,
      budgetSurplus: false,

      availableBills: [],
      pendingLegislation: null,
      passedBills: [],
      failedBills: [],

      currentEvent: null,
      pastEvents: [],

      playersActed: [],
      roundActions: [],

      eventLog: [],
      chatMessages: [],
      history: [],

      winner: null,
      finalScores: null,

      takenColors: [],

      // Economy + voter data (initialized properly on game start)
      economy: {
        gdpGrowth: 2.5, unemployment: 5.0, inflation: 2.0,
        publicDebt: 60, budgetBalance: 0,
        consumerConfidence: 50, businessConfidence: 50, interestRate: 3.0,
        sectors: {
          manufacturing: 50, services: 50, finance: 50, technology: 50,
          healthcare: 50, education: 50, housing: 50, energy: 50, agriculture: 50,
        },
      },
      voterGroups: [],
    };
  }

  // ----------------------------------------------------------
  // Public accessors
  // ----------------------------------------------------------

  getState(): GameState {
    return { ...this.state };
  }

  getConfig(): GameConfig {
    return { ...this.config };
  }

  getAvailableColors(): PartyColorId[] {
    const allColorIds = PARTY_COLORS.map(c => c.id) as PartyColorId[];
    return allColorIds.filter(id => !this.state.takenColors.includes(id));
  }

  getEventLog(): GameEvent[] {
    return [...this.state.eventLog];
  }

  // ----------------------------------------------------------
  // Lobby management
  // ----------------------------------------------------------

  addPlayer(
    id: string,
    playerName: string,
    partyName: string,
    colorId?: PartyColorId,
    symbolId?: string,
    socialIdeology?: SocialIdeology,
    economicIdeology?: EconomicIdeology,
  ): Player | null {
    if (this.state.phase !== 'waiting') return null;
    if (this.state.players.length >= 5) return null;
    if (this.state.players.find(p => p.id === id)) return null;

    // Resolve colour
    const availableColors = this.getAvailableColors();
    const finalColorId: PartyColorId =
      colorId && !this.state.takenColors.includes(colorId) ? colorId : availableColors[0];
    if (!finalColorId) return null;
    this.state.takenColors.push(finalColorId);

    const colorEntry = PARTY_COLORS.find(c => c.id === finalColorId);
    const colorHex = colorEntry?.hex || '#666666';

    const finalSymbolId = symbolId || 'landmark';
    const finalSocial: SocialIdeology = socialIdeology || 'progressive';
    const finalEconomic: EconomicIdeology = economicIdeology || 'market';

    const isHost = this.state.players.length === 0;

    const player: Player = {
      id,
      name: partyName || `Party ${this.state.players.length + 1}`,
      playerName: playerName || `Player ${this.state.players.length + 1}`,
      colorId: finalColorId,
      color: colorHex,
      symbolId: finalSymbolId,
      socialIdeology: finalSocial,
      economicIdeology: finalEconomic,
      seats: 0,
      funds: 0,
      approval: this.config.startingApproval,
      pcap: 0,
      actionPoints: 0,
      maxActionPoints: this.config.actionPointsPerRound,
      connected: true,
      isHost,
      actionsThisRound: [],
      hasProposed: false,
      hasVoted: false,
      totalSeatsWon: 0,
      totalSeatsLost: 0,
      billsProposed: 0,
      billsPassed: 0,
      campaignsRun: 0,
    };

    this.state.players.push(player);

    this.logEvent({
      type: 'player_joined',
      timestamp: Date.now(),
      playerId: id,
      playerName: player.playerName,
      partyName: player.name,
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

      // Reassign host if the removed player was host
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

  // ----------------------------------------------------------
  // Game start
  // ----------------------------------------------------------

  startGame(): boolean {
    if (this.state.phase !== 'waiting' || this.state.players.length < 2) return false;

    const playerIds = this.state.players.map(p => p.id);

    // Generate the Australian electoral seat map
    this.state.seats = generateSeatMap({
      seatCount: this.config.totalSeats,
      seed: this.rng.getSeed(),
      playerIds,
      ideologyMode: this.config.seatIdeologyMode,
    });

    // Initialize economic engine
    if (this.config.enableEconomy) {
      this.economicEngine = new EconomicEngine({
        policyStrength: this.config.economicVolatility,
        seed: this.rng.getSeed(),
      });
      this.state.economy = this.economicEngine.getState();
    }

    // Initialize voter engine
    if (this.config.enableVoterGroups) {
      this.voterEngine = new VoterEngine(this.rng.getSeed());
      const economicValues = this.flattenEconomicState(this.state.economy);
      this.voterEngine.updateSatisfaction(economicValues);
      this.state.voterGroups = this.voterEngine.getGroupSummaries();
    }

    // Distribute starting funds and approval
    for (const player of this.state.players) {
      player.funds = this.config.startingFunds;
      player.approval = this.config.startingApproval;
    }

    // Sync seat counts from the authoritative seat map
    this.syncPlayerSeatCounts();

    // Shuffle turn order
    this.state.turnOrder = this.rng.shuffle([...playerIds]);
    this.state.speakerIndex = 0;

    // Generate initial bill pool from the full bill catalogue
    const shuffledBills = this.rng.shuffle([...this.allBills]);
    this.state.availableBills = shuffledBills.slice(0, this.config.billPoolSize);

    // Compute initial state control
    this.state.stateControl = computeStateControl(this.state.seats);

    // Pick the active issue for round 1
    this.state.activeIssue = this.rng.pick(ISSUES);

    // Begin round 1
    this.state.round = 1;

    this.logEvent({
      type: 'game_started',
      timestamp: Date.now(),
      seed: this.rng.getSeed(),
      config: JSON.stringify(this.config),
    });

    this.logEvent({
      type: 'round_started',
      timestamp: Date.now(),
      round: 1,
      activeIssue: this.state.activeIssue,
    });

    // Enter budget phase (which will auto-advance to action)
    this.setPhase('budget');
    this.distributeBudget();

    return true;
  }

  // ----------------------------------------------------------
  // Budget phase
  // ----------------------------------------------------------

  private distributeBudget(): void {
    const amounts: Record<string, number> = {};

    for (const player of this.state.players) {
      const income = Math.max(5, this.config.incomePerSeat * player.seats);
      player.funds += income;
      amounts[player.id] = income;

      this.logEvent({
        type: 'funds_changed',
        timestamp: Date.now(),
        playerId: player.id,
        delta: income,
        newFunds: player.funds,
        reason: `Budget: ${this.config.incomePerSeat}/seat x ${player.seats} seats (min 5)`,
      });
    }

    this.logEvent({
      type: 'budget_distributed',
      timestamp: Date.now(),
      amounts,
    });

    // Reset action-phase tracking for every player
    for (const player of this.state.players) {
      player.actionPoints = this.config.actionPointsPerRound;
      player.maxActionPoints = this.config.actionPointsPerRound;
      player.actionsThisRound = [];
      player.hasProposed = false;
      player.hasVoted = false;
    }
    this.state.playersActed = [];
    this.state.roundActions = [];
    this.state.currentPlayerIndex = 0;
    this.currentRoundBillResult = null;

    // Advance to action phase
    this.setPhase('action');
  }

  // ----------------------------------------------------------
  // Action phase
  // ----------------------------------------------------------

  performAction(
    playerId: string,
    actionType: ActionType,
    targetSeatId?: string,
    targetPlayerId?: string,
    fundsSpent?: number,
  ): boolean {
    if (this.state.phase !== 'action') return false;

    // Must be this player's turn
    const currentTurnPlayerId = this.state.turnOrder[this.state.currentPlayerIndex];
    if (currentTurnPlayerId !== playerId) return false;

    const player = this.state.players.find(p => p.id === playerId);
    if (!player) return false;
    if (player.actionPoints < 1) return false;

    // Validate funds
    const cost = this.getActionCost(actionType);
    if (player.funds < cost.funds) return false;

    // Execute the action
    let result: ActionResult;

    switch (actionType) {
      case 'campaign':
        result = this.executeCampaignAction(player, targetSeatId);
        break;
      case 'policy_speech':
        result = this.executePolicySpeech(player);
        break;
      case 'attack_ad':
        result = this.executeAttackAd(player, targetPlayerId);
        break;
      case 'fundraise':
        result = this.executeFundraise(player);
        break;
      case 'media_blitz':
        result = this.executeMediaBlitz(player);
        break;
      case 'pork_barrel':
        result = this.executePorkBarrel(player, targetSeatId);
        break;
      default:
        return false;
    }

    // A result with success === false from validation means the action was rejected
    if (!result.success && result.message !== '') {
      // Still counts if it was a failed campaign roll -- but not if input was invalid.
      // Campaign rolls that fail in-game still return success:false but we should
      // still deduct AP / funds for those. We differentiate by checking seatCaptured
      // being explicitly set (even to false) versus undefined.
      const isRolledCampaignFailure = actionType === 'campaign' && result.seatCaptured === false;
      if (!isRolledCampaignFailure) {
        return false;
      }
    }

    // Deduct AP and funds
    player.actionPoints -= 1;
    player.funds -= cost.funds;

    // Record the action
    const action: PlayerAction = {
      type: actionType,
      playerId,
      targetSeatId,
      targetPlayerId,
      fundsSpent: cost.funds,
      result,
      timestamp: Date.now(),
    };

    player.actionsThisRound.push(action);
    this.state.roundActions.push(action);

    this.logEvent({
      type: 'action_performed',
      timestamp: Date.now(),
      action,
    });

    // Auto-advance turn when AP exhausted
    if (player.actionPoints <= 0) {
      this.advancePlayerTurn(playerId);
    }

    return true;
  }

  private getActionCost(actionType: ActionType): ActionCost {
    switch (actionType) {
      case 'campaign':
        return { ap: 1, funds: this.config.campaignBaseCost, description: 'Campaign for a seat' };
      case 'policy_speech':
        return { ap: 1, funds: 0, description: 'Give a policy speech' };
      case 'attack_ad':
        return { ap: 1, funds: this.config.attackAdCost, description: 'Run attack ads against an opponent' };
      case 'fundraise':
        return { ap: 1, funds: 0, description: 'Fundraise' };
      case 'media_blitz':
        return { ap: 1, funds: this.config.mediaBlitzCost, description: 'Launch a media blitz' };
      case 'pork_barrel':
        return { ap: 1, funds: this.config.porkBarrelCost, description: 'Pork barrel spending in a state' };
      default:
        return { ap: 1, funds: 0, description: '' };
    }
  }

  // ----------------------------------------------------------
  // Action executors
  // ----------------------------------------------------------

  /**
   * CAMPAIGN - attempt to win an opponent's seat.
   *
   * Success chance = baseChance + (approval/3) + ideologyBonus + marginBonus
   * clamped to [10, 90].
   */
  private executeCampaignAction(player: Player, targetSeatId?: string): ActionResult {
    if (!targetSeatId) {
      return { success: false, message: 'No target seat specified' };
    }

    const seat = this.state.seats[targetSeatId];
    if (!seat) {
      return { success: false, message: 'Invalid seat' };
    }
    if (seat.ownerPlayerId === player.id) {
      return { success: false, message: 'You already own this seat' };
    }
    if (!seat.ownerPlayerId) {
      return { success: false, message: 'Seat has no owner to contest' };
    }

    player.campaignsRun++;

    // Calculate success probability
    let chance = this.config.campaignBaseChance;
    chance += player.approval / 3;

    // Ideology match bonus (+15)
    if (this.checkIdeologyMatch(player, seat)) {
      chance += 15;
    }

    // Marginal seat bonus (+10 if margin < 30)
    if (seat.margin < 30) {
      chance += 10;
    }

    // Clamp between 10 and 90
    chance = Math.max(10, Math.min(90, chance));

    const roll = this.rng.random() * 100;
    const success = roll < chance;

    if (success) {
      const previousOwnerId = seat.ownerPlayerId;

      // Transfer ownership
      transferSeat(this.state.seats, targetSeatId, player.id);

      // Reset seat margin on capture
      seat.margin = 20 + this.rng.randomInt(0, 20);
      seat.contested = true;
      seat.lastCampaignedBy = player.id;

      // Approval boost for winner
      player.approval = Math.min(100, player.approval + 3);

      // Award 1 political capital
      player.pcap += 1;

      // Stats
      player.totalSeatsWon++;
      const loser = this.state.players.find(p => p.id === previousOwnerId);
      if (loser) loser.totalSeatsLost++;

      // Sync seat counts and check state control
      this.syncPlayerSeatCounts();
      this.checkStateControlChanges();

      this.logEvent({
        type: 'seat_captured',
        timestamp: Date.now(),
        seatId: targetSeatId,
        seatName: seat.name,
        fromPlayerId: previousOwnerId,
        toPlayerId: player.id,
      });

      this.logEvent({
        type: 'approval_changed',
        timestamp: Date.now(),
        playerId: player.id,
        delta: 3,
        newApproval: player.approval,
        reason: `Won seat: ${seat.name}`,
      });

      this.logEvent({
        type: 'pcap_awarded',
        timestamp: Date.now(),
        playerId: player.id,
        amount: 1,
        reason: `Won campaign: ${seat.name}`,
      });

      return {
        success: true,
        message: `Won the seat of ${seat.name}!`,
        seatCaptured: true,
        approvalChange: 3,
        pCapChange: 1,
      };
    }

    // Campaign failed
    player.approval = Math.max(-100, player.approval - 2);
    seat.lastCampaignedBy = player.id;

    this.logEvent({
      type: 'approval_changed',
      timestamp: Date.now(),
      playerId: player.id,
      delta: -2,
      newApproval: player.approval,
      reason: `Failed campaign: ${seat.name}`,
    });

    return {
      success: false,
      message: `Campaign for ${seat.name} failed.`,
      seatCaptured: false,
      approvalChange: -2,
    };
  }

  /**
   * POLICY SPEECH - play to the base, boost approval.
   * Approval +5..10, award 1 pcap.
   */
  private executePolicySpeech(player: Player): ActionResult {
    const boost = 5 + this.rng.randomInt(0, 5);
    player.approval = Math.min(100, player.approval + boost);
    player.pcap += 1;

    this.logEvent({
      type: 'approval_changed',
      timestamp: Date.now(),
      playerId: player.id,
      delta: boost,
      newApproval: player.approval,
      reason: 'Policy speech',
    });

    this.logEvent({
      type: 'pcap_awarded',
      timestamp: Date.now(),
      playerId: player.id,
      amount: 1,
      reason: 'Policy speech',
    });

    return {
      success: true,
      message: `Rallied the base! Approval +${boost}.`,
      approvalChange: boost,
      pCapChange: 1,
    };
  }

  /**
   * ATTACK AD - reduce an opponent's approval.
   * Target loses 8..15 approval. 25 % chance of 4-point backlash on the attacker.
   */
  private executeAttackAd(player: Player, targetPlayerId?: string): ActionResult {
    if (!targetPlayerId) {
      return { success: false, message: 'No target player specified' };
    }
    if (targetPlayerId === player.id) {
      return { success: false, message: 'Cannot target yourself' };
    }

    const target = this.state.players.find(p => p.id === targetPlayerId);
    if (!target) {
      return { success: false, message: 'Invalid target player' };
    }

    const damage = 8 + this.rng.randomInt(0, 7);
    target.approval = Math.max(-100, target.approval - damage);

    this.logEvent({
      type: 'approval_changed',
      timestamp: Date.now(),
      playerId: target.id,
      delta: -damage,
      newApproval: target.approval,
      reason: `Attack ad from ${player.name}`,
    });

    // 25 % backlash chance
    let backlashMessage = '';
    if (this.rng.random() < 0.25) {
      player.approval = Math.max(-100, player.approval - 4);
      backlashMessage = ' Backlash! You lost 4 approval.';

      this.logEvent({
        type: 'approval_changed',
        timestamp: Date.now(),
        playerId: player.id,
        delta: -4,
        newApproval: player.approval,
        reason: 'Attack ad backlash',
      });
    }

    return {
      success: true,
      message: `Attack ads hit ${target.name} for -${damage} approval.${backlashMessage}`,
      approvalChange: -damage,
    };
  }

  /**
   * FUNDRAISE - gain funds, small approval hit.
   * Gain fundraiseAmount + floor(seats/10). Approval -2.
   */
  private executeFundraise(player: Player): ActionResult {
    const amount = this.config.fundraiseAmount + Math.floor(player.seats / 10);
    player.funds += amount;
    player.approval = Math.max(-100, player.approval - 2);

    this.logEvent({
      type: 'funds_changed',
      timestamp: Date.now(),
      playerId: player.id,
      delta: amount,
      newFunds: player.funds,
      reason: 'Fundraising',
    });

    this.logEvent({
      type: 'approval_changed',
      timestamp: Date.now(),
      playerId: player.id,
      delta: -2,
      newApproval: player.approval,
      reason: 'Fundraising (seen as corporate)',
    });

    return {
      success: true,
      message: `Raised $${amount}M in funds. Approval -2.`,
      fundsChange: amount,
      approvalChange: -2,
    };
  }

  /**
   * MEDIA BLITZ - big approval boost.
   * Approval +10..18, award 1 pcap.
   */
  private executeMediaBlitz(player: Player): ActionResult {
    const boost = 10 + this.rng.randomInt(0, 8);
    player.approval = Math.min(100, player.approval + boost);
    player.pcap += 1;

    this.logEvent({
      type: 'approval_changed',
      timestamp: Date.now(),
      playerId: player.id,
      delta: boost,
      newApproval: player.approval,
      reason: 'Media blitz',
    });

    this.logEvent({
      type: 'pcap_awarded',
      timestamp: Date.now(),
      playerId: player.id,
      amount: 1,
      reason: 'Media blitz',
    });

    return {
      success: true,
      message: `Media blitz! Approval +${boost}.`,
      approvalChange: boost,
      pCapChange: 1,
    };
  }

  /**
   * PORK BARREL - target a state via any seat in that state.
   * All player seats in the state get +20 margin. Approval +3. Award 1 pcap.
   */
  private executePorkBarrel(player: Player, targetSeatId?: string): ActionResult {
    if (!targetSeatId) {
      return { success: false, message: 'No target seat specified to identify state' };
    }

    const targetSeat = this.state.seats[targetSeatId];
    if (!targetSeat) {
      return { success: false, message: 'Invalid target seat' };
    }

    const targetState: StateCode = targetSeat.state;

    // Boost margin of every seat the player holds in this state
    const playerSeatsInState = Object.values(this.state.seats).filter(
      s => s.state === targetState && s.ownerPlayerId === player.id,
    );

    for (const seat of playerSeatsInState) {
      seat.margin = Math.min(100, seat.margin + 20);
    }

    // Approval and pcap
    player.approval = Math.min(100, player.approval + 3);
    player.pcap += 1;

    this.logEvent({
      type: 'approval_changed',
      timestamp: Date.now(),
      playerId: player.id,
      delta: 3,
      newApproval: player.approval,
      reason: `Pork barrel: ${targetState}`,
    });

    this.logEvent({
      type: 'pcap_awarded',
      timestamp: Date.now(),
      playerId: player.id,
      amount: 1,
      reason: `Pork barrel: ${targetState}`,
    });

    return {
      success: true,
      message: `Pork barrel in ${targetState}! ${playerSeatsInState.length} seats fortified. Approval +3.`,
      approvalChange: 3,
      pCapChange: 1,
    };
  }

  // ----------------------------------------------------------
  // Turn management
  // ----------------------------------------------------------

  endTurn(playerId: string): boolean {
    if (this.state.phase !== 'action') return false;

    const currentTurnPlayerId = this.state.turnOrder[this.state.currentPlayerIndex];
    if (currentTurnPlayerId !== playerId) return false;

    this.advancePlayerTurn(playerId);
    return true;
  }

  private advancePlayerTurn(playerId: string): void {
    if (!this.state.playersActed.includes(playerId)) {
      this.state.playersActed.push(playerId);
    }

    // If every player has acted, move to legislation
    if (this.state.playersActed.length >= this.state.players.length) {
      this.advanceToLegislationPhase();
      return;
    }

    // Find the next player who hasn't acted yet
    for (let i = 0; i < this.state.turnOrder.length; i++) {
      const nextIndex = (this.state.currentPlayerIndex + 1 + i) % this.state.turnOrder.length;
      const nextPlayerId = this.state.turnOrder[nextIndex];
      if (!this.state.playersActed.includes(nextPlayerId)) {
        this.state.currentPlayerIndex = nextIndex;
        return;
      }
    }

    // Fallback: everyone is done
    this.advanceToLegislationPhase();
  }

  // ----------------------------------------------------------
  // Legislation phase
  // ----------------------------------------------------------

  private advanceToLegislationPhase(): void {
    this.state.pendingLegislation = null;
    this.setPhase('legislation_propose');
  }

  proposeBill(playerId: string, billId: string): boolean {
    if (this.state.phase !== 'legislation_propose') return false;

    // Only the speaker may propose
    const speakerId = this.state.turnOrder[this.state.speakerIndex];
    if (playerId !== speakerId) return false;

    // Bill must be in the available pool
    const billIndex = this.state.availableBills.findIndex(b => b.id === billId);
    if (billIndex === -1) return false;

    const bill = this.state.availableBills[billIndex];
    const player = this.state.players.find(p => p.id === playerId);
    if (player) {
      player.hasProposed = true;
      player.billsProposed++;
    }

    this.state.pendingLegislation = {
      bill,
      proposerId: playerId,
      votes: [],
      amendments: [],
    };

    this.logEvent({
      type: 'bill_proposed',
      timestamp: Date.now(),
      playerId,
      billId,
    });

    this.setPhase('legislation_vote');
    return true;
  }

  skipProposal(playerId: string): boolean {
    if (this.state.phase !== 'legislation_propose') return false;

    const speakerId = this.state.turnOrder[this.state.speakerIndex];
    if (playerId !== speakerId) return false;

    this.advanceToEventPhase();
    return true;
  }

  castVote(playerId: string, vote: 'aye' | 'no'): boolean {
    if (this.state.phase !== 'legislation_vote') return false;
    if (!this.state.pendingLegislation) return false;

    // Prevent double voting
    if (this.state.pendingLegislation.votes.find(v => v.playerId === playerId)) return false;

    const player = this.state.players.find(p => p.id === playerId);
    if (!player) return false;

    player.hasVoted = true;

    const legislationVote: LegislationVote = {
      playerId,
      vote,
      seatWeight: player.seats,
    };

    this.state.pendingLegislation.votes.push(legislationVote);

    this.logEvent({
      type: 'vote_cast',
      timestamp: Date.now(),
      playerId,
      vote,
      seatWeight: player.seats,
    });

    // Resolve once everyone has voted
    if (this.state.pendingLegislation.votes.length >= this.state.players.length) {
      this.resolveVote();
    }

    return true;
  }

  private resolveVote(): void {
    if (!this.state.pendingLegislation) return;

    const legislation = this.state.pendingLegislation;
    const bill = legislation.bill;

    const yesWeight = legislation.votes
      .filter(v => v.vote === 'aye')
      .reduce((sum, v) => sum + v.seatWeight, 0);

    const noWeight = legislation.votes
      .filter(v => v.vote === 'no')
      .reduce((sum, v) => sum + v.seatWeight, 0);

    const passed = yesWeight > noWeight;

    // Build the BillResult for the history snapshot
    this.currentRoundBillResult = {
      billId: bill.id,
      billName: bill.name,
      proposerId: legislation.proposerId,
      passed,
      yesWeight,
      noWeight,
      voterBreakdown: legislation.votes.map(v => ({
        playerId: v.playerId,
        vote: v.vote,
        seatWeight: v.seatWeight,
      })),
    };

    if (passed) {
      // Award pcap to proposer
      const proposer = this.state.players.find(p => p.id === legislation.proposerId);
      if (proposer) {
        proposer.pcap += bill.pCapReward;
        proposer.billsPassed++;

        this.logEvent({
          type: 'pcap_awarded',
          timestamp: Date.now(),
          playerId: proposer.id,
          amount: bill.pCapReward,
          reason: `Bill passed: ${bill.name}`,
        });

        // Apply approval impact to proposer
        if (bill.approvalImpact) {
          proposer.approval = Math.max(-100, Math.min(100, proposer.approval + bill.approvalImpact));

          this.logEvent({
            type: 'approval_changed',
            timestamp: Date.now(),
            playerId: proposer.id,
            delta: bill.approvalImpact,
            newApproval: proposer.approval,
            reason: `Bill passed: ${bill.name}`,
          });
        }
      }

      // National budget impact
      if (bill.budgetImpact) {
        this.state.nationalBudget += bill.budgetImpact;
        this.state.budgetSurplus = this.state.nationalBudget >= 0;
      }

      this.state.passedBills.push(bill);
    } else {
      this.state.failedBills.push(bill);
    }

    this.logEvent({
      type: 'bill_resolved',
      timestamp: Date.now(),
      billId: bill.id,
      passed,
      yesWeight,
      noWeight,
    });

    // Replace the used bill in availableBills with a fresh one
    const billSlotIndex = this.state.availableBills.findIndex(b => b.id === bill.id);
    if (billSlotIndex !== -1) {
      const usedIds = new Set([
        ...this.state.availableBills.map(b => b.id),
        ...this.state.passedBills.map(b => b.id),
        ...this.state.failedBills.map(b => b.id),
      ]);
      const unusedBills = this.allBills.filter(b => !usedIds.has(b.id));

      if (unusedBills.length > 0) {
        this.state.availableBills[billSlotIndex] = this.rng.pick(unusedBills);
      } else if (this.state.failedBills.length > 0) {
        // Recycle a previously failed bill
        this.state.availableBills[billSlotIndex] = this.rng.pick(this.state.failedBills);
      } else {
        // Last resort: any bill from the catalogue
        this.state.availableBills[billSlotIndex] = this.rng.pick(this.allBills);
      }
    }

    this.state.pendingLegislation = null;
    this.setPhase('legislation_result');
  }

  acknowledgeLegislationResult(playerId: string): boolean {
    if (this.state.phase !== 'legislation_result') return false;

    // Any single acknowledgement advances the game
    this.advanceToEventPhase();
    return true;
  }

  // ----------------------------------------------------------
  // Event phase
  // ----------------------------------------------------------

  private advanceToEventPhase(): void {
    if (this.config.enableEvents && this.allEvents.length > 0) {
      const event = this.rng.pick(this.allEvents);
      this.state.currentEvent = event;

      this.applyEventEffects(event);

      this.logEvent({
        type: 'event_occurred',
        timestamp: Date.now(),
        eventId: event.id,
        eventName: event.name,
      });

      this.setPhase('event');
    } else {
      // Skip straight to the next round
      this.advanceToNextRound();
    }
  }

  private applyEventEffects(event: PoliticalEvent): void {
    for (const effect of event.effects) {
      const targets = this.resolveEventTargets(effect.target);

      for (const target of targets) {
        switch (effect.type) {
          case 'approval':
            target.approval = Math.max(-100, Math.min(100, target.approval + effect.amount));
            this.logEvent({
              type: 'approval_changed',
              timestamp: Date.now(),
              playerId: target.id,
              delta: effect.amount,
              newApproval: target.approval,
              reason: `Event: ${event.name}`,
            });
            break;

          case 'funds':
            target.funds = Math.max(0, target.funds + effect.amount);
            this.logEvent({
              type: 'funds_changed',
              timestamp: Date.now(),
              playerId: target.id,
              delta: effect.amount,
              newFunds: target.funds,
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
      case 'proposer': {
        // Most-recent bill proposer this round
        const proposerId = this.currentRoundBillResult?.proposerId;
        if (proposerId) {
          const p = this.state.players.find(pp => pp.id === proposerId);
          if (p) return [p];
        }
        return [];
      }
      default:
        return [];
    }
  }

  acknowledgeEvent(playerId: string): boolean {
    if (this.state.phase !== 'event') return false;

    if (this.state.currentEvent) {
      this.state.pastEvents.push(this.state.currentEvent);
      this.state.currentEvent = null;
    }

    this.advanceToNextRound();
    return true;
  }

  // ----------------------------------------------------------
  // Round transition
  // ----------------------------------------------------------

  private advanceToNextRound(): void {
    // Snapshot the round that just ended
    this.createHistorySnapshot();

    // Win condition: majority threshold
    const majorityWinner = this.state.players.find(
      p => p.seats >= this.config.majorityThreshold,
    );

    // Win condition: max rounds reached
    if (this.state.round >= this.config.maxRounds || majorityWinner) {
      this.endGame();
      return;
    }

    // Prepare the next round
    this.state.round++;

    // Clear round-level tracking
    this.state.playersActed = [];
    this.state.roundActions = [];
    this.state.currentEvent = null;
    this.state.pendingLegislation = null;
    this.currentRoundBillResult = null;

    for (const player of this.state.players) {
      player.actionsThisRound = [];
      player.hasProposed = false;
      player.hasVoted = false;
    }

    // New shuffled turn order; rotate speaker
    this.state.turnOrder = this.rng.shuffle([...this.state.turnOrder]);
    this.state.speakerIndex = (this.state.speakerIndex + 1) % this.state.players.length;
    this.state.currentPlayerIndex = 0;

    // New active issue
    this.state.activeIssue = this.rng.pick(ISSUES);

    this.logEvent({
      type: 'round_started',
      timestamp: Date.now(),
      round: this.state.round,
      activeIssue: this.state.activeIssue,
    });

    // Tick economy and voter satisfaction at start of new round
    this.tickEconomy();

    // Budget phase (auto-advances to action)
    this.setPhase('budget');
    this.distributeBudget();
  }

  // ----------------------------------------------------------
  // Game end
  // ----------------------------------------------------------

  private endGame(): void {
    this.setPhase('game_over');

    const seatLeader = this.getSeatLeader();

    if (seatLeader) {
      // Mandate bonus
      seatLeader.pcap += this.config.mandateValue;
      this.logEvent({
        type: 'pcap_awarded',
        timestamp: Date.now(),
        playerId: seatLeader.id,
        amount: this.config.mandateValue,
        reason: 'Electoral mandate (most seats)',
      });

      // PM bonus
      seatLeader.pcap += this.config.pmValue;
      this.logEvent({
        type: 'pcap_awarded',
        timestamp: Date.now(),
        playerId: seatLeader.id,
        amount: this.config.pmValue,
        reason: 'Prime Ministership',
      });
    }

    // Calculate final scores
    const scores: Record<string, number> = {};
    for (const player of this.state.players) {
      scores[player.id] = player.pcap;
    }
    this.state.finalScores = scores;

    // Determine winner (highest pcap; tiebreak by seats)
    const maxScore = Math.max(...Object.values(scores));
    const winners = this.state.players.filter(p => p.pcap === maxScore);

    if (winners.length === 1) {
      this.state.winner = winners[0].id;
    } else {
      const maxSeats = Math.max(...winners.map(p => p.seats));
      const seatWinner = winners.find(p => p.seats === maxSeats);
      this.state.winner = seatWinner?.id || winners[0].id;
    }

    this.logEvent({
      type: 'game_ended',
      timestamp: Date.now(),
      winner: this.state.winner,
      scores,
    });
  }

  // ----------------------------------------------------------
  // Host controls
  // ----------------------------------------------------------

  forceAdvancePhase(): boolean {
    if (this.state.phase === 'waiting' || this.state.phase === 'game_over') return false;

    const oldPhase = this.state.phase;

    switch (this.state.phase) {
      case 'budget':
        // Budget already auto-advances, but just in case it's stuck
        this.setPhase('action');
        for (const player of this.state.players) {
          player.actionPoints = this.config.actionPointsPerRound;
          player.maxActionPoints = this.config.actionPointsPerRound;
        }
        this.state.playersActed = [];
        this.state.currentPlayerIndex = 0;
        break;

      case 'action':
        this.state.playersActed = this.state.players.map(p => p.id);
        this.advanceToLegislationPhase();
        break;

      case 'legislation_propose':
        this.advanceToEventPhase();
        break;

      case 'legislation_vote':
        if (this.state.pendingLegislation) {
          // Fill in any missing votes as 'no'
          for (const player of this.state.players) {
            if (!this.state.pendingLegislation.votes.find(v => v.playerId === player.id)) {
              this.state.pendingLegislation.votes.push({
                playerId: player.id,
                vote: 'no',
                seatWeight: player.seats,
              });
            }
          }
          this.resolveVote();
        } else {
          this.advanceToEventPhase();
        }
        break;

      case 'legislation_result':
        this.advanceToEventPhase();
        break;

      case 'event':
        if (this.state.currentEvent) {
          this.state.pastEvents.push(this.state.currentEvent);
          this.state.currentEvent = null;
        }
        this.advanceToNextRound();
        break;

      default:
        return false;
    }

    this.logEvent({
      type: 'phase_changed',
      timestamp: Date.now(),
      fromPhase: oldPhase,
      toPhase: this.state.phase,
    });

    return true;
  }

  updateConfig(config: Partial<GameConfig>): void {
    if (this.state.phase !== 'waiting') return;
    this.config = { ...this.config, ...config };
    this.state.maxRounds = this.config.maxRounds;
    this.state.totalSeats = this.config.totalSeats;
  }

  // ----------------------------------------------------------
  // History
  // ----------------------------------------------------------

  private createHistorySnapshot(): void {
    const seatCounts: Record<string, number> = {};
    const approvalRatings: Record<string, number> = {};
    const fundBalances: Record<string, number> = {};
    const pCapTotals: Record<string, number> = {};

    for (const player of this.state.players) {
      seatCounts[player.id] = player.seats;
      approvalRatings[player.id] = player.approval;
      fundBalances[player.id] = player.funds;
      pCapTotals[player.id] = player.pcap;
    }

    this.state.history.push({
      round: this.state.round,
      timestamp: Date.now(),
      activeIssue: this.state.activeIssue,
      seatCounts,
      approvalRatings,
      fundBalances,
      pCapTotals,
      billResult: this.currentRoundBillResult,
      eventOccurred: this.state.currentEvent?.name || null,
      actionsPerformed: [...this.state.roundActions],
    });
  }

  // ----------------------------------------------------------
  // Private helpers
  // ----------------------------------------------------------

  private getSeatLeader(): Player | null {
    if (this.state.players.length === 0) return null;
    return this.state.players.reduce((leader, p) => (p.seats > leader.seats ? p : leader));
  }

  private logEvent(event: GameEvent): void {
    this.state.eventLog.push(event);
  }

  /** Re-derive every player's seat count from the authoritative seat map. */
  private syncPlayerSeatCounts(): void {
    const counts = computePlayerSeatCounts(this.state.seats);
    for (const player of this.state.players) {
      player.seats = counts[player.id] || 0;
    }
  }

  /** Detect state-control changes since the last check and award pcap accordingly. */
  private checkStateControlChanges(): void {
    const oldControl = this.state.stateControl;
    const newControl = computeStateControl(this.state.seats);
    const changes = compareStateControl(oldControl, newControl);

    for (const { playerId, state } of changes.gained) {
      const player = this.state.players.find(p => p.id === playerId);
      if (player) {
        player.pcap += this.config.stateControlValue;

        this.logEvent({
          type: 'state_control_changed',
          timestamp: Date.now(),
          state,
          oldController: oldControl[state]?.controllerId || null,
          newController: playerId,
        });

        this.logEvent({
          type: 'pcap_awarded',
          timestamp: Date.now(),
          playerId,
          amount: this.config.stateControlValue,
          reason: `Gained control of ${state}`,
        });
      }
    }

    for (const { playerId, state } of changes.lost) {
      this.logEvent({
        type: 'state_control_changed',
        timestamp: Date.now(),
        state,
        oldController: playerId,
        newController: newControl[state]?.controllerId || null,
      });
    }

    // Persist the new control map
    this.state.stateControl = newControl;
  }

  /**
   * Check whether a player's ideology aligns with a seat's ideology.
   * Match if either economic or social axis aligns.
   */
  private checkIdeologyMatch(player: Player, seat: Seat): boolean {
    const econMatch =
      (player.economicIdeology === 'interventionist' && seat.ideology.econ === 'LEFT') ||
      (player.economicIdeology === 'market' && seat.ideology.econ === 'RIGHT');

    const socialMatch =
      (player.socialIdeology === 'progressive' && seat.ideology.social === 'PROG') ||
      (player.socialIdeology === 'conservative' && seat.ideology.social === 'CONS');

    return econMatch || socialMatch;
  }

  /** Transfer random seats from opponents to the given player (for event effects). */
  private gainRandomSeats(playerId: string, amount: number): void {
    const opponentSeats = Object.values(this.state.seats).filter(
      s => s.ownerPlayerId !== null && s.ownerPlayerId !== playerId,
    );
    const shuffled = this.rng.shuffle([...opponentSeats]);
    const count = Math.min(amount, shuffled.length);

    for (let i = 0; i < count; i++) {
      transferSeat(this.state.seats, shuffled[i].id, playerId);
    }
  }

  /** Remove random seats from the given player and distribute to opponents (for event effects). */
  private loseRandomSeats(playerId: string, amount: number): void {
    const playerSeats = getPlayerSeats(this.state.seats, playerId);
    const shuffled = this.rng.shuffle([...playerSeats]);
    const count = Math.min(amount, shuffled.length);

    const opponents = this.state.players.filter(p => p.id !== playerId);
    if (opponents.length === 0) return;

    for (let i = 0; i < count; i++) {
      const recipient = opponents[i % opponents.length];
      transferSeat(this.state.seats, shuffled[i].id, recipient.id);
    }
  }

  /** Emit a phase_changed log entry and update `state.phase`. */
  private setPhase(newPhase: Phase): void {
    const oldPhase = this.state.phase;
    this.state.phase = newPhase;

    this.logEvent({
      type: 'phase_changed',
      timestamp: Date.now(),
      fromPhase: oldPhase,
      toPhase: newPhase,
    });
  }

  // ----------------------------------------------------------
  // Economic & Voter Engine Integration
  // ----------------------------------------------------------

  /** Flatten the economic state into a simple Record for the voter engine. */
  private flattenEconomicState(economy: EconomicStateData): Record<string, number> {
    const flat: Record<string, number> = {
      gdpGrowth: economy.gdpGrowth,
      unemployment: economy.unemployment,
      inflation: economy.inflation,
      publicDebt: economy.publicDebt,
      budgetBalance: economy.budgetBalance,
      consumerConfidence: economy.consumerConfidence,
      businessConfidence: economy.businessConfidence,
      interestRate: economy.interestRate,
    };
    for (const [sector, health] of Object.entries(economy.sectors)) {
      flat[sector] = health;
    }
    return flat;
  }

  /** Build party profiles for the voter engine from current player state. */
  private buildPartyProfiles(): PartyProfile[] {
    const maxSeats = Math.max(...this.state.players.map(p => p.seats), 1);
    const govPlayer = this.state.players.reduce(
      (best, p) => p.seats > (best?.seats || 0) ? p : best,
      this.state.players[0],
    );

    // Determine main opposition (second most seats)
    const sortedBySeats = [...this.state.players].sort((a, b) => b.seats - a.seats);
    const mainOppPlayer = sortedBySeats.length > 1 ? sortedBySeats[1] : null;

    return this.state.players.map(p => ({
      id: p.id,
      socialPosition: p.socialIdeology === 'progressive' ? 0.4 : -0.4,
      economicPosition: p.economicIdeology === 'market' ? -0.4 : 0.4,
      isGovernment: p.id === govPlayer?.id,
      isMainOpposition: p.id === mainOppPlayer?.id,
      seatShare: p.seats / this.config.totalSeats,
    }));
  }

  /** Tick the economy and update voter groups. Called at the start of each round. */
  tickEconomy(): void {
    if (this.economicEngine && this.config.enableEconomy) {
      const newEcon = this.economicEngine.tick(this.activePolicyEffects);
      this.state.economy = newEcon;

      this.logEvent({
        type: 'economic_update',
        timestamp: Date.now(),
        economy: newEcon,
      });
    }

    if (this.voterEngine && this.config.enableVoterGroups) {
      const economicValues = this.flattenEconomicState(this.state.economy);
      this.voterEngine.updateSatisfaction(economicValues);
      this.state.voterGroups = this.voterEngine.getGroupSummaries();
    }

    // Recompute chamber positions based on current ownership (party grouping)
    const seatCounts = computePlayerSeatCounts(this.state.seats);
    recomputeChamberPositions(this.state.seats, seatCounts);
  }
}
