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

// State label positions (approximate centers)
const STATE_LABELS: Record<StateCode, { x: number; y: number }> = {
  WA:  { x: 18, y: 45 },
  NT:  { x: 44, y: 20 },
  SA:  { x: 44, y: 55 },
  QLD: { x: 70, y: 25 },
  NSW: { x: 72, y: 60 },
  VIC: { x: 66, y: 82 },
  TAS: { x: 76, y: 96 },
  ACT: { x: 82, y: 62 },
};

// Simplified Australia outline path (recognizable silhouette)
const AUSTRALIA_PATH = `
  M 5,35
  Q 8,25 15,22
  L 25,20
  Q 30,18 33,18
  L 50,10
  Q 55,8 60,10
  L 75,15
  Q 85,18 90,25
  Q 92,35 88,50
  L 85,60
  Q 82,70 78,75
  L 70,82
  Q 65,88 60,88
  L 55,85
  Q 50,82 45,80
  L 38,75
  Q 30,72 25,65
  L 18,55
  Q 12,48 10,42
  Q 8,38 5,35
  Z
`;

// Tasmania path (small island)
const TASMANIA_PATH = `
  M 68,92
  Q 70,90 75,90
  Q 80,92 78,96
  Q 75,99 70,98
  Q 66,96 68,92
  Z
`;

// State boundary hints (simplified internal lines)
const STATE_BOUNDARIES = [
  // WA-SA-NT boundary
  { d: 'M 33,18 L 33,75', stroke: '#e5e7eb' },
  // NT-QLD boundary
  { d: 'M 50,10 L 50,42', stroke: '#e5e7eb' },
  // SA-QLD boundary
  { d: 'M 50,42 L 33,42', stroke: '#e5e7eb' },
  // SA-NSW boundary
  { d: 'M 50,42 L 50,75', stroke: '#e5e7eb' },
  // NSW-VIC boundary
  { d: 'M 50,75 L 78,75', stroke: '#e5e7eb' },
  // NSW-QLD boundary
  { d: 'M 50,42 L 85,42', stroke: '#e5e7eb' },
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
            strokeWidth="0.3"
            strokeDasharray="1,1"
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
