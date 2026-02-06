/**
 * Australian Electoral Map & Chamber Layout Generator
 *
 * Generates a set of seats distributed across Australian states with:
 * - Ideology ratings (random or realistic mode)
 * - U-shaped hemicycle chamber positions for the House of Representatives SVG
 * - Ownership and margin tracking
 *
 * The chamber layout places 151 seats in a horseshoe (U opening at bottom),
 * with 5 concentric rows and states clustered by angular region.
 */

import { Seat, SeatId, StateCode, EconBucket, SocialBucket, SeatIdeology, StateControl } from '../types';
import { SeededRNG } from './rng';

// ============================================================
// AUSTRALIAN DIVISION NAMES
// Real House of Representatives division names, organized by state
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

// Fallback names if we need more seats than real divisions
const FALLBACK_SUFFIXES = [
  'North', 'South', 'East', 'West', 'Central',
  'Upper', 'Lower', 'Inner', 'Outer', 'Greater',
];

// ============================================================
// STATE DISTRIBUTION PROPORTIONS
// Based roughly on real House of Reps seat allocation
// ============================================================

const STATE_PROPORTIONS: Record<StateCode, number> = {
  NSW: 0.32,   // ~47 seats
  VIC: 0.26,   // ~38 seats
  QLD: 0.20,   // ~30 seats
  WA: 0.11,    // ~16 seats
  SA: 0.07,    // ~10 seats
  TAS: 0.03,   // ~5 seats
  ACT: 0.01,   // ~2 seats
  NT: 0.01,    // ~2 seats
};

// ============================================================
// STATE IDEOLOGY BIASES (subtle flavor per state)
// ============================================================

const STATE_ECON_BIAS: Record<StateCode, number> = {
  NSW: 0,       // Balanced
  VIC: 0.1,     // Slightly left
  QLD: -0.1,    // Slightly right
  WA: -0.15,    // Mining state, slightly right
  SA: 0.05,     // Slightly left
  TAS: 0.1,     // Left leaning
  ACT: 0.2,     // Public service, left
  NT: -0.05,    // Slightly right
};

const STATE_SOCIAL_BIAS: Record<StateCode, number> = {
  NSW: 0,
  VIC: 0.15,    // Progressive
  QLD: -0.1,    // Conservative
  WA: -0.05,
  SA: 0.05,
  TAS: 0.1,
  ACT: 0.2,     // Progressive
  NT: -0.1,
};

// ============================================================
// IDEOLOGY SEAT SETS (for realistic mode)
// ============================================================

/** Inner-city progressive seats (based on real voting patterns) */
const INNER_CITY_SEATS = new Set([
  'Sydney', 'Melbourne', 'Brisbane', 'Grayndler', 'Wills', 'Melbourne Ports',
  'Griffith', 'Perth', 'Higgins', 'Kooyong', 'Ryan', 'Adelaide',
  'Cooper', 'Wentworth', 'North Sydney', 'Warringah', 'Canberra', 'Bean', 'Fenner',
  'Maribyrnong', 'Gellibrand', 'Fremantle', 'Curtin', 'Swan', 'Hindmarsh',
]);

/** Rural/regional conservative seats */
const RURAL_REGIONAL_SEATS = new Set([
  'Kennedy', 'Maranoa', 'Flynn', 'Dawson', 'Capricornia', 'Hinkler',
  "O'Connor", 'Durack', 'Forrest', 'Grey', 'Barker', 'Farrer', 'Riverina',
  'Parkes', 'New England', 'Lyne', 'Cowper', 'Page', 'Gippsland', 'Murray',
  'Mallee', 'Nicholls', 'Indi', 'Wannon', 'Braddon', 'Lyons', 'Bass',
  'Lingiari', 'Wide Bay', 'Calare', 'Hunter',
]);

/** Mining/resource-heavy seats (economically right-leaning) */
const RESOURCE_SEATS = new Set([
  'Durack', "O'Connor", 'Forrest', 'Grey', 'Capricornia', 'Flynn',
  'Dawson', 'Herbert', 'Kennedy', 'Maranoa', 'Lingiari', 'Solomon',
]);

/** Working-class/industrial seats (economically left-leaning) */
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
// U-shaped hemicycle for the House of Representatives
// ============================================================

/** ViewBox dimensions: 0 0 1000 700 */
const CHAMBER_CX = 500;
const CHAMBER_CY = 340;

/** Radii for each concentric row (inner front bench to outer back bench) */
const ROW_RADII = [170, 215, 260, 305, 350];

/** Number of seats in each row (front to back). Total = 151. */
const SEATS_PER_ROW = [22, 27, 32, 35, 35];

/** Arc sweep: from -145 to +145 degrees (0 = straight up). 70-degree gap at bottom. */
const ARC_START_DEG = -145;
const ARC_END_DEG = 145;
const ARC_SPAN_DEG = ARC_END_DEG - ARC_START_DEG; // 290

/**
 * State ordering around the horseshoe, left to right.
 * ACT + NSW on the left arm, VIC at the left curve, TAS at the top,
 * SA at the right curve, QLD + WA on the right arm, NT at the far end.
 */
const STATE_CHAMBER_ORDER: StateCode[] = ['ACT', 'NSW', 'VIC', 'TAS', 'SA', 'QLD', 'WA', 'NT'];

// ============================================================
// CHAMBER POSITION TYPE
// ============================================================

interface ChamberPosition {
  row: number;
  col: number;
  angle: number;        // degrees
  normalizedPos: number; // 0..1 fraction along the arc (0 = leftmost, 1 = rightmost)
  x: number;
  y: number;
}

// ============================================================
// MAIN GENERATOR FUNCTION
// ============================================================

export interface MapGenConfig {
  seatCount: number;
  seed: string;
  playerIds: string[];
  ideologyMode: 'random' | 'realistic';
}

/**
 * Generate the full Australian electoral seat map with chamber layout positions.
 *
 * Steps:
 * 1. Allocate seats to states proportionally
 * 2. Name each seat from real division names
 * 3. Generate ideology (random or realistic mode)
 * 4. Pre-compute all hemicycle chamber positions
 * 5. Assign chamber positions to seats, clustering states together
 * 6. Set margin, distribute among players round-robin
 */
export function generateSeatMap(config: MapGenConfig): Record<SeatId, Seat> {
  const { seatCount, seed, playerIds, ideologyMode } = config;
  const rng = new SeededRNG(seed);
  const seats: Record<SeatId, Seat> = {};

  // Step 1: Allocate seats to states
  const stateAllocation = allocateSeatsToStates(seatCount);

  // Step 2 & 3: Create seat data (without chamber positions yet)
  const seatList: Omit<Seat, 'chamberRow' | 'chamberCol' | 'chamberAngle' | 'x' | 'y'>[] = [];
  const usedNames: Record<StateCode, Set<string>> = {
    NSW: new Set(), VIC: new Set(), QLD: new Set(), WA: new Set(),
    SA: new Set(), TAS: new Set(), ACT: new Set(), NT: new Set(),
  };

  let seatIndex = 0;

  // Build seats in chamber order so states cluster naturally
  for (const state of STATE_CHAMBER_ORDER) {
    const count = stateAllocation[state];
    const availableNames = rng.shuffle(DIVISION_NAMES[state]);

    for (let i = 0; i < count; i++) {
      const seatId = `seat_${seatIndex.toString().padStart(3, '0')}`;
      const name = getUniqueName(state, availableNames, usedNames[state], i, rng);

      const ideology = ideologyMode === 'realistic'
        ? generateRealisticIdeology(state, name, rng)
        : generateRandomIdeology(state, rng);

      const margin = 30 + Math.floor(rng.random() * 41); // 30..70

      seatList.push({
        id: seatId,
        name,
        state,
        ideology,
        ownerPlayerId: null,
        margin,
        lastCampaignedBy: null,
        contested: false,
      });

      seatIndex++;
    }
  }

  // Step 4: Pre-compute all chamber positions, sorted left-to-right
  const chamberPositions = computeChamberPositions();

  // Step 5: Assign chamber positions to seats in order
  // Seats are already ordered by STATE_CHAMBER_ORDER, so states cluster in the hemicycle
  for (let i = 0; i < seatList.length; i++) {
    const pos = chamberPositions[i];
    const seatData = seatList[i];

    seats[seatData.id] = {
      ...seatData,
      chamberRow: pos.row,
      chamberCol: pos.col,
      chamberAngle: pos.angle,
      x: pos.x,
      y: pos.y,
    } as Seat;
  }

  // Step 6: Distribute seats among players (round-robin over shuffled IDs)
  distributeSeatsToPlayers(seats, playerIds, rng);

  return seats;
}

// ============================================================
// CHAMBER POSITION COMPUTATION
// ============================================================

/**
 * Pre-compute all 151 chamber positions in the hemicycle, sorted from
 * leftmost (angle -145) to rightmost (angle +145).
 *
 * Each row has a different seat count and radius, but the angular range
 * is the same for all rows. We compute every position, then sort by a
 * normalized arc fraction so that positions at similar angles (but
 * different rows) are adjacent -- giving radial "columns" of seats.
 */
function computeChamberPositions(): ChamberPosition[] {
  const positions: ChamberPosition[] = [];

  for (let row = 0; row < SEATS_PER_ROW.length; row++) {
    const n = SEATS_PER_ROW[row];
    const radius = ROW_RADII[row];

    for (let col = 0; col < n; col++) {
      // Evenly space seats across the arc
      const angleDeg = ARC_START_DEG + col * (ARC_SPAN_DEG / (n - 1));
      const angleRad = angleDeg * Math.PI / 180;

      // SVG coordinates (0 degrees = straight up, positive = clockwise)
      const x = CHAMBER_CX + radius * Math.sin(angleRad);
      const y = CHAMBER_CY - radius * Math.cos(angleRad);

      // Normalized position along the arc (0 = left, 1 = right)
      const normalizedPos = (angleDeg - ARC_START_DEG) / ARC_SPAN_DEG;

      positions.push({
        row,
        col,
        angle: Math.round(angleDeg * 100) / 100, // clean up floating point
        normalizedPos,
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
      });
    }
  }

  // Sort all positions by normalized arc position so seats at similar angles
  // (across different rows) are adjacent. This produces a left-to-right sweep,
  // which means assigning state-ordered seats fills angular wedges.
  positions.sort((a, b) => a.normalizedPos - b.normalizedPos || a.row - b.row);

  return positions;
}

// ============================================================
// SEAT ALLOCATION
// ============================================================

/**
 * Allocate seats to states based on STATE_PROPORTIONS.
 * Every state gets at least 1 seat; remaining seats go to the largest states.
 */
function allocateSeatsToStates(totalSeats: number): Record<StateCode, number> {
  const states: StateCode[] = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
  const allocation: Record<StateCode, number> = {} as Record<StateCode, number>;

  let remaining = totalSeats;

  // Guarantee each state at least 1 seat
  for (const state of states) {
    allocation[state] = 1;
    remaining--;
  }

  // Distribute proportionally
  for (const state of states) {
    const additional = Math.floor((totalSeats - states.length) * STATE_PROPORTIONS[state]);
    allocation[state] += additional;
    remaining -= additional;
  }

  // Hand out any leftover seats to the largest states
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

/**
 * Get a unique division name for a seat. Uses real division names first,
 * falling back to generated names (e.g. "NSW North") if exhausted.
 */
function getUniqueName(
  state: StateCode,
  availableNames: string[],
  usedNames: Set<string>,
  index: number,
  _rng: SeededRNG
): string {
  // Pop from shuffled real names
  while (availableNames.length > 0) {
    const name = availableNames.pop()!;
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }

  // Fallback: state + suffix + optional number
  const suffix = FALLBACK_SUFFIXES[index % FALLBACK_SUFFIXES.length];
  const num = Math.floor(index / FALLBACK_SUFFIXES.length) + 1;
  const fallbackName = num > 1 ? `${state} ${suffix} ${num}` : `${state} ${suffix}`;
  usedNames.add(fallbackName);
  return fallbackName;
}

// ============================================================
// IDEOLOGY GENERATION
// ============================================================

/**
 * Generate random ideology for a seat, biased by state tendencies.
 */
function generateRandomIdeology(state: StateCode, rng: SeededRNG): SeatIdeology {
  const econBias = STATE_ECON_BIAS[state];
  const socialBias = STATE_SOCIAL_BIAS[state];

  // Range roughly -1 to 1, centered on 0 plus state bias
  const econValue = (rng.random() - 0.5) * 2 + econBias;
  const socialValue = (rng.random() - 0.5) * 2 + socialBias;

  const econ: EconBucket = econValue < -0.33 ? 'LEFT' : econValue > 0.33 ? 'RIGHT' : 'CENTER';
  const social: SocialBucket = socialValue < -0.33 ? 'CONS' : socialValue > 0.33 ? 'PROG' : 'CENTER';

  return { econ, social };
}

/**
 * Generate realistic ideology based on actual Australian voting patterns.
 * Uses the seat's division name to look up known inner-city, rural,
 * resource, and industrial classifications.
 */
function generateRealisticIdeology(
  state: StateCode,
  name: string,
  rng: SeededRNG
): SeatIdeology {
  let econScore = 0;    // negative = RIGHT, positive = LEFT
  let socialScore = 0;  // negative = CONS, positive = PROG

  // Base state biases
  econScore += STATE_ECON_BIAS[state];
  socialScore += STATE_SOCIAL_BIAS[state];

  // Inner city: more progressive socially, slightly left economically
  if (INNER_CITY_SEATS.has(name)) {
    socialScore += 0.5;
    econScore += 0.1;
  }

  // Rural/regional: more conservative
  if (RURAL_REGIONAL_SEATS.has(name)) {
    socialScore -= 0.4;
    econScore -= 0.1;
  }

  // Resource/mining seats: right economically, often conservative
  if (RESOURCE_SEATS.has(name)) {
    econScore -= 0.4;
    socialScore -= 0.2;
  }

  // Industrial/working class: left economically, slightly progressive
  if (INDUSTRIAL_SEATS.has(name)) {
    econScore += 0.3;
    socialScore += 0.1;
  }

  // Small random variation
  econScore += (rng.random() - 0.5) * 0.3;
  socialScore += (rng.random() - 0.5) * 0.3;

  // Clamp to [-1, 1]
  econScore = Math.max(-1, Math.min(1, econScore));
  socialScore = Math.max(-1, Math.min(1, socialScore));

  const econ: EconBucket = econScore < -0.2 ? 'RIGHT' : econScore > 0.2 ? 'LEFT' : 'CENTER';
  const social: SocialBucket = socialScore < -0.2 ? 'CONS' : socialScore > 0.2 ? 'PROG' : 'CENTER';

  return { econ, social };
}

// ============================================================
// SEAT DISTRIBUTION
// ============================================================

/**
 * Distribute seats evenly among players using round-robin
 * over a shuffled seat list.
 */
function distributeSeatsToPlayers(
  seats: Record<SeatId, Seat>,
  playerIds: string[],
  rng: SeededRNG
): void {
  if (playerIds.length === 0) return;

  const seatIds = rng.shuffle(Object.keys(seats));

  seatIds.forEach((seatId, index) => {
    const playerIndex = index % playerIds.length;
    seats[seatId].ownerPlayerId = playerIds[playerIndex];
  });
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Compute seat counts per player from the seat map.
 */
export function computePlayerSeatCounts(seats: Record<SeatId, Seat>): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const seat of Object.values(seats)) {
    if (seat.ownerPlayerId) {
      counts[seat.ownerPlayerId] = (counts[seat.ownerPlayerId] || 0) + 1;
    }
  }

  return counts;
}

/**
 * Get all seats owned by a specific player.
 */
export function getPlayerSeats(seats: Record<SeatId, Seat>, playerId: string): Seat[] {
  return Object.values(seats).filter(s => s.ownerPlayerId === playerId);
}

/**
 * Get opponent-owned seats matching a given ideology criterion.
 * Used when resolving campaign/policy effects that target specific ideology buckets.
 */
export function getEligibleSeatsForCapture(
  seats: Record<SeatId, Seat>,
  actorId: string,
  ideologyAxis: 'econ' | 'social',
  ideologyBucket: EconBucket | SocialBucket
): SeatId[] {
  const eligible: SeatId[] = [];

  for (const [seatId, seat] of Object.entries(seats)) {
    // Must be owned by someone other than the actor
    if (!seat.ownerPlayerId || seat.ownerPlayerId === actorId) continue;

    if (ideologyAxis === 'econ' && seat.ideology.econ === ideologyBucket) {
      eligible.push(seatId);
    } else if (ideologyAxis === 'social' && seat.ideology.social === ideologyBucket) {
      eligible.push(seatId);
    }
  }

  return eligible;
}

/**
 * Transfer seat ownership to a new player.
 * Returns true if the seat existed and was transferred.
 */
export function transferSeat(seats: Record<SeatId, Seat>, seatId: SeatId, newOwnerId: string): boolean {
  const seat = seats[seatId];
  if (!seat) return false;

  seat.ownerPlayerId = newOwnerId;
  return true;
}

/**
 * Derive ideology axis and bucket from a campaign card's stance table.
 * Used when determining which seats a card can target.
 */
export function deriveIdeologyFromCard(card: {
  stanceTable?: {
    progressive: string;
    conservative: string;
    market: string;
    interventionist: string;
  };
  ideology?: {
    econ?: EconBucket;
    social?: SocialBucket;
  };
}): { axis: 'econ' | 'social'; bucket: EconBucket | SocialBucket } | null {
  // If explicit ideology is set, use it
  if (card.ideology) {
    if (card.ideology.econ) {
      return { axis: 'econ', bucket: card.ideology.econ };
    }
    if (card.ideology.social) {
      return { axis: 'social', bucket: card.ideology.social };
    }
  }

  // Derive from stance table
  if (!card.stanceTable) {
    return { axis: 'econ', bucket: 'CENTER' };
  }

  const st = card.stanceTable;

  // Economic axis
  if (st.market === 'favoured' && st.interventionist === 'opposed') {
    return { axis: 'econ', bucket: 'RIGHT' };
  }
  if (st.interventionist === 'favoured' && st.market === 'opposed') {
    return { axis: 'econ', bucket: 'LEFT' };
  }

  // Social axis
  if (st.progressive === 'favoured' && st.conservative === 'opposed') {
    return { axis: 'social', bucket: 'PROG' };
  }
  if (st.conservative === 'favoured' && st.progressive === 'opposed') {
    return { axis: 'social', bucket: 'CONS' };
  }

  // Mixed/neutral defaults to center on economic axis
  return { axis: 'econ', bucket: 'CENTER' };
}

// ============================================================
// STATE CONTROL FUNCTIONS
// ============================================================

const ALL_STATES: StateCode[] = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

/**
 * Compute state control for all states.
 * A player controls a state if they hold a strict majority (> 50%) of its seats
 * and are not tied with another player.
 */
export function computeStateControl(seats: Record<SeatId, Seat>): Record<StateCode, StateControl> {
  const stateControl: Record<StateCode, StateControl> = {} as Record<StateCode, StateControl>;

  // Initialize
  for (const state of ALL_STATES) {
    stateControl[state] = {
      state,
      controllerId: null,
      seatCount: 0,
      totalSeats: 0,
    };
  }

  // Count seats per player within each state
  const stateSeatsByPlayer: Record<StateCode, Record<string, number>> = {} as Record<StateCode, Record<string, number>>;
  for (const state of ALL_STATES) {
    stateSeatsByPlayer[state] = {};
  }

  for (const seat of Object.values(seats)) {
    stateControl[seat.state].totalSeats++;

    if (seat.ownerPlayerId) {
      if (!stateSeatsByPlayer[seat.state][seat.ownerPlayerId]) {
        stateSeatsByPlayer[seat.state][seat.ownerPlayerId] = 0;
      }
      stateSeatsByPlayer[seat.state][seat.ownerPlayerId]++;
    }
  }

  // Determine controller: must have strict majority and not be tied
  for (const state of ALL_STATES) {
    const total = stateControl[state].totalSeats;
    const majorityThreshold = Math.floor(total / 2) + 1;

    let maxSeats = 0;
    let controllerId: string | null = null;
    let isTied = false;

    for (const [playerId, count] of Object.entries(stateSeatsByPlayer[state])) {
      if (count > maxSeats) {
        maxSeats = count;
        controllerId = playerId;
        isTied = false;
      } else if (count === maxSeats) {
        isTied = true;
      }
    }

    if (maxSeats >= majorityThreshold && !isTied) {
      stateControl[state].controllerId = controllerId;
      stateControl[state].seatCount = maxSeats;
    }
  }

  return stateControl;
}

/**
 * Get the states controlled by a specific player.
 */
export function getPlayerControlledStates(
  stateControl: Record<StateCode, StateControl>,
  playerId: string
): StateCode[] {
  return ALL_STATES.filter(state => stateControl[state].controllerId === playerId);
}

/**
 * Compare old and new state control to find changes.
 * Returns lists of states gained and lost by each player.
 */
export function compareStateControl(
  oldControl: Record<StateCode, StateControl>,
  newControl: Record<StateCode, StateControl>
): { gained: { playerId: string; state: StateCode }[]; lost: { playerId: string; state: StateCode }[] } {
  const gained: { playerId: string; state: StateCode }[] = [];
  const lost: { playerId: string; state: StateCode }[] = [];

  for (const state of ALL_STATES) {
    const oldControllerId = oldControl[state]?.controllerId;
    const newControllerId = newControl[state]?.controllerId;

    if (oldControllerId !== newControllerId) {
      if (oldControllerId) {
        lost.push({ playerId: oldControllerId, state });
      }
      if (newControllerId) {
        gained.push({ playerId: newControllerId, state });
      }
    }
  }

  return { gained, lost };
}

/**
 * Get seat counts by player for a specific state.
 */
export function getStateSeatsByPlayer(
  seats: Record<SeatId, Seat>,
  state: StateCode
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const seat of Object.values(seats)) {
    if (seat.state === state && seat.ownerPlayerId) {
      counts[seat.ownerPlayerId] = (counts[seat.ownerPlayerId] || 0) + 1;
    }
  }

  return counts;
}
