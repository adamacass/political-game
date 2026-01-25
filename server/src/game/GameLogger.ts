/**
 * GameLogger - Comprehensive logging system for game events
 *
 * Tracks all critical game events including:
 * - Seat ownership changes
 * - Political Capital (PCap) changes
 * - Round summaries
 * - Campaign and policy actions
 *
 * Provides export functionality for CSV and JSON formats for statistical analysis.
 */

export type GameEventType =
  | 'seat_change'
  | 'pcap_change'
  | 'policy_passed'
  | 'campaign_played'
  | 'round_end'
  | 'game_start'
  | 'game_end';

export interface GameLogEntry {
  timestamp: number;
  round: number;
  phase: string;
  eventType: GameEventType;
  playerId?: string;
  data: {
    // For seat_change:
    seatId?: string;
    seatName?: string;
    fromPlayerId?: string;
    toPlayerId?: string;
    reason?: string; // 'campaign', 'policy', 'capture', etc.

    // For PCap tracking:
    pCapDelta?: number;
    newPCap?: number;

    // For campaign/policy:
    cardId?: string;
    cardName?: string;
    targetPlayerId?: string;

    // Round summary:
    playerStandings?: Array<{
      playerId: string;
      playerName: string;
      seats: number;
      pCap: number;
      totalPCapEarned?: number;
    }>;

    // Additional context
    description?: string;
  };
}

export class GameLogger {
  private log: GameLogEntry[] = [];
  private gameId: string;
  private startTime: number;

  constructor(gameId: string) {
    this.gameId = gameId;
    this.startTime = Date.now();
  }

  /**
   * Log a seat ownership change
   */
  logSeatChange(
    round: number,
    phase: string,
    seatId: string,
    seatName: string,
    fromPlayerId: string | null,
    toPlayerId: string,
    reason: string
  ): void {
    this.log.push({
      timestamp: Date.now(),
      round,
      phase,
      eventType: 'seat_change',
      playerId: toPlayerId,
      data: {
        seatId,
        seatName,
        fromPlayerId: fromPlayerId || undefined,
        toPlayerId,
        reason,
        description: `${seatName} transferred from ${fromPlayerId || 'unowned'} to ${toPlayerId} via ${reason}`
      }
    });
  }

  /**
   * Log a Political Capital change
   */
  logPCapChange(
    round: number,
    phase: string,
    playerId: string,
    playerName: string,
    delta: number,
    newTotal: number,
    reason: string
  ): void {
    this.log.push({
      timestamp: Date.now(),
      round,
      phase,
      eventType: 'pcap_change',
      playerId,
      data: {
        pCapDelta: delta,
        newPCap: newTotal,
        reason,
        description: `${playerName} ${delta > 0 ? 'gained' : 'lost'} ${Math.abs(delta)} PCap via ${reason} (new total: ${newTotal})`
      }
    });
  }

  /**
   * Log a campaign card being played
   */
  logCampaignPlayed(
    round: number,
    phase: string,
    playerId: string,
    playerName: string,
    cardId: string,
    cardName: string,
    targetPlayerId?: string,
    seatsGained?: number
  ): void {
    this.log.push({
      timestamp: Date.now(),
      round,
      phase,
      eventType: 'campaign_played',
      playerId,
      data: {
        cardId,
        cardName,
        targetPlayerId,
        description: `${playerName} played campaign "${cardName}"${targetPlayerId ? ` targeting ${targetPlayerId}` : ''}${seatsGained ? ` gaining ${seatsGained} seats` : ''}`
      }
    });
  }

  /**
   * Log a policy being passed
   */
  logPolicyPassed(
    round: number,
    phase: string,
    playerId: string,
    playerName: string,
    cardId: string,
    cardName: string,
    votesFor: number,
    votesAgainst: number
  ): void {
    this.log.push({
      timestamp: Date.now(),
      round,
      phase,
      eventType: 'policy_passed',
      playerId,
      data: {
        cardId,
        cardName,
        description: `${playerName} passed policy "${cardName}" (${votesFor} for, ${votesAgainst} against)`
      }
    });
  }

  /**
   * Log the end of a round with player standings
   */
  logRoundEnd(
    round: number,
    playerStandings: Array<{
      playerId: string;
      playerName: string;
      seats: number;
      pCap: number;
      totalPCapEarned?: number;
    }>
  ): void {
    this.log.push({
      timestamp: Date.now(),
      round,
      phase: 'round_end',
      eventType: 'round_end',
      data: {
        playerStandings,
        description: `Round ${round} ended. Standings: ${playerStandings.map(p => `${p.playerName}: ${p.seats} seats, ${p.pCap} PCap`).join('; ')}`
      }
    });
  }

  /**
   * Log game start
   */
  logGameStart(players: Array<{ playerId: string; playerName: string }>): void {
    this.log.push({
      timestamp: Date.now(),
      round: 0,
      phase: 'setup',
      eventType: 'game_start',
      data: {
        description: `Game started with players: ${players.map(p => p.playerName).join(', ')}`
      }
    });
  }

  /**
   * Log game end
   */
  logGameEnd(
    round: number,
    winner: { playerId: string; playerName: string; seats: number; pCap: number }
  ): void {
    this.log.push({
      timestamp: Date.now(),
      round,
      phase: 'game_end',
      eventType: 'game_end',
      playerId: winner.playerId,
      data: {
        description: `Game ended. Winner: ${winner.playerName} with ${winner.seats} seats and ${winner.pCap} PCap`
      }
    });
  }

  /**
   * Export log as JSON
   */
  exportJSON(): string {
    return JSON.stringify({
      gameId: this.gameId,
      startTime: this.startTime,
      duration: Date.now() - this.startTime,
      entries: this.log
    }, null, 2);
  }

  /**
   * Export log as CSV
   */
  exportCSV(): string {
    const headers = [
      'Timestamp',
      'Round',
      'Phase',
      'Event Type',
      'Player ID',
      'Seat ID',
      'Seat Name',
      'From Player',
      'To Player',
      'Reason',
      'PCap Delta',
      'New PCap',
      'Card ID',
      'Card Name',
      'Description'
    ];

    const rows = this.log.map(entry => [
      new Date(entry.timestamp).toISOString(),
      entry.round.toString(),
      entry.phase,
      entry.eventType,
      entry.playerId || '',
      entry.data.seatId || '',
      entry.data.seatName || '',
      entry.data.fromPlayerId || '',
      entry.data.toPlayerId || '',
      entry.data.reason || '',
      entry.data.pCapDelta?.toString() || '',
      entry.data.newPCap?.toString() || '',
      entry.data.cardId || '',
      entry.data.cardName || '',
      entry.data.description || ''
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
  }

  /**
   * Get all log entries
   */
  export(): GameLogEntry[] {
    return [...this.log];
  }

  /**
   * Get log entries filtered by event type
   */
  getByEventType(eventType: GameEventType): GameLogEntry[] {
    return this.log.filter(entry => entry.eventType === eventType);
  }

  /**
   * Get log entries for a specific player
   */
  getByPlayer(playerId: string): GameLogEntry[] {
    return this.log.filter(entry => entry.playerId === playerId);
  }

  /**
   * Get log entries for a specific round
   */
  getByRound(round: number): GameLogEntry[] {
    return this.log.filter(entry => entry.round === round);
  }

  /**
   * Clear all log entries (for testing)
   */
  clear(): void {
    this.log = [];
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalEvents: number;
    eventCounts: Record<GameEventType, number>;
    totalRounds: number;
    gameDuration: number;
  } {
    const eventCounts: Record<string, number> = {};
    let maxRound = 0;

    this.log.forEach(entry => {
      eventCounts[entry.eventType] = (eventCounts[entry.eventType] || 0) + 1;
      maxRound = Math.max(maxRound, entry.round);
    });

    return {
      totalEvents: this.log.length,
      eventCounts: eventCounts as Record<GameEventType, number>,
      totalRounds: maxRound,
      gameDuration: Date.now() - this.startTime
    };
  }
}
