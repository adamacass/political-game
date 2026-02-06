import React, { useState, useMemo, useCallback } from 'react';
import { Seat, Player, SeatId, GameState } from '../types';

interface ChamberProps {
  gameState: GameState;
  playerId: string;
  selectedSeatId: SeatId | null;
  targetableSeatIds?: SeatId[];
  onSeatClick: (seatId: SeatId) => void;
  onSeatHover?: (seatId: SeatId | null) => void;
}

const STATE_ABBREV: Record<string, string> = {
  NSW: 'NSW', VIC: 'VIC', QLD: 'QLD', WA: 'WA',
  SA: 'SA', TAS: 'TAS', ACT: 'ACT', NT: 'NT',
};

/**
 * Vertical AusPar-style chamber layout.
 *
 * The Australian House of Representatives is a rectangular room:
 * - Government benches on the RIGHT side
 * - Opposition benches on the LEFT side
 * - Crossbench at the top (arch)
 * - Speaker's chair at the very top center
 * - Central table with mace between the two sides
 * - Seats grouped by party, flowing from bottom up on each side
 *
 * ViewBox: 0 0 800 1000
 */
export const Chamber: React.FC<ChamberProps> = ({
  gameState,
  playerId,
  selectedSeatId,
  targetableSeatIds = [],
  onSeatClick,
  onSeatHover,
}) => {
  const [hoveredSeat, setHoveredSeat] = useState<Seat | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const seats = useMemo(() => Object.values(gameState.seats), [gameState.seats]);
  const playerMap = useMemo(() => {
    const map: Record<string, Player> = {};
    gameState.players.forEach(p => { map[p.id] = p; });
    return map;
  }, [gameState.players]);

  // Compute seat counts per player for legend
  const seatCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    seats.forEach(s => {
      if (s.ownerPlayerId) {
        counts[s.ownerPlayerId] = (counts[s.ownerPlayerId] || 0) + 1;
      }
    });
    return counts;
  }, [seats]);

  // Sort seats by party for rendering: group by owner, ordered by seat count
  const sortedSeats = useMemo(() => {
    const govPlayer = gameState.players.reduce((best, p) =>
      p.seats > (best?.seats || 0) ? p : best, gameState.players[0]);

    return [...seats].sort((a, b) => {
      // Government seats first (right side), then opposition, then unowned
      const aGov = a.ownerPlayerId === govPlayer?.id ? 0 : a.ownerPlayerId ? 1 : 2;
      const bGov = b.ownerPlayerId === govPlayer?.id ? 0 : b.ownerPlayerId ? 1 : 2;
      if (aGov !== bGov) return aGov - bGov;

      // Within same category, group by owner
      if (a.ownerPlayerId !== b.ownerPlayerId) {
        const aCount = a.ownerPlayerId ? (seatCounts[a.ownerPlayerId] || 0) : 0;
        const bCount = b.ownerPlayerId ? (seatCounts[b.ownerPlayerId] || 0) : 0;
        return bCount - aCount;
      }

      // Same owner: sort by chamber position
      return a.y - b.y;
    });
  }, [seats, gameState.players, seatCounts]);

  const getSeatColor = useCallback((seat: Seat): string => {
    if (!seat.ownerPlayerId) return '#3a3a3a';
    const owner = playerMap[seat.ownerPlayerId];
    return owner?.color || '#3a3a3a';
  }, [playerMap]);

  const getSeatRadius = useCallback((seat: Seat): number => {
    const base = 5;
    if (selectedSeatId === seat.id) return base + 2;
    if (targetableSeatIds.includes(seat.id)) return base + 1;
    return base;
  }, [selectedSeatId, targetableSeatIds]);

  const getSeatClass = useCallback((seat: Seat): string => {
    const classes = ['seat-dot'];
    if (seat.contested) classes.push('contested');
    if (selectedSeatId === seat.id) classes.push('selected');
    if (targetableSeatIds.includes(seat.id)) classes.push('targetable');
    return classes.join(' ');
  }, [selectedSeatId, targetableSeatIds]);

  const handleSeatMouseEnter = useCallback((seat: Seat, e: React.MouseEvent) => {
    setHoveredSeat(seat);
    const svgEl = (e.target as SVGElement).closest('svg');
    if (svgEl) {
      const rect = svgEl.getBoundingClientRect();
      const scaleX = rect.width / 800;
      const scaleY = rect.height / 1000;
      setTooltipPos({
        x: rect.left + seat.x * scaleX,
        y: rect.top + seat.y * scaleY - 10,
      });
    }
    onSeatHover?.(seat.id);
  }, [onSeatHover]);

  const handleSeatMouseLeave = useCallback(() => {
    setHoveredSeat(null);
    onSeatHover?.(null);
  }, [onSeatHover]);

  // Majority line
  const majorityCount = Math.ceil(gameState.totalSeats / 2);

  return (
    <div className="relative w-full chamber-bg" style={{ aspectRatio: '4/5' }}>
      <svg
        viewBox="0 0 800 1000"
        className="w-full h-full"
        style={{ display: 'block' }}
      >
        <defs>
          <radialGradient id="chamberFloor" cx="50%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#1a3c28" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#0c1a12" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="tableWood" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#5c3d22" />
            <stop offset="100%" stopColor="#3d2815" />
          </linearGradient>
          <linearGradient id="maceGold" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#d4a634" />
            <stop offset="50%" stopColor="#8a6508" />
            <stop offset="100%" stopColor="#d4a634" />
          </linearGradient>
        </defs>

        {/* Chamber floor */}
        <rect x="0" y="0" width="800" height="1000" fill="url(#chamberFloor)" />

        {/* Bench guide lines (subtle) */}
        {/* Left side bench rows */}
        {[0, 1, 2, 3, 4].map(col => (
          <line
            key={`left-guide-${col}`}
            x1={264 - col * 36} y1="260" x2={264 - col * 36} y2="900"
            stroke="rgba(42,69,53,0.2)" strokeWidth="0.5" strokeDasharray="4 8"
          />
        ))}
        {/* Right side bench rows */}
        {[0, 1, 2, 3, 4].map(col => (
          <line
            key={`right-guide-${col}`}
            x1={520 + col * 36} y1="260" x2={520 + col * 36} y2="900"
            stroke="rgba(42,69,53,0.2)" strokeWidth="0.5" strokeDasharray="4 8"
          />
        ))}

        {/* Arch guide at top */}
        {[0, 1, 2, 3, 4].map(row => {
          const r = 140 + row * 36;
          return (
            <path
              key={`arch-guide-${row}`}
              d={`M ${400 - r} 260 A ${r} ${r} 0 0 1 ${400 + r} 260`}
              fill="none"
              stroke="rgba(42,69,53,0.15)"
              strokeWidth="0.5"
              strokeDasharray="4 8"
            />
          );
        })}

        {/* Central table (dispatch boxes) */}
        <rect x="370" y="350" width="60" height="400" rx="4" fill="url(#tableWood)" stroke="#5c3d22" strokeWidth="1" />

        {/* Mace on the table */}
        <rect x="393" y="380" width="14" height="80" rx="3" fill="url(#maceGold)" />
        <circle cx="400" cy="378" r="5" fill="#d4a634" />

        {/* Dividing line (center aisle) */}
        <line x1="400" y1="270" x2="400" y2="920" stroke="rgba(184,134,11,0.1)" strokeWidth="1" strokeDasharray="6 6" />

        {/* Speaker's chair at top */}
        <g transform="translate(400, 100)">
          <rect x="-35" y="-20" width="70" height="40" rx="6" fill="#3d2815" stroke="#5c3d22" strokeWidth="1.5" />
          <rect x="-28" y="-14" width="56" height="28" rx="3" fill="#2a1c0e" />
          <text x="0" y="4" textAnchor="middle" fill="#d4a634" fontSize="9" fontFamily="'IBM Plex Mono', monospace" letterSpacing="0.15em">
            SPEAKER
          </text>
        </g>

        {/* Side labels */}
        <text x="320" y="950" textAnchor="middle" fill="rgba(160,112,64,0.25)" fontSize="11" fontFamily="'IBM Plex Mono', monospace" letterSpacing="0.2em">
          OPPOSITION
        </text>
        <text x="480" y="950" textAnchor="middle" fill="rgba(160,112,64,0.25)" fontSize="11" fontFamily="'IBM Plex Mono', monospace" letterSpacing="0.2em">
          GOVERNMENT
        </text>

        {/* Crossbench label */}
        <text x="400" y="175" textAnchor="middle" fill="rgba(160,112,64,0.20)" fontSize="9" fontFamily="'IBM Plex Mono', monospace" letterSpacing="0.15em">
          CROSSBENCH
        </text>

        {/* All seats */}
        {sortedSeats.map(seat => (
          <circle
            key={seat.id}
            cx={seat.x}
            cy={seat.y}
            r={getSeatRadius(seat)}
            fill={getSeatColor(seat)}
            stroke={seat.ownerPlayerId === playerId ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'}
            strokeWidth={seat.ownerPlayerId === playerId ? 1.5 : 0.5}
            className={getSeatClass(seat)}
            onClick={() => onSeatClick(seat.id)}
            onMouseEnter={(e) => handleSeatMouseEnter(seat, e)}
            onMouseLeave={handleSeatMouseLeave}
            style={{
              opacity: seat.margin < 20 ? 0.7 : 1,
              filter: seat.lastCampaignedBy ? 'saturate(1.3)' : undefined,
            }}
          />
        ))}

        {/* Round indicator */}
        <text x="20" y="24" fill="rgba(184,134,11,0.6)" fontSize="10" fontFamily="'IBM Plex Mono', monospace">
          ROUND {gameState.round}/{gameState.maxRounds}
        </text>

        {/* Majority line indicator */}
        <text x="780" y="24" textAnchor="end" fill="rgba(184,134,11,0.4)" fontSize="9" fontFamily="'IBM Plex Mono', monospace">
          MAJORITY: {majorityCount}
        </text>
      </svg>

      {/* Seat tooltip */}
      {hoveredSeat && (
        <div
          className="tooltip-content fixed z-50"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="font-display font-bold text-sm" style={{ color: getSeatColor(hoveredSeat) }}>
            {hoveredSeat.name}
          </div>
          <div className="font-mono text-xs mt-1" style={{ color: '#a09880' }}>
            {STATE_ABBREV[hoveredSeat.state]} &middot; {hoveredSeat.chamberSide}
          </div>
          <div className="flex gap-3 mt-1">
            <span className="font-mono text-xs">
              {hoveredSeat.ideology.econ} / {hoveredSeat.ideology.social}
            </span>
          </div>
          <div className="font-mono text-xs mt-1">
            Margin: {hoveredSeat.margin}%
            {hoveredSeat.margin < 20 && <span style={{ color: '#e65100' }}> MARGINAL</span>}
          </div>
          {hoveredSeat.ownerPlayerId && (
            <div className="font-mono text-xs mt-1">
              Held by: {playerMap[hoveredSeat.ownerPlayerId]?.name || 'Unknown'}
            </div>
          )}
          {hoveredSeat.contested && (
            <div className="font-mono text-xs mt-1" style={{ color: '#daa520' }}>
              CONTESTED
            </div>
          )}
        </div>
      )}

      {/* Seat count legend */}
      <div className="absolute bottom-2 left-2 flex flex-col gap-1">
        {gameState.players
          .sort((a, b) => b.seats - a.seats)
          .map(p => (
          <div key={p.id} className="flex items-center gap-2 font-mono text-xs" style={{ opacity: 0.85 }}>
            <div
              className="w-3 h-3 rounded-sm"
              style={{
                backgroundColor: p.color,
                border: p.id === playerId ? '1px solid rgba(255,255,255,0.6)' : '1px solid rgba(0,0,0,0.3)',
              }}
            />
            <span style={{ color: p.id === playerId ? '#f0e8d4' : '#a09880' }}>
              {seatCounts[p.id] || 0} {p.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Chamber;
