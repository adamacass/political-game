// ============================================================
// THE HOUSE — Policy Web Simulation Engine
// Democracy 4-style cascading effects simulation
//
// The simulation "ticks" once per round:
//   1. Policy slider values transition toward targets
//   2. Policy effects propagate to stats
//   3. Stat-to-stat effects propagate (feedback loops)
//   4. Situation trigger/deactivate checks
//   5. Situation effects propagate
//   6. Voter group happiness computed
//   7. Media focus decays
// ============================================================

import seedrandom from 'seedrandom';
import {
  PolicySlider,
  PolicyEffect,
  StatDefinition,
  SituationDefinition,
  ActiveSituation,
  VoterGroupDefinition,
  VoterGroupState,
  VoterConcern,
  MediaFocus,
  LinkFormula,
  GameState,
  GameConfig,
} from '../types';

// ── Helpers ──────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function applyFormula(sourceValue: number, multiplier: number, formula: LinkFormula): number {
  const base = clamp(sourceValue, 0, 1);
  let transformed: number;

  switch (formula) {
    case 'linear':
      transformed = base;
      break;
    case 'sqrt':
      transformed = Math.sqrt(base);
      break;
    case 'squared':
      transformed = base * base;
      break;
    case 'threshold':
      // Sharp activation above 0.5
      transformed = base > 0.5 ? (base - 0.5) * 2 : 0;
      break;
    case 'inverse':
      transformed = 1 - base;
      break;
    default:
      transformed = base;
  }

  return transformed * multiplier;
}

function lerp(current: number, target: number, t: number): number {
  return current + (target - current) * t;
}

// ── Core simulation tick ─────────────────────────────────────

export interface SimulationContext {
  policies: Record<string, PolicySlider>;
  stats: Record<string, StatDefinition>;
  activeSituations: ActiveSituation[];
  situationDefinitions: SituationDefinition[];
  voterGroups: VoterGroupState[];
  voterGroupDefinitions: VoterGroupDefinition[];
  mediaFocus: MediaFocus[];
  config: GameConfig;
  round: number;
  rng: seedrandom.PRNG;
}

/**
 * Run one full simulation tick. Mutates the context in place.
 * Returns a summary of changes for the event log.
 */
export function simulationTick(ctx: SimulationContext): SimulationTickResult {
  const result: SimulationTickResult = {
    policyTransitions: [],
    statChanges: [],
    situationsTriggered: [],
    situationsResolved: [],
    voterHappinessChanges: [],
    mediaDecayed: [],
    budgetBalance: 0,
  };

  // ── Step 1: Transition policy sliders toward targets ──
  for (const policy of Object.values(ctx.policies)) {
    if (Math.abs(policy.currentValue - policy.targetValue) > 0.001) {
      const oldVal = policy.currentValue;
      const speed = policy.implementationDelay > 0
        ? 1 / policy.implementationDelay
        : 1;
      policy.currentValue = lerp(policy.currentValue, policy.targetValue, clamp(speed, 0.1, 1));
      // Snap if very close
      if (Math.abs(policy.currentValue - policy.targetValue) < 0.005) {
        policy.currentValue = policy.targetValue;
      }
      result.policyTransitions.push({
        policyId: policy.id,
        from: oldVal,
        to: policy.currentValue,
      });
    }
  }

  // ── Step 2: Compute budget balance ──
  let totalCost = 0;
  for (const policy of Object.values(ctx.policies)) {
    totalCost += policy.currentValue * policy.costPerPoint;
  }
  // Revenue comes from tax policies (negative costPerPoint = revenue)
  result.budgetBalance = -totalCost; // positive = surplus

  // ── Step 3: Save previous stat values ──
  for (const stat of Object.values(ctx.stats)) {
    stat.prevValue = stat.value;
  }

  // ── Step 4: Propagate policy effects to stats ──
  // Accumulate deltas rather than applying immediately
  const statDeltas: Record<string, number> = {};
  for (const id of Object.keys(ctx.stats)) {
    statDeltas[id] = 0;
  }

  for (const policy of Object.values(ctx.policies)) {
    for (const effect of policy.effects) {
      if (effect.delay > 0 && ctx.round < effect.delay) continue;
      if (ctx.stats[effect.targetId]) {
        const contribution = applyFormula(policy.currentValue, effect.multiplier, effect.formula);
        const inertiaFactor = clamp(effect.inertia, 0.05, 1) * ctx.config.simulationSpeed;
        statDeltas[effect.targetId] = (statDeltas[effect.targetId] || 0) + contribution * inertiaFactor;
      }
    }
  }

  // ── Step 5: Propagate stat-to-stat effects (feedback loops) ──
  for (const stat of Object.values(ctx.stats)) {
    for (const effect of stat.effects) {
      if (effect.delay > 0 && ctx.round < effect.delay) continue;
      if (ctx.stats[effect.targetId] && effect.targetId !== stat.id) {
        const contribution = applyFormula(stat.value, effect.multiplier, effect.formula);
        const inertiaFactor = clamp(effect.inertia, 0.05, 1) * ctx.config.simulationSpeed;
        statDeltas[effect.targetId] = (statDeltas[effect.targetId] || 0) + contribution * inertiaFactor;
      }
    }
  }

  // ── Step 6: Apply stat deltas with mean reversion ──
  for (const stat of Object.values(ctx.stats)) {
    const delta = statDeltas[stat.id] || 0;
    // Mean reversion: gently pull toward default
    const reversion = (stat.defaultValue - stat.value) * 0.02;
    // Random noise
    const noise = (ctx.rng() - 0.5) * 0.01 * ctx.config.simulationSpeed;

    const newValue = clamp(stat.value + delta * 0.15 + reversion + noise, 0, 1);
    if (Math.abs(newValue - stat.value) > 0.001) {
      result.statChanges.push({
        statId: stat.id,
        from: stat.value,
        to: newValue,
      });
    }
    stat.value = newValue;
  }

  // ── Step 7: Situation effects propagate to stats ──
  for (const activeSit of ctx.activeSituations) {
    const def = ctx.situationDefinitions.find(d => d.id === activeSit.definitionId);
    if (!def) continue;

    for (const effect of def.effects) {
      if (ctx.stats[effect.targetId]) {
        const contribution = applyFormula(activeSit.severity, effect.multiplier, effect.formula);
        const inertiaFactor = clamp(effect.inertia, 0.05, 1) * ctx.config.simulationSpeed;
        ctx.stats[effect.targetId].value = clamp(
          ctx.stats[effect.targetId].value + contribution * inertiaFactor * 0.1,
          0, 1
        );
      }
    }
  }

  // ── Step 8: Check situation triggers/deactivations ──
  if (ctx.config.enableSituations) {
    for (const sitDef of ctx.situationDefinitions) {
      const isActive = ctx.activeSituations.some(s => s.definitionId === sitDef.id);
      const inputValue = computeSituationInput(sitDef, ctx);

      if (!isActive && inputValue >= sitDef.triggerThreshold) {
        // Trigger situation
        const severity = clamp((inputValue - sitDef.triggerThreshold) / (1 - sitDef.triggerThreshold), 0, 1);
        const newSit: ActiveSituation = {
          definitionId: sitDef.id,
          name: sitDef.name,
          icon: sitDef.icon,
          severityType: sitDef.severityType,
          severity,
          roundActivated: ctx.round,
          headline: sitDef.headline,
        };
        ctx.activeSituations.push(newSit);
        result.situationsTriggered.push(newSit);
      } else if (isActive) {
        const idx = ctx.activeSituations.findIndex(s => s.definitionId === sitDef.id);
        if (inputValue < sitDef.deactivateThreshold) {
          // Deactivate
          result.situationsResolved.push(ctx.activeSituations[idx]);
          ctx.activeSituations.splice(idx, 1);
        } else {
          // Update severity
          ctx.activeSituations[idx].severity = clamp(
            (inputValue - sitDef.deactivateThreshold) / (sitDef.triggerThreshold - sitDef.deactivateThreshold),
            0, 1
          );
        }
      }
    }
  }

  // ── Step 9: Update voter group happiness ──
  for (const vg of ctx.voterGroups) {
    vg.prevHappiness = vg.happiness;
    const def = ctx.voterGroupDefinitions.find(d => d.id === vg.id);
    if (!def) continue;

    let happinessSum = 0;
    let weightSum = 0;

    for (const concern of def.concerns) {
      const nodeValue = getNodeValue(concern.nodeId, ctx);
      if (nodeValue === null) continue;

      // If desires high: happiness = value, if desires low: happiness = 1 - value
      const satisfaction = concern.desiresHigh ? nodeValue : (1 - nodeValue);
      // Map 0-1 satisfaction to -1 to +1 happiness contribution
      const contribution = (satisfaction - 0.5) * 2;

      // Check if media is amplifying this concern
      let mediaMultiplier = 1;
      const mediaItem = ctx.mediaFocus.find(m => m.nodeId === concern.nodeId);
      if (mediaItem) {
        mediaMultiplier = mediaItem.amplification;
      }

      happinessSum += contribution * concern.weight * mediaMultiplier;
      weightSum += concern.weight;
    }

    // Direct situation voter reactions
    for (const activeSit of ctx.activeSituations) {
      const sitDef = ctx.situationDefinitions.find(d => d.id === activeSit.definitionId);
      if (!sitDef) continue;
      const reaction = sitDef.voterReactions.find(r => r.groupId === vg.id);
      if (reaction) {
        happinessSum += reaction.delta * activeSit.severity;
        weightSum += Math.abs(reaction.delta);
      }
    }

    if (weightSum > 0) {
      const targetHappiness = clamp(happinessSum / weightSum, -1, 1);
      // Smooth transition (voters don't flip instantly)
      vg.happiness = lerp(vg.happiness, targetHappiness, 0.3);
    }

    // Turnout: very happy or very unhappy voters are more likely to vote
    vg.turnout = clamp(0.4 + Math.abs(vg.happiness) * 0.5 + ctx.rng() * 0.1, 0.3, 0.95);

    // Update population based on modifiers
    if (def.populationModifiers.length > 0) {
      let popMod = 0;
      for (const mod of def.populationModifiers) {
        const val = getNodeValue(mod.sourceId, ctx);
        if (val !== null) {
          popMod += (val - 0.5) * mod.weight;
        }
      }
      vg.population = clamp(def.basePopulation * (1 + popMod), def.basePopulation * 0.5, def.basePopulation * 1.5);
    }

    result.voterHappinessChanges.push({
      groupId: vg.id,
      from: vg.prevHappiness,
      to: vg.happiness,
    });
  }

  // ── Step 10: Decay media focus ──
  for (let i = ctx.mediaFocus.length - 1; i >= 0; i--) {
    ctx.mediaFocus[i].roundsRemaining--;
    if (ctx.mediaFocus[i].roundsRemaining <= 0) {
      result.mediaDecayed.push(ctx.mediaFocus[i]);
      ctx.mediaFocus.splice(i, 1);
    } else {
      // Reduce amplification over time
      ctx.mediaFocus[i].amplification = lerp(ctx.mediaFocus[i].amplification, 1, 0.3);
    }
  }

  return result;
}

// ── Situation input computation ──────────────────────────────

function computeSituationInput(sitDef: SituationDefinition, ctx: SimulationContext): number {
  let total = 0;
  let weightSum = 0;

  for (const input of sitDef.inputs) {
    const val = getNodeValue(input.sourceId, ctx);
    if (val === null) continue;
    total += val * input.weight;
    weightSum += Math.abs(input.weight);
  }

  return weightSum > 0 ? clamp(total / weightSum, 0, 1) : 0;
}

// ── Node value lookup ────────────────────────────────────────

function getNodeValue(nodeId: string, ctx: SimulationContext): number | null {
  // Check policies
  if (ctx.policies[nodeId]) return ctx.policies[nodeId].currentValue;
  // Check stats
  if (ctx.stats[nodeId]) return ctx.stats[nodeId].value;
  // Check active situations (return severity if active, 0 if not)
  const activeSit = ctx.activeSituations.find(s => s.definitionId === nodeId);
  if (activeSit) return activeSit.severity;
  // Check situation definitions (might not be active = 0)
  const sitDef = ctx.situationDefinitions.find(d => d.id === nodeId);
  if (sitDef) return 0;
  return null;
}

// ── Media cycle generation ───────────────────────────────────

export function generateMediaFocus(ctx: SimulationContext): MediaFocus | null {
  if (!ctx.config.enableMediaCycle) return null;

  // Pick a random node to spotlight
  const candidates: { nodeId: string; nodeName: string; nodeType: 'stat' | 'situation'; value: number }[] = [];

  // Active situations are newsworthy
  for (const sit of ctx.activeSituations) {
    candidates.push({
      nodeId: sit.definitionId,
      nodeName: sit.name,
      nodeType: 'situation',
      value: sit.severity,
    });
  }

  // Stats with extreme values are newsworthy
  for (const stat of Object.values(ctx.stats)) {
    if (stat.value < 0.2 || stat.value > 0.8) {
      candidates.push({
        nodeId: stat.id,
        nodeName: stat.name,
        nodeType: 'stat',
        value: stat.value,
      });
    }
    // Stats with big changes are newsworthy
    const delta = Math.abs(stat.value - stat.prevValue);
    if (delta > 0.03) {
      candidates.push({
        nodeId: stat.id,
        nodeName: stat.name,
        nodeType: 'stat',
        value: stat.value,
      });
    }
  }

  if (candidates.length === 0) return null;

  const pick = candidates[Math.floor(ctx.rng() * candidates.length)];
  const isNegative = pick.nodeType === 'situation'
    ? ctx.activeSituations.find(s => s.definitionId === pick.nodeId)?.severityType === 'crisis'
    : !ctx.stats[pick.nodeId]?.isGood
      ? pick.value > 0.5
      : pick.value < 0.5;

  const sentiment: MediaFocus['sentiment'] = isNegative ? 'negative' : 'positive';

  const headlines = {
    positive: [
      `${pick.nodeName} Shows Improvement`,
      `Positive Trend in ${pick.nodeName}`,
      `${pick.nodeName}: Good News for Australia`,
      `Experts Praise ${pick.nodeName} Progress`,
    ],
    negative: [
      `${pick.nodeName} Raises Concerns`,
      `Crisis Looms: ${pick.nodeName} Worsens`,
      `${pick.nodeName}: A Growing Problem`,
      `Australians Worried About ${pick.nodeName}`,
    ],
    neutral: [
      `${pick.nodeName} in Focus This Week`,
      `Debate Intensifies Over ${pick.nodeName}`,
    ],
  };

  const headlineList = headlines[sentiment];
  const headline = headlineList[Math.floor(ctx.rng() * headlineList.length)];

  return {
    nodeId: pick.nodeId,
    nodeName: pick.nodeName,
    nodeType: pick.nodeType,
    headline,
    sentiment,
    amplification: 1.5 + ctx.rng() * 0.5,  // 1.5x-2x amplification
    roundsRemaining: 2 + Math.floor(ctx.rng() * 2),  // 2-3 rounds
  };
}

// ── Election simulation ──────────────────────────────────────

export interface ElectionSimResult {
  seatChanges: { seatId: string; from: string | null; to: string | null }[];
  voteShare: Record<string, number>;
  voterGroupVotes: Record<string, Record<string, number>>;
  newGovernmentId: string | null;
  swingSeats: number;
}

export function simulateElection(state: GameState, voterDefs: VoterGroupDefinition[], rng: seedrandom.PRNG): ElectionSimResult {
  const result: ElectionSimResult = {
    seatChanges: [],
    voteShare: {},
    voterGroupVotes: {},
    newGovernmentId: null,
    swingSeats: 0,
  };

  const players = state.players.filter(p => p.connected || p.isAI);
  if (players.length === 0) return result;

  // Initialize vote share
  for (const p of players) {
    result.voteShare[p.id] = 0;
  }

  // Step 1: Compute how each voter group votes
  for (const vg of state.voterGroups) {
    result.voterGroupVotes[vg.id] = {};
    const def = voterDefs.find(d => d.id === vg.id);
    if (!def) continue;

    // Each voter group distributes votes based on:
    // 1. Ideology alignment with player
    // 2. Campaign influence (loyalty)
    // 3. Shadow policy appeal
    // 4. Government track record (if player is government)

    const scores: Record<string, number> = {};
    for (const p of players) {
      let score = 0;

      // Ideology alignment: how well does this player's ideology match the group's leaning?
      const socialMatch = 1 - Math.abs(
        (p.socialIdeology === 'progressive' ? 1 : -1) - def.socialLeaning
      ) / 2;
      const econMatch = 1 - Math.abs(
        (p.economicIdeology === 'interventionist' ? 1 : -1) - def.economicLeaning
      ) / 2;
      score += (socialMatch + econMatch) * 0.3;  // 30% ideology

      // Campaign influence (loyalty from campaigning)
      const loyalty = vg.loyalty[p.id] || 0;
      score += clamp(loyalty * def.persuadability, 0, 0.4);  // up to 40%

      // Shadow policy appeal: if opposition player has shadow policies, check if they match group desires
      if (!p.isGovernment) {
        let policyAppeal = 0;
        let policyCount = 0;
        for (const [policyId, proposedValue] of Object.entries(p.shadowPolicies)) {
          for (const concern of def.concerns) {
            if (concern.nodeId === policyId) {
              const desiredValue = concern.desiresHigh ? 1 : 0;
              const appeal = 1 - Math.abs(proposedValue - desiredValue);
              policyAppeal += appeal * concern.weight;
              policyCount++;
            }
          }
        }
        if (policyCount > 0) {
          score += (policyAppeal / policyCount) * 0.15;  // up to 15%
        }
      }

      // Government bonus/penalty
      if (p.isGovernment) {
        // Government gets credit/blame for current state of affairs
        score += clamp(vg.happiness * 0.2, -0.2, 0.2);  // +/- 20%
      }

      // Random noise
      score += (rng() - 0.5) * 0.05;

      scores[p.id] = Math.max(0, score);
    }

    // Normalize to vote share
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    if (totalScore > 0) {
      for (const p of players) {
        const share = scores[p.id] / totalScore;
        result.voterGroupVotes[vg.id][p.id] = share;
        // Weight by population and turnout
        result.voteShare[p.id] += share * vg.population * vg.turnout;
      }
    }
  }

  // Normalize overall vote share to percentages
  const totalVotes = Object.values(result.voteShare).reduce((a, b) => a + b, 0);
  if (totalVotes > 0) {
    for (const id of Object.keys(result.voteShare)) {
      result.voteShare[id] = result.voteShare[id] / totalVotes;
    }
  }

  // Step 2: Apply vote share to individual seats based on demographics
  for (const seat of Object.values(state.seats)) {
    const seatScores: Record<string, number> = {};

    for (const p of players) {
      let seatScore = 0;

      // Base: national vote share
      seatScore += (result.voteShare[p.id] || 0) * 50;

      // Demographic weighting: how well does this player do with the seat's voter groups?
      for (const demo of seat.demographics) {
        const groupVotes = result.voterGroupVotes[demo.groupId];
        if (groupVotes && groupVotes[p.id]) {
          seatScore += groupVotes[p.id] * demo.weight * 30;
        }
      }

      // Incumbency advantage
      if (seat.ownerPlayerId === p.id) {
        seatScore += seat.margin * 0.3;
      }

      // Random local factors
      seatScore += rng() * 5;

      seatScores[p.id] = seatScore;
    }

    // Winner takes seat
    let bestPlayer: string | null = null;
    let bestScore = -1;
    for (const [pid, score] of Object.entries(seatScores)) {
      if (score > bestScore) {
        bestScore = score;
        bestPlayer = pid;
      }
    }

    if (bestPlayer && bestPlayer !== seat.ownerPlayerId) {
      result.seatChanges.push({
        seatId: seat.id,
        from: seat.ownerPlayerId,
        to: bestPlayer,
      });
      result.swingSeats++;
    }
  }

  // Step 3: Determine new government (player with most seats after changes)
  const seatCounts: Record<string, number> = {};
  for (const p of players) {
    seatCounts[p.id] = 0;
  }
  for (const seat of Object.values(state.seats)) {
    // Apply changes
    const change = result.seatChanges.find(c => c.seatId === seat.id);
    const owner = change ? change.to : seat.ownerPlayerId;
    if (owner && seatCounts[owner] !== undefined) {
      seatCounts[owner]++;
    }
  }

  let maxSeats = 0;
  for (const [pid, count] of Object.entries(seatCounts)) {
    if (count > maxSeats) {
      maxSeats = count;
      result.newGovernmentId = pid;
    }
  }

  return result;
}

// ── Compute player approval rating ──────────────────────────

export function computeApprovalRating(
  player: Player,
  voterGroups: VoterGroupState[],
  voterDefs: VoterGroupDefinition[],
): number {
  let weightedHappiness = 0;
  let totalWeight = 0;

  for (const vg of voterGroups) {
    const def = voterDefs.find(d => d.id === vg.id);
    if (!def) continue;

    // How much does this group align with the player ideologically?
    const socialMatch = 1 - Math.abs(
      (player.socialIdeology === 'progressive' ? 1 : -1) - def.socialLeaning
    ) / 2;
    const econMatch = 1 - Math.abs(
      (player.economicIdeology === 'interventionist' ? 1 : -1) - def.economicLeaning
    ) / 2;
    const alignment = (socialMatch + econMatch) / 2;

    // Weight by alignment and population
    const weight = alignment * vg.population;
    weightedHappiness += vg.happiness * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? clamp(weightedHappiness / totalWeight, -1, 1) : 0;
}

// ── Compute ideology alignment score ─────────────────────────

export function computeIdeologyScore(
  player: Player,
  policies: Record<string, PolicySlider>,
): number {
  let score = 0;
  let count = 0;

  for (const policy of Object.values(policies)) {
    const bias = policy.ideologicalBias;
    // How much does the current policy value align with the player's ideology?
    const playerSocial = player.socialIdeology === 'progressive' ? 1 : -1;
    const playerEcon = player.economicIdeology === 'interventionist' ? 1 : -1;

    // If policy has positive social bias and player is progressive, high value = good
    // If policy has negative social bias and player is conservative, high value = good
    const socialAlignment = bias.social * playerSocial;
    const econAlignment = bias.economic * playerEcon;
    const totalBias = (socialAlignment + econAlignment) / 2;

    // Score: how much the policy value matches what the player wants
    // If totalBias > 0, player wants high value; if < 0, player wants low value
    if (totalBias > 0) {
      score += policy.currentValue * Math.abs(totalBias);
    } else {
      score += (1 - policy.currentValue) * Math.abs(totalBias);
    }
    count++;
  }

  return count > 0 ? score / count : 0;
}

// ── Tick result type ─────────────────────────────────────────

export interface SimulationTickResult {
  policyTransitions: { policyId: string; from: number; to: number }[];
  statChanges: { statId: string; from: number; to: number }[];
  situationsTriggered: ActiveSituation[];
  situationsResolved: ActiveSituation[];
  voterHappinessChanges: { groupId: string; from: number; to: number }[];
  mediaDecayed: MediaFocus[];
  budgetBalance: number;
}

// ── Budget computation ──────────────────────────────────────

export function computeBudgetBalance(policies: Record<string, PolicySlider>): number {
  let balance = 0;
  for (const policy of Object.values(policies)) {
    balance -= policy.currentValue * policy.costPerPoint;
  }
  return balance;  // negative = deficit
}

// ── Helper: get all node IDs for the web visualization ──────

export interface WebNode {
  id: string;
  type: 'policy' | 'stat' | 'situation' | 'voter_group';
  name: string;
  value: number;
  category?: string;
}

export interface WebLink {
  source: string;
  target: string;
  strength: number;  // absolute multiplier
  positive: boolean;
}

export function buildWebGraph(ctx: SimulationContext): { nodes: WebNode[]; links: WebLink[] } {
  const nodes: WebNode[] = [];
  const links: WebLink[] = [];

  // Policies
  for (const p of Object.values(ctx.policies)) {
    nodes.push({ id: p.id, type: 'policy', name: p.shortName, value: p.currentValue, category: p.category });
    for (const eff of p.effects) {
      links.push({
        source: p.id,
        target: eff.targetId,
        strength: Math.abs(eff.multiplier),
        positive: eff.multiplier > 0,
      });
    }
  }

  // Stats
  for (const s of Object.values(ctx.stats)) {
    nodes.push({ id: s.id, type: 'stat', name: s.name, value: s.value });
    for (const eff of s.effects) {
      links.push({
        source: s.id,
        target: eff.targetId,
        strength: Math.abs(eff.multiplier),
        positive: eff.multiplier > 0,
      });
    }
  }

  // Active situations
  for (const sit of ctx.activeSituations) {
    nodes.push({ id: sit.definitionId, type: 'situation', name: sit.name, value: sit.severity });
  }

  // Voter groups
  for (const vg of ctx.voterGroups) {
    nodes.push({ id: vg.id, type: 'voter_group', name: vg.name, value: (vg.happiness + 1) / 2 });
  }

  return { nodes, links };
}

// Re-export Player type for convenience
import { Player } from '../types';
