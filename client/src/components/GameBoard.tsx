import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  GameState, GameConfig, Player, PolicySlider, PolicyAdjustment,
  PlayerAction, ActionType, StatDefinition,
  ActiveSituation, VoterGroupState, MediaFocus, PendingDilemma,
  ElectionResult, PlayerScore, Phase, PolicyCategory,
  BudgetSummary, PollingSnapshot, RoundSummary, Leader,
  ParliamentaryBill, BillVote, DetailedElectionResult,
  EconomicSector, BudgetLineItem,
} from '../types';
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
  onSubmitBillVote: (billId: string, vote: 'aye' | 'nay' | 'abstain') => void;
  onSendChat: (content: string, recipientId: string | null) => void;
  onForceAdvance: () => void;
}

// ============================================================
// CONSTANTS
// ============================================================

type ActiveTab = 'dashboard' | 'policies' | 'chamber' | 'economy' | 'election';

const TAB_CONFIG: { id: ActiveTab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'policies', label: 'Policies' },
  { id: 'chamber', label: 'Chamber' },
  { id: 'economy', label: 'Economy' },
  { id: 'election', label: 'Election' },
];

const PHASE_LABELS: Record<Phase, string> = {
  waiting: 'Waiting',
  government_action: 'Gov. Action',
  parliament_vote: 'Parliament Vote',
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
  parliament_vote: 'bg-violet-600',
  opposition_action: 'bg-blue-500',
  simulation: 'bg-purple-500',
  dilemma: 'bg-orange-600',
  media_cycle: 'bg-yellow-500',
  election: 'bg-red-600',
  election_results: 'bg-red-500',
  round_summary: 'bg-indigo-500',
  game_over: 'bg-gray-700',
};

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
  crisis: 'text-red-700 bg-red-50 border-red-200',
  problem: 'text-orange-700 bg-orange-50 border-orange-200',
  neutral: 'text-gray-600 bg-gray-50 border-gray-200',
  good: 'text-green-700 bg-green-50 border-green-200',
  boom: 'text-emerald-700 bg-emerald-50 border-emerald-200',
};

const CATEGORY_LABELS: Record<PolicyCategory, { label: string; icon: string }> = {
  tax: { label: 'Taxation', icon: '\u{1F4B5}' },
  economy: { label: 'Economy', icon: '\u{1F4C8}' },
  welfare: { label: 'Welfare', icon: '\u{1F91D}' },
  health: { label: 'Health', icon: '\u{1F3E5}' },
  education: { label: 'Education', icon: '\u{1F393}' },
  law_order: { label: 'Law & Order', icon: '\u2696\uFE0F' },
  infrastructure: { label: 'Infrastructure', icon: '\u{1F3D7}\uFE0F' },
  environment: { label: 'Environment', icon: '\u{1F333}' },
  foreign: { label: 'Foreign Affairs', icon: '\u{1F30F}' },
  immigration: { label: 'Immigration', icon: '\u{1F6C2}' },
  housing: { label: 'Housing', icon: '\u{1F3E0}' },
  digital: { label: 'Digital', icon: '\u{1F4BB}' },
  agriculture: { label: 'Agriculture', icon: '\u{1F33E}' },
};

const SECTOR_LABELS: Record<EconomicSector, string> = {
  mining: 'Mining',
  finance: 'Finance',
  healthcare: 'Healthcare',
  education_sector: 'Education',
  construction: 'Construction',
  manufacturing: 'Manufacturing',
  agriculture_sector: 'Agriculture',
  technology: 'Technology',
  tourism: 'Tourism',
  public_admin: 'Public Admin',
};

const SECTOR_COLORS: Record<EconomicSector, string> = {
  mining: '#d97706',
  finance: '#2563eb',
  healthcare: '#dc2626',
  education_sector: '#7c3aed',
  construction: '#ea580c',
  manufacturing: '#475569',
  agriculture_sector: '#16a34a',
  technology: '#0891b2',
  tourism: '#e11d48',
  public_admin: '#64748b',
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
    case 'percent': return `${realValue.toFixed(1)}%`;
    case 'currency': return formatBudget(realValue);
    case 'rate': return `${realValue.toFixed(2)}%`;
    case 'index': return realValue.toFixed(0);
    default: return realValue.toFixed(1);
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
// INLINE CHART COMPONENTS
// ============================================================

/** Tiny sparkline for the dashboard bar. */
function Sparkline({ data, width = 56, height = 18, color = '#3b82f6' }: {
  data: number[]; width?: number; height?: number; color?: string;
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
      <polyline points={points} fill="none" stroke={color}
        strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Multi-line chart for the economy tab. */
function LineChart({ series, labels, width = 520, height = 200 }: {
  series: { data: number[]; color: string; label: string }[];
  labels?: string[];
  width?: number;
  height?: number;
}) {
  const allValues = series.flatMap(s => s.data);
  if (allValues.length === 0) return null;
  const maxVal = Math.max(...allValues, 0.001);
  const minVal = Math.min(...allValues, 0);
  const range = maxVal - minVal || 1;
  const pad = { top: 20, right: 16, bottom: 28, left: 48 };
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;
  const maxLen = Math.max(...series.map(s => s.data.length));
  const stepX = maxLen > 1 ? cw / (maxLen - 1) : 0;

  const gridLines = 4;
  const gridVals = Array.from({ length: gridLines + 1 }, (_, i) => minVal + (range * i) / gridLines);

  return (
    <svg width={width} height={height} className="block">
      {/* Grid lines */}
      {gridVals.map((gv, i) => {
        const y = pad.top + ch - ((gv - minVal) / range) * ch;
        return (
          <g key={i}>
            <line x1={pad.left} y1={y} x2={width - pad.right} y2={y}
              stroke="#e5e7eb" strokeWidth="1" />
            <text x={pad.left - 4} y={y + 3} textAnchor="end"
              fill="#9ca3af" fontSize="9" fontFamily="monospace">
              {gv.toFixed(1)}
            </text>
          </g>
        );
      })}
      {/* Series lines */}
      {series.map((s, si) => {
        if (s.data.length < 2) return null;
        const pts = s.data.map((v, i) => {
          const x = pad.left + i * stepX;
          const y = pad.top + ch - ((v - minVal) / range) * ch;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ');
        return <polyline key={si} points={pts} fill="none" stroke={s.color}
          strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />;
      })}
      {/* X-axis labels */}
      {labels && labels.map((l, i) => (
        <text key={i} x={pad.left + i * stepX} y={height - 4}
          textAnchor="middle" fill="#9ca3af" fontSize="9" fontFamily="monospace">
          {l}
        </text>
      ))}
      {/* Legend */}
      {series.map((s, si) => (
        <g key={`leg-${si}`} transform={`translate(${pad.left + si * 90}, ${height - 16})`}>
          <line x1="0" y1="0" x2="12" y2="0" stroke={s.color} strokeWidth="2" />
          <text x="16" y="3" fill="#6b7280" fontSize="9">{s.label}</text>
        </g>
      ))}
    </svg>
  );
}

/** Horizontal bar chart for budget items. */
function HorizontalBarChart({ items, maxValue, width = 400 }: {
  items: { label: string; value: number; color: string; change?: number }[];
  maxValue: number;
  width?: number;
}) {
  const barH = 22;
  const labelW = 120;
  const valueW = 60;
  const barW = width - labelW - valueW - 16;

  return (
    <div className="space-y-1">
      {items.map((item, i) => {
        const pct = maxValue > 0 ? Math.abs(item.value) / maxValue : 0;
        return (
          <div key={i} className="flex items-center gap-2" style={{ height: barH }}>
            <span className="text-xs text-gray-600 truncate" style={{ width: labelW }}>
              {item.label}
            </span>
            <div className="flex-1 bg-gray-100 rounded-sm overflow-hidden" style={{ height: 14 }}>
              <div className="h-full rounded-sm transition-all duration-500"
                style={{ width: `${pct * 100}%`, backgroundColor: item.color }} />
            </div>
            <span className="text-xs font-mono text-gray-700 text-right" style={{ width: valueW }}>
              {formatBudget(item.value)}
              {item.change !== undefined && item.change !== 0 && (
                <span className={`ml-1 text-[10px] ${item.change > 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {item.change > 0 ? '+' : ''}{formatBudget(item.change)}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Happiness bar from -1 to +1. */
function HappinessBar({ value, height = 8 }: { value: number; height?: number }) {
  const clamped = clamp(value, -1, 1);
  const center = 50;
  const offset = clamped * 50;
  const left = clamped >= 0 ? center : center + offset;
  const barWidth = Math.abs(offset);
  const colorClass = clamped >= 0 ? 'bg-green-500' : 'bg-red-500';
  return (
    <div className="relative w-full rounded-full overflow-hidden bg-gray-200" style={{ height }}>
      <div className={`absolute top-0 ${colorClass} transition-all duration-500 rounded-full`}
        style={{ left: `${left}%`, width: `${barWidth}%`, height: '100%', opacity: 0.85 }} />
      <div className="absolute top-0 bg-gray-400" style={{ left: '50%', width: 1, height: '100%' }} />
    </div>
  );
}

/** Horizontal stacked bar for polling projections (seats). */
function PollingBar({ players, projectedSeats, totalSeats, majorityThreshold }: {
  players: Player[]; projectedSeats: Record<string, number>; totalSeats: number; majorityThreshold: number;
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
            <div key={player.id}
              className="h-full flex items-center justify-center text-white text-[10px] font-bold transition-all duration-700"
              style={{ width: `${pct}%`, backgroundColor: player.color, minWidth: seats > 0 ? 18 : 0 }}
              title={`${player.name}: ${seats} seats`}>
              {pct > 4 && <span className="drop-shadow-sm">{seats}</span>}
            </div>
          );
        })}
        <div className="absolute top-0 bottom-0 z-10" style={{ left: `${majorityPct}%` }}>
          <div className="w-0.5 h-full bg-gray-800 opacity-70" />
          <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-gray-700 whitespace-nowrap bg-white/80 px-1 rounded">
            {majorityThreshold}
          </div>
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
  gameState, config, playerId,
  onSubmitAdjustments, onSubmitActions, onResolveDilemma,
  onSubmitBillVote, onSendChat, onForceAdvance,
}: GameBoardProps) {

  // -- State --
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [actionSlots, setActionSlots] = useState<PlayerAction[]>([]);
  const [pendingAdjustments, setPendingAdjustments] = useState<PolicyAdjustment[]>([]);
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [expandedPolicyId, setExpandedPolicyId] = useState<string | null>(null);
  const [showRoundSummary, setShowRoundSummary] = useState(false);
  const [showDilemmaModal, setShowDilemmaModal] = useState(true);
  const [showElectionModal, setShowElectionModal] = useState(false);
  const prevPhaseRef = useRef<Phase>(gameState.phase);

  // -- Derived --
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

  const keyStat = useCallback((id: string) => gameState.stats[id] || null, [gameState.stats]);

  const gdpGrowth = keyStat('gdp_growth');
  const unemployment = keyStat('unemployment');
  const inflation = keyStat('inflation');

  const projectedSeats = useMemo(() => {
    if (gameState.currentPolling) return gameState.currentPolling.projectedSeats;
    const m: Record<string, number> = {};
    gameState.players.forEach(p => { m[p.id] = p.seats; });
    return m;
  }, [gameState.currentPolling, gameState.players]);

  const policiesByCategory = useMemo(() => {
    const map: Partial<Record<PolicyCategory, PolicySlider[]>> = {};
    policies.forEach(p => {
      if (!map[p.category]) map[p.category] = [];
      map[p.category]!.push(p);
    });
    return map;
  }, [policies]);

  const latestElection = useMemo(() => {
    if (gameState.detailedElectionHistory.length === 0) return null;
    return gameState.detailedElectionHistory[gameState.detailedElectionHistory.length - 1];
  }, [gameState.detailedElectionHistory]);

  const hasElectionData = gameState.detailedElectionHistory.length > 0;

  // -- Phase change effects --
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
        setExpandedPolicyId(null);
      }
      if (gameState.phase === 'dilemma') setShowDilemmaModal(true);
      if (gameState.phase === 'round_summary') setShowRoundSummary(true);
      if (gameState.phase === 'election_results') setShowElectionModal(true);
    }
  }, [gameState.phase, config.actionsPerRound]);

  // -- Handlers --
  const updateActionSlot = useCallback((index: number, partial: Partial<PlayerAction>) => {
    setActionSlots(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...partial };
      return next;
    });
  }, []);

  const handleSubmitActions = useCallback(() => onSubmitActions(actionSlots), [actionSlots, onSubmitActions]);

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

  const handleSubmitAdjustments = useCallback(() => onSubmitAdjustments(pendingAdjustments), [pendingAdjustments, onSubmitAdjustments]);

  const handleSeatClick = useCallback((seatId: string) => {
    setSelectedSeatId(prev => prev === seatId ? null : seatId);
  }, []);

  const totalActionCost = useMemo(() => {
    return actionSlots.reduce((sum, a) => sum + getActionCost(a.type, config), 0);
  }, [actionSlots, config]);

  const totalCapitalCost = useMemo(() => {
    return pendingAdjustments.reduce((sum, adj) => {
      const policy = gameState.policies[adj.policyId];
      if (!policy) return sum;
      const delta = Math.abs(adj.newValue - policy.currentValue);
      return sum + Math.ceil(delta * 10);
    }, 0);
  }, [pendingAdjustments, gameState.policies]);

  // ============================================================
  // TOP DASHBOARD BAR
  // ============================================================

  const renderDashboardBar = () => {
    const govLeader = governmentPlayer?.leader;
    const phaseLabel = PHASE_LABELS[gameState.phase] || 'Unknown';
    const phaseColor = PHASE_COLORS[gameState.phase] || 'bg-gray-400';
    const b = gameState.budget;

    const dashItems: { label: string; stat: StatDefinition | null; value: string; historyKey?: string; isGoodOverride?: boolean }[] = [
      { label: 'GDP Growth', stat: gdpGrowth, value: gdpGrowth ? formatStatValue(gdpGrowth) : latestRoundSummary ? `${latestRoundSummary.gdpGrowthPercent.toFixed(1)}%` : '--', historyKey: 'gdp_growth' },
      { label: 'Unemployment', stat: unemployment, value: unemployment ? formatStatValue(unemployment) : latestRoundSummary ? `${latestRoundSummary.unemploymentPercent.toFixed(1)}%` : '--', historyKey: 'unemployment' },
      { label: 'Inflation', stat: inflation, value: inflation ? formatStatValue(inflation) : latestRoundSummary ? `${latestRoundSummary.inflationPercent.toFixed(1)}%` : '--', historyKey: 'inflation' },
      { label: 'Debt', stat: null, value: formatBudget(b.nationalDebt) },
      { label: 'Cash Rate', stat: null, value: `${b.cashRate.toFixed(2)}%` },
      { label: 'AUD/USD', stat: null, value: b.exchangeRate.toFixed(4) },
    ];

    return (
      <div className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-6 shrink-0 shadow-sm z-20">
        {/* Left: Government info */}
        <div className="flex items-center gap-3 min-w-0">
          {govLeader && <span className="text-2xl" title={govLeader.name}>{govLeader.portrait}</span>}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {governmentPlayer && (
                <>
                  <span className="font-semibold text-sm text-gray-900 truncate">{governmentPlayer.name}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-white"
                    style={{ backgroundColor: governmentPlayer.color }}>Government</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {govLeader && <span>{govLeader.name}</span>}
              <span className="font-mono font-medium text-gray-700">
                {governmentPlayer?.seats ?? 0}/{gameState.totalSeats}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Key stats */}
        <div className="flex-1 flex items-center justify-center gap-5">
          {dashItems.map((item, i) => {
            const delta = item.stat ? formatStatDelta(item.stat) : null;
            const sparkData = item.historyKey ? gameState.statHistory[item.historyKey] : undefined;
            return (
              <div key={i} className="flex flex-col items-center min-w-0">
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{item.label}</span>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold text-gray-900 font-mono">{item.value}</span>
                  {delta && !delta.neutral && (
                    <span className={`text-[10px] font-bold ${delta.positive ? 'text-green-600' : 'text-red-500'}`}>
                      {delta.positive ? '\u25B2' : '\u25BC'} {delta.text}
                    </span>
                  )}
                </div>
                {sparkData && sparkData.length > 1 && (
                  <Sparkline data={sparkData} width={40} height={12}
                    color={delta && !delta.neutral ? (delta.positive ? '#16a34a' : '#ef4444') : '#94a3b8'} />
                )}
              </div>
            );
          })}
        </div>

        {/* Right: Round + Phase */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <div className="text-sm font-semibold text-gray-900">Round {gameState.round}/{gameState.totalRounds}</div>
            <div className="text-[11px] text-gray-500">
              {roundsUntilElection === 0 ? (
                <span className="text-red-600 font-semibold">Election NOW</span>
              ) : roundsUntilElection === Infinity ? 'No elections' : (
                `Election in ${roundsUntilElection} round${roundsUntilElection !== 1 ? 's' : ''}`
              )}
            </div>
          </div>
          <span className={`${phaseColor} text-white text-xs font-bold px-2.5 py-1 rounded-md`}>{phaseLabel}</span>
          {isHost && (
            <button onClick={onForceAdvance}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:bg-blue-50 px-2 py-1 rounded transition-colors"
              title="Force advance to next phase (host only)">Skip</button>
          )}
        </div>
      </div>
    );
  };

  // ============================================================
  // POLLING BAR
  // ============================================================

  const renderPollingBar = () => (
    <div className="h-8 bg-gray-50 border-b border-gray-200 shrink-0">
      <PollingBar players={gameState.players} projectedSeats={projectedSeats}
        totalSeats={gameState.totalSeats} majorityThreshold={config.majorityThreshold} />
    </div>
  );

  // ============================================================
  // LEFT SIDEBAR -- Actions
  // ============================================================

  const renderLeftSidebar = () => {
    const showPanel = gameState.phase === 'government_action' || gameState.phase === 'opposition_action' || gameState.phase === 'parliament_vote';
    if (!showPanel) return null;

    return (
      <div className="w-[280px] shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="p-3 border-b border-gray-100">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Your Actions</h3>
            {currentPlayer && (
              <div className="flex items-center gap-2 mt-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: currentPlayer.color }} />
                <span className="text-sm font-semibold text-gray-800">{currentPlayer.name}</span>
                <span className="text-xs text-gray-400 ml-auto font-mono">{formatFunds(currentPlayer.funds)}</span>
                <span className="text-xs text-violet-500 font-mono" title="Political Capital">
                  {currentPlayer.politicalCapital} PC
                </span>
              </div>
            )}
          </div>

          {/* GOVERNMENT ACTION PHASE */}
          {isGovernment && gameState.phase === 'government_action' && !currentPlayer?.submittedAdjustments && (
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                  Adjustments ({pendingAdjustments.length}/{config.policyAdjustmentsPerRound})
                </span>
                <span className="text-[10px] text-violet-600 font-mono">Cost: {totalCapitalCost} PC</span>
              </div>
              {/* Pending adjustments */}
              {pendingAdjustments.length > 0 && (
                <div className="mb-3 space-y-1">
                  {pendingAdjustments.map(adj => {
                    const pol = gameState.policies[adj.policyId];
                    if (!pol) return null;
                    return (
                      <div key={adj.policyId} className="flex items-center justify-between bg-amber-50 rounded px-2 py-1 border border-amber-100">
                        <span className="text-xs text-amber-800 font-medium truncate flex-1">
                          {pol.icon} {pol.shortName}
                        </span>
                        <span className="text-[10px] font-mono text-gray-500 mx-2">
                          {Math.round(pol.currentValue * 100)}% &rarr; {Math.round(adj.newValue * 100)}%
                        </span>
                        <button onClick={() => removeAdjustment(adj.policyId)}
                          className="text-red-400 hover:text-red-600 text-xs ml-1">&times;</button>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-[10px] text-gray-400 mb-2">Go to the Policies tab to adjust sliders.</p>
              <button onClick={handleSubmitAdjustments}
                disabled={pendingAdjustments.length === 0}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold py-2 rounded-lg transition-colors shadow-sm">
                Submit Adjustments
              </button>
            </div>
          )}

          {isGovernment && gameState.phase === 'government_action' && currentPlayer?.submittedAdjustments && (
            <div className="p-4 text-center">
              <div className="text-green-600 text-2xl mb-1">&#x2713;</div>
              <p className="text-sm text-gray-500">Adjustments submitted. Waiting...</p>
            </div>
          )}

          {/* PARLIAMENT VOTE PHASE */}
          {gameState.phase === 'parliament_vote' && gameState.pendingBill && (() => {
            const bill = gameState.pendingBill!;
            const myVote = bill.votes[playerId];
            const hasVoted = myVote && myVote !== 'pending';
            return (
              <div className="p-3">
                <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{bill.icon}</span>
                    <div>
                      <h4 className="text-sm font-bold text-violet-900">{bill.name}</h4>
                      <p className="text-[10px] text-violet-600">Proposed by {bill.proposedByName}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-2 leading-relaxed">{bill.description}</p>
                  {bill.effects.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {bill.effects.slice(0, 4).map((eff, i) => (
                        <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${eff.delta >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {eff.targetId}: {eff.delta >= 0 ? '+' : ''}{(eff.delta * 100).toFixed(0)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {/* Vote progress */}
                <div className="flex items-center gap-3 mb-3 text-xs">
                  <span className="text-green-700 font-bold">AYE: {bill.votesFor}</span>
                  <span className="text-red-700 font-bold">NAY: {bill.votesAgainst}</span>
                  <span className="text-gray-500">ABS: {bill.abstentions}</span>
                </div>
                {/* Other votes */}
                <div className="space-y-1 mb-3">
                  {gameState.players.filter(p => p.id !== playerId).map(p => {
                    const v = bill.votes[p.id];
                    const voteLabel = v === 'aye' ? 'AYE' : v === 'nay' ? 'NAY' : v === 'abstain' ? 'ABS' : '...';
                    const voteColor = v === 'aye' ? 'text-green-700' : v === 'nay' ? 'text-red-700' : 'text-gray-400';
                    return (
                      <div key={p.id} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                          <span className="text-gray-700">{p.name}</span>
                        </div>
                        <span className={`font-bold ${voteColor}`}>{voteLabel}</span>
                      </div>
                    );
                  })}
                </div>
                {!hasVoted ? (
                  <div className="flex gap-2">
                    <button onClick={() => onSubmitBillVote(bill.id, 'aye')}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-2 rounded-lg transition-colors">AYE</button>
                    <button onClick={() => onSubmitBillVote(bill.id, 'nay')}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-2 rounded-lg transition-colors">NAY</button>
                    <button onClick={() => onSubmitBillVote(bill.id, 'abstain')}
                      className="flex-1 bg-gray-400 hover:bg-gray-500 text-white text-sm font-bold py-2 rounded-lg transition-colors">ABSTAIN</button>
                  </div>
                ) : (
                  <div className="text-center text-sm text-gray-500">
                    You voted <span className="font-bold uppercase">{myVote}</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* OPPOSITION ACTION PHASE */}
          {!isGovernment && gameState.phase === 'opposition_action' && !currentPlayer?.submittedActions && (
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                  Actions ({actionSlots.length})
                </span>
                <span className="text-[10px] text-gray-400">Cost: {formatFunds(totalActionCost)}</span>
              </div>
              <div className="space-y-2">
                {actionSlots.map((slot, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                    <div className="text-[10px] font-bold text-gray-400 mb-1">Action {idx + 1}</div>
                    <select value={slot.type}
                      onChange={e => updateActionSlot(idx, { type: e.target.value as ActionType })}
                      className="w-full text-sm bg-white border border-gray-200 rounded px-2 py-1 text-gray-700 mb-1">
                      {(Object.keys(ACTION_TYPE_INFO) as ActionType[]).map(at => (
                        <option key={at} value={at}>
                          {ACTION_TYPE_INFO[at].icon} {ACTION_TYPE_INFO[at].label}
                          {getActionCost(at, config) > 0 ? ` (${formatFunds(getActionCost(at, config))})` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-gray-400">{ACTION_TYPE_INFO[slot.type].description}</p>
                    {ACTION_TYPE_INFO[slot.type].needsTarget === 'voter_group' && (
                      <select value={slot.targetGroupId || ''}
                        onChange={e => updateActionSlot(idx, { targetGroupId: e.target.value || undefined })}
                        className="w-full text-xs bg-white border border-gray-200 rounded px-2 py-1 mt-1 text-gray-700">
                        <option value="">Select voter group...</option>
                        {gameState.voterGroups.map(vg => (
                          <option key={vg.id} value={vg.id}>{vg.icon} {vg.name}</option>
                        ))}
                      </select>
                    )}
                    {ACTION_TYPE_INFO[slot.type].needsTarget === 'policy' && (
                      <>
                        <select value={slot.targetPolicyId || ''}
                          onChange={e => updateActionSlot(idx, { targetPolicyId: e.target.value || undefined })}
                          className="w-full text-xs bg-white border border-gray-200 rounded px-2 py-1 mt-1 text-gray-700">
                          <option value="">Select policy...</option>
                          {policies.map(p => (
                            <option key={p.id} value={p.id}>{p.icon} {p.shortName}</option>
                          ))}
                        </select>
                        {slot.targetPolicyId && (
                          <input type="range" min={0} max={100}
                            value={Math.round((slot.proposedValue ?? 0.5) * 100)}
                            onChange={e => updateActionSlot(idx, { proposedValue: Number(e.target.value) / 100 })}
                            className="w-full h-1.5 accent-blue-600 mt-1" />
                        )}
                      </>
                    )}
                    {ACTION_TYPE_INFO[slot.type].needsTarget === 'player' && (
                      <select value={slot.targetPlayerId || ''}
                        onChange={e => updateActionSlot(idx, { targetPlayerId: e.target.value || undefined })}
                        className="w-full text-xs bg-white border border-gray-200 rounded px-2 py-1 mt-1 text-gray-700">
                        <option value="">Select party...</option>
                        {gameState.players.filter(p => p.id !== playerId).map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    )}
                    {ACTION_TYPE_INFO[slot.type].needsTarget === 'crisis' && (
                      <select value={slot.targetSituationId || ''}
                        onChange={e => updateActionSlot(idx, { targetSituationId: e.target.value || undefined })}
                        className="w-full text-xs bg-white border border-gray-200 rounded px-2 py-1 mt-1 text-gray-700">
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
              <button onClick={handleSubmitActions}
                disabled={totalActionCost > (currentPlayer?.funds ?? 0)}
                className="w-full mt-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold py-2 rounded-lg transition-colors shadow-sm">
                Submit Actions
              </button>
              {totalActionCost > (currentPlayer?.funds ?? 0) && (
                <p className="text-[10px] text-red-500 mt-1 text-center">Insufficient funds</p>
              )}
            </div>
          )}

          {!isGovernment && gameState.phase === 'opposition_action' && currentPlayer?.submittedActions && (
            <div className="p-4 text-center">
              <div className="text-green-600 text-2xl mb-1">&#x2713;</div>
              <p className="text-sm text-gray-500">Actions submitted. Waiting for others...</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ============================================================
  // TAB: DASHBOARD
  // ============================================================

  const renderDashboardTab = () => {
    const b = gameState.budget;
    return (
      <div className="p-4 grid grid-cols-3 gap-4">
        {/* LEFT COLUMN: Policy changes, bill votes, situations */}
        <div className="space-y-4">
          {/* Government adjustments this round */}
          {gameState.governmentAdjustments.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Policy Changes This Round</h3>
              <div className="space-y-1.5">
                {gameState.governmentAdjustments.map((adj, i) => {
                  const pol = gameState.policies[adj.policyId];
                  return (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{pol?.icon} {pol?.shortName || adj.policyId}</span>
                      <span className="font-mono text-xs text-blue-700 font-bold">{Math.round(adj.newValue * 100)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent bills */}
          {gameState.billHistory.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Recent Bills</h3>
              <div className="space-y-1.5">
                {gameState.billHistory.slice(-5).reverse().map(bill => (
                  <div key={bill.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 truncate flex-1">
                      <span>{bill.icon}</span>
                      <span className="text-gray-700 truncate">{bill.name}</span>
                    </div>
                    <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${bill.result === 'passed' ? 'bg-green-100 text-green-700' : bill.result === 'defeated' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                      {bill.result === 'passed' ? 'PASSED' : bill.result === 'defeated' ? 'DEFEATED' : 'PENDING'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active situations */}
          {gameState.situations.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Active Situations</h3>
              <div className="space-y-1.5">
                {gameState.situations.map(sit => (
                  <div key={sit.definitionId}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs border ${SEVERITY_COLORS[sit.severityType] || SEVERITY_COLORS.neutral}`}>
                    <span>{sit.icon}</span>
                    <span className="font-medium truncate flex-1">{sit.name}</span>
                    <span className="text-[10px] opacity-70">R{sit.roundActivated}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Media headlines */}
          {gameState.mediaFocus.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Media Headlines</h3>
              <div className="space-y-1.5">
                {gameState.mediaFocus.map((mf, i) => (
                  <div key={i} className={`px-2 py-1.5 rounded text-xs border ${mf.sentiment === 'negative' ? 'bg-red-50 border-red-100 text-red-700' : mf.sentiment === 'positive' ? 'bg-green-50 border-green-100 text-green-700' : 'bg-gray-50 border-gray-100 text-gray-600'}`}>
                    <p className="font-medium leading-snug">{mf.headline}</p>
                    <span className="text-[10px] opacity-60">{mf.roundsRemaining}r left</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* CENTER COLUMN: Economy overview */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Economy Overview</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'GDP Nominal', value: formatBudget(b.gdpNominal) },
                { label: 'Surplus/Deficit', value: formatBudget(b.surplus), color: b.surplus >= 0 ? 'text-green-700' : 'text-red-600' },
                { label: 'Revenue', value: formatBudget(b.totalRevenue), color: 'text-green-700' },
                { label: 'Expenditure', value: formatBudget(b.totalExpenditure), color: 'text-red-600' },
                { label: 'Trade Balance', value: formatBudget(b.tradeBalance), color: b.tradeBalance >= 0 ? 'text-green-700' : 'text-red-600' },
                { label: 'Wage Growth', value: `${b.wageGrowth.toFixed(1)}%` },
                { label: 'Housing Index', value: b.housingIndex.toFixed(0) },
                { label: 'CPI', value: b.consumerPriceIndex.toFixed(1) },
              ].map((item, i) => (
                <div key={i} className="bg-gray-50 rounded-lg px-3 py-2">
                  <div className="text-[10px] text-gray-400 uppercase">{item.label}</div>
                  <div className={`text-sm font-bold font-mono ${item.color || 'text-gray-800'}`}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Sectoral GDP */}
          {b.sectoralGDP && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Sectoral GDP</h3>
              {(() => {
                const sectors = Object.entries(b.sectoralGDP) as [EconomicSector, number][];
                const total = sectors.reduce((s, [, v]) => s + v, 0);
                const sorted = sectors.sort((a, b) => b[1] - a[1]);
                return (
                  <div className="space-y-1.5">
                    {/* Stacked bar */}
                    <div className="flex h-5 rounded-md overflow-hidden">
                      {sorted.map(([sector, val]) => {
                        const pct = total > 0 ? (val / total) * 100 : 0;
                        if (pct < 1) return null;
                        return (
                          <div key={sector} style={{ width: `${pct}%`, backgroundColor: SECTOR_COLORS[sector] }}
                            className="h-full" title={`${SECTOR_LABELS[sector]}: ${formatBudget(val)}`} />
                        );
                      })}
                    </div>
                    {/* Legend */}
                    <div className="grid grid-cols-2 gap-1 mt-2">
                      {sorted.slice(0, 8).map(([sector, val]) => (
                        <div key={sector} className="flex items-center gap-1.5 text-xs">
                          <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: SECTOR_COLORS[sector] }} />
                          <span className="text-gray-600 truncate">{SECTOR_LABELS[sector]}</span>
                          <span className="text-gray-400 font-mono ml-auto">{formatBudget(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Voter groups */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Voter Groups</h3>
            <div className="space-y-3">
              {gameState.voterGroups.map(vg => {
                const happinessDelta = vg.happiness - vg.prevHappiness;
                return (
                  <div key={vg.id} className="border border-gray-100 rounded-lg p-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-sm">{vg.icon}</span>
                      <span className="text-xs font-semibold text-gray-800 flex-1 truncate">{vg.name}</span>
                      {Math.abs(happinessDelta) > 0.01 && (
                        <span className={`text-[10px] font-bold ${happinessDelta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {happinessDelta > 0 ? '\u25B2' : '\u25BC'}{Math.abs(happinessDelta * 100).toFixed(0)}
                        </span>
                      )}
                    </div>
                    <HappinessBar value={vg.happiness} height={6} />
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {gameState.players.map(p => {
                        const share = vg.partyPolling[p.id] ?? 0;
                        if (share < 0.01) return null;
                        return (
                          <span key={p.id} className="flex items-center gap-0.5 text-[10px]">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                            <span className="text-gray-500">{(share * 100).toFixed(0)}%</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // TAB: POLICIES
  // ============================================================

  const renderPoliciesTab = () => {
    const canAdjust = isGovernment && gameState.phase === 'government_action' && !currentPlayer?.submittedAdjustments;
    const categories = Object.keys(policiesByCategory) as PolicyCategory[];

    return (
      <div className="p-4 space-y-6">
        {/* Pending adjustments banner */}
        {canAdjust && pendingAdjustments.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-bold text-amber-800">
                {pendingAdjustments.length}/{config.policyAdjustmentsPerRound} adjustments pending
              </span>
              {pendingAdjustments.map(adj => {
                const pol = gameState.policies[adj.policyId];
                return pol ? (
                  <span key={adj.policyId} className="text-xs bg-white border border-amber-200 rounded px-2 py-0.5 text-amber-700">
                    {pol.icon} {pol.shortName}: {Math.round(adj.newValue * 100)}%
                  </span>
                ) : null;
              })}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-violet-600 font-mono">Cost: {totalCapitalCost} PC</span>
              <button onClick={handleSubmitAdjustments}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition-colors">
                Submit
              </button>
            </div>
          </div>
        )}

        {categories.map(cat => {
          const catPolicies = policiesByCategory[cat];
          if (!catPolicies || catPolicies.length === 0) return null;
          const catInfo = CATEGORY_LABELS[cat];

          return (
            <div key={cat}>
              <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                <span>{catInfo.icon}</span> {catInfo.label}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {catPolicies.map(policy => {
                  const adj = pendingAdjustments.find(a => a.policyId === policy.id);
                  const displayValue = adj ? adj.newValue : policy.targetValue;
                  const isExpanded = expandedPolicyId === policy.id;
                  const delta = policy.targetValue - policy.currentValue;
                  const shadowValues = gameState.players
                    .filter(p => !p.isGovernment && p.shadowPolicies[policy.id] !== undefined)
                    .map(p => ({ player: p, value: p.shadowPolicies[policy.id] }));

                  return (
                    <div key={policy.id}
                      className={`bg-white rounded-xl border shadow-sm transition-all ${isExpanded ? 'border-blue-300 ring-1 ring-blue-100' : 'border-gray-200 hover:border-gray-300'} ${adj ? 'ring-2 ring-amber-200' : ''}`}>
                      <div className="p-3 cursor-pointer" onClick={() => setExpandedPolicyId(isExpanded ? null : policy.id)}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold text-gray-800 flex items-center gap-1.5">
                            <span>{policy.icon}</span> {policy.name}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-mono font-bold text-gray-900">{Math.round(displayValue * 100)}%</span>
                            {Math.abs(delta) > 0.01 && (
                              <span className={`text-[10px] font-bold ${delta > 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                                {delta > 0 ? '\u25B2' : '\u25BC'}
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="absolute h-full bg-blue-500 rounded-full transition-all duration-300"
                            style={{ width: `${displayValue * 100}%` }} />
                          {adj && (
                            <div className="absolute h-full bg-amber-400 rounded-full opacity-50"
                              style={{ width: `${adj.newValue * 100}%` }} />
                          )}
                        </div>
                        <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
                          <span>{policy.minLabel}</span>
                          <span>{policy.maxLabel}</span>
                        </div>
                        {/* Shadow policy indicators */}
                        {shadowValues.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {shadowValues.map(sv => (
                              <span key={sv.player.id} className="text-[9px] px-1 py-0.5 rounded"
                                style={{ backgroundColor: sv.player.color + '20', color: sv.player.color }}>
                                {sv.player.name}: {Math.round(sv.value * 100)}%
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Expanded view */}
                      {isExpanded && (
                        <div className="border-t border-gray-100 p-3">
                          <p className="text-xs text-gray-500 mb-2 leading-relaxed">{policy.description}</p>
                          <div className="text-[10px] text-gray-400 mb-2">
                            Cost per point: <span className="font-mono">{formatBudget(policy.costPerPoint)}</span>
                            {policy.implementationDelay > 0 && (
                              <span className="ml-2">Delay: {policy.implementationDelay} rounds</span>
                            )}
                          </div>
                          {canAdjust && (
                            <div className="mt-2">
                              <input type="range" min={0} max={100}
                                value={Math.round(displayValue * 100)}
                                onChange={e => addAdjustment(policy.id, Number(e.target.value) / 100)}
                                className="w-full h-2 accent-blue-600" />
                              <div className="flex justify-between items-center mt-1">
                                <span className="text-[10px] text-gray-400">{policy.minLabel}</span>
                                <span className="text-xs font-mono font-bold text-blue-700">{Math.round(displayValue * 100)}%</span>
                                <span className="text-[10px] text-gray-400">{policy.maxLabel}</span>
                              </div>
                              {adj && (
                                <button onClick={(e) => { e.stopPropagation(); removeAdjustment(policy.id); }}
                                  className="mt-1 text-xs text-red-500 hover:text-red-700 transition-colors">
                                  Remove adjustment
                                </button>
                              )}
                            </div>
                          )}
                          {/* Effects preview */}
                          {policy.effects.length > 0 && (
                            <div className="mt-2">
                              <div className="text-[10px] text-gray-400 mb-1">Effects:</div>
                              <div className="flex flex-wrap gap-1">
                                {policy.effects.slice(0, 6).map((eff, i) => (
                                  <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded ${eff.multiplier >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                    {eff.targetId} {eff.multiplier >= 0 ? '+' : ''}{(eff.multiplier * 100).toFixed(0)}%
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ============================================================
  // TAB: ECONOMY
  // ============================================================

  const renderEconomyTab = () => {
    const b = gameState.budget;
    const roundLabels = gameState.budgetHistory.map((_, i) => `R${i + 1}`);

    // Build series from stat history
    const gdpSeries = gameState.statHistory['gdp_growth'] || [];
    const unempSeries = gameState.statHistory['unemployment'] || [];
    const inflSeries = gameState.statHistory['inflation'] || [];

    // Budget history series
    const debtToGdpSeries = gameState.budgetHistory.map(bh => bh.debtToGDP);
    const budgetLabels = gameState.budgetHistory.map((_, i) => `R${i + 1}`);

    const maxRevenue = Math.max(...(b.revenueBreakdown || []).map(r => r.amount), 1);
    const maxExpenditure = Math.max(...(b.expenditureBreakdown || []).map(r => r.amount), 1);

    return (
      <div className="p-4 space-y-4">
        {/* Key indicators */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Key Indicators</h3>
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: 'Cash Rate', value: `${b.cashRate.toFixed(2)}%` },
              { label: 'Exchange Rate', value: `A$1 = US$${b.exchangeRate.toFixed(4)}` },
              { label: 'Wage Growth', value: `${b.wageGrowth.toFixed(1)}%`, color: b.wageGrowth >= 0 ? 'text-green-700' : 'text-red-600' },
              { label: 'Housing Index', value: b.housingIndex.toFixed(0) },
              { label: 'CPI', value: b.consumerPriceIndex.toFixed(1) },
            ].map((item, i) => (
              <div key={i} className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                <div className="text-[10px] text-gray-400 uppercase">{item.label}</div>
                <div className={`text-sm font-bold font-mono ${item.color || 'text-gray-800'}`}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-2 gap-4">
          {/* GDP, Unemployment, Inflation chart */}
          {(gdpSeries.length > 1 || unempSeries.length > 1) && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Economic Trends</h3>
              <LineChart
                series={[
                  ...(gdpSeries.length > 1 ? [{ data: gdpSeries, color: '#16a34a', label: 'GDP Growth' }] : []),
                  ...(unempSeries.length > 1 ? [{ data: unempSeries, color: '#dc2626', label: 'Unemployment' }] : []),
                  ...(inflSeries.length > 1 ? [{ data: inflSeries, color: '#d97706', label: 'Inflation' }] : []),
                ]}
                labels={roundLabels.length > 0 ? roundLabels : undefined}
                width={440}
                height={200}
              />
            </div>
          )}

          {/* Debt-to-GDP chart */}
          {debtToGdpSeries.length > 1 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Debt to GDP Ratio</h3>
              <LineChart
                series={[{ data: debtToGdpSeries, color: '#7c3aed', label: 'Debt/GDP %' }]}
                labels={budgetLabels}
                width={440}
                height={200}
              />
            </div>
          )}
        </div>

        {/* Budget breakdown */}
        <div className="grid grid-cols-2 gap-4">
          {b.revenueBreakdown && b.revenueBreakdown.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                Revenue Breakdown <span className="text-green-600 font-mono">{formatBudget(b.totalRevenue)}</span>
              </h3>
              <HorizontalBarChart
                items={b.revenueBreakdown.map(r => ({
                  label: r.name, value: r.amount, color: '#16a34a', change: r.change,
                }))}
                maxValue={maxRevenue}
              />
            </div>
          )}
          {b.expenditureBreakdown && b.expenditureBreakdown.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                Expenditure Breakdown <span className="text-red-600 font-mono">{formatBudget(b.totalExpenditure)}</span>
              </h3>
              <HorizontalBarChart
                items={b.expenditureBreakdown.map(r => ({
                  label: r.name, value: r.amount, color: '#dc2626', change: r.change,
                }))}
                maxValue={maxExpenditure}
              />
            </div>
          )}
        </div>

        {/* Sectoral GDP */}
        {b.sectoralGDP && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Sectoral GDP Contribution</h3>
            {(() => {
              const sectors = Object.entries(b.sectoralGDP) as [EconomicSector, number][];
              const maxSector = Math.max(...sectors.map(([, v]) => v), 1);
              return (
                <HorizontalBarChart
                  items={sectors.sort((a, b) => b[1] - a[1]).map(([sector, val]) => ({
                    label: SECTOR_LABELS[sector], value: val, color: SECTOR_COLORS[sector],
                  }))}
                  maxValue={maxSector}
                />
              );
            })()}
          </div>
        )}

        {/* Stat cards */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">All Statistics</h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {stats.map(stat => {
              const delta = formatStatDelta(stat);
              const historyData = gameState.statHistory[stat.id];
              return (
                <div key={stat.id} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">{stat.icon} {stat.name}</span>
                    {!delta.neutral && (
                      <span className={`text-[10px] font-bold ${delta.positive ? 'text-green-600' : 'text-red-500'}`}>{delta.text}</span>
                    )}
                  </div>
                  <div className="text-xl font-bold text-gray-900 font-mono">{formatStatValue(stat)}</div>
                  {historyData && historyData.length > 1 && (
                    <div className="mt-2">
                      <Sparkline data={historyData} width={100} height={24}
                        color={!delta.neutral ? (delta.positive ? '#16a34a' : '#ef4444') : '#94a3b8'} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // TAB: ELECTION
  // ============================================================

  const renderElectionTab = () => {
    if (!latestElection) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
          No election results yet. Elections occur every {config.electionCycle} rounds.
        </div>
      );
    }
    return renderElectionContent(latestElection);
  };

  const renderElectionContent = (election: DetailedElectionResult) => {
    const partyResults = [...election.partyResults].sort((a, b) => b.seatsWon - a.seatsWon);

    return (
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-gray-900">
              Election Results - Round {election.round}
            </h3>
            <div className="text-right">
              <div className="text-sm text-gray-500">
                {election.totalFormalVotes.toLocaleString()} formal votes
              </div>
              <div className="text-xs text-gray-400">
                Turnout: {election.turnoutPercent.toFixed(1)}% of {election.enrolledVoters.toLocaleString()} enrolled
              </div>
            </div>
          </div>
          {election.isHungParliament && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800 font-medium mb-3">
              Hung Parliament - No party achieved a majority
            </div>
          )}
          {election.newGovernmentName && (
            <div className="text-sm text-gray-700">
              New Government: <span className="font-bold">{election.newGovernmentName}</span>
            </div>
          )}
        </div>

        {/* Party results table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Party</th>
                <th className="text-right px-3 py-2 text-xs font-bold text-gray-500 uppercase">Primary %</th>
                <th className="text-right px-3 py-2 text-xs font-bold text-gray-500 uppercase">2PP %</th>
                <th className="text-right px-3 py-2 text-xs font-bold text-gray-500 uppercase">Seats</th>
                <th className="text-right px-3 py-2 text-xs font-bold text-gray-500 uppercase">Change</th>
                <th className="text-right px-4 py-2 text-xs font-bold text-gray-500 uppercase">Swing</th>
              </tr>
            </thead>
            <tbody>
              {partyResults.map(pr => (
                <tr key={pr.playerId} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: pr.color }} />
                      <span className="font-medium text-gray-800">{pr.partyName}</span>
                    </div>
                  </td>
                  <td className="text-right px-3 py-2 font-mono text-gray-700">{pr.primaryVotePercent.toFixed(1)}%</td>
                  <td className="text-right px-3 py-2 font-mono text-gray-700">{pr.twoPartyPreferred.toFixed(1)}%</td>
                  <td className="text-right px-3 py-2 font-mono font-bold text-gray-900">{pr.seatsWon}</td>
                  <td className="text-right px-3 py-2 font-mono">
                    <span className={pr.seatChange > 0 ? 'text-green-600' : pr.seatChange < 0 ? 'text-red-600' : 'text-gray-400'}>
                      {pr.seatChange > 0 ? '+' : ''}{pr.seatChange}
                    </span>
                  </td>
                  <td className="text-right px-4 py-2 font-mono">
                    <span className={pr.swing > 0 ? 'text-green-600' : pr.swing < 0 ? 'text-red-600' : 'text-gray-400'}>
                      {pr.swing > 0 ? '+' : ''}{pr.swing.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* State-by-state breakdown */}
        {election.stateResults && Object.keys(election.stateResults).length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">State-by-State Breakdown</h3>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-2 font-bold text-gray-500 uppercase">State</th>
                  <th className="text-right px-3 py-2 font-bold text-gray-500 uppercase">Seats</th>
                  {partyResults.slice(0, 4).map(pr => (
                    <th key={pr.playerId} className="text-right px-3 py-2 font-bold uppercase" style={{ color: pr.color }}>
                      {pr.partyName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(election.stateResults).map(([code, sr]) => (
                  <tr key={code} className="border-b border-gray-100">
                    <td className="px-4 py-1.5 font-medium text-gray-700">{sr.stateName} ({code})</td>
                    <td className="text-right px-3 py-1.5 font-mono text-gray-600">{sr.totalSeats}</td>
                    {partyResults.slice(0, 4).map(pr => (
                      <td key={pr.playerId} className="text-right px-3 py-1.5 font-mono text-gray-600">
                        {sr.results[pr.playerId] ?? 0}
                        {sr.swing[pr.playerId] !== undefined && sr.swing[pr.playerId] !== 0 && (
                          <span className={`ml-1 ${sr.swing[pr.playerId] > 0 ? 'text-green-600' : 'text-red-500'}`}>
                            ({sr.swing[pr.playerId] > 0 ? '+' : ''}{sr.swing[pr.playerId].toFixed(1)}%)
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Demographic swing */}
        {election.demographicSwing && election.demographicSwing.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Demographic Swing Analysis</h3>
            <div className="grid grid-cols-2 gap-2">
              {election.demographicSwing.map(ds => (
                <div key={ds.groupId} className="border border-gray-100 rounded-lg p-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-sm">{ds.icon}</span>
                    <span className="text-xs font-semibold text-gray-800">{ds.groupName}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {Object.entries(ds.voteShare).map(([pid, share]) => {
                      const p = playerMap[pid];
                      if (!p || share < 0.01) return null;
                      return (
                        <span key={pid} className="text-[10px] flex items-center gap-0.5">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                          <span className="text-gray-500">{(share * 100).toFixed(0)}%</span>
                        </span>
                      );
                    })}
                  </div>
                  {ds.swingTo && ds.swingMagnitude > 0 && (
                    <div className="text-[10px] text-gray-500 mt-1">
                      Swing to <span className="font-bold" style={{ color: playerMap[ds.swingTo]?.color }}>
                        {playerMap[ds.swingTo]?.name}
                      </span> ({ds.swingMagnitude.toFixed(1)}pp)
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Swing seats and closest seats */}
        <div className="grid grid-cols-2 gap-4">
          {election.swingSeats && election.swingSeats.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Swing Seats</h3>
              <div className="space-y-1.5">
                {election.swingSeats.map(ss => (
                  <div key={ss.seatId} className="flex items-center justify-between text-xs border border-gray-100 rounded px-2 py-1.5">
                    <div>
                      <span className="font-medium text-gray-800">{ss.seatName}</span>
                      <span className="text-gray-400 ml-1">({ss.state})</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span style={{ color: playerMap[ss.from || '']?.color || '#999' }}>{ss.fromName}</span>
                      <span className="text-gray-300">&rarr;</span>
                      <span className="font-bold" style={{ color: playerMap[ss.to || '']?.color || '#999' }}>{ss.toName}</span>
                      <span className="text-gray-400 font-mono ml-1">{ss.swing.toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {election.closestSeats && election.closestSeats.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Closest Seats (&lt;2%)</h3>
              <div className="space-y-1.5">
                {election.closestSeats.map(cs => (
                  <div key={cs.seatId} className="flex items-center justify-between text-xs border border-gray-100 rounded px-2 py-1.5">
                    <div>
                      <span className="font-medium text-gray-800">{cs.seatName}</span>
                      <span className="text-gray-400 ml-1">({cs.state})</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-bold" style={{ color: playerMap[cs.to || '']?.color || '#999' }}>{cs.toName}</span>
                      <span className="text-red-500 font-mono ml-1">{cs.margin.toFixed(1)}%</span>
                    </div>
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
  // MAIN CONTENT AREA (tabs)
  // ============================================================

  const renderCenterContent = () => {
    const visibleTabs = TAB_CONFIG.filter(t => t.id !== 'election' || hasElectionData);

    return (
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50 overflow-hidden">
        {/* Tab bar */}
        <div className="flex items-center bg-white border-b border-gray-200 px-3 h-9 shrink-0">
          {visibleTabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-t transition-colors relative ${activeTab === tab.id ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-auto">
          {activeTab === 'dashboard' && renderDashboardTab()}
          {activeTab === 'policies' && renderPoliciesTab()}
          {activeTab === 'chamber' && (
            <Chamber gameState={gameState} playerId={playerId}
              selectedSeatId={selectedSeatId} onSeatClick={handleSeatClick} />
          )}
          {activeTab === 'economy' && renderEconomyTab()}
          {activeTab === 'election' && renderElectionTab()}
        </div>
      </div>
    );
  };

  // ============================================================
  // MODALS
  // ============================================================

  const renderDilemmaModal = () => {
    if (gameState.phase !== 'dilemma' || !isGovernment || !gameState.pendingDilemma || !showDilemmaModal) return null;
    const d = gameState.pendingDilemma;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full mx-4 overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-5 text-white">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{d.icon}</span>
              <div>
                <h2 className="text-lg font-bold">{d.name}</h2>
                <p className="text-sm text-orange-100">{d.headline}</p>
              </div>
            </div>
          </div>
          <div className="px-6 py-4 border-b border-gray-100">
            <p className="text-sm text-gray-700 leading-relaxed">{d.description}</p>
          </div>
          <div className="px-6 py-4 space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Your Decision</h3>
            {d.choices.map(choice => (
              <button key={choice.id}
                onClick={() => { setShowDilemmaModal(false); onResolveDilemma(choice.id); }}
                className="w-full text-left bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-xl p-4 transition-all group">
                <div className="font-semibold text-sm text-gray-900 group-hover:text-blue-700 transition-colors">{choice.label}</div>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{choice.description}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {choice.effects.slice(0, 4).map((eff, i) => (
                    <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${eff.delta >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {eff.nodeId}: {eff.delta >= 0 ? '+' : ''}{(eff.delta * 100).toFixed(0)}
                    </span>
                  ))}
                  {choice.voterReactions.slice(0, 3).map((vr, i) => (
                    <span key={`vr-${i}`} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${vr.delta >= 0 ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
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

  const renderRoundSummaryModal = () => {
    if (gameState.phase !== 'round_summary' || !showRoundSummary || !latestRoundSummary) return null;
    const rs = latestRoundSummary;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto">
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Round {rs.round} Summary</h2>
                <p className="text-xs text-gray-500">Government: {rs.governmentPlayerName}</p>
              </div>
              <span className="text-3xl font-bold text-indigo-200">R{rs.round}</span>
            </div>
            {rs.mediaHeadlines.length > 0 && (
              <div className="mt-2 bg-white/70 rounded-lg px-3 py-2 border border-indigo-100">
                <p className="text-sm font-semibold text-gray-800">{rs.mediaHeadlines[0]}</p>
              </div>
            )}
          </div>

          {/* Economy */}
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

          {/* Policy changes */}
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

          {/* Voter movements */}
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

          {/* Polling projection */}
          {Object.keys(rs.pollingProjection).length > 0 && (
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Polling Projection</h3>
              <div className="flex gap-3 flex-wrap">
                {gameState.players.sort((a, b) => (rs.pollingProjection[b.id] ?? 0) - (rs.pollingProjection[a.id] ?? 0)).map(player => (
                  <div key={player.id} className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-3 py-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: player.color }} />
                    <span className="text-xs font-medium text-gray-700">{player.name}</span>
                    <span className="text-sm font-bold text-gray-900 font-mono">{rs.pollingProjection[player.id] ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Opposition actions */}
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

          {/* Continue */}
          <div className="px-6 py-4 flex justify-end">
            <button onClick={() => { setShowRoundSummary(false); onForceAdvance(); }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors shadow-sm">
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderElectionResultsModal = () => {
    if (gameState.phase !== 'election_results' || !showElectionModal || !latestElection) return null;
    const e = latestElection;
    const partyResults = [...e.partyResults].sort((a, b) => b.seatsWon - a.seatsWon);
    const winner = partyResults[0];

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto">
          <div className="bg-gradient-to-r from-red-600 to-blue-600 px-6 py-5 text-white rounded-t-2xl">
            <h2 className="text-xl font-bold">Election Results</h2>
            <p className="text-sm text-white/80">Round {e.round}</p>
            {e.isHungParliament ? (
              <p className="text-sm font-bold text-amber-300 mt-1">HUNG PARLIAMENT</p>
            ) : winner && (
              <p className="text-sm mt-1">
                <span className="font-bold">{winner.partyName}</span> wins with {winner.seatsWon} seats
              </p>
            )}
          </div>

          <div className="px-6 py-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-xs font-bold text-gray-500">Party</th>
                  <th className="text-right py-2 text-xs font-bold text-gray-500">Primary</th>
                  <th className="text-right py-2 text-xs font-bold text-gray-500">Seats</th>
                  <th className="text-right py-2 text-xs font-bold text-gray-500">+/-</th>
                  <th className="text-right py-2 text-xs font-bold text-gray-500">Swing</th>
                </tr>
              </thead>
              <tbody>
                {partyResults.map(pr => (
                  <tr key={pr.playerId} className="border-b border-gray-100">
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: pr.color }} />
                        <span className="font-medium">{pr.partyName}</span>
                      </div>
                    </td>
                    <td className="text-right py-2 font-mono">{pr.primaryVotePercent.toFixed(1)}%</td>
                    <td className="text-right py-2 font-mono font-bold">{pr.seatsWon}</td>
                    <td className="text-right py-2 font-mono">
                      <span className={pr.seatChange > 0 ? 'text-green-600' : pr.seatChange < 0 ? 'text-red-600' : 'text-gray-400'}>
                        {pr.seatChange > 0 ? '+' : ''}{pr.seatChange}
                      </span>
                    </td>
                    <td className="text-right py-2 font-mono">
                      <span className={pr.swing > 0 ? 'text-green-600' : pr.swing < 0 ? 'text-red-600' : 'text-gray-400'}>
                        {pr.swing > 0 ? '+' : ''}{pr.swing.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Swing seats in modal */}
          {e.swingSeats.length > 0 && (
            <div className="px-6 py-3 border-t border-gray-100">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Key Swing Seats</h4>
              <div className="space-y-1">
                {e.swingSeats.slice(0, 8).map(ss => (
                  <div key={ss.seatId} className="flex items-center justify-between text-xs">
                    <span className="text-gray-700">{ss.seatName} ({ss.state})</span>
                    <div className="flex items-center gap-1">
                      <span style={{ color: playerMap[ss.from || '']?.color }}>{ss.fromName}</span>
                      <span className="text-gray-300">&rarr;</span>
                      <span className="font-bold" style={{ color: playerMap[ss.to || '']?.color }}>{ss.toName}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="px-6 py-4 flex justify-end border-t border-gray-100">
            <button onClick={() => { setShowElectionModal(false); onForceAdvance(); }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors shadow-sm">
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  };

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
              <div key={score.playerId}
                className={`flex items-center gap-3 p-3 rounded-lg ${rank === 0 ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50 border border-gray-100'}`}>
                <span className={`text-lg font-bold ${rank === 0 ? 'text-amber-600' : 'text-gray-400'}`}>#{rank + 1}</span>
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
    <div className="flex flex-col w-full h-screen overflow-hidden bg-gray-100 text-gray-900"
      style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      {renderDashboardBar()}
      {renderPollingBar()}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {renderLeftSidebar()}
        {renderCenterContent()}
      </div>
      {renderRoundSummaryModal()}
      {renderDilemmaModal()}
      {renderElectionResultsModal()}
      {renderGameOver()}
    </div>
  );
}
