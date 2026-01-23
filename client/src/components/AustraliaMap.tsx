/**
 * AustraliaMap Component
 *
 * Renders an SVG map of Australia with electoral seats displayed as dots.
 * Supports seat capture interaction when in seat_capture phase.
 */

import React, { useMemo, useState, useCallback } from 'react';
import { Seat, SeatId, Player, PendingSeatCapture, StateCode } from '../types';
import { MapPin, Target } from 'lucide-react';

interface AustraliaMapProps {
  seats: Record<SeatId, Seat>;
  players: Player[];
  pendingSeatCapture: PendingSeatCapture | null;
  currentPlayerId: string;
  onCaptureSeat?: (seatId: SeatId) => void;
}

// State label positions (approximate centers within states)
const STATE_LABELS: Record<StateCode, { x: number; y: number }> = {
  WA:  { x: 20, y: 50 },
  NT:  { x: 47, y: 32 },
  SA:  { x: 47, y: 62 },
  QLD: { x: 75, y: 38 },
  NSW: { x: 75, y: 62 },
  VIC: { x: 68, y: 76 },
  TAS: { x: 77, y: 93 },
  ACT: { x: 82, y: 68 },
};

// Geographically accurate Australia mainland outline
// Key features: Kimberley (NW), Gulf of Carpentaria (N), Cape York (NE),
// Great Barrier Reef coast (E), Victoria (SE), Great Australian Bight (S), SW corner
const AUSTRALIA_PATH = `
  M 5,35
  L 6,30
  L 8,25
  L 12,20
  L 15,17
  L 20,15
  L 25,14
  L 30,13
  L 35,14
  L 38,15
  L 42,14
  L 46,12
  L 50,10
  L 54,9
  L 58,10
  L 60,12
  L 58,16
  L 55,20
  L 54,24
  L 56,26
  L 60,24
  L 65,22
  L 70,18
  L 75,15
  L 80,14
  L 85,16
  L 88,20
  L 90,25
  L 91,30
  L 92,36
  L 91,42
  L 89,48
  L 87,54
  L 84,60
  L 80,66
  L 76,72
  L 72,76
  L 68,79
  L 64,80
  L 60,79
  L 56,77
  L 52,76
  L 48,78
  L 44,80
  L 40,81
  L 35,80
  L 30,78
  L 25,75
  L 20,70
  L 15,64
  L 10,56
  L 7,48
  L 5,42
  L 5,35
  Z
`;

// Tasmania - heart-shaped island south of Victoria
const TASMANIA_PATH = `
  M 73,88
  L 76,86
  L 80,86
  L 83,88
  L 84,91
  L 83,95
  L 80,98
  L 76,99
  L 72,97
  L 70,94
  L 70,90
  L 73,88
  Z
`;

// State boundary paths (following actual borders)
const STATE_BOUNDARIES = [
  // WA-NT border (129°E longitude - vertical from top)
  { d: 'M 38,14 L 38,48', stroke: '#64748b', strokeWidth: '0.6' },
  // WA-SA border (continues south to coast)
  { d: 'M 38,48 L 38,81', stroke: '#64748b', strokeWidth: '0.6' },
  // NT-SA border (26°S - horizontal segment)
  { d: 'M 38,48 L 56,48', stroke: '#64748b', strokeWidth: '0.6' },
  // NT-QLD border (138°E - vertical from Gulf)
  { d: 'M 56,26 L 56,48', stroke: '#64748b', strokeWidth: '0.6' },
  // SA-QLD corner (small vertical)
  { d: 'M 56,48 L 56,55', stroke: '#64748b', strokeWidth: '0.6' },
  // QLD-NSW border (29°S - diagonal to coast)
  { d: 'M 56,55 L 87,55', stroke: '#64748b', strokeWidth: '0.6' },
  // SA-NSW border (east from SA-QLD corner)
  { d: 'M 56,55 L 56,70 L 60,72', stroke: '#64748b', strokeWidth: '0.6' },
  // NSW-VIC border (Murray River - curved)
  { d: 'M 60,72 Q 68,74 72,76', stroke: '#64748b', strokeWidth: '0.6' },
  // SA-VIC border (141°E down to coast)
  { d: 'M 56,70 L 56,78', stroke: '#64748b', strokeWidth: '0.6' },
];

// Extended seat data for rendering
interface SeatRenderData extends Seat {
  color: string;
  eligible: boolean;
  dimmed: boolean;
}

export function AustraliaMap({
  seats,
  players,
  pendingSeatCapture,
  currentPlayerId,
  onCaptureSeat,
}: AustraliaMapProps) {
  const [hoveredSeat, setHoveredSeat] = useState<SeatRenderData | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Get player color by ID
  const getPlayerColor = useCallback((playerId: string | null): string => {
    if (!playerId) return '#d1d5db'; // Gray for unowned
    const player = players.find(p => p.id === playerId);
    return player?.color || '#d1d5db';
  }, [players]);

  // Get player name by ID
  const getPlayerName = useCallback((playerId: string | null): string => {
    if (!playerId) return 'Unowned';
    const player = players.find(p => p.id === playerId);
    return player?.name || 'Unknown';
  }, [players]);

  // Check if a seat is eligible for capture
  const isEligible = useCallback((seatId: SeatId): boolean => {
    if (!pendingSeatCapture) return false;
    return pendingSeatCapture.eligibleSeatIds.includes(seatId);
  }, [pendingSeatCapture]);

  // Check if we're in capture mode and current player is the actor
  const isCapturing = pendingSeatCapture && pendingSeatCapture.actorId === currentPlayerId;

  // Prepare seat data with visual properties
  const seatData = useMemo((): SeatRenderData[] => {
    return Object.values(seats).map(seat => ({
      ...seat,
      color: getPlayerColor(seat.ownerPlayerId),
      eligible: isEligible(seat.id),
      dimmed: Boolean(isCapturing && !isEligible(seat.id)),
    }));
  }, [seats, getPlayerColor, isEligible, isCapturing]);

  // Group seats by state for summary
  const seatsByState = useMemo(() => {
    const grouped: Record<StateCode, number> = {
      NSW: 0, VIC: 0, QLD: 0, WA: 0, SA: 0, TAS: 0, ACT: 0, NT: 0,
    };
    Object.values(seats).forEach(s => {
      grouped[s.state]++;
    });
    return grouped;
  }, [seats]);

  const handleSeatClick = (seat: typeof seatData[0]) => {
    if (isCapturing && seat.eligible && onCaptureSeat) {
      onCaptureSeat(seat.id);
    }
  };

  const handleSeatHover = (seat: typeof seatData[0], event: React.MouseEvent) => {
    setHoveredSeat(seat);
    setTooltipPos({ x: event.clientX, y: event.clientY });
  };

  return (
    <div className="relative bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          Electoral Map
        </h3>
        <span className="text-xs text-gray-500">
          {Object.keys(seats).length} seats
        </span>
      </div>

      {/* Capture mode indicator */}
      {isCapturing && (
        <div className="mb-2 p-2 bg-yellow-100 border border-yellow-300 rounded-lg flex items-center gap-2 text-sm">
          <Target className="w-4 h-4 text-yellow-600 animate-pulse" />
          <span className="text-yellow-800">
            <strong>Select {pendingSeatCapture.remaining} seat(s)</strong> to capture
            ({pendingSeatCapture.ideologyAxis}: {pendingSeatCapture.ideologyBucket})
          </span>
        </div>
      )}

      {/* SVG Map */}
      <svg
        viewBox="0 0 100 100"
        className="w-full h-auto"
        style={{ maxHeight: '300px' }}
      >
        {/* Background ocean */}
        <rect x="0" y="0" width="100" height="100" fill="#f0f9ff" />

        {/* Australia mainland outline */}
        <path
          d={AUSTRALIA_PATH}
          fill="#fef3c7"
          stroke="#d97706"
          strokeWidth="0.5"
        />

        {/* Tasmania */}
        <path
          d={TASMANIA_PATH}
          fill="#fef3c7"
          stroke="#d97706"
          strokeWidth="0.5"
        />

        {/* State boundaries */}
        {STATE_BOUNDARIES.map((boundary, i) => (
          <path
            key={i}
            d={boundary.d}
            stroke={boundary.stroke}
            strokeWidth={boundary.strokeWidth || '0.5'}
            strokeDasharray="2,1"
            fill="none"
          />
        ))}

        {/* State labels */}
        {Object.entries(STATE_LABELS).map(([state, pos]) => (
          <text
            key={state}
            x={pos.x}
            y={pos.y}
            fontSize="3"
            fill="#9ca3af"
            textAnchor="middle"
            className="font-medium select-none pointer-events-none"
          >
            {state}
          </text>
        ))}

        {/* Seat dots */}
        {seatData.map(seat => (
          <g key={seat.id}>
            {/* Eligible highlight ring */}
            {seat.eligible && (
              <circle
                cx={seat.x}
                cy={seat.y}
                r="2.5"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="0.5"
                className="animate-pulse"
              />
            )}

            {/* Seat dot */}
            <circle
              cx={seat.x}
              cy={seat.y}
              r="1.5"
              fill={seat.color}
              stroke={seat.eligible ? '#f59e0b' : '#fff'}
              strokeWidth={seat.eligible ? '0.4' : '0.2'}
              opacity={seat.dimmed ? 0.3 : 1}
              className={`transition-all duration-200 ${
                seat.eligible ? 'cursor-pointer hover:r-[2]' : ''
              }`}
              onClick={() => handleSeatClick(seat)}
              onMouseEnter={(e) => handleSeatHover(seat, e)}
              onMouseLeave={() => setHoveredSeat(null)}
              style={{
                filter: seat.eligible ? 'drop-shadow(0 0 2px #f59e0b)' : undefined,
              }}
            />
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-2">
        {players.map(player => {
          const count = Object.values(seats).filter(
            s => s.ownerPlayerId === player.id
          ).length;
          return (
            <div
              key={player.id}
              className="flex items-center gap-1 text-xs"
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: player.color }}
              />
              <span className="text-gray-700">
                {player.name}: {count}
              </span>
            </div>
          );
        })}
      </div>

      {/* Tooltip */}
      {hoveredSeat && (
        <div
          className="fixed z-50 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg pointer-events-none"
          style={{
            left: tooltipPos.x + 10,
            top: tooltipPos.y + 10,
          }}
        >
          <div className="font-medium">{hoveredSeat.name}</div>
          <div className="text-gray-300">
            {hoveredSeat.state} • {getPlayerName(hoveredSeat.ownerPlayerId)}
          </div>
          <div className="text-gray-400 mt-1">
            Econ: {hoveredSeat.ideology.econ} | Social: {hoveredSeat.ideology.social}
          </div>
          {isCapturing && hoveredSeat.eligible && (
            <div className="text-yellow-400 mt-1 font-medium">Click to capture!</div>
          )}
        </div>
      )}
    </div>
  );
}

// Compact mini version for sidebar
export function AustraliaMapMini({
  seats,
  players,
}: {
  seats: Record<SeatId, Seat>;
  players: Player[];
}) {
  const getPlayerColor = (playerId: string | null): string => {
    if (!playerId) return '#d1d5db';
    const player = players.find(p => p.id === playerId);
    return player?.color || '#d1d5db';
  };

  return (
    <svg viewBox="0 0 100 100" className="w-full h-auto" style={{ maxHeight: '120px' }}>
      <rect x="0" y="0" width="100" height="100" fill="#f0f9ff" />
      <path d={AUSTRALIA_PATH} fill="#fef3c7" stroke="#d97706" strokeWidth="0.5" />
      <path d={TASMANIA_PATH} fill="#fef3c7" stroke="#d97706" strokeWidth="0.5" />
      {Object.values(seats).map(seat => (
        <circle
          key={seat.id}
          cx={seat.x}
          cy={seat.y}
          r="1"
          fill={getPlayerColor(seat.ownerPlayerId)}
          stroke="#fff"
          strokeWidth="0.15"
        />
      ))}
    </svg>
  );
}
