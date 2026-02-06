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

  const myPlayer = playerMap[playerId];

  // Compute seat counts per player for the legend
  const seatCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    seats.forEach(s => {
      if (s.ownerPlayerId) {
        counts[s.ownerPlayerId] = (counts[s.ownerPlayerId] || 0) + 1;
      }
    });
    return counts;
  }, [seats]);

  const getSeatColor = useCallback((seat: Seat): string => {
    if (!seat.ownerPlayerId) return '#3a3a3a';
    const owner = playerMap[seat.ownerPlayerId];
    return owner?.color || '#3a3a3a';
  }, [playerMap]);

  const getSeatRadius = useCallback((seat: Seat): number => {
    const base = seat.chamberRow === 0 ? 5.5 : seat.chamberRow === 1 ? 5 : 4.5;
    if (selectedSeatId === seat.id) return base + 1.5;
    if (targetableSeatIds.includes(seat.id)) return base + 0.8;
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
      const scaleX = rect.width / 1000;
      const scaleY = rect.height / 700;
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

  return (
    <div className="relative w-full chamber-bg" style={{ aspectRatio: '10/7' }}>
      <svg
        viewBox="0 0 1000 700"
        className="w-full h-full"
        style={{ display: 'block' }}
      >
        {/* Chamber floor gradient */}
        <defs>
          <radialGradient id="chamberFloor" cx="50%" cy="65%" r="55%">
            <stop offset="0%" stopColor="#1a3c28" stopOpacity="0.6" />
            <stop offset="60%" stopColor="#0f2a1b" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#0c1a12" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="tableGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#5c3d22" />
            <stop offset="70%" stopColor="#3d2815" />
            <stop offset="100%" stopColor="#2a1c0e" />
          </radialGradient>
          <linearGradient id="maceGold" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8a6508" />
            <stop offset="50%" stopColor="#d4a634" />
            <stop offset="100%" stopColor="#8a6508" />
          </linearGradient>
        </defs>

        {/* Chamber floor */}
        <ellipse cx="500" cy="420" rx="420" ry="320" fill="url(#chamberFloor)" />

        {/* Row guide arcs (subtle) */}
        {[170, 215, 260, 305, 350].map((r, i) => (
          <path
            key={`arc-${i}`}
            d={describeArc(500, 340, r, -145, 145)}
            fill="none"
            stroke="rgba(42,69,53,0.3)"
            strokeWidth="0.5"
            strokeDasharray="4 8"
          />
        ))}

        {/* Central table (dispatch boxes) */}
        <rect x="470" y="490" width="60" height="120" rx="4" fill="url(#tableGlow)" stroke="#5c3d22" strokeWidth="1.5" />
        {/* Mace on the table */}
        <rect x="490" y="510" width="20" height="4" rx="2" fill="url(#maceGold)" />
        <circle cx="512" cy="512" r="3" fill="#d4a634" />

        {/* Speaker's chair */}
        <g transform="translate(500, 640)">
          <rect x="-25" y="-15" width="50" height="30" rx="3" fill="#3d2815" stroke="#5c3d22" strokeWidth="1" />
          <rect x="-20" y="-10" width="40" height="20" rx="2" fill="#2a1c0e" />
          <text x="0" y="4" textAnchor="middle" fill="#d4a634" fontSize="8" fontFamily="'IBM Plex Mono', monospace" letterSpacing="0.1em">
            SPEAKER
          </text>
        </g>

        {/* Dividing line */}
        <line x1="500" y1="480" x2="500" y2="610" stroke="rgba(184,134,11,0.15)" strokeWidth="1" strokeDasharray="4 4" />

        {/* "Government" / "Opposition" labels */}
        <text x="650" y="660" textAnchor="middle" fill="rgba(160,112,64,0.3)" fontSize="10" fontFamily="'IBM Plex Mono', monospace" letterSpacing="0.15em" transform="rotate(-5, 650, 660)">
          GOVERNMENT
        </text>
        <text x="350" y="660" textAnchor="middle" fill="rgba(160,112,64,0.3)" fontSize="10" fontFamily="'IBM Plex Mono', monospace" letterSpacing="0.15em" transform="rotate(5, 350, 660)">
          OPPOSITION
        </text>

        {/* All seats */}
        {seats.map(seat => (
          <circle
            key={seat.id}
            cx={seat.x}
            cy={seat.y}
            r={getSeatRadius(seat)}
            fill={getSeatColor(seat)}
            stroke={seat.ownerPlayerId === playerId ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'}
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

        {/* Round & phase indicator */}
        <text x="20" y="24" fill="rgba(184,134,11,0.6)" fontSize="10" fontFamily="'IBM Plex Mono', monospace">
          ROUND {gameState.round}/{gameState.maxRounds}
        </text>
      </svg>

      {/* Seat tooltip (rendered outside SVG for better text rendering) */}
      {hoveredSeat && (
        <div
          className="tooltip-content fixed"
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
            {STATE_ABBREV[hoveredSeat.state]} &middot; Row {hoveredSeat.chamberRow + 1}
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

      {/* Seat count legend (bottom-left overlay) */}
      <div className="absolute bottom-2 left-2 flex flex-col gap-1">
        {gameState.players.map(p => (
          <div key={p.id} className="flex items-center gap-2 font-mono text-xs" style={{ opacity: 0.8 }}>
            <div
              className="w-3 h-3 rounded-sm"
              style={{
                backgroundColor: p.color,
                border: p.id === playerId ? '1px solid rgba(255,255,255,0.6)' : '1px solid rgba(0,0,0,0.3)',
              }}
            />
            <span style={{ color: p.id === playerId ? '#f0e8d4' : '#a09880' }}>
              {seatCounts[p.id] || 0}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Helper: describe an SVG arc path
function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string {
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;

  const x1 = cx + radius * Math.sin(startRad);
  const y1 = cy - radius * Math.cos(startRad);
  const x2 = cx + radius * Math.sin(endRad);
  const y2 = cy - radius * Math.cos(endRad);

  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
}

export default Chamber;
