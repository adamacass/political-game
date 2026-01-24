export type GameLogEventType =
  | 'seat_change'
  | 'pcap_change'
  | 'policy_passed'
  | 'campaign_played'
  | 'round_end';

export interface GameLogEntry {
  timestamp: number;
  round: number;
  phase: string;
  eventType: GameLogEventType;
  playerId?: string;
  data: {
    seatId?: string;
    seatName?: string;
    fromPlayerId?: string;
    toPlayerId?: string;
    reason?: string;
    pCapDelta?: number;
    newPCap?: number;
    playerStandings?: { playerId: string; seats: number; pCap: number }[];
  };
}

export class GameLogger {
  private log: GameLogEntry[] = [];

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
      },
    });
  }

  logPCapChange(
    round: number,
    phase: string,
    playerId: string,
    pCapDelta: number,
    newPCap: number,
    reason: string
  ): void {
    this.log.push({
      timestamp: Date.now(),
      round,
      phase,
      eventType: 'pcap_change',
      playerId,
      data: {
        pCapDelta,
        newPCap,
        reason,
      },
    });
  }

  logRoundEnd(
    round: number,
    phase: string,
    playerStandings: { playerId: string; seats: number; pCap: number }[]
  ): void {
    this.log.push({
      timestamp: Date.now(),
      round,
      phase,
      eventType: 'round_end',
      data: {
        playerStandings,
      },
    });
  }

  export(): GameLogEntry[] {
    return [...this.log];
  }

  exportJSON(): string {
    return JSON.stringify(this.log, null, 2);
  }

  exportCSV(): string {
    const header = [
      'timestamp',
      'round',
      'phase',
      'eventType',
      'playerId',
      'seatId',
      'seatName',
      'fromPlayerId',
      'toPlayerId',
      'reason',
      'pCapDelta',
      'newPCap',
      'playerStandings',
    ];
    const rows = this.log.map(entry => {
      const standings = entry.data.playerStandings
        ? JSON.stringify(entry.data.playerStandings)
        : '';
      return [
        entry.timestamp,
        entry.round,
        entry.phase,
        entry.eventType,
        entry.playerId || '',
        entry.data.seatId || '',
        entry.data.seatName || '',
        entry.data.fromPlayerId || '',
        entry.data.toPlayerId || '',
        entry.data.reason || '',
        entry.data.pCapDelta ?? '',
        entry.data.newPCap ?? '',
        standings.replace(/\"/g, '""'),
      ];
    });

    return [
      header.join(','),
      ...rows.map(row =>
        row
          .map(value => `"${String(value)}"`)
          .join(',')
      ),
    ].join('\n');
  }
}
