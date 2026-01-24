import {
  GameState, GameConfig, Player, Issue, Phase, CampaignCard, PolicyCard, WildcardCard, PCapCard,
  GameEvent, Vote, SocialIdeology, EconomicIdeology, ChatMessage, HandCard, IdeologyProfile,
  TradeOffer, NegotiationState, PendingCampaign, CampaignPlayedRecord, PolicyResultRecord,
  WildcardRecord, TradeRecord, HistorySnapshot, PartyColorId, PARTY_COLORS,
  Seat, SeatId, PendingSeatCapture, EconBucket, SocialBucket, StateCode, StateControl,
} from '../types';
import { SeededRNG } from './rng';
import { getCampaignCards, getPolicyCards, getWildcardCards, getCampaignCard, getPolicyCard, getWildcardCard, mergeConfig } from '../config/loader';
import { v4 as uuidv4 } from 'uuid';
import {
  generateSeatMap, computePlayerSeatCounts, getEligibleSeatsForCapture,
  transferSeat, deriveIdeologyFromCard, getPlayerSeats, computeStateControl, compareStateControl,
} from './mapGen';

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
      roomId, seed: this.rng.getSeed(), phase: 'waiting', round: 0, players: [], turnOrder: [],
      currentPlayerIndex: 0, speakerIndex: 0, campaignDeck: [], campaignDiscard: [], policyDeck: [],
      policyDiscard: [], wildcardDeck: [], wildcardDiscard: [], totalSeats: this.config.totalSeats,
      activeIssue: ISSUES[0], issueTrack: [...ISSUES],
      // NEW: Australian electoral map seats
      seats: {},
      mapSeed: this.rng.getSeed(),
      // State control tracking (initialized after seat map generation)
      stateControl: {} as Record<StateCode, StateControl>,
      playersDrawn: [], playersCampaigned: [],
      proposedPolicy: null, proposerId: null, votes: [], pendingWildcard: null, pendingCampaign: null,
      // NEW: Seat capture pending state
      pendingSeatCapture: null,
      negotiation: { activeOffers: [], completedTrades: [], playersReady: [] },
      campaignsPlayedByPlayer: {}, roundSeatChanges: {}, roundCampaignsPlayed: [], roundPolicyResult: null,
      roundWildcardDrawn: null, roundIssueChangedTo: null, roundTradesCompleted: [], roundPCapChanges: [],
      activeEffects: [], eventLog: [], chatMessages: [], history: [], winner: null, finalScores: null, takenColors: [],
    };
  }

  getState(): GameState { return { ...this.state }; }
  getConfig(): GameConfig { return { ...this.config }; }
  getSeed(): string { return this.rng.getSeed(); }
  getAvailableColors(): PartyColorId[] { 
    const allColorIds = PARTY_COLORS.map(c => c.id) as PartyColorId[];
    return allColorIds.filter(id => !this.state.takenColors.includes(id)); 
  }

  addPlayer(id: string, playerName: string, partyName: string, colorId?: PartyColorId, symbolId?: string, socialIdeology?: SocialIdeology, economicIdeology?: EconomicIdeology): Player | null {
    if (this.state.phase !== 'waiting' || this.state.players.length >= 5 || this.state.players.find(p => p.id === id)) return null;

    // Get available colors and select one
    const availableColors = this.getAvailableColors();
    let finalColorId: PartyColorId = colorId && !this.state.takenColors.includes(colorId) ? colorId : availableColors[0];
    if (!finalColorId) return null;
    this.state.takenColors.push(finalColorId);

    // Look up the hex color - with explicit fallback and logging
    const colorEntry = PARTY_COLORS.find(c => c.id === finalColorId);
    const colorHex = colorEntry?.hex || '#666666';
    console.log(`[ADD_PLAYER] colorId=${finalColorId}, colorEntry=`, colorEntry, `colorHex=${colorHex}`);

    // Default symbol if not provided
    const finalSymbolId = symbolId || 'landmark';

    // Determine ideology
    let finalSocial: SocialIdeology, finalEconomic: EconomicIdeology;
    if (this.config.ideologyMode === 'choose' && socialIdeology && economicIdeology) {
      finalSocial = socialIdeology;
      finalEconomic = economicIdeology;
    } else if (this.config.ideologyMode === 'derived') {
      finalSocial = 'progressive';
      finalEconomic = 'market';
    } else {
      finalSocial = (['progressive', 'conservative'] as SocialIdeology[])[this.rng.randomInt(0, 1)];
      finalEconomic = (['market', 'interventionist'] as EconomicIdeology[])[this.rng.randomInt(0, 1)];
    }

    const player: Player = {
      id,
      name: partyName || `Party ${this.state.players.length + 1}`,
      playerName: playerName || `Player ${this.state.players.length + 1}`,
      colorId: finalColorId,
      color: colorHex,
      symbolId: finalSymbolId,
      socialIdeology: finalSocial,
      economicIdeology: finalEconomic,
      ideologyProfile: {
        progressiveActions: 0, conservativeActions: 0,
        marketActions: 0, interventionistActions: 0,
        socialScore: 50, economicScore: 50,
        dominantSocial: 'neutral', dominantEconomic: 'neutral'
      },
      seats: 0,
      hand: [],
      pCapCards: [],
      connected: true,
      hasSkippedThisRound: false
    };

    this.state.players.push(player);
    this.logEvent({ type: 'player_joined', timestamp: Date.now(), playerId: id, playerName: player.playerName, partyName: player.name, colorId: finalColorId, symbolId: finalSymbolId });
    console.log(`[ADD_PLAYER] Created player with color: ${player.color}, symbol: ${finalSymbolId}`);
    return player;
  }

  removePlayer(id: string): boolean { const idx = this.state.players.findIndex(p => p.id === id); if (idx === -1) return false; if (this.state.phase === 'waiting') { this.state.takenColors = this.state.takenColors.filter(c => c !== this.state.players[idx].colorId); this.state.players.splice(idx, 1); } else this.state.players[idx].connected = false; return true; }
  reconnectPlayer(id: string): boolean { const p = this.state.players.find(p => p.id === id); if (!p) return false; p.connected = true; return true; }
  addChatMessage(m: ChatMessage): void { this.state.chatMessages.push(m); this.logEvent({ type: 'chat_message', timestamp: m.timestamp, senderId: m.senderId, recipientId: m.recipientId, content: m.content }); }

  startGame(): boolean {
    if (this.state.phase !== 'waiting' || this.state.players.length < 2) return false;
    this.state.campaignDeck = this.rng.shuffle(getCampaignCards().map(c => c.id));
    this.state.policyDeck = this.rng.shuffle(getPolicyCards().map(c => c.id));
    this.state.wildcardDeck = this.rng.shuffle(getWildcardCards().map(c => c.id));

    // NEW: Generate Australian electoral map seats
    this.state.mapSeed = this.rng.getSeed() + '_map';
    this.state.seats = generateSeatMap({
      seatCount: this.config.totalSeats,
      seed: this.state.mapSeed,
      playerIds: this.state.players.map(p => p.id),
      ideologyMode: this.config.seatIdeologyMode || 'random',
    });

    // Sync player seat counts from seat ownership (seats are authoritative)
    this.syncPlayerSeatCounts();

    // Initialize state control tracking
    this.state.stateControl = computeStateControl(this.state.seats);

    this.state.turnOrder = this.rng.shuffle(this.state.players.map(p => p.id));
    // Deal random starting hands (mix of campaign and policy)
    this.state.players.forEach(p => {
      for (let i = 0; i < this.config.handLimit; i++) {
        const deckType = this.rng.randomInt(0, 1) === 0 ? 'campaign' : 'policy';
        this.drawCardForPlayer(p.id, deckType, false, false);
      }
      p.hand.forEach(h => h.isNew = false);
    });
    this.state.round = 1;
    this.state.activeIssue = this.rng.pick(ISSUES);
    this.resetRoundTracking();
    // Round 1: Skip draw phase, go straight to negotiation/campaign
    if (this.config.enableNegotiation) {
      this.state.phase = 'negotiation';
      this.state.negotiation.playersReady = [];
    } else {
      this.state.phase = 'campaign';
      this.state.currentPlayerIndex = 0;
      this.state.playersCampaigned = [];
    }
    this.logEvent({ type: 'game_started', timestamp: Date.now(), seed: this.rng.getSeed(), config: JSON.stringify(this.config) });
    this.logEvent({ type: 'round_started', timestamp: Date.now(), round: this.state.round, activeIssue: this.state.activeIssue });
    return true;
  }

  /**
   * Sync player.seats from the authoritative seat map
   */
  private syncPlayerSeatCounts(): void {
    const counts = computePlayerSeatCounts(this.state.seats);
    for (const player of this.state.players) {
      player.seats = counts[player.id] || 0;
    }
    // Check for state control changes and award PCap
    this.checkStateControlChanges();
  }

  /**
   * Check for state control changes and award PCap for gaining control of a state
   */
  private checkStateControlChanges(): void {
    const oldControl = this.state.stateControl;
    const newControl = computeStateControl(this.state.seats);

    // Compare and find changes
    const changes = compareStateControl(oldControl, newControl);

    // Award PCap for gaining control of a state
    const stateControlValue = this.config.stateControlValue || 1;
    for (const { playerId, state } of changes.gained) {
      const player = this.state.players.find(p => p.id === playerId);
      if (player) {
        const pCapCard: PCapCard = {
          type: 'state_control',
          value: stateControlValue,
          name: `${state} Control`,
          source: `Gained majority in ${state}`,
          roundAwarded: this.state.round,
        };
        player.pCapCards.push(pCapCard);
        this.logEvent({
          type: 'pcap_awarded',
          timestamp: Date.now(),
          playerId,
          pCapType: 'state_control',
          value: stateControlValue,
          reason: `Gained control of ${state}`,
        });
        this.state.roundPCapChanges.push({
          playerId,
          pCapDelta: stateControlValue,
          seatDelta: 0,
          reason: `Gained control of ${state}`,
          changeType: 'award',
          timestamp: Date.now(),
        });
      }
    }

    // Note: We don't remove PCap for losing control (it was already earned)
    // But we could log the loss for UI purposes

    // Update state control tracking
    this.state.stateControl = newControl;
  }

  private resetRoundTracking(): void {
    this.state.roundSeatChanges = {}; this.state.roundCampaignsPlayed = []; this.state.roundPolicyResult = null;
    this.state.roundWildcardDrawn = null; this.state.roundIssueChangedTo = null; this.state.roundTradesCompleted = []; this.state.roundPCapChanges = [];
    this.state.players.forEach(p => { p.hasSkippedThisRound = false; p.hand.forEach(h => { if (h.drawnRound < this.state.round) h.isNew = false; }); });
    this.state.negotiation = { activeOffers: [], completedTrades: [], playersReady: [] };
  }

  // New draw phase: replenish hand to handLimit, player chooses card type for EACH card needed
  drawCard(playerId: string, deckType: 'campaign' | 'policy'): boolean {
    if (this.state.phase !== 'draw') return false;
    const player = this.state.players.find(p => p.id === playerId);
    if (!player) return false;
    
    // Can only draw if hand is below limit
    if (player.hand.length >= this.config.handLimit) {
      // Player's hand is full, mark them as done
      if (!this.state.playersDrawn.includes(playerId)) {
        this.state.playersDrawn.push(playerId);
        if (this.checkAllPlayersDrawn()) this.advanceFromDrawPhase();
      }
      return false;
    }
    
    // Draw the card
    if (this.drawCardForPlayer(playerId, deckType, true, true)) {
      // Check if player's hand is now full
      if (player.hand.length >= this.config.handLimit) {
        if (!this.state.playersDrawn.includes(playerId)) {
          this.state.playersDrawn.push(playerId);
        }
      }
      // Check if all players are done
      if (this.checkAllPlayersDrawn()) this.advanceFromDrawPhase();
      return true;
    }
    return false;
  }

  private checkAllPlayersDrawn(): boolean {
    return this.state.players.every(p => p.hand.length >= this.config.handLimit || this.state.playersDrawn.includes(p.id));
  }

  // Get how many cards a player needs to draw
  getCardsNeeded(playerId: string): number {
    const player = this.state.players.find(p => p.id === playerId);
    if (!player) return 0;
    return Math.max(0, this.config.handLimit - player.hand.length);
  }

  private drawCardForPlayer(playerId: string, deckType: 'campaign' | 'policy', logIt: boolean, markNew: boolean): boolean {
    const player = this.state.players.find(p => p.id === playerId); if (!player) return false;
    let deck = deckType === 'campaign' ? this.state.campaignDeck : this.state.policyDeck;
    if (deck.length === 0) { const discard = deckType === 'campaign' ? this.state.campaignDiscard : this.state.policyDiscard; if (discard.length === 0) return false; const reshuffled = this.rng.shuffle([...discard]); if (deckType === 'campaign') { this.state.campaignDeck = reshuffled; this.state.campaignDiscard = []; deck = this.state.campaignDeck; } else { this.state.policyDeck = reshuffled; this.state.policyDiscard = []; deck = this.state.policyDeck; } }
    const cardId = deck.shift(); if (!cardId) return false;
    const card = deckType === 'campaign' ? getCampaignCard(cardId) : getPolicyCard(cardId); if (!card) return false;
    player.hand.push({ card: card as CampaignCard | PolicyCard, isNew: markNew, drawnRound: this.state.round });
    if (logIt) this.logEvent({ type: 'card_drawn', timestamp: Date.now(), playerId, cardType: deckType, cardId });
    return true;
  }

  skipAndReplace(playerId: string, cardId: string): boolean {
    if (!this.config.allowSkipReplace || this.state.phase !== 'campaign' || this.state.turnOrder[this.state.currentPlayerIndex] !== playerId) return false;
    const player = this.state.players.find(p => p.id === playerId); if (!player || player.hasSkippedThisRound) return false;
    const ci = player.hand.findIndex(h => h.card.id === cardId); if (ci === -1) return false;
    const disc = player.hand.splice(ci, 1)[0];
    ('seatDelta' in disc.card ? this.state.campaignDiscard : this.state.policyDiscard).push(disc.card.id);
    const newType = this.rng.randomInt(0, 1) === 0 ? 'campaign' : 'policy';
    this.drawCardForPlayer(playerId, newType, false, true);
    this.logEvent({ type: 'card_replaced', timestamp: Date.now(), playerId, discardedCardId: disc.card.id, newCardId: player.hand[player.hand.length - 1].card.id, newCardType: newType });
    player.hasSkippedThisRound = true; this.state.playersCampaigned.push(playerId); this.advanceCampaignTurn(); return true;
  }

  // Auto-refill is now disabled by default - players replenish in draw phase
  // This method is kept for backwards compatibility but does nothing unless explicitly enabled
  private refillHand(playerId: string, pref: 'campaign' | 'policy'): void {
    // Disabled - players now manually draw at start of each round
    return;
  }

  private advanceFromDrawPhase(): void { if (this.config.enableNegotiation) { this.state.phase = 'negotiation'; this.state.negotiation.playersReady = []; } else this.advanceToCampaignPhase(); }

  makeTradeOffer(fromId: string, toId: string, offered: string[], requested: string[]): TradeOffer | null {
    if (this.state.phase !== 'negotiation' || fromId === toId) return null;
    const from = this.state.players.find(p => p.id === fromId), to = this.state.players.find(p => p.id === toId); if (!from || !to) return null;
    for (const id of offered) if (!from.hand.find(h => h.card.id === id)) return null;
    for (const id of requested) if (!to.hand.find(h => h.card.id === id)) return null;
    const offer: TradeOffer = { id: uuidv4(), fromPlayerId: fromId, toPlayerId: toId, offeredCardIds: offered, requestedCardIds: requested, status: 'pending', timestamp: Date.now(), expiresAt: this.config.negotiationTimeLimit > 0 ? Date.now() + this.config.negotiationTimeLimit * 1000 : 0 };
    this.state.negotiation.activeOffers.push(offer); this.logEvent({ type: 'trade_offered', timestamp: Date.now(), offerId: offer.id, fromPlayerId: fromId, toPlayerId: toId }); return offer;
  }

  respondToOffer(playerId: string, offerId: string, accept: boolean): boolean {
    if (this.state.phase !== 'negotiation') return false;
    const idx = this.state.negotiation.activeOffers.findIndex(o => o.id === offerId); if (idx === -1) return false;
    const offer = this.state.negotiation.activeOffers[idx]; if (offer.toPlayerId !== playerId || offer.status !== 'pending') return false;
    if (accept) { if (!this.executeTrade(offer)) return false; offer.status = 'accepted'; this.logEvent({ type: 'trade_accepted', timestamp: Date.now(), offerId }); this.logEvent({ type: 'trade_completed', timestamp: Date.now(), offerId, fromPlayerId: offer.fromPlayerId, toPlayerId: offer.toPlayerId, cardsExchanged: offer.offeredCardIds.length + offer.requestedCardIds.length }); this.state.negotiation.completedTrades.push({ offer, completedAt: Date.now() }); this.state.roundTradesCompleted.push({ fromPlayerId: offer.fromPlayerId, toPlayerId: offer.toPlayerId, cardsExchanged: offer.offeredCardIds.length + offer.requestedCardIds.length }); }
    else { offer.status = 'rejected'; this.logEvent({ type: 'trade_rejected', timestamp: Date.now(), offerId }); }
    this.state.negotiation.activeOffers.splice(idx, 1); return true;
  }

  private executeTrade(offer: TradeOffer): boolean {
    const from = this.state.players.find(p => p.id === offer.fromPlayerId), to = this.state.players.find(p => p.id === offer.toPlayerId); if (!from || !to) return false;
    const offered: HandCard[] = []; for (const id of offer.offeredCardIds) { const i = from.hand.findIndex(h => h.card.id === id); if (i === -1) return false; offered.push(from.hand.splice(i, 1)[0]); }
    const requested: HandCard[] = []; for (const id of offer.requestedCardIds) { const i = to.hand.findIndex(h => h.card.id === id); if (i === -1) { from.hand.push(...offered); return false; } requested.push(to.hand.splice(i, 1)[0]); }
    offered.forEach(h => { h.isNew = true; h.drawnRound = this.state.round; to.hand.push(h); });
    requested.forEach(h => { h.isNew = true; h.drawnRound = this.state.round; from.hand.push(h); }); return true;
  }

  cancelOffer(playerId: string, offerId: string): boolean { if (this.state.phase !== 'negotiation') return false; const i = this.state.negotiation.activeOffers.findIndex(o => o.id === offerId); if (i === -1 || this.state.negotiation.activeOffers[i].fromPlayerId !== playerId) return false; this.state.negotiation.activeOffers.splice(i, 1); return true; }
  markNegotiationReady(playerId: string): boolean { if (this.state.phase !== 'negotiation' || this.state.negotiation.playersReady.includes(playerId)) return false; this.state.negotiation.playersReady.push(playerId); this.logEvent({ type: 'negotiation_ready', timestamp: Date.now(), playerId }); if (this.state.negotiation.playersReady.length >= this.state.players.length) this.advanceToCampaignPhase(); return true; }
  private advanceToCampaignPhase(): void { this.state.phase = 'campaign'; this.state.currentPlayerIndex = 0; this.state.playersCampaigned = []; }

  playCampaignCard(playerId: string, cardId: string): boolean {
    if (this.state.phase !== 'campaign' || this.state.turnOrder[this.state.currentPlayerIndex] !== playerId || this.state.playersCampaigned.includes(playerId)) return false;
    const player = this.state.players.find(p => p.id === playerId); if (!player) return false;
    const ci = player.hand.findIndex(h => h.card.id === cardId && 'seatDelta' in h.card); if (ci === -1) return false;
    const card = player.hand[ci].card as CampaignCard;
    let seatDelta = card.seatDelta, agendaBonus = 0;
    if (card.issue && card.issue === this.state.activeIssue) { agendaBonus = this.config.agendaBonus; seatDelta += agendaBonus; }
    if (card.conditional) { const leader = this.getSeatLeader(); if (card.conditional.type === 'leader_penalty' && leader?.id === playerId) seatDelta += card.conditional.modifier; else if (card.conditional.type === 'underdog_bonus' && leader?.id !== playerId) seatDelta += Math.abs(card.conditional.modifier); }
    if (this.config.ideologyMode === 'derived' && card.stanceTable) {
      const cons = this.checkCardConsistency(player, card.stanceTable);
      if (cons === 'aligned') this.awardPCap(playerId, 'ideological_credibility', 1, `Aligned campaign: ${card.name}`);
      else if (cons === 'contrary') { this.applySeatChange(playerId, -1, `Contrary campaign: ${card.name}`); this.logPCapChange(playerId, 0, -1, `Contrary: ${card.name}`, 'penalty'); }
      this.updateIdeologyForStanceTable(playerId, card.stanceTable, 1);
    }
    if (!this.state.campaignsPlayedByPlayer[playerId]) this.state.campaignsPlayedByPlayer[playerId] = [];
    this.state.campaignsPlayedByPlayer[playerId].push(card.id);

    // Remove card from hand and discard it
    player.hand.splice(ci, 1);
    this.state.campaignDiscard.push(card.id);

    // NEW: Seat capture by ideology - initiate seat capture phase if seats to capture
    if (seatDelta > 0) {
      // Derive ideology filter from card
      const ideologyTarget = deriveIdeologyFromCard(card);

      if (ideologyTarget) {
        const eligibleSeatIds = getEligibleSeatsForCapture(
          this.state.seats,
          playerId,
          ideologyTarget.axis,
          ideologyTarget.bucket
        );

        if (eligibleSeatIds.length > 0) {
          // Enter seat capture phase
          this.state.pendingSeatCapture = {
            actorId: playerId,
            cardId: card.id,
            cardName: card.name,
            remaining: Math.min(seatDelta, eligibleSeatIds.length),
            ideologyAxis: ideologyTarget.axis,
            ideologyBucket: ideologyTarget.bucket,
            eligibleSeatIds,
          };
          this.state.phase = 'seat_capture';
          this.state.roundCampaignsPlayed.push({ playerId, cardId: card.id, cardName: card.name, seatDelta, agendaBonus });
          this.logEvent({ type: 'campaign_played', timestamp: Date.now(), playerId, cardId: card.id, seatDelta, agendaBonus });
          return true;
        }
        // No eligible seats - award consolation (log shortfall but no penalty)
        console.log(`[CAMPAIGN] No eligible seats for ${card.name} ideology (${ideologyTarget.axis}:${ideologyTarget.bucket})`);
      }
    }

    // Fallback to old system for negative effects or if no ideology capture available
    this.executeCampaign(playerId, card, seatDelta, agendaBonus, undefined);
    return true;
  }

  /**
   * Resolve a seat capture - player selects a specific seat to capture
   */
  resolveCaptureSeat(playerId: string, seatId: SeatId): boolean {
    if (this.state.phase !== 'seat_capture' || !this.state.pendingSeatCapture) return false;
    const pending = this.state.pendingSeatCapture;
    if (pending.actorId !== playerId) return false;
    if (!pending.eligibleSeatIds.includes(seatId)) return false;

    const seat = this.state.seats[seatId];
    if (!seat) return false;

    const previousOwner = seat.ownerPlayerId;

    // Transfer the seat
    transferSeat(this.state.seats, seatId, playerId);

    // Log the seat capture event
    this.logEvent({
      type: 'seat_captured',
      timestamp: Date.now(),
      seatId,
      seatName: seat.name,
      fromPlayerId: previousOwner,
      toPlayerId: playerId,
      ideology: seat.ideology,
    });

    // Update remaining and eligibles
    pending.remaining--;
    pending.eligibleSeatIds = pending.eligibleSeatIds.filter(id => id !== seatId);

    // Recompute eligible seats (some may have changed ownership)
    pending.eligibleSeatIds = getEligibleSeatsForCapture(
      this.state.seats,
      playerId,
      pending.ideologyAxis,
      pending.ideologyBucket
    );

    // Sync player seat counts
    this.syncPlayerSeatCounts();

    // Check if capture is complete
    if (pending.remaining <= 0 || pending.eligibleSeatIds.length === 0) {
      this.state.pendingSeatCapture = null;
      this.state.playersCampaigned.push(playerId);
      this.state.phase = 'campaign';
      this.advanceCampaignTurn();
    }

    return true;
  }

  selectCampaignTarget(playerId: string, targetId: string): boolean {
    console.log(`[SELECT_TARGET] playerId=${playerId}, targetId=${targetId}, phase=${this.state.phase}`);
    if (this.state.phase !== 'campaign_targeting' || !this.state.pendingCampaign || this.state.pendingCampaign.playerId !== playerId || targetId === playerId) {
      console.log(`[SELECT_TARGET] REJECTED - phase=${this.state.phase}, pendingCampaign=${!!this.state.pendingCampaign}`);
      return false;
    }
    const target = this.state.players.find(p => p.id === targetId); if (!target || target.seats <= 0) return false;
    const { card, calculatedDelta, agendaBonus } = this.state.pendingCampaign;
    this.state.pendingCampaign = null;
    // Set phase to campaign BEFORE executeCampaign, so advanceCampaignTurn can change it
    this.state.phase = 'campaign';
    console.log(`[SELECT_TARGET] Executing campaign for ${playerId}`);
    this.executeCampaign(playerId, card, calculatedDelta, agendaBonus, targetId);
    // DON'T set phase here - executeCampaign -> advanceCampaignTurn handles it
    console.log(`[SELECT_TARGET] After execute, phase=${this.state.phase}`);
    return true;
  }

  private executeCampaign(playerId: string, card: CampaignCard, seatDelta: number, agendaBonus: number, targetId?: string): void {
    if (targetId) this.applySeatChangeFromTarget(playerId, targetId, seatDelta, `Campaign: ${card.name}`);
    else this.applySeatChange(playerId, seatDelta, `Campaign: ${card.name}`);
    this.state.roundCampaignsPlayed.push({ playerId, cardId: card.id, cardName: card.name, seatDelta, agendaBonus, targetId });
    this.logEvent({ type: 'campaign_played', timestamp: Date.now(), playerId, cardId: card.id, seatDelta, agendaBonus, targetId });
    this.state.playersCampaigned.push(playerId);
    console.log(`[EXEC_CAMPAIGN] Player ${playerId} done. playersCampaigned=${this.state.playersCampaigned.length}, players=${this.state.players.length}`);
    this.refillHand(playerId, 'campaign');
    this.advanceCampaignTurn();
  }

  skipCampaign(playerId: string): boolean { if (this.state.phase !== 'campaign' || this.state.turnOrder[this.state.currentPlayerIndex] !== playerId) return false; this.state.playersCampaigned.push(playerId); this.advanceCampaignTurn(); return true; }

  private advanceCampaignTurn(): void {
    console.log(`[ADVANCE_TURN] playersCampaigned=${this.state.playersCampaigned.length}, players=${this.state.players.length}, phase=${this.state.phase}`);
    // Check if all players have campaigned
    if (this.state.playersCampaigned.length >= this.state.players.length) {
      console.log(`[ADVANCE_TURN] All done! Advancing to policy phase`);
      this.state.currentPlayerIndex = 0;
      this.advanceToPolicyPhase();
      return;
    }
    // Find next player who hasn't campaigned yet
    for (let i = 0; i < this.state.turnOrder.length; i++) {
      const nextIndex = (this.state.currentPlayerIndex + 1 + i) % this.state.turnOrder.length;
      const nextPlayerId = this.state.turnOrder[nextIndex];
      if (!this.state.playersCampaigned.includes(nextPlayerId)) {
        console.log(`[ADVANCE_TURN] Next player: ${nextPlayerId} at index ${nextIndex}`);
        this.state.currentPlayerIndex = nextIndex;
        return;
      }
    }
    // Fallback: all players done, advance to policy
    console.log(`[ADVANCE_TURN] Fallback - advancing to policy`);
    this.state.currentPlayerIndex = 0;
    this.advanceToPolicyPhase();
  }

  // HOST EMERGENCY SKIP - forces game to next phase
  forceAdvancePhase(): boolean {
    if (this.state.phase === 'game_over' || this.state.phase === 'waiting') return false;
    this.logEvent({ type: 'phase_skipped', timestamp: Date.now(), fromPhase: this.state.phase });
    switch (this.state.phase) {
      case 'draw':
        this.state.playersDrawn = this.state.players.map(p => p.id);
        this.advanceFromDrawPhase();
        break;
      case 'negotiation':
        this.state.negotiation.playersReady = this.state.players.map(p => p.id);
        this.advanceToCampaignPhase();
        break;
      case 'campaign':
      case 'campaign_targeting':
      case 'seat_capture':
        this.state.playersCampaigned = this.state.players.map(p => p.id);
        this.state.pendingCampaign = null;
        this.state.pendingSeatCapture = null;
        this.advanceToPolicyPhase();
        break;
      case 'policy_proposal':
        this.advanceToNextRound();
        break;
      case 'policy_vote':
        // Auto-fail the vote
        this.state.votes = this.state.players.map(p => ({ playerId: p.id, vote: 'no' as const, seatWeight: p.seats }));
        if (this.state.proposedPolicy) this.state.policyDiscard.push(this.state.proposedPolicy.id);
        this.state.proposedPolicy = null;
        this.state.proposerId = null;
        this.advanceToNextRound();
        break;
      case 'policy_resolution':
      case 'agenda_selection':
        this.state.proposedPolicy = null;
        this.state.proposerId = null;
        this.advanceToNextRound();
        break;
      case 'wildcard_resolution':
        if (this.state.pendingWildcard) this.state.wildcardDiscard.push(this.state.pendingWildcard.id);
        this.state.pendingWildcard = null;
        this.state.proposerId = null;
        this.advanceToNextRound();
        break;
      default:
        this.advanceToNextRound();
    }
    return true;
  }

  private advanceToPolicyPhase(): void {
    console.log(`[POLICY_PHASE] Setting phase to policy_proposal. Was: ${this.state.phase}`);
    this.state.phase = 'policy_proposal';
    this.state.proposedPolicy = null;
    this.state.proposerId = null;
    this.state.votes = [];
    console.log(`[POLICY_PHASE] Phase is now: ${this.state.phase}`);
  }

  proposePolicy(playerId: string, cardId: string): boolean {
    if (this.state.phase !== 'policy_proposal' || this.state.proposedPolicy) return false;
    if (this.config.policyProposalRule === 'speaker_only' && this.state.turnOrder[this.state.speakerIndex] !== playerId) return false;
    const player = this.state.players.find(p => p.id === playerId); if (!player || player.seats < 1) return false;
    const ci = player.hand.findIndex(h => h.card.id === cardId && 'stanceTable' in h.card); if (ci === -1) return false;
    const card = player.hand.splice(ci, 1)[0].card as PolicyCard;
    this.state.proposedPolicy = card; this.state.proposerId = playerId; this.state.phase = 'policy_vote'; this.state.votes = [];
    if (this.config.ideologyMode === 'derived') {
      const cons = this.checkCardConsistency(player, card.stanceTable);
      if (cons === 'aligned') this.awardPCap(playerId, 'ideological_credibility', 2, `Aligned proposal: ${card.name}`);
      else if (cons === 'contrary') { this.applySeatChange(playerId, -2, `Contrary proposal: ${card.name}`); this.logPCapChange(playerId, 0, -2, `Contrary: ${card.name}`, 'penalty'); }
      this.updateIdeologyForStanceTable(playerId, card.stanceTable, 2);
    }
    this.logEvent({ type: 'policy_proposed', timestamp: Date.now(), playerId, cardId }); this.refillHand(playerId, 'policy'); return true;
  }

  skipProposal(playerId: string): boolean {
    if (this.state.phase !== 'policy_proposal') return false;
    if (this.config.policyProposalRule === 'speaker_only' && this.state.turnOrder[this.state.speakerIndex] !== playerId) return false;
    this.advanceToNextRound(); return true;
  }

  castVote(playerId: string, vote: 'yes' | 'no'): boolean {
    if (this.state.phase !== 'policy_vote' || !this.state.proposedPolicy || this.state.votes.find(v => v.playerId === playerId)) return false;
    const player = this.state.players.find(p => p.id === playerId); if (!player) return false;
    this.state.votes.push({ playerId, vote, seatWeight: player.seats });
    if (vote === 'yes' && this.config.ideologyMode === 'derived') {
      const cons = this.checkCardConsistency(player, this.state.proposedPolicy.stanceTable);
      if (cons === 'aligned') this.awardPCap(playerId, 'ideological_credibility', 1, `Aligned vote: ${this.state.proposedPolicy.name}`);
      else if (cons === 'contrary') { this.applySeatChange(playerId, -1, `Contrary vote: ${this.state.proposedPolicy.name}`); this.logPCapChange(playerId, 0, -1, `Contrary vote`, 'penalty'); }
      this.updateIdeologyForStanceTable(playerId, this.state.proposedPolicy.stanceTable, 1);
    }
    this.logEvent({ type: 'vote_cast', timestamp: Date.now(), playerId, vote, seatWeight: player.seats });
    if (this.state.votes.length >= this.state.players.length) this.resolveVote();
    return true;
  }

  private checkCardConsistency(player: Player, stanceTable: PolicyCard['stanceTable']): 'aligned' | 'contrary' | 'neutral' {
    const p = player.ideologyProfile;
    const total = p.progressiveActions + p.conservativeActions + p.marketActions + p.interventionistActions;
    if (total < 1) return 'neutral';
    let aligned = 0, contrary = 0;
    if (p.dominantSocial !== 'neutral') { const s = stanceTable[p.dominantSocial]; if (s === 'favoured') aligned++; else if (s === 'opposed') contrary++; }
    if (p.dominantEconomic !== 'neutral') { const s = stanceTable[p.dominantEconomic]; if (s === 'favoured') aligned++; else if (s === 'opposed') contrary++; }
    if (aligned > contrary) return 'aligned'; if (contrary > aligned) return 'contrary'; return 'neutral';
  }

  private updateIdeologyForStanceTable(playerId: string, st: PolicyCard['stanceTable'], weight: number): void {
    if (this.config.ideologyMode !== 'derived') return;
    const player = this.state.players.find(p => p.id === playerId); if (!player) return;
    const pr = player.ideologyProfile;
    if (st.progressive === 'favoured') pr.progressiveActions += weight;
    if (st.conservative === 'favoured') pr.conservativeActions += weight;
    if (st.market === 'favoured') pr.marketActions += weight;
    if (st.interventionist === 'favoured') pr.interventionistActions += weight;
    this.recalculateIdeologyProfile(player);
    this.logEvent({ type: 'ideology_updated', timestamp: Date.now(), playerId, profile: { ...player.ideologyProfile } });
  }

  private recalculateIdeologyProfile(player: Player): void {
    const p = player.ideologyProfile;
    const sT = p.progressiveActions + p.conservativeActions; p.socialScore = sT > 0 ? Math.round((p.progressiveActions / sT) * 100) : 50;
    const eT = p.marketActions + p.interventionistActions; p.economicScore = eT > 0 ? Math.round((p.interventionistActions / eT) * 100) : 50;
    if (p.socialScore > 60) { p.dominantSocial = 'progressive'; player.socialIdeology = 'progressive'; } else if (p.socialScore < 40) { p.dominantSocial = 'conservative'; player.socialIdeology = 'conservative'; } else p.dominantSocial = 'neutral';
    if (p.economicScore > 60) { p.dominantEconomic = 'interventionist'; player.economicIdeology = 'interventionist'; } else if (p.economicScore < 40) { p.dominantEconomic = 'market'; player.economicIdeology = 'market'; } else p.dominantEconomic = 'neutral';
  }

  private resolveVote(): void {
    const yesVotes = this.state.votes.filter(v => v.vote === 'yes').reduce((s, v) => s + v.seatWeight, 0);
    const noVotes = this.state.votes.filter(v => v.vote === 'no').reduce((s, v) => s + v.seatWeight, 0);
    let passed: boolean;
    if (yesVotes > noVotes) passed = true;
    else if (noVotes > yesVotes) passed = false;
    else {
      // TIE: Speaker's vote decides
      const speakerId = this.state.turnOrder[this.state.speakerIndex];
      const speakerVote = this.state.votes.find(v => v.playerId === speakerId);
      passed = speakerVote?.vote === 'yes';
      this.logEvent({ type: 'speaker_tiebreak', timestamp: Date.now(), speakerId, decision: passed ? 'passed' : 'failed' });
    }
    this.logEvent({ type: 'policy_resolved', timestamp: Date.now(), passed, yesVotes, noVotes });
    if (this.state.proposedPolicy && this.state.proposerId) {
      this.state.roundPolicyResult = { cardId: this.state.proposedPolicy.id, cardName: this.state.proposedPolicy.name, proposerId: this.state.proposerId, passed, yesVotes, noVotes, voterBreakdown: this.state.votes.map(v => ({ playerId: v.playerId, vote: v.vote, seatWeight: v.seatWeight })) };
    }
    if (passed) { this.state.phase = 'policy_resolution'; this.resolvePolicyEffects(); }
    else { if (this.state.proposedPolicy) this.state.policyDiscard.push(this.state.proposedPolicy.id); this.state.proposedPolicy = null; this.state.proposerId = null; this.advanceToNextRound(); }
  }

  private resolvePolicyEffects(): void {
    const policy = this.state.proposedPolicy, proposerId = this.state.proposerId;
    if (!policy || !proposerId) { this.advanceToNextRound(); return; }
    const proposer = this.state.players.find(p => p.id === proposerId);
    if (!proposer) { this.state.policyDiscard.push(policy.id); this.state.proposedPolicy = null; this.state.proposerId = null; this.advanceToNextRound(); return; }
    this.awardPCap(proposerId, policy.proposerReward, policy.proposerRewardValue, `Proposed passed: ${policy.name}`);
    // Ideology alignment rewards
    this.state.players.forEach(player => {
      const ss = policy.stanceTable[player.socialIdeology], es = policy.stanceTable[player.economicIdeology];
      let reward = 0;
      if (ss === 'favoured' && es === 'favoured') reward = this.config.ideologyRewards.doubleFavoured;
      else if (ss === 'favoured' || es === 'favoured') reward = this.config.ideologyRewards.singleFavoured;
      if (reward > 0) this.awardPCap(player.id, 'ideological_credibility', reward, `Ideology aligned: ${policy.name}`);
    });
    // Contrary backlash
    if (policy.stanceTable[proposer.socialIdeology] === 'opposed' || policy.stanceTable[proposer.economicIdeology] === 'opposed') {
      this.applySeatChange(proposerId, -this.config.contraryBacklashSeats, 'Contrary backlash');
    }
    // Campaign synergy
    this.checkPolicyCampaignSynergy(policy);
    this.state.policyDiscard.push(policy.id);
    
    // NEW: If policy matches current agenda, proposer picks new agenda
    if (policy.issue === this.state.activeIssue) {
      this.state.proposedPolicy = null;
      this.state.phase = 'agenda_selection';
      this.logEvent({ type: 'agenda_selection_triggered', timestamp: Date.now(), playerId: proposerId, reason: `Policy matched agenda` });
    } else {
      this.state.proposedPolicy = null; this.state.proposerId = null;
      if (this.config.wildcardOnPolicyPass) this.drawWildcard(proposerId);
      else this.advanceToNextRound();
    }
  }

  selectNewAgenda(playerId: string, newIssue: Issue): boolean {
    if (this.state.phase !== 'agenda_selection' || playerId !== this.state.proposerId || !ISSUES.includes(newIssue)) return false;
    const oldIssue = this.state.activeIssue;
    this.state.activeIssue = newIssue; this.state.roundIssueChangedTo = newIssue;
    this.logEvent({ type: 'issue_changed', timestamp: Date.now(), oldIssue, newIssue, changedBy: playerId });
    const pid = this.state.proposerId!; this.state.proposerId = null;
    if (this.config.wildcardOnPolicyPass) this.drawWildcard(pid);
    else this.advanceToNextRound();
    return true;
  }

  private checkPolicyCampaignSynergy(policy: PolicyCard): void {
    if (!policy.campaignLinks || policy.campaignLinks.length === 0) return;
    for (const player of this.state.players) {
      const pc = this.state.campaignsPlayedByPlayer[player.id] || [];
      for (const cid of policy.campaignLinks) {
        if (pc.includes(cid)) {
          this.awardPCap(player.id, 'ideological_credibility', 2, `Promise kept: ${policy.name}`);
          this.applySeatChange(player.id, 1, `Promise delivered: ${policy.name}`);
          this.logEvent({ type: 'policy_synergy', timestamp: Date.now(), playerId: player.id, campaignId: cid, policyId: policy.id });
          break;
        }
      }
    }
  }

  private awardPCap(playerId: string, pCapType: PCapCard['type'], value: number, reason: string): void {
    const player = this.state.players.find(p => p.id === playerId); if (!player) return;
    const names: Record<PCapCard['type'], string> = { mandate: 'Electoral Mandate', prime_ministership: 'Prime Ministership', landmark_reform: 'Landmark Reform', policy_win: 'Policy Victory', ideological_credibility: 'Ideological Credibility', state_control: 'State Control' };
    player.pCapCards.push({ type: pCapType, value, name: names[pCapType], source: reason, roundAwarded: this.state.round });
    this.logPCapChange(playerId, value, 0, reason, 'award');
    this.logEvent({ type: 'pcap_awarded', timestamp: Date.now(), playerId, pCapType, value, reason });
  }

  private logPCapChange(playerId: string, pCapDelta: number, seatDelta: number, reason: string, changeType: 'award' | 'penalty'): void {
    this.state.roundPCapChanges.push({ playerId, pCapDelta, seatDelta, reason, changeType, timestamp: Date.now() });
  }

  private drawWildcard(proposerId: string): void {
    if (this.state.wildcardDeck.length === 0) { if (this.state.wildcardDiscard.length > 0) { this.state.wildcardDeck = this.rng.shuffle([...this.state.wildcardDiscard]); this.state.wildcardDiscard = []; } else { this.state.proposerId = null; this.advanceToNextRound(); return; } }
    const cardId = this.state.wildcardDeck.shift(); if (!cardId) { this.state.proposerId = null; this.advanceToNextRound(); return; }
    const card = getWildcardCard(cardId); if (!card) { this.state.proposerId = null; this.advanceToNextRound(); return; }
    this.state.pendingWildcard = card; this.state.phase = 'wildcard_resolution';
    this.logEvent({ type: 'wildcard_drawn', timestamp: Date.now(), playerId: proposerId, cardId });
  }

  acknowledgeWildcard(playerId: string): boolean { if (this.state.phase !== 'wildcard_resolution' || !this.state.pendingWildcard) return false; this.resolveWildcard(); return true; }

  private resolveWildcard(): void {
    const card = this.state.pendingWildcard; if (!card) { this.state.proposerId = null; this.advanceToNextRound(); return; }
    const effects: { playerId: string; seatDelta: number }[] = []; const proposerId = this.state.proposerId;
    switch (card.effect.type) {
      case 'leader_erosion': { const l = this.getSeatLeader(); if (l) { this.applySeatChange(l.id, card.effect.seatDelta, `Wildcard: ${card.name}`); effects.push({ playerId: l.id, seatDelta: card.effect.seatDelta }); } break; }
      case 'all_players': this.state.players.forEach(p => { this.applySeatChange(p.id, card.effect.seatDelta, `Wildcard: ${card.name}`); effects.push({ playerId: p.id, seatDelta: card.effect.seatDelta }); }); break;
      case 'proposer': if (proposerId) { this.applySeatChange(proposerId, card.effect.seatDelta, `Wildcard: ${card.name}`); effects.push({ playerId: proposerId, seatDelta: card.effect.seatDelta }); } break;
      case 'issue_conditional': if (card.effect.issue === this.state.activeIssue && proposerId) { const b = card.effect.issueBonus || 1; this.applySeatChange(proposerId, b, `Wildcard: ${card.name} (match)`); effects.push({ playerId: proposerId, seatDelta: b }); } else { const l = this.getSeatLeader(); if (l) { this.applySeatChange(l.id, card.effect.seatDelta, `Wildcard: ${card.name}`); effects.push({ playerId: l.id, seatDelta: card.effect.seatDelta }); } } break;
    }
    this.state.roundWildcardDrawn = { cardId: card.id, cardName: card.name, effects };
    this.logEvent({ type: 'wildcard_resolved', timestamp: Date.now(), cardId: card.id, effects });
    this.state.wildcardDiscard.push(card.id); this.state.pendingWildcard = null; this.state.proposerId = null; this.advanceToNextRound();
  }

  private createHistorySnapshot(): void {
    const seatCounts: Record<string, number> = {}, pCapCounts: Record<string, number> = {}, ideologyProfiles: Record<string, IdeologyProfile> = {};
    this.state.players.forEach(p => { seatCounts[p.id] = p.seats; pCapCounts[p.id] = p.pCapCards.reduce((s, c) => s + c.value, 0); ideologyProfiles[p.id] = { ...p.ideologyProfile }; });
    this.state.history.push({ round: this.state.round, timestamp: Date.now(), activeIssue: this.state.activeIssue, seatCounts, pCapCounts, ideologyProfiles, campaignsPlayed: [...this.state.roundCampaignsPlayed], policyResult: this.state.roundPolicyResult, wildcardDrawn: this.state.roundWildcardDrawn, tradesCompleted: [...this.state.roundTradesCompleted], issueChangedTo: this.state.roundIssueChangedTo, pCapChanges: [...this.state.roundPCapChanges] });
  }

  private advanceToNextRound(): void {
    this.createHistorySnapshot();
    const decksEmpty = this.state.campaignDeck.length === 0 && this.state.campaignDiscard.length === 0 && this.state.policyDeck.length === 0 && this.state.policyDiscard.length === 0;
    const maxRoundsReached = this.config.maxRounds !== null && this.state.round >= this.config.maxRounds;
    if (decksEmpty || maxRoundsReached) { this.endGame(); return; }
    this.state.round++; this.state.playersDrawn = []; this.state.playersCampaigned = []; this.resetRoundTracking();
    this.state.speakerIndex = (this.state.speakerIndex + 1) % this.state.players.length;
    this.state.phase = 'draw'; this.state.currentPlayerIndex = 0;
    this.logEvent({ type: 'round_started', timestamp: Date.now(), round: this.state.round, activeIssue: this.state.activeIssue });
  }

  private endGame(): void {
    this.state.phase = 'game_over';
    const seatLeader = this.getSeatLeader();
    if (seatLeader) { this.awardPCap(seatLeader.id, 'mandate', this.config.mandateValue, 'Most seats'); this.awardPCap(seatLeader.id, 'prime_ministership', this.config.pmValue, 'Formed government'); }
    const scores: Record<string, number> = {}; this.state.players.forEach(p => { scores[p.id] = p.pCapCards.reduce((s, c) => s + c.value, 0); });
    this.state.finalScores = scores;
    const maxScore = Math.max(...Object.values(scores));
    const winners = Object.entries(scores).filter(([_, s]) => s === maxScore);
    if (winners.length === 1) this.state.winner = winners[0][0];
    else { const tied = winners.map(([id]) => this.state.players.find(p => p.id === id)!); const maxSeats = Math.max(...tied.map(p => p.seats)); this.state.winner = tied.find(p => p.seats === maxSeats)?.id || winners[0][0]; }
    this.logEvent({ type: 'game_ended', timestamp: Date.now(), winner: this.state.winner, scores });
  }

  private applySeatChange(playerId: string, delta: number, reason: string): void {
    const player = this.state.players.find(p => p.id === playerId); if (!player) return;

    if (delta > 0) {
      // NEW: For positive changes, transfer seats from leader to player
      this.transferSeatsFromLeaderTo(playerId, delta);
    } else if (delta < 0) {
      // For negative changes, lose seats to redistribution
      const loss = Math.min(player.seats, Math.abs(delta));
      this.loseSeatsByRedistr(playerId, loss);
    }

    // Sync seat counts from authoritative seat map
    this.syncPlayerSeatCounts();

    this.state.roundSeatChanges[playerId] = (this.state.roundSeatChanges[playerId] || 0) + delta;
    this.logEvent({ type: 'seats_changed', timestamp: Date.now(), playerId, delta, newTotal: player.seats, reason });
  }

  /**
   * Transfer N seats from the leader to the recipient using the seat map
   */
  private transferSeatsFromLeaderTo(recipientId: string, amount: number): void {
    let remaining = amount;
    const leader = this.getSeatLeader();

    // First try to take from leader
    if (leader && leader.id !== recipientId) {
      const leaderSeats = getPlayerSeats(this.state.seats, leader.id);
      for (const seat of leaderSeats) {
        if (remaining <= 0) break;
        transferSeat(this.state.seats, seat.id, recipientId);
        remaining--;
      }
    }

    // If still need more, take proportionally from others
    if (remaining > 0) {
      const others = this.state.players.filter(p => p.id !== recipientId && p.seats > 0);
      for (const other of others) {
        if (remaining <= 0) break;
        const otherSeats = getPlayerSeats(this.state.seats, other.id);
        const toTake = Math.min(otherSeats.length, Math.ceil(remaining / others.length));
        for (let i = 0; i < toTake && remaining > 0; i++) {
          transferSeat(this.state.seats, otherSeats[i].id, recipientId);
          remaining--;
        }
      }
    }
  }

  /**
   * Player loses seats, redistributed to other players
   */
  private loseSeatsByRedistr(playerId: string, amount: number): void {
    const playerSeats = getPlayerSeats(this.state.seats, playerId);
    const others = this.state.players.filter(p => p.id !== playerId);
    if (others.length === 0) return;

    let lost = 0;
    let otherIndex = 0;
    for (const seat of playerSeats) {
      if (lost >= amount) break;
      // Round-robin redistribution to other players
      transferSeat(this.state.seats, seat.id, others[otherIndex % others.length].id);
      otherIndex++;
      lost++;
    }
  }

  private applySeatChangeFromTarget(playerId: string, targetId: string, delta: number, reason: string): void {
    const player = this.state.players.find(p => p.id === playerId);
    const target = this.state.players.find(p => p.id === targetId);
    if (!player || !target) return;

    // Transfer seats from target using seat map
    const targetSeats = getPlayerSeats(this.state.seats, targetId);
    let transferred = 0;
    for (const seat of targetSeats) {
      if (transferred >= delta) break;
      transferSeat(this.state.seats, seat.id, playerId);
      transferred++;
    }

    // If not enough from target, take from leader
    if (transferred < delta) {
      this.transferSeatsFromLeaderTo(playerId, delta - transferred);
    }

    // Sync seat counts
    this.syncPlayerSeatCounts();

    this.state.roundSeatChanges[playerId] = (this.state.roundSeatChanges[playerId] || 0) + delta;
    this.logEvent({ type: 'seats_changed', timestamp: Date.now(), playerId, delta, newTotal: player.seats, reason: `${reason} (from ${target.name})` });
  }

  private transferSeatsTo(recipient: Player, amount: number): void {
    let rem = amount;
    if (this.config.seatTransferRule === 'from_leader' || this.config.seatTransferRule === 'player_choice') { const l = this.getSeatLeader(); if (l && l.id !== recipient.id) { const t = Math.min(l.seats, rem); l.seats -= t; recipient.seats += t; rem -= t; } }
    if (rem > 0) { const others = this.state.players.filter(p => p.id !== recipient.id && p.seats > 0); const total = others.reduce((s, p) => s + p.seats, 0); if (total > 0) others.forEach(o => { const t = Math.min(o.seats, Math.ceil((o.seats / total) * rem)); o.seats -= t; recipient.seats += t; }); }
    this.normalizeSeats();
  }

  private redistributeSeats(fromId: string, amount: number): void {
    const others = this.state.players.filter(p => p.id !== fromId); if (others.length === 0) return;
    const pp = Math.floor(amount / others.length); let rem = amount % others.length;
    others.forEach(p => { p.seats += pp; if (rem > 0) { p.seats++; rem--; } });
  }

  private normalizeSeats(): void { const total = this.state.players.reduce((s, p) => s + p.seats, 0); const diff = this.config.totalSeats - total; if (diff !== 0) { const l = this.getSeatLeader(); if (l) l.seats += diff; } }
  private getSeatLeader(): Player | null { if (this.state.players.length === 0) return null; return this.state.players.reduce((l, p) => p.seats > l.seats ? p : l); }
  private logEvent(event: GameEvent): void { this.state.eventLog.push(event); }
  getEventLog(): GameEvent[] { return [...this.state.eventLog]; }
  updateConfig(newConfig: Partial<GameConfig>): void { this.config = mergeConfig({ ...this.config, ...newConfig }); }
}
