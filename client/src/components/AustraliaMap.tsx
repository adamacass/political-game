/**
 * AustraliaMap Component
 *
 * Renders a static map image of Australia with electoral seats displayed as dots.
 * Uses a pre-rendered SVG background with interactive seat overlay.
 * Supports seat capture interaction when in seat_capture phase.
 */

import React, { useMemo, useState, useCallback } from 'react';
import { Seat, SeatId, Player, PendingSeatCapture, StateCode } from '../types';
import { MapPin, Target } from 'lucide-react';

// Design tokens
const colors = {
  paper1: '#F4F1E8',
  paper2: '#EEEBE2',
  paper3: '#E8E5DC',
  ink: '#111111',
  inkSecondary: '#3A3A3A',
  rule: '#1A1A1A',
};

interface AustraliaMapProps {
  seats: Record<SeatId, Seat>;
  players: Player[];
  pendingSeatCapture: PendingSeatCapture | null;
  currentPlayerId: string;
  onCaptureSeat?: (seatId: SeatId) => void;
}

// Map dimensions matching the static SVG asset (viewBox 0 0 200 180)
const MAP_WIDTH = 200;
const MAP_HEIGHT = 180;

// Extended seat data for rendering
interface SeatRenderData extends Seat {
  color: string;
  eligible: boolean;
  dimmed: boolean;
  // Scaled coordinates for the 200x180 viewBox
  scaledX: number;
  scaledY: number;
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
    if (!playerId) return colors.paper3; // Paper-3 for unowned
    const player = players.find(p => p.id === playerId);
    return player?.color || colors.paper3;
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
  // Scale from 0-100 coordinate system to 0-200/0-180
  const seatData = useMemo((): SeatRenderData[] => {
    return Object.values(seats).map(seat => ({
      ...seat,
      color: getPlayerColor(seat.ownerPlayerId),
      eligible: isEligible(seat.id),
      dimmed: Boolean(isCapturing && !isEligible(seat.id)),
      // Scale x: 0-100 -> 0-200, y: 0-100 -> 0-180
      scaledX: seat.x * 2,
      scaledY: seat.y * 1.8,
    }));
  }, [seats, getPlayerColor, isEligible, isCapturing]);

  const handleSeatClick = (seat: SeatRenderData) => {
    if (isCapturing && seat.eligible && onCaptureSeat) {
      onCaptureSeat(seat.id);
    }
  };

  const handleSeatHover = (seat: SeatRenderData, event: React.MouseEvent) => {
    setHoveredSeat(seat);
    setTooltipPos({ x: event.clientX, y: event.clientY });
  };

  return (
    <div className="relative rounded-lg p-4" style={{ backgroundColor: colors.paper1, border: `2px solid ${colors.rule}` }}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold flex items-center gap-2" style={{ color: colors.ink }}>
          <MapPin className="w-4 h-4" />
          Electoral Map
        </h3>
        <span className="text-xs" style={{ color: colors.inkSecondary }}>
          {Object.keys(seats).length} seats
        </span>
      </div>

      {/* Capture mode indicator */}
      {isCapturing && (
        <div className="mb-2 p-2 rounded flex items-center gap-2 text-sm" style={{ backgroundColor: colors.paper2, border: `1px solid ${colors.rule}` }}>
          <Target className="w-4 h-4 animate-pulse" style={{ color: colors.ink }} />
          <span style={{ color: colors.ink }}>
            <strong>Select {pendingSeatCapture.remaining} seat(s)</strong> to capture
            ({pendingSeatCapture.ideologyAxis}: {pendingSeatCapture.ideologyBucket})
          </span>
        </div>
      )}

      {/* Map container with static background and seat overlay */}
      <div className="relative" style={{ maxHeight: '320px' }}>
        {/* Static Australia map as background image */}
        <img
          src="/assets/australia-map.svg"
          alt="Australia Electoral Map"
          className="w-full h-auto"
          style={{ maxHeight: '320px' }}
          draggable={false}
        />

        {/* SVG overlay for interactive seats */}
        <svg
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: 'none' }}
        >
          {/* Seat dots */}
          {seatData.map(seat => (
            <g key={seat.id} style={{ pointerEvents: 'auto' }}>
              {/* Eligible highlight ring */}
              {seat.eligible && (
                <circle
                  cx={seat.scaledX}
                  cy={seat.scaledY}
                  r="5"
                  fill="none"
                  stroke={colors.ink}
                  strokeWidth="0.8"
                  className="animate-pulse"
                />
              )}

              {/* Seat dot */}
              <circle
                cx={seat.scaledX}
                cy={seat.scaledY}
                r="3"
                fill={seat.color}
                stroke={colors.rule}
                strokeWidth="0.4"
                opacity={seat.dimmed ? 0.3 : 1}
                className={`transition-all duration-200 ${seat.eligible ? 'cursor-pointer' : ''}`}
                onClick={() => handleSeatClick(seat)}
                onMouseEnter={(e) => handleSeatHover(seat, e)}
                onMouseLeave={() => setHoveredSeat(null)}
              />
            </g>
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 pt-2 flex flex-wrap gap-3" style={{ borderTop: `1px solid ${colors.rule}` }}>
        {players.map(player => {
          const count = Object.values(seats).filter(s => s.ownerPlayerId === player.id).length;
          return (
            <div key={player.id} className="flex items-center gap-1.5 text-xs">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: player.color, border: `1px solid ${colors.rule}` }}
              />
              <span style={{ color: colors.ink }}>
                {player.name}: {count}
              </span>
            </div>
          );
        })}
      </div>

      {/* Tooltip */}
      {hoveredSeat && (
        <div
          className="fixed z-50 text-xs rounded px-3 py-2 pointer-events-none"
          style={{
            left: tooltipPos.x + 10,
            top: tooltipPos.y + 10,
            backgroundColor: colors.paper1,
            border: `1px solid ${colors.rule}`,
            color: colors.ink,
          }}
        >
          <div className="font-semibold">{hoveredSeat.name}</div>
          <div style={{ color: colors.inkSecondary }}>
            {hoveredSeat.state} &bull; {getPlayerName(hoveredSeat.ownerPlayerId)}
          </div>
          <div style={{ color: colors.inkSecondary }} className="mt-1">
            Econ: {hoveredSeat.ideology.econ} | Social: {hoveredSeat.ideology.social}
          </div>
          {isCapturing && hoveredSeat.eligible && (
            <div className="mt-1 font-semibold" style={{ color: colors.ink }}>Click to capture!</div>
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
    if (!playerId) return colors.paper3;
    const player = players.find(p => p.id === playerId);
    return player?.color || colors.paper3;
  };

  return (
    <div className="relative" style={{ maxHeight: '120px' }}>
      {/* Static background */}
      <img
        src="/assets/australia-map.svg"
        alt="Australia"
        className="w-full h-auto"
        style={{ maxHeight: '120px' }}
        draggable={false}
      />

      {/* Seat overlay */}
      <svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        className="absolute inset-0 w-full h-full"
      >
        {Object.values(seats).map(seat => (
          <circle
            key={seat.id}
            cx={seat.x * 2}
            cy={seat.y * 1.8}
            r="2"
            fill={getPlayerColor(seat.ownerPlayerId)}
            stroke={colors.rule}
            strokeWidth="0.3"
          />
        ))}
      </svg>
    </div>
  );
}
