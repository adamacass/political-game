import { 
  GameState, 
  GameConfig, 
  Player, 
  Issue, 
  Phase,
  CampaignCard,
  PolicyCard,
  WildcardCard,
  PCapCard,
  GameEvent,
  Vote,
  SocialIdeology,
  EconomicIdeology,
  ChatMessage,
  GameAnalytics,
} from '../types';
import { SeededRNG } from './rng';
import { 
  getCampaignCards, 
  getPolicyCards, 
  getWildcardCards,
  getCampaignCard,
  getPolicyCard,
  getWildcardCard,
  DEFAULT_CONFIG,
  mergeConfig,
} from '../config/loader';

const PARTY_COLORS = ['#E53935', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA'];
const ISSUES: Issue[] = ['economy', 'cost_of_living', 'housing', 'climate', 'security'];

export class GameEngine {
  private state: GameState;
  private config: GameConfig;
  private rng: SeededRNG;

  constructor(roomId: string, config: Partial<GameConfig> = {}, seed?: string) {
    this.config = mergeConfig(config);
    this.rng = new SeededRNG(seed);
    this.state = this.createInitialState(roomId);
  }

  private createInitialState(roomId: string): GameState {
    return {
      roomId,
      seed: this.rng.getSeed(),
      phase: 'waiting',
      round: 0,
      players: [],
      turnOrder: [],
      currentPlayerIndex: 0,
      speakerIndex: 0,
      campaignDeck: [],
      campaignDiscard: [],
      policyDeck: [],
      policyDiscard: [],
      wildcardDeck: [],
      wildcardDiscard: [],
      totalSeats: this.config.totalSeats,
      activeIssue: ISSUES[0],
      issueTrack: [...ISSUES],
      playersDrawn: [],
      playersCampaigned: [],
      proposedPolicy: null,
      proposerId: null,
      votes: [],
      pendingWildcard: null,
      roundSeatChanges: {},
      activeEffects: [],
      eventLog: [],
      chatMessages: [],
      winner: null,
      finalScores: null,
    };
  }

  // ============================================================
  // STATE ACCESSORS
  // ============================================================

  getState(): GameState {
    return { ...this.state };
  }

  getConfig(): GameConfig {
    return { ...this.config };
  }

  getSeed(): string {
    return this.rng.getSeed();
  }

  // ============================================================
  // PLAYER MANAGEMENT
  // ============================================================

  addPlayer(
    id: string, 
    playerName: string, 
    partyName: string,
    socialIdeology?: SocialIdeology,
    economicIdeology?: EconomicIdeology
  ): Player | null {
    if (this.state.phase !== 'waiting') return null;
    if (this.state.players.length >= 5) return null;
    if (this.state.players.find(p => p.id === id)) return null;

    const idx = this.state.players.length;
    
    // Determine ideology based on mode
    let finalSocialIdeology: SocialIdeology;
    let finalEconomicIdeology: EconomicIdeology;
    
    if (this.config.ideologyMode === 'choose' && socialIdeology && economicIdeology) {
      // Player chose their ideology
      finalSocialIdeology = socialIdeology;
      finalEconomicIdeology = economicIdeology;
    } else {
      // Random assignment based on player index for variety
      const socialIdeologies: SocialIdeology[] = ['progressive', 'conservative'];
      const economicIdeologies: EconomicIdeology[] = ['market', 'interventionist'];
      finalSocialIdeology = socialIdeologies[this.rng.randomInt(0, 1)];
      finalEconomicIdeology = economicIdeologies[this.rng.randomInt(0, 1)];
    }

    const player: Player = {
      id,
      name: partyName || `Party ${idx + 1}`,
      playerName: playerName || `Player ${idx + 1}`,
      color: PARTY_COLORS[idx],
      socialIdeology: finalSocialIdeology,
      economicIdeology: finalEconomicIdeology,
      seats: 0,
      hand: [],
      pCapCards: [],
      connected: true,
    };

    this.state.players.push(player);
    this.logEvent({ 
      type: 'player_joined', 
      timestamp: Date.now(), 
      playerId: id, 
      playerName: player.playerName,
      partyName: player.name 
    });
    
    return player;
  }

  removePlayer(id: string): boolean {
    const idx = this.state.players.findIndex(p => p.id === id);
    if (idx === -1) return false;
    
    if (this.state.phase === 'waiting') {
      this.state.players.splice(idx, 1);
    } else {
      // During game, mark as disconnected
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

  // ============================================================
  // CHAT
  // ============================================================

  addChatMessage(message: ChatMessage): void {
    this.state.chatMessages.push(message);
    this.logEvent({
      type: 'chat_message',
      timestamp: message.timestamp,
      senderId: message.senderId,
      recipientId: message.recipientId,
      content: message.content,
    });
  }

  // ============================================================
  // GAME FLOW
  // ============================================================

  startGame(): boolean {
    if (this.state.phase !== 'waiting') return false;
    if (this.state.players.length < 2) return false;

    // Initialize decks
    this.initializeDecks();
    
    // Distribute initial seats evenly
    const seatsPerPlayer = Math.floor(this.config.totalSeats / this.state.players.length);
    const remainder = this.config.totalSeats % this.state.players.length;
    
    this.state.players.forEach((player, idx) => {
      player.seats = seatsPerPlayer + (idx < remainder ? 1 : 0);
    });

    // Set turn order
    this.state.turnOrder = this.rng.shuffle(this.state.players.map(p => p.id));
    
    // Draw initial hands
    this.state.players.forEach(player => {
      for (let i = 0; i < 3; i++) {
        this.drawCardForPlayer(player.id, i % 2 === 0 ? 'campaign' : 'policy');
      }
    });

    // Start first round
    this.state.round = 1;
    this.state.activeIssue = this.rng.pick(ISSUES);
    this.state.phase = 'draw';
    
    this.logEvent({ 
      type: 'game_started', 
      timestamp: Date.now(), 
      seed: this.rng.getSeed(),
      config: JSON.stringify(this.config),
    });
    this.logEvent({
      type: 'round_started',
      timestamp: Date.now(),
      round: this.state.round,
      activeIssue: this.state.activeIssue,
    });

    return true;
  }

  private initializeDecks(): void {
    // Create deck arrays from card IDs
    this.state.campaignDeck = this.rng.shuffle(getCampaignCards().map(c => c.id));
    this.state.policyDeck = this.rng.shuffle(getPolicyCards().map(c => c.id));
    this.state.wildcardDeck = this.rng.shuffle(getWildcardCards().map(c => c.id));
  }

  // ============================================================
  // DRAW PHASE
  // ============================================================

  drawCard(playerId: string, deckType: 'campaign' | 'policy'): boolean {
    if (this.state.phase !== 'draw') return false;
    if (this.state.playersDrawn.includes(playerId)) return false;
    
    const player = this.state.players.find(p => p.id === playerId);
    if (!player) return false;
    
    // Check hand limit
    if (player.hand.length >= this.config.handLimit) {
      // Auto-discard oldest card
      player.hand.shift();
    }

    const success = this.drawCardForPlayer(playerId, deckType);
    if (success) {
      this.state.playersDrawn.push(playerId);
      
      // Check if all players have drawn
      if (this.state.playersDrawn.length >= this.state.players.length) {
        this.advanceToCampaignPhase();
      }
    }
    
    return success;
  }

  private drawCardForPlayer(playerId: string, deckType: 'campaign' | 'policy'): boolean {
    const player = this.state.players.find(p => p.id === playerId);
    if (!player) return false;

    const deck = deckType === 'campaign' ? this.state.campaignDeck : this.state.policyDeck;
    if (deck.length === 0) {
      // Reshuffle discard
      const discard = deckType === 'campaign' ? this.state.campaignDiscard : this.state.policyDiscard;
      if (discard.length === 0) return false;
      
      const reshuffled = this.rng.shuffle([...discard]);
      if (deckType === 'campaign') {
        this.state.campaignDeck = reshuffled;
        this.state.campaignDiscard = [];
      } else {
        this.state.policyDeck = reshuffled;
        this.state.policyDiscard = [];
      }
    }

    const cardId = (deckType === 'campaign' ? this.state.campaignDeck : this.state.policyDeck).shift();
    if (!cardId) return false;

    const card = deckType === 'campaign' ? getCampaignCard(cardId) : getPolicyCard(cardId);
    if (!card) return false;

    player.hand.push(card as CampaignCard | PolicyCard);
    
    this.logEvent({
      type: 'card_drawn',
      timestamp: Date.now(),
      playerId,
      cardType: deckType,
      cardId,
    });

    return true;
  }

  private advanceToCampaignPhase(): void {
    this.state.phase = 'campaign';
    this.state.currentPlayerIndex = 0;
    this.state.playersCampaigned = [];
  }

  // ============================================================
  // CAMPAIGN PHASE
  // ============================================================

  playCampaignCard(playerId: string, cardId: string): boolean {
    if (this.state.phase !== 'campaign') return false;
    
    const currentPlayerId = this.state.turnOrder[this.state.currentPlayerIndex];
    if (playerId !== currentPlayerId) return false;
    if (this.state.playersCampaigned.includes(playerId)) return false;

    const player = this.state.players.find(p => p.id === playerId);
    if (!player) return false;

    const cardIndex = player.hand.findIndex(c => c.id === cardId && 'seatDelta' in c);
    if (cardIndex === -1) return false;

    const card = player.hand[cardIndex] as CampaignCard;
    player.hand.splice(cardIndex, 1);

    // Calculate seat delta
    let seatDelta = card.seatDelta;
    let agendaBonus = 0;

    // Apply agenda bonus
    if (card.issue && card.issue === this.state.activeIssue) {
      agendaBonus = this.config.agendaBonus;
      seatDelta += agendaBonus;
    }

    // Apply conditional modifiers
    if (card.conditional) {
      const leader = this.getSeatLeader();
      if (card.conditional.type === 'leader_penalty' && leader?.id === playerId) {
        seatDelta += card.conditional.modifier;
      } else if (card.conditional.type === 'underdog_bonus' && leader?.id !== playerId) {
        seatDelta += Math.abs(card.conditional.modifier);
      }
    }

    // Apply seat changes
    this.applySeatChange(playerId, seatDelta, `Campaign: ${card.name}`);
    
    // Discard card
    this.state.campaignDiscard.push(card.id);

    this.logEvent({
      type: 'campaign_played',
      timestamp: Date.now(),
      playerId,
      cardId,
      seatDelta,
      agendaBonus,
    });

    this.state.playersCampaigned.push(playerId);
    this.advanceCampaignTurn();

    return true;
  }

  skipCampaign(playerId: string): boolean {
    if (this.state.phase !== 'campaign') return false;
    
    const currentPlayerId = this.state.turnOrder[this.state.currentPlayerIndex];
    if (playerId !== currentPlayerId) return false;

    this.state.playersCampaigned.push(playerId);
    this.advanceCampaignTurn();
    return true;
  }

  private advanceCampaignTurn(): void {
    this.state.currentPlayerIndex++;
    
    if (this.state.currentPlayerIndex >= this.state.turnOrder.length) {
      this.advanceToPolicyPhase();
    }
  }

  // ============================================================
  // POLICY PHASE
  // ============================================================

  private advanceToPolicyPhase(): void {
    this.state.phase = 'policy_proposal';
    this.state.proposedPolicy = null;
    this.state.proposerId = null;
    this.state.votes = [];
  }

  proposePolicy(playerId: string, cardId: string): boolean {
    if (this.state.phase !== 'policy_proposal') return false;
    if (this.state.proposedPolicy) return false;

    // Check if player can propose (speaker rule)
    if (this.config.policyProposalRule === 'speaker_only') {
      const speakerId = this.state.turnOrder[this.state.speakerIndex];
      if (playerId !== speakerId) return false;
    }

    const player = this.state.players.find(p => p.id === playerId);
    if (!player) return false;
    if (player.seats < 1) return false; // Must have at least 1 seat

    const cardIndex = player.hand.findIndex(c => c.id === cardId && 'stanceTable' in c);
    if (cardIndex === -1) return false;

    const card = player.hand[cardIndex] as PolicyCard;
    player.hand.splice(cardIndex, 1);

    this.state.proposedPolicy = card;
    this.state.proposerId = playerId;
    this.state.phase = 'policy_vote';
    this.state.votes = [];

    this.logEvent({
      type: 'policy_proposed',
      timestamp: Date.now(),
      playerId,
      cardId,
    });

    return true;
  }

  skipProposal(playerId: string): boolean {
    if (this.state.phase !== 'policy_proposal') return false;
    
    if (this.config.policyProposalRule === 'speaker_only') {
      const speakerId = this.state.turnOrder[this.state.speakerIndex];
      if (playerId !== speakerId) return false;
    }

    this.advanceToIssueAdjustment();
    return true;
  }

  castVote(playerId: string, vote: 'yes' | 'no'): boolean {
    if (this.state.phase !== 'policy_vote') return false;
    if (!this.state.proposedPolicy) return false;
    if (this.state.votes.find(v => v.playerId === playerId)) return false;

    const player = this.state.players.find(p => p.id === playerId);
    if (!player) return false;

    this.state.votes.push({
      playerId,
      vote,
      seatWeight: player.seats,
    });

    this.logEvent({
      type: 'vote_cast',
      timestamp: Date.now(),
      playerId,
      vote,
      seatWeight: player.seats,
    });

    // Check if all players have voted
    if (this.state.votes.length >= this.state.players.length) {
      this.resolveVote();
    }

    return true;
  }

  private resolveVote(): void {
    const yesVotes = this.state.votes
      .filter(v => v.vote === 'yes')
      .reduce((sum, v) => sum + v.seatWeight, 0);
    const noVotes = this.state.votes
      .filter(v => v.vote === 'no')
      .reduce((sum, v) => sum + v.seatWeight, 0);

    const passed = yesVotes > noVotes || 
      (yesVotes === noVotes && this.config.voteTieBreaker === 'speaker_decides');

    this.logEvent({
      type: 'policy_resolved',
      timestamp: Date.now(),
      passed,
      yesVotes,
      noVotes,
    });

    if (passed) {
      this.state.phase = 'policy_resolution';
      this.resolvePolicyEffects();
    } else {
      // Discard the failed policy
      if (this.state.proposedPolicy) {
        this.state.policyDiscard.push(this.state.proposedPolicy.id);
      }
      this.state.proposedPolicy = null;
      this.state.proposerId = null;
      this.advanceToIssueAdjustment();
    }
  }

  private resolvePolicyEffects(): void {
    // CRITICAL FIX: Store references BEFORE any state changes
    const policy = this.state.proposedPolicy;
    const proposerId = this.state.proposerId;
    
    // Null checks to prevent crash
    if (!policy || !proposerId) {
      console.error('resolvePolicyEffects called with null policy or proposerId');
      this.advanceToIssueAdjustment();
      return;
    }
    
    const proposer = this.state.players.find(p => p.id === proposerId);
    if (!proposer) {
      console.error('Proposer not found:', proposerId);
      this.state.policyDiscard.push(policy.id);
      this.state.proposedPolicy = null;
      this.state.proposerId = null;
      this.advanceToIssueAdjustment();
      return;
    }

    // Award proposer reward
    this.awardPCap(proposerId, policy.proposerReward, policy.proposerRewardValue, `Proposed: ${policy.name}`);

    // Award ideology alignment rewards
    this.state.players.forEach(player => {
      const socialStance = policy.stanceTable[player.socialIdeology];
      const economicStance = policy.stanceTable[player.economicIdeology];
      
      let reward = 0;
      if (socialStance === 'favoured' && economicStance === 'favoured') {
        reward = this.config.ideologyRewards.doubleFavoured;
      } else if (socialStance === 'favoured' || economicStance === 'favoured') {
        reward = this.config.ideologyRewards.singleFavoured;
      }
      
      if (reward > 0) {
        this.awardPCap(player.id, 'ideological_credibility', reward, `Ideology aligned: ${policy.name}`);
      }
    });

    // Check for contrary backlash
    const proposerSocialStance = policy.stanceTable[proposer.socialIdeology];
    const proposerEconomicStance = policy.stanceTable[proposer.economicIdeology];
    
    if (proposerSocialStance === 'opposed' || proposerEconomicStance === 'opposed') {
      this.applySeatChange(
        proposerId, 
        -this.config.contraryBacklashSeats, 
        'Contrary backlash'
      );
    }

    // Discard policy AFTER all effects are resolved
    this.state.policyDiscard.push(policy.id);
    
    // Clear policy state AFTER discard
    this.state.proposedPolicy = null;
    // NOTE: Keep proposerId for wildcard effects!
    
    // Draw wildcard if enabled
    if (this.config.wildcardOnPolicyPass) {
      this.drawWildcard(proposerId);
    } else {
      this.state.proposerId = null;
      this.advanceToIssueAdjustment();
    }
  }

  private awardPCap(playerId: string, type: PCapCard['type'], value: number, reason: string): void {
    const player = this.state.players.find(p => p.id === playerId);
    if (!player) return;

    const card: PCapCard = {
      type,
      value,
      name: this.getPCapName(type),
      source: reason,
      roundAwarded: this.state.round,
    };

    player.pCapCards.push(card);

    this.logEvent({
      type: 'pcap_awarded',
      timestamp: Date.now(),
      playerId,
      type,
      value,
      reason,
    });
  }

  private getPCapName(type: PCapCard['type']): string {
    const names: Record<PCapCard['type'], string> = {
      mandate: 'Electoral Mandate',
      prime_ministership: 'Prime Ministership',
      landmark_reform: 'Landmark Reform',
      policy_win: 'Policy Victory',
      ideological_credibility: 'Ideological Credibility',
    };
    return names[type];
  }

  // ============================================================
  // WILDCARD PHASE
  // ============================================================

  private drawWildcard(proposerId: string): void {
    if (this.state.wildcardDeck.length === 0) {
      // Reshuffle
      if (this.state.wildcardDiscard.length > 0) {
        this.state.wildcardDeck = this.rng.shuffle([...this.state.wildcardDiscard]);
        this.state.wildcardDiscard = [];
      } else {
        this.state.proposerId = null;
        this.advanceToIssueAdjustment();
        return;
      }
    }

    const cardId = this.state.wildcardDeck.shift();
    if (!cardId) {
      this.state.proposerId = null;
      this.advanceToIssueAdjustment();
      return;
    }

    const card = getWildcardCard(cardId);
    if (!card) {
      this.state.proposerId = null;
      this.advanceToIssueAdjustment();
      return;
    }

    this.state.pendingWildcard = card;
    this.state.phase = 'wildcard_resolution';

    this.logEvent({
      type: 'wildcard_drawn',
      timestamp: Date.now(),
      playerId: proposerId,
      cardId,
    });
  }

  acknowledgeWildcard(playerId: string): boolean {
    if (this.state.phase !== 'wildcard_resolution') return false;
    if (!this.state.pendingWildcard) return false;

    this.resolveWildcard();
    return true;
  }

  private resolveWildcard(): void {
    const card = this.state.pendingWildcard;
    if (!card) {
      this.state.proposerId = null;
      this.advanceToIssueAdjustment();
      return;
    }
    
    const effects: { playerId: string; seatDelta: number }[] = [];
    const proposerId = this.state.proposerId;

    switch (card.effect.type) {
      case 'leader_erosion': {
        const leader = this.getSeatLeader();
        if (leader) {
          this.applySeatChange(leader.id, card.effect.seatDelta, `Wildcard: ${card.name}`);
          effects.push({ playerId: leader.id, seatDelta: card.effect.seatDelta });
        }
        break;
      }
      case 'all_players': {
        this.state.players.forEach(player => {
          this.applySeatChange(player.id, card.effect.seatDelta, `Wildcard: ${card.name}`);
          effects.push({ playerId: player.id, seatDelta: card.effect.seatDelta });
        });
        break;
      }
      case 'proposer': {
        if (proposerId) {
          this.applySeatChange(proposerId, card.effect.seatDelta, `Wildcard: ${card.name}`);
          effects.push({ playerId: proposerId, seatDelta: card.effect.seatDelta });
        }
        break;
      }
      case 'issue_conditional': {
        if (card.effect.issue === this.state.activeIssue && proposerId) {
          const bonus = card.effect.issueBonus || 1;
          this.applySeatChange(proposerId, bonus, `Wildcard: ${card.name} (issue match)`);
          effects.push({ playerId: proposerId, seatDelta: bonus });
        } else {
          const leader = this.getSeatLeader();
          if (leader) {
            this.applySeatChange(leader.id, card.effect.seatDelta, `Wildcard: ${card.name}`);
            effects.push({ playerId: leader.id, seatDelta: card.effect.seatDelta });
          }
        }
        break;
      }
    }

    this.logEvent({
      type: 'wildcard_resolved',
      timestamp: Date.now(),
      cardId: card.id,
      effects,
    });

    this.state.wildcardDiscard.push(card.id);
    this.state.pendingWildcard = null;
    this.state.proposerId = null;
    this.advanceToIssueAdjustment();
  }

  // ============================================================
  // ISSUE ADJUSTMENT PHASE
  // ============================================================

  private advanceToIssueAdjustment(): void {
    this.state.phase = 'issue_adjustment';
    
    // Auto-resolve if using certain rules
    if (this.config.issueAdjustmentRule === 'random') {
      const direction = this.rng.randomInt(-1, 1);
      this.adjustIssue(this.state.turnOrder[0], direction as -1 | 0 | 1);
    }
  }

  adjustIssue(playerId: string, direction: -1 | 0 | 1): boolean {
    if (this.state.phase !== 'issue_adjustment') return false;

    // Verify player eligibility
    if (this.config.issueAdjustmentRule === 'most_seats_gained') {
      const maxGain = Math.max(...Object.values(this.state.roundSeatChanges), 0);
      const eligiblePlayers = Object.entries(this.state.roundSeatChanges)
        .filter(([_, gain]) => gain === maxGain)
        .map(([id]) => id);
      
      if (eligiblePlayers.length === 0 || maxGain <= 0) {
        // No one gained seats, leader chooses
        const leader = this.getSeatLeader();
        if (leader && playerId !== leader.id) return false;
      } else if (!eligiblePlayers.includes(playerId)) {
        return false;
      }
    }

    if (direction !== 0) {
      const oldIssue = this.state.activeIssue;
      const currentIndex = ISSUES.indexOf(this.state.activeIssue);
      const newIndex = Math.max(0, Math.min(ISSUES.length - 1, currentIndex + direction));
      this.state.activeIssue = ISSUES[newIndex];

      if (oldIssue !== this.state.activeIssue) {
        this.logEvent({
          type: 'issue_changed',
          timestamp: Date.now(),
          oldIssue,
          newIssue: this.state.activeIssue,
          changedBy: playerId,
        });
      }
    }

    this.advanceToNextRound();
    return true;
  }

  // ============================================================
  // ROUND MANAGEMENT
  // ============================================================

  private advanceToNextRound(): void {
    // Check end conditions
    const decksEmpty = 
      this.state.campaignDeck.length === 0 && 
      this.state.campaignDiscard.length === 0 &&
      this.state.policyDeck.length === 0 &&
      this.state.policyDiscard.length === 0;

    const maxRoundsReached = 
      this.config.maxRounds !== null && 
      this.state.round >= this.config.maxRounds;

    if (decksEmpty || maxRoundsReached) {
      this.endGame();
      return;
    }

    // Start new round
    this.state.round++;
    this.state.playersDrawn = [];
    this.state.playersCampaigned = [];
    this.state.roundSeatChanges = {};
    this.state.speakerIndex = (this.state.speakerIndex + 1) % this.state.players.length;
    this.state.phase = 'draw';
    this.state.currentPlayerIndex = 0;

    this.logEvent({
      type: 'round_started',
      timestamp: Date.now(),
      round: this.state.round,
      activeIssue: this.state.activeIssue,
    });
  }

  // ============================================================
  // END GAME
  // ============================================================

  private endGame(): void {
    this.state.phase = 'game_over';

    // Award mandate to seat leader
    const seatLeader = this.getSeatLeader();
    if (seatLeader) {
      this.awardPCap(seatLeader.id, 'mandate', this.config.mandateValue, 'Most seats at election');
      this.awardPCap(seatLeader.id, 'prime_ministership', this.config.pmValue, 'Formed government');
    }

    // Calculate final scores
    const scores: Record<string, number> = {};
    this.state.players.forEach(player => {
      scores[player.id] = player.pCapCards.reduce((sum, card) => sum + card.value, 0);
    });

    this.state.finalScores = scores;

    // Determine winner
    const maxScore = Math.max(...Object.values(scores));
    const winners = Object.entries(scores).filter(([_, score]) => score === maxScore);
    
    if (winners.length === 1) {
      this.state.winner = winners[0][0];
    } else {
      // Tie-breaker: most seats
      const tiedPlayers = winners.map(([id]) => this.state.players.find(p => p.id === id)!);
      const maxSeats = Math.max(...tiedPlayers.map(p => p.seats));
      const seatWinner = tiedPlayers.find(p => p.seats === maxSeats);
      this.state.winner = seatWinner?.id || winners[0][0];
    }

    this.logEvent({
      type: 'game_ended',
      timestamp: Date.now(),
      winner: this.state.winner,
      scores,
    });
  }

  // ============================================================
  // SEAT MANAGEMENT
  // ============================================================

  private applySeatChange(playerId: string, delta: number, reason: string): void {
    const player = this.state.players.find(p => p.id === playerId);
    if (!player) return;

    if (delta > 0) {
      // Gaining seats - take from leader (or distribute)
      this.transferSeatsTo(player, delta);
    } else if (delta < 0) {
      // Losing seats
      const actualLoss = Math.min(player.seats, Math.abs(delta));
      player.seats -= actualLoss;
      // Distribute lost seats to others proportionally
      this.redistributeSeats(playerId, actualLoss);
    }

    // Track round changes
    this.state.roundSeatChanges[playerId] = 
      (this.state.roundSeatChanges[playerId] || 0) + delta;

    this.logEvent({
      type: 'seats_changed',
      timestamp: Date.now(),
      playerId,
      delta,
      newTotal: player.seats,
      reason,
    });
  }

  private transferSeatsTo(recipient: Player, amount: number): void {
    let remaining = amount;

    if (this.config.seatTransferRule === 'from_leader') {
      const leader = this.getSeatLeader();
      if (leader && leader.id !== recipient.id) {
        const take = Math.min(leader.seats, remaining);
        leader.seats -= take;
        recipient.seats += take;
        remaining -= take;
      }
    }

    // If still need seats, take from all others proportionally
    if (remaining > 0) {
      const others = this.state.players.filter(p => p.id !== recipient.id && p.seats > 0);
      const totalOtherSeats = others.reduce((sum, p) => sum + p.seats, 0);
      
      if (totalOtherSeats > 0) {
        others.forEach(other => {
          const take = Math.min(
            other.seats,
            Math.ceil((other.seats / totalOtherSeats) * remaining)
          );
          other.seats -= take;
          recipient.seats += take;
        });
      }
    }

    // Ensure total seats remain constant
    this.normalizeSeats();
  }

  private redistributeSeats(fromPlayerId: string, amount: number): void {
    const others = this.state.players.filter(p => p.id !== fromPlayerId);
    if (others.length === 0) return;

    const perPlayer = Math.floor(amount / others.length);
    let remainder = amount % others.length;

    others.forEach(player => {
      player.seats += perPlayer;
      if (remainder > 0) {
        player.seats += 1;
        remainder--;
      }
    });
  }

  private normalizeSeats(): void {
    const total = this.state.players.reduce((sum, p) => sum + p.seats, 0);
    const diff = this.config.totalSeats - total;
    
    if (diff !== 0) {
      // Adjust the leader's seats to maintain total
      const leader = this.getSeatLeader();
      if (leader) {
        leader.seats += diff;
      }
    }
  }

  private getSeatLeader(): Player | null {
    if (this.state.players.length === 0) return null;
    return this.state.players.reduce((leader, player) => 
      player.seats > leader.seats ? player : leader
    );
  }

  // ============================================================
  // EVENT LOGGING
  // ============================================================

  private logEvent(event: GameEvent): void {
    this.state.eventLog.push(event);
  }

  getEventLog(): GameEvent[] {
    return [...this.state.eventLog];
  }

  // ============================================================
  // ANALYTICS
  // ============================================================

  getAnalytics(): GameAnalytics {
    const scoreBreakdown: GameAnalytics['scoreBreakdown'] = {};
    const seatHistoryPerRound: GameAnalytics['seatHistoryPerRound'] = {};

    this.state.players.forEach(player => {
      scoreBreakdown[player.id] = {
        proposerRewards: player.pCapCards
          .filter(c => c.type === 'policy_win' || c.type === 'landmark_reform')
          .reduce((sum, c) => sum + c.value, 0),
        ideologyAlignment: player.pCapCards
          .filter(c => c.type === 'ideological_credibility')
          .reduce((sum, c) => sum + c.value, 0),
        endgameAwards: player.pCapCards
          .filter(c => c.type === 'mandate' || c.type === 'prime_ministership')
          .reduce((sum, c) => sum + c.value, 0),
        total: player.pCapCards.reduce((sum, c) => sum + c.value, 0),
      };
      seatHistoryPerRound[player.id] = [];
    });

    // Count events
    let policiesProposed = 0;
    let policiesPassed = 0;
    let seatLeaderChanges = 0;
    let lastLeader: string | null = null;

    this.state.eventLog.forEach(event => {
      if (event.type === 'policy_proposed') policiesProposed++;
      if (event.type === 'policy_resolved' && event.passed) policiesPassed++;
      if (event.type === 'seats_changed') {
        // Track leader changes (simplified)
        const currentLeader = this.getSeatLeader()?.id;
        if (lastLeader && currentLeader !== lastLeader) {
          seatLeaderChanges++;
        }
        lastLeader = currentLeader || null;
      }
    });

    return {
      totalRounds: this.state.round,
      policiesProposed,
      policiesPassed,
      seatLeaderChanges,
      scoreBreakdown,
      seatHistoryPerRound,
      winnerWasSeatLeader: this.state.winner === this.getSeatLeader()?.id,
    };
  }

  // ============================================================
  // CONFIG UPDATE
  // ============================================================

  updateConfig(newConfig: Partial<GameConfig>): void {
    this.config = mergeConfig({ ...this.config, ...newConfig });
  }
}
