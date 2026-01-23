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
  WA:  { x: 25, y: 48 },
  NT:  { x: 52, y: 28 },
  SA:  { x: 48, y: 58 },
  QLD: { x: 75, y: 40 },
  NSW: { x: 75, y: 60 },
  VIC: { x: 66, y: 70 },
  TAS: { x: 76, y: 88 },
  ACT: { x: 80, y: 66 },
};

// Geographically accurate Australia mainland outline
// Key features:
// - Kimberley/NW coast (jagged, inlets)
// - Gulf of Carpentaria (large northern indent)
// - Cape York Peninsula (pointing NE)
// - East coast (curves down from Cape York to Victoria)
// - Great Australian Bight (southern indentation)
// - SW corner of WA
const AUSTRALIA_PATH = `
  M 12,42
  L 12,38 L 11,34 L 10,30
  C 10,26 12,22 15,18
  L 17,16 L 20,15 L 22,16 L 21,19 L 23,17 L 26,16 L 28,18 L 27,21 L 29,19
  L 32,17 L 34,15 L 37,14
  L 40,13 L 43,14 L 45,16 L 44,18 L 46,17 L 48,15 L 50,14
  L 52,15 L 54,18 L 53,21 L 55,23
  L 54,28 L 52,32 L 50,35 L 51,38 L 54,36 L 56,33 L 58,30
  L 60,28 L 62,30 L 63,33 L 65,31 L 68,28 L 70,25
  L 73,22 L 76,20 L 79,19 L 82,20
  L 85,23 L 87,27 L 88,31
  L 89,35 L 90,40 L 90,45
  L 89,50 L 87,55 L 85,59
  L 82,63 L 79,66 L 76,68
  L 73,71 L 70,73 L 67,74
  L 64,74 L 61,73 L 59,71
  L 57,73 L 54,74 L 50,73
  L 46,72 L 42,73 L 38,75
  C 34,76 30,75 26,73
  L 22,70 L 18,66 L 15,61 L 13,55 L 12,50 L 12,46 L 12,42
  Z
`;

// Tasmania - distinctive triangular/heart shape south of Victoria
const TASMANIA_PATH = `
  M 72,84
  L 75,82 L 79,82 L 82,84
  L 83,87 L 82,91 L 79,94 L 75,95
  L 71,93 L 69,89 L 70,86 L 72,84
  Z
`;

// State boundary paths (following actual borders)
// Using proper coordinates that align with the new accurate outline
const STATE_BOUNDARIES = [
  // WA-NT border (129°E longitude - vertical line from north coast to SA border)
  { d: 'M 40,14 L 40,48', stroke: '#1A1A1A', strokeWidth: '0.4' },
  // WA-SA border (continues south from 26°S to southern coast)
  { d: 'M 40,48 L 40,73', stroke: '#1A1A1A', strokeWidth: '0.4' },
  // NT-SA border (26°S - horizontal segment from WA border to QLD border)
  { d: 'M 40,48 L 60,48', stroke: '#1A1A1A', strokeWidth: '0.4' },
  // NT-QLD border (138°E - vertical from Gulf of Carpentaria down to SA border)
  { d: 'M 60,30 L 60,48', stroke: '#1A1A1A', strokeWidth: '0.4' },
  // SA-QLD border (short vertical segment)
  { d: 'M 60,48 L 60,52', stroke: '#1A1A1A', strokeWidth: '0.4' },
  // QLD-NSW border (approximately 29°S - runs east to coast)
  { d: 'M 60,52 L 86,52', stroke: '#1A1A1A', strokeWidth: '0.4' },
  // SA-NSW border (141°E from QLD corner down to VIC)
  { d: 'M 60,52 L 60,66', stroke: '#1A1A1A', strokeWidth: '0.4' },
  // NSW-VIC border (Murray River - follows a curve east to coast)
  { d: 'M 60,66 Q 66,68 70,73', stroke: '#1A1A1A', strokeWidth: '0.4' },
  // SA-VIC border (141°E short segment to coast)
  { d: 'M 60,66 L 56,73', stroke: '#1A1A1A', strokeWidth: '0.4' },
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
