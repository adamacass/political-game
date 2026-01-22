import { GameEngine } from '../game/GameEngine';
import { GameConfig, ChatMessage, PartyColorId, SocialIdeology, EconomicIdeology } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface Room {
  id: string;
  engine: GameEngine;
  hostId: string;
  socketToPlayer: Map<string, string>;
  playerToSocket: Map<string, string>;
  createdAt: number;
  lastActivity: number;
}

interface JoinResult {
  success: boolean;
  playerId?: string;
  error?: string;
}

class RoomManager {
  private rooms: Map<string, Room> = new Map();

  // Create room - returns roomId string
  createRoom(configOverrides?: Partial<GameConfig>): string {
    const roomId = this.generateRoomCode().toUpperCase();
    const engine = new GameEngine(roomId, configOverrides || {});
    
    const room: Room = {
      id: roomId,
      engine,
      hostId: '', // Will be set when first player joins
      socketToPlayer: new Map(),
      playerToSocket: new Map(),
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };
    
    // Store with uppercase key for consistent lookup
    this.rooms.set(roomId, room);
    console.log(`[RoomManager] Created room ${roomId}, total rooms: ${this.rooms.size}`);
    return roomId;
  }

  // Join room - returns { success, playerId?, error? }
  joinRoom(
    roomId: string, 
    socketId: string, 
    playerName: string, 
    partyName: string, 
    colorId?: PartyColorId,
    socialIdeology?: SocialIdeology,
    economicIdeology?: EconomicIdeology
  ): JoinResult {
    const normalizedRoomId = roomId.toUpperCase();
    console.log(`[RoomManager] joinRoom called: roomId=${normalizedRoomId}, socketId=${socketId}`);
    console.log(`[RoomManager] Available rooms: ${Array.from(this.rooms.keys()).join(', ')}`);
    
    const room = this.rooms.get(normalizedRoomId);
    if (!room) {
      console.log(`[RoomManager] Room ${normalizedRoomId} not found in ${this.rooms.size} rooms`);
      return { success: false, error: 'Room not found' };
    }

    const playerId = uuidv4();
    const player = room.engine.addPlayer(
      playerId, 
      playerName, 
      partyName, 
      colorId,
      socialIdeology,
      economicIdeology
    );

    if (!player) {
      console.log(`[RoomManager] Failed to add player to room ${normalizedRoomId}`);
      return { success: false, error: 'Failed to join - room may be full or game already started' };
    }

    // Set host if first player
    if (!room.hostId) {
      room.hostId = playerId;
      console.log(`[RoomManager] Set host to ${playerId}`);
    }

    room.socketToPlayer.set(socketId, playerId);
    room.playerToSocket.set(playerId, socketId);
    room.lastActivity = Date.now();

    console.log(`[RoomManager] Player ${playerId} joined room ${normalizedRoomId} successfully`);
    return { success: true, playerId };
  }

  // Get room (returns room with engine)
  getRoom(roomId: string): Room | undefined {
    const normalizedId = roomId.toUpperCase();
    const room = this.rooms.get(normalizedId);
    if (!room) {
      console.log(`[RoomManager] getRoom: ${normalizedId} not found. Available: ${Array.from(this.rooms.keys()).join(', ')}`);
    }
    return room;
  }

  // Get game state
  getState(roomId: string) {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) {
      console.log(`[RoomManager] getState: room ${roomId} not found`);
      return undefined;
    }
    return room.engine.getState();
  }

  // Get game config
  getConfig(roomId: string) {
    const room = this.rooms.get(roomId.toUpperCase());
    return room?.engine.getConfig();
  }

  // Get available colors
  getAvailableColors(roomId: string): PartyColorId[] {
    const room = this.rooms.get(roomId.toUpperCase());
    return room?.engine.getAvailableColors() || [];
  }

  // Get event log
  getEventLog(roomId: string) {
    const room = this.rooms.get(roomId.toUpperCase());
    return room?.engine.getEventLog();
  }

  // Start game
  startGame(roomId: string): boolean {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return false;
    room.lastActivity = Date.now();
    console.log(`[START_GAME] Starting game with ${room.engine.getState().players.length} players`);
    return room.engine.startGame();
  }

  // Draw card
  drawCard(roomId: string, playerId: string, deckType: 'campaign' | 'policy'): boolean {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return false;
    room.lastActivity = Date.now();
    return room.engine.drawCard(playerId, deckType);
  }

  // Play campaign card
  playCampaignCard(roomId: string, playerId: string, cardId: string): boolean {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return false;
    room.lastActivity = Date.now();
    return room.engine.playCampaignCard(playerId, cardId);
  }

  // Select campaign target
  selectCampaignTarget(roomId: string, playerId: string, targetPlayerId: string): boolean {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return false;
    room.lastActivity = Date.now();
    return room.engine.selectCampaignTarget(playerId, targetPlayerId);
  }

  // Skip campaign
  skipCampaign(roomId: string, playerId: string): boolean {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return false;
    room.lastActivity = Date.now();
    return room.engine.skipCampaign(playerId);
  }

  // Skip and replace
  skipAndReplace(roomId: string, playerId: string, cardId: string): boolean {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return false;
    room.lastActivity = Date.now();
    return room.engine.skipAndReplace(playerId, cardId);
  }

  // Propose policy
  proposePolicy(roomId: string, playerId: string, cardId: string): boolean {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return false;
    room.lastActivity = Date.now();
    return room.engine.proposePolicy(playerId, cardId);
  }

  // Skip proposal
  skipProposal(roomId: string, playerId: string): boolean {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return false;
    room.lastActivity = Date.now();
    return room.engine.skipProposal(playerId);
  }

  // Cast vote
  castVote(roomId: string, playerId: string, vote: 'yes' | 'no'): boolean {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return false;
    room.lastActivity = Date.now();
    return room.engine.castVote(playerId, vote);
  }

  // Acknowledge wildcard
  acknowledgeWildcard(roomId: string, playerId: string): boolean {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return false;
    room.lastActivity = Date.now();
    return room.engine.acknowledgeWildcard(playerId);
  }

  // Select new agenda
  selectNewAgenda(roomId: string, playerId: string, issue: string): boolean {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return false;
    room.lastActivity = Date.now();
    return room.engine.selectNewAgenda(playerId, issue as any);
  }

  // Adjust issue (legacy - may not be used)
  adjustIssue(roomId: string, playerId: string, direction: number): boolean {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return false;
    room.lastActivity = Date.now();
    // If engine has this method, call it; otherwise return false
    if (typeof (room.engine as any).adjustIssue === 'function') {
      return (room.engine as any).adjustIssue(playerId, direction);
    }
    return false;
  }

  // Force advance phase (host only)
  forceAdvancePhase(roomId: string, playerId: string): boolean {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return false;
    // Check if player is host
    if (room.hostId !== playerId) return false;
    room.lastActivity = Date.now();
    return room.engine.forceAdvancePhase();
  }

  // Make trade offer
  makeTradeOffer(roomId: string, fromPlayerId: string, toPlayerId: string, offeredCardIds: string[], requestedCardIds: string[]) {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return null;
    room.lastActivity = Date.now();
    return room.engine.makeTradeOffer(fromPlayerId, toPlayerId, offeredCardIds, requestedCardIds);
  }

  // Respond to offer
  respondToOffer(roomId: string, playerId: string, offerId: string, accept: boolean): boolean {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return false;
    room.lastActivity = Date.now();
    return room.engine.respondToOffer(playerId, offerId, accept);
  }

  // Cancel offer
  cancelOffer(roomId: string, playerId: string, offerId: string): boolean {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return false;
    room.lastActivity = Date.now();
    return room.engine.cancelOffer(playerId, offerId);
  }

  // Mark negotiation ready
  markNegotiationReady(roomId: string, playerId: string): boolean {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return false;
    room.lastActivity = Date.now();
    return room.engine.markNegotiationReady(playerId);
  }

  // Update config
  updateConfig(roomId: string, config: Partial<GameConfig>): boolean {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return false;
    room.lastActivity = Date.now();
    room.engine.updateConfig(config);
    return true;
  }

  // Add chat message
  addChatMessage(roomId: string, message: ChatMessage): void {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return;
    room.lastActivity = Date.now();
    room.engine.addChatMessage(message);
  }

  // Get socket ID for player
  getSocketIdForPlayer(roomId: string, playerId: string): string | undefined {
    const room = this.rooms.get(roomId.toUpperCase());
    return room?.playerToSocket.get(playerId);
  }

  // Leave room
  leaveRoom(roomId: string, socketId: string): string | undefined {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return undefined;

    const playerId = room.socketToPlayer.get(socketId);
    if (!playerId) return undefined;

    room.engine.removePlayer(playerId);
    room.socketToPlayer.delete(socketId);
    room.playerToSocket.delete(playerId);

    // Clean up empty rooms
    if (room.socketToPlayer.size === 0) {
      this.rooms.delete(roomId.toUpperCase());
      console.log(`[RoomManager] Deleted empty room ${roomId}`);
    }

    return playerId;
  }

  // Get room count
  getRoomCount(): number {
    return this.rooms.size;
  }

  // Get room list (for API)
  getRoomList() {
    return Array.from(this.rooms.values()).map(room => ({
      id: room.id,
      playerCount: room.engine.getState().players.length,
      phase: room.engine.getState().phase,
      createdAt: room.createdAt,
    }));
  }

  // Cleanup stale rooms (no activity for 2 hours)
  cleanupStaleRooms(): number {
    const staleThreshold = Date.now() - (2 * 60 * 60 * 1000);
    let cleaned = 0;

    for (const [roomId, room] of this.rooms) {
      if (room.lastActivity < staleThreshold) {
        this.rooms.delete(roomId);
        cleaned++;
      }
    }

    return cleaned;
  }

  // Generate room code
  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    // Ensure uniqueness
    if (this.rooms.has(code)) {
      return this.generateRoomCode();
    }
    return code;
  }
}

// Export as singleton instance
export const roomManager = new RoomManager();
