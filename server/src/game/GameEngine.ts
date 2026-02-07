// ============================================================
// THE HOUSE — Game Engine
// Democracy 4-style multiplayer political simulation
//
// Game flow per round:
//   1. government_action  — Government adjusts up to N policy sliders
//   2. opposition_action  — All other players choose actions simultaneously
//   3. simulation         — Policy web propagates, stats update
//   4. dilemma            — Government resolves a dilemma (if triggered)
//   5. media_cycle        — News spotlight shifts
//   6. round_summary      — Show what happened this round + polling
//   7. election           — (every N rounds) seats contested
//   8. election_results   — Show results, new government formed
//   → next round or game_over
// ============================================================

import seedrandom from 'seedrandom';
import { v4 as uuidv4 } from 'uuid';
import {
  GameState, GameConfig, GameEvent, Phase, Player, Leader,
  PolicySlider, PolicyAdjustment, StatDefinition,
  ActiveSituation, SituationDefinition,
  VoterGroupState, VoterGroupDefinition,
  PlayerAction, ActionResult, ActionType,
  MediaFocus, PendingDilemma, DilemmaDefinition,
  ElectionResult, PlayerScore, Seat, SeatId, StateCode, StateInfo,
  ChatMessage, PartyColorId, PARTY_COLORS,
  SocialIdeology, EconomicIdeology, AIPersonality,
  BudgetSummary, PollingSnapshot, RoundSummary,
} from '../types';
import {
  simulationTick, SimulationContext, generateMediaFocus,
  simulateElection, computeApprovalRating, computeIdeologyScore,
} from './simulation';
import { getAllPolicies } from './policies';
import { getAllStats } from './stats';
import { getAllVoterGroups } from './voterGroups';
import { getAllSituations } from './situations';
import { getAllDilemmas } from './dilemmas';
import { generateSeatMap, recomputeChamberPositions, computePlayerSeatCounts, transferSeat } from './mapGen';

const ALL_STATES: StateCode[] = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

// Australia baseline economic numbers
const BASE_GDP_BILLIONS = 2150;
const BASE_DEBT_BILLIONS = 895;
const BASE_REVENUE_BILLIONS = 680;

const DEFAULT_CONFIG: GameConfig = {
  totalSeats: 151,
  totalRounds: 16,
  electionCycle: 4,
  actionsPerRound: 3,
  policyAdjustmentsPerRound: 5,
  startingFunds: 50,
  startingPoliticalCapital: 10,
  incomePerSeat: 2,
  capitalRegenPerRound: 3,
  campaignCost: 8,
  attackCost: 6,
  mediaCampaignCost: 10,
  fundraiseAmount: 15,
  grassrootsCost: 4,
  policyResearchCost: 5,
  aiPlayerCount: 3,
  aiDifficulty: 'normal',
  majorityThreshold: 76,
  enableDilemmas: true,
  enableMediaCycle: true,
  enableSituations: true,
  enableChat: true,
  enableLeaders: true,
  simulationSpeed: 1.0,
  isSinglePlayer: false,
};

export class GameEngine {
  private state: GameState;
  private config: GameConfig;
  private rng: seedrandom.PRNG;

  // Definition caches
  private policyDefs: PolicySlider[] = [];
  private statDefs: StatDefinition[] = [];
  private voterGroupDefs: VoterGroupDefinition[] = [];
  private situationDefs: SituationDefinition[] = [];
  private dilemmaDefs: DilemmaDefinition[] = [];

  constructor(roomId: string, configOverrides: Partial<GameConfig> = {}, seed?: string) {
    this.config = { ...DEFAULT_CONFIG, ...configOverrides };
    const gameSeed = seed || uuidv4();
    this.rng = seedrandom(gameSeed);
    this.state = this.createInitialState(roomId, gameSeed);
  }

  private createInitialState(roomId: string, seed: string): GameState {
    return {
      roomId,
      seed,
      phase: 'waiting',
      round: 0,
      totalRounds: this.config.totalRounds,
      isSinglePlayer: this.config.isSinglePlayer,
      players: [],
      policies: {},
      stats: {},
      situations: [],
      voterGroups: [],
      mediaFocus: [],
      pendingDilemma: null,
      resolvedDilemmas: [],
      totalSeats: this.config.totalSeats,
      seats: {},
      stateInfo: {} as Record<StateCode, StateInfo>,
      governmentAdjustments: [],
      oppositionActions: {},
      roundResults: [],
      budget: {
        totalRevenue: BASE_REVENUE_BILLIONS,
        totalExpenditure: BASE_REVENUE_BILLIONS + 42,
        surplus: -42,
        nationalDebt: BASE_DEBT_BILLIONS,
        debtToGDP: Math.round((BASE_DEBT_BILLIONS / BASE_GDP_BILLIONS) * 100 * 10) / 10,
        gdpNominal: BASE_GDP_BILLIONS,
      },
      currentPolling: null,
      pollingHistory: [],
      roundSummaries: [],
      policyHistory: [],
      statHistory: {},
      electionHistory: [],
      eventLog: [],
      chatMessages: [],
      winner: null,
      finalScores: null,
      takenColors: [],
    };
  }

  // ── Getters ────────────────────────────────────────────────

  getState(): GameState { return { ...this.state }; }
  getConfig(): GameConfig { return { ...this.config }; }
  getEventLog(): GameEvent[] { return [...this.state.eventLog]; }

  getAvailableColors(): PartyColorId[] {
    return PARTY_COLORS.filter(c => !this.state.takenColors.includes(c.id)).map(c => c.id);
  }

  // ── Player Management ──────────────────────────────────────

  addPlayer(
    id: string,
    playerName: string,
    partyName: string,
    colorId?: PartyColorId,
    _symbolId?: string,
    socialIdeology?: SocialIdeology,
    economicIdeology?: EconomicIdeology,
    leader?: Leader | null,
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
      leader: leader || null,
      seats: 0,
      funds: this.config.startingFunds,
      politicalCapital: this.config.startingPoliticalCapital,
      isGovernment: false,
      isAI: false,
      connected: true,
      isHost,
      submittedActions: false,
      submittedAdjustments: false,
      shadowPolicies: {},
      voterInfluence: {},
      roundsAsGovernment: 0,
      electionsWon: 0,
      policiesChanged: 0,
      crisisesManaged: 0,
      ideologyScore: 0,
      approvalRating: 0,
    };

    this.state.players.push(player);
    this.logEvent({
      type: 'player_joined', timestamp: Date.now(),
      playerId: id, playerName: player.playerName, colorId: finalColorId,
    });
    return player;
  }

  removePlayer(id: string): boolean {
    const idx = this.state.players.findIndex(p => p.id === id);
    if (idx === -1) return false;
    if (this.state.phase === 'waiting') {
      this.state.takenColors = this.state.takenColors.filter(c => c !== this.state.players[idx].colorId);
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
      type: 'chat_message', timestamp: Date.now(),
      senderId: message.senderId, recipientId: message.recipientId, content: message.content,
    });
  }

  updateConfig(updates: Partial<GameConfig>): void {
    if (this.state.phase !== 'waiting') return;
    this.config = { ...this.config, ...updates };
    this.state.totalRounds = this.config.totalRounds;
  }

  // ── Game Start ─────────────────────────────────────────────

  startGame(): boolean {
    if (this.state.phase !== 'waiting') return false;
    const humanCount = this.state.players.filter(p => !p.isAI).length;
    if (humanCount < 1) return false;

    // Load definitions
    this.policyDefs = getAllPolicies();
    this.statDefs = getAllStats();
    this.voterGroupDefs = getAllVoterGroups();
    this.situationDefs = getAllSituations();
    this.dilemmaDefs = getAllDilemmas();

    // Add AI players
    this.addAIPlayers();
    if (this.state.players.length < 2) return false;

    // Initialize policies from definitions
    for (const pd of this.policyDefs) {
      this.state.policies[pd.id] = { ...pd };
    }

    // Initialize stats from definitions
    for (const sd of this.statDefs) {
      this.state.stats[sd.id] = { ...sd };
      this.state.statHistory[sd.id] = [sd.value];
    }

    // Initialize voter groups with partyPolling
    this.state.voterGroups = this.voterGroupDefs.map(vgd => {
      const partyPolling: Record<string, number> = {};
      for (const p of this.state.players) {
        partyPolling[p.id] = 1 / this.state.players.length;
      }
      return {
        id: vgd.id,
        name: vgd.name,
        icon: vgd.icon,
        population: vgd.basePopulation,
        happiness: 0,
        prevHappiness: 0,
        loyalty: {},
        turnout: 0.6,
        partyPolling,
      };
    });

    // Initialize voter influence
    for (const p of this.state.players) {
      for (const vg of this.voterGroupDefs) {
        p.voterInfluence[vg.id] = 0;
      }
    }

    // Generate seat map with demographics
    const seatMap = generateSeatMap(this.config.totalSeats, this.rng, this.voterGroupDefs);
    this.state.seats = seatMap;

    // Distribute initial seats evenly
    this.distributeInitialSeats();
    recomputeChamberPositions(this.state.seats, computePlayerSeatCounts(this.state.seats));
    this.updateStateInfo();

    // First player is initial government + PM
    this.state.players[0].isGovernment = true;
    if (this.state.players[0].leader) {
      this.state.players[0].leader.isPM = true;
    }
    this.syncPlayerSeatCounts();

    // Compute initial budget
    this.computeBudget();

    this.logEvent({ type: 'game_started', timestamp: Date.now(), seed: this.state.seed });
    this.logEvent({
      type: 'government_formed', timestamp: Date.now(),
      playerId: this.state.players[0].id,
      playerName: this.state.players[0].name,
      seats: this.state.players[0].seats,
    });

    // Start round 1
    this.state.round = 1;
    this.logEvent({ type: 'round_started', timestamp: Date.now(), round: 1 });
    this.setPhase('government_action');

    // AI government auto-submits
    const govPlayer = this.state.players.find(p => p.isGovernment);
    if (govPlayer?.isAI) {
      this.generateAIGovernmentActions(govPlayer);
    }

    return true;
  }

  private addAIPlayers(): void {
    const aiTemplates: { name: string; party: string; social: SocialIdeology; economic: EconomicIdeology; personality: AIPersonality; portrait: string; title: string }[] = [
      { name: 'Margaret', party: 'Iron Coalition', social: 'conservative', economic: 'market', personality: 'hawk', portrait: '🦅', title: 'The Iron Lady' },
      { name: 'Kevin', party: "People's Alliance", social: 'progressive', economic: 'interventionist', personality: 'populist', portrait: '📢', title: 'The Populist' },
      { name: 'Julia', party: 'Forward Australia', social: 'progressive', economic: 'interventionist', personality: 'technocrat', portrait: '📊', title: 'The Technocrat' },
      { name: 'Tony', party: 'Freedom Party', social: 'conservative', economic: 'market', personality: 'ideologue', portrait: '⚡', title: 'The True Believer' },
      { name: 'Malcolm', party: 'Modern Centre', social: 'progressive', economic: 'market', personality: 'dove', portrait: '🕊️', title: 'The Moderate' },
    ];

    const needed = Math.min(this.config.aiPlayerCount, 5 - this.state.players.filter(p => !p.isAI).length);
    for (let i = 0; i < needed; i++) {
      const ai = aiTemplates[i % aiTemplates.length];

      // Create AI leader
      const aiLeader: Leader = {
        definitionId: `ai_leader_${i}`,
        name: ai.name,
        title: ai.title,
        portrait: ai.portrait,
        traits: [],
        personalApproval: 0,
        charisma: 0.4 + this.rng() * 0.4,
        experience: 0.3 + this.rng() * 0.5,
        scandalRisk: 0.1 + this.rng() * 0.3,
        isPM: false,
        roundsAsPM: 0,
        defected: false,
      };

      const player = this.addPlayer(
        `ai-${uuidv4().slice(0, 8)}`, ai.name, ai.party,
        undefined, undefined, ai.social, ai.economic, aiLeader,
      );
      if (player) {
        player.isAI = true;
        player.aiPersonality = ai.personality;
        player.connected = true;
      }
    }
  }

  private distributeInitialSeats(): void {
    const seats = Object.values(this.state.seats);
    const players = this.state.players;
    if (players.length === 0) return;

    // Shuffle seats
    for (let i = seats.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [seats[i], seats[j]] = [seats[j], seats[i]];
    }

    const perPlayer = Math.floor(seats.length / players.length);
    let idx = 0;
    for (const player of players) {
      for (let i = 0; i < perPlayer && idx < seats.length; i++) {
        this.state.seats[seats[idx].id].ownerPlayerId = player.id;
        this.state.seats[seats[idx].id].margin = 30 + Math.floor(this.rng() * 40);
        idx++;
      }
    }
    // Remainder to first player
    while (idx < seats.length) {
      this.state.seats[seats[idx].id].ownerPlayerId = players[0].id;
      this.state.seats[seats[idx].id].margin = 20 + Math.floor(this.rng() * 30);
      idx++;
    }
  }

  // ── Government Actions (Policy Adjustments) ────────────────

  submitPolicyAdjustments(playerId: string, adjustments: PolicyAdjustment[]): boolean {
    if (this.state.phase !== 'government_action') return false;
    const player = this.state.players.find(p => p.id === playerId);
    if (!player || !player.isGovernment) return false;
    if (player.submittedAdjustments) return false;

    const validAdj = adjustments.slice(0, this.config.policyAdjustmentsPerRound);

    for (const adj of validAdj) {
      const policy = this.state.policies[adj.policyId];
      if (!policy) continue;

      const newVal = Math.max(0, Math.min(1, adj.newValue));
      if (Math.abs(newVal - policy.targetValue) < 0.01) continue;

      const oldVal = policy.targetValue;
      const changeMag = Math.abs(newVal - oldVal);
      const capitalCost = Math.ceil(changeMag * 5);
      if (player.politicalCapital < capitalCost) continue;
      player.politicalCapital -= capitalCost;

      // Leader policySpeed bonus
      if (player.leader) {
        for (const trait of player.leader.traits) {
          if (trait.effects.policySpeed) {
            // Faster implementation doesn't change cost but we note it
          }
        }
      }

      policy.targetValue = newVal;
      player.policiesChanged++;

      this.state.policyHistory.push({
        round: this.state.round,
        policyId: policy.id,
        oldValue: oldVal,
        newValue: newVal,
        playerId: player.id,
      });
      this.state.governmentAdjustments.push(adj);

      this.logEvent({
        type: 'policy_changed', timestamp: Date.now(),
        playerId: player.id, policyId: policy.id,
        policyName: policy.name, oldValue: oldVal, newValue: newVal,
      });
    }

    player.submittedAdjustments = true;
    this.advanceAfterGovernment();
    return true;
  }

  private advanceAfterGovernment(): void {
    this.setPhase('opposition_action');
    for (const p of this.state.players) {
      if (!p.isGovernment) p.submittedActions = false;
    }
    // AI opposition auto-submits
    for (const p of this.state.players) {
      if (p.isAI && !p.isGovernment) {
        this.generateAIOppositionActions(p);
      }
    }
    this.checkAllOppositionSubmitted();
  }

  // ── Opposition Actions ─────────────────────────────────────

  submitActions(playerId: string, actions: PlayerAction[]): boolean {
    if (this.state.phase !== 'opposition_action') return false;
    const player = this.state.players.find(p => p.id === playerId);
    if (!player || player.isGovernment || player.submittedActions) return false;

    const validActions = actions.slice(0, this.config.actionsPerRound);
    const processedActions: PlayerAction[] = [];

    for (const action of validActions) {
      const cost = this.getActionCost(action.type);

      // Leader bonuses
      let effectiveCost = cost;
      if (player.leader) {
        for (const trait of player.leader.traits) {
          if (action.type === 'fundraise' && trait.effects.fundraiseBonus) {
            // Bonus applied to income, not cost
          }
        }
      }

      if (player.funds < effectiveCost) continue;
      player.funds -= effectiveCost;
      processedActions.push(action);
    }

    this.state.oppositionActions[playerId] = processedActions;
    player.submittedActions = true;
    this.checkAllOppositionSubmitted();
    return true;
  }

  private checkAllOppositionSubmitted(): void {
    const opposition = this.state.players.filter(p => !p.isGovernment && (p.connected || p.isAI));
    if (opposition.every(p => p.submittedActions)) {
      this.resolveRound();
    }
  }

  getActionCost(type: ActionType): number {
    switch (type) {
      case 'campaign': return this.config.campaignCost;
      case 'attack_government': return this.config.attackCost;
      case 'media_campaign': return this.config.mediaCampaignCost;
      case 'fundraise': return 0;
      case 'grassroots': return this.config.grassrootsCost;
      case 'coalition_deal': return 0;
      case 'shadow_policy': return 0;
      case 'policy_research': return this.config.policyResearchCost;
      default: return 0;
    }
  }

  // ── Round Resolution ───────────────────────────────────────

  private resolveRound(): void {
    this.setPhase('simulation');
    this.state.roundResults = [];

    // Track pre-round situation state
    const preSituations = this.state.situations.map(s => s.definitionId);

    // Resolve opposition actions
    for (const [playerId, actions] of Object.entries(this.state.oppositionActions)) {
      const player = this.state.players.find(p => p.id === playerId);
      if (!player) continue;
      for (const action of actions) {
        const result = this.executeAction(player, action);
        this.state.roundResults.push(result);
      }
    }

    // Government gets capital regen
    const govPlayer = this.state.players.find(p => p.isGovernment);
    if (govPlayer) {
      govPlayer.roundsAsGovernment++;
      let capitalRegen = this.config.capitalRegenPerRound;
      // Leader capital bonus
      if (govPlayer.leader) {
        for (const trait of govPlayer.leader.traits) {
          if (trait.effects.capitalBonus) capitalRegen += trait.effects.capitalBonus;
        }
        govPlayer.leader.roundsAsPM++;
      }
      govPlayer.politicalCapital = Math.min(govPlayer.politicalCapital + capitalRegen, 20);
    }

    // Income
    this.distributeIncome();

    // Simulation tick
    const simCtx: SimulationContext = {
      policies: this.state.policies,
      stats: this.state.stats,
      activeSituations: this.state.situations,
      situationDefinitions: this.situationDefs,
      voterGroups: this.state.voterGroups,
      voterGroupDefinitions: this.voterGroupDefs,
      mediaFocus: this.state.mediaFocus,
      config: this.config,
      round: this.state.round,
      rng: this.rng,
    };

    const tickResult = simulationTick(simCtx);

    for (const sit of tickResult.situationsTriggered) {
      this.logEvent({
        type: 'situation_triggered', timestamp: Date.now(),
        situationId: sit.definitionId, name: sit.name,
        headline: sit.headline, severity: sit.severityType,
      });
    }
    for (const sit of tickResult.situationsResolved) {
      this.logEvent({
        type: 'situation_resolved', timestamp: Date.now(),
        situationId: sit.definitionId, name: sit.name,
      });
    }

    // Record stat history
    for (const stat of Object.values(this.state.stats)) {
      if (!this.state.statHistory[stat.id]) this.state.statHistory[stat.id] = [];
      this.state.statHistory[stat.id].push(stat.value);
    }

    // Update player metrics
    for (const p of this.state.players) {
      p.approvalRating = computeApprovalRating(p, this.state.voterGroups, this.voterGroupDefs);
      p.ideologyScore = computeIdeologyScore(p, this.state.policies);
    }

    // Update voter group party polling
    this.computeVoterGroupPolling();

    // Compute budget
    this.computeBudget();

    // Compute polling projection
    this.computePolling();

    // Media cycle
    const mediaHeadlines: string[] = [];
    if (this.config.enableMediaCycle && this.rng() < 0.6) {
      const media = generateMediaFocus(simCtx);
      if (media) {
        this.state.mediaFocus.push(media);
        mediaHeadlines.push(media.headline);
        this.logEvent({
          type: 'media_spotlight', timestamp: Date.now(),
          nodeId: media.nodeId, headline: media.headline, sentiment: media.sentiment,
        });
      }
    }

    // Generate round summary
    this.generateRoundSummary(preSituations, tickResult, mediaHeadlines);

    // Check for dilemma
    if (this.config.enableDilemmas && this.rng() < 0.35) {
      const dilemma = this.pickDilemma();
      if (dilemma) {
        this.state.pendingDilemma = dilemma;
        this.setPhase('dilemma');
        this.logEvent({
          type: 'dilemma_presented', timestamp: Date.now(),
          dilemmaId: dilemma.definitionId, name: dilemma.name,
        });
        const gov = this.state.players.find(p => p.isGovernment);
        if (gov?.isAI) this.resolveAIDilemma(gov);
        return;
      }
    }

    this.postSimulation();
  }

  private postSimulation(): void {
    // Show round summary before checking election
    this.setPhase('round_summary');

    // In single player or if all players are AI except one, auto-advance after brief pause
    if (this.config.isSinglePlayer) {
      // Don't auto-advance - let player see the summary and click continue
    }
  }

  private postRoundSummary(): void {
    // Election check
    if (this.state.round > 0 && this.state.round % this.config.electionCycle === 0) {
      this.runElection();
      return;
    }
    // Game end check
    if (this.state.round >= this.state.totalRounds) {
      this.endGame();
      return;
    }
    this.advanceToNextRound();
  }

  // ── Budget Computation (realistic Australian $B) ───────────

  private computeBudget(): void {
    const gdpGrowth = this.state.stats['gdp_growth'];
    const inflation = this.state.stats['inflation'];
    const debt = this.state.stats['national_debt'];

    // GDP nominal grows/shrinks based on GDP growth stat
    const growthRate = gdpGrowth ? (gdpGrowth.value * (gdpGrowth.displayMax - gdpGrowth.displayMin) + gdpGrowth.displayMin) / 100 : 0.025;
    const gdpNominal = Math.round(BASE_GDP_BILLIONS * (1 + growthRate * (this.state.round / 4)));

    // Revenue from tax policies
    let totalRevenue = 0;
    const taxPolicies = Object.values(this.state.policies).filter(p => p.category === 'tax');
    for (const tp of taxPolicies) {
      totalRevenue += tp.currentValue * tp.costPerPoint * 0.8; // tax revenue
    }
    // Base non-tax revenue (fees, dividends, etc.) ~$80B
    totalRevenue += 80;
    totalRevenue = Math.round(totalRevenue * 10) / 10;

    // Expenditure from policy costs
    let totalExpenditure = 0;
    for (const policy of Object.values(this.state.policies)) {
      if (policy.category !== 'tax') {
        totalExpenditure += policy.currentValue * policy.costPerPoint;
      }
    }
    totalExpenditure = Math.round(totalExpenditure * 10) / 10;

    const surplus = Math.round((totalRevenue - totalExpenditure) * 10) / 10;
    const nationalDebt = Math.round((BASE_DEBT_BILLIONS - surplus * this.state.round * 0.25) * 10) / 10;
    const debtToGDP = Math.round((nationalDebt / gdpNominal) * 100 * 10) / 10;

    this.state.budget = {
      totalRevenue,
      totalExpenditure,
      surplus,
      nationalDebt: Math.max(0, nationalDebt),
      debtToGDP,
      gdpNominal,
    };
  }

  // ── Polling Projection ─────────────────────────────────────

  private computePolling(): void {
    // Run a simulated election without applying results
    const projectedResult = simulateElection(this.state, this.voterGroupDefs, this.rng);

    const projectedSeats: Record<string, number> = {};
    const currentSeats = computePlayerSeatCounts(this.state.seats);

    // Count projected seats from vote share
    for (const p of this.state.players) {
      const voteShare = projectedResult.voteShare[p.id] || 0;
      projectedSeats[p.id] = Math.round(voteShare * this.config.totalSeats);
    }

    // Ensure total adds up
    const total = Object.values(projectedSeats).reduce((s, v) => s + v, 0);
    if (total !== this.config.totalSeats && this.state.players.length > 0) {
      const leader = this.state.players.reduce((a, b) =>
        (projectedSeats[a.id] || 0) >= (projectedSeats[b.id] || 0) ? a : b);
      projectedSeats[leader.id] = (projectedSeats[leader.id] || 0) + (this.config.totalSeats - total);
    }

    // Compute 2PP (two-party preferred) - simplified
    const twoPartyPreferred: Record<string, number> = {};
    const totalVotes = Object.values(projectedResult.voteShare).reduce((s, v) => s + v, 0);
    for (const p of this.state.players) {
      twoPartyPreferred[p.id] = totalVotes > 0
        ? Math.round(((projectedResult.voteShare[p.id] || 0) / totalVotes) * 100 * 10) / 10
        : 0;
    }

    const approvalRatings: Record<string, number> = {};
    for (const p of this.state.players) {
      approvalRatings[p.id] = Math.round(p.approvalRating * 100) / 100;
    }

    const snapshot: PollingSnapshot = {
      round: this.state.round,
      projectedSeats,
      primaryVote: projectedResult.voteShare,
      twoPartyPreferred,
      approvalRatings,
    };

    this.state.currentPolling = snapshot;
    this.state.pollingHistory.push(snapshot);
  }

  // ── Voter Group Polling ────────────────────────────────────

  private computeVoterGroupPolling(): void {
    for (const vg of this.state.voterGroups) {
      const vgDef = this.voterGroupDefs.find(d => d.id === vg.id);
      if (!vgDef) continue;

      const totalScore: Record<string, number> = {};
      let totalSum = 0;

      for (const p of this.state.players) {
        // Base: ideology alignment
        const playerSocial = p.socialIdeology === 'progressive' ? 1 : -1;
        const playerEcon = p.economicIdeology === 'interventionist' ? 1 : -1;
        const alignment = 1 - (Math.abs(playerSocial - vgDef.socialLeaning) + Math.abs(playerEcon - vgDef.economicLeaning)) / 4;

        // Loyalty from campaigning
        const loyalty = vg.loyalty[p.id] || 0;

        // Government bonus/penalty
        const govMod = p.isGovernment ? vg.happiness * 0.3 : 0;

        const score = Math.max(0.01, alignment * 0.4 + loyalty * 0.35 + govMod + 0.25);
        totalScore[p.id] = score;
        totalSum += score;
      }

      // Normalize to percentages
      for (const p of this.state.players) {
        vg.partyPolling[p.id] = totalSum > 0
          ? Math.round((totalScore[p.id] / totalSum) * 1000) / 1000
          : 1 / this.state.players.length;
      }
    }
  }

  // ── Round Summary Generation ───────────────────────────────

  private generateRoundSummary(
    preSituations: string[],
    tickResult: { situationsTriggered: ActiveSituation[]; situationsResolved: ActiveSituation[] },
    mediaHeadlines: string[],
  ): void {
    const govPlayer = this.state.players.find(p => p.isGovernment);
    if (!govPlayer) return;

    // Get economic stats for realistic display
    const gdpGrowthStat = this.state.stats['gdp_growth'];
    const unemploymentStat = this.state.stats['unemployment'];
    const inflationStat = this.state.stats['inflation'];

    const toReal = (stat: StatDefinition | undefined) => {
      if (!stat) return 0;
      return Math.round((stat.value * (stat.displayMax - stat.displayMin) + stat.displayMin) * 10) / 10;
    };

    // Voter group happiness changes
    const voterGroupChanges = this.state.voterGroups
      .map(vg => ({
        groupId: vg.id,
        groupName: vg.name,
        happinessDelta: Math.round((vg.happiness - vg.prevHappiness) * 100) / 100,
      }))
      .filter(c => Math.abs(c.happinessDelta) > 0.01)
      .sort((a, b) => Math.abs(b.happinessDelta) - Math.abs(a.happinessDelta))
      .slice(0, 8);

    // Opposition action descriptions
    const oppositionActions = this.state.players
      .filter(p => !p.isGovernment)
      .map(p => ({
        playerId: p.id,
        playerName: p.name,
        actions: (this.state.oppositionActions[p.id] || []).map(a => {
          const r = this.state.roundResults.find(rr => rr.playerId === p.id && rr.action.type === a.type);
          return r?.description || a.type;
        }),
      }));

    // Policy changes this round
    const policiesChanged = this.state.policyHistory
      .filter(ph => ph.round === this.state.round)
      .map(ph => ({
        policyId: ph.policyId,
        policyName: this.state.policies[ph.policyId]?.name || ph.policyId,
        oldValue: ph.oldValue,
        newValue: ph.newValue,
      }));

    // Polling projection
    const pollingProjection: Record<string, number> = {};
    if (this.state.currentPolling) {
      for (const [pid, seats] of Object.entries(this.state.currentPolling.projectedSeats)) {
        pollingProjection[pid] = seats;
      }
    }

    const summary: RoundSummary = {
      round: this.state.round,
      governmentPlayerId: govPlayer.id,
      governmentPlayerName: govPlayer.name,
      gdpBillions: this.state.budget.gdpNominal,
      gdpGrowthPercent: toReal(gdpGrowthStat),
      unemploymentPercent: toReal(unemploymentStat),
      debtBillions: this.state.budget.nationalDebt,
      deficitBillions: this.state.budget.surplus,
      inflationPercent: toReal(inflationStat),
      policiesChanged,
      situationsTriggered: tickResult.situationsTriggered.map(s => s.name),
      situationsResolved: tickResult.situationsResolved.map(s => s.name),
      mediaHeadlines,
      voterGroupChanges,
      pollingProjection,
      oppositionActions,
    };

    this.state.roundSummaries.push(summary);
  }

  // ── Action Execution ───────────────────────────────────────

  private executeAction(player: Player, action: PlayerAction): ActionResult {
    switch (action.type) {
      case 'campaign': return this.executeCampaign(player, action);
      case 'shadow_policy': return this.executeShadowPolicy(player, action);
      case 'attack_government': return this.executeAttack(player, action);
      case 'fundraise': return this.executeFundraise(player);
      case 'media_campaign': return this.executeMediaCampaign(player);
      case 'grassroots': return this.executeGrassroots(player, action);
      case 'coalition_deal': return this.executeCoalition(player, action);
      case 'policy_research': return this.executePolicyResearch(player);
      default:
        return { playerId: player.id, action, success: false, description: 'Unknown action', effects: [] };
    }
  }

  private executeCampaign(player: Player, action: PlayerAction): ActionResult {
    const groupId = action.targetGroupId;
    if (!groupId) return { playerId: player.id, action, success: false, description: 'No target group', effects: [] };

    const vg = this.state.voterGroups.find(v => v.id === groupId);
    if (!vg) return { playerId: player.id, action, success: false, description: 'Invalid group', effects: [] };

    const def = this.voterGroupDefs.find(d => d.id === groupId);
    const persuadability = def?.persuadability || 0.5;
    let loyaltyGain = 0.1 + this.rng() * 0.1 * persuadability;

    // Leader charisma + campaign bonus
    if (player.leader) {
      loyaltyGain *= (1 + player.leader.charisma * 0.3);
      for (const trait of player.leader.traits) {
        if (trait.effects.campaignBonus) loyaltyGain *= (1 + trait.effects.campaignBonus);
      }
    }

    vg.loyalty[player.id] = (vg.loyalty[player.id] || 0) + loyaltyGain;
    player.voterInfluence[groupId] = (player.voterInfluence[groupId] || 0) + loyaltyGain;

    this.logEvent({
      type: 'campaign_action', timestamp: Date.now(),
      playerId: player.id, targetGroup: vg.name, effect: loyaltyGain,
    });

    return {
      playerId: player.id, action, success: true,
      description: `Campaigned to ${vg.name}, gaining ${(loyaltyGain * 100).toFixed(0)}% loyalty`,
      effects: [{ type: 'loyalty', amount: loyaltyGain }],
    };
  }

  private executeShadowPolicy(player: Player, action: PlayerAction): ActionResult {
    const { targetPolicyId, proposedValue } = action;
    if (!targetPolicyId || proposedValue === undefined) {
      return { playerId: player.id, action, success: false, description: 'Invalid', effects: [] };
    }
    const policy = this.state.policies[targetPolicyId];
    if (!policy) return { playerId: player.id, action, success: false, description: 'Not found', effects: [] };

    player.shadowPolicies[targetPolicyId] = Math.max(0, Math.min(1, proposedValue));
    return {
      playerId: player.id, action, success: true,
      description: `Proposed ${policy.name} at ${(proposedValue * 100).toFixed(0)}%`,
      effects: [{ type: 'shadow_policy', amount: proposedValue }],
    };
  }

  private executeAttack(player: Player, action: PlayerAction): ActionResult {
    const govPlayer = this.state.players.find(p => p.isGovernment);
    if (!govPlayer) return { playerId: player.id, action, success: false, description: 'No government', effects: [] };

    let issue = 'government record';
    let attackDamage = 0.05;

    if (action.targetSituationId) {
      const sit = this.state.situations.find(s => s.definitionId === action.targetSituationId);
      if (sit) {
        issue = sit.name;
        attackDamage = 0.07 + sit.severity * 0.05; // crises do more damage
        const sitDef = this.situationDefs.find(d => d.id === sit.definitionId);
        if (sitDef) {
          for (const vr of sitDef.voterReactions) {
            const vg = this.state.voterGroups.find(v => v.id === vr.groupId);
            if (vg) {
              vg.loyalty[govPlayer.id] = (vg.loyalty[govPlayer.id] || 0) - 0.05;
              vg.loyalty[player.id] = (vg.loyalty[player.id] || 0) + 0.03;
            }
          }
        }
      }
    } else if (action.targetStatId) {
      const stat = this.state.stats[action.targetStatId];
      if (stat) issue = stat.name;
    }

    // Leader attack resistance
    if (govPlayer.leader) {
      for (const trait of govPlayer.leader.traits) {
        if (trait.effects.attackResistance) {
          attackDamage *= (1 - trait.effects.attackResistance);
        }
      }
    }

    govPlayer.approvalRating = Math.max(-1, govPlayer.approvalRating - attackDamage);

    this.logEvent({
      type: 'attack_action', timestamp: Date.now(),
      attackerId: player.id, targetId: govPlayer.id, issue,
    });

    return {
      playerId: player.id, action, success: true,
      description: `Attacked government on ${issue}`,
      effects: [{ type: 'approval_damage', amount: -attackDamage }],
    };
  }

  private executeFundraise(player: Player): ActionResult {
    let amount = this.config.fundraiseAmount + Math.floor(this.rng() * 5);

    // Leader fundraise bonus
    if (player.leader) {
      for (const trait of player.leader.traits) {
        if (trait.effects.fundraiseBonus) {
          amount = Math.round(amount * (1 + trait.effects.fundraiseBonus));
        }
      }
    }

    player.funds += amount;
    this.logEvent({
      type: 'funds_changed', timestamp: Date.now(),
      playerId: player.id, delta: amount, reason: 'Fundraising',
    });
    return {
      playerId: player.id, action: { type: 'fundraise' }, success: true,
      description: `Raised $${amount}M`, effects: [{ type: 'funds', amount }],
    };
  }

  private executeMediaCampaign(player: Player): ActionResult {
    let gain = 0.02 + this.rng() * 0.03;

    // Leader media savvy
    if (player.leader) {
      for (const trait of player.leader.traits) {
        if (trait.effects.mediaSavvy) gain *= (1 + trait.effects.mediaSavvy * 0.5);
      }
    }

    for (const vg of this.state.voterGroups) {
      vg.loyalty[player.id] = (vg.loyalty[player.id] || 0) + gain;
    }
    return {
      playerId: player.id, action: { type: 'media_campaign' }, success: true,
      description: 'Media campaign boosted visibility across all groups',
      effects: [{ type: 'visibility', amount: gain }],
    };
  }

  private executeGrassroots(player: Player, action: PlayerAction): ActionResult {
    const groupId = action.targetGroupId;
    if (!groupId) return { playerId: player.id, action, success: false, description: 'No target', effects: [] };
    const vg = this.state.voterGroups.find(v => v.id === groupId);
    const def = this.voterGroupDefs.find(d => d.id === groupId);
    if (!vg || !def) return { playerId: player.id, action, success: false, description: 'Invalid', effects: [] };

    const playerSocial = player.socialIdeology === 'progressive' ? 1 : -1;
    const playerEcon = player.economicIdeology === 'interventionist' ? 1 : -1;
    const alignment = 1 - (Math.abs(playerSocial - def.socialLeaning) + Math.abs(playerEcon - def.economicLeaning)) / 4;
    const loyaltyGain = 0.05 + alignment * 0.1 + this.rng() * 0.03;
    vg.loyalty[player.id] = (vg.loyalty[player.id] || 0) + loyaltyGain;

    return {
      playerId: player.id, action, success: true,
      description: `Grassroots campaign to ${vg.name}`,
      effects: [{ type: 'loyalty', amount: loyaltyGain }],
    };
  }

  private executeCoalition(player: Player, action: PlayerAction): ActionResult {
    const target = this.state.players.find(p => p.id === action.targetPlayerId);
    if (!target) return { playerId: player.id, action, success: false, description: 'Not found', effects: [] };
    for (const vg of this.state.voterGroups) {
      const shared = (vg.loyalty[target.id] || 0) * 0.1;
      vg.loyalty[player.id] = (vg.loyalty[player.id] || 0) + shared;
    }
    return {
      playerId: player.id, action, success: true,
      description: `Coalition talk with ${target.name}`,
      effects: [{ type: 'coalition', amount: 0.1 }],
    };
  }

  private executePolicyResearch(player: Player): ActionResult {
    player.politicalCapital = Math.min(player.politicalCapital + 2, 20);
    return {
      playerId: player.id, action: { type: 'policy_research' }, success: true,
      description: 'Gained political capital through research',
      effects: [{ type: 'political_capital', amount: 2 }],
    };
  }

  // ── Dilemma ────────────────────────────────────────────────

  resolveDilemma(playerId: string, choiceId: string): boolean {
    if (this.state.phase !== 'dilemma' || !this.state.pendingDilemma) return false;
    const player = this.state.players.find(p => p.id === playerId);
    if (!player || !player.isGovernment) return false;

    const choice = this.state.pendingDilemma.choices.find(c => c.id === choiceId);
    if (!choice) return false;

    for (const effect of choice.effects) {
      if (this.state.stats[effect.nodeId]) {
        this.state.stats[effect.nodeId].value = Math.max(0, Math.min(1,
          this.state.stats[effect.nodeId].value + effect.delta));
      }
      if (this.state.policies[effect.nodeId]) {
        this.state.policies[effect.nodeId].targetValue = Math.max(0, Math.min(1,
          this.state.policies[effect.nodeId].targetValue + effect.delta));
      }
    }

    for (const reaction of choice.voterReactions) {
      const vg = this.state.voterGroups.find(v => v.id === reaction.groupId);
      if (vg) vg.happiness = Math.max(-1, Math.min(1, vg.happiness + reaction.delta));
    }

    // Update the last round summary with dilemma info
    const lastSummary = this.state.roundSummaries[this.state.roundSummaries.length - 1];
    if (lastSummary) {
      lastSummary.dilemmaResolved = {
        name: this.state.pendingDilemma.name,
        choiceLabel: choice.label,
      };
    }

    this.state.resolvedDilemmas.push(this.state.pendingDilemma.definitionId);
    this.logEvent({
      type: 'dilemma_resolved', timestamp: Date.now(),
      dilemmaId: this.state.pendingDilemma.definitionId,
      choiceId, description: choice.label,
    });

    this.state.pendingDilemma = null;
    this.postSimulation();
    return true;
  }

  private pickDilemma(): PendingDilemma | null {
    const available = this.dilemmaDefs.filter(d => {
      if (d.oneShot && this.state.resolvedDilemmas.includes(d.id)) return false;
      if (d.condition) {
        const val = this.getNodeValue(d.condition.nodeId);
        if (val === null) return false;
        switch (d.condition.operator) {
          case '>': return val > d.condition.value;
          case '<': return val < d.condition.value;
          case '>=': return val >= d.condition.value;
          case '<=': return val <= d.condition.value;
        }
      }
      return true;
    });
    if (available.length === 0) return null;

    const pick = available[Math.floor(this.rng() * available.length)];
    return {
      definitionId: pick.id, name: pick.name, headline: pick.headline,
      description: pick.description, icon: pick.icon,
      choices: pick.choices, roundTriggered: this.state.round,
    };
  }

  private getNodeValue(nodeId: string): number | null {
    if (this.state.policies[nodeId]) return this.state.policies[nodeId].currentValue;
    if (this.state.stats[nodeId]) return this.state.stats[nodeId].value;
    const sit = this.state.situations.find(s => s.definitionId === nodeId);
    return sit ? sit.severity : null;
  }

  // ── Election ───────────────────────────────────────────────

  private runElection(): void {
    this.setPhase('election');

    const elResult = simulateElection(this.state, this.voterGroupDefs, this.rng);

    for (const change of elResult.seatChanges) {
      if (change.to) transferSeat(this.state.seats, change.seatId, change.to);
      this.logEvent({
        type: 'seat_changed', timestamp: Date.now(),
        seatId: change.seatId, from: change.from, to: change.to,
      });
    }

    this.syncPlayerSeatCounts();
    recomputeChamberPositions(this.state.seats, computePlayerSeatCounts(this.state.seats));
    this.updateStateInfo();

    // Update government and PM
    const oldGov = this.state.players.find(p => p.isGovernment);
    if (oldGov?.leader) oldGov.leader.isPM = false;

    for (const p of this.state.players) {
      p.isGovernment = (p.id === elResult.newGovernmentId);
    }
    const newGov = this.state.players.find(p => p.isGovernment);
    if (newGov) {
      newGov.electionsWon++;
      if (newGov.leader) newGov.leader.isPM = true;
      this.logEvent({
        type: 'government_formed', timestamp: Date.now(),
        playerId: newGov.id, playerName: newGov.name, seats: newGov.seats,
      });
    }

    // Decay loyalty
    for (const vg of this.state.voterGroups) {
      for (const pid of Object.keys(vg.loyalty)) {
        vg.loyalty[pid] = (vg.loyalty[pid] || 0) * 0.5;
      }
    }

    const er: ElectionResult = {
      round: this.state.round,
      seatChanges: elResult.seatChanges,
      voteShare: elResult.voteShare,
      voterGroupVotes: elResult.voterGroupVotes,
      newGovernmentId: elResult.newGovernmentId,
      swingSeats: elResult.swingSeats,
    };
    this.state.electionHistory.push(er);
    this.logEvent({ type: 'election_held', timestamp: Date.now(), result: er });
    this.setPhase('election_results');

    if (this.state.round >= this.state.totalRounds) {
      this.endGame();
    }
  }

  // ── AI ─────────────────────────────────────────────────────

  private generateAIGovernmentActions(player: Player): void {
    const adjustments: PolicyAdjustment[] = [];
    const policies = Object.values(this.state.policies);
    const shuffled = [...policies].sort(() => this.rng() - 0.5);
    const numAdj = Math.min(this.config.policyAdjustmentsPerRound, 3 + Math.floor(this.rng() * 3));

    for (let i = 0; i < numAdj && i < shuffled.length; i++) {
      const policy = shuffled[i];
      const playerSocial = player.socialIdeology === 'progressive' ? 1 : -1;
      const playerEcon = player.economicIdeology === 'interventionist' ? 1 : -1;
      const desiredDir = (policy.ideologicalBias.social * playerSocial + policy.ideologicalBias.economic * playerEcon) / 2;
      let change = desiredDir * (0.05 + this.rng() * 0.1);

      switch (player.aiPersonality) {
        case 'hawk': change *= 1.3; break;
        case 'dove': change *= 0.7; break;
        case 'technocrat': change *= 0.6; break;
        case 'ideologue': change *= 1.5; break;
        case 'populist': change *= 0.8; break;
      }

      const newVal = Math.max(0, Math.min(1, policy.targetValue + change));
      if (Math.abs(newVal - policy.targetValue) > 0.01) {
        adjustments.push({ policyId: policy.id, newValue: newVal });
      }
    }

    this.submitPolicyAdjustments(player.id, adjustments);
  }

  private generateAIOppositionActions(player: Player): void {
    const actions: PlayerAction[] = [];

    for (let i = 0; i < this.config.actionsPerRound; i++) {
      const roll = this.rng();
      if (roll < 0.3) {
        const vg = this.state.voterGroups[Math.floor(this.rng() * this.state.voterGroups.length)];
        actions.push({ type: 'campaign', targetGroupId: vg.id });
      } else if (roll < 0.45 && this.state.situations.length > 0) {
        const sit = this.state.situations[Math.floor(this.rng() * this.state.situations.length)];
        actions.push({ type: 'attack_government', targetSituationId: sit.definitionId });
      } else if (roll < 0.6) {
        const policies = Object.values(this.state.policies);
        const p = policies[Math.floor(this.rng() * policies.length)];
        const playerSocial = player.socialIdeology === 'progressive' ? 1 : -1;
        const playerEcon = player.economicIdeology === 'interventionist' ? 1 : -1;
        const desired = (p.ideologicalBias.social * playerSocial + p.ideologicalBias.economic * playerEcon) / 2;
        actions.push({ type: 'shadow_policy', targetPolicyId: p.id, proposedValue: Math.max(0, Math.min(1, 0.5 + desired * 0.3)) });
      } else if (roll < 0.75) {
        actions.push({ type: 'fundraise' });
      } else if (roll < 0.85) {
        actions.push({ type: 'media_campaign' });
      } else {
        const vg = this.state.voterGroups[Math.floor(this.rng() * this.state.voterGroups.length)];
        actions.push({ type: 'grassroots', targetGroupId: vg.id });
      }
    }

    this.submitActions(player.id, actions);
  }

  private resolveAIDilemma(player: Player): void {
    if (!this.state.pendingDilemma) return;
    const idx = Math.floor(this.rng() * this.state.pendingDilemma.choices.length);
    this.resolveDilemma(player.id, this.state.pendingDilemma.choices[idx].id);
  }

  // ── Round Management ───────────────────────────────────────

  private advanceToNextRound(): void {
    this.state.round++;
    this.state.governmentAdjustments = [];
    this.state.oppositionActions = {};
    this.state.roundResults = [];

    for (const p of this.state.players) {
      p.submittedActions = false;
      p.submittedAdjustments = false;
    }

    this.logEvent({ type: 'round_started', timestamp: Date.now(), round: this.state.round });
    this.setPhase('government_action');

    const gov = this.state.players.find(p => p.isGovernment);
    if (gov?.isAI) this.generateAIGovernmentActions(gov);
  }

  private distributeIncome(): void {
    for (const player of this.state.players) {
      const income = player.seats * this.config.incomePerSeat;
      const govBonus = player.isGovernment ? Math.floor(income * 0.5) : 0;
      const total = income + govBonus;
      player.funds += total;
      if (total > 0) {
        this.logEvent({
          type: 'funds_changed', timestamp: Date.now(),
          playerId: player.id, delta: total,
          reason: player.isGovernment ? 'Seat income + government bonus' : 'Seat income',
        });
      }
    }
  }

  // ── Game End ───────────────────────────────────────────────

  private endGame(): void {
    const scores = this.computeScores();
    this.state.finalScores = scores;
    scores.sort((a, b) => b.total - a.total);
    this.state.winner = scores[0]?.playerId || null;
    this.setPhase('game_over');
    this.logEvent({ type: 'game_ended', timestamp: Date.now(), winner: this.state.winner || '', scores });
  }

  private computeScores(): PlayerScore[] {
    return this.state.players.map(p => {
      const seatScore = p.seats * 2;
      const lastElection = this.state.electionHistory[this.state.electionHistory.length - 1];
      const voteShare = lastElection ? (lastElection.voteShare[p.id] || 0) : 0;
      const ideologyScore = p.ideologyScore * 30;
      const govBonus = p.roundsAsGovernment * 2;
      const crisisPenalty = p.isGovernment
        ? this.state.situations.filter(s => s.severityType === 'crisis').length * 5
        : 0;
      const voterApproval = (p.approvalRating + 1) / 2 * 20;
      return {
        playerId: p.id, playerName: p.playerName, partyName: p.name, color: p.color,
        seats: seatScore, voteShare: voteShare * 20, ideologyScore,
        governmentBonus: govBonus, crisisPenalty: -crisisPenalty, voterApproval,
        total: seatScore + voteShare * 20 + ideologyScore + govBonus - crisisPenalty + voterApproval,
      };
    });
  }

  // ── Force Advance (host) ───────────────────────────────────

  forceAdvancePhase(): boolean {
    switch (this.state.phase) {
      case 'government_action': {
        const gov = this.state.players.find(p => p.isGovernment);
        if (gov && !gov.submittedAdjustments) this.submitPolicyAdjustments(gov.id, []);
        return true;
      }
      case 'opposition_action': {
        for (const p of this.state.players) {
          if (!p.isGovernment && !p.submittedActions) {
            this.state.oppositionActions[p.id] = [];
            p.submittedActions = true;
          }
        }
        this.checkAllOppositionSubmitted();
        return true;
      }
      case 'dilemma': {
        const gov = this.state.players.find(p => p.isGovernment);
        if (gov && this.state.pendingDilemma?.choices[0]) {
          this.resolveDilemma(gov.id, this.state.pendingDilemma.choices[0].id);
        }
        return true;
      }
      case 'round_summary': {
        this.postRoundSummary();
        return true;
      }
      case 'election_results': {
        if (this.state.round >= this.state.totalRounds) this.endGame();
        else this.advanceToNextRound();
        return true;
      }
      default: return false;
    }
  }

  // ── Helpers ────────────────────────────────────────────────

  private setPhase(phase: Phase): void {
    const from = this.state.phase;
    this.state.phase = phase;
    this.logEvent({ type: 'phase_changed', timestamp: Date.now(), from, to: phase });
  }

  private logEvent(event: GameEvent): void {
    this.state.eventLog.push(event);
  }

  private syncPlayerSeatCounts(): void {
    for (const p of this.state.players) {
      p.seats = Object.values(this.state.seats).filter(s => s.ownerPlayerId === p.id).length;
    }
  }

  private updateStateInfo(): void {
    const names: Record<StateCode, string> = {
      NSW: 'New South Wales', VIC: 'Victoria', QLD: 'Queensland',
      WA: 'Western Australia', SA: 'South Australia', TAS: 'Tasmania',
      ACT: 'Australian Capital Territory', NT: 'Northern Territory',
    };
    for (const code of ALL_STATES) {
      const stateSeats = Object.values(this.state.seats).filter(s => s.state === code);
      const ownedBy: Record<string, number> = {};
      for (const seat of stateSeats) {
        if (seat.ownerPlayerId) ownedBy[seat.ownerPlayerId] = (ownedBy[seat.ownerPlayerId] || 0) + 1;
      }
      this.state.stateInfo[code] = { code, name: names[code], seatCount: stateSeats.length, ownedBy };
    }
  }
}
