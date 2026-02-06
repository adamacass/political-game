/**
 * Australian Electoral Map & Chamber Layout Generator
 *
 * Generates seats distributed across Australian states with:
 * - Ideology ratings (random or realistic mode)
 * - Vertical AusPar-style chamber positions (opposing benches, arch at top)
 * - Geographic map coordinates for the Australia map view
 * - Ownership and margin tracking
 *
 * The chamber layout mimics the real Australian House of Representatives:
 * a rectangular room with government benches on the right, opposition on
 * the left, and the Speaker's chair at the top arch. Seats are arranged
 * in rows of benches on each side, with crossbench seats at the top curve.
 *
 * During gameplay, seats are re-sorted by party ownership so each party's
 * seats cluster together from bottom to top on their respective side.
 */

import { Seat, SeatId, StateCode, EconBucket, SocialBucket, SeatIdeology, StateControl } from '../types';
import { SeededRNG } from './rng';

// ============================================================
// AUSTRALIAN DIVISION NAMES
// ============================================================

const DIVISION_NAMES: Record<StateCode, string[]> = {
  NSW: [
    'Sydney', 'Grayndler', 'Wentworth', 'Kingsford Smith', 'Barton',
    'Blaxland', 'Watson', 'Reid', 'Bennelong', 'North Sydney',
    'Warringah', 'Mackellar', 'Bradfield', 'Berowra', 'Mitchell',
    'Parramatta', 'Greenway', 'Fowler', 'McMahon', 'Chifley',
    'Werriwa', 'Lindsay', 'Macarthur', 'Hughes', 'Cook',
    'Banks', 'Cunningham', 'Whitlam', 'Gilmore', 'Eden-Monaro',
    'Hume', 'Riverina', 'Farrer', 'Calare', 'Hunter',
    'Paterson', 'Shortland', 'Newcastle', 'Dobell', 'Robertson',
    'Lyne', 'Cowper', 'Page', 'Richmond', 'New England',
    'Parkes', 'Macquarie',
  ],
  VIC: [
    'Melbourne', 'Melbourne Ports', 'Higgins', 'Kooyong', 'Chisholm',
    'Goldstein', 'Hotham', 'Bruce', 'Holt', 'Isaacs',
    'Flinders', 'Dunkley', 'Frankston', 'Casey', 'Aston',
    'Deakin', 'Menzies', 'Scullin', 'Calwell', 'Gorton',
    'Maribyrnong', 'Gellibrand', 'Lalor', 'Wills', 'Cooper',
    'Jagajaga', 'McEwen', 'Nicholls', 'Indi', 'Bendigo',
    'Ballarat', 'Corangamite', 'Wannon', 'Mallee', 'Murray',
    'Gippsland', 'Monash', 'La Trobe',
  ],
  QLD: [
    'Brisbane', 'Griffith', 'Lilley', 'Moreton', 'Bonner',
    'Ryan', 'Dickson', 'Petrie', 'Longman', 'Fisher',
    'Fairfax', 'Wide Bay', 'Hinkler', 'Flynn', 'Capricornia',
    'Dawson', 'Herbert', 'Leichhardt', 'Kennedy', 'Maranoa',
    'Groom', 'Blair', 'Oxley', 'Rankin', 'Forde',
    'Wright', 'Fadden', 'Moncrieff', 'McPherson',
  ],
  WA: [
    'Perth', 'Curtin', 'Swan', 'Stirling', 'Moore',
    'Cowan', 'Pearce', 'Hasluck', 'Tangney', 'Fremantle',
    'Brand', 'Canning', 'Burt', "O'Connor", 'Durack',
    'Forrest',
  ],
  SA: [
    'Adelaide', 'Hindmarsh', 'Boothby', 'Sturt', 'Makin',
    'Kingston', 'Mayo', 'Barker', 'Grey', 'Wakefield',
    'Spence',
  ],
  TAS: [
    'Denison', 'Franklin', 'Lyons', 'Braddon', 'Bass',
    'Clark',
  ],
  ACT: [
    'Canberra', 'Bean', 'Fenner',
  ],
  NT: [
    'Solomon', 'Lingiari',
  ],
};

const FALLBACK_SUFFIXES = [
  'North', 'South', 'East', 'West', 'Central',
  'Upper', 'Lower', 'Inner', 'Outer', 'Greater',
];

// ============================================================
// STATE DISTRIBUTION
// ============================================================

const STATE_PROPORTIONS: Record<StateCode, number> = {
  NSW: 0.32,
  VIC: 0.26,
  QLD: 0.20,
  WA: 0.11,
  SA: 0.07,
  TAS: 0.03,
  ACT: 0.01,
  NT: 0.01,
};

// ============================================================
// STATE IDEOLOGY BIASES
// ============================================================

const STATE_ECON_BIAS: Record<StateCode, number> = {
  NSW: 0, VIC: 0.1, QLD: -0.1, WA: -0.15,
  SA: 0.05, TAS: 0.1, ACT: 0.2, NT: -0.05,
};

const STATE_SOCIAL_BIAS: Record<StateCode, number> = {
  NSW: 0, VIC: 0.15, QLD: -0.1, WA: -0.05,
  SA: 0.05, TAS: 0.1, ACT: 0.2, NT: -0.1,
};

// ============================================================
// IDEOLOGY SEAT CLASSIFICATIONS (for realistic mode)
// ============================================================

const INNER_CITY_SEATS = new Set([
  'Sydney', 'Melbourne', 'Brisbane', 'Grayndler', 'Wills', 'Melbourne Ports',
  'Griffith', 'Perth', 'Higgins', 'Kooyong', 'Ryan', 'Adelaide',
  'Cooper', 'Wentworth', 'North Sydney', 'Warringah', 'Canberra', 'Bean', 'Fenner',
  'Maribyrnong', 'Gellibrand', 'Fremantle', 'Curtin', 'Swan', 'Hindmarsh',
]);

const RURAL_REGIONAL_SEATS = new Set([
  'Kennedy', 'Maranoa', 'Flynn', 'Dawson', 'Capricornia', 'Hinkler',
  "O'Connor", 'Durack', 'Forrest', 'Grey', 'Barker', 'Farrer', 'Riverina',
  'Parkes', 'New England', 'Lyne', 'Cowper', 'Page', 'Gippsland', 'Murray',
  'Mallee', 'Nicholls', 'Indi', 'Wannon', 'Braddon', 'Lyons', 'Bass',
  'Lingiari', 'Wide Bay', 'Calare', 'Hunter',
]);

const RESOURCE_SEATS = new Set([
  'Durack', "O'Connor", 'Forrest', 'Grey', 'Capricornia', 'Flynn',
  'Dawson', 'Herbert', 'Kennedy', 'Maranoa', 'Lingiari', 'Solomon',
]);

const INDUSTRIAL_SEATS = new Set([
  'Blaxland', 'Watson', 'Fowler', 'McMahon', 'Chifley', 'Werriwa',
  'Shortland', 'Newcastle', 'Cunningham', 'Bruce', 'Holt', 'Isaacs',
  'Scullin', 'Calwell', 'Lalor', 'Gorton', 'Oxley', 'Rankin', 'Forde',
  'Blair', 'Longman', 'Bonner', 'Moreton', 'Brand', 'Canning', 'Burt',
  'Stirling', 'Moore', 'Cowan', 'Pearce', 'Hasluck', 'Kingston', 'Wakefield',
  'Spence', 'Makin', 'Franklin', 'Denison', 'Clark',
]);

// ============================================================
// CHAMBER LAYOUT CONSTANTS
// Vertical AusPar-style: opposing benches with arch at top
// ============================================================

/**
 * SVG ViewBox: 0 0 800 1000
 * Layout: tall rectangle, government benches on right, opposition on left
 *
 * The chamber has:
 * - Two blocks of benches facing each other (left side = opposition, right = government)
 * - Each block has 5 columns of seats (front bench to back bench)
 * - An arched section at the top where benches curve around
 * - Speaker's chair at the very top center
 * - Central table (dispatch boxes) between the two sides
 *
 * Seats flow from bottom of left side, up to the arch, across, and down the right side.
 * Within each side, seats are organized by party (grouped together).
 */

const CHAMBER_WIDTH = 800;
const CHAMBER_HEIGHT = 1000;

// Bench geometry
const LEFT_BENCH_X = 120;   // leftmost column of left benches
const RIGHT_BENCH_X = 520;  // leftmost column of right benches
const BENCH_COL_SPACING = 36; // spacing between bench columns (front to back)
const BENCH_COLS = 5;        // 5 columns deep on each side

// Vertical range for straight bench sections
const BENCH_TOP_Y = 260;     // where straight benches start (below arch)
const BENCH_BOTTOM_Y = 900;  // where benches end at the bottom

// Arch section at top
const ARCH_CENTER_X = 400;
const ARCH_CENTER_Y = 260;
const ARCH_RADIUS_INNER = 140;
const ARCH_RADIUS_OUTER = ARCH_RADIUS_INNER + (BENCH_COLS - 1) * BENCH_COL_SPACING;

// Seats per side in straight section (per column)
const SEATS_PER_STRAIGHT_COL = 12;  // 12 seats per column in the straight section
// Seats in the arch section
const SEATS_IN_ARCH = 31;  // ~31 seats fill the arch (crossbench area)

// Total: left straight = 5 cols × 12 = 60, right straight = 60, arch = 31 => 151

// ============================================================
// GEOGRAPHIC MAP COORDINATES
// For the Australia map view
// ============================================================

interface StateMapRegion {
  cx: number;  // center x of region where seats cluster
  cy: number;  // center y
  rx: number;  // horizontal spread
  ry: number;  // vertical spread
}

/** Approximate centroids for each state on a 1000×800 Australia map */
const STATE_MAP_REGIONS: Record<StateCode, StateMapRegion> = {
  WA:  { cx: 220, cy: 400, rx: 100, ry: 120 },
  NT:  { cx: 420, cy: 220, rx: 60, ry: 70 },
  SA:  { cx: 450, cy: 480, rx: 60, ry: 80 },
  QLD: { cx: 680, cy: 280, rx: 80, ry: 100 },
  NSW: { cx: 720, cy: 500, rx: 60, ry: 60 },
  VIC: { cx: 660, cy: 600, rx: 50, ry: 30 },
  TAS: { cx: 680, cy: 720, rx: 25, ry: 20 },
  ACT: { cx: 750, cy: 540, rx: 12, ry: 12 },
};

// ============================================================
// MAIN GENERATOR
// ============================================================

export interface MapGenConfig {
  seatCount: number;
  seed: string;
  playerIds: string[];
  ideologyMode: 'random' | 'realistic';
}

/**
 * Generate the full Australian electoral seat map.
 *
 * Steps:
 * 1. Allocate seats to states proportionally
 * 2. Name each seat from real division names
 * 3. Generate ideology (random or realistic)
 * 4. Compute chamber positions (vertical AusPar layout)
 * 5. Compute map positions (geographic Australia view)
 * 6. Distribute seats among players
 */
export function generateSeatMap(config: MapGenConfig): Record<SeatId, Seat> {
  const { seatCount, seed, playerIds, ideologyMode } = config;
  const rng = new SeededRNG(seed);
  const seats: Record<SeatId, Seat> = {};

  // Step 1: Allocate seats to states
  const stateAllocation = allocateSeatsToStates(seatCount);

  // Step 2 & 3: Create seat data
  const seatList: Array<{
    id: SeatId;
    name: string;
    state: StateCode;
    ideology: SeatIdeology;
    margin: number;
  }> = [];

  const usedNames: Record<StateCode, Set<string>> = {
    NSW: new Set(), VIC: new Set(), QLD: new Set(), WA: new Set(),
    SA: new Set(), TAS: new Set(), ACT: new Set(), NT: new Set(),
  };

  let seatIndex = 0;
  const states: StateCode[] = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

  for (const state of states) {
    const count = stateAllocation[state];
    const availableNames = rng.shuffle(DIVISION_NAMES[state]);

    for (let i = 0; i < count; i++) {
      const seatId = `seat_${seatIndex.toString().padStart(3, '0')}`;
      const name = getUniqueName(state, availableNames, usedNames[state], i, rng);
      const ideology = ideologyMode === 'realistic'
        ? generateRealisticIdeology(state, name, rng)
        : generateRandomIdeology(state, rng);
      const margin = 30 + Math.floor(rng.random() * 41);

      seatList.push({ id: seatId, name, state, ideology, margin });
      seatIndex++;
    }
  }

  // Step 4 & 5: Compute positions
  const chamberPositions = computeChamberPositions(seatList.length);

  for (let i = 0; i < seatList.length; i++) {
    const s = seatList[i];
    const pos = chamberPositions[i];
    const mapPos = computeMapPosition(s.state, i, stateAllocation[s.state], rng);

    seats[s.id] = {
      id: s.id,
      name: s.name,
      state: s.state,
      x: pos.x,
      y: pos.y,
      chamberRow: pos.row,
      chamberCol: pos.col,
      chamberSide: pos.side,
      ideology: s.ideology,
      ownerPlayerId: null,
      margin: s.margin,
      lastCampaignedBy: null,
      contested: false,
      mapX: mapPos.x,
      mapY: mapPos.y,
    };
  }

  // Step 6: Distribute among players
  distributeSeatsToPlayers(seats, playerIds, rng);

  return seats;
}

/**
 * Recompute chamber x/y positions for all seats based on current ownership.
 * Groups seats by party on each side of the chamber.
 *
 * Government side (right): player with most seats, sorted by party
 * Opposition side (left): all other parties, sorted by seat count
 * Crossbench (arch): seats owned by smallest parties or unowned
 */
export function recomputeChamberPositions(
  seats: Record<SeatId, Seat>,
  playerSeatCounts: Record<string, number>,
): void {
  const seatList = Object.values(seats);

  // Determine which player is "government" (most seats)
  let govPlayerId: string | null = null;
  let maxSeats = 0;
  for (const [pid, count] of Object.entries(playerSeatCounts)) {
    if (count > maxSeats) {
      maxSeats = count;
      govPlayerId = pid;
    }
  }

  // Sort players by seat count descending (for ordering on opposition side)
  const playersBySeats = Object.entries(playerSeatCounts)
    .sort((a, b) => b[1] - a[1]);

  // Separate seats into government, opposition, unowned
  const govSeats: Seat[] = [];
  const oppSeats: Seat[] = [];
  const unownedSeats: Seat[] = [];

  for (const seat of seatList) {
    if (!seat.ownerPlayerId) {
      unownedSeats.push(seat);
    } else if (seat.ownerPlayerId === govPlayerId) {
      govSeats.push(seat);
    } else {
      oppSeats.push(seat);
    }
  }

  // Sort opposition seats: group by player, players ordered by seat count desc
  const oppPlayerOrder = playersBySeats
    .filter(([pid]) => pid !== govPlayerId)
    .map(([pid]) => pid);

  oppSeats.sort((a, b) => {
    const aIdx = oppPlayerOrder.indexOf(a.ownerPlayerId!);
    const bIdx = oppPlayerOrder.indexOf(b.ownerPlayerId!);
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a.margin - b.margin; // marginals at front
  });

  // Sort government seats: marginals at front
  govSeats.sort((a, b) => a.margin - b.margin);

  // Compute total capacity for each zone
  const straightCapacity = SEATS_PER_STRAIGHT_COL * BENCH_COLS; // 60 per side
  const archCapacity = SEATS_IN_ARCH;

  // Fill: opposition on left, government on right, overflow + unowned in arch
  const leftSeats = oppSeats.slice(0, straightCapacity);
  const rightSeats = govSeats.slice(0, straightCapacity);

  // Anything that doesn't fit goes to arch
  const archSeats = [
    ...oppSeats.slice(straightCapacity),
    ...unownedSeats,
    ...govSeats.slice(straightCapacity),
  ].slice(0, archCapacity);

  // Any remaining seats get squeezed into the straight sections
  const overflow = [
    ...oppSeats.slice(straightCapacity),
    ...unownedSeats,
    ...govSeats.slice(straightCapacity),
  ].slice(archCapacity);

  // Assign positions: LEFT SIDE (opposition)
  assignStraightPositions(leftSeats, 'left');

  // Assign positions: RIGHT SIDE (government)
  assignStraightPositions(rightSeats, 'right');

  // Assign positions: ARCH (crossbench)
  assignArchPositions(archSeats);

  // Handle overflow by squeezing into straight sections
  for (let i = 0; i < overflow.length; i++) {
    const seat = overflow[i];
    const side = i % 2 === 0 ? 'left' : 'right';
    const baseX = side === 'left' ? LEFT_BENCH_X : RIGHT_BENCH_X;
    seat.x = baseX + 2 * BENCH_COL_SPACING;
    seat.y = BENCH_BOTTOM_Y + 20 + Math.floor(i / 2) * 14;
    seat.chamberSide = side;
    seat.chamberRow = SEATS_PER_STRAIGHT_COL;
    seat.chamberCol = 2;
  }
}

// ============================================================
// POSITION COMPUTATION
// ============================================================

interface ChamberPosition {
  row: number;
  col: number;
  side: 'left' | 'right' | 'crossbench';
  x: number;
  y: number;
}

/**
 * Compute initial chamber positions for N seats.
 * Distributes seats across left side, arch, and right side.
 */
function computeChamberPositions(totalSeats: number): ChamberPosition[] {
  const positions: ChamberPosition[] = [];

  const straightCapacity = SEATS_PER_STRAIGHT_COL * BENCH_COLS;
  const leftCount = Math.min(Math.floor((totalSeats - SEATS_IN_ARCH) / 2), straightCapacity);
  const rightCount = Math.min(totalSeats - leftCount - SEATS_IN_ARCH, straightCapacity);
  const archCount = totalSeats - leftCount - rightCount;

  // Left side positions
  for (let i = 0; i < leftCount; i++) {
    const col = i % BENCH_COLS;
    const row = Math.floor(i / BENCH_COLS);
    const x = LEFT_BENCH_X + col * BENCH_COL_SPACING;
    const y = BENCH_BOTTOM_Y - row * ((BENCH_BOTTOM_Y - BENCH_TOP_Y) / Math.max(SEATS_PER_STRAIGHT_COL - 1, 1));
    positions.push({ row, col, side: 'left', x: Math.round(x), y: Math.round(y) });
  }

  // Arch positions
  for (let i = 0; i < archCount; i++) {
    const fraction = i / Math.max(archCount - 1, 1);
    // Sweep from left (~170 degrees) to right (~10 degrees)
    const angle = Math.PI * (1 - fraction * 1); // π to 0
    const rowInArch = i % BENCH_COLS;
    const radius = ARCH_RADIUS_INNER + rowInArch * BENCH_COL_SPACING;
    const x = ARCH_CENTER_X + radius * Math.cos(angle);
    const y = ARCH_CENTER_Y - radius * Math.sin(angle);
    positions.push({
      row: Math.floor(i / BENCH_COLS),
      col: rowInArch,
      side: 'crossbench',
      x: Math.round(x),
      y: Math.round(y),
    });
  }

  // Right side positions
  for (let i = 0; i < rightCount; i++) {
    const col = BENCH_COLS - 1 - (i % BENCH_COLS); // front bench is closest to center
    const row = Math.floor(i / BENCH_COLS);
    const x = RIGHT_BENCH_X + col * BENCH_COL_SPACING;
    const y = BENCH_TOP_Y + row * ((BENCH_BOTTOM_Y - BENCH_TOP_Y) / Math.max(SEATS_PER_STRAIGHT_COL - 1, 1));
    positions.push({ row, col, side: 'right', x: Math.round(x), y: Math.round(y) });
  }

  return positions;
}

function assignStraightPositions(seatList: Seat[], side: 'left' | 'right'): void {
  const baseX = side === 'left' ? LEFT_BENCH_X : RIGHT_BENCH_X;
  const rowSpacing = (BENCH_BOTTOM_Y - BENCH_TOP_Y) / Math.max(SEATS_PER_STRAIGHT_COL - 1, 1);

  for (let i = 0; i < seatList.length; i++) {
    const seat = seatList[i];
    const col = i % BENCH_COLS;
    const row = Math.floor(i / BENCH_COLS);

    // On left side, front bench (closest to center) is the rightmost column
    // On right side, front bench is the leftmost column
    const colOffset = side === 'left'
      ? (BENCH_COLS - 1 - col) * BENCH_COL_SPACING
      : col * BENCH_COL_SPACING;

    seat.x = Math.round(baseX + colOffset);
    // Fill from bottom (entrance) upward (toward Speaker)
    seat.y = Math.round(BENCH_BOTTOM_Y - row * rowSpacing);
    seat.chamberRow = row;
    seat.chamberCol = col;
    seat.chamberSide = side;
  }
}

function assignArchPositions(seatList: Seat[]): void {
  const n = seatList.length;
  for (let i = 0; i < n; i++) {
    const seat = seatList[i];
    const fraction = n > 1 ? i / (n - 1) : 0.5;
    // Sweep from left side (π) to right side (0)
    const angle = Math.PI * (1 - fraction);
    const rowInArch = i % BENCH_COLS;
    const radius = ARCH_RADIUS_INNER + rowInArch * BENCH_COL_SPACING;
    seat.x = Math.round(ARCH_CENTER_X + radius * Math.cos(angle));
    seat.y = Math.round(ARCH_CENTER_Y - radius * Math.sin(angle));
    seat.chamberRow = Math.floor(i / BENCH_COLS);
    seat.chamberCol = rowInArch;
    seat.chamberSide = 'crossbench';
  }
}

// ============================================================
// MAP POSITION COMPUTATION
// ============================================================

function computeMapPosition(
  state: StateCode,
  indexInState: number,
  totalInState: number,
  rng: SeededRNG,
): { x: number; y: number } {
  const region = STATE_MAP_REGIONS[state];

  // Arrange seats in a roughly grid pattern within the state region
  const cols = Math.ceil(Math.sqrt(totalInState * (region.rx / region.ry)));
  const rows = Math.ceil(totalInState / Math.max(cols, 1));
  const row = Math.floor(indexInState / Math.max(cols, 1));
  const col = indexInState % Math.max(cols, 1);

  // Offset from center with slight random jitter
  const xSpacing = (2 * region.rx) / Math.max(cols, 1);
  const ySpacing = (2 * region.ry) / Math.max(rows, 1);

  const x = region.cx - region.rx + col * xSpacing + xSpacing / 2 + (rng.random() - 0.5) * 4;
  const y = region.cy - region.ry + row * ySpacing + ySpacing / 2 + (rng.random() - 0.5) * 4;

  return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
}

// ============================================================
// SEAT ALLOCATION
// ============================================================

function allocateSeatsToStates(totalSeats: number): Record<StateCode, number> {
  const states: StateCode[] = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
  const allocation: Record<StateCode, number> = {} as Record<StateCode, number>;

  let remaining = totalSeats;
  for (const state of states) {
    allocation[state] = 1;
    remaining--;
  }

  for (const state of states) {
    const additional = Math.floor((totalSeats - states.length) * STATE_PROPORTIONS[state]);
    allocation[state] += additional;
    remaining -= additional;
  }

  const largestFirst: StateCode[] = ['NSW', 'VIC', 'QLD', 'WA', 'SA'];
  let idx = 0;
  while (remaining > 0) {
    allocation[largestFirst[idx % largestFirst.length]]++;
    remaining--;
    idx++;
  }

  return allocation;
}

// ============================================================
// NAME GENERATION
// ============================================================

function getUniqueName(
  state: StateCode,
  availableNames: string[],
  usedNames: Set<string>,
  index: number,
  _rng: SeededRNG,
): string {
  while (availableNames.length > 0) {
    const name = availableNames.pop()!;
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }

  const suffix = FALLBACK_SUFFIXES[index % FALLBACK_SUFFIXES.length];
  const num = Math.floor(index / FALLBACK_SUFFIXES.length) + 1;
  const fallbackName = num > 1 ? `${state} ${suffix} ${num}` : `${state} ${suffix}`;
  usedNames.add(fallbackName);
  return fallbackName;
}

// ============================================================
// IDEOLOGY GENERATION
// ============================================================

function generateRandomIdeology(state: StateCode, rng: SeededRNG): SeatIdeology {
  const econBias = STATE_ECON_BIAS[state];
  const socialBias = STATE_SOCIAL_BIAS[state];
  const econValue = (rng.random() - 0.5) * 2 + econBias;
  const socialValue = (rng.random() - 0.5) * 2 + socialBias;
  const econ: EconBucket = econValue < -0.33 ? 'RIGHT' : econValue > 0.33 ? 'LEFT' : 'CENTER';
  const social: SocialBucket = socialValue < -0.33 ? 'CONS' : socialValue > 0.33 ? 'PROG' : 'CENTER';
  return { econ, social };
}

function generateRealisticIdeology(state: StateCode, name: string, rng: SeededRNG): SeatIdeology {
  let econScore = STATE_ECON_BIAS[state];
  let socialScore = STATE_SOCIAL_BIAS[state];

  if (INNER_CITY_SEATS.has(name)) { socialScore += 0.5; econScore += 0.1; }
  if (RURAL_REGIONAL_SEATS.has(name)) { socialScore -= 0.4; econScore -= 0.1; }
  if (RESOURCE_SEATS.has(name)) { econScore -= 0.4; socialScore -= 0.2; }
  if (INDUSTRIAL_SEATS.has(name)) { econScore += 0.3; socialScore += 0.1; }

  econScore += (rng.random() - 0.5) * 0.3;
  socialScore += (rng.random() - 0.5) * 0.3;
  econScore = Math.max(-1, Math.min(1, econScore));
  socialScore = Math.max(-1, Math.min(1, socialScore));

  const econ: EconBucket = econScore < -0.2 ? 'RIGHT' : econScore > 0.2 ? 'LEFT' : 'CENTER';
  const social: SocialBucket = socialScore < -0.2 ? 'CONS' : socialScore > 0.2 ? 'PROG' : 'CENTER';
  return { econ, social };
}

// ============================================================
// SEAT DISTRIBUTION
// ============================================================

function distributeSeatsToPlayers(
  seats: Record<SeatId, Seat>,
  playerIds: string[],
  rng: SeededRNG,
): void {
  if (playerIds.length === 0) return;
  const seatIds = rng.shuffle(Object.keys(seats));
  seatIds.forEach((seatId, index) => {
    seats[seatId].ownerPlayerId = playerIds[index % playerIds.length];
  });
}

// ============================================================
// UTILITY FUNCTIONS (unchanged API)
// ============================================================

export function computePlayerSeatCounts(seats: Record<SeatId, Seat>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const seat of Object.values(seats)) {
    if (seat.ownerPlayerId) {
      counts[seat.ownerPlayerId] = (counts[seat.ownerPlayerId] || 0) + 1;
    }
  }
  return counts;
}

export function getPlayerSeats(seats: Record<SeatId, Seat>, playerId: string): Seat[] {
  return Object.values(seats).filter(s => s.ownerPlayerId === playerId);
}

export function getEligibleSeatsForCapture(
  seats: Record<SeatId, Seat>,
  actorId: string,
  ideologyAxis: 'econ' | 'social',
  ideologyBucket: EconBucket | SocialBucket,
): SeatId[] {
  const eligible: SeatId[] = [];
  for (const [seatId, seat] of Object.entries(seats)) {
    if (!seat.ownerPlayerId || seat.ownerPlayerId === actorId) continue;
    if (ideologyAxis === 'econ' && seat.ideology.econ === ideologyBucket) {
      eligible.push(seatId);
    } else if (ideologyAxis === 'social' && seat.ideology.social === ideologyBucket) {
      eligible.push(seatId);
    }
  }
  return eligible;
}

export function transferSeat(seats: Record<SeatId, Seat>, seatId: SeatId, newOwnerId: string): boolean {
  const seat = seats[seatId];
  if (!seat) return false;
  seat.ownerPlayerId = newOwnerId;
  return true;
}

export function deriveIdeologyFromCard(card: {
  stanceTable?: { progressive: string; conservative: string; market: string; interventionist: string };
  ideology?: { econ?: EconBucket; social?: SocialBucket };
}): { axis: 'econ' | 'social'; bucket: EconBucket | SocialBucket } | null {
  if (card.ideology) {
    if (card.ideology.econ) return { axis: 'econ', bucket: card.ideology.econ };
    if (card.ideology.social) return { axis: 'social', bucket: card.ideology.social };
  }
  if (!card.stanceTable) return { axis: 'econ', bucket: 'CENTER' };
  const st = card.stanceTable;
  if (st.market === 'favoured' && st.interventionist === 'opposed') return { axis: 'econ', bucket: 'RIGHT' };
  if (st.interventionist === 'favoured' && st.market === 'opposed') return { axis: 'econ', bucket: 'LEFT' };
  if (st.progressive === 'favoured' && st.conservative === 'opposed') return { axis: 'social', bucket: 'PROG' };
  if (st.conservative === 'favoured' && st.progressive === 'opposed') return { axis: 'social', bucket: 'CONS' };
  return { axis: 'econ', bucket: 'CENTER' };
}

// ============================================================
// STATE CONTROL FUNCTIONS
// ============================================================

const ALL_STATES: StateCode[] = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

export function computeStateControl(seats: Record<SeatId, Seat>): Record<StateCode, StateControl> {
  const stateControl: Record<StateCode, StateControl> = {} as Record<StateCode, StateControl>;
  for (const state of ALL_STATES) {
    stateControl[state] = { state, controllerId: null, seatCount: 0, totalSeats: 0 };
  }

  const stateSeatsByPlayer: Record<StateCode, Record<string, number>> = {} as Record<StateCode, Record<string, number>>;
  for (const state of ALL_STATES) { stateSeatsByPlayer[state] = {}; }

  for (const seat of Object.values(seats)) {
    stateControl[seat.state].totalSeats++;
    if (seat.ownerPlayerId) {
      stateSeatsByPlayer[seat.state][seat.ownerPlayerId] =
        (stateSeatsByPlayer[seat.state][seat.ownerPlayerId] || 0) + 1;
    }
  }

  for (const state of ALL_STATES) {
    const total = stateControl[state].totalSeats;
    const majorityThreshold = Math.floor(total / 2) + 1;
    let maxSeats = 0;
    let controllerId: string | null = null;
    let isTied = false;

    for (const [playerId, count] of Object.entries(stateSeatsByPlayer[state])) {
      if (count > maxSeats) { maxSeats = count; controllerId = playerId; isTied = false; }
      else if (count === maxSeats) { isTied = true; }
    }

    if (maxSeats >= majorityThreshold && !isTied) {
      stateControl[state].controllerId = controllerId;
      stateControl[state].seatCount = maxSeats;
    }
  }

  return stateControl;
}

export function getPlayerControlledStates(
  stateControl: Record<StateCode, StateControl>,
  playerId: string,
): StateCode[] {
  return ALL_STATES.filter(state => stateControl[state].controllerId === playerId);
}

export function compareStateControl(
  oldControl: Record<StateCode, StateControl>,
  newControl: Record<StateCode, StateControl>,
): { gained: { playerId: string; state: StateCode }[]; lost: { playerId: string; state: StateCode }[] } {
  const gained: { playerId: string; state: StateCode }[] = [];
  const lost: { playerId: string; state: StateCode }[] = [];

  for (const state of ALL_STATES) {
    const oldId = oldControl[state]?.controllerId;
    const newId = newControl[state]?.controllerId;
    if (oldId !== newId) {
      if (oldId) lost.push({ playerId: oldId, state });
      if (newId) gained.push({ playerId: newId, state });
    }
  }

  return { gained, lost };
}

export function getStateSeatsByPlayer(seats: Record<SeatId, Seat>, state: StateCode): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const seat of Object.values(seats)) {
    if (seat.state === state && seat.ownerPlayerId) {
      counts[seat.ownerPlayerId] = (counts[seat.ownerPlayerId] || 0) + 1;
    }
  }
  return counts;
}
