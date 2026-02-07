/**
 * Australian Electoral Map & Chamber Layout Generator
 *
 * Generates seats distributed across Australian states with:
 * - Voter group demographics (Democracy 4-style)
 * - Vertical AusPar-style chamber positions (opposing benches, arch at top)
 * - Geographic map coordinates for the Australia map view
 * - Ownership and margin tracking
 */

import seedrandom from 'seedrandom';
import { Seat, SeatId, StateCode, VoterGroupDefinition } from '../types';

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
// SEAT CLASSIFICATION SETS — map seats to demographics
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

// Demographic profiles: voter group weights by seat type
type SeatType = 'inner_city' | 'rural' | 'resource' | 'industrial' | 'suburban';

const DEMOGRAPHIC_PROFILES: Record<SeatType, Record<string, number>> = {
  inner_city: {
    tech_workers: 0.20, students: 0.15, environmentalists: 0.15, immigrants: 0.12,
    public_servants: 0.10, workers: 0.08, wealthy: 0.08, healthcare_workers: 0.05,
    parents: 0.04, business_owners: 0.03,
  },
  rural: {
    farmers: 0.25, retirees: 0.18, religious: 0.12, motorists: 0.12,
    business_owners: 0.10, workers: 0.08, parents: 0.08, indigenous: 0.04,
    healthcare_workers: 0.03,
  },
  resource: {
    workers: 0.25, motorists: 0.15, business_owners: 0.15, farmers: 0.10,
    indigenous: 0.10, retirees: 0.08, parents: 0.08, religious: 0.05,
    healthcare_workers: 0.04,
  },
  industrial: {
    workers: 0.22, parents: 0.15, immigrants: 0.12, motorists: 0.10,
    healthcare_workers: 0.10, retirees: 0.08, business_owners: 0.08,
    students: 0.05, public_servants: 0.05, religious: 0.05,
  },
  suburban: {
    parents: 0.18, motorists: 0.15, workers: 0.12, retirees: 0.12,
    business_owners: 0.10, healthcare_workers: 0.08, immigrants: 0.08,
    students: 0.05, wealthy: 0.05, public_servants: 0.04, religious: 0.03,
  },
};

// ============================================================
// CHAMBER LAYOUT CONSTANTS
// Vertical AusPar-style: opposing benches with arch at top
// ============================================================

const LEFT_BENCH_X = 120;
const RIGHT_BENCH_X = 520;
const BENCH_COL_SPACING = 36;
const BENCH_COLS = 5;

const BENCH_TOP_Y = 260;
const BENCH_BOTTOM_Y = 900;

const ARCH_CENTER_X = 400;
const ARCH_CENTER_Y = 260;
const ARCH_RADIUS_INNER = 140;

const SEATS_PER_STRAIGHT_COL = 12;
const SEATS_IN_ARCH = 31;

// ============================================================
// GEOGRAPHIC MAP COORDINATES
// ============================================================

interface StateMapRegion {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

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
// RNG HELPERS (replacing SeededRNG class)
// ============================================================

function shuffle<T>(array: T[], rng: seedrandom.PRNG): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ============================================================
// MAIN GENERATOR
// ============================================================

/**
 * Generate the full Australian electoral seat map with Democracy 4-style demographics.
 *
 * Steps:
 * 1. Allocate seats to states proportionally
 * 2. Name each seat from real division names
 * 3. Generate voter group demographics based on seat character
 * 4. Compute chamber positions (vertical AusPar layout)
 * 5. Compute map positions (geographic Australia view)
 */
export function generateSeatMap(
  totalSeats: number,
  rng: seedrandom.PRNG,
  voterGroupDefs: VoterGroupDefinition[],
): Record<SeatId, Seat> {
  const seats: Record<SeatId, Seat> = {};

  // Step 1: Allocate seats to states
  const stateAllocation = allocateSeatsToStates(totalSeats);

  // Step 2 & 3: Create seat data
  const seatList: Array<{
    id: SeatId;
    name: string;
    state: StateCode;
    demographics: { groupId: string; weight: number }[];
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
    const availableNames = shuffle(DIVISION_NAMES[state], rng);

    for (let i = 0; i < count; i++) {
      const seatId = `seat_${seatIndex.toString().padStart(3, '0')}`;
      const name = getUniqueName(state, availableNames, usedNames[state], i);
      const demographics = generateDemographics(name, voterGroupDefs, rng);
      const margin = 30 + Math.floor(rng() * 41);

      seatList.push({ id: seatId, name, state, demographics, margin });
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
      chamberRow: pos.row,
      chamberCol: pos.col,
      chamberSide: pos.side,
      demographics: s.demographics,
      ownerPlayerId: null,
      margin: s.margin,
      mapX: mapPos.x,
      mapY: mapPos.y,
    };
  }

  return seats;
}

// ============================================================
// DEMOGRAPHICS GENERATION
// ============================================================

function classifySeat(name: string): SeatType {
  if (INNER_CITY_SEATS.has(name)) return 'inner_city';
  if (RESOURCE_SEATS.has(name)) return 'resource';
  if (RURAL_REGIONAL_SEATS.has(name)) return 'rural';
  if (INDUSTRIAL_SEATS.has(name)) return 'industrial';
  return 'suburban';
}

function generateDemographics(
  seatName: string,
  voterGroupDefs: VoterGroupDefinition[],
  rng: seedrandom.PRNG,
): { groupId: string; weight: number }[] {
  const seatType = classifySeat(seatName);
  const profile = DEMOGRAPHIC_PROFILES[seatType];
  const demographics: { groupId: string; weight: number }[] = [];

  for (const vgDef of voterGroupDefs) {
    const baseWeight = profile[vgDef.id] || 0.02; // tiny presence for unlisted groups
    // Add random variation (+/- 30%)
    const jitter = 1 + (rng() - 0.5) * 0.6;
    const weight = Math.max(0.01, baseWeight * jitter);
    demographics.push({ groupId: vgDef.id, weight: Math.round(weight * 1000) / 1000 });
  }

  // Normalize so weights sum to 1
  const total = demographics.reduce((sum, d) => sum + d.weight, 0);
  for (const d of demographics) {
    d.weight = Math.round((d.weight / total) * 1000) / 1000;
  }

  return demographics;
}

// ============================================================
// CHAMBER POSITION RECOMPUTATION
// ============================================================

/**
 * Recompute chamber positions for all seats based on current ownership.
 * Groups seats by party on each side of the chamber.
 */
export function recomputeChamberPositions(
  seats: Record<SeatId, Seat>,
  playerSeatCounts: Record<string, number>,
): void {
  const seatList = Object.values(seats);

  // Determine government (most seats)
  let govPlayerId: string | null = null;
  let maxSeats = 0;
  for (const [pid, count] of Object.entries(playerSeatCounts)) {
    if (count > maxSeats) {
      maxSeats = count;
      govPlayerId = pid;
    }
  }

  // Sort players by seat count descending
  const playersBySeats = Object.entries(playerSeatCounts)
    .sort((a, b) => b[1] - a[1]);

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

  const oppPlayerOrder = playersBySeats
    .filter(([pid]) => pid !== govPlayerId)
    .map(([pid]) => pid);

  oppSeats.sort((a, b) => {
    const aIdx = oppPlayerOrder.indexOf(a.ownerPlayerId!);
    const bIdx = oppPlayerOrder.indexOf(b.ownerPlayerId!);
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a.margin - b.margin;
  });

  govSeats.sort((a, b) => a.margin - b.margin);

  const straightCapacity = SEATS_PER_STRAIGHT_COL * BENCH_COLS;
  const leftSeats = oppSeats.slice(0, straightCapacity);
  const rightSeats = govSeats.slice(0, straightCapacity);
  const archSeats = [
    ...oppSeats.slice(straightCapacity),
    ...unownedSeats,
    ...govSeats.slice(straightCapacity),
  ].slice(0, SEATS_IN_ARCH);

  assignStraightPositions(leftSeats, 'left');
  assignStraightPositions(rightSeats, 'right');
  assignArchPositions(archSeats);

  // Overflow
  const overflow = [
    ...oppSeats.slice(straightCapacity),
    ...unownedSeats,
    ...govSeats.slice(straightCapacity),
  ].slice(SEATS_IN_ARCH);

  for (let i = 0; i < overflow.length; i++) {
    const seat = overflow[i];
    seat.chamberSide = i % 2 === 0 ? 'left' : 'right';
    seat.chamberRow = SEATS_PER_STRAIGHT_COL + Math.floor(i / 2);
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
}

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
    positions.push({ row, col, side: 'left' });
  }

  // Arch positions
  for (let i = 0; i < archCount; i++) {
    const rowInArch = i % BENCH_COLS;
    positions.push({
      row: Math.floor(i / BENCH_COLS),
      col: rowInArch,
      side: 'crossbench',
    });
  }

  // Right side positions
  for (let i = 0; i < rightCount; i++) {
    const col = BENCH_COLS - 1 - (i % BENCH_COLS);
    const row = Math.floor(i / BENCH_COLS);
    positions.push({ row, col, side: 'right' });
  }

  return positions;
}

function assignStraightPositions(seatList: Seat[], side: 'left' | 'right'): void {
  for (let i = 0; i < seatList.length; i++) {
    const seat = seatList[i];
    const col = i % BENCH_COLS;
    const row = Math.floor(i / BENCH_COLS);
    seat.chamberRow = row;
    seat.chamberCol = side === 'left' ? (BENCH_COLS - 1 - col) : col;
    seat.chamberSide = side;
  }
}

function assignArchPositions(seatList: Seat[]): void {
  for (let i = 0; i < seatList.length; i++) {
    const seat = seatList[i];
    seat.chamberRow = Math.floor(i / BENCH_COLS);
    seat.chamberCol = i % BENCH_COLS;
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
  rng: seedrandom.PRNG,
): { x: number; y: number } {
  const region = STATE_MAP_REGIONS[state];

  const cols = Math.ceil(Math.sqrt(totalInState * (region.rx / region.ry)));
  const rows = Math.ceil(totalInState / Math.max(cols, 1));
  const row = Math.floor(indexInState / Math.max(cols, 1));
  const col = indexInState % Math.max(cols, 1);

  const xSpacing = (2 * region.rx) / Math.max(cols, 1);
  const ySpacing = (2 * region.ry) / Math.max(rows, 1);

  const x = region.cx - region.rx + col * xSpacing + xSpacing / 2 + (rng() - 0.5) * 4;
  const y = region.cy - region.ry + row * ySpacing + ySpacing / 2 + (rng() - 0.5) * 4;

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
// UTILITY FUNCTIONS
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

export function transferSeat(seats: Record<SeatId, Seat>, seatId: SeatId, newOwnerId: string): boolean {
  const seat = seats[seatId];
  if (!seat) return false;
  seat.ownerPlayerId = newOwnerId;
  return true;
}

// ============================================================
// CHAMBER SVG COORDINATE HELPERS (for client-side rendering)
// ============================================================

export const CHAMBER_CONSTANTS = {
  WIDTH: 800,
  HEIGHT: 1000,
  LEFT_BENCH_X,
  RIGHT_BENCH_X,
  BENCH_COL_SPACING,
  BENCH_COLS,
  BENCH_TOP_Y,
  BENCH_BOTTOM_Y,
  ARCH_CENTER_X,
  ARCH_CENTER_Y,
  ARCH_RADIUS_INNER,
  SEATS_PER_STRAIGHT_COL,
  SEATS_IN_ARCH,
} as const;

/**
 * Compute SVG x,y coordinates for a seat from its chamber position.
 * Can be used on client-side for rendering.
 */
export function seatToSVGPosition(seat: Seat): { x: number; y: number } {
  const rowSpacing = (BENCH_BOTTOM_Y - BENCH_TOP_Y) / Math.max(SEATS_PER_STRAIGHT_COL - 1, 1);

  if (seat.chamberSide === 'left') {
    const colOffset = (BENCH_COLS - 1 - seat.chamberCol) * BENCH_COL_SPACING;
    return {
      x: Math.round(LEFT_BENCH_X + colOffset),
      y: Math.round(BENCH_BOTTOM_Y - seat.chamberRow * rowSpacing),
    };
  }

  if (seat.chamberSide === 'right') {
    const colOffset = seat.chamberCol * BENCH_COL_SPACING;
    return {
      x: Math.round(RIGHT_BENCH_X + colOffset),
      y: Math.round(BENCH_TOP_Y + seat.chamberRow * rowSpacing),
    };
  }

  // Crossbench (arch)
  const totalArchSeats = SEATS_IN_ARCH;
  const seatIdx = seat.chamberRow * BENCH_COLS + seat.chamberCol;
  const fraction = totalArchSeats > 1 ? seatIdx / (totalArchSeats - 1) : 0.5;
  const angle = Math.PI * (1 - fraction);
  const radius = ARCH_RADIUS_INNER + seat.chamberCol * BENCH_COL_SPACING;

  return {
    x: Math.round(ARCH_CENTER_X + radius * Math.cos(angle)),
    y: Math.round(ARCH_CENTER_Y - radius * Math.sin(angle)),
  };
}
