import React, { useMemo } from 'react';
import { Player } from '../types';
import { Star } from 'lucide-react';

// Design tokens - ballot paper aesthetic
const colors = {
  paper1: '#F4F1E8',
  paper2: '#EEEBE2',
  paper3: '#E8E5DC',
  ink: '#111111',
  inkSecondary: '#3A3A3A',
  rule: '#1A1A1A',
};

interface SeatLayoutProps {
  players: Player[];
  totalSeats: number;
  speakerId?: string;
}

export function SeatLayout({ players, totalSeats, speakerId }: SeatLayoutProps) {
  // Generate hemicycle layout
  const seatPositions = useMemo(() => {
    const positions: { x: number; y: number; playerId: string | null; color: string }[] = [];
    const rows = 4;
    const centerX = 150;
    const centerY = 130;
    
    let seatIndex = 0;
    const seatsPerPlayer: Record<string, number> = {};
    
    players.forEach(p => {
      seatsPerPlayer[p.id] = p.seats;
    });
    
    // Distribute seats in arc rows
    for (let row = 0; row < rows; row++) {
      const radius = 50 + row * 25;
      const seatsInRow = Math.floor(totalSeats / rows) + (row < totalSeats % rows ? 1 : 0);
      const angleStep = Math.PI / (seatsInRow + 1);
      
      for (let i = 0; i < seatsInRow && seatIndex < totalSeats; i++) {
        const angle = Math.PI - angleStep * (i + 1);
        const x = centerX + radius * Math.cos(angle);
        const y = centerY - radius * Math.sin(angle);
        
        // Find which player owns this seat
        let assignedPlayer: string | null = null;
        let assignedColor = '#e5e7eb';
        
        let remainingSeats = seatIndex;
        for (const player of players) {
          if (remainingSeats < player.seats) {
            assignedPlayer = player.id;
            assignedColor = player.color;
            break;
          }
          remainingSeats -= player.seats;
        }
        
        positions.push({ x, y, playerId: assignedPlayer, color: assignedColor });
        seatIndex++;
      }
    }
    
    return positions;
  }, [players, totalSeats]);

  const speaker = players.find(p => p.id === speakerId);

  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: colors.paper1, border: `2px solid ${colors.rule}` }}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold" style={{ color: colors.ink }}>Parliament</h3>
        {speaker && (
          <div className="flex items-center gap-1 text-xs" style={{ color: colors.inkSecondary }}>
            <Star className="w-3 h-3" style={{ color: colors.ink }} />
            <span>Speaker: {speaker.name}</span>
          </div>
        )}
      </div>

      <svg viewBox="0 0 300 140" className="w-full">
        {/* Background arc */}
        <path
          d="M 20 130 A 130 130 0 0 1 280 130"
          fill="none"
          stroke={colors.paper3}
          strokeWidth="80"
        />

        {/* Seats */}
        {seatPositions.map((seat, idx) => (
          <circle
            key={idx}
            cx={seat.x}
            cy={seat.y}
            r={4}
            fill={seat.color}
            stroke={colors.rule}
            strokeWidth={0.5}
          />
        ))}

        {/* Center podium */}
        <rect x="140" y="120" width="20" height="15" fill={colors.ink} rx="2" />
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mt-2 justify-center" style={{ borderTop: `1px solid ${colors.rule}`, paddingTop: '0.5rem' }}>
        {players.map(player => (
          <div key={player.id} className="flex items-center gap-1 text-xs" style={{ color: colors.ink }}>
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: player.color, border: `1px solid ${colors.rule}` }} />
            <span>{player.seats}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
