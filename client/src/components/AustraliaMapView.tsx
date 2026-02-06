import React, { useState, useMemo, useCallback } from 'react';
import { GameState, Player, Seat, SeatId, StateCode } from '../types';

interface AustraliaMapViewProps {
  gameState: GameState;
  playerId: string;
  selectedSeatId: SeatId | null;
  targetableSeatIds?: SeatId[];
  onSeatClick: (seatId: SeatId) => void;
  onSeatHover?: (seatId: SeatId | null) => void;
}

/**
 * Simplified SVG paths for Australian states.
 * These are approximate outlines positioned on a 1000x800 viewBox.
 */
const STATE_PATHS: Record<StateCode, string> = {
  WA: 'M80,140 L310,140 L310,290 L340,290 L340,680 L80,680 Z',
  NT: 'M310,140 L540,140 L540,360 L310,360 Z',
  SA: 'M340,290 L540,290 L540,360 L570,360 L570,620 L340,620 Z',
  QLD: 'M540,140 L830,140 L830,440 L570,440 L570,360 L540,360 Z',
  NSW: 'M570,440 L830,440 L830,580 L640,580 L640,560 L570,560 Z',
  VIC: 'M570,560 L640,560 L640,580 L760,580 L760,640 L570,640 Z',
  TAS: 'M650,680 L720,680 L720,750 L650,750 Z',
  ACT: 'M710,520 L740,520 L740,550 L710,550 Z',
};

/** Label positions for each state */
const STATE_LABELS: Record<StateCode, { x: number; y: number }> = {
  WA: { x: 195, y: 440 },
  NT: { x: 425, y: 260 },
  SA: { x: 455, y: 470 },
  QLD: { x: 690, y: 300 },
  NSW: { x: 720, y: 500 },
  VIC: { x: 660, y: 610 },
  TAS: { x: 685, y: 720 },
  ACT: { x: 755, y: 535 },
};

const ALL_STATES: StateCode[] = ['WA', 'NT', 'SA', 'QLD', 'NSW', 'VIC', 'TAS', 'ACT'];

export const AustraliaMapView: React.FC<AustraliaMapViewProps> = ({
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

  // Group seats by state for rendering
  const seatsByState = useMemo(() => {
    const grouped: Record<StateCode, Seat[]> = {
      NSW: [], VIC: [], QLD: [], WA: [], SA: [], TAS: [], ACT: [], NT: [],
    };
    seats.forEach(s => { grouped[s.state].push(s); });
    return grouped;
  }, [seats]);

  // State control colors
  const stateControlColors = useMemo(() => {
    const colors: Record<StateCode, string> = {} as Record<StateCode, string>;
    for (const state of ALL_STATES) {
      const control = gameState.stateControl[state];
      if (control?.controllerId) {
        const player = playerMap[control.controllerId];
        colors[state] = player?.color || 'transparent';
      } else {
        colors[state] = 'transparent';
      }
    }
    return colors;
  }, [gameState.stateControl, playerMap]);

  const getSeatColor = useCallback((seat: Seat): string => {
    if (!seat.ownerPlayerId) return '#3a3a3a';
    const owner = playerMap[seat.ownerPlayerId];
    return owner?.color || '#3a3a3a';
  }, [playerMap]);

  const handleSeatMouseEnter = useCallback((seat: Seat, e: React.MouseEvent) => {
    setHoveredSeat(seat);
    const svgEl = (e.target as SVGElement).closest('svg');
    if (svgEl) {
      const rect = svgEl.getBoundingClientRect();
      const scaleX = rect.width / 1000;
      const scaleY = rect.height / 800;
      setTooltipPos({
        x: rect.left + seat.mapX * scaleX,
        y: rect.top + seat.mapY * scaleY - 10,
      });
    }
    onSeatHover?.(seat.id);
  }, [onSeatHover]);

  const handleSeatMouseLeave = useCallback(() => {
    setHoveredSeat(null);
    onSeatHover?.(null);
  }, [onSeatHover]);

  return (
    <div className="relative w-full chamber-bg" style={{ aspectRatio: '5/4' }}>
      <svg viewBox="0 0 1000 800" className="w-full h-full" style={{ display: 'block' }}>
        <defs>
          <radialGradient id="mapBg" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#1a3c28" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#0c1a12" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width="1000" height="800" fill="url(#mapBg)" />

        {/* Ocean label */}
        <text x="900" y="760" textAnchor="end" fill="rgba(184,134,11,0.15)" fontSize="9"
          fontFamily="'IBM Plex Mono', monospace" letterSpacing="0.3em">
          AUSTRALIA
        </text>

        {/* State outlines */}
        {ALL_STATES.map(state => (
          <g key={state}>
            <path
              d={STATE_PATHS[state]}
              fill="rgba(26,60,40,0.2)"
              stroke={stateControlColors[state] !== 'transparent'
                ? stateControlColors[state]
                : 'rgba(184,134,11,0.2)'}
              strokeWidth={stateControlColors[state] !== 'transparent' ? 2 : 0.5}
              opacity={0.8}
            />
            {/* State label */}
            <text
              x={STATE_LABELS[state].x}
              y={STATE_LABELS[state].y}
              textAnchor="middle"
              fill="rgba(184,134,11,0.35)"
              fontSize="12"
              fontFamily="'IBM Plex Mono', monospace"
              letterSpacing="0.15em"
            >
              {state}
            </text>
            {/* Seat count for state */}
            <text
              x={STATE_LABELS[state].x}
              y={STATE_LABELS[state].y + 16}
              textAnchor="middle"
              fill="rgba(184,134,11,0.2)"
              fontSize="9"
              fontFamily="'IBM Plex Mono', monospace"
            >
              {seatsByState[state].length}
            </text>
          </g>
        ))}

        {/* Seats as dots */}
        {seats.map(seat => (
          <circle
            key={seat.id}
            cx={seat.mapX}
            cy={seat.mapY}
            r={
              selectedSeatId === seat.id ? 5 :
              targetableSeatIds.includes(seat.id) ? 4.5 : 3.5
            }
            fill={getSeatColor(seat)}
            stroke={
              seat.ownerPlayerId === playerId
                ? 'rgba(255,255,255,0.5)'
                : selectedSeatId === seat.id
                  ? '#daa520'
                  : 'rgba(0,0,0,0.3)'
            }
            strokeWidth={seat.ownerPlayerId === playerId ? 1 : 0.3}
            className={`seat-dot ${seat.contested ? 'contested' : ''} ${
              selectedSeatId === seat.id ? 'selected' : ''
            } ${targetableSeatIds.includes(seat.id) ? 'targetable' : ''}`}
            onClick={() => onSeatClick(seat.id)}
            onMouseEnter={(e) => handleSeatMouseEnter(seat, e)}
            onMouseLeave={handleSeatMouseLeave}
            style={{
              opacity: seat.margin < 20 ? 0.7 : 1,
            }}
          />
        ))}
      </svg>

      {/* Tooltip */}
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
            {hoveredSeat.state} &middot; {hoveredSeat.ideology.econ}/{hoveredSeat.ideology.social}
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
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-2 left-2 flex flex-col gap-1">
        {gameState.players
          .sort((a, b) => b.seats - a.seats)
          .map(p => (
          <div key={p.id} className="flex items-center gap-2 font-mono text-xs" style={{ opacity: 0.85 }}>
            <div className="w-3 h-3 rounded-sm" style={{
              backgroundColor: p.color,
              border: p.id === playerId ? '1px solid rgba(255,255,255,0.6)' : '1px solid rgba(0,0,0,0.3)',
            }} />
            <span style={{ color: p.id === playerId ? '#f0e8d4' : '#a09880' }}>
              {p.seats} {p.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AustraliaMapView;
