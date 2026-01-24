/**
 * AustraliaMap Component
 *
 * Renders a GeoJSON-derived map of Australia with electoral seats displayed as dots.
 * Uses an SVG outline with interactive seat overlay.
 * Supports seat capture interaction when in seat_capture phase.
 */

import React, { useMemo, useState, useCallback, useEffect } from 'react';
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

const GEOJSON_URL = 'https://limewire.com/d/kDM8m#HQpXbOa0mB';

// Extended seat data for rendering
interface SeatRenderData extends Seat {
  color: string;
  eligible: boolean;
  dimmed: boolean;
}

type GeoJSONGeometry = {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][] | number[][][][];
};

type GeoJSONFeature = {
  type: 'Feature';
  geometry: GeoJSONGeometry;
  properties?: Record<string, unknown>;
};

type GeoJSONFeatureCollection = {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
};

const mapBoundsFromGeometry = (geometry: GeoJSONGeometry) => {
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const updateBounds = (coord: number[]) => {
    const [x, y] = coord;
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.maxY = Math.max(bounds.maxY, y);
  };

  if (geometry.type === 'Polygon') {
    geometry.coordinates.forEach(ring => ring.forEach(updateBounds));
  } else {
    geometry.coordinates.forEach(poly => poly.forEach(ring => ring.forEach(updateBounds)));
  }

  return bounds;
};

const geometryToPath = (geometry: GeoJSONGeometry, bounds: ReturnType<typeof mapBoundsFromGeometry>, padding = 4) => {
  const scaleX = (100 - padding * 2) / (bounds.maxX - bounds.minX);
  const scaleY = (100 - padding * 2) / (bounds.maxY - bounds.minY);
  const scale = Math.min(scaleX, scaleY);
  const offsetX = padding - bounds.minX * scale + (100 - padding * 2 - (bounds.maxX - bounds.minX) * scale) / 2;
  const offsetY = padding - bounds.minY * scale + (100 - padding * 2 - (bounds.maxY - bounds.minY) * scale) / 2;

  const project = (coord: number[]) => {
    const [x, y] = coord;
    const px = x * scale + offsetX;
    const py = 100 - (y * scale + offsetY);
    return { x: px, y: py };
  };

  const buildPath = (ring: number[][]) => {
    if (ring.length === 0) return '';
    const start = project(ring[0]);
    const segments = ring.slice(1).map(coord => {
      const point = project(coord);
      return `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    });
    return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} ${segments.join(' ')} Z`;
  };

  if (geometry.type === 'Polygon') {
    return geometry.coordinates.map(buildPath).join(' ');
  }

  return geometry.coordinates
    .map(poly => poly.map(buildPath).join(' '))
    .join(' ');
};

const useAustraliaGeoPaths = () => {
  const [geoPaths, setGeoPaths] = useState<string[]>([]);
  const [geoFetchError, setGeoFetchError] = useState(false);

  useEffect(() => {
    let isActive = true;
    const loadGeoJson = async () => {
      try {
        const response = await fetch(GEOJSON_URL);
        if (!response.ok) {
          throw new Error(`Failed to fetch GeoJSON: ${response.status}`);
        }
        const data = (await response.json()) as GeoJSONFeatureCollection;
        if (!isActive) return;
        const paths = data.features
          .map(feature => {
            const bounds = mapBoundsFromGeometry(feature.geometry);
            return geometryToPath(feature.geometry, bounds);
          })
          .filter(Boolean);
        setGeoPaths(paths);
        setGeoFetchError(false);
      } catch (error) {
        console.warn('[AustraliaMap] GeoJSON fetch failed.', error);
        if (isActive) {
          setGeoFetchError(true);
        }
      }
    };
    loadGeoJson();
    return () => {
      isActive = false;
    };
  }, []);

  return { geoPaths, geoFetchError };
};

export function AustraliaMap({
  seats,
  players,
  pendingSeatCapture,
  currentPlayerId,
  onCaptureSeat,
}: AustraliaMapProps) {
  const [hoveredSeat, setHoveredSeat] = useState<SeatRenderData | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const { geoPaths, geoFetchError } = useAustraliaGeoPaths();

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
  const seatData = useMemo((): SeatRenderData[] => {
    return Object.values(seats).map(seat => ({
      ...seat,
      color: getPlayerColor(seat.ownerPlayerId),
      eligible: isEligible(seat.id),
      dimmed: Boolean(isCapturing && !isEligible(seat.id)),
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
    <div className="relative rounded-lg p-4 paper-texture" style={{ backgroundColor: colors.paper1, border: `2px solid ${colors.rule}` }}>
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
        <div className="mb-2 p-2 rounded-lg flex items-center gap-2 text-sm" style={{ backgroundColor: colors.paper2, border: `1px solid ${colors.rule}` }}>
          <Target className="w-4 h-4 animate-pulse" style={{ color: colors.ink }} />
          <span style={{ color: colors.ink }}>
            <strong>Select {pendingSeatCapture.remaining} seat(s)</strong> to capture
            ({pendingSeatCapture.ideologyAxis}: {pendingSeatCapture.ideologyBucket})
          </span>
        </div>
      )}

      {/* Map container with GeoJSON outline and seat overlay */}
      <div className="relative" style={{ maxHeight: '320px' }}>
        <svg viewBox="0 0 100 100" className="w-full h-auto" style={{ maxHeight: '320px' }}>
          <rect x="0" y="0" width="100" height="100" fill={colors.paper1} />
          {geoPaths.map((path, index) => (
            <path
              key={index}
              d={path}
              fill={colors.paper2}
              stroke={colors.rule}
              strokeWidth="0.8"
            />
          ))}
          {geoPaths.length === 0 && (
            <text
              x="50"
              y="50"
              textAnchor="middle"
              fontSize="4"
              fill={colors.inkSecondary}
            >
              Loading map…
            </text>
          )}

          {/* Seat dots */}
          {seatData.map(seat => (
            <g key={seat.id}>
              {seat.eligible && (
                <circle
                  cx={seat.x}
                  cy={seat.y}
                  r="2.2"
                  fill="none"
                  stroke={colors.ink}
                  strokeWidth="0.35"
                  className="animate-pulse"
                />
              )}
              <circle
                cx={seat.x}
                cy={seat.y}
                r="1.4"
                fill={seat.color}
                stroke={colors.rule}
                strokeWidth="0.2"
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

      {geoFetchError && (
        <div className="mt-2 text-[10px]" style={{ color: colors.inkSecondary }}>
          GeoJSON map failed to load. Confirm the shared file is accessible from the client.
        </div>
      )}

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
          className="fixed z-50 text-xs rounded-lg px-3 py-2 pointer-events-none"
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
  const { geoPaths } = useAustraliaGeoPaths();
  const getPlayerColor = (playerId: string | null): string => {
    if (!playerId) return colors.paper3;
    const player = players.find(p => p.id === playerId);
    return player?.color || colors.paper3;
  };

  return (
    <svg viewBox="0 0 100 100" className="w-full h-auto" style={{ maxHeight: '120px' }}>
      <rect x="0" y="0" width="100" height="100" fill={colors.paper1} />
      {geoPaths.map((path, index) => (
        <path
          key={index}
          d={path}
          fill={colors.paper2}
          stroke={colors.rule}
          strokeWidth="0.6"
        />
      ))}
      {Object.values(seats).map(seat => (
        <circle
          key={seat.id}
          cx={seat.x}
          cy={seat.y}
          r="1"
          fill={getPlayerColor(seat.ownerPlayerId)}
          stroke={colors.rule}
          strokeWidth="0.15"
        />
      ))}
    </svg>
  );
}
