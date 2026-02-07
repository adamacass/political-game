import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Seat, Player, SeatId, GameState } from '../types';

interface ChamberProps {
  gameState: GameState;
  playerId: string;
  selectedSeatId: SeatId | null;
  targetableSeatIds?: SeatId[];
  onSeatClick: (seatId: SeatId) => void;
  onSeatHover?: (seatId: SeatId | null) => void;
}

/* ============================================================
   STRAIGHT-ROW PARLIAMENTARY CHAMBER

   Australian-style layout with two rectangular blocks of bench
   seats facing each other across a central aisle:

     - LEFT BLOCK  (Opposition):  5 cols x 12 rows = 60 seats
     - RIGHT BLOCK (Government):  5 cols x 12 rows = 60 seats
     - CROSSBENCH  (Centre rear): 3 straight rows  = 31 seats

   Speaker's chair at top centre; dispatch table with mace in
   the middle of the aisle.

   ViewBox: 0 0 900 700
   ============================================================ */

// ── Layout constants ──────────────────────────────────────────

const VB_W = 900;
const VB_H = 700;

// Side blocks (opposition / government)
const BLOCK_COLS = 5;
const BLOCK_ROWS = 12;
const BLOCK_Y_MIN = 80;
const BLOCK_Y_MAX = 620;

const LEFT_X_MIN = 40;
const LEFT_X_MAX = 220;

const RIGHT_X_MIN = 680;
const RIGHT_X_MAX = 860;

// Crossbench (centre rear)
const CB_X_MIN = 300;
const CB_X_MAX = 600;
const CB_Y_MIN = 560;
const CB_Y_MAX = 650;
const CB_ROW_COUNT = 3;

// Individual seat (rounded rectangle)
const SEAT_W = 28;
const SEAT_H = 16;
const SEAT_RX = 3;

// Zoom
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.25;

const STATE_ABBREV: Record<string, string> = {
  NSW: 'NSW', VIC: 'VIC', QLD: 'QLD', WA: 'WA',
  SA: 'SA', TAS: 'TAS', ACT: 'ACT', NT: 'NT',
};

/** Darken a hex colour by a fraction (0 .. 1). */
function darkenColor(hex: string, amount: number = 0.3): string {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const num = parseInt(h, 16);
  if (isNaN(num)) return 'rgb(40,40,40)';
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const f = 1 - amount;
  return `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`;
}

// ── Component ─────────────────────────────────────────────────

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
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  // ── Derived data ────────────────────────────────────────────

  const seats = useMemo(
    () => Object.values(gameState.seats),
    [gameState.seats],
  );

  const playerMap = useMemo(() => {
    const map: Record<string, Player> = {};
    gameState.players.forEach(p => { map[p.id] = p; });
    return map;
  }, [gameState.players]);

  const seatCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    seats.forEach(s => {
      if (s.ownerPlayerId) {
        counts[s.ownerPlayerId] = (counts[s.ownerPlayerId] || 0) + 1;
      }
    });
    return counts;
  }, [seats]);

  // ── Chamber positions (straight rows only) ──────────────────

  const seatPositions = useMemo(() => {
    const positions: Record<SeatId, { x: number; y: number }> = {};

    const leftSeats = seats.filter(s => s.chamberSide === 'left');
    const rightSeats = seats.filter(s => s.chamberSide === 'right');
    const crossbenchSeats = seats.filter(s => s.chamberSide === 'crossbench');

    const sortByGrid = (a: Seat, b: Seat) =>
      a.chamberRow !== b.chamberRow
        ? a.chamberRow - b.chamberRow
        : a.chamberCol - b.chamberCol;

    leftSeats.sort(sortByGrid);
    rightSeats.sort(sortByGrid);

    const colSpacing = BLOCK_COLS > 1
      ? (LEFT_X_MAX - LEFT_X_MIN) / (BLOCK_COLS - 1)
      : 0;
    const rowSpacing = BLOCK_ROWS > 1
      ? (BLOCK_Y_MAX - BLOCK_Y_MIN) / (BLOCK_ROWS - 1)
      : 0;

    // Opposition block (left)
    leftSeats.forEach((seat, i) => {
      const col = i % BLOCK_COLS;
      const row = Math.floor(i / BLOCK_COLS);
      positions[seat.id] = {
        x: LEFT_X_MIN + col * colSpacing,
        y: BLOCK_Y_MIN + row * rowSpacing,
      };
    });

    // Government block (right)
    rightSeats.forEach((seat, i) => {
      const col = i % BLOCK_COLS;
      const row = Math.floor(i / BLOCK_COLS);
      positions[seat.id] = {
        x: RIGHT_X_MIN + col * colSpacing,
        y: BLOCK_Y_MIN + row * rowSpacing,
      };
    });

    // Crossbench (straight rows at the rear)
    const basePerRow = Math.ceil(crossbenchSeats.length / CB_ROW_COUNT);
    const cbRowSpacing = CB_ROW_COUNT > 1
      ? (CB_Y_MAX - CB_Y_MIN) / (CB_ROW_COUNT - 1)
      : 0;

    let cbIdx = 0;
    for (let row = 0; row < CB_ROW_COUNT && cbIdx < crossbenchSeats.length; row++) {
      const remaining = crossbenchSeats.length - cbIdx;
      const nInRow = row < CB_ROW_COUNT - 1
        ? Math.min(basePerRow, remaining)
        : remaining;
      const y = CB_Y_MIN + row * cbRowSpacing;

      for (let col = 0; col < nInRow; col++) {
        const x = nInRow > 1
          ? CB_X_MIN + col * ((CB_X_MAX - CB_X_MIN) / (nInRow - 1))
          : (CB_X_MIN + CB_X_MAX) / 2;
        positions[crossbenchSeats[cbIdx].id] = { x, y };
        cbIdx++;
      }
    }

    return positions;
  }, [seats]);

  // ── Seat appearance ─────────────────────────────────────────

  const getSeatColor = useCallback((seat: Seat): string => {
    if (!seat.ownerPlayerId) return '#555';
    return playerMap[seat.ownerPlayerId]?.color || '#555';
  }, [playerMap]);

  const getSeatStroke = useCallback((seat: Seat): string => {
    const fill = getSeatColor(seat);
    return darkenColor(fill, 0.35);
  }, [getSeatColor]);

  const getSeatClass = useCallback((seat: Seat): string => {
    const classes = ['seat-dot'];
    if (seat.contested) classes.push('contested');
    if (selectedSeatId === seat.id) classes.push('selected');
    if (targetableSeatIds.includes(seat.id)) classes.push('targetable');
    return classes.join(' ');
  }, [selectedSeatId, targetableSeatIds]);

  // ── Event handlers ──────────────────────────────────────────

  const handleSeatMouseEnter = useCallback((seat: Seat, e: React.MouseEvent) => {
    setHoveredSeat(seat);
    const el = e.currentTarget as SVGRectElement;
    const elRect = el.getBoundingClientRect();
    setTooltipPos({
      x: elRect.left + elRect.width / 2,
      y: elRect.top - 4,
    });
    onSeatHover?.(seat.id);
  }, [onSeatHover]);

  const handleSeatMouseLeave = useCallback(() => {
    setHoveredSeat(null);
    onSeatHover?.(null);
  }, [onSeatHover]);

  // Zoom
  const handleZoomIn = useCallback(() => {
    setZoom(z => Math.min(z + ZOOM_STEP, ZOOM_MAX));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(z => Math.max(z - ZOOM_STEP, ZOOM_MIN));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  // Pan (drag to scroll when zoomed in)
  const handlePanStart = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (zoom <= 1) return;
    const target = e.target as SVGElement;
    if (target.classList.contains('seat-dot')) return;
    e.preventDefault();
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX, y: e.clientY,
      px: panOffset.x, py: panOffset.y,
    };
  }, [zoom, panOffset]);

  const handlePanMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!isPanning) return;
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    const dx = (e.clientX - panStartRef.current.x) * (VB_W / rect.width);
    const dy = (e.clientY - panStartRef.current.y) * (VB_H / rect.height);
    setPanOffset({
      x: panStartRef.current.px + dx,
      y: panStartRef.current.py + dy,
    });
  }, [isPanning]);

  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
  }, []);

  // ── Computed values ─────────────────────────────────────────

  const majorityCount = Math.ceil(gameState.totalSeats / 2);

  const transformStr = useMemo(() => {
    const cx = VB_W / 2;
    const cy = VB_H / 2;
    const tx = cx * (1 - zoom) + panOffset.x;
    const ty = cy * (1 - zoom) + panOffset.y;
    return `translate(${tx}, ${ty}) scale(${zoom})`;
  }, [zoom, panOffset]);

  const cursorStyle = zoom > 1
    ? (isPanning ? 'grabbing' : 'grab')
    : 'default';

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="relative w-full chamber-bg" style={{ aspectRatio: '9 / 7' }}>

      {/* ── Zoom controls ── */}
      <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
        <button
          onClick={handleZoomIn}
          disabled={zoom >= ZOOM_MAX}
          className="btn-wood w-8 h-8 flex items-center justify-center font-mono text-sm"
          title="Zoom in"
        >+</button>
        <button
          onClick={handleZoomOut}
          disabled={zoom <= ZOOM_MIN}
          className="btn-wood w-8 h-8 flex items-center justify-center font-mono text-sm"
          title="Zoom out"
        >&minus;</button>
        <button
          onClick={handleZoomReset}
          className="btn-wood w-8 h-8 flex items-center justify-center font-mono text-xs"
          title="Reset zoom"
        >1:1</button>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full h-full"
        style={{ display: 'block', cursor: cursorStyle }}
        onMouseDown={handlePanStart}
        onMouseMove={handlePanMove}
        onMouseUp={handlePanEnd}
        onMouseLeave={handlePanEnd}
      >
        <defs>
          <radialGradient id="chamberFloor" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#1a3c28" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#0c1a12" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="tableWood" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#5c3d22" />
            <stop offset="100%" stopColor="#3d2815" />
          </linearGradient>
          <linearGradient id="maceGold" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#d4a634" />
            <stop offset="50%" stopColor="#8a6508" />
            <stop offset="100%" stopColor="#d4a634" />
          </linearGradient>
        </defs>

        <g transform={transformStr}>
          {/* Chamber floor */}
          <rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#chamberFloor)" />

          {/* ── Left bench guide lines ── */}
          {Array.from({ length: BLOCK_COLS }, (_, col) => {
            const x = LEFT_X_MIN + col * ((LEFT_X_MAX - LEFT_X_MIN) / (BLOCK_COLS - 1));
            return (
              <line key={`lg-${col}`}
                x1={x} y1={BLOCK_Y_MIN - 10} x2={x} y2={BLOCK_Y_MAX + 10}
                stroke="rgba(42,69,53,0.15)" strokeWidth="0.5" strokeDasharray="4 8"
              />
            );
          })}

          {/* ── Right bench guide lines ── */}
          {Array.from({ length: BLOCK_COLS }, (_, col) => {
            const x = RIGHT_X_MIN + col * ((RIGHT_X_MAX - RIGHT_X_MIN) / (BLOCK_COLS - 1));
            return (
              <line key={`rg-${col}`}
                x1={x} y1={BLOCK_Y_MIN - 10} x2={x} y2={BLOCK_Y_MAX + 10}
                stroke="rgba(42,69,53,0.15)" strokeWidth="0.5" strokeDasharray="4 8"
              />
            );
          })}

          {/* ── Horizontal row guides (subtle bench lines) ── */}
          {Array.from({ length: BLOCK_ROWS }, (_, row) => {
            const y = BLOCK_Y_MIN + row * ((BLOCK_Y_MAX - BLOCK_Y_MIN) / (BLOCK_ROWS - 1));
            return (
              <React.Fragment key={`rh-${row}`}>
                <line
                  x1={LEFT_X_MIN - 8} y1={y} x2={LEFT_X_MAX + 8} y2={y}
                  stroke="rgba(42,69,53,0.10)" strokeWidth="0.5"
                />
                <line
                  x1={RIGHT_X_MIN - 8} y1={y} x2={RIGHT_X_MAX + 8} y2={y}
                  stroke="rgba(42,69,53,0.10)" strokeWidth="0.5"
                />
              </React.Fragment>
            );
          })}

          {/* ── Speaker's chair ── */}
          <g transform="translate(450, 30)">
            <rect x="-42" y="-18" width="84" height="36" rx="5"
              fill="#3d2815" stroke="#5c3d22" strokeWidth="1.5" />
            <rect x="-34" y="-12" width="68" height="24" rx="3"
              fill="#2a1c0e" />
            <text x="0" y="4" textAnchor="middle" fill="#d4a634"
              fontSize="9" fontFamily="'IBM Plex Mono', monospace"
              letterSpacing="0.15em">
              SPEAKER
            </text>
          </g>

          {/* ── Centre aisle line ── */}
          <line
            x1={VB_W / 2} y1={BLOCK_Y_MIN}
            x2={VB_W / 2} y2={CB_Y_MIN - 30}
            stroke="rgba(184,134,11,0.08)" strokeWidth="1" strokeDasharray="6 6"
          />

          {/* ── Dispatch table ── */}
          <rect x="380" y="300" width="140" height="100" rx="4"
            fill="url(#tableWood)" stroke="#5c3d22" strokeWidth="1" />
          {/* Inner edge detail */}
          <rect x="385" y="305" width="130" height="90" rx="3"
            fill="none" stroke="rgba(197,165,90,0.15)" strokeWidth="0.5" />

          {/* Mace on the table */}
          <line x1="410" y1="350" x2="490" y2="350"
            stroke="url(#maceGold)" strokeWidth="5" strokeLinecap="round" />
          <circle cx="496" cy="350" r="7" fill="#d4a634"
            stroke="#8a6508" strokeWidth="0.5" />
          <circle cx="404" cy="350" r="4" fill="#d4a634"
            stroke="#8a6508" strokeWidth="0.5" />

          {/* ── Labels ── */}
          <text
            x={(LEFT_X_MIN + LEFT_X_MAX) / 2} y={BLOCK_Y_MAX + 42}
            textAnchor="middle" fill="rgba(160,112,64,0.25)" fontSize="11"
            fontFamily="'IBM Plex Mono', monospace" letterSpacing="0.2em"
          >
            OPPOSITION
          </text>
          <text
            x={(RIGHT_X_MIN + RIGHT_X_MAX) / 2} y={BLOCK_Y_MAX + 42}
            textAnchor="middle" fill="rgba(160,112,64,0.25)" fontSize="11"
            fontFamily="'IBM Plex Mono', monospace" letterSpacing="0.2em"
          >
            GOVERNMENT
          </text>
          <text
            x={(CB_X_MIN + CB_X_MAX) / 2} y={CB_Y_MAX + 30}
            textAnchor="middle" fill="rgba(160,112,64,0.20)" fontSize="10"
            fontFamily="'IBM Plex Mono', monospace" letterSpacing="0.15em"
          >
            CROSSBENCH
          </text>

          {/* ── All seats ── */}
          {seats.map(seat => {
            const pos = seatPositions[seat.id];
            if (!pos) return null;
            const isOwn = seat.ownerPlayerId === playerId;
            return (
              <rect
                key={seat.id}
                x={pos.x - SEAT_W / 2}
                y={pos.y - SEAT_H / 2}
                width={SEAT_W}
                height={SEAT_H}
                rx={SEAT_RX}
                fill={getSeatColor(seat)}
                stroke={isOwn ? 'rgba(255,255,255,0.5)' : getSeatStroke(seat)}
                strokeWidth={isOwn ? 1.5 : 1}
                className={getSeatClass(seat)}
                onClick={() => onSeatClick(seat.id)}
                onMouseEnter={e => handleSeatMouseEnter(seat, e)}
                onMouseLeave={handleSeatMouseLeave}
                style={{
                  opacity: seat.margin < 20 ? 0.7 : 1,
                  filter: seat.lastCampaignedBy ? 'saturate(1.3)' : undefined,
                }}
              />
            );
          })}

          {/* ── Round indicator ── */}
          <text x="20" y="20" fill="rgba(184,134,11,0.6)" fontSize="10"
            fontFamily="'IBM Plex Mono', monospace">
            ROUND {gameState.round}/{(gameState as any).maxRounds || gameState.totalRounds}
          </text>

          {/* ── Majority indicator ── */}
          <text x={VB_W - 20} y="20" textAnchor="end"
            fill="rgba(184,134,11,0.4)" fontSize="9"
            fontFamily="'IBM Plex Mono', monospace">
            MAJORITY: {majorityCount}
          </text>
        </g>
      </svg>

      {/* ── Seat tooltip ── */}
      {hoveredSeat && (
        <div
          className="tooltip-content fixed z-50"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="font-display font-bold text-sm"
            style={{ color: getSeatColor(hoveredSeat) }}>
            {hoveredSeat.name}
          </div>
          <div className="font-mono text-xs mt-1" style={{ color: '#a09880' }}>
            {STATE_ABBREV[hoveredSeat.state]} &middot; {hoveredSeat.chamberSide}
          </div>
          <div className="font-mono text-xs mt-1">
            {hoveredSeat.ideology.econ} / {hoveredSeat.ideology.social}
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
          {hoveredSeat.contested && (
            <div className="font-mono text-xs mt-1" style={{ color: '#daa520' }}>
              CONTESTED
            </div>
          )}
        </div>
      )}

      {/* ── Party legend ── */}
      <div className="absolute bottom-2 left-2 flex flex-col gap-1">
        {[...gameState.players]
          .sort((a, b) => b.seats - a.seats)
          .map(p => (
            <div key={p.id} className="flex items-center gap-2 font-mono text-xs"
              style={{ opacity: 0.85 }}>
              <div
                className="w-3 h-3 rounded-sm"
                style={{
                  backgroundColor: p.color,
                  border: p.id === playerId
                    ? '1px solid rgba(255,255,255,0.6)'
                    : '1px solid rgba(0,0,0,0.3)',
                }}
              />
              <span style={{
                color: p.id === playerId ? '#f0e8d4' : '#a09880',
              }}>
                {seatCounts[p.id] || 0} {p.name}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
};

export default Chamber;
