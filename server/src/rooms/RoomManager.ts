import { GameEngine } from '../game/GameEngine';
import { GameConfig, ChatMessage, PartyColorId, SocialIdeology, EconomicIdeology, PlayerAction, PolicyAdjustment } from '../types';
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

  createRoom(configOverrides?: Partial<GameConfig>): string {
    const roomId = this.generateRoomCode().toUpperCase();
    const engine = new GameEngine(roomId, configOverrides || {});

    const room: Room = {
      id: roomId,
      engine,
      hostId: '',
      socketToPlayer: new Map(),
      playerToSocket: new Map(),
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };

    this.rooms.set(roomId, room);
    console.log(`[RoomManager] Created room ${roomId}, total rooms: ${this.rooms.size}`);
    return roomId;
  }

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
    const room = this.rooms.get(normalizedRoomId);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    const playerId = uuidv4();
    const player = room.engine.addPlayer(
      playerId,
      playerName,
      partyName,
      colorId,
      undefined,
      socialIdeology,
      economicIdeology
    );

    if (!player) {
      return { success: false, error: 'Failed to join - room may be full or game already started' };
    }

    if (!room.hostId) {
      room.hostId = playerId;
    }

    room.socketToPlayer.set(socketId, playerId);
    room.playerToSocket.set(playerId, socketId);
    room.lastActivity = Date.now();

    return { success: true, playerId };
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId.toUpperCase());
  }

  getState(roomId: string) {
    const room = this.rooms.get(roomId.toUpperCase());
    return room?.engine.getState();
  }

  getConfig(roomId: string) {
    const room = this.rooms.get(roomId.toUpperCase());
    return room?.engine.getConfig();
  }

  getAvailableColors(roomId: string): PartyColorId[] {
    const room = this.rooms.get(roomId.toUpperCase());
    return room?.engine.getAvailableColors() || [];
  }

  getEventLog(roomId: string) {
    const room = this.rooms.get(roomId.toUpperCase());
    return room?.engine.getEventLog();
  }

  startGame(roomId: string): boolean {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return false;
    room.lastActivity = Date.now();
    return room.engine.startGame();
  }

  // Government: submit policy slider adjustments
  submitPolicyAdjustments(roomId: string, playerId: string, adjustments: PolicyAdjustment[]): boolean {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return false;
    room.lastActivity = Date.now();
    return room.engine.submitPolicyAdjustments(playerId, adjustments);
  }

  // Opposition: submit actions
  submitActions(roomId: string, playerId: string, actions: PlayerAction[]): boolean {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return false;
    room.lastActivity = Date.now();
    return room.engine.submitActions(playerId, actions);
  }

  // Government: resolve a dilemma
  resolveDilemma(roomId: string, playerId: string, choiceId: string): boolean {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return false;
    room.lastActivity = Date.now();
    return room.engine.resolveDilemma(playerId, choiceId);
  }

  // Force advance phase (host only)
  forceAdvancePhase(roomId: string, playerId: string): boolean {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return false;
    if (room.hostId !== playerId) return false;
    room.lastActivity = Date.now();
    return room.engine.forceAdvancePhase();
  }

  updateConfig(roomId: string, config: Partial<GameConfig>): boolean {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return false;
    room.lastActivity = Date.now();
    room.engine.updateConfig(config);
    return true;
  }

  addChatMessage(roomId: string, message: ChatMessage): void {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return;
    room.lastActivity = Date.now();
    room.engine.addChatMessage(message);
  }

  getSocketIdForPlayer(roomId: string, playerId: string): string | undefined {
    const room = this.rooms.get(roomId.toUpperCase());
    return room?.playerToSocket.get(playerId);
  }

  leaveRoom(roomId: string, socketId: string): string | undefined {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return undefined;

    const playerId = room.socketToPlayer.get(socketId);
    if (!playerId) return undefined;

    room.engine.removePlayer(playerId);
    room.socketToPlayer.delete(socketId);
    room.playerToSocket.delete(playerId);

    if (room.socketToPlayer.size === 0) {
      this.rooms.delete(roomId.toUpperCase());
    }

    return playerId;
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  getRoomList() {
    return Array.from(this.rooms.values()).map(room => ({
      id: room.id,
      playerCount: room.engine.getState().players.length,
      phase: room.engine.getState().phase,
      createdAt: room.createdAt,
    }));
  }

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

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    if (this.rooms.has(code)) {
      return this.generateRoomCode();
    }
    return code;
  }
}

export const roomManager = new RoomManager();
