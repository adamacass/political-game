// ============================================================
// THE HOUSE - AI Decision Engine
// Chooses actions for AI players based on strategy, difficulty,
// and the current game state.
// ============================================================

import {
  Player, PlayerAction, ActionType, Policy, GameState,
  GameConfig, StateCode, AIStrategy, AIDifficulty,
  Seat, IdeologyStance, VoterGroupState,
} from '../types';
import { SeededRNG } from './rng';

// ============================================================
// CONSTANTS
// ============================================================

/** All Australian states and territories. */
const ALL_STATES: StateCode[] = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

/** Utility multipliers for each strategy profile, keyed by action type. */
const STRATEGY_WEIGHTS: Record<AIStrategy, Record<ActionType, number>> = {
  campaigner: {
    campaign:        2.0,
    propose_policy:  0.5,
    attack_ad:       1.5,
    fundraise:       1.0,
    media_blitz:     0.8,
    coalition_talk:  0.3,
  },
  policy_wonk: {
    campaign:        0.8,
    propose_policy:  2.5,
    attack_ad:       0.3,
    fundraise:       0.8,
    media_blitz:     0.5,
    coalition_talk:  1.0,
  },
  populist: {
    campaign:        1.2,
    propose_policy:  1.5,
    attack_ad:       1.0,
    fundraise:       0.8,
    media_blitz:     1.5,
    coalition_talk:  0.5,
  },
  pragmatist: {
    campaign:        1.2,
    propose_policy:  1.2,
    attack_ad:       1.0,
    fundraise:       1.0,
    media_blitz:     1.0,
    coalition_talk:  0.8,
  },
};

/** Noise magnitude (as a fraction of utility) per difficulty level. */
const DIFFICULTY_NOISE: Record<AIDifficulty, number> = {
  easy:   0.30,
  normal: 0.15,
  hard:   0.05,
};

// ============================================================
// EXPORTED HELPER FUNCTIONS
// ============================================================

/**
 * Compute how well a policy matches a player's ideology.
 * Checks the policy's stanceTable against both the player's social and
 * economic ideology axes and returns a value in the range [0, 1].
 *   1.0 = fully aligned (both axes favoured)
 *   0.0 = fully opposed (both axes opposed)
 */
export function computeIdeologyMatch(policy: Policy, player: Player): number {
  const socialStance: IdeologyStance =
    player.socialIdeology === 'progressive'
      ? policy.stanceTable.progressive
      : policy.stanceTable.conservative;

  const econStance: IdeologyStance =
    player.economicIdeology === 'market'
      ? policy.stanceTable.market
      : policy.stanceTable.interventionist;

  const stanceToValue = (stance: IdeologyStance): number => {
    switch (stance) {
      case 'favoured': return 1.0;
      case 'neutral':  return 0.5;
      case 'opposed':  return 0.0;
    }
  };

  return (stanceToValue(socialStance) + stanceToValue(econStance)) / 2;
}

/**
 * Determine the best state for a player to campaign in.
 * Considers:
 *   - Number of flippable seats in the state
 *   - How marginal those seats are (lower margin = easier to flip)
 *   - Campaign influence gap (player vs. strongest opponent)
 *   - Ideological alignment between player and available seats
 *   - Voter satisfaction alignment
 *
 * Avoids states where the player already dominates (>75% of seats).
 */
export function getBestCampaignState(player: Player, state: GameState): StateCode {
  const allSeats = Object.values(state.seats);
  let bestState: StateCode = 'NSW';
  let bestScore = -Infinity;

  for (const stateCode of ALL_STATES) {
    const stateSeats = allSeats.filter(s => s.state === stateCode);
    if (stateSeats.length === 0) continue;

    // How many seats the player already holds in this state
    const ownedCount = stateSeats.filter(s => s.ownerPlayerId === player.id).length;
    const dominanceRatio = ownedCount / stateSeats.length;

    // Skip states where the player already dominates
    if (dominanceRatio > 0.75) continue;

    // Flippable seats: owned by someone else (not vacant, not ours)
    const flippable = stateSeats.filter(
      s => s.ownerPlayerId !== null && s.ownerPlayerId !== player.id,
    );
    if (flippable.length === 0) continue;

    // Marginality score: average (100 - margin) / 100 across flippable seats
    // Lower margins are easier to flip, so higher score is better
    const avgMargin = flippable.reduce((sum, s) => sum + s.margin, 0) / flippable.length;
    const marginalityScore = (100 - avgMargin) / 100;

    // Campaign influence advantage
    const myInfluence = player.campaignInfluence[stateCode] || 0;
    const opponentInfluences = state.players
      .filter(p => p.id !== player.id)
      .map(p => p.campaignInfluence[stateCode] || 0);
    const maxOpponentInfluence = opponentInfluences.length > 0
      ? Math.max(...opponentInfluences)
      : 0;
    const influenceGap = myInfluence - maxOpponentInfluence;
    // Normalize to roughly [-1, 1]
    const influenceScore = Math.max(-1, Math.min(1, influenceGap / 20));

    // Seat count weight: more flippable seats = more reward
    const seatCountScore = flippable.length / 20;

    // Ideology alignment: fraction of flippable seats that match the player
    let matchCount = 0;
    for (const seat of flippable) {
      if (checkSeatIdeologyMatch(player, seat)) {
        matchCount++;
      }
    }
    const ideologyScore = matchCount / flippable.length;

    // Voter satisfaction alignment: if a voter group in this state leans
    // toward the player, that's a bonus. Use a simple heuristic based on
    // the number of voter groups leaning toward the player.
    let satisfactionBonus = 0;
    for (const group of state.voterGroups) {
      if (group.leaningPartyId === player.id) {
        satisfactionBonus += 0.1;
      }
    }

    const totalScore =
      seatCountScore * 3
      + marginalityScore * 2
      + influenceScore * 1.5
      + ideologyScore * 1
      + satisfactionBonus;

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestState = stateCode;
    }
  }

  return bestState;
}

// ============================================================
// AI ENGINE CLASS
// ============================================================

export class AIEngine {
  private rng: SeededRNG;

  constructor(rng: SeededRNG) {
    this.rng = rng;
  }

  /**
   * Choose actions for an AI player based on their strategy and the current game state.
   * Returns an array of PlayerAction (up to config.actionsPerRound).
   */
  chooseActions(player: Player, state: GameState, config: GameConfig): PlayerAction[] {
    const actions: PlayerAction[] = [];
    const strategy: AIStrategy = player.aiStrategy || 'pragmatist';
    const difficulty: AIDifficulty = config.aiDifficulty || 'normal';
    const noiseMag = DIFFICULTY_NOISE[difficulty];

    // Build effective weights: start from the strategy table,
    // then apply situational adjustments for pragmatist and populist.
    const baseWeights = { ...STRATEGY_WEIGHTS[strategy] };
    const weights = this.applyStrategyAdjustments(baseWeights, strategy, player, state);

    // Track remaining funds through the planning cycle so we never overspend
    let remainingFunds = player.funds;

    // Track policies we've already decided to propose this round
    const proposedPolicyIds = new Set<string>();

    for (let i = 0; i < config.actionsPerRound; i++) {
      const candidates = this.evaluateAllActions(
        player, state, config, weights, noiseMag,
        remainingFunds, proposedPolicyIds,
      );

      if (candidates.length === 0) break;

      // Pick the highest-utility action
      candidates.sort((a, b) => b.utility - a.utility);
      const best = candidates[0];

      actions.push(best.action);
      remainingFunds -= best.cost;

      // Remember proposed policies to avoid duplicates
      if (best.action.type === 'propose_policy' && best.action.policyId) {
        proposedPolicyIds.add(best.action.policyId);
      }
    }

    return actions;
  }

  // ----------------------------------------------------------
  // Strategy adjustments
  // ----------------------------------------------------------

  /**
   * Modify weights based on the current game situation.
   *
   * Pragmatist: campaigns harder when behind in seats, legislates when ahead.
   * Populist: boosts campaign weight when approval is high, boosts media when low.
   */
  private applyStrategyAdjustments(
    weights: Record<ActionType, number>,
    strategy: AIStrategy,
    player: Player,
    state: GameState,
  ): Record<ActionType, number> {
    const adjusted = { ...weights };

    if (strategy === 'pragmatist') {
      const seatLeader = this.findSeatLeader(state);
      if (seatLeader && seatLeader.id !== player.id) {
        // Behind: boost campaign and attack, reduce policy
        const seatGap = seatLeader.seats - player.seats;
        const urgency = Math.min(1.5, 1 + seatGap / 40);
        adjusted.campaign *= urgency;
        adjusted.attack_ad *= urgency;
        adjusted.propose_policy *= (2 - urgency);
      } else {
        // Ahead or tied: boost policy and coalition
        adjusted.propose_policy *= 1.4;
        adjusted.coalition_talk *= 1.3;
        adjusted.campaign *= 0.8;
      }
    }

    if (strategy === 'populist') {
      // High approval: campaign more aggressively to capitalize
      // Low approval: media blitz to recover
      const approvalNorm = (player.approval + 100) / 200; // 0 to 1
      adjusted.campaign *= (0.7 + approvalNorm * 0.6);     // 0.7..1.3
      adjusted.media_blitz *= (1.6 - approvalNorm * 0.6);  // 1.0..1.6

      // Boost policy weight when voter satisfaction favours the player
      const favourableGroups = state.voterGroups.filter(
        g => g.leaningPartyId === player.id,
      ).length;
      const groupBonus = 1 + favourableGroups * 0.1;
      adjusted.propose_policy *= groupBonus;
    }

    return adjusted;
  }

  // ----------------------------------------------------------
  // Action evaluation
  // ----------------------------------------------------------

  /**
   * Evaluate all possible actions and return scored candidates.
   * Each candidate includes the action, its noisy utility, and its fund cost.
   */
  private evaluateAllActions(
    player: Player,
    state: GameState,
    config: GameConfig,
    weights: Record<ActionType, number>,
    noiseMag: number,
    remainingFunds: number,
    proposedPolicyIds: Set<string>,
  ): ActionCandidate[] {
    const candidates: ActionCandidate[] = [];

    // --- Campaign ---
    if (remainingFunds >= config.campaignCost) {
      const rawUtility = this.computeCampaignUtility(player, state);
      const targetState = getBestCampaignState(player, state);
      candidates.push({
        action: { type: 'campaign', targetState },
        utility: this.applyNoise(rawUtility * weights.campaign, noiseMag),
        cost: config.campaignCost,
      });
    }

    // --- Propose policy ---
    const bestPolicy = this.pickBestPolicy(player, state, proposedPolicyIds);
    if (bestPolicy) {
      const rawUtility = this.computePolicyUtility(bestPolicy.policy, player, state);
      candidates.push({
        action: { type: 'propose_policy', policyId: bestPolicy.policy.id },
        utility: this.applyNoise(rawUtility * weights.propose_policy, noiseMag),
        cost: 0,
      });
    }

    // --- Attack ad ---
    if (remainingFunds >= config.attackAdCost) {
      const attackTarget = this.pickAttackTarget(player, state);
      if (attackTarget) {
        const rawUtility = this.computeAttackUtility(player, attackTarget, state);
        candidates.push({
          action: { type: 'attack_ad', targetPlayerId: attackTarget.id },
          utility: this.applyNoise(rawUtility * weights.attack_ad, noiseMag),
          cost: config.attackAdCost,
        });
      }
    }

    // --- Fundraise (always available, no cost) ---
    {
      const rawUtility = this.computeFundraiseUtility(player, config);
      candidates.push({
        action: { type: 'fundraise' },
        utility: this.applyNoise(rawUtility * weights.fundraise, noiseMag),
        cost: 0,
      });
    }

    // --- Media blitz ---
    if (remainingFunds >= config.mediaBlitzCost) {
      const rawUtility = this.computeMediaBlitzUtility(player);
      candidates.push({
        action: { type: 'media_blitz' },
        utility: this.applyNoise(rawUtility * weights.media_blitz, noiseMag),
        cost: config.mediaBlitzCost,
      });
    }

    // --- Coalition talk ---
    if (remainingFunds >= config.coalitionTalkCost) {
      const coalitionTarget = this.pickCoalitionTarget(player, state);
      if (coalitionTarget) {
        const rawUtility = this.computeCoalitionUtility(player, coalitionTarget, state);
        candidates.push({
          action: { type: 'coalition_talk', targetPlayerId: coalitionTarget.id },
          utility: this.applyNoise(rawUtility * weights.coalition_talk, noiseMag),
          cost: config.coalitionTalkCost,
        });
      }
    }

    return candidates;
  }

  // ----------------------------------------------------------
  // Utility functions
  // ----------------------------------------------------------

  /**
   * Campaign utility: considers the fraction of marginal + ideology-aligned
   * seats available, scaled by the player's current approval.
   */
  private computeCampaignUtility(player: Player, state: GameState): number {
    const allSeats = Object.values(state.seats);
    const flippable = allSeats.filter(
      s => s.ownerPlayerId !== null && s.ownerPlayerId !== player.id,
    );
    if (flippable.length === 0) return 0;

    // Marginal seats (margin < 40) are attractive targets
    const marginalCount = flippable.filter(s => s.margin < 40).length;
    const marginalRatio = marginalCount / flippable.length;

    // Ideology-aligned seats the player could flip
    let alignedCount = 0;
    for (const seat of flippable) {
      if (checkSeatIdeologyMatch(player, seat)) {
        alignedCount++;
      }
    }
    const ideologyRatio = alignedCount / flippable.length;

    // Approval factor: higher approval makes campaigns more effective
    const approvalFactor = (player.approval + 100) / 200; // 0..1

    // Voter satisfaction alignment: fraction of voter groups leaning toward us
    const leaningGroups = state.voterGroups.filter(
      g => g.leaningPartyId === player.id,
    ).length;
    const totalGroups = Math.max(state.voterGroups.length, 1);
    const satisfactionFactor = leaningGroups / totalGroups;

    return (
      marginalRatio * 3
      + ideologyRatio * 2.5
      + approvalFactor * 2
      + satisfactionFactor * 1.5
    ) / 3;
  }

  /**
   * Policy utility computed as:
   *   ideologyMatch(policy, player) * 3
   *   + voterPopularity(policy, voterGroups) * 2
   *   + budgetFeasibility(policy, funds) * 1
   */
  private computePolicyUtility(policy: Policy, player: Player, state: GameState): number {
    const idMatch = computeIdeologyMatch(policy, player);
    const voterPop = computeVoterPopularity(policy, state.voterGroups);
    const budgetFeas = computeBudgetFeasibility(policy, player.funds);

    return idMatch * 3 + voterPop * 2 + budgetFeas * 1;
  }

  /**
   * Attack ad utility: based on how close the target is in seats,
   * whether they are the government leader, and their current approval.
   */
  private computeAttackUtility(
    player: Player,
    target: Player,
    state: GameState,
  ): number {
    // Closeness in seat count: tighter races make attacks more impactful
    const seatDiff = Math.abs(target.seats - player.seats);
    const closenessScore = Math.max(0, 1 - seatDiff / 50);

    // Bonus for targeting the government leader
    const isGovLeader = target.id === state.governmentLeaderId;
    const govBonus = isGovLeader ? 0.5 : 0;

    // Target's high approval means there is more to knock down
    const targetApprovalScore = (target.approval + 100) / 200;

    return (closenessScore * 3 + govBonus * 2 + targetApprovalScore * 1.5) / 2;
  }

  /**
   * Fundraise utility: inversely proportional to current funds.
   * Very high when the player is nearly broke.
   */
  private computeFundraiseUtility(player: Player, config: GameConfig): number {
    // "Healthy" funds = enough for roughly 3 campaigns
    const healthyFunds = config.campaignCost * 3;
    const fundsRatio = player.funds / Math.max(healthyFunds, 1);

    // Inverse relationship: low funds => high utility, clamped to [0.1, 3]
    return Math.max(0.1, Math.min(3, 1 / Math.max(fundsRatio, 0.1)));
  }

  /**
   * Media blitz utility: inversely proportional to current approval.
   * Very high when approval is deeply negative.
   */
  private computeMediaBlitzUtility(player: Player): number {
    // Normalize approval from [-100, 100] to (0, 1]
    const approvalNorm = (player.approval + 100) / 200;

    // Inverse: low approval => high utility, clamped to [0.1, 3]
    return Math.max(0.1, Math.min(3, 1 / Math.max(approvalNorm, 0.1)));
  }

  /**
   * Coalition talk utility: ideology compatibility with the target,
   * the target's seat count (bigger allies are more valuable), and
   * whether the player currently leads the government.
   */
  private computeCoalitionUtility(
    player: Player,
    target: Player,
    state: GameState,
  ): number {
    // Ideology compatibility: 2 axes, each matching adds to the score
    const sameEcon = player.economicIdeology === target.economicIdeology;
    const sameSocial = player.socialIdeology === target.socialIdeology;
    let ideologyScore: number;
    if (sameEcon && sameSocial) ideologyScore = 1.0;
    else if (sameEcon || sameSocial) ideologyScore = 0.5;
    else ideologyScore = 0.1;

    // Coalition is more valuable when not leading (need allies to govern)
    const isLeader = state.governmentLeaderId === player.id;
    const needAllies = isLeader ? 0.5 : 1.0;

    // Prefer targets with meaningful seat counts
    const totalSeats = state.totalSeats || 151;
    const targetSeatWeight = target.seats / totalSeats;

    return (ideologyScore * 3 + needAllies * 1 + targetSeatWeight * 2) / 2;
  }

  // ----------------------------------------------------------
  // Target selection helpers
  // ----------------------------------------------------------

  /**
   * Pick the best policy to propose.
   * Scores each policy on the menu and excludes:
   *   - Policies already active
   *   - Policies already proposed this round
   */
  private pickBestPolicy(
    player: Player,
    state: GameState,
    proposedPolicyIds: Set<string>,
  ): { policy: Policy; score: number } | null {
    const activePolicyIds = new Set(
      state.activePolicies.map(ap => ap.policy.id),
    );

    const available = state.policyMenu.filter(
      p => !activePolicyIds.has(p.id) && !proposedPolicyIds.has(p.id),
    );

    if (available.length === 0) return null;

    let bestPolicy: Policy | null = null;
    let bestScore = -Infinity;

    for (const policy of available) {
      const idMatch = computeIdeologyMatch(policy, player);
      const voterPop = computeVoterPopularity(policy, state.voterGroups);
      const budgetFeas = computeBudgetFeasibility(policy, player.funds);

      const score = idMatch * 3 + voterPop * 2 + budgetFeas * 1;

      if (score > bestScore) {
        bestScore = score;
        bestPolicy = policy;
      }
    }

    return bestPolicy ? { policy: bestPolicy, score: bestScore } : null;
  }

  /**
   * Pick the best attack target.
   * Prefers the player closest in seat count, but will target the government
   * leader if no one is within 10 seats.
   */
  private pickAttackTarget(player: Player, state: GameState): Player | null {
    const opponents = state.players.filter(p => p.id !== player.id);
    if (opponents.length === 0) return null;

    // Sort opponents by seat-count proximity (closest first)
    const sortedByProximity = [...opponents].sort(
      (a, b) => Math.abs(a.seats - player.seats) - Math.abs(b.seats - player.seats),
    );

    const closest = sortedByProximity[0];

    // If the closest competitor is within 10 seats, target them directly
    if (Math.abs(closest.seats - player.seats) <= 10) {
      return closest;
    }

    // Otherwise, prefer the government leader (if it isn't us)
    if (state.governmentLeaderId && state.governmentLeaderId !== player.id) {
      const govLeader = opponents.find(p => p.id === state.governmentLeaderId);
      if (govLeader) return govLeader;
    }

    // Fallback: the closest opponent
    return closest;
  }

  /**
   * Pick the best coalition partner: the opponent with the most
   * compatible ideology and the most seats.
   */
  private pickCoalitionTarget(player: Player, state: GameState): Player | null {
    const opponents = state.players.filter(p => p.id !== player.id);
    if (opponents.length === 0) return null;

    let best: Player | null = null;
    let bestScore = -Infinity;

    const totalSeats = state.totalSeats || 151;

    for (const opp of opponents) {
      let score = 0;
      if (opp.economicIdeology === player.economicIdeology) score += 2;
      if (opp.socialIdeology === player.socialIdeology) score += 2;
      // Prefer allies with meaningful seat counts
      score += opp.seats / totalSeats;

      if (score > bestScore) {
        bestScore = score;
        best = opp;
      }
    }

    return best;
  }

  // ----------------------------------------------------------
  // Internal helpers
  // ----------------------------------------------------------

  /** Apply random noise to a utility value based on difficulty. */
  private applyNoise(value: number, noiseMag: number): number {
    const noise = (this.rng.random() * 2 - 1) * noiseMag;
    return value * (1 + noise);
  }

  /** Find the player with the most seats. */
  private findSeatLeader(state: GameState): Player | null {
    if (state.players.length === 0) return null;
    return state.players.reduce(
      (leader, p) => (p.seats > leader.seats ? p : leader),
    );
  }
}

// ============================================================
// INTERNAL TYPES
// ============================================================

interface ActionCandidate {
  action: PlayerAction;
  utility: number;
  cost: number;
}

// ============================================================
// PRIVATE HELPER FUNCTIONS
// ============================================================

/**
 * Check whether a player's ideology aligns with a seat's ideology.
 * A match on either the economic or social axis counts as aligned.
 */
function checkSeatIdeologyMatch(player: Player, seat: Seat): boolean {
  const econMatch =
    (player.economicIdeology === 'interventionist' && seat.ideology.econ === 'LEFT') ||
    (player.economicIdeology === 'market' && seat.ideology.econ === 'RIGHT');

  const socialMatch =
    (player.socialIdeology === 'progressive' && seat.ideology.social === 'PROG') ||
    (player.socialIdeology === 'conservative' && seat.ideology.social === 'CONS');

  return econMatch || socialMatch;
}

/**
 * Compute how popular a policy is with voter groups.
 * Weighs each voter group's impact by its population share.
 * Returns a value in the range [0, 1].
 */
function computeVoterPopularity(
  policy: Policy,
  voterGroups: VoterGroupState[],
): number {
  if (
    !policy.voterImpacts ||
    policy.voterImpacts.length === 0 ||
    voterGroups.length === 0
  ) {
    return 0.5; // neutral when no data is available
  }

  let totalWeightedImpact = 0;
  let totalPopulation = 0;

  for (const impact of policy.voterImpacts) {
    const group = voterGroups.find(g => g.id === impact.groupId);
    if (!group) continue;

    totalWeightedImpact += impact.impact * group.population;
    totalPopulation += group.population;
  }

  if (totalPopulation === 0) return 0.5;

  // Impacts are typically in [-10, +10]; normalize to [0, 1]
  const avgImpact = totalWeightedImpact / totalPopulation;
  return Math.max(0, Math.min(1, (avgImpact + 10) / 20));
}

/**
 * Compute budget feasibility of a policy.
 * Returns a value in the range [0, 1].
 * Policies whose cost greatly exceeds the player's funds score near 0;
 * free policies always score 1.
 */
function computeBudgetFeasibility(policy: Policy, playerFunds: number): number {
  const cost = Math.abs(policy.budgetCost);
  if (cost === 0) return 1.0;

  // Fully feasible when funds >= 5x the cost; scales linearly down to 0
  const ratio = playerFunds / Math.max(cost, 1);
  return Math.max(0, Math.min(1, ratio / 5));
}
