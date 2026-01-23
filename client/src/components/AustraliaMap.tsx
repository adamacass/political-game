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

// State label positions (centers within each state region)
const STATE_LABELS: Record<StateCode, { x: number; y: number }> = {
  WA:  { x: 22, y: 45 },
  NT:  { x: 50, y: 30 },
  SA:  { x: 48, y: 55 },
  QLD: { x: 78, y: 35 },
  NSW: { x: 78, y: 58 },
  VIC: { x: 70, y: 66 },
  TAS: { x: 80, y: 83 },
  ACT: { x: 82, y: 62 },
};

// Simplified but recognizable Australia outline
// Scaled to fit viewBox 0-100, with key geographic features:
// - Straight western coast
// - Kimberley bulge (NW)
// - Gulf of Carpentaria (large northern indent)
// - Cape York (NE peninsula)
// - Curved eastern coast
// - Southeast corner (Victoria)
// - Great Australian Bight (southern curve)
const AUSTRALIA_PATH = `
  M 10,65
  L 10,55 L 10,45 L 11,35 L 13,28
  L 16,22 L 20,18 L 25,16 L 30,17 L 33,20
  L 36,18 L 40,15 L 45,14 L 48,16
  L 50,20 L 48,26 L 45,30 L 46,34 L 50,32 L 54,28
  L 58,24 L 62,22 L 66,24 L 68,28
  L 72,24 L 76,20 L 80,17 L 84,15
  L 88,18 L 90,24 L 91,32 L 90,40
  L 88,48 L 85,55 L 82,60 L 78,64
  L 74,67 L 70,68 L 66,67 L 63,65
  L 58,66 L 52,68 L 46,68 L 40,67
  L 34,68 L 28,70 L 22,70 L 16,68
  L 12,65 L 10,65
  Z
`;

// Tasmania - island south of Victoria
const TASMANIA_PATH = `
  M 74,78
  L 78,76 L 83,77 L 86,80
  L 86,85 L 83,89 L 78,90
  L 74,88 L 72,84 L 73,80 L 74,78
  Z
`;

// State boundary paths matching the simplified outline
const STATE_BOUNDARIES = [
  // WA-NT border (vertical from top)
  { d: 'M 38,16 L 38,46', stroke: '#1A1A1A', strokeWidth: '0.4' },
  // WA-SA border (continues south)
  { d: 'M 38,46 L 38,68', stroke: '#1A1A1A', strokeWidth: '0.4' },
  // NT-SA border (horizontal)
  { d: 'M 38,46 L 62,46', stroke: '#1A1A1A', strokeWidth: '0.4' },
  // NT-QLD border (vertical)
  { d: 'M 62,28 L 62,46', stroke: '#1A1A1A', strokeWidth: '0.4' },
  // SA-QLD border (short vertical)
  { d: 'M 62,46 L 62,50', stroke: '#1A1A1A', strokeWidth: '0.4' },
  // QLD-NSW border (east to coast)
  { d: 'M 62,50 L 86,50', stroke: '#1A1A1A', strokeWidth: '0.4' },
  // SA-NSW border (141°E down to VIC)
  { d: 'M 62,50 L 62,63', stroke: '#1A1A1A', strokeWidth: '0.4' },
  // NSW-VIC border (Murray River curve)
  { d: 'M 62,63 Q 68,65 74,67', stroke: '#1A1A1A', strokeWidth: '0.4' },
  // SA-VIC border (short segment)
  { d: 'M 62,63 L 58,66', stroke: '#1A1A1A', strokeWidth: '0.4' },
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
    <div className="relative rounded-lg p-4" style={{ backgroundColor: '#F4F1E8', border: '2px solid #1A1A1A' }}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold flex items-center gap-2" style={{ color: '#111111' }}>
          <MapPin className="w-4 h-4" />
          Electoral Map
        </h3>
        <span className="text-xs" style={{ color: '#3A3A3A' }}>
          {Object.keys(seats).length} seats
        </span>
      </div>

      {/* Capture mode indicator - ballot paper style */}
      {isCapturing && (
        <div className="mb-2 p-2 rounded flex items-center gap-2 text-sm" style={{ backgroundColor: '#EEEBE2', border: '1px solid #1A1A1A' }}>
          <Target className="w-4 h-4 animate-pulse" style={{ color: '#111111' }} />
          <span style={{ color: '#111111' }}>
            <strong>Select {pendingSeatCapture.remaining} seat(s)</strong> to capture
            ({pendingSeatCapture.ideologyAxis}: {pendingSeatCapture.ideologyBucket})
          </span>
        </div>
      )}

      {/* SVG Map - Ink on Paper treatment */}
      <svg
        viewBox="0 0 100 100"
        className="w-full h-auto"
        style={{ maxHeight: '300px' }}
      >
        {/* Background - Paper 1 */}
        <rect x="0" y="0" width="100" height="100" fill="#F4F1E8" />

        {/* Australia mainland outline - Paper 2 fill, 2px coastline */}
        <path
          d={AUSTRALIA_PATH}
          fill="#EEEBE2"
          stroke="#1A1A1A"
          strokeWidth="0.8"
        />

        {/* Tasmania - Paper 2 fill, 2px coastline */}
        <path
          d={TASMANIA_PATH}
          fill="#EEEBE2"
          stroke="#1A1A1A"
          strokeWidth="0.8"
        />

        {/* State boundaries - 1px rule, no dash for ballot paper aesthetic */}
        {STATE_BOUNDARIES.map((boundary, i) => (
          <path
            key={i}
            d={boundary.d}
            stroke={boundary.stroke}
            strokeWidth={boundary.strokeWidth || '0.4'}
            fill="none"
          />
        ))}

        {/* State labels - Secondary ink */}
        {Object.entries(STATE_LABELS).map(([state, pos]) => (
          <text
            key={state}
            x={pos.x}
            y={pos.y}
            fontSize="3"
            fill="#3A3A3A"
            textAnchor="middle"
            className="font-medium select-none pointer-events-none"
          >
            {state}
          </text>
        ))}

        {/* Seat dots - ink-on-paper style */}
        {seatData.map(seat => (
          <g key={seat.id}>
            {/* Eligible highlight ring */}
            {seat.eligible && (
              <circle
                cx={seat.x}
                cy={seat.y}
                r="2.2"
                fill="none"
                stroke="#111111"
                strokeWidth="0.3"
                className="animate-pulse"
              />
            )}

            {/* Seat dot - uses party color with ink stroke */}
            <circle
              cx={seat.x}
              cy={seat.y}
              r="1.3"
              fill={seat.color}
              stroke="#1A1A1A"
              strokeWidth="0.15"
              opacity={seat.dimmed ? 0.3 : 1}
              className={`transition-all duration-200 ${
                seat.eligible ? 'cursor-pointer' : ''
              }`}
              onClick={() => handleSeatClick(seat)}
              onMouseEnter={(e) => handleSeatHover(seat, e)}
              onMouseLeave={() => setHoveredSeat(null)}
            />
          </g>
        ))}
      </svg>

      {/* Legend - with party color stripe treatment */}
      <div className="mt-3 pt-2 flex flex-wrap gap-3" style={{ borderTop: '1px solid #1A1A1A' }}>
        {players.map(player => {
          const count = Object.values(seats).filter(
            s => s.ownerPlayerId === player.id
          ).length;
          return (
            <div
              key={player.id}
              className="flex items-center gap-1.5 text-xs"
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: player.color, border: '1px solid #1A1A1A' }}
              />
              <span style={{ color: '#111111' }}>
                {player.name}: {count}
              </span>
            </div>
          );
        })}
      </div>

      {/* Tooltip - ballot paper style */}
      {hoveredSeat && (
        <div
          className="fixed z-50 text-xs rounded px-3 py-2 pointer-events-none"
          style={{
            left: tooltipPos.x + 10,
            top: tooltipPos.y + 10,
            backgroundColor: '#F4F1E8',
            border: '1px solid #1A1A1A',
            color: '#111111',
          }}
        >
          <div className="font-semibold">{hoveredSeat.name}</div>
          <div style={{ color: '#3A3A3A' }}>
            {hoveredSeat.state} • {getPlayerName(hoveredSeat.ownerPlayerId)}
          </div>
          <div style={{ color: '#3A3A3A' }} className="mt-1">
            Econ: {hoveredSeat.ideology.econ} | Social: {hoveredSeat.ideology.social}
          </div>
          {isCapturing && hoveredSeat.eligible && (
            <div className="mt-1 font-semibold" style={{ color: '#111111' }}>Click to capture!</div>
          )}
        </div>
      )}
    </div>
  );
}

// Compact mini version for sidebar - ink-on-paper style
export function AustraliaMapMini({
  seats,
  players,
}: {
  seats: Record<SeatId, Seat>;
  players: Player[];
}) {
  const getPlayerColor = (playerId: string | null): string => {
    if (!playerId) return '#E8E5DC';  // Paper-3 for unowned
    const player = players.find(p => p.id === playerId);
    return player?.color || '#E8E5DC';
  };

  return (
    <svg viewBox="0 0 100 100" className="w-full h-auto" style={{ maxHeight: '120px' }}>
      <rect x="0" y="0" width="100" height="100" fill="#F4F1E8" />
      <path d={AUSTRALIA_PATH} fill="#EEEBE2" stroke="#1A1A1A" strokeWidth="0.6" />
      <path d={TASMANIA_PATH} fill="#EEEBE2" stroke="#1A1A1A" strokeWidth="0.6" />
      {Object.values(seats).map(seat => (
        <circle
          key={seat.id}
          cx={seat.x}
          cy={seat.y}
          r="1"
          fill={getPlayerColor(seat.ownerPlayerId)}
          stroke="#1A1A1A"
          strokeWidth="0.12"
        />
      ))}
    </svg>
  );
}
