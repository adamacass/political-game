import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  GameState, GameConfig, Player, PolicySlider, PolicyAdjustment,
  PlayerAction, ActionType, ActionResult, StatDefinition,
  ActiveSituation, VoterGroupState, MediaFocus, PendingDilemma,
  ElectionResult, PlayerScore, StateCode, Phase, PolicyCategory,
  BudgetSummary, PollingSnapshot, RoundSummary, Leader, SeatId
} from '../types';
import { PolicyWeb } from './PolicyWeb';
import { Chamber } from './Chamber';
import { AustraliaMapView } from './AustraliaMapView';

// ============================================================
// PROPS
// ============================================================

interface GameBoardProps {
  gameState: GameState;
  config: GameConfig;
  playerId: string;
  onSubmitAdjustments: (adjustments: PolicyAdjustment[]) => void;
  onSubmitActions: (actions: PlayerAction[]) => void;
  onResolveDilemma: (choiceId: string) => void;
  onSendChat: (content: string, recipientId: string | null) => void;
  onForceAdvance: () => void;
}

// ============================================================
// TYPES
// ============================================================

type ActiveTab = 'web' | 'chamber' | 'map' | 'economy';

const TAB_CONFIG: { id: ActiveTab; label: string }[] = [
  { id: 'web', label: 'Policy Web' },
  { id: 'chamber', label: 'Chamber' },
  { id: 'map', label: 'Map' },
  { id: 'economy', label: 'Economy' },
];

// ============================================================
// PHASE INFO
// ============================================================

const PHASE_LABELS: Record<Phase, string> = {
  waiting: 'Waiting',
  government_action: 'Gov. Action',
  opposition_action: 'Opp. Action',
  simulation: 'Simulating',
  dilemma: 'Dilemma',
  media_cycle: 'Media Cycle',
  election: 'Election',
  election_results: 'Results',
  round_summary: 'Summary',
  game_over: 'Game Over',
};

const PHASE_COLORS: Record<Phase, string> = {
  waiting: 'bg-gray-400',
  government_action: 'bg-amber-500',
  opposition_action: 'bg-blue-500',
  simulation: 'bg-purple-500',
  dilemma: 'bg-orange-600',
  media_cycle: 'bg-yellow-500',
  election: 'bg-red-600',
  election_results: 'bg-red-500',
  round_summary: 'bg-indigo-500',
  game_over: 'bg-gray-700',
};

// ============================================================
// ACTION INFO
// ============================================================

const ACTION_TYPE_INFO: Record<ActionType, { label: string; icon: string; description: string; needsTarget: string }> = {
  campaign: { label: 'Campaign', icon: '\u{1F4E3}', description: 'Target a voter group to build loyalty', needsTarget: 'voter_group' },
  shadow_policy: { label: 'Shadow Policy', icon: '\u{1F4DC}', description: 'Propose an alternative policy position', needsTarget: 'policy' },
  attack_government: { label: 'Attack Gov.', icon: '\u2694\uFE0F', description: 'Highlight a government failure', needsTarget: 'crisis' },
  fundraise: { label: 'Fundraise', icon: '\u{1F4B0}', description: 'Raise funds for your party', needsTarget: 'none' },
  media_campaign: { label: 'Media Blitz', icon: '\u{1F4F0}', description: 'Boost visibility via media', needsTarget: 'none' },
  grassroots: { label: 'Grassroots', icon: '\u{1F331}', description: 'Cheap campaign targeting your base', needsTarget: 'voter_group' },
  coalition_deal: { label: 'Coalition', icon: '\u{1F91D}', description: 'Form an alliance', needsTarget: 'player' },
  policy_research: { label: 'Research', icon: '\u{1F4D6}', description: 'Reduce implementation delays', needsTarget: 'none' },
};

const SEVERITY_COLORS: Record<string, string> = {
  crisis: 'text-red-600 bg-red-50 border-red-200',
  problem: 'text-orange-600 bg-orange-50 border-orange-200',
  neutral: 'text-gray-600 bg-gray-50 border-gray-200',
  good: 'text-green-600 bg-green-50 border-green-200',
  boom: 'text-emerald-600 bg-emerald-50 border-emerald-200',
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function formatBudget(billions: number): string {
  if (billions === 0) return '$0B';
  const abs = Math.abs(billions);
  const sign = billions < 0 ? '-' : '';
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}T`;
  if (abs >= 1) return `${sign}$${abs.toFixed(1)}B`;
  return `${sign}$${(abs * 1000).toFixed(0)}M`;
}

function formatStatValue(stat: StatDefinition): string {
  const realValue = stat.displayMin + stat.value * (stat.displayMax - stat.displayMin);
  switch (stat.displayFormat) {
    case 'percent':
      return `${realValue.toFixed(1)}%`;
    case 'currency':
      return formatBudget(realValue);
    case 'rate':
      return `${realValue.toFixed(1)}%`;
    case 'index':
      return realValue.toFixed(0);
    default:
      return realValue.toFixed(1);
  }
}

function formatStatDelta(stat: StatDefinition): { text: string; positive: boolean; neutral: boolean } {
  const delta = stat.value - stat.prevValue;
  const realDelta = delta * (stat.displayMax - stat.displayMin);
  if (Math.abs(realDelta) < 0.05) return { text: '', positive: false, neutral: true };
  const sign = realDelta > 0 ? '+' : '';
  let text: string;
  switch (stat.displayFormat) {
    case 'percent':
    case 'rate':
      text = `${sign}${realDelta.toFixed(1)}%`;
      break;
    case 'currency':
      text = `${sign}${formatBudget(realDelta)}`;
      break;
    default:
      text = `${sign}${realDelta.toFixed(1)}`;
  }
  const positive = stat.isGood ? realDelta > 0 : realDelta < 0;
  return { text, positive, neutral: false };
}

function formatFunds(amount: number): string {
  if (Math.abs(amount) >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
  return `$${amount.toFixed(0)}`;
}

function getActionCost(type: ActionType, config: GameConfig): number {
  switch (type) {
    case 'campaign': return config.campaignCost;
    case 'attack_government': return config.attackCost;
    case 'media_campaign': return config.mediaCampaignCost;
    case 'grassroots': return config.grassrootsCost;
    case 'policy_research': return config.policyResearchCost;
    case 'fundraise': return 0;
    case 'shadow_policy': return 0;
    case 'coalition_deal': return 0;
    default: return 0;
  }
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

// ============================================================
// INLINE SUB-COMPONENTS
// ============================================================

/** Tiny inline sparkline SVG. */
function Sparkline({ data, width = 56, height = 18, color = '#3b82f6' }: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (!data || data.length < 2) return null;
  const maxVal = Math.max(...data, 0.001);
  const minVal = Math.min(...data, 0);
  const range = maxVal - minVal || 1;
  const step = width / (data.length - 1);
  const points = data.map((v, i) => {
    const x = i * step;
    const y = height - 2 - ((v - minVal) / range) * (height - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={width} height={height} className="inline-block align-middle">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Happiness bar from -1 to +1. Center is 0. */
function HappinessBar({ value, height = 8 }: { value: number; height?: number }) {
  const clamped = clamp(value, -1, 1);
  const center = 50;
  const offset = clamped * 50;
  const left = clamped >= 0 ? center : center + offset;
  const barWidth = Math.abs(offset);
  const colorClass = clamped >= 0 ? 'bg-green-500' : 'bg-red-500';

  return (
    <div className="relative w-full rounded-full overflow-hidden bg-gray-200" style={{ height }}>
      <div
        className={`absolute top-0 ${colorClass} transition-all duration-500 rounded-full`}
        style={{
          left: `${left}%`,
          width: `${barWidth}%`,
          height: '100%',
          opacity: 0.85,
        }}
      />
      <div className="absolute top-0 bg-gray-400" style={{ left: '50%', width: 1, height: '100%' }} />
    </div>
  );
}

/** Horizontal stacked bar for polling projections (seats). */
function PollingBar({ players, projectedSeats, totalSeats, majorityThreshold }: {
  players: Player[];
  projectedSeats: Record<string, number>;
  totalSeats: number;
  majorityThreshold: number;
}) {
  const entries = players
    .map(p => ({ player: p, seats: projectedSeats[p.id] ?? p.seats }))
    .sort((a, b) => b.seats - a.seats);

  const majorityPct = (majorityThreshold / totalSeats) * 100;

  return (
    <div className="relative w-full h-full flex items-center px-4 gap-2">
      <span className="text-xs font-medium text-gray-500 shrink-0 w-10">Seats</span>
      <div className="relative flex-1 h-5 rounded-md overflow-hidden bg-gray-100 flex">
        {entries.map(({ player, seats }) => {
          const pct = totalSeats > 0 ? (seats / totalSeats) * 100 : 0;
          if (pct < 0.5) return null;
          return (
            <div
              key={player.id}
              className="h-full flex items-center justify-center text-white text-[10px] font-bold transition-all duration-700 relative group"
              style={{ width: `${pct}%`, backgroundColor: player.color, minWidth: seats > 0 ? 18 : 0 }}
              title={`${player.name}: ${seats} seats`}
            >
              {pct > 4 && <span className="drop-shadow-sm">{seats}</span>}
            </div>
          );
        })}
        {/* Majority line */}
        <div
          className="absolute top-0 bottom-0 z-10"
          style={{ left: `${majorityPct}%` }}
        >
          <div className="w-0.5 h-full bg-gray-800 opacity-70" />
          <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-gray-700 whitespace-nowrap bg-white/80 px-1 rounded">{majorityThreshold}</div>
        </div>
      </div>
      <div className="flex gap-2 shrink-0 ml-2">
        {entries.slice(0, 4).map(({ player, seats }) => (
          <span key={player.id} className="flex items-center gap-1 text-xs">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: player.color }} />
            <span className="font-medium text-gray-700">{player.name}</span>
            <span className="text-gray-400">{seats}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function GameBoard({
  gameState,
  config,
  playerId,
  onSubmitAdjustments,
  onSubmitActions,
  onResolveDilemma,
  onSendChat,
  onForceAdvance,
}: GameBoardProps) {
  // ── State ──────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ActiveTab>('web');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [actionSlots, setActionSlots] = useState<PlayerAction[]>([]);
  const [pendingAdjustments, setPendingAdjustments] = useState<PolicyAdjustment[]>([]);
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [showRoundSummary, setShowRoundSummary] = useState(false);
  const [showDilemmaModal, setShowDilemmaModal] = useState(true);
  const [lastRoundCollapsed, setLastRoundCollapsed] = useState(true);

  // ── Refs ───────────────────────────────────────────────────
  const prevPhaseRef = useRef<Phase>(gameState.phase);

  // ── Derived data ───────────────────────────────────────────
  const currentPlayer = useMemo(
    () => gameState.players.find(p => p.id === playerId) || null,
    [gameState.players, playerId],
  );

  const governmentPlayer = useMemo(
    () => gameState.players.find(p => p.isGovernment) || null,
    [gameState.players],
  );

  const isGovernment = currentPlayer?.isGovernment ?? false;
  const isHost = currentPlayer?.isHost ?? false;

  const policies = useMemo(() => Object.values(gameState.policies), [gameState.policies]);
  const stats = useMemo(() => Object.values(gameState.stats), [gameState.stats]);

  const playerMap = useMemo(() => {
    const m: Record<string, Player> = {};
    gameState.players.forEach(p => { m[p.id] = p; });
    return m;
  }, [gameState.players]);

  const roundsUntilElection = useMemo(() => {
    if (config.electionCycle <= 0) return Infinity;
    const nextElection = Math.ceil(gameState.round / config.electionCycle) * config.electionCycle;
    return Math.max(0, nextElection - gameState.round);
  }, [gameState.round, config.electionCycle]);

  const latestRoundSummary = useMemo(() => {
    if (gameState.roundSummaries.length === 0) return null;
    return gameState.roundSummaries[gameState.roundSummaries.length - 1];
  }, [gameState.roundSummaries]);

  // Key stats for the dashboard bar
  const keyStat = useCallback((id: string) => {
    return gameState.stats[id] || null;
  }, [gameState.stats]);

  const gdpGrowth = keyStat('gdp_growth');
  const unemployment = keyStat('unemployment');
  const inflation = keyStat('inflation');

  const projectedSeats = useMemo(() => {
    if (gameState.currentPolling) return gameState.currentPolling.projectedSeats;
    // Fallback to actual seats
    const m: Record<string, number> = {};
    gameState.players.forEach(p => { m[p.id] = p.seats; });
    return m;
  }, [gameState.currentPolling, gameState.players]);

  // ── Phase change effects ───────────────────────────────────
  useEffect(() => {
    if (prevPhaseRef.current !== gameState.phase) {
      prevPhaseRef.current = gameState.phase;
      if (gameState.phase === 'opposition_action') {
        setActionSlots(
          Array.from({ length: config.actionsPerRound }, () => ({ type: 'fundraise' as ActionType }))
        );
      }
      if (gameState.phase === 'government_action') {
        setPendingAdjustments([]);
      }
      if (gameState.phase === 'dilemma') {
        setShowDilemmaModal(true);
      }
      if (gameState.phase === 'round_summary') {
        setShowRoundSummary(true);
      }
    }
  }, [gameState.phase, config.actionsPerRound]);

  // ── Action slot handlers ───────────────────────────────────
  const updateActionSlot = useCallback((index: number, partial: Partial<PlayerAction>) => {
    setActionSlots(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...partial };
      return next;
    });
  }, []);

  const handleSubmitActions = useCallback(() => {
    onSubmitActions(actionSlots);
  }, [actionSlots, onSubmitActions]);

  // ── Policy adjustment handlers ─────────────────────────────
  const addAdjustment = useCallback((policyId: string, newValue: number) => {
    setPendingAdjustments(prev => {
      const existing = prev.findIndex(a => a.policyId === policyId);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { policyId, newValue };
        return next;
      }
      if (prev.length >= config.policyAdjustmentsPerRound) return prev;
      return [...prev, { policyId, newValue }];
    });
  }, [config.policyAdjustmentsPerRound]);

  const removeAdjustment = useCallback((policyId: string) => {
    setPendingAdjustments(prev => prev.filter(a => a.policyId !== policyId));
  }, []);

  const handleSubmitAdjustments = useCallback(() => {
    onSubmitAdjustments(pendingAdjustments);
  }, [pendingAdjustments, onSubmitAdjustments]);

  // ── Seat click handler ─────────────────────────────────────
  const handleSeatClick = useCallback((seatId: string) => {
    setSelectedSeatId(prev => prev === seatId ? null : seatId);
  }, []);

  // ── Computed costs ─────────────────────────────────────────
  const totalActionCost = useMemo(() => {
    return actionSlots.reduce((sum, a) => sum + getActionCost(a.type, config), 0);
  }, [actionSlots, config]);

  // ============================================================
  // RENDER: TOP DASHBOARD BAR
  // ============================================================

  const renderDashboardBar = () => {
    const govLeader = governmentPlayer?.leader;
    const govSeats = governmentPlayer?.seats ?? 0;
    const phaseLabel = PHASE_LABELS[gameState.phase] || 'Unknown';
    const phaseColor = PHASE_COLORS[gameState.phase] || 'bg-gray-400';

    return (
      <div className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-6 shrink-0 shadow-sm z-20">
        {/* Left: Government info */}
        <div className="flex items-center gap-3 min-w-0">
          {govLeader && (
            <span className="text-2xl" title={govLeader.name}>{govLeader.portrait}</span>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {governmentPlayer && (
                <>
                  <span className="font-semibold text-sm text-gray-900 truncate">{governmentPlayer.name}</span>
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-white"
                    style={{ backgroundColor: governmentPlayer.color }}
                  >
                    Government
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {govLeader && <span>{govLeader.name} &middot; {govLeader.title}</span>}
              <span className="font-mono font-medium text-gray-700">{govSeats}/{gameState.totalSeats}</span>
            </div>
          </div>
        </div>

        {/* Center: Key stats */}
        <div className="flex-1 flex items-center justify-center gap-5">
          {[
            { label: 'GDP Growth', stat: gdpGrowth, fallbackValue: latestRoundSummary?.gdpGrowthPercent, fallbackDisplay: latestRoundSummary ? `${latestRoundSummary.gdpGrowthPercent > 0 ? '+' : ''}${latestRoundSummary.gdpGrowthPercent.toFixed(1)}%` : '--' },
            { label: 'Unemployment', stat: unemployment, fallbackValue: latestRoundSummary?.unemploymentPercent, fallbackDisplay: latestRoundSummary ? `${latestRoundSummary.unemploymentPercent.toFixed(1)}%` : '--' },
            { label: 'Inflation', stat: inflation, fallbackValue: latestRoundSummary?.inflationPercent, fallbackDisplay: latestRoundSummary ? `${latestRoundSummary.inflationPercent.toFixed(1)}%` : '--' },
            { label: 'Debt', stat: null, fallbackValue: gameState.budget.nationalDebt, fallbackDisplay: formatBudget(gameState.budget.nationalDebt) },
            { label: 'Deficit', stat: null, fallbackValue: gameState.budget.surplus, fallbackDisplay: formatBudget(gameState.budget.surplus) },
          ].map((item, i) => {
            const displayValue = item.stat ? formatStatValue(item.stat) : item.fallbackDisplay;
            const delta = item.stat ? formatStatDelta(item.stat) : null;
            const sparkData = item.stat && gameState.statHistory[item.stat.id];

            return (
              <div key={i} className="flex flex-col items-center min-w-0">
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{item.label}</span>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold text-gray-900 font-mono">{displayValue}</span>
                  {delta && !delta.neutral && (
                    <span className={`text-[10px] font-bold ${delta.positive ? 'text-green-600' : 'text-red-500'}`}>
                      {delta.positive ? '\u25B2' : '\u25BC'} {delta.text}
                    </span>
                  )}
                </div>
                {sparkData && sparkData.length > 1 && (
                  <Sparkline data={sparkData} width={40} height={12} color={delta && !delta.neutral ? (delta.positive ? '#16a34a' : '#ef4444') : '#94a3b8'} />
                )}
              </div>
            );
          })}
        </div>

        {/* Right: Round counter + phase */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <div className="text-sm font-semibold text-gray-900">Round {gameState.round}/{gameState.totalRounds}</div>
            <div className="text-[11px] text-gray-500">
              {roundsUntilElection === 0 ? (
                <span className="text-red-600 font-semibold">Election NOW</span>
              ) : roundsUntilElection === Infinity ? (
                'No elections'
              ) : (
                `Election in ${roundsUntilElection} round${roundsUntilElection !== 1 ? 's' : ''}`
              )}
            </div>
          </div>
          <span className={`${phaseColor} text-white text-xs font-bold px-2.5 py-1 rounded-md`}>
            {phaseLabel}
          </span>
          {isHost && (
            <button
              onClick={onForceAdvance}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:bg-blue-50 px-2 py-1 rounded transition-colors"
              title="Force advance to next phase (host only)"
            >
              Skip
            </button>
          )}
        </div>
      </div>
    );
  };

  // ============================================================
  // RENDER: POLLING BAR
  // ============================================================

  const renderPollingBar = () => (
    <div className="h-8 bg-gray-50 border-b border-gray-200 shrink-0">
      <PollingBar
        players={gameState.players}
        projectedSeats={projectedSeats}
        totalSeats={gameState.totalSeats}
        majorityThreshold={config.majorityThreshold}
      />
    </div>
  );

  // ============================================================
  // RENDER: LEFT SIDEBAR - Actions
  // ============================================================

  const renderLeftSidebar = () => {
    return (
      <div className="w-[280px] shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
        {/* Your Actions Panel */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-3 border-b border-gray-100">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Your Actions</h3>
            {currentPlayer && (
              <div className="flex items-center gap-2 mt-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: currentPlayer.color }} />
                <span className="text-sm font-semibold text-gray-800">{currentPlayer.name}</span>
                <span className="text-xs text-gray-400 ml-auto font-mono">{formatFunds(currentPlayer.funds)}</span>
              </div>
            )}
          </div>

          {/* Government action: Policy sliders */}
          {isGovernment && gameState.phase === 'government_action' && !currentPlayer?.submittedAdjustments && (
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                  Adjust Policies ({pendingAdjustments.length}/{config.policyAdjustmentsPerRound})
                </span>
              </div>
              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {policies.map(policy => {
                  const adj = pendingAdjustments.find(a => a.policyId === policy.id);
                  const adjValue = adj ? adj.newValue : policy.targetValue;
                  return (
                    <div key={policy.id} className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700 truncate flex-1">{policy.icon} {policy.shortName}</span>
                        <span className="text-[10px] text-gray-400 font-mono">{Math.round(adjValue * 100)}%</span>
                        {adj && (
                          <button
                            onClick={() => removeAdjustment(policy.id)}
                            className="ml-1 text-red-400 hover:text-red-600 text-xs"
                          >
                            &#x2715;
                          </button>
                        )}
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(adjValue * 100)}
                        onChange={e => addAdjustment(policy.id, Number(e.target.value) / 100)}
                        className="w-full h-1.5 accent-blue-600"
                      />
                      <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
                        <span>{policy.minLabel}</span>
                        <span>{policy.maxLabel}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={handleSubmitAdjustments}
                className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 rounded-lg transition-colors shadow-sm"
              >
                Submit Adjustments
              </button>
            </div>
          )}

          {/* Government already submitted */}
          {isGovernment && gameState.phase === 'government_action' && currentPlayer?.submittedAdjustments && (
            <div className="p-4 text-center">
              <div className="text-green-600 text-2xl mb-1">&#x2713;</div>
              <p className="text-sm text-gray-500">Adjustments submitted. Waiting...</p>
            </div>
          )}

          {/* Opposition action: Action tiles */}
          {!isGovernment && gameState.phase === 'opposition_action' && !currentPlayer?.submittedActions && (
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                  Actions ({actionSlots.length})
                </span>
                <span className="text-[10px] text-gray-400">
                  Cost: {formatFunds(totalActionCost)}
                </span>
              </div>
              <div className="space-y-2">
                {actionSlots.map((slot, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                    <div className="text-[10px] font-bold text-gray-400 mb-1">Action {idx + 1}</div>
                    <select
                      value={slot.type}
                      onChange={e => updateActionSlot(idx, { type: e.target.value as ActionType })}
                      className="w-full text-sm bg-white border border-gray-200 rounded px-2 py-1 text-gray-700 mb-1"
                    >
                      {(Object.keys(ACTION_TYPE_INFO) as ActionType[]).map(at => (
                        <option key={at} value={at}>
                          {ACTION_TYPE_INFO[at].icon} {ACTION_TYPE_INFO[at].label}
                          {getActionCost(at, config) > 0 ? ` (${formatFunds(getActionCost(at, config))})` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-gray-400">{ACTION_TYPE_INFO[slot.type].description}</p>

                    {/* Target selectors */}
                    {ACTION_TYPE_INFO[slot.type].needsTarget === 'voter_group' && (
                      <select
                        value={slot.targetGroupId || ''}
                        onChange={e => updateActionSlot(idx, { targetGroupId: e.target.value || undefined })}
                        className="w-full text-xs bg-white border border-gray-200 rounded px-2 py-1 mt-1 text-gray-700"
                      >
                        <option value="">Select voter group...</option>
                        {gameState.voterGroups.map(vg => (
                          <option key={vg.id} value={vg.id}>{vg.icon} {vg.name}</option>
                        ))}
                      </select>
                    )}
                    {ACTION_TYPE_INFO[slot.type].needsTarget === 'policy' && (
                      <>
                        <select
                          value={slot.targetPolicyId || ''}
                          onChange={e => updateActionSlot(idx, { targetPolicyId: e.target.value || undefined })}
                          className="w-full text-xs bg-white border border-gray-200 rounded px-2 py-1 mt-1 text-gray-700"
                        >
                          <option value="">Select policy...</option>
                          {policies.map(p => (
                            <option key={p.id} value={p.id}>{p.icon} {p.shortName}</option>
                          ))}
                        </select>
                        {slot.targetPolicyId && (
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={Math.round((slot.proposedValue ?? 0.5) * 100)}
                            onChange={e => updateActionSlot(idx, { proposedValue: Number(e.target.value) / 100 })}
                            className="w-full h-1.5 accent-blue-600 mt-1"
                          />
                        )}
                      </>
                    )}
                    {ACTION_TYPE_INFO[slot.type].needsTarget === 'player' && (
                      <select
                        value={slot.targetPlayerId || ''}
                        onChange={e => updateActionSlot(idx, { targetPlayerId: e.target.value || undefined })}
                        className="w-full text-xs bg-white border border-gray-200 rounded px-2 py-1 mt-1 text-gray-700"
                      >
                        <option value="">Select party...</option>
                        {gameState.players.filter(p => p.id !== playerId).map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    )}
                    {ACTION_TYPE_INFO[slot.type].needsTarget === 'crisis' && (
                      <select
                        value={slot.targetSituationId || ''}
                        onChange={e => updateActionSlot(idx, { targetSituationId: e.target.value || undefined })}
                        className="w-full text-xs bg-white border border-gray-200 rounded px-2 py-1 mt-1 text-gray-700"
                      >
                        <option value="">Select issue...</option>
                        {gameState.situations.filter(s => s.severityType === 'crisis' || s.severityType === 'problem').map(s => (
                          <option key={s.definitionId} value={s.definitionId}>{s.icon} {s.name}</option>
                        ))}
                        {stats.filter(s => !s.isGood ? s.value > 0.5 : s.value < 0.5).slice(0, 5).map(s => (
                          <option key={s.id} value={s.id}>{s.icon} {s.name} ({formatStatValue(s)})</option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={handleSubmitActions}
                disabled={totalActionCost > (currentPlayer?.funds ?? 0)}
                className="w-full mt-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold py-2 rounded-lg transition-colors shadow-sm"
              >
                Submit Actions
              </button>
              {totalActionCost > (currentPlayer?.funds ?? 0) && (
                <p className="text-[10px] text-red-500 mt-1 text-center">Insufficient funds</p>
              )}
            </div>
          )}

          {/* Opposition already submitted */}
          {!isGovernment && gameState.phase === 'opposition_action' && currentPlayer?.submittedActions && (
            <div className="p-4 text-center">
              <div className="text-green-600 text-2xl mb-1">&#x2713;</div>
              <p className="text-sm text-gray-500">Actions submitted. Waiting for others...</p>
            </div>
          )}

          {/* Non-action phases: Show status */}
          {gameState.phase !== 'government_action' && gameState.phase !== 'opposition_action' && (
            <div className="p-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
                <p className="text-xs text-gray-500">
                  {gameState.phase === 'simulation' && 'Policies are taking effect...'}
                  {gameState.phase === 'media_cycle' && 'Media is reporting...'}
                  {gameState.phase === 'election' && 'The nation votes!'}
                  {gameState.phase === 'election_results' && 'Counting the votes...'}
                  {gameState.phase === 'dilemma' && (isGovernment ? 'You must resolve a dilemma!' : 'Government is facing a dilemma...')}
                  {gameState.phase === 'round_summary' && 'Reviewing the round...'}
                  {gameState.phase === 'waiting' && 'Waiting for game to start...'}
                  {gameState.phase === 'game_over' && 'The game has ended.'}
                </p>
              </div>
            </div>
          )}

          {/* Active Situations */}
          {gameState.situations.length > 0 && (
            <div className="p-3 border-t border-gray-100">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Active Situations</h4>
              <div className="space-y-1">
                {gameState.situations.map(sit => (
                  <div
                    key={sit.definitionId}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs border ${SEVERITY_COLORS[sit.severityType] || SEVERITY_COLORS.neutral}`}
                  >
                    <span>{sit.icon}</span>
                    <span className="font-medium truncate">{sit.name}</span>
                    <span className="ml-auto text-[10px] opacity-70">R{sit.roundActivated}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Media Headlines */}
          {gameState.mediaFocus.length > 0 && (
            <div className="p-3 border-t border-gray-100">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Media Headlines</h4>
              <div className="space-y-1">
                {gameState.mediaFocus.map((mf, i) => (
                  <div
                    key={i}
                    className={`px-2 py-1.5 rounded text-xs border ${
                      mf.sentiment === 'negative' ? 'bg-red-50 border-red-100 text-red-700' :
                      mf.sentiment === 'positive' ? 'bg-green-50 border-green-100 text-green-700' :
                      'bg-gray-50 border-gray-100 text-gray-600'
                    }`}
                  >
                    <p className="font-medium leading-snug">{mf.headline}</p>
                    <span className="text-[10px] opacity-60">{mf.roundsRemaining}r left</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ============================================================
  // RENDER: CENTER CONTENT (Tabs)
  // ============================================================

  const renderCenterContent = () => {
    return (
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50 overflow-hidden">
        {/* Tab Bar */}
        <div className="flex items-center bg-white border-b border-gray-200 px-3 h-9 shrink-0">
          {TAB_CONFIG.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-t transition-colors relative ${
                activeTab === tab.id
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto">
          {activeTab === 'web' && (
            <PolicyWeb
              policies={gameState.policies}
              stats={gameState.stats}
              situations={gameState.situations}
              voterGroups={gameState.voterGroups}
              isGovernment={isGovernment}
              onPolicyAdjust={isGovernment && gameState.phase === 'government_action' ? addAdjustment : undefined}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
            />
          )}
          {activeTab === 'chamber' && (
            <Chamber
              gameState={gameState}
              playerId={playerId}
              selectedSeatId={selectedSeatId}
              onSeatClick={handleSeatClick}
            />
          )}
          {activeTab === 'map' && (
            <AustraliaMapView
              gameState={gameState}
              playerId={playerId}
              selectedSeatId={selectedSeatId}
              onSeatClick={handleSeatClick}
            />
          )}
          {activeTab === 'economy' && renderEconomyTab()}
        </div>
      </div>
    );
  };

  // ============================================================
  // RENDER: ECONOMY TAB
  // ============================================================

  const renderEconomyTab = () => {
    const b = gameState.budget;
    return (
      <div className="p-4 space-y-4">
        {/* Budget Summary */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-800">Federal Budget</h3>
          </div>
          <div className="grid grid-cols-3 divide-x divide-gray-100">
            {[
              { label: 'Revenue', value: b.totalRevenue, color: 'text-green-700' },
              { label: 'Expenditure', value: b.totalExpenditure, color: 'text-red-700' },
              { label: 'Surplus/Deficit', value: b.surplus, color: b.surplus >= 0 ? 'text-green-700' : 'text-red-700' },
            ].map((item, i) => (
              <div key={i} className="px-4 py-3 text-center">
                <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{item.label}</div>
                <div className={`text-lg font-bold font-mono ${item.color}`}>{formatBudget(item.value)}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100">
            {[
              { label: 'National Debt', value: formatBudget(b.nationalDebt) },
              { label: 'Debt to GDP', value: `${b.debtToGDP.toFixed(1)}%` },
              { label: 'Nominal GDP', value: formatBudget(b.gdpNominal) },
            ].map((item, i) => (
              <div key={i} className="px-4 py-3 text-center">
                <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{item.label}</div>
                <div className="text-sm font-semibold text-gray-800 font-mono">{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Stat Detail Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {stats.map(stat => {
            const delta = formatStatDelta(stat);
            const historyData = gameState.statHistory[stat.id];
            return (
              <div key={stat.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">{stat.icon} {stat.name}</span>
                  {!delta.neutral && (
                    <span className={`text-[10px] font-bold ${delta.positive ? 'text-green-600' : 'text-red-500'}`}>
                      {delta.text}
                    </span>
                  )}
                </div>
                <div className="text-xl font-bold text-gray-900 font-mono">{formatStatValue(stat)}</div>
                {historyData && historyData.length > 1 && (
                  <div className="mt-2">
                    <Sparkline
                      data={historyData}
                      width={100}
                      height={24}
                      color={!delta.neutral ? (delta.positive ? '#16a34a' : '#ef4444') : '#94a3b8'}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ============================================================
  // RENDER: RIGHT SIDEBAR - Parliament
  // ============================================================

  const renderRightSidebar = () => {
    return (
      <div className="w-[260px] shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
        {/* Parliament Panel */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-3 border-b border-gray-100">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Parliament</h3>
          </div>
          <div className="p-3 space-y-2">
            {gameState.players
              .sort((a, b) => b.seats - a.seats)
              .map(player => {
                const approval = gameState.currentPolling?.approvalRatings[player.id];
                const projSeats = projectedSeats[player.id] ?? player.seats;
                const seatDelta = projSeats - player.seats;
                const isCurrentPlayer = player.id === playerId;

                return (
                  <div
                    key={player.id}
                    className={`rounded-lg border p-2.5 transition-colors ${
                      isCurrentPlayer ? 'border-blue-200 bg-blue-50/50' : 'border-gray-100 bg-gray-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {player.leader && (
                        <span className="text-lg">{player.leader.portrait}</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: player.color }} />
                          <span className="text-xs font-bold text-gray-800 truncate">{player.name}</span>
                          {player.isGovernment && (
                            <span className="text-[9px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded font-bold">GOV</span>
                          )}
                          {isCurrentPlayer && (
                            <span className="text-[9px] bg-blue-100 text-blue-700 px-1 py-0.5 rounded font-bold">YOU</span>
                          )}
                        </div>
                        {player.leader && (
                          <p className="text-[10px] text-gray-400 truncate">{player.leader.name} &middot; {player.leader.title}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs">
                      <div>
                        <span className="text-gray-400">Seats </span>
                        <span className="font-bold text-gray-800 font-mono">{player.seats}</span>
                        {seatDelta !== 0 && (
                          <span className={`ml-0.5 text-[10px] font-bold ${seatDelta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                            ({seatDelta > 0 ? '+' : ''}{seatDelta})
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-gray-400">Funds </span>
                        <span className="font-medium text-gray-700 font-mono">{formatFunds(player.funds)}</span>
                      </div>
                      {approval !== undefined && (
                        <div>
                          <span className="text-gray-400">App. </span>
                          <span className={`font-bold font-mono ${approval >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {approval >= 0 ? '+' : ''}{(approval * 100).toFixed(0)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Last Round summary collapsible */}
          {latestRoundSummary && gameState.phase !== 'round_summary' && (
            <div className="border-t border-gray-100">
              <button
                onClick={() => setLastRoundCollapsed(p => !p)}
                className="w-full px-3 py-2 flex items-center justify-between text-xs font-bold text-gray-500 uppercase tracking-wider hover:bg-gray-50 transition-colors"
              >
                <span>Last Round</span>
                <span className="text-gray-400">{lastRoundCollapsed ? '\u25BC' : '\u25B2'}</span>
              </button>
              {!lastRoundCollapsed && (
                <div className="px-3 pb-3 space-y-2">
                  {latestRoundSummary.mediaHeadlines.length > 0 && (
                    <div>
                      <p className="text-[10px] text-gray-400 mb-1">Headlines</p>
                      {latestRoundSummary.mediaHeadlines.slice(0, 3).map((h, i) => (
                        <p key={i} className="text-xs text-gray-600 leading-snug">&bull; {h}</p>
                      ))}
                    </div>
                  )}
                  {latestRoundSummary.policiesChanged.length > 0 && (
                    <div>
                      <p className="text-[10px] text-gray-400 mb-1">Policy Changes</p>
                      {latestRoundSummary.policiesChanged.map((pc, i) => (
                        <p key={i} className="text-xs text-gray-600">
                          {pc.policyName}: {Math.round(pc.oldValue * 100)}% &rarr; {Math.round(pc.newValue * 100)}%
                        </p>
                      ))}
                    </div>
                  )}
                  {latestRoundSummary.oppositionActions.length > 0 && (
                    <div>
                      <p className="text-[10px] text-gray-400 mb-1">Opposition Moves</p>
                      {latestRoundSummary.oppositionActions.map((oa, i) => (
                        <div key={i} className="text-xs text-gray-600">
                          <span className="font-medium">{oa.playerName}</span>: {oa.actions.join(', ')}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ============================================================
  // RENDER: BOTTOM VOTER STRIP
  // ============================================================

  const renderVoterStrip = () => {
    return (
      <div className="h-[100px] bg-white border-t border-gray-200 shrink-0 flex items-center overflow-x-auto px-3 gap-2">
        {gameState.voterGroups.map(vg => {
          const myPolling = vg.partyPolling[playerId] ?? 0;
          const happinessColor = vg.happiness >= 0.1 ? 'border-green-200 bg-green-50/30' :
                                 vg.happiness <= -0.1 ? 'border-red-200 bg-red-50/30' :
                                 'border-gray-200 bg-gray-50/30';
          const happinessDelta = vg.happiness - vg.prevHappiness;

          return (
            <div
              key={vg.id}
              className={`shrink-0 w-[140px] rounded-lg border p-2 ${happinessColor} transition-colors`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm">{vg.icon}</span>
                <span className="text-[11px] font-semibold text-gray-800 truncate">{vg.name}</span>
              </div>
              <HappinessBar value={vg.happiness} height={6} />
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-gray-500">
                  You: <span className="font-bold text-gray-700">{(myPolling * 100).toFixed(0)}%</span>
                </span>
                {Math.abs(happinessDelta) > 0.01 && (
                  <span className={`text-[10px] font-bold ${happinessDelta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {happinessDelta > 0 ? '\u25B2' : '\u25BC'} {Math.abs(happinessDelta * 100).toFixed(0)}
                  </span>
                )}
              </div>
              <div className="text-[9px] text-gray-400 mt-0.5">
                Pop: {(vg.population * 100).toFixed(0)}% &middot; Turnout: {(vg.turnout * 100).toFixed(0)}%
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ============================================================
  // RENDER: ROUND SUMMARY MODAL
  // ============================================================

  const renderRoundSummaryModal = () => {
    if (gameState.phase !== 'round_summary' || !showRoundSummary || !latestRoundSummary) return null;
    const rs = latestRoundSummary;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Round {rs.round} Summary</h2>
                <p className="text-xs text-gray-500">Government: {rs.governmentPlayerName}</p>
              </div>
              <span className="text-3xl font-bold text-indigo-200">R{rs.round}</span>
            </div>
            {/* Key headline */}
            {rs.mediaHeadlines.length > 0 && (
              <div className="mt-2 bg-white/70 rounded-lg px-3 py-2 border border-indigo-100">
                <p className="text-sm font-semibold text-gray-800">{rs.mediaHeadlines[0]}</p>
              </div>
            )}
          </div>

          {/* Economy Snapshot */}
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Economy</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'GDP Growth', value: `${rs.gdpGrowthPercent >= 0 ? '+' : ''}${rs.gdpGrowthPercent.toFixed(1)}%`, good: rs.gdpGrowthPercent > 0 },
                { label: 'Unemployment', value: `${rs.unemploymentPercent.toFixed(1)}%`, good: rs.unemploymentPercent < 5 },
                { label: 'Inflation', value: `${rs.inflationPercent.toFixed(1)}%`, good: rs.inflationPercent < 3.5 && rs.inflationPercent > 1 },
                { label: 'Debt', value: formatBudget(rs.debtBillions), good: false },
                { label: 'Deficit', value: formatBudget(rs.deficitBillions), good: rs.deficitBillions >= 0 },
                { label: 'GDP', value: formatBudget(rs.gdpBillions), good: true },
              ].map((item, i) => (
                <div key={i} className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                  <div className="text-[10px] text-gray-400 uppercase">{item.label}</div>
                  <div className={`text-sm font-bold font-mono ${item.good ? 'text-green-700' : 'text-gray-800'}`}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Policy Changes */}
          {rs.policiesChanged.length > 0 && (
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Policy Changes</h3>
              <div className="space-y-1">
                {rs.policiesChanged.map((pc, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{pc.policyName}</span>
                    <span className="font-mono text-xs">
                      <span className="text-gray-400">{Math.round(pc.oldValue * 100)}%</span>
                      <span className="mx-1 text-gray-300">&rarr;</span>
                      <span className="font-bold text-gray-800">{Math.round(pc.newValue * 100)}%</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Situations */}
          {(rs.situationsTriggered.length > 0 || rs.situationsResolved.length > 0) && (
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Situations</h3>
              {rs.situationsTriggered.map((s, i) => (
                <div key={`t-${i}`} className="flex items-center gap-2 text-sm text-red-600 mb-1">
                  <span className="text-red-400">&#x26A0;</span> <span className="font-medium">{s}</span> <span className="text-[10px] text-gray-400">triggered</span>
                </div>
              ))}
              {rs.situationsResolved.map((s, i) => (
                <div key={`r-${i}`} className="flex items-center gap-2 text-sm text-green-600 mb-1">
                  <span className="text-green-400">&#x2713;</span> <span className="font-medium">{s}</span> <span className="text-[10px] text-gray-400">resolved</span>
                </div>
              ))}
            </div>
          )}

          {/* Dilemma resolved */}
          {rs.dilemmaResolved && (
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Dilemma Resolved</h3>
              <p className="text-sm text-gray-700">
                <span className="font-semibold">{rs.dilemmaResolved.name}</span>: chose "{rs.dilemmaResolved.choiceLabel}"
              </p>
            </div>
          )}

          {/* Voter Group Movements */}
          {rs.voterGroupChanges.length > 0 && (
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Voter Movements</h3>
              <div className="grid grid-cols-2 gap-1.5">
                {rs.voterGroupChanges.map((vc, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1">
                    <span className="text-gray-600">{vc.groupName}</span>
                    <span className={`font-bold font-mono ${vc.happinessDelta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {vc.happinessDelta >= 0 ? '+' : ''}{(vc.happinessDelta * 100).toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Polling Projection */}
          {Object.keys(rs.pollingProjection).length > 0 && (
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Polling Projection</h3>
              <div className="flex gap-3 flex-wrap">
                {gameState.players
                  .sort((a, b) => (rs.pollingProjection[b.id] ?? 0) - (rs.pollingProjection[a.id] ?? 0))
                  .map(player => {
                    const projSeats = rs.pollingProjection[player.id] ?? 0;
                    return (
                      <div key={player.id} className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-3 py-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: player.color }} />
                        <span className="text-xs font-medium text-gray-700">{player.name}</span>
                        <span className="text-sm font-bold text-gray-900 font-mono">{projSeats}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Opposition Actions */}
          {rs.oppositionActions.length > 0 && (
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Opposition Actions</h3>
              {rs.oppositionActions.map((oa, i) => (
                <div key={i} className="text-sm text-gray-700 mb-1">
                  <span className="font-semibold">{oa.playerName}</span>: {oa.actions.join(' / ')}
                </div>
              ))}
            </div>
          )}

          {/* Continue Button */}
          <div className="px-6 py-4 flex justify-end">
            <button
              onClick={() => {
                setShowRoundSummary(false);
                onForceAdvance();
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors shadow-sm"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // RENDER: DILEMMA MODAL
  // ============================================================

  const renderDilemmaModal = () => {
    if (gameState.phase !== 'dilemma' || !isGovernment || !gameState.pendingDilemma || !showDilemmaModal) return null;
    const d = gameState.pendingDilemma;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full mx-4 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-5 text-white">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{d.icon}</span>
              <div>
                <h2 className="text-lg font-bold">{d.name}</h2>
                <p className="text-sm text-orange-100">{d.headline}</p>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="px-6 py-4 border-b border-gray-100">
            <p className="text-sm text-gray-700 leading-relaxed">{d.description}</p>
          </div>

          {/* Choices */}
          <div className="px-6 py-4 space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Your Decision</h3>
            {d.choices.map(choice => (
              <button
                key={choice.id}
                onClick={() => {
                  setShowDilemmaModal(false);
                  onResolveDilemma(choice.id);
                }}
                className="w-full text-left bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-xl p-4 transition-all group"
              >
                <div className="font-semibold text-sm text-gray-900 group-hover:text-blue-700 transition-colors">
                  {choice.label}
                </div>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{choice.description}</p>
                {/* Effects preview */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {choice.effects.slice(0, 4).map((eff, i) => (
                    <span
                      key={i}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        eff.delta >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {eff.nodeId}: {eff.delta >= 0 ? '+' : ''}{(eff.delta * 100).toFixed(0)}
                    </span>
                  ))}
                  {choice.voterReactions.slice(0, 3).map((vr, i) => (
                    <span
                      key={`vr-${i}`}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        vr.delta >= 0 ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                      }`}
                    >
                      {vr.groupId}: {vr.delta >= 0 ? '+' : ''}{(vr.delta * 100).toFixed(0)}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // RENDER: GAME OVER OVERLAY
  // ============================================================

  const renderGameOver = () => {
    if (gameState.phase !== 'game_over' || !gameState.finalScores) return null;
    const sortedScores = [...gameState.finalScores].sort((a, b) => b.total - a.total);
    const winner = sortedScores[0];

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
          <div className="bg-gradient-to-r from-yellow-400 to-amber-500 px-6 py-5 text-center">
            <h2 className="text-2xl font-bold text-white">Game Over</h2>
            {winner && (
              <p className="text-amber-100 text-sm mt-1">
                <span className="font-bold text-white">{winner.partyName}</span> wins with {winner.total.toFixed(0)} points!
              </p>
            )}
          </div>
          <div className="px-6 py-4 space-y-2">
            {sortedScores.map((score, rank) => (
              <div
                key={score.playerId}
                className={`flex items-center gap-3 p-3 rounded-lg ${rank === 0 ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50 border border-gray-100'}`}
              >
                <span className={`text-lg font-bold ${rank === 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                  #{rank + 1}
                </span>
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: score.color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-800">{score.partyName}</div>
                  <div className="text-[10px] text-gray-400">
                    {score.seats} seats &middot; {(score.voteShare * 100).toFixed(1)}% vote
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900 font-mono">{score.total.toFixed(0)}</div>
                  <div className="text-[9px] text-gray-400">points</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // MAIN RENDER
  // ============================================================

  return (
    <div className="flex flex-col w-full h-screen overflow-hidden bg-gray-100 text-gray-900" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      {/* 1. Top Dashboard Bar */}
      {renderDashboardBar()}

      {/* 2. Polling Bar */}
      {renderPollingBar()}

      {/* 3. Main Content Row */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {renderLeftSidebar()}
        {renderCenterContent()}
        {renderRightSidebar()}
      </div>

      {/* 4. Bottom Voter Strip */}
      {renderVoterStrip()}

      {/* 5. Round Summary Modal */}
      {renderRoundSummaryModal()}

      {/* 6. Dilemma Modal */}
      {renderDilemmaModal()}

      {/* 7. Game Over Overlay */}
      {renderGameOver()}
    </div>
  );
}
