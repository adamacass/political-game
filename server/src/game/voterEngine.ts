// ============================================================
// THE HOUSE - Australian Political Strategy Game
// VoterEngine: Demographic voter model & satisfaction dynamics
// ============================================================

import { SeededRNG } from './rng';

// ============================================================
// INTERFACES
// ============================================================

export interface VoterGroup {
  id: string;
  name: string;
  population: number;
  baseTurnout: number;
  priorities: Record<string, number>;
  socialPosition: number;
  economicPosition: number;
  volatility: number;
  partisanship: number;
  currentSatisfaction: number;
  satisfactionHistory: number[];
}

export interface PartyProfile {
  id: string;
  socialPosition: number;
  economicPosition: number;
  isGovernment: boolean;
  isMainOpposition: boolean;
  seatShare: number;
}

export interface VoterGroupSummary {
  id: string;
  name: string;
  population: number;
  satisfaction: number;
  topConcerns: { variable: string; satisfaction: number }[];
  leaningPartyId: string | null;
}

// ============================================================
// UTILITY THRESHOLDS
// Piecewise linear mapping from raw economic value to 0-100.
// "bad" maps to 0, "good" maps to 100, linearly interpolated.
// Inverted variables (unemployment, inflation) have bad > good
// numerically, so the mapping reverses direction.
// ============================================================

interface UtilityBand {
  bad: number;
  good: number;
}

const UTILITY_BANDS: Record<string, UtilityBand> = {
  // Core macro indicators
  gdpGrowth:          { bad: -2,  good: 5   },
  unemployment:       { bad: 15,  good: 3   }, // inverted
  inflation:          { bad: 10,  good: 1   }, // inverted

  // Confidence indices (0-100 scale)
  consumerConfidence: { bad: 20,  good: 80  },
  businessConfidence: { bad: 20,  good: 80  },

  // Sector health (0-100 scale)
  healthcare:         { bad: 20,  good: 80  },
  education:          { bad: 20,  good: 80  },
  housing:            { bad: 20,  good: 80  },
  manufacturing:      { bad: 20,  good: 80  },
  services:           { bad: 20,  good: 80  },
  technology:         { bad: 20,  good: 80  },
  finance:            { bad: 20,  good: 80  },
  agriculture:        { bad: 20,  good: 80  },
  energy:             { bad: 20,  good: 80  },

  // Fiscal
  budgetBalance:      { bad: -6,  good: 2   },
};

// ============================================================
// DEFAULT AUSTRALIAN VOTER GROUPS
// ============================================================

export function getDefaultVoterGroups(): VoterGroup[] {
  return [
    {
      id: 'working_class',
      name: 'Working Class',
      population: 0.22,
      baseTurnout: 0.82,
      priorities: {
        unemployment: 0.30,
        inflation: 0.25,
        housing: 0.20,
        manufacturing: 0.15,
        healthcare: 0.10,
      },
      socialPosition: -0.1,
      economicPosition: 0.3,
      volatility: 0.35,
      partisanship: 0.35,
      currentSatisfaction: 50,
      satisfactionHistory: [],
    },
    {
      id: 'suburban_families',
      name: 'Suburban Families',
      population: 0.25,
      baseTurnout: 0.85,
      priorities: {
        housing: 0.30,
        education: 0.20,
        healthcare: 0.20,
        inflation: 0.15,
        services: 0.15,
      },
      socialPosition: 0.0,
      economicPosition: 0.0,
      volatility: 0.25,
      partisanship: 0.25,
      currentSatisfaction: 50,
      satisfactionHistory: [],
    },
    {
      id: 'urban_professionals',
      name: 'Urban Professionals',
      population: 0.18,
      baseTurnout: 0.80,
      priorities: {
        gdpGrowth: 0.25,
        technology: 0.20,
        services: 0.20,
        housing: 0.20,
        education: 0.15,
      },
      socialPosition: 0.4,
      economicPosition: -0.1,
      volatility: 0.30,
      partisanship: 0.20,
      currentSatisfaction: 50,
      satisfactionHistory: [],
    },
    {
      id: 'retirees',
      name: 'Retirees',
      population: 0.15,
      baseTurnout: 0.90,
      priorities: {
        healthcare: 0.30,
        inflation: 0.25,
        consumerConfidence: 0.20,
        finance: 0.15,
        services: 0.10,
      },
      socialPosition: -0.3,
      economicPosition: 0.1,
      volatility: 0.20,
      partisanship: 0.50,
      currentSatisfaction: 50,
      satisfactionHistory: [],
    },
    {
      id: 'business_owners',
      name: 'Business Owners',
      population: 0.08,
      baseTurnout: 0.88,
      priorities: {
        gdpGrowth: 0.25,
        businessConfidence: 0.25,
        finance: 0.20,
        technology: 0.15,
        unemployment: 0.15,
      },
      socialPosition: -0.1,
      economicPosition: -0.5,
      volatility: 0.25,
      partisanship: 0.30,
      currentSatisfaction: 50,
      satisfactionHistory: [],
    },
    {
      id: 'rural_regional',
      name: 'Rural & Regional',
      population: 0.07,
      baseTurnout: 0.78,
      priorities: {
        agriculture: 0.25,
        manufacturing: 0.20,
        unemployment: 0.20,
        energy: 0.15,
        housing: 0.20,
      },
      socialPosition: -0.4,
      economicPosition: 0.2,
      volatility: 0.20,
      partisanship: 0.45,
      currentSatisfaction: 50,
      satisfactionHistory: [],
    },
    {
      id: 'young_voters',
      name: 'Young Voters',
      population: 0.03,
      baseTurnout: 0.65,
      priorities: {
        housing: 0.30,
        education: 0.25,
        gdpGrowth: 0.20,
        technology: 0.15,
        services: 0.10,
      },
      socialPosition: 0.5,
      economicPosition: 0.2,
      volatility: 0.40,
      partisanship: 0.15,
      currentSatisfaction: 50,
      satisfactionHistory: [],
    },
    {
      id: 'public_sector',
      name: 'Public Sector Workers',
      population: 0.02,
      baseTurnout: 0.87,
      priorities: {
        education: 0.25,
        healthcare: 0.25,
        unemployment: 0.20,
        services: 0.20,
        budgetBalance: 0.10,
      },
      socialPosition: 0.3,
      economicPosition: 0.4,
      volatility: 0.25,
      partisanship: 0.35,
      currentSatisfaction: 50,
      satisfactionHistory: [],
    },
  ];
}

// ============================================================
// UTILITY HELPERS
// ============================================================

/**
 * Piecewise linear utility: maps a raw economic value to 0-100.
 * Handles both normal (bad < good) and inverted (bad > good) variables.
 * Values beyond the bad/good thresholds are clamped to 0 or 100.
 */
function computeUtility(value: number, band: UtilityBand): number {
  const { bad, good } = band;

  if (bad === good) return 50;

  // Normalise to 0-1 range where bad->0 and good->1
  const t = (value - bad) / (good - bad);
  return clamp(t * 100, 0, 100);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ============================================================
// VOTE CHOICE CONSTANTS
// ============================================================

/** Temperature for multinomial logit softmax */
const LOGIT_TEMPERATURE = 0.3;

/** Small incumbency bonus/penalty coefficient */
const INCUMBENCY_WEIGHT = 0.1;

// ============================================================
// VOTER ENGINE
// ============================================================

export class VoterEngine {
  private groups: VoterGroup[];
  private rng: SeededRNG;

  constructor(seed?: string) {
    this.rng = new SeededRNG(seed);
    this.groups = getDefaultVoterGroups();
  }

  // ----------------------------------------------------------
  // Accessors
  // ----------------------------------------------------------

  getGroups(): VoterGroup[] {
    return this.groups.map((g) => ({ ...g, satisfactionHistory: [...g.satisfactionHistory] }));
  }

  getGroupSummaries(): VoterGroupSummary[] {
    return this.groups.map((g) => {
      // Build per-variable satisfaction for this group's priorities
      const concerns = Object.entries(g.priorities)
        .map(([variable, weight]) => ({
          variable,
          satisfaction: g.currentSatisfaction * weight, // approximate per-variable
          weight,
        }))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 3)
        .map(({ variable, satisfaction }) => ({ variable, satisfaction }));

      return {
        id: g.id,
        name: g.name,
        population: g.population,
        satisfaction: g.currentSatisfaction,
        topConcerns: concerns,
        leaningPartyId: null, // filled in when parties are known
      };
    });
  }

  // ----------------------------------------------------------
  // Satisfaction Dynamics
  // ----------------------------------------------------------

  /**
   * Update every voter group's satisfaction based on current economic
   * conditions. Uses momentum smoothing so groups with low volatility
   * change opinion slowly, while volatile groups react fast.
   *
   * @param economicValues Flat record: variable name -> current value.
   *   e.g. { gdpGrowth: 2.5, unemployment: 5.2, inflation: 3.1, ... }
   */
  updateSatisfaction(economicValues: Record<string, number>): void {
    for (const group of this.groups) {
      const rawSatisfaction = this.computeRawSatisfaction(group, economicValues);

      // Momentum: S(t) = λ × S_raw + (1 - λ) × S(t-1)
      const lambda = group.volatility;
      const smoothed = lambda * rawSatisfaction + (1 - lambda) * group.currentSatisfaction;

      // Add a tiny bit of noise so identical conditions don't produce
      // perfectly static numbers (feels more alive in-game)
      const noise = (this.rng.random() - 0.5) * 2; // ±1 point
      const final = clamp(Math.round((smoothed + noise) * 10) / 10, 0, 100);

      group.satisfactionHistory.push(group.currentSatisfaction);
      group.currentSatisfaction = final;
    }
  }

  /**
   * Raw (instantaneous) satisfaction for a group, before momentum.
   * Satisfaction = Σ priority_weight × utility(variable)
   */
  private computeRawSatisfaction(
    group: VoterGroup,
    economicValues: Record<string, number>,
  ): number {
    let total = 0;
    let weightSum = 0;

    for (const [variable, weight] of Object.entries(group.priorities)) {
      const value = economicValues[variable];
      if (value === undefined) continue;

      const band = UTILITY_BANDS[variable];
      if (!band) continue;

      const utility = computeUtility(value, band);
      total += weight * utility;
      weightSum += weight;
    }

    // If we had data for at least some priorities, normalise.
    // Otherwise hold at 50 (neutral).
    if (weightSum > 0) {
      return total / weightSum;
    }
    return 50;
  }

  // ----------------------------------------------------------
  // Vote Choice Model
  // ----------------------------------------------------------

  /**
   * For each voter group, compute vote share for every party via
   * multinomial logit over party utilities.
   *
   * Returns: { [partyId]: { [groupId]: voteShare } }
   * where voteShare is 0-1 within each group (shares sum to 1).
   */
  calculateVoteShares(parties: PartyProfile[]): Record<string, Record<string, number>> {
    if (parties.length === 0) return {};

    const result: Record<string, Record<string, number>> = {};
    for (const party of parties) {
      result[party.id] = {};
    }

    for (const group of this.groups) {
      // Compute raw utility for each party
      const utilities: number[] = parties.map((party) =>
        this.computePartyUtility(group, party),
      );

      // Multinomial logit (softmax with temperature)
      const shares = softmax(utilities, LOGIT_TEMPERATURE);

      for (let i = 0; i < parties.length; i++) {
        result[parties[i].id][group.id] = shares[i];
      }
    }

    return result;
  }

  /**
   * Party utility from the perspective of a voter group.
   *
   * U(v,p) = α × IdeologyMatch + β × PerformanceCredit + γ × Incumbency + ε
   *
   * α = partisanship  (how much ideology matters)
   * β = 1 - partisanship  (how much performance matters)
   * γ = 0.1  (small incumbency factor)
   * ε = small random noise for variety
   */
  private computePartyUtility(group: VoterGroup, party: PartyProfile): number {
    const alpha = group.partisanship;
    const beta = 1 - group.partisanship;
    const gamma = INCUMBENCY_WEIGHT;

    // Ideology match: 1 - (|social_diff| + |economic_diff|) / 4
    // This gives 1.0 for perfect alignment, 0.0 for max distance
    const socialDist = Math.abs(group.socialPosition - party.socialPosition);
    const econDist = Math.abs(group.economicPosition - party.economicPosition);
    const ideologyMatch = 1 - (socialDist + econDist) / 4;

    // Performance credit
    let performanceCredit: number;
    if (party.isGovernment) {
      // Government is judged on actual satisfaction
      performanceCredit = group.currentSatisfaction / 100;
    } else if (party.isMainOpposition) {
      // Opposition benefits from dissatisfaction
      performanceCredit = (100 - group.currentSatisfaction) / 100;
    } else {
      // Minor parties / crossbench get a neutral read
      performanceCredit = 0.5;
    }

    // Incumbency: governing parties get a small bonus from seat share
    // (reflects name recognition & institutional advantage)
    const incumbency = party.isGovernment ? party.seatShare : 0;

    // Small noise so results aren't perfectly deterministic
    const noise = (this.rng.random() - 0.5) * 0.05;

    return alpha * ideologyMatch + beta * performanceCredit + gamma * incumbency + noise;
  }

  // ----------------------------------------------------------
  // Aggregate Indicators
  // ----------------------------------------------------------

  /**
   * Population-weighted national satisfaction average.
   */
  getNationalSatisfaction(): number {
    let weighted = 0;
    let totalPop = 0;
    for (const group of this.groups) {
      weighted += group.currentSatisfaction * group.population;
      totalPop += group.population;
    }
    if (totalPop === 0) return 50;
    return Math.round((weighted / totalPop) * 10) / 10;
  }

  /**
   * Rough swing prediction: estimates how vote share is shifting
   * based on current voter mood. Returns a delta for each party
   * (positive = gaining, negative = losing) that sums to ~0.
   *
   * Useful for the UI to show momentum arrows or seat predictions.
   *
   * Returns: { [partyId]: swingDelta } where delta is in percentage
   * points (e.g. +2.5 means gaining ~2.5% of the two-party vote).
   */
  getSwingPrediction(parties: PartyProfile[]): Record<string, number> {
    if (parties.length === 0) return {};

    const voteShares = this.calculateVoteShares(parties);
    const swings: Record<string, number> = {};

    for (const party of parties) {
      // Aggregate vote share across all groups, weighted by population
      // and turnout
      let totalVote = 0;
      let totalWeight = 0;

      for (const group of this.groups) {
        const weight = group.population * group.baseTurnout;
        const share = voteShares[party.id][group.id] ?? 0;
        totalVote += share * weight;
        totalWeight += weight;
      }

      const effectiveShare = totalWeight > 0 ? totalVote / totalWeight : 0;

      // Swing = deviation from the party's current seat share.
      // Positive means outperforming their current position.
      const swing = (effectiveShare - party.seatShare) * 100;
      swings[party.id] = Math.round(swing * 10) / 10;
    }

    return swings;
  }
}

// ============================================================
// MATH HELPERS
// ============================================================

/**
 * Softmax with temperature parameter.
 * Lower temperature -> more decisive (winner-take-all).
 * Higher temperature -> more uniform distribution.
 */
function softmax(values: number[], temperature: number): number[] {
  // Shift by max for numerical stability
  const maxVal = Math.max(...values);
  const exps = values.map((v) => Math.exp((v - maxVal) / temperature));
  const sum = exps.reduce((a, b) => a + b, 0);

  if (sum === 0) {
    // Degenerate case: return uniform
    return values.map(() => 1 / values.length);
  }

  return exps.map((e) => e / sum);
}
