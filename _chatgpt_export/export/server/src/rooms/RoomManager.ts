import { v4 as uuidv4 } from 'uuid';
import { GameEngine } from '../game/GameEngine';
import { 
  GameState, 
  GameConfig, 
  GameEvent, 
  ChatMessage,
  SocialIdeology,
  EconomicIdeology 
} from '../types';

interface Room {
  id: string;
  engine: GameEngine;
  socketToPlayer: Map<string, string>; // socketId -> playerId
  playerToSocket: Map<string, string>; // playerId -> socketId
  createdAt: number;
  lastActivity: number;
}

class RoomManager {
  private rooms: Map<string, Room> = new Map();

  createRoom(configOverrides?: Partial<GameConfig>): string {
    const roomId = this.generateRoomId();
    const engine = new GameEngine(roomId, configOverrides);
    
    const room: Room = {
      id: roomId,
      engine,
      socketToPlayer: new Map(),
      playerToSocket: new Map(),
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };
    
    this.rooms.set(roomId, room);
    return roomId;
  }

  private generateRoomId(): string {
    // Generate a 6-character uppercase alphanumeric code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Ensure uniqueness
    if (this.rooms.has(result)) {
      return this.generateRoomId();
    }
    return result;
  }

  joinRoom(
    roomId: string, 
    socketId: string, 
    playerName: string, 
    partyName: string,
    socialIdeology?: SocialIdeology,
    economicIdeology?: EconomicIdeology
  ): { success: boolean; playerId?: string; error?: string } {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    room.lastActivity = Date.now();

    // Check if this socket is already in the room
    const existingPlayerId = room.socketToPlayer.get(socketId);
    if (existingPlayerId) {
      return { success: true, playerId: existingPlayerId };
    }

    // Check if player is reconnecting
    const state = room.engine.getState();
    const disconnectedPlayer = state.players.find(p => !p.connected && p.playerName === playerName);
    if (disconnectedPlayer) {
      room.engine.reconnectPlayer(disconnectedPlayer.id);
      room.socketToPlayer.set(socketId, disconnectedPlayer.id);
      room.playerToSocket.set(disconnectedPlayer.id, socketId);
      return { success: true, playerId: disconnectedPlayer.id };
    }

    // Add new player
    const playerId = uuidv4();
    const player = room.engine.addPlayer(playerId, playerName, partyName, socialIdeology, economicIdeology);
    
    if (!player) {
      return { success: false, error: 'Cannot join room (game may have started or room is full)' };
    }

    room.socketToPlayer.set(socketId, playerId);
    room.playerToSocket.set(playerId, socketId);
    
    return { success: true, playerId };
  }

  leaveRoom(roomId: string, socketId: string): string | null {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return null;

    const playerId = room.socketToPlayer.get(socketId);
    if (!playerId) return null;

    room.socketToPlayer.delete(socketId);
    room.playerToSocket.delete(playerId);
    room.engine.removePlayer(playerId);
    room.lastActivity = Date.now();

    // Clean up empty rooms
    if (room.socketToPlayer.size === 0) {
      this.rooms.delete(roomId.toUpperCase());
    }

    return playerId;
  }

  // Get socket ID for a player (for private messages)
  getSocketIdForPlayer(roomId: string, playerId: string): string | undefined {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return undefined;
    return room.playerToSocket.get(playerId);
  }

  // Chat functionality
  addChatMessage(roomId: string, message: ChatMessage): boolean {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return false;
    
    room.engine.addChatMessage(message);
    room.lastActivity = Date.now();
    return true;
  }

  // Game actions
  startGame(roomId: string): boolean {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return false;
    room.lastActivity = Date.now();
    return room.engine.startGame();
  }

  drawCard(roomId: string, playerId: string, deckType: 'campaign' | 'policy'): boolean {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return false;
    room.lastActivity = Date.now();
    return room.engine.drawCard(playerId, deckType);
  }

  playCampaignCard(roomId: string, playerId: string, cardId: string): boolean {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return false;
    room.lastActivity = Date.now();
    return room.engine.playCampaignCard(playerId, cardId);
  }

  skipCampaign(roomId: string, playerId: string): boolean {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return false;
    room.lastActivity = Date.now();
    return room.engine.skipCampaign(playerId);
  }

  proposePolicy(roomId: string, playerId: string, cardId: string): boolean {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return false;
    room.lastActivity = Date.now();
    return room.engine.proposePolicy(playerId, cardId);
  }

  skipProposal(roomId: string, playerId: string): boolean {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return false;
    room.lastActivity = Date.now();
    return room.engine.skipProposal(playerId);
  }

  castVote(roomId: string, playerId: string, vote: 'yes' | 'no'): boolean {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return false;
    room.lastActivity = Date.now();
    return room.engine.castVote(playerId, vote);
  }

  acknowledgeWildcard(roomId: string, playerId: string): boolean {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return false;
    room.lastActivity = Date.now();
    return room.engine.acknowledgeWildcard(playerId);
  }

  adjustIssue(roomId: string, playerId: string, direction: -1 | 0 | 1): boolean {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return false;
    room.lastActivity = Date.now();
    return room.engine.adjustIssue(playerId, direction);
  }

  updateConfig(roomId: string, config: Partial<GameConfig>): boolean {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return false;
    
    const state = room.engine.getState();
    if (state.phase !== 'waiting') return false;
    
    room.engine.updateConfig(config);
    room.lastActivity = Date.now();
    return true;
  }

  // Getters
  getState(roomId: string): GameState | null {
    const room = this.rooms.get(roomId.toUpperCase());
    return room ? room.engine.getState() : null;
  }

  getConfig(roomId: string): GameConfig | null {
    const room = this.rooms.get(roomId.toUpperCase());
    return room ? room.engine.getConfig() : null;
  }

  getEventLog(roomId: string): GameEvent[] | null {
    const room = this.rooms.get(roomId.toUpperCase());
    return room ? room.engine.getEventLog() : null;
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  getRoomList(): { roomId: string; playerCount: number; phase: string }[] {
    return Array.from(this.rooms.values()).map(room => {
      const state = room.engine.getState();
      return {
        roomId: room.id,
        playerCount: state.players.length,
        phase: state.phase,
      };
    });
  }

  cleanupStaleRooms(): number {
    const now = Date.now();
    const staleThreshold = 24 * 60 * 60 * 1000; // 24 hours
    let cleaned = 0;

    this.rooms.forEach((room, roomId) => {
      if (now - room.lastActivity > staleThreshold) {
        this.rooms.delete(roomId);
        cleaned++;
      }
    });

    return cleaned;
  }
}

export const roomManager = new RoomManager();
