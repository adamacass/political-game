// ============================================================
// THE HOUSE - Economic Engine
// Models macroeconomic dynamics for the political strategy game.
// Provides GDP, unemployment, inflation, debt, confidence, and
// sector-health indicators that respond to player policy actions
// and evolve through inter-variable relationships each turn.
// ============================================================

import { SeededRNG } from './rng';

// ============================================================
// INTERFACES
// ============================================================

/** Full snapshot of the economy at a point in time. */
export interface EconomicState {
  // Primary indicators
  gdpGrowth: number;       // [-10, 15] %, equilibrium 2.5
  unemployment: number;    // [0, 30] %, equilibrium 5.0
  inflation: number;       // [-5, 30] %, equilibrium 2.0
  publicDebt: number;      // [0, 300] % of GDP, equilibrium 60
  budgetBalance: number;   // [-15, 10] % of GDP, equilibrium 0

  // Secondary indicators
  consumerConfidence: number;  // [0, 100], equilibrium 50
  businessConfidence: number;  // [0, 100], equilibrium 50
  interestRate: number;        // [0, 20] %, equilibrium 3.0

  // Sector health: each [0, 100], equilibrium 50
  sectors: Record<string, number>;
}

/** Calibration knobs exposed to the GameEngine for difficulty / scenario tuning. */
export interface EconomicCalibration {
  /** Mean-reversion speed per variable (0.05 - 0.15). */
  meanReversionAlpha: Partial<Record<EconomicVariable, number>>;
  /** Noise standard deviation per variable. */
  noiseSigma: Partial<Record<EconomicVariable, number>>;
  /** Override equilibrium values. */
  equilibrium: Partial<Record<EconomicVariable, number>>;
  /** Global multiplier on all relationship effects (default 1.0). */
  relationshipStrength: number;
  /** Global multiplier on all policy effects (default 1.0). */
  policyStrength: number;
  /** Seed for the RNG. If omitted, one is generated automatically. */
  seed?: string;
}

/** A single economic effect that a policy applies. */
export interface PolicyEconomicEffect {
  /** Which variable this effect targets. */
  target: string;
  /** One-time impact applied when the effect first activates (after delay). */
  immediate: number;
  /** Ongoing impact applied each turn while the effect is active. */
  perPeriod: number;
  /** How many turns the ongoing effect lasts (after the delay). */
  duration: number;
  /** How many turns before the effect begins. */
  delay: number;
  /** Uncertainty factor [0,1]: actual magnitude is multiplied by (1 + U(-u, u)). */
  uncertainty: number;
}

/** An active policy effect being tracked by the engine. */
export interface ActiveEffect {
  policyId: string;
  effect: PolicyEconomicEffect;
  /** Turns remaining for the ongoing per-period effect. */
  turnsRemaining: number;
  /** Turns of delay remaining before the effect activates. */
  delayRemaining: number;
}

// ============================================================
// INTERNAL TYPES
// ============================================================

/** Union of all trackable economic variable keys. */
type EconomicVariable =
  | 'gdpGrowth'
  | 'unemployment'
  | 'inflation'
  | 'publicDebt'
  | 'budgetBalance'
  | 'consumerConfidence'
  | 'businessConfidence'
  | 'interestRate';

/** A directed relationship between two economic variables. */
interface Relationship {
  from: EconomicVariable;
  to: EconomicVariable;
  /** Strength coefficient (positive = same-direction, negative = inverse). */
  coefficient: number;
  /** Turns of lag before the effect materialises. */
  delay: number;
}

/** Bounds for a variable: [min, max]. */
interface Bounds {
  min: number;
  max: number;
}

// ============================================================
// CONSTANTS
// ============================================================

const SECTOR_NAMES = [
  'manufacturing',
  'services',
  'finance',
  'technology',
  'healthcare',
  'education',
  'housing',
  'energy',
  'agriculture',
] as const;

/** Equilibrium (long-run target) for each variable. */
const DEFAULT_EQUILIBRIUM: Record<EconomicVariable, number> = {
  gdpGrowth: 2.5,
  unemployment: 5.0,
  inflation: 2.0,
  publicDebt: 60,
  budgetBalance: 0,
  consumerConfidence: 50,
  businessConfidence: 50,
  interestRate: 3.0,
};

/** Hard bounds for each variable. */
const VARIABLE_BOUNDS: Record<EconomicVariable, Bounds> = {
  gdpGrowth: { min: -10, max: 15 },
  unemployment: { min: 0, max: 30 },
  inflation: { min: -5, max: 30 },
  publicDebt: { min: 0, max: 300 },
  budgetBalance: { min: -15, max: 10 },
  consumerConfidence: { min: 0, max: 100 },
  businessConfidence: { min: 0, max: 100 },
  interestRate: { min: 0, max: 20 },
};

/** Default mean-reversion speed per variable. */
const DEFAULT_ALPHA: Record<EconomicVariable, number> = {
  gdpGrowth: 0.10,
  unemployment: 0.08,
  inflation: 0.10,
  publicDebt: 0.05,
  budgetBalance: 0.12,
  consumerConfidence: 0.12,
  businessConfidence: 0.10,
  interestRate: 0.10,
};

/** Default noise standard deviation per variable. */
const DEFAULT_SIGMA: Record<EconomicVariable, number> = {
  gdpGrowth: 0.3,
  unemployment: 0.2,
  inflation: 0.2,
  publicDebt: 0.5,
  budgetBalance: 0.3,
  consumerConfidence: 2.0,
  businessConfidence: 2.0,
  interestRate: 0.15,
};

/**
 * Inter-variable relationship matrix.
 * Each entry is empirically grounded (Okun's Law, Phillips Curve, etc.).
 */
const RELATIONSHIPS: Relationship[] = [
  // Okun's Law: GDP growth reduces unemployment
  { from: 'gdpGrowth', to: 'unemployment', coefficient: -0.40, delay: 1 },
  // Phillips Curve: lower unemployment pushes inflation up
  { from: 'unemployment', to: 'inflation', coefficient: -0.15, delay: 1 },
  // Demand-pull inflation: GDP growth raises prices
  { from: 'gdpGrowth', to: 'inflation', coefficient: 0.20, delay: 2 },
  // Monetary tightening: higher rates slow growth
  { from: 'interestRate', to: 'gdpGrowth', coefficient: -0.25, delay: 2 },
  // Consumer confidence boosts spending and GDP
  { from: 'consumerConfidence', to: 'gdpGrowth', coefficient: 0.15, delay: 1 },
  // Business confidence drives investment and GDP
  { from: 'businessConfidence', to: 'gdpGrowth', coefficient: 0.20, delay: 1 },
  // GDP feeds back into consumer confidence
  { from: 'gdpGrowth', to: 'consumerConfidence', coefficient: 0.30, delay: 0 },
  // Unemployment erodes consumer confidence
  { from: 'unemployment', to: 'consumerConfidence', coefficient: -0.35, delay: 0 },
  // Inflation erodes consumer confidence
  { from: 'inflation', to: 'consumerConfidence', coefficient: -0.20, delay: 0 },
  // High public debt spooks businesses
  { from: 'publicDebt', to: 'businessConfidence', coefficient: -0.10, delay: 2 },
  // Budget surplus/deficit flows into debt
  { from: 'budgetBalance', to: 'publicDebt', coefficient: -0.05, delay: 0 },
  // Debt risk premium pushes interest rates
  { from: 'publicDebt', to: 'interestRate', coefficient: 0.05, delay: 1 },
];

/** Sector noise standard deviation. */
const SECTOR_SIGMA = 1.5;
/** Sector mean-reversion speed. */
const SECTOR_ALPHA = 0.10;
/** Sector equilibrium. */
const SECTOR_EQUILIBRIUM = 50;

// ============================================================
// ECONOMIC ENGINE
// ============================================================

export class EconomicEngine {
  private rng: SeededRNG;
  private state: EconomicState;
  private history: EconomicState[];
  private turn: number;

  /** Ring buffer of past variable values, used for delayed relationships. */
  private pastValues: Map<EconomicVariable, number[]>;

  // Resolved calibration
  private alpha: Record<EconomicVariable, number>;
  private sigma: Record<EconomicVariable, number>;
  private equilibrium: Record<EconomicVariable, number>;
  private relationshipStrength: number;
  private policyStrength: number;

  constructor(calibration?: Partial<EconomicCalibration>) {
    this.rng = new SeededRNG(calibration?.seed);
    this.turn = 0;
    this.history = [];

    // Merge calibration with defaults
    this.alpha = { ...DEFAULT_ALPHA, ...calibration?.meanReversionAlpha } as Record<EconomicVariable, number>;
    this.sigma = { ...DEFAULT_SIGMA, ...calibration?.noiseSigma } as Record<EconomicVariable, number>;
    this.equilibrium = { ...DEFAULT_EQUILIBRIUM, ...calibration?.equilibrium } as Record<EconomicVariable, number>;
    this.relationshipStrength = calibration?.relationshipStrength ?? 1.0;
    this.policyStrength = calibration?.policyStrength ?? 1.0;

    // Initialise past-values ring buffer (needs enough depth for max delay)
    this.pastValues = new Map();
    const maxDelay = Math.max(...RELATIONSHIPS.map(r => r.delay), 0);
    const bufferSize = maxDelay + 1;
    const allVars = Object.keys(DEFAULT_EQUILIBRIUM) as EconomicVariable[];
    for (const v of allVars) {
      // Fill with equilibrium values so early turns have stable lookback
      this.pastValues.set(v, new Array(bufferSize).fill(this.equilibrium[v]));
    }

    // Build initial state at equilibrium with light perturbation
    const sectors: Record<string, number> = {};
    for (const s of SECTOR_NAMES) {
      sectors[s] = SECTOR_EQUILIBRIUM + this.gaussianNoise(1.0);
      sectors[s] = clamp(sectors[s], 0, 100);
    }

    this.state = {
      gdpGrowth: this.equilibrium.gdpGrowth + this.gaussianNoise(0.2),
      unemployment: this.equilibrium.unemployment + this.gaussianNoise(0.2),
      inflation: this.equilibrium.inflation + this.gaussianNoise(0.1),
      publicDebt: this.equilibrium.publicDebt + this.gaussianNoise(2.0),
      budgetBalance: this.equilibrium.budgetBalance + this.gaussianNoise(0.2),
      consumerConfidence: this.equilibrium.consumerConfidence + this.gaussianNoise(1.0),
      businessConfidence: this.equilibrium.businessConfidence + this.gaussianNoise(1.0),
      interestRate: this.equilibrium.interestRate + this.gaussianNoise(0.1),
      sectors,
    };

    // Clamp initial values
    this.clampState();

    // Store the initial state as turn-0 history
    this.history.push(this.snapshot());
  }

  // ----------------------------------------------------------
  // Public API
  // ----------------------------------------------------------

  /** Return a copy of the current economic state. */
  getState(): EconomicState {
    return this.snapshot();
  }

  /**
   * Advance the economy by one turn.
   *
   * The update equation for each variable V is:
   *   ΔV = α(V* - V) + Σ(relationship effects) + Σ(policy effects) + ε
   *
   * @param activePolicies - all currently active policy effects.
   *        The engine will decrement delays and durations internally;
   *        callers should pass the full list each tick and read back
   *        the mutated turnsRemaining / delayRemaining.
   * @returns the new economic state after the tick.
   */
  tick(activePolicies: ActiveEffect[]): EconomicState {
    this.turn++;

    // Record current values into the ring buffer before mutation
    this.recordCurrentValues();

    const allVars = Object.keys(DEFAULT_EQUILIBRIUM) as EconomicVariable[];

    // ---- Compute deltas for each variable ----
    const deltas: Record<string, number> = {};
    for (const v of allVars) {
      deltas[v] = 0;
    }

    // 1. Mean reversion: α(V* - V)
    for (const v of allVars) {
      const current = this.getVar(v);
      deltas[v] += this.alpha[v] * (this.equilibrium[v] - current);
    }

    // 2. Inter-variable relationships (using delayed values)
    for (const rel of RELATIONSHIPS) {
      const sourceValue = this.getDelayedValue(rel.from, rel.delay);
      const sourceEquilibrium = this.equilibrium[rel.from];
      // Effect is proportional to the deviation of the source from its equilibrium
      const deviation = sourceValue - sourceEquilibrium;
      deltas[rel.to] += rel.coefficient * deviation * this.relationshipStrength;
    }

    // 3. Policy effects
    for (const active of activePolicies) {
      // Tick down delay
      if (active.delayRemaining > 0) {
        active.delayRemaining--;
        continue;
      }

      const target = active.effect.target as EconomicVariable;
      if (!(target in deltas)) continue;

      // Apply uncertainty: multiply magnitude by (1 + uniform(-u, u))
      const u = active.effect.uncertainty;
      const uncertaintyMult = 1 + (this.rng.random() * 2 - 1) * u;

      // Immediate effect fires only on the first active tick
      if (active.turnsRemaining === active.effect.duration) {
        deltas[target] += active.effect.immediate * uncertaintyMult * this.policyStrength;
      }

      // Per-period ongoing effect
      if (active.turnsRemaining > 0) {
        deltas[target] += active.effect.perPeriod * uncertaintyMult * this.policyStrength;
        active.turnsRemaining--;
      }
    }

    // 4. Stochastic noise: ε ~ N(0, σ²)
    for (const v of allVars) {
      deltas[v] += this.gaussianNoise(this.sigma[v]);
    }

    // ---- Apply deltas ----
    for (const v of allVars) {
      this.setVar(v, this.getVar(v) + deltas[v]);
    }

    // ---- Update sectors ----
    // Sectors are influenced by overall GDP and have their own mean reversion + noise.
    const gdpDeviation = this.state.gdpGrowth - this.equilibrium.gdpGrowth;
    for (const sector of SECTOR_NAMES) {
      const current = this.state.sectors[sector];
      // Mean reversion toward sector equilibrium
      let delta = SECTOR_ALPHA * (SECTOR_EQUILIBRIUM - current);
      // GDP spillover: when GDP is above trend, sectors tend to improve
      delta += 0.15 * gdpDeviation;
      // Noise
      delta += this.gaussianNoise(SECTOR_SIGMA);
      this.state.sectors[sector] = clamp(current + delta, 0, 100);
    }

    // ---- Clamp everything to bounds ----
    this.clampState();

    // ---- Store snapshot ----
    this.history.push(this.snapshot());

    return this.snapshot();
  }

  /**
   * Apply an exogenous shock to a specific variable.
   * Useful for crises, windfalls, or event-driven perturbations.
   */
  applyShock(variable: string, magnitude: number): void {
    const v = variable as EconomicVariable;
    if (v in VARIABLE_BOUNDS) {
      this.setVar(v, this.getVar(v) + magnitude);
      this.clampState();
    } else if (variable in this.state.sectors) {
      this.state.sectors[variable] = clamp(
        this.state.sectors[variable] + magnitude,
        0,
        100,
      );
    }
  }

  /** Return the full history of economic states (one per turn, starting at turn 0). */
  getHistory(): EconomicState[] {
    return this.history.map(s => deepCopyState(s));
  }

  /** Get health of a specific sector, or 50 (equilibrium) if unknown. */
  getSectorHealth(sector: string): number {
    return this.state.sectors[sector] ?? SECTOR_EQUILIBRIUM;
  }

  /**
   * Produce a qualitative summary of the current economic situation.
   * The rating is based on a composite score derived from key indicators.
   */
  getEconomicSummary(): { overall: 'strong' | 'moderate' | 'weak' | 'crisis'; description: string } {
    // Composite score: weighted sum of deviations from equilibrium.
    // Positive contributions are good; negative are bad.
    const gdpScore = (this.state.gdpGrowth - this.equilibrium.gdpGrowth) * 8;
    const unempScore = (this.equilibrium.unemployment - this.state.unemployment) * 6;
    const inflScore = -Math.abs(this.state.inflation - this.equilibrium.inflation) * 4;
    const confScore = ((this.state.consumerConfidence - 50) + (this.state.businessConfidence - 50)) * 0.2;
    const debtScore = (this.equilibrium.publicDebt - this.state.publicDebt) * 0.1;

    const composite = gdpScore + unempScore + inflScore + confScore + debtScore;

    let overall: 'strong' | 'moderate' | 'weak' | 'crisis';
    let description: string;

    if (composite >= 15) {
      overall = 'strong';
      description = this.buildDescription('The economy is performing strongly.', true);
    } else if (composite >= 0) {
      overall = 'moderate';
      description = this.buildDescription('The economy is growing at a moderate pace.', false);
    } else if (composite >= -15) {
      overall = 'weak';
      description = this.buildDescription('Economic conditions are weakening.', false);
    } else {
      overall = 'crisis';
      description = this.buildDescription('The economy is in crisis.', false);
    }

    return { overall, description };
  }

  // ----------------------------------------------------------
  // Private helpers
  // ----------------------------------------------------------

  /** Build a human-readable description highlighting notable deviations. */
  private buildDescription(opener: string, positive: boolean): string {
    const parts: string[] = [opener];

    if (this.state.gdpGrowth > 4) {
      parts.push(`GDP growth is robust at ${this.state.gdpGrowth.toFixed(1)}%.`);
    } else if (this.state.gdpGrowth < 0) {
      parts.push(`The economy is contracting at ${this.state.gdpGrowth.toFixed(1)}%.`);
    }

    if (this.state.unemployment > 8) {
      parts.push(`Unemployment is high at ${this.state.unemployment.toFixed(1)}%.`);
    } else if (this.state.unemployment < 4) {
      parts.push(`Unemployment is very low at ${this.state.unemployment.toFixed(1)}%.`);
    }

    if (this.state.inflation > 5) {
      parts.push(`Inflation is elevated at ${this.state.inflation.toFixed(1)}%.`);
    } else if (this.state.inflation < 0) {
      parts.push(`Deflation is occurring at ${this.state.inflation.toFixed(1)}%.`);
    }

    if (this.state.publicDebt > 100) {
      parts.push(`Public debt is concerning at ${this.state.publicDebt.toFixed(0)}% of GDP.`);
    }

    if (this.state.consumerConfidence < 30) {
      parts.push('Consumer confidence is very low.');
    } else if (this.state.consumerConfidence > 70) {
      parts.push('Consumer confidence is high.');
    }

    return parts.join(' ');
  }

  /**
   * Box-Muller transform: generate a normally distributed random number
   * with mean 0 and the given standard deviation.
   */
  private gaussianNoise(sigma: number): number {
    // Box-Muller requires two uniform samples
    const u1 = Math.max(1e-10, this.rng.random()); // avoid log(0)
    const u2 = this.rng.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z * sigma;
  }

  /** Record current macro values into the ring buffer for delayed lookups. */
  private recordCurrentValues(): void {
    const allVars = Object.keys(DEFAULT_EQUILIBRIUM) as EconomicVariable[];
    for (const v of allVars) {
      const buf = this.pastValues.get(v)!;
      buf.push(this.getVar(v));
      // Keep buffer bounded: only need maxDelay + 1 entries
      const maxDelay = Math.max(...RELATIONSHIPS.map(r => r.delay), 0);
      while (buf.length > maxDelay + 2) {
        buf.shift();
      }
    }
  }

  /**
   * Look up the value of a variable from `delay` turns ago.
   * Falls back to the current value if not enough history.
   */
  private getDelayedValue(variable: EconomicVariable, delay: number): number {
    const buf = this.pastValues.get(variable);
    if (!buf || buf.length === 0) return this.getVar(variable);
    const index = buf.length - 1 - delay;
    if (index < 0) return buf[0]; // earliest available
    return buf[index];
  }

  /** Read a primary/secondary variable from state by key. */
  private getVar(v: EconomicVariable): number {
    return this.state[v];
  }

  /** Write a primary/secondary variable to state by key. */
  private setVar(v: EconomicVariable, value: number): void {
    (this.state as any)[v] = value;
  }

  /** Enforce hard bounds on all state variables. */
  private clampState(): void {
    const allVars = Object.keys(VARIABLE_BOUNDS) as EconomicVariable[];
    for (const v of allVars) {
      const bounds = VARIABLE_BOUNDS[v];
      this.setVar(v, clamp(this.getVar(v), bounds.min, bounds.max));
    }
    for (const sector of Object.keys(this.state.sectors)) {
      this.state.sectors[sector] = clamp(this.state.sectors[sector], 0, 100);
    }
  }

  /** Create a deep copy of the current state. */
  private snapshot(): EconomicState {
    return deepCopyState(this.state);
  }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/** Clamp a number to [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Deep-copy an EconomicState (one level of nesting for sectors). */
function deepCopyState(s: EconomicState): EconomicState {
  return {
    gdpGrowth: s.gdpGrowth,
    unemployment: s.unemployment,
    inflation: s.inflation,
    publicDebt: s.publicDebt,
    budgetBalance: s.budgetBalance,
    consumerConfidence: s.consumerConfidence,
    businessConfidence: s.businessConfidence,
    interestRate: s.interestRate,
    sectors: { ...s.sectors },
  };
}
