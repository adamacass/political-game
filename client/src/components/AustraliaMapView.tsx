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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_STATES: StateCode[] = ['WA', 'NT', 'SA', 'QLD', 'NSW', 'VIC', 'TAS', 'ACT'];

// Simplified but recognizable SVG paths for Australian states.
// Coordinates are designed for viewBox="0 0 1000 800".
// State borders share vertices so paths tile without gaps.
//
// Key shared border coordinates:
//   WA/NT+SA western border:   x = 401
//   NT/SA horizontal border:   y = 380  (26 deg S)
//   NT/QLD border:             x = 598  (138 deg E)
//   SA/QLD+NSW eastern border: x = 665  (141 deg E)
//   QLD/NSW border:            y = 448  (29 deg S)
//   NSW/VIC+SA tripoint:       (665, 610)
//   NSW/VIC coastal point:     (845, 595)

const STATE_PATHS: Record<StateCode, string> = {
  WA: [
    'M 155 148', 'L 190 135', 'L 240 128', 'L 300 132', 'L 355 142', 'L 401 148',
    'L 401 380', 'L 401 500',
    'L 350 530', 'L 300 545', 'L 250 555', 'L 200 555', 'L 160 545',
    'L 135 528', 'L 118 505', 'L 108 480',
    'L 95 448', 'L 82 410', 'L 72 375', 'L 70 342',
    'L 75 308', 'L 85 275', 'L 100 248', 'L 118 222',
    'L 138 195', 'L 150 170', 'Z',
  ].join(' '),

  NT: [
    'M 401 148', 'L 428 110', 'L 462 88', 'L 505 78', 'L 545 85',
    'L 568 108', 'L 555 142', 'L 545 172', 'L 558 198', 'L 598 218',
    'L 598 380', 'L 401 380', 'Z',
  ].join(' '),

  SA: [
    'M 401 380', 'L 598 380', 'L 665 380',
    'L 665 448', 'L 665 610',
    'L 642 598', 'L 615 582', 'L 585 568',
    'L 548 558', 'L 510 550', 'L 470 542', 'L 435 535', 'L 401 500', 'Z',
  ].join(' '),

  QLD: [
    'M 598 218', 'L 625 180', 'L 650 140', 'L 672 105', 'L 695 65',
    'L 718 108', 'L 742 168', 'L 768 228',
    'L 798 292', 'L 828 348', 'L 862 395', 'L 898 428', 'L 920 448',
    'L 665 448', 'L 665 380', 'L 598 380', 'Z',
  ].join(' '),

  NSW: [
    'M 665 448', 'L 920 448',
    'L 908 478', 'L 892 512', 'L 875 545', 'L 858 572', 'L 845 595',
    'L 800 604', 'L 752 610', 'L 710 612', 'L 665 610', 'Z',
  ].join(' '),

  VIC: [
    'M 665 610', 'L 710 612', 'L 752 610', 'L 800 604', 'L 845 595',
    'L 838 618', 'L 822 635', 'L 800 648',
    'L 772 655', 'L 742 656', 'L 712 650',
    'L 685 640', 'L 668 628', 'L 665 618', 'Z',
  ].join(' '),

  TAS: [
    'M 748 692', 'L 772 682', 'L 800 688', 'L 812 708',
    'L 805 732', 'L 785 745', 'L 760 748',
    'L 740 738', 'L 732 718', 'Z',
  ].join(' '),

  ACT: [
    'M 810 545', 'L 822 540', 'L 830 548',
    'L 825 560', 'L 812 558', 'Z',
  ].join(' '),
};

// Label positions and font sizes per state
const STATE_LABELS: Record<StateCode, { x: number; y: number; fontSize: number }> = {
  WA:  { x: 240, y: 342, fontSize: 18 },
  NT:  { x: 500, y: 262, fontSize: 14 },
  SA:  { x: 540, y: 465, fontSize: 14 },
  QLD: { x: 770, y: 292, fontSize: 16 },
  NSW: { x: 790, y: 525, fontSize: 13 },
  VIC: { x: 752, y: 638, fontSize: 11 },
  TAS: { x: 772, y: 722, fontSize: 10 },
  ACT: { x: 850, y: 558, fontSize: 8 },
};

// Rectangular regions within each state where seat dots are placed in a grid
const STATE_SEAT_REGIONS: Record<StateCode, { cx: number; cy: number; width: number; height: number }> = {
  WA:  { cx: 245, cy: 370, width: 175, height: 215 },
  NT:  { cx: 500, cy: 285, width: 100, height: 75 },
  SA:  { cx: 540, cy: 480, width: 135, height: 72 },
  QLD: { cx: 762, cy: 325, width: 115, height: 165 },
  NSW: { cx: 785, cy: 535, width: 125, height: 65 },
  VIC: { cx: 752, cy: 632, width: 120, height: 28 },
  TAS: { cx: 772, cy: 718, width: 42, height: 32 },
  ACT: { cx: 820, cy: 550, width: 10, height: 8 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Distribute `count` items in a grid that fits within `region`. */
function computeSeatPositions(
  count: number,
  region: { cx: number; cy: number; width: number; height: number },
): { x: number; y: number }[] {
  if (count === 0) return [];
  if (count === 1) return [{ x: region.cx, y: region.cy }];
  if (count === 2) {
    return [
      { x: region.cx - region.width * 0.15, y: region.cy },
      { x: region.cx + region.width * 0.15, y: region.cy },
    ];
  }

  const aspect = region.width / Math.max(region.height, 1);
  let cols = Math.max(1, Math.round(Math.sqrt(count * aspect)));
  let rows = Math.max(1, Math.ceil(count / cols));

  // Ensure enough cells
  while (cols * rows < count) {
    if (cols / rows < aspect) cols++;
    else rows++;
  }

  const gapX = region.width / (cols + 1);
  const gapY = region.height / (rows + 1);
  const originX = region.cx - region.width / 2;
  const originY = region.cy - region.height / 2;

  const positions: { x: number; y: number }[] = [];
  for (let r = 0; r < rows && positions.length < count; r++) {
    const seatsInRow = Math.min(cols, count - positions.length);
    // Centre incomplete last row
    const rowOffset = (cols - seatsInRow) * gapX / 2;
    for (let c = 0; c < seatsInRow; c++) {
      positions.push({
        x: originX + gapX * (c + 1) + rowOffset,
        y: originY + gapY * (r + 1),
      });
    }
  }

  return positions;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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

  // ----- derived data -----

  const seats = useMemo(() => Object.values(gameState.seats), [gameState.seats]);

  const playerMap = useMemo(() => {
    const map: Record<string, Player> = {};
    gameState.players.forEach(p => { map[p.id] = p; });
    return map;
  }, [gameState.players]);

  // Group seats by state
  const seatsByState = useMemo(() => {
    const grouped: Record<StateCode, Seat[]> = {
      NSW: [], VIC: [], QLD: [], WA: [], SA: [], TAS: [], ACT: [], NT: [],
    };
    seats.forEach(seat => {
      if (grouped[seat.state]) grouped[seat.state].push(seat);
    });
    return grouped;
  }, [seats]);

  // Pre-compute map position for every seat based on its state region
  const seatPositions = useMemo(() => {
    const posMap: Record<SeatId, { x: number; y: number }> = {};
    ALL_STATES.forEach(state => {
      const stateSeats = seatsByState[state];
      const region = STATE_SEAT_REGIONS[state];
      const positions = computeSeatPositions(stateSeats.length, region);
      stateSeats.forEach((seat, idx) => {
        if (positions[idx]) posMap[seat.id] = positions[idx];
      });
    });
    return posMap;
  }, [seatsByState]);

  // State control: colour of the player who controls each state
  const stateControlInfo = useMemo(() => {
    const info: Partial<Record<StateCode, { color: string; playerId: string }>> = {};
    ALL_STATES.forEach(state => {
      const si = gameState.stateInfo?.[state];
      if (!si) return;
      // Find player with majority of seats in this state
      let maxSeats = 0;
      let controllerId: string | null = null;
      for (const [pid, count] of Object.entries(si.ownedBy)) {
        if (count > maxSeats) {
          maxSeats = count;
          controllerId = pid;
        }
      }
      if (controllerId && maxSeats > si.seatCount / 2) {
        const controller = playerMap[controllerId];
        if (controller) {
          info[state] = { color: controller.color, playerId: controller.id };
        }
      }
    });
    return info;
  }, [gameState.stateInfo, playerMap]);

  // Seat counts per player for the legend
  const seatCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    seats.forEach(s => {
      if (s.ownerPlayerId) {
        counts[s.ownerPlayerId] = (counts[s.ownerPlayerId] || 0) + 1;
      }
    });
    return counts;
  }, [seats]);

  // ----- seat helpers -----

  const getSeatColor = useCallback((seat: Seat): string => {
    if (!seat.ownerPlayerId) return '#3a3a3a';
    const owner = playerMap[seat.ownerPlayerId];
    return owner?.color || '#3a3a3a';
  }, [playerMap]);

  const getSeatRadius = useCallback((seat: Seat): number => {
    const base = 3;
    if (selectedSeatId === seat.id) return base + 1.5;
    if (targetableSeatIds.includes(seat.id)) return base + 0.8;
    return base;
  }, [selectedSeatId, targetableSeatIds]);

  const getSeatClass = useCallback((seat: Seat): string => {
    const classes = ['seat-dot'];
    if (seat.margin < 20) classes.push('contested');
    if (selectedSeatId === seat.id) classes.push('selected');
    if (targetableSeatIds.includes(seat.id)) classes.push('targetable');
    return classes.join(' ');
  }, [selectedSeatId, targetableSeatIds]);

  // ----- event handlers -----

  const handleSeatMouseEnter = useCallback((seat: Seat, e: React.MouseEvent) => {
    setHoveredSeat(seat);
    const svgEl = (e.target as SVGElement).closest('svg');
    if (svgEl) {
      const rect = svgEl.getBoundingClientRect();
      const pos = seatPositions[seat.id];
      if (pos) {
        const scaleX = rect.width / 1000;
        const scaleY = rect.height / 800;
        setTooltipPos({
          x: rect.left + pos.x * scaleX,
          y: rect.top + pos.y * scaleY - 10,
        });
      }
    }
    onSeatHover?.(seat.id);
  }, [onSeatHover, seatPositions]);

  const handleSeatMouseLeave = useCallback(() => {
    setHoveredSeat(null);
    onSeatHover?.(null);
  }, [onSeatHover]);

  // ----- render -----

  return (
    <div className="relative w-full chamber-bg" style={{ aspectRatio: '10/8' }}>
      <svg
        viewBox="0 0 1000 800"
        className="w-full h-full"
        style={{ display: 'block' }}
      >
        {/* ============================================================ */}
        {/* Defs: gradients, filters, patterns                           */}
        {/* ============================================================ */}
        <defs>
          <radialGradient id="mapOcean" cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor="#1a3c28" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0c1a12" stopOpacity="0" />
          </radialGradient>

          <pattern
            id="oceanWaves"
            x="0" y="0" width="24" height="24"
            patternUnits="userSpaceOnUse"
          >
            <line
              x1="0" y1="12" x2="24" y2="12"
              stroke="rgba(42,69,53,0.12)" strokeWidth="0.5"
            />
          </pattern>

          <linearGradient id="brassFrame" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8a6508" />
            <stop offset="50%" stopColor="#d4a634" />
            <stop offset="100%" stopColor="#8a6508" />
          </linearGradient>

          {/* One glow filter per player for state-control highlights */}
          {gameState.players.map(p => (
            <filter
              key={`glow-${p.id}`}
              id={`state-glow-${p.id}`}
              x="-15%" y="-15%" width="130%" height="130%"
            >
              <feDropShadow
                dx="0" dy="0" stdDeviation="5"
                floodColor={p.color} floodOpacity="0.55"
              />
            </filter>
          ))}
        </defs>

        {/* ============================================================ */}
        {/* Ocean background                                             */}
        {/* ============================================================ */}
        <rect x="0" y="0" width="1000" height="800" fill="url(#mapOcean)" />
        <rect x="0" y="0" width="1000" height="800" fill="url(#oceanWaves)" />

        {/* Decorative brass border frame */}
        <rect
          x="12" y="12" width="976" height="776" rx="2"
          fill="none" stroke="url(#brassFrame)" strokeWidth="1" opacity="0.25"
        />

        {/* ============================================================ */}
        {/* Title cartouche                                              */}
        {/* ============================================================ */}
        <text
          x="500" y="38" textAnchor="middle"
          fill="rgba(184,134,11,0.5)" fontSize="13"
          fontFamily="'Playfair Display', serif" fontWeight="700"
          letterSpacing="0.15em"
        >
          COMMONWEALTH OF AUSTRALIA
        </text>
        <line
          x1="340" y1="48" x2="660" y2="48"
          stroke="rgba(184,134,11,0.18)" strokeWidth="0.5"
        />

        {/* ============================================================ */}
        {/* Decorative ocean labels                                      */}
        {/* ============================================================ */}
        <text
          x="40" y="420"
          fill="rgba(42,69,53,0.35)" fontSize="10"
          fontFamily="'IBM Plex Mono', monospace" letterSpacing="0.2em"
          transform="rotate(-90, 40, 420)"
        >
          INDIAN OCEAN
        </text>
        <text
          x="960" y="320"
          fill="rgba(42,69,53,0.35)" fontSize="10"
          fontFamily="'IBM Plex Mono', monospace" letterSpacing="0.2em"
          transform="rotate(90, 960, 320)"
        >
          PACIFIC OCEAN
        </text>
        <text
          x="500" y="785" textAnchor="middle"
          fill="rgba(42,69,53,0.3)" fontSize="9"
          fontFamily="'IBM Plex Mono', monospace" letterSpacing="0.2em"
        >
          SOUTHERN OCEAN
        </text>
        <text
          x="785" y="108"
          fill="rgba(42,69,53,0.28)" fontSize="8"
          fontFamily="'IBM Plex Mono', monospace" letterSpacing="0.15em"
        >
          CORAL SEA
        </text>
        <text
          x="885" y="668"
          fill="rgba(42,69,53,0.28)" fontSize="8"
          fontFamily="'IBM Plex Mono', monospace" letterSpacing="0.15em"
        >
          TASMAN SEA
        </text>

        {/* ============================================================ */}
        {/* State fills with optional control glow                       */}
        {/* ============================================================ */}
        {ALL_STATES.map(state => {
          const ctrl = stateControlInfo[state];
          return (
            <path
              key={`state-${state}`}
              d={STATE_PATHS[state]}
              fill="rgba(26, 60, 40, 0.35)"
              stroke={ctrl ? ctrl.color : 'rgba(42,69,53,0.6)'}
              strokeWidth={ctrl ? 2.5 : 1}
              strokeLinejoin="round"
              filter={ctrl ? `url(#state-glow-${ctrl.playerId})` : undefined}
              style={{ transition: 'stroke 0.3s ease, filter 0.3s ease' }}
            />
          );
        })}

        {/* ============================================================ */}
        {/* Internal state border lines (dashed, subtle)                 */}
        {/* ============================================================ */}
        <g stroke="rgba(42,69,53,0.45)" strokeWidth="0.8" strokeDasharray="4 3">
          {/* WA / NT+SA western border */}
          <line x1="401" y1="148" x2="401" y2="500" />
          {/* NT / SA horizontal border (26 deg S) */}
          <line x1="401" y1="380" x2="665" y2="380" />
          {/* NT / QLD border (138 deg E) */}
          <line x1="598" y1="218" x2="598" y2="380" />
          {/* SA / QLD+NSW eastern border (141 deg E) */}
          <line x1="665" y1="380" x2="665" y2="610" />
          {/* QLD / NSW border (29 deg S) */}
          <line x1="665" y1="448" x2="920" y2="448" />
        </g>

        {/* ============================================================ */}
        {/* State abbreviation labels                                    */}
        {/* ============================================================ */}
        {ALL_STATES.map(state => {
          const lbl = STATE_LABELS[state];
          const ctrl = stateControlInfo[state];
          return (
            <text
              key={`lbl-${state}`}
              x={lbl.x} y={lbl.y}
              textAnchor="middle"
              fill={ctrl ? ctrl.color : 'rgba(184,134,11,0.3)'}
              fontSize={lbl.fontSize}
              fontFamily="'IBM Plex Mono', monospace"
              fontWeight="600"
              letterSpacing="0.15em"
              style={{
                transition: 'fill 0.3s ease',
                pointerEvents: 'none',
                opacity: ctrl ? 0.65 : 0.4,
              }}
            >
              {state}
            </text>
          );
        })}

        {/* ACT leader line (territory is tiny, label is offset) */}
        <line
          x1="830" y1="550" x2="844" y2="555"
          stroke="rgba(184,134,11,0.25)" strokeWidth="0.5"
        />

        {/* ============================================================ */}
        {/* Per-state seat tally (owned / total)                         */}
        {/* ============================================================ */}
        {ALL_STATES.map(state => {
          const stateSeats = seatsByState[state];
          if (stateSeats.length === 0) return null;
          const lbl = STATE_LABELS[state];
          const owned = stateSeats.filter(s => s.ownerPlayerId !== null).length;
          return (
            <text
              key={`tally-${state}`}
              x={lbl.x}
              y={lbl.y + lbl.fontSize + 4}
              textAnchor="middle"
              fill="rgba(160,112,64,0.45)"
              fontSize="8"
              fontFamily="'IBM Plex Mono', monospace"
              style={{ pointerEvents: 'none' }}
            >
              {owned}/{stateSeats.length}
            </text>
          );
        })}

        {/* ============================================================ */}
        {/* Seat dots                                                    */}
        {/* ============================================================ */}
        {seats.map(seat => {
          const pos = seatPositions[seat.id];
          if (!pos) return null;
          return (
            <circle
              key={seat.id}
              cx={pos.x}
              cy={pos.y}
              r={getSeatRadius(seat)}
              fill={getSeatColor(seat)}
              stroke={
                seat.ownerPlayerId === playerId
                  ? 'rgba(255,255,255,0.5)'
                  : 'rgba(0,0,0,0.4)'
              }
              className={getSeatClass(seat)}
              onClick={() => onSeatClick(seat.id)}
              onMouseEnter={e => handleSeatMouseEnter(seat, e)}
              onMouseLeave={handleSeatMouseLeave}
              style={{
                opacity: seat.margin < 20 ? 0.7 : 1,
                filter: undefined,
              }}
            />
          );
        })}

        {/* ============================================================ */}
        {/* Compass rose (decorative)                                    */}
        {/* ============================================================ */}
        <g transform="translate(60, 720)" opacity="0.3">
          <circle
            cx="0" cy="0" r="16"
            fill="none" stroke="rgba(184,134,11,0.5)" strokeWidth="0.5"
          />
          <line
            x1="0" y1="-14" x2="0" y2="14"
            stroke="rgba(184,134,11,0.6)" strokeWidth="0.5"
          />
          <line
            x1="-14" y1="0" x2="14" y2="0"
            stroke="rgba(184,134,11,0.6)" strokeWidth="0.5"
          />
          <polygon points="0,-13 -3,-4 3,-4" fill="rgba(184,134,11,0.7)" />
          <text
            x="0" y="-19" textAnchor="middle"
            fill="rgba(184,134,11,0.7)" fontSize="7"
            fontFamily="'IBM Plex Mono', monospace" fontWeight="600"
          >
            N
          </text>
        </g>

        {/* ============================================================ */}
        {/* Round indicator                                              */}
        {/* ============================================================ */}
        <text
          x="20" y="30"
          fill="rgba(184,134,11,0.6)" fontSize="10"
          fontFamily="'IBM Plex Mono', monospace"
        >
          ROUND {gameState.round}/{gameState.totalRounds}
        </text>
      </svg>

      {/* ================================================================ */}
      {/* Seat tooltip (rendered outside SVG for crisp text rendering)     */}
      {/* ================================================================ */}
      {hoveredSeat && (
        <div
          className="tooltip-content fixed"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div
            className="font-display font-bold text-sm"
            style={{ color: getSeatColor(hoveredSeat) }}
          >
            {hoveredSeat.name}
          </div>
          <div className="font-mono text-xs mt-1" style={{ color: '#a09880' }}>
            {hoveredSeat.state} &middot;{' '}
            {hoveredSeat.demographics.slice(0, 3).map(d => d.groupId.replace(/_/g, ' ')).join(', ')}
          </div>
          <div className="font-mono text-xs mt-1">
            Margin: {hoveredSeat.margin}%
            {hoveredSeat.margin < 20 && (
              <span style={{ color: '#e65100' }}> MARGINAL</span>
            )}
          </div>
          {hoveredSeat.ownerPlayerId && (
            <div className="font-mono text-xs mt-1">
              Held by: {playerMap[hoveredSeat.ownerPlayerId]?.name || 'Unknown'}
            </div>
          )}
          {hoveredSeat.margin < 20 && (
            <div className="font-mono text-xs mt-1" style={{ color: '#daa520' }}>
              MARGINAL
            </div>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* Seat count legend (bottom-left overlay)                          */}
      {/* ================================================================ */}
      <div className="absolute bottom-2 left-2 flex flex-col gap-1">
        {gameState.players.map(p => (
          <div
            key={p.id}
            className="flex items-center gap-2 font-mono text-xs"
            style={{ opacity: 0.8 }}
          >
            <div
              className="w-3 h-3 rounded-sm"
              style={{
                backgroundColor: p.color,
                border:
                  p.id === playerId
                    ? '1px solid rgba(255,255,255,0.6)'
                    : '1px solid rgba(0,0,0,0.3)',
              }}
            />
            <span
              style={{
                color: p.id === playerId ? '#f0e8d4' : '#a09880',
              }}
            >
              {seatCounts[p.id] || 0}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AustraliaMapView;
