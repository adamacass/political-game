/**
 * Australian Electoral Map Generator
 *
 * Generates a set of seats distributed across Australian states,
 * with coordinates for SVG rendering, ideology ratings, and ownership.
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
  WA: 0.11,   // ~16 seats
  SA: 0.07,   // ~10 seats
  TAS: 0.03,   // ~5 seats
  ACT: 0.01,   // ~2 seats
  NT: 0.01,   // ~2 seats
};

// ============================================================
// STATE BOUNDING BOXES (for SVG viewBox 0-100)
// Simplified Australia silhouette regions
// ============================================================

interface BoundingBox {
  x: number;     // Left
  y: number;     // Top
  width: number;
  height: number;
}

// State bounding boxes aligned with AustraliaMap.tsx SVG coordinate system
// Matches simplified Australia outline (viewBox 0-100)
const STATE_BOUNDS: Record<StateCode, BoundingBox> = {
  WA:  { x: 12, y: 20, width: 24, height: 46 },  // Western third
  NT:  { x: 40, y: 18, width: 20, height: 26 },  // Top center
  SA:  { x: 40, y: 48, width: 20, height: 18 },  // Center-south
  QLD: { x: 64, y: 22, width: 24, height: 26 },  // Northeast
  NSW: { x: 66, y: 52, width: 20, height: 12 },  // Southeast coast
  VIC: { x: 60, y: 63, width: 14, height: 6 },   // Bottom right corner
  TAS: { x: 73, y: 77, width: 12, height: 12 },  // Island south of VIC
  ACT: { x: 78, y: 58, width: 6,  height: 5 },   // Small region in NSW
};

// State ideology biases (subtle flavor)
const STATE_ECON_BIAS: Record<StateCode, number> = {
  NSW: 0,      // Balanced
  VIC: 0.1,    // Slightly left
  QLD: -0.1,   // Slightly right
  WA: -0.15,   // Mining state, slightly right
  SA: 0.05,    // Slightly left
  TAS: 0.1,    // Left leaning
  ACT: 0.2,    // Public service, left
  NT: -0.05,   // Slightly right
};

const STATE_SOCIAL_BIAS: Record<StateCode, number> = {
  NSW: 0,
  VIC: 0.15,   // Progressive
  QLD: -0.1,   // Conservative
  WA: -0.05,
  SA: 0.05,
  TAS: 0.1,
  ACT: 0.2,    // Progressive
  NT: -0.1,
};

// ============================================================
// MAIN GENERATOR FUNCTION
// ============================================================

export interface MapGenConfig {
  seatCount: number;
  seed: string;
  playerIds: string[];
  ideologyMode: 'random' | 'realistic';  // Seat ideology distribution mode
}

export function generateSeatMap(config: MapGenConfig): Record<SeatId, Seat> {
  const { seatCount, seed, playerIds, ideologyMode } = config;
  const rng = new SeededRNG(seed);
  const seats: Record<SeatId, Seat> = {};

  // Calculate seats per state
  const stateAllocation = allocateSeatsToStates(seatCount);

  // Track used names per state
  const usedNames: Record<StateCode, Set<string>> = {
    NSW: new Set(), VIC: new Set(), QLD: new Set(), WA: new Set(),
    SA: new Set(), TAS: new Set(), ACT: new Set(), NT: new Set(),
  };

  // Track placed positions for overlap avoidance
  const placedPositions: { x: number; y: number }[] = [];

  let seatIndex = 0;

  for (const [state, count] of Object.entries(stateAllocation) as [StateCode, number][]) {
    const bounds = STATE_BOUNDS[state];
    const availableNames = [...DIVISION_NAMES[state]];
    rng.shuffle(availableNames);

    for (let i = 0; i < count; i++) {
      const seatId = `seat_${seatIndex.toString().padStart(3, '0')}`;

      // Get name (real division or generated fallback)
      const name = getUniqueName(state, availableNames, usedNames[state], i, rng);

      // Generate position with collision avoidance
      const pos = generatePosition(bounds, placedPositions, rng);
      placedPositions.push(pos);

      // Generate ideology based on mode
      const ideology = ideologyMode === 'realistic'
        ? generateRealisticIdeology(state, name, pos, rng)
        : generateIdeology(state, rng);

      seats[seatId] = {
        id: seatId,
        name,
        state,
        x: pos.x,
        y: pos.y,
        ideology,
        ownerPlayerId: null,  // Will be assigned in distributeSeats
      };

      seatIndex++;
    }
  }

  // Distribute seats among players
  distributeSeatsToPlayers(seats, playerIds, rng);

  return seats;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function allocateSeatsToStates(totalSeats: number): Record<StateCode, number> {
  const states: StateCode[] = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
  const allocation: Record<StateCode, number> = {} as Record<StateCode, number>;

  let remaining = totalSeats;

  // Ensure each state gets at least 1 seat
  for (const state of states) {
    allocation[state] = 1;
    remaining--;
  }

  // Distribute remaining seats proportionally
  for (const state of states) {
    const proportion = STATE_PROPORTIONS[state];
    const additional = Math.floor((totalSeats - 8) * proportion);
    allocation[state] += additional;
    remaining -= additional;
  }

  // Distribute any remaining seats to largest states
  const largestFirst: StateCode[] = ['NSW', 'VIC', 'QLD', 'WA', 'SA'];
  let i = 0;
  while (remaining > 0) {
    allocation[largestFirst[i % largestFirst.length]]++;
    remaining--;
    i++;
  }

  return allocation;
}

function getUniqueName(
  state: StateCode,
  availableNames: string[],
  usedNames: Set<string>,
  index: number,
  rng: SeededRNG
): string {
  // Try to use a real division name first
  while (availableNames.length > 0) {
    const name = availableNames.pop()!;
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }

  // Fallback: generate name from state + suffix + number
  const suffix = FALLBACK_SUFFIXES[index % FALLBACK_SUFFIXES.length];
  const num = Math.floor(index / FALLBACK_SUFFIXES.length) + 1;
  const fallbackName = num > 1 ? `${state} ${suffix} ${num}` : `${state} ${suffix}`;
  usedNames.add(fallbackName);
  return fallbackName;
}

function generatePosition(
  bounds: BoundingBox,
  existing: { x: number; y: number }[],
  rng: SeededRNG
): { x: number; y: number } {
  const minDist = 2.5;  // Minimum distance between seats
  const maxAttempts = 50;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const x = bounds.x + rng.random() * bounds.width;
    const y = bounds.y + rng.random() * bounds.height;

    // Check distance from existing points
    let valid = true;
    for (const pos of existing) {
      const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
      if (dist < minDist) {
        valid = false;
        break;
      }
    }

    if (valid) {
      return { x, y };
    }
  }

  // If we couldn't find a non-overlapping position, use jittered position
  const x = bounds.x + rng.random() * bounds.width;
  const y = bounds.y + rng.random() * bounds.height;
  const jitterX = (rng.random() - 0.5) * 1.5;
  const jitterY = (rng.random() - 0.5) * 1.5;
  return { x: x + jitterX, y: y + jitterY };
}

function generateIdeology(state: StateCode, rng: SeededRNG): SeatIdeology {
  const econBias = STATE_ECON_BIAS[state];
  const socialBias = STATE_SOCIAL_BIAS[state];

  // Generate with slight center bias and state bias
  // Range: -1 to 1, with 0 being center
  const econValue = (rng.random() - 0.5) * 2 + econBias;
  const socialValue = (rng.random() - 0.5) * 2 + socialBias;

  // Convert to buckets
  const econ: EconBucket = econValue < -0.33 ? 'LEFT' : econValue > 0.33 ? 'RIGHT' : 'CENTER';
  const social: SocialBucket = socialValue < -0.33 ? 'CONS' : socialValue > 0.33 ? 'PROG' : 'CENTER';

  return { econ, social };
}

// Known inner-city progressive seats (simplified patterns based on real voting)
const INNER_CITY_SEATS = new Set([
  'Sydney', 'Melbourne', 'Brisbane', 'Grayndler', 'Wills', 'Melbourne Ports',
  'Griffith', 'Perth', 'Higgins', 'Kooyong', 'Ryan', 'Adelaide',
  'Cooper', 'Wentworth', 'North Sydney', 'Warringah', 'Canberra', 'Bean', 'Fenner',
  'Maribyrnong', 'Gellibrand', 'Fremantle', 'Curtin', 'Swan', 'Hindmarsh',
]);

// Rural/regional conservative seats
const RURAL_REGIONAL_SEATS = new Set([
  'Kennedy', 'Maranoa', 'Flynn', 'Dawson', 'Capricornia', 'Hinkler',
  'O\'Connor', 'Durack', 'Forrest', 'Grey', 'Barker', 'Farrer', 'Riverina',
  'Parkes', 'New England', 'Lyne', 'Cowper', 'Page', 'Gippsland', 'Murray',
  'Mallee', 'Nicholls', 'Indi', 'Wannon', 'Braddon', 'Lyons', 'Bass',
  'Lingiari', 'Wide Bay', 'Calare', 'Hunter',
]);

// Mining/resource-heavy seats (economically right-leaning)
const RESOURCE_SEATS = new Set([
  'Durack', 'O\'Connor', 'Forrest', 'Grey', 'Capricornia', 'Flynn',
  'Dawson', 'Herbert', 'Kennedy', 'Maranoa', 'Lingiari', 'Solomon',
]);

// Working-class/industrial seats (economically left-leaning)
const INDUSTRIAL_SEATS = new Set([
  'Blaxland', 'Watson', 'Fowler', 'McMahon', 'Chifley', 'Werriwa',
  'Shortland', 'Newcastle', 'Cunningham', 'Bruce', 'Holt', 'Isaacs',
  'Scullin', 'Calwell', 'Lalor', 'Gorton', 'Oxley', 'Rankin', 'Forde',
  'Blair', 'Longman', 'Bonner', 'Moreton', 'Brand', 'Canning', 'Burt',
  'Stirling', 'Moore', 'Cowan', 'Pearce', 'Hasluck', 'Kingston', 'Wakefield',
  'Spence', 'Makin', 'Franklin', 'Denison', 'Clark',
]);

/**
 * Generate realistic ideology based on actual Australian voting patterns
 */
function generateRealisticIdeology(
  state: StateCode,
  name: string,
  pos: { x: number; y: number },
  rng: SeededRNG
): SeatIdeology {
  let econScore = 0;    // -1 = LEFT, 0 = CENTER, 1 = RIGHT
  let socialScore = 0;  // -1 = CONS, 0 = CENTER, 1 = PROG

  // Base state biases
  econScore += STATE_ECON_BIAS[state];
  socialScore += STATE_SOCIAL_BIAS[state];

  // Inner city = more progressive socially
  if (INNER_CITY_SEATS.has(name)) {
    socialScore += 0.5;
    econScore += 0.1;  // Slightly left economically too
  }

  // Rural/regional = more conservative
  if (RURAL_REGIONAL_SEATS.has(name)) {
    socialScore -= 0.4;
    econScore -= 0.1;  // Often mixed economically (national interests)
  }

  // Resource/mining seats = right economically
  if (RESOURCE_SEATS.has(name)) {
    econScore -= 0.4;  // Pro-mining = often free market
    socialScore -= 0.2;  // Often conservative
  }

  // Industrial/working class = left economically
  if (INDUSTRIAL_SEATS.has(name)) {
    econScore += 0.3;  // Pro-union, interventionist
    socialScore += 0.1;  // Slightly progressive
  }

  // Add position-based adjustment (higher y = more south = slightly more progressive)
  // Lower y = more north (QLD, NT) = slightly more conservative
  const latitudeAdjust = (pos.y - 50) / 200;  // Small adjustment
  socialScore += latitudeAdjust;

  // Eastern seaboard cities vs inland
  // Lower x = more west = slightly more conservative economically
  if (pos.x < 40) {
    econScore -= 0.1;
  }

  // Add small random variation
  econScore += (rng.random() - 0.5) * 0.3;
  socialScore += (rng.random() - 0.5) * 0.3;

  // Convert to buckets (clamp values)
  econScore = Math.max(-1, Math.min(1, econScore));
  socialScore = Math.max(-1, Math.min(1, socialScore));

  const econ: EconBucket = econScore < -0.2 ? 'RIGHT' : econScore > 0.2 ? 'LEFT' : 'CENTER';
  const social: SocialBucket = socialScore < -0.2 ? 'CONS' : socialScore > 0.2 ? 'PROG' : 'CENTER';

  return { econ, social };
}

function distributeSeatsToPlayers(
  seats: Record<SeatId, Seat>,
  playerIds: string[],
  rng: SeededRNG
): void {
  if (playerIds.length === 0) return;

  // Shuffle seat IDs for random distribution
  const seatIds = Object.keys(seats);
  rng.shuffle(seatIds);

  // Round-robin assignment
  seatIds.forEach((seatId, index) => {
    const playerIndex = index % playerIds.length;
    seats[seatId].ownerPlayerId = playerIds[playerIndex];
  });
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Compute seat counts per player from the seat map
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
 * Get seats owned by a specific player
 */
export function getPlayerSeats(seats: Record<SeatId, Seat>, playerId: string): Seat[] {
  return Object.values(seats).filter(s => s.ownerPlayerId === playerId);
}

/**
 * Get seats matching ideology criteria owned by opponents
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

    // Must match the ideology criteria
    if (ideologyAxis === 'econ' && seat.ideology.econ === ideologyBucket) {
      eligible.push(seatId);
    } else if (ideologyAxis === 'social' && seat.ideology.social === ideologyBucket) {
      eligible.push(seatId);
    }
  }

  return eligible;
}

/**
 * Transfer seat ownership
 */
export function transferSeat(seats: Record<SeatId, Seat>, seatId: SeatId, newOwnerId: string): boolean {
  const seat = seats[seatId];
  if (!seat) return false;

  seat.ownerPlayerId = newOwnerId;
  return true;
}

/**
 * Derive ideology from campaign card stance table
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

  // Otherwise derive from stance table
  if (!card.stanceTable) {
    return { axis: 'econ', bucket: 'CENTER' };  // Default fallback
  }

  const st = card.stanceTable;

  // Check economic axis
  if (st.market === 'favoured' && st.interventionist === 'opposed') {
    return { axis: 'econ', bucket: 'RIGHT' };
  }
  if (st.interventionist === 'favoured' && st.market === 'opposed') {
    return { axis: 'econ', bucket: 'LEFT' };
  }

  // Check social axis
  if (st.progressive === 'favoured' && st.conservative === 'opposed') {
    return { axis: 'social', bucket: 'PROG' };
  }
  if (st.conservative === 'favoured' && st.progressive === 'opposed') {
    return { axis: 'social', bucket: 'CONS' };
  }

  // Mixed or neutral - default to center on economic axis
  return { axis: 'econ', bucket: 'CENTER' };
}

// ============================================================
// STATE CONTROL FUNCTIONS
// ============================================================

const ALL_STATES: StateCode[] = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

/**
 * Compute state control for all states
 * A player controls a state if they have more than half the seats in that state
 */
export function computeStateControl(seats: Record<SeatId, Seat>): Record<StateCode, StateControl> {
  const stateControl: Record<StateCode, StateControl> = {} as Record<StateCode, StateControl>;

  // Initialize all states
  for (const state of ALL_STATES) {
    stateControl[state] = {
      state,
      controllerId: null,
      seatCount: 0,
      totalSeats: 0,
    };
  }

  // Count seats per state and per player within each state
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

  // Determine controller for each state (must have strict majority)
  for (const state of ALL_STATES) {
    const total = stateControl[state].totalSeats;
    const majorityThreshold = Math.floor(total / 2) + 1;  // Strict majority

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

    // Only set controller if they have a strict majority and it's not tied
    if (maxSeats >= majorityThreshold && !isTied) {
      stateControl[state].controllerId = controllerId;
      stateControl[state].seatCount = maxSeats;
    }
  }

  return stateControl;
}

/**
 * Get the states controlled by a specific player
 */
export function getPlayerControlledStates(stateControl: Record<StateCode, StateControl>, playerId: string): StateCode[] {
  return ALL_STATES.filter(state => stateControl[state].controllerId === playerId);
}

/**
 * Compare state control between old and new to find changes
 * Returns states that changed controller (gained or lost)
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
 * Get seats count by player for a specific state
 */
export function getStateSeatsByPlayer(seats: Record<SeatId, Seat>, state: StateCode): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const seat of Object.values(seats)) {
    if (seat.state === state && seat.ownerPlayerId) {
      counts[seat.ownerPlayerId] = (counts[seat.ownerPlayerId] || 0) + 1;
    }
  }

  return counts;
}
