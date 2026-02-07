import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  GameState, GameConfig, Player, PolicySlider, PolicyAdjustment,
  PlayerAction, ActionType, ActionResult, StatDefinition,
  ActiveSituation, VoterGroupState, MediaFocus, PendingDilemma,
  ElectionResult, PlayerScore, StateCode, Phase, PolicyCategory
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
// CONSTANTS & THEME
// ============================================================

const BG_DARK = '#0f1923';
const PANEL_BG = '#1a2636';
const BORDER_COLOR = '#2a3a4a';
const ACCENT_GOLD = '#B8860B';
const TEXT_PRIMARY = '#e8e0d0';
const TEXT_SECONDARY = '#8a9aaa';
const TEXT_MUTED = '#5a6a7a';
const GREEN_GOOD = '#22c55e';
const RED_BAD = '#ef4444';
const YELLOW_WARN = '#eab308';

type ActiveTab = 'web' | 'chamber' | 'map' | 'economy';

const TAB_CONFIG: { id: ActiveTab; label: string; icon: string }[] = [
  { id: 'web', label: 'Policy Web', icon: '\u2B21' },
  { id: 'chamber', label: 'Chamber', icon: '\u{1F3DB}' },
  { id: 'map', label: 'Map', icon: '\u{1F5FA}' },
  { id: 'economy', label: 'Economy', icon: '\u{1F4CA}' },
];

const PHASE_INFO: Record<Phase, { label: string; description: string; color: string }> = {
  waiting: { label: 'Waiting', description: 'Waiting for players...', color: TEXT_MUTED },
  government_action: { label: 'Government Action', description: 'The government adjusts policy sliders', color: '#d4a634' },
  opposition_action: { label: 'Opposition Action', description: 'Opposition parties take their actions', color: '#6aa4d4' },
  simulation: { label: 'Simulation', description: 'Policies take effect, society responds...', color: '#a478d4' },
  dilemma: { label: 'Dilemma', description: 'A crisis demands a decision', color: '#e65100' },
  media_cycle: { label: 'Media Cycle', description: 'The press shifts its spotlight', color: '#d4a634' },
  election: { label: 'Election', description: 'The nation goes to the polls!', color: RED_BAD },
  election_results: { label: 'Election Results', description: 'The people have spoken', color: ACCENT_GOLD },
  game_over: { label: 'Game Over', description: 'Final results', color: ACCENT_GOLD },
};

const ACTION_TYPE_INFO: Record<ActionType, { label: string; icon: string; description: string; needsTarget: string }> = {
  campaign: { label: 'Campaign', icon: '\u{1F4E3}', description: 'Target a voter group, spend funds to build loyalty', needsTarget: 'voter_group' },
  shadow_policy: { label: 'Shadow Policy', icon: '\u{1F4DC}', description: 'Publicly propose an alternative policy position', needsTarget: 'policy' },
  attack_government: { label: 'Attack Government', icon: '\u2694', description: 'Highlight a government failure or crisis', needsTarget: 'crisis' },
  fundraise: { label: 'Fundraise', icon: '\u{1F4B0}', description: 'Raise funds for your party', needsTarget: 'none' },
  media_campaign: { label: 'Media Campaign', icon: '\u{1F4F0}', description: 'Boost visibility via media coverage', needsTarget: 'none' },
  grassroots: { label: 'Grassroots', icon: '\u{1F331}', description: 'Cheap, slow campaign targeting your ideological base', needsTarget: 'voter_group' },
  coalition_deal: { label: 'Coalition Deal', icon: '\u{1F91D}', description: 'Form an alliance with another player', needsTarget: 'player' },
  policy_research: { label: 'Policy Research', icon: '\u{1F4D6}', description: 'Research reduces implementation delays', needsTarget: 'none' },
};

const SEVERITY_COLORS: Record<string, string> = {
  crisis: '#ef4444',
  problem: '#f97316',
  neutral: '#6b7280',
  good: '#22c55e',
  boom: '#10b981',
};

// ============================================================
// HELPERS
// ============================================================

function formatValue(value: number, format?: string): string {
  switch (format) {
    case 'percent': return `${Math.round(value * 100)}%`;
    case 'currency': return `$${(value * 100).toFixed(0)}B`;
    case 'rate': return `${(value * 100).toFixed(1)}%`;
    case 'index': return (value * 100).toFixed(0);
    default: return `${Math.round(value * 100)}%`;
  }
}

function formatFunds(amount: number): string {
  if (Math.abs(amount) >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
  return `$${amount}`;
}

function getDeltaIndicator(current: number, prev: number): { symbol: string; color: string } {
  const delta = current - prev;
  if (Math.abs(delta) < 0.005) return { symbol: '\u2500', color: TEXT_MUTED };
  if (delta > 0) return { symbol: '\u25B2', color: GREEN_GOOD };
  return { symbol: '\u25BC', color: RED_BAD };
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
// SUB-COMPONENTS (inline)
// ============================================================

/** Tiny inline sparkline SVG from an array of 0-1 values. */
function Sparkline({ data, width = 60, height = 20, color = ACCENT_GOLD }: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (!data || data.length < 2) return null;
  const maxVal = Math.max(...data, 0.01);
  const minVal = Math.min(...data, 0);
  const range = maxVal - minVal || 1;
  const step = width / (data.length - 1);
  const points = data.map((v, i) => {
    const x = i * step;
    const y = height - ((v - minVal) / range) * (height - 2) - 1;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
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

/** Small horizontal bar from 0 to 1. */
function ValueBar({ value, color, height = 6 }: { value: number; color: string; height?: number }) {
  const pct = clamp(value, 0, 1) * 100;
  return (
    <div style={{
      width: '100%',
      height,
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderRadius: height / 2,
      overflow: 'hidden',
    }}>
      <div style={{
        width: `${pct}%`,
        height: '100%',
        background: `linear-gradient(90deg, ${color}88, ${color})`,
        borderRadius: height / 2,
        transition: 'width 0.6s ease',
      }} />
    </div>
  );
}

/** Happiness bar from -1 to +1. Center is 0. */
function HappinessBar({ value, height = 8 }: { value: number; height?: number }) {
  const clamped = clamp(value, -1, 1);
  const center = 50;
  const offset = clamped * 50;
  const left = clamped >= 0 ? center : center + offset;
  const barWidth = Math.abs(offset);
  const color = clamped >= 0 ? GREEN_GOOD : RED_BAD;

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height,
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderRadius: height / 2,
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        left: `${left}%`,
        width: `${barWidth}%`,
        height: '100%',
        backgroundColor: color,
        borderRadius: height / 2,
        transition: 'left 0.4s ease, width 0.4s ease',
        opacity: 0.8,
      }} />
      <div style={{
        position: 'absolute',
        left: '50%',
        top: 0,
        width: 1,
        height: '100%',
        backgroundColor: 'rgba(255,255,255,0.2)',
      }} />
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
  const [highlightedVoterGroup, setHighlightedVoterGroup] = useState<string | null>(null);
  const [showDilemmaModal, setShowDilemmaModal] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [chatRecipient, setChatRecipient] = useState<string | null>(null);

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

  const otherPlayers = useMemo(
    () => gameState.players.filter(p => p.id !== playerId),
    [gameState.players, playerId],
  );

  const isGovernment = currentPlayer?.isGovernment ?? false;
  const isHost = currentPlayer?.isHost ?? false;

  const policies = useMemo(
    () => Object.values(gameState.policies),
    [gameState.policies],
  );

  const stats = useMemo(
    () => Object.values(gameState.stats),
    [gameState.stats],
  );

  const playerMap = useMemo(() => {
    const m: Record<string, Player> = {};
    gameState.players.forEach(p => { m[p.id] = p; });
    return m;
  }, [gameState.players]);

  const totalBudgetCost = useMemo(() => {
    return policies.reduce((sum, p) => sum + p.currentValue * p.costPerPoint, 0);
  }, [policies]);

  const budgetIncome = useMemo(() => {
    const taxPolicies = policies.filter(p => p.category === 'tax');
    return taxPolicies.reduce((sum, p) => sum + p.currentValue * p.costPerPoint, 0);
  }, [policies]);

  const roundsUntilElection = useMemo(() => {
    if (config.electionCycle <= 0) return Infinity;
    const nextElection = Math.ceil(gameState.round / config.electionCycle) * config.electionCycle;
    return Math.max(0, nextElection - gameState.round);
  }, [gameState.round, config.electionCycle]);

  const latestElection = useMemo(() => {
    if (gameState.electionHistory.length === 0) return null;
    return gameState.electionHistory[gameState.electionHistory.length - 1];
  }, [gameState.electionHistory]);

  const phaseInfo = PHASE_INFO[gameState.phase] || PHASE_INFO.waiting;

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

  // ── Chat handler ───────────────────────────────────────────
  const handleSendChat = useCallback(() => {
    if (!chatInput.trim()) return;
    onSendChat(chatInput.trim(), chatRecipient);
    setChatInput('');
  }, [chatInput, chatRecipient, onSendChat]);

  // ── Computed costs ─────────────────────────────────────────
  const totalActionCost = useMemo(() => {
    return actionSlots.reduce((sum, a) => sum + getActionCost(a.type, config), 0);
  }, [actionSlots, config]);

  const adjustmentCostDelta = useMemo(() => {
    return pendingAdjustments.reduce((sum, adj) => {
      const policy = gameState.policies[adj.policyId];
      if (!policy) return sum;
      const oldCost = policy.currentValue * policy.costPerPoint;
      const newCost = adj.newValue * policy.costPerPoint;
      return sum + (newCost - oldCost);
    }, 0);
  }, [pendingAdjustments, gameState.policies]);

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div
      className="flex flex-col w-full h-screen overflow-hidden"
      style={{ backgroundColor: BG_DARK, color: TEXT_PRIMARY, fontFamily: "'Inter', 'Segoe UI', sans-serif" }}
    >
      {/* ================================================================ */}
      {/* TOP BAR                                                          */}
      {/* ================================================================ */}
      <div
        className="flex items-center justify-between px-4 shrink-0"
        style={{
          backgroundColor: PANEL_BG,
          borderBottom: `1px solid ${BORDER_COLOR}`,
          height: 52,
        }}
      >
        {/* Left cluster: Round + progress */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col leading-tight">
            <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', color: TEXT_MUTED }}>
              ROUND
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: ACCENT_GOLD, lineHeight: 1 }}>
              {gameState.round}
              <span style={{ color: TEXT_MUTED, fontSize: 12, fontWeight: 400 }}>/{gameState.totalRounds}</span>
            </span>
          </div>
          <div style={{ width: 120 }}>
            <div style={{ width: '100%', height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                width: `${(gameState.round / gameState.totalRounds) * 100}%`,
                height: '100%',
                background: `linear-gradient(90deg, ${ACCENT_GOLD}66, ${ACCENT_GOLD})`,
                borderRadius: 2,
                transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
        </div>

        {/* Center: Phase indicator */}
        <div className="flex flex-col items-center">
          <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: phaseInfo.color }}>
            {phaseInfo.label.toUpperCase()}
          </span>
          <span style={{ fontSize: 11, color: TEXT_SECONDARY, maxWidth: 300, textAlign: 'center' }}>
            {phaseInfo.description}
          </span>
        </div>

        {/* Right cluster: Budget + Govt leader + Force advance */}
        <div className="flex items-center gap-5">
          {/* Budget balance */}
          <div className="flex flex-col items-end leading-tight">
            <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', color: TEXT_MUTED }}>
              BUDGET
            </span>
            <span style={{
              fontFamily: 'monospace', fontSize: 14, fontWeight: 700,
              color: budgetIncome - totalBudgetCost >= 0 ? GREEN_GOOD : RED_BAD,
            }}>
              {budgetIncome - totalBudgetCost >= 0 ? '+' : ''}{formatFunds(Math.round(budgetIncome - totalBudgetCost))}/rd
            </span>
          </div>

          {/* Government leader */}
          {governmentPlayer && (
            <div className="flex items-center gap-2">
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                backgroundColor: governmentPlayer.color,
                boxShadow: `0 0 8px ${governmentPlayer.color}66`,
              }} />
              <div className="flex flex-col leading-tight">
                <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', color: TEXT_MUTED }}>
                  GOVERNMENT
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: governmentPlayer.color }}>
                  {governmentPlayer.name}
                </span>
              </div>
            </div>
          )}

          {/* Force advance (host only) */}
          {isHost && (
            <button
              onClick={onForceAdvance}
              style={{
                fontFamily: 'monospace', fontSize: 11, padding: '4px 12px', borderRadius: 4,
                backgroundColor: 'rgba(184,134,11,0.15)', border: `1px solid ${ACCENT_GOLD}44`,
                color: ACCENT_GOLD, cursor: 'pointer', transition: 'background-color 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(184,134,11,0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(184,134,11,0.15)'; }}
            >
              ADVANCE &#9654;
            </button>
          )}
        </div>
      </div>

      {/* ================================================================ */}
      {/* MAIN CONTENT AREA                                                */}
      {/* ================================================================ */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>

        {/* ============================================================ */}
        {/* LEFT SIDEBAR (250px)                                         */}
        {/* ============================================================ */}
        <div
          className="flex flex-col shrink-0 overflow-y-auto"
          style={{ width: 250, backgroundColor: PANEL_BG, borderRight: `1px solid ${BORDER_COLOR}` }}
        >
          {/* ---- Current Player Card ---- */}
          {currentPlayer && (
            <div style={{ padding: 12, borderBottom: `1px solid ${BORDER_COLOR}` }}>
              {/* Party name + swatch */}
              <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                <div style={{
                  width: 16, height: 16, borderRadius: 4,
                  backgroundColor: currentPlayer.color,
                  boxShadow: `0 0 8px ${currentPlayer.color}44`,
                }} />
                <span style={{ fontWeight: 700, fontSize: 14, color: currentPlayer.color }}>
                  {currentPlayer.name}
                </span>
              </div>

              {/* Player name */}
              <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginBottom: 8 }}>
                {currentPlayer.playerName}
              </div>

              {/* Role badge */}
              <div style={{ marginBottom: 12 }}>
                {isGovernment ? (
                  <span style={{
                    fontFamily: 'monospace', fontSize: 10, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 4,
                    backgroundColor: 'rgba(184,134,11,0.2)', border: `1px solid ${ACCENT_GOLD}`,
                    color: ACCENT_GOLD,
                  }}>
                    GOVERNMENT
                  </span>
                ) : (
                  <span style={{
                    fontFamily: 'monospace', fontSize: 10, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 4,
                    backgroundColor: 'rgba(128,128,128,0.15)', border: '1px solid #666',
                    color: '#999',
                  }}>
                    OPPOSITION
                  </span>
                )}
              </div>

              {/* Stats 2x2 grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: 10, color: TEXT_MUTED }}>SEATS</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY }}>
                    {currentPlayer.seats}
                    <span style={{ color: TEXT_MUTED, fontSize: 10 }}>/{gameState.totalSeats}</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: 10, color: TEXT_MUTED }}>FUNDS</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: GREEN_GOOD }}>
                    {formatFunds(currentPlayer.funds)}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: 10, color: TEXT_MUTED }}>P.CAP</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: '#a78bfa' }}>
                    {currentPlayer.politicalCapital}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: 10, color: TEXT_MUTED }}>APPROVAL</div>
                  <div style={{
                    fontFamily: 'monospace', fontSize: 14, fontWeight: 700,
                    color: currentPlayer.approvalRating >= 0 ? GREEN_GOOD : RED_BAD,
                  }}>
                    {currentPlayer.approvalRating >= 0 ? '+' : ''}
                    {(currentPlayer.approvalRating * 100).toFixed(0)}%
                  </div>
                </div>
              </div>

              {/* Ideology tags */}
              <div className="flex items-center gap-2" style={{ marginTop: 8 }}>
                <span style={{
                  fontFamily: 'monospace', fontSize: 9, padding: '1px 6px', borderRadius: 3,
                  backgroundColor: 'rgba(255,255,255,0.05)', color: TEXT_SECONDARY,
                }}>
                  {currentPlayer.socialIdeology === 'progressive' ? 'PROG' : 'CONS'}
                </span>
                <span style={{
                  fontFamily: 'monospace', fontSize: 9, padding: '1px 6px', borderRadius: 3,
                  backgroundColor: 'rgba(255,255,255,0.05)', color: TEXT_SECONDARY,
                }}>
                  {currentPlayer.economicIdeology === 'market' ? 'MARKET' : 'INTERV'}
                </span>
              </div>
            </div>
          )}

          {/* ---- Other Players ---- */}
          <div style={{ padding: 12, borderBottom: `1px solid ${BORDER_COLOR}` }}>
            <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', color: TEXT_MUTED, marginBottom: 8 }}>
              OTHER PARTIES
            </div>
            <div className="flex flex-col" style={{ gap: 6 }}>
              {otherPlayers.map(p => (
                <div
                  key={p.id}
                  className="flex items-center gap-2"
                  style={{
                    padding: 6, borderRadius: 4,
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    opacity: p.connected ? 1 : 0.5,
                  }}
                >
                  <div style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: p.color, flexShrink: 0 }} />
                  <div className="flex flex-col" style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 11, fontWeight: 700, color: p.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name}
                      </span>
                      {p.isGovernment && (
                        <span style={{ fontFamily: 'monospace', fontSize: 8, color: ACCENT_GOLD, flexShrink: 0 }}>GOV</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2" style={{ fontFamily: 'monospace', fontSize: 10, color: TEXT_SECONDARY }}>
                      <span>{p.seats}s</span>
                      <span>{formatFunds(p.funds)}</span>
                      {!p.connected && <span style={{ color: RED_BAD }}>DC</span>}
                      {p.isAI && <span style={{ color: TEXT_MUTED }}>AI</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ---- Election Countdown ---- */}
          <div style={{ padding: 12, borderBottom: `1px solid ${BORDER_COLOR}` }}>
            <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', color: TEXT_MUTED, marginBottom: 4 }}>
              NEXT ELECTION
            </div>
            {roundsUntilElection === 0 ? (
              <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: RED_BAD }}>THIS ROUND!</div>
            ) : roundsUntilElection === Infinity ? (
              <div style={{ fontFamily: 'monospace', fontSize: 13, color: TEXT_SECONDARY }}>No elections scheduled</div>
            ) : (
              <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: YELLOW_WARN }}>
                In {roundsUntilElection} round{roundsUntilElection !== 1 ? 's' : ''}
              </div>
            )}
            {config.electionCycle > 0 && (
              <div style={{ marginTop: 4 }}>
                <ValueBar
                  value={1 - (roundsUntilElection === Infinity ? 0 : roundsUntilElection / config.electionCycle)}
                  color={roundsUntilElection <= 1 ? RED_BAD : ACCENT_GOLD}
                  height={4}
                />
              </div>
            )}
          </div>

          {/* ---- Recent Events (compact log) ---- */}
          <div style={{ padding: 12, flex: 1, overflowY: 'auto' }}>
            <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', color: TEXT_MUTED, marginBottom: 8 }}>
              RECENT EVENTS
            </div>
            <div className="flex flex-col" style={{ gap: 3 }}>
              {gameState.eventLog.slice(-10).reverse().map((evt, i) => {
                let text = '';
                let evtColor = TEXT_SECONDARY;

                switch (evt.type) {
                  case 'policy_changed':
                    text = `${evt.policyName}: ${Math.round(evt.oldValue * 100)}% \u2192 ${Math.round(evt.newValue * 100)}%`;
                    evtColor = '#6aa4d4';
                    break;
                  case 'situation_triggered':
                    text = evt.headline;
                    evtColor = SEVERITY_COLORS[evt.severity] || TEXT_SECONDARY;
                    break;
                  case 'situation_resolved':
                    text = `Resolved: ${evt.name}`;
                    evtColor = GREEN_GOOD;
                    break;
                  case 'election_held':
                    text = `Election: ${evt.result.swingSeats} seats changed`;
                    evtColor = ACCENT_GOLD;
                    break;
                  case 'government_formed':
                    text = `${evt.playerName} forms government`;
                    evtColor = ACCENT_GOLD;
                    break;
                  case 'round_started':
                    text = `Round ${evt.round} begins`;
                    evtColor = TEXT_MUTED;
                    break;
                  case 'media_spotlight':
                    text = evt.headline;
                    evtColor = '#d4a634';
                    break;
                  case 'funds_changed':
                    text = `${evt.reason}: ${evt.delta >= 0 ? '+' : ''}${formatFunds(evt.delta)}`;
                    evtColor = evt.delta >= 0 ? GREEN_GOOD : RED_BAD;
                    break;
                  case 'dilemma_resolved':
                    text = evt.description;
                    evtColor = '#e65100';
                    break;
                  default:
                    return null;
                }

                if (!text) return null;
                return (
                  <div key={i} style={{ fontSize: 11, lineHeight: 1.3, color: evtColor, opacity: 0.9 - i * 0.07 }}>
                    {text}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* CENTER VIEW (tabbed)                                         */}
        {/* ============================================================ */}
        <div className="flex flex-col flex-1" style={{ minWidth: 0, overflow: 'hidden' }}>
          {/* Tab bar */}
          <div
            className="flex items-center shrink-0"
            style={{
              backgroundColor: PANEL_BG,
              borderBottom: `1px solid ${BORDER_COLOR}`,
              height: 36,
              paddingLeft: 8,
            }}
          >
            {TAB_CONFIG.map(tab => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 14px',
                    fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.06em',
                    color: active ? ACCENT_GOLD : TEXT_MUTED,
                    backgroundColor: active ? 'rgba(184,134,11,0.1)' : 'transparent',
                    borderBottom: `2px solid ${active ? ACCENT_GOLD : 'transparent'}`,
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'color 0.15s, background-color 0.15s',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.color = TEXT_SECONDARY; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.color = TEXT_MUTED; }}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label.toUpperCase()}</span>
                </button>
              );
            })}
          </div>

          {/* Tab content area */}
          <div className="flex-1 overflow-auto" style={{ backgroundColor: BG_DARK }}>

            {/* ---- Policy Web ---- */}
            {activeTab === 'web' && (
              <div style={{ width: '100%', height: '100%' }}>
                <PolicyWeb
                  policies={gameState.policies}
                  stats={gameState.stats}
                  situations={gameState.situations}
                  voterGroups={gameState.voterGroups}
                  isGovernment={isGovernment}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={setSelectedNodeId}
                  onPolicyAdjust={(policyId: string, newValue: number) => {
                    if (isGovernment && gameState.phase === 'government_action') {
                      addAdjustment(policyId, newValue);
                    }
                  }}
                />
              </div>
            )}

            {/* ---- Chamber ---- */}
            {activeTab === 'chamber' && (
              <div style={{ width: '100%', height: '100%', padding: 8 }}>
                <Chamber
                  gameState={gameState}
                  playerId={playerId}
                  selectedSeatId={selectedSeatId}
                  onSeatClick={handleSeatClick}
                  onSeatHover={() => {}}
                />
              </div>
            )}

            {/* ---- Map ---- */}
            {activeTab === 'map' && (
              <div style={{ width: '100%', height: '100%', padding: 8 }}>
                <AustraliaMapView
                  gameState={gameState}
                  playerId={playerId}
                  selectedSeatId={selectedSeatId}
                  onSeatClick={handleSeatClick}
                  onSeatHover={() => {}}
                />
              </div>
            )}

            {/* ---- Economy Dashboard ---- */}
            {activeTab === 'economy' && (
              <div style={{ padding: 16, overflowY: 'auto', height: '100%' }}>
                <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', color: TEXT_MUTED, marginBottom: 12 }}>
                  NATIONAL STATISTICS
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: 12,
                }}>
                  {stats.map(stat => {
                    const delta = getDeltaIndicator(stat.value, stat.prevValue);
                    const history = gameState.statHistory[stat.id] || [];
                    const isHealthy = stat.isGood ? stat.value > 0.5 : stat.value < 0.5;
                    const neutralZone = Math.abs(stat.value - 0.5) < 0.1;
                    const displayColor = neutralZone ? YELLOW_WARN : (isHealthy ? GREEN_GOOD : RED_BAD);

                    return (
                      <div
                        key={stat.id}
                        style={{
                          padding: 12, borderRadius: 6,
                          backgroundColor: PANEL_BG,
                          border: `1px solid ${BORDER_COLOR}`,
                        }}
                      >
                        {/* Header row */}
                        <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                          <div className="flex items-center gap-1">
                            <span style={{ fontSize: 14 }}>{stat.icon}</span>
                            <span style={{
                              fontFamily: 'monospace', fontSize: 10, fontWeight: 700,
                              letterSpacing: '0.06em', color: TEXT_PRIMARY,
                            }}>
                              {stat.name.toUpperCase()}
                            </span>
                          </div>
                          <span style={{ fontFamily: 'monospace', fontSize: 11, color: delta.color }}>
                            {delta.symbol}
                          </span>
                        </div>

                        {/* Value + sparkline */}
                        <div className="flex items-end justify-between" style={{ marginBottom: 6 }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: displayColor }}>
                            {formatValue(stat.value, stat.displayFormat)}
                          </span>
                          <Sparkline data={history} width={56} height={18} color={displayColor} />
                        </div>

                        {/* Value bar */}
                        <ValueBar value={stat.value} color={displayColor} height={5} />

                        {/* Descriptor */}
                        <div style={{ fontFamily: 'monospace', fontSize: 9, color: TEXT_MUTED, marginTop: 4 }}>
                          {stat.isGood ? 'Higher is better' : 'Lower is better'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* RIGHT SIDEBAR (280px)                                        */}
        {/* ============================================================ */}
        <div
          className="flex flex-col shrink-0 overflow-hidden"
          style={{ width: 280, backgroundColor: PANEL_BG, borderLeft: `1px solid ${BORDER_COLOR}` }}
        >
          {/* ---- Top: Situations & Media ---- */}
          <div style={{ padding: 12, overflowY: 'auto', maxHeight: '40%', borderBottom: `1px solid ${BORDER_COLOR}` }}>
            {/* Active Situations */}
            <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', color: TEXT_MUTED, marginBottom: 8 }}>
              SITUATIONS
            </div>
            {gameState.situations.length === 0 ? (
              <div style={{ fontSize: 11, fontStyle: 'italic', color: TEXT_MUTED }}>No active situations</div>
            ) : (
              <div className="flex flex-col" style={{ gap: 6, marginBottom: 12 }}>
                {gameState.situations.map(sit => (
                  <div
                    key={sit.definitionId}
                    className="flex items-start gap-2"
                    style={{
                      padding: 8, borderRadius: 4,
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      borderLeft: `3px solid ${SEVERITY_COLORS[sit.severityType] || '#666'}`,
                    }}
                  >
                    <span style={{ fontSize: 14, lineHeight: 1 }}>{sit.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-center gap-1" style={{ flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: TEXT_PRIMARY }}>{sit.name}</span>
                        <span style={{
                          fontFamily: 'monospace', fontSize: 8, padding: '1px 4px', borderRadius: 2,
                          backgroundColor: `${SEVERITY_COLORS[sit.severityType] || '#666'}22`,
                          color: SEVERITY_COLORS[sit.severityType] || '#666',
                          border: `1px solid ${SEVERITY_COLORS[sit.severityType] || '#666'}44`,
                        }}>
                          {sit.severityType.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontSize: 10, color: TEXT_SECONDARY, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {sit.headline}
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <ValueBar value={sit.severity} color={SEVERITY_COLORS[sit.severityType] || '#666'} height={3} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Media Focus */}
            <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', color: TEXT_MUTED, marginBottom: 8, marginTop: 8 }}>
              MEDIA FOCUS
            </div>
            {gameState.mediaFocus.length === 0 ? (
              <div style={{ fontSize: 11, fontStyle: 'italic', color: TEXT_MUTED }}>No media spotlight</div>
            ) : (
              <div className="flex flex-col" style={{ gap: 6 }}>
                {gameState.mediaFocus.map((mf, i) => {
                  const sentimentColor = mf.sentiment === 'positive' ? GREEN_GOOD : mf.sentiment === 'negative' ? RED_BAD : TEXT_SECONDARY;
                  return (
                    <div
                      key={`${mf.nodeId}-${i}`}
                      style={{
                        padding: 8, borderRadius: 4,
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        borderLeft: `3px solid ${sentimentColor}`,
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, color: sentimentColor }}>{mf.headline}</div>
                      <div className="flex items-center justify-between" style={{ marginTop: 4 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 9, color: TEXT_MUTED }}>
                          {mf.nodeName} &middot; {mf.sentiment}
                        </span>
                        <span style={{ fontFamily: 'monospace', fontSize: 9, color: TEXT_MUTED }}>
                          {mf.roundsRemaining}rd left
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ---- Bottom: Phase-specific action panels ---- */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>

            {/* ==== GOVERNMENT ACTION PHASE ==== */}
            {gameState.phase === 'government_action' && isGovernment && (
              <div>
                <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', color: ACCENT_GOLD, marginBottom: 8 }}>
                  POLICY ADJUSTMENTS ({pendingAdjustments.length}/{config.policyAdjustmentsPerRound})
                </div>

                {/* Policy selector */}
                <div style={{ marginBottom: 12 }}>
                  <select
                    style={{
                      width: '100%', fontSize: 11, padding: '6px 8px', borderRadius: 4,
                      fontFamily: 'monospace',
                      backgroundColor: BG_DARK, border: `1px solid ${BORDER_COLOR}`, color: TEXT_PRIMARY,
                    }}
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        const policy = gameState.policies[e.target.value];
                        if (policy) addAdjustment(policy.id, policy.currentValue);
                      }
                    }}
                  >
                    <option value="">+ Add policy adjustment...</option>
                    {policies
                      .filter(p => !pendingAdjustments.some(a => a.policyId === p.id))
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          {p.icon} {p.name} ({Math.round(p.currentValue * 100)}%)
                        </option>
                      ))
                    }
                  </select>
                </div>

                {/* Pending adjustments */}
                <div className="flex flex-col" style={{ gap: 8, marginBottom: 12 }}>
                  {pendingAdjustments.map(adj => {
                    const policy = gameState.policies[adj.policyId];
                    if (!policy) return null;
                    const oldPct = Math.round(policy.currentValue * 100);
                    const newPct = Math.round(adj.newValue * 100);
                    const costDelta = (adj.newValue - policy.currentValue) * policy.costPerPoint;
                    return (
                      <div
                        key={adj.policyId}
                        style={{
                          padding: 8, borderRadius: 4,
                          backgroundColor: 'rgba(184,134,11,0.08)',
                          border: `1px solid ${ACCENT_GOLD}33`,
                        }}
                      >
                        <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: TEXT_PRIMARY }}>
                            {policy.icon} {policy.name}
                          </span>
                          <button
                            onClick={() => removeAdjustment(adj.policyId)}
                            style={{
                              fontSize: 12, color: RED_BAD, cursor: 'pointer',
                              background: 'none', border: 'none', padding: '0 4px', lineHeight: 1,
                            }}
                          >
                            &#10005;
                          </button>
                        </div>
                        <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 11, color: TEXT_MUTED }}>{oldPct}%</span>
                          <span style={{ color: ACCENT_GOLD }}>&#8594;</span>
                          <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: ACCENT_GOLD }}>{newPct}%</span>
                        </div>
                        <input
                          type="range"
                          min={0} max={100}
                          value={newPct}
                          onChange={(e) => addAdjustment(adj.policyId, parseInt(e.target.value) / 100)}
                          style={{ width: '100%', accentColor: ACCENT_GOLD }}
                        />
                        <div className="flex items-center justify-between" style={{ marginTop: 4 }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 9, color: TEXT_MUTED }}>{policy.minLabel}</span>
                          <span style={{
                            fontFamily: 'monospace', fontSize: 9,
                            color: costDelta > 0 ? RED_BAD : costDelta < 0 ? GREEN_GOOD : TEXT_MUTED,
                          }}>
                            {costDelta >= 0 ? '+' : ''}{formatFunds(Math.round(costDelta))}/rd
                          </span>
                          <span style={{ fontFamily: 'monospace', fontSize: 9, color: TEXT_MUTED }}>{policy.maxLabel}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Submit */}
                <button
                  onClick={handleSubmitAdjustments}
                  disabled={pendingAdjustments.length === 0 || currentPlayer?.submittedAdjustments === true}
                  style={{
                    width: '100%', fontFamily: 'monospace', fontSize: 11, padding: '8px 0',
                    borderRadius: 4, fontWeight: 700, letterSpacing: '0.08em',
                    backgroundColor: currentPlayer?.submittedAdjustments
                      ? 'rgba(34,197,94,0.15)'
                      : pendingAdjustments.length > 0
                        ? 'rgba(184,134,11,0.25)'
                        : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${
                      currentPlayer?.submittedAdjustments ? GREEN_GOOD + '66'
                        : pendingAdjustments.length > 0 ? ACCENT_GOLD + '66'
                        : BORDER_COLOR
                    }`,
                    color: currentPlayer?.submittedAdjustments ? GREEN_GOOD
                      : pendingAdjustments.length > 0 ? ACCENT_GOLD
                      : TEXT_MUTED,
                    cursor: (pendingAdjustments.length === 0 || currentPlayer?.submittedAdjustments) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {currentPlayer?.submittedAdjustments ? '\u2713 SUBMITTED' : 'SUBMIT POLICY CHANGES'}
                </button>
              </div>
            )}

            {/* ==== OPPOSITION ACTION PHASE ==== */}
            {gameState.phase === 'opposition_action' && !isGovernment && (
              <div>
                <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', color: '#6aa4d4', marginBottom: 8 }}>
                  ACTIONS ({config.actionsPerRound} slots)
                </div>

                <div className="flex flex-col" style={{ gap: 10, marginBottom: 12 }}>
                  {actionSlots.map((slot, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: 8, borderRadius: 4,
                        backgroundColor: 'rgba(106,164,212,0.08)',
                        border: '1px solid rgba(106,164,212,0.2)',
                      }}
                    >
                      <div className="flex items-center gap-1" style={{ marginBottom: 6 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, color: '#6aa4d4' }}>
                          SLOT {idx + 1}
                        </span>
                        <span style={{ fontFamily: 'monospace', fontSize: 9, color: TEXT_MUTED }}>
                          {getActionCost(slot.type, config) > 0
                            ? `(${formatFunds(getActionCost(slot.type, config))})`
                            : '(free)'
                          }
                        </span>
                      </div>

                      {/* Action type dropdown */}
                      <select
                        style={{
                          width: '100%', fontSize: 11, padding: '5px 6px', borderRadius: 4,
                          fontFamily: 'monospace', marginBottom: 6,
                          backgroundColor: BG_DARK, border: `1px solid ${BORDER_COLOR}`, color: TEXT_PRIMARY,
                        }}
                        value={slot.type}
                        onChange={(e) => updateActionSlot(idx, {
                          type: e.target.value as ActionType,
                          targetGroupId: undefined,
                          targetPolicyId: undefined,
                          targetPlayerId: undefined,
                          proposedValue: undefined,
                          targetStatId: undefined,
                          targetSituationId: undefined,
                        })}
                      >
                        {(Object.keys(ACTION_TYPE_INFO) as ActionType[]).map(at => (
                          <option key={at} value={at}>
                            {ACTION_TYPE_INFO[at].icon} {ACTION_TYPE_INFO[at].label}
                          </option>
                        ))}
                      </select>

                      {/* Description */}
                      <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 6 }}>
                        {ACTION_TYPE_INFO[slot.type].description}
                      </div>

                      {/* Type-specific controls */}
                      {(slot.type === 'campaign' || slot.type === 'grassroots') && (
                        <select
                          style={{
                            width: '100%', fontSize: 11, padding: '5px 6px', borderRadius: 4,
                            fontFamily: 'monospace',
                            backgroundColor: BG_DARK, border: `1px solid ${BORDER_COLOR}`, color: TEXT_PRIMARY,
                          }}
                          value={slot.targetGroupId || ''}
                          onChange={(e) => updateActionSlot(idx, { targetGroupId: e.target.value || undefined })}
                        >
                          <option value="">Select voter group...</option>
                          {gameState.voterGroups.map(vg => (
                            <option key={vg.id} value={vg.id}>
                              {vg.icon} {vg.name} (pop {(vg.population * 100).toFixed(0)}%)
                            </option>
                          ))}
                        </select>
                      )}

                      {slot.type === 'shadow_policy' && (
                        <>
                          <select
                            style={{
                              width: '100%', fontSize: 11, padding: '5px 6px', borderRadius: 4,
                              fontFamily: 'monospace', marginBottom: 6,
                              backgroundColor: BG_DARK, border: `1px solid ${BORDER_COLOR}`, color: TEXT_PRIMARY,
                            }}
                            value={slot.targetPolicyId || ''}
                            onChange={(e) => updateActionSlot(idx, {
                              targetPolicyId: e.target.value || undefined,
                              proposedValue: e.target.value ? gameState.policies[e.target.value]?.currentValue : undefined,
                            })}
                          >
                            <option value="">Select policy...</option>
                            {policies.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.icon} {p.name} ({Math.round(p.currentValue * 100)}%)
                              </option>
                            ))}
                          </select>
                          {slot.targetPolicyId && (
                            <div>
                              <div style={{ fontFamily: 'monospace', fontSize: 10, color: TEXT_MUTED, marginBottom: 4 }}>
                                Proposed: {Math.round((slot.proposedValue ?? 0.5) * 100)}%
                              </div>
                              <input
                                type="range"
                                min={0} max={100}
                                value={Math.round((slot.proposedValue ?? 0.5) * 100)}
                                onChange={(e) => updateActionSlot(idx, { proposedValue: parseInt(e.target.value) / 100 })}
                                style={{ width: '100%', accentColor: '#6aa4d4' }}
                              />
                            </div>
                          )}
                        </>
                      )}

                      {slot.type === 'attack_government' && (
                        <select
                          style={{
                            width: '100%', fontSize: 11, padding: '5px 6px', borderRadius: 4,
                            fontFamily: 'monospace',
                            backgroundColor: BG_DARK, border: `1px solid ${BORDER_COLOR}`, color: TEXT_PRIMARY,
                          }}
                          value={slot.targetSituationId || slot.targetStatId || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            const isSituation = gameState.situations.some(s => s.definitionId === val);
                            updateActionSlot(idx, {
                              targetSituationId: isSituation ? val : undefined,
                              targetStatId: !isSituation ? val : undefined,
                            });
                          }}
                        >
                          <option value="">Select target...</option>
                          <optgroup label="Active Crises">
                            {gameState.situations
                              .filter(s => s.severityType === 'crisis' || s.severityType === 'problem')
                              .map(s => (
                                <option key={s.definitionId} value={s.definitionId}>
                                  {s.icon} {s.name}
                                </option>
                              ))
                            }
                          </optgroup>
                          <optgroup label="Negative Statistics">
                            {stats
                              .filter(s => (s.isGood && s.value < 0.4) || (!s.isGood && s.value > 0.6))
                              .map(s => (
                                <option key={s.id} value={s.id}>
                                  {s.icon} {s.name} ({formatValue(s.value, s.displayFormat)})
                                </option>
                              ))
                            }
                          </optgroup>
                        </select>
                      )}

                      {slot.type === 'coalition_deal' && (
                        <select
                          style={{
                            width: '100%', fontSize: 11, padding: '5px 6px', borderRadius: 4,
                            fontFamily: 'monospace',
                            backgroundColor: BG_DARK, border: `1px solid ${BORDER_COLOR}`, color: TEXT_PRIMARY,
                          }}
                          value={slot.targetPlayerId || ''}
                          onChange={(e) => updateActionSlot(idx, { targetPlayerId: e.target.value || undefined })}
                        >
                          <option value="">Select player...</option>
                          {otherPlayers.filter(p => !p.isGovernment).map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.seats} seats)</option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                </div>

                {/* Total cost */}
                <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: TEXT_MUTED }}>Total cost:</span>
                  <span style={{
                    fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
                    color: totalActionCost > (currentPlayer?.funds || 0) ? RED_BAD : TEXT_PRIMARY,
                  }}>
                    {formatFunds(totalActionCost)}
                    {totalActionCost > (currentPlayer?.funds || 0) && (
                      <span style={{ color: RED_BAD, marginLeft: 4 }}>INSUFFICIENT</span>
                    )}
                  </span>
                </div>

                {/* Submit */}
                <button
                  onClick={handleSubmitActions}
                  disabled={totalActionCost > (currentPlayer?.funds || 0) || currentPlayer?.submittedActions === true}
                  style={{
                    width: '100%', fontFamily: 'monospace', fontSize: 11, padding: '8px 0',
                    borderRadius: 4, fontWeight: 700, letterSpacing: '0.08em',
                    backgroundColor: currentPlayer?.submittedActions ? 'rgba(34,197,94,0.15)' : 'rgba(106,164,212,0.2)',
                    border: `1px solid ${currentPlayer?.submittedActions ? GREEN_GOOD + '66' : '#6aa4d466'}`,
                    color: currentPlayer?.submittedActions ? GREEN_GOOD : '#6aa4d4',
                    cursor: (totalActionCost > (currentPlayer?.funds || 0) || currentPlayer?.submittedActions) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {currentPlayer?.submittedActions ? '\u2713 ACTIONS SUBMITTED' : 'SUBMIT ACTIONS'}
                </button>
              </div>
            )}

            {/* ==== WAITING STATES ==== */}
            {gameState.phase === 'government_action' && !isGovernment && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0' }}>
                <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', color: TEXT_MUTED, marginBottom: 8 }}>
                  WAITING
                </div>
                <div style={{ fontSize: 12, textAlign: 'center', color: TEXT_SECONDARY, lineHeight: 1.5 }}>
                  The government is adjusting policies.<br />Your turn is next.
                </div>
              </div>
            )}

            {gameState.phase === 'opposition_action' && isGovernment && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0' }}>
                <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', color: TEXT_MUTED, marginBottom: 8 }}>
                  WAITING
                </div>
                <div style={{ fontSize: 12, textAlign: 'center', color: TEXT_SECONDARY, lineHeight: 1.5 }}>
                  The opposition is taking their actions.
                </div>
                <div style={{ marginTop: 12, width: '100%' }}>
                  {otherPlayers.filter(p => !p.isGovernment).map(p => (
                    <div key={p.id} className="flex items-center justify-between" style={{ padding: '4px 8px' }}>
                      <span style={{ fontSize: 11, color: p.color }}>{p.name}</span>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: p.submittedActions ? GREEN_GOOD : YELLOW_WARN }}>
                        {p.submittedActions ? '\u2713' : '\u23F3'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ==== DILEMMA (non-gov sidebar) ==== */}
            {gameState.phase === 'dilemma' && !isGovernment && gameState.pendingDilemma && (
              <div>
                <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', color: '#e65100', marginBottom: 8 }}>
                  DILEMMA IN PROGRESS
                </div>
                <div style={{ padding: 8, borderRadius: 4, backgroundColor: 'rgba(230,81,0,0.1)', border: '1px solid rgba(230,81,0,0.3)' }}>
                  <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                    <span style={{ fontSize: 16 }}>{gameState.pendingDilemma.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: TEXT_PRIMARY }}>{gameState.pendingDilemma.name}</span>
                  </div>
                  <div style={{ fontSize: 11, color: TEXT_SECONDARY }}>The government is deciding...</div>
                </div>
              </div>
            )}

            {/* ==== SIMULATION ==== */}
            {gameState.phase === 'simulation' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0' }}>
                <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', color: '#a478d4', marginBottom: 12 }}>
                  SIMULATION RUNNING
                </div>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  border: '2px solid #a478d4', borderTopColor: 'transparent',
                  animation: 'gb-spin 1s linear infinite',
                  marginBottom: 12,
                }} />
                <div style={{ fontSize: 12, textAlign: 'center', color: TEXT_SECONDARY, lineHeight: 1.5 }}>
                  Policies are taking effect...<br />Society is responding...
                </div>
                <style>{`@keyframes gb-spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}

            {/* ==== MEDIA CYCLE ==== */}
            {gameState.phase === 'media_cycle' && (
              <div>
                <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', color: '#d4a634', marginBottom: 8 }}>
                  MEDIA CYCLE
                </div>
                <div style={{ fontSize: 12, color: TEXT_SECONDARY }}>The press is shifting its focus...</div>
              </div>
            )}

            {/* ==== ROUND RESULTS ==== */}
            {gameState.roundResults.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', color: TEXT_MUTED, marginBottom: 8 }}>
                  ROUND RESULTS
                </div>
                <div className="flex flex-col" style={{ gap: 4 }}>
                  {gameState.roundResults.map((result, i) => {
                    const actor = playerMap[result.playerId];
                    return (
                      <div
                        key={i}
                        style={{
                          padding: 6, borderRadius: 4, fontSize: 11,
                          backgroundColor: result.success ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
                          borderLeft: `2px solid ${result.success ? GREEN_GOOD : RED_BAD}`,
                        }}
                      >
                        <span style={{ color: actor?.color || TEXT_PRIMARY, fontWeight: 600 }}>{actor?.name || 'Unknown'}</span>
                        <span style={{ color: TEXT_SECONDARY }}> {result.description}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ==== CHAT ==== */}
            {config.enableChat && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${BORDER_COLOR}` }}>
                <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', color: TEXT_MUTED, marginBottom: 8 }}>
                  CHAT
                </div>
                <div style={{ maxHeight: 100, overflowY: 'auto', marginBottom: 8 }}>
                  {gameState.chatMessages.slice(-8).map(msg => (
                    <div key={msg.id} style={{ fontSize: 11, marginBottom: 2 }}>
                      <span style={{ color: playerMap[msg.senderId]?.color || TEXT_PRIMARY, fontWeight: 600 }}>
                        {msg.senderName}
                      </span>
                      {msg.isPrivate && (
                        <span style={{ color: YELLOW_WARN, fontSize: 9 }}> (private)</span>
                      )}
                      <span style={{ color: TEXT_SECONDARY }}>: {msg.content}</span>
                    </div>
                  ))}
                </div>
                <div className="flex" style={{ gap: 4 }}>
                  <select
                    style={{
                      fontSize: 10, padding: '4px 2px', borderRadius: 4, fontFamily: 'monospace',
                      backgroundColor: BG_DARK, border: `1px solid ${BORDER_COLOR}`, color: TEXT_PRIMARY,
                      width: 60, flexShrink: 0,
                    }}
                    value={chatRecipient || 'all'}
                    onChange={(e) => setChatRecipient(e.target.value === 'all' ? null : e.target.value)}
                  >
                    <option value="all">All</option>
                    {otherPlayers.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    style={{
                      flex: 1, fontSize: 11, padding: '4px 6px', borderRadius: 4, fontFamily: 'monospace',
                      backgroundColor: BG_DARK, border: `1px solid ${BORDER_COLOR}`, color: TEXT_PRIMARY,
                      minWidth: 0, outline: 'none',
                    }}
                    placeholder="Type..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSendChat(); }}
                  />
                  <button
                    onClick={handleSendChat}
                    style={{
                      fontSize: 12, padding: '4px 8px', borderRadius: 4, fontFamily: 'monospace',
                      backgroundColor: 'rgba(184,134,11,0.2)', border: `1px solid ${ACCENT_GOLD}44`,
                      color: ACCENT_GOLD, cursor: 'pointer', flexShrink: 0,
                    }}
                  >
                    &#10148;
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* BOTTOM BAR: Voter Groups Strip                                   */}
      {/* ================================================================ */}
      <div
        className="shrink-0 flex items-stretch overflow-x-auto"
        style={{
          height: 80,
          backgroundColor: PANEL_BG,
          borderTop: `1px solid ${BORDER_COLOR}`,
          padding: '0 8px',
          gap: 4,
        }}
      >
        {gameState.voterGroups.map(vg => {
          const delta = getDeltaIndicator(vg.happiness, vg.prevHappiness);
          const isHighlighted = highlightedVoterGroup === vg.id;
          return (
            <button
              key={vg.id}
              onClick={() => {
                setHighlightedVoterGroup(prev => prev === vg.id ? null : vg.id);
                setSelectedNodeId(vg.id);
              }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '4px 8px', borderRadius: 4, flexShrink: 0,
                minWidth: 80, cursor: 'pointer',
                backgroundColor: isHighlighted ? 'rgba(184,134,11,0.15)' : 'rgba(255,255,255,0.02)',
                border: isHighlighted ? `1px solid ${ACCENT_GOLD}44` : '1px solid transparent',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={e => { if (!isHighlighted) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={e => { if (!isHighlighted) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'; }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>{vg.icon}</span>
              <span style={{
                fontFamily: 'monospace', fontSize: 9, textAlign: 'center', lineHeight: 1.2,
                marginTop: 2, color: isHighlighted ? ACCENT_GOLD : TEXT_SECONDARY,
                maxWidth: 76, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {vg.name}
              </span>
              <div style={{ width: '100%', maxWidth: 64, marginTop: 4 }}>
                <HappinessBar value={vg.happiness} height={5} />
              </div>
              <div className="flex items-center" style={{ gap: 4, marginTop: 2 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 8, color: TEXT_MUTED }}>
                  {(vg.population * 100).toFixed(0)}%
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: 8, color: delta.color }}>
                  {delta.symbol}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ================================================================ */}
      {/* OVERLAYS                                                         */}
      {/* ================================================================ */}

      {/* ---- Dilemma Modal (government only) ---- */}
      {gameState.phase === 'dilemma' && isGovernment && gameState.pendingDilemma && showDilemmaModal && (
        <div
          style={{
            position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 50, backgroundColor: 'rgba(0,0,0,0.7)',
          }}
        >
          <div
            style={{
              padding: 24, borderRadius: 8, maxWidth: 540, width: '100%', margin: '0 16px',
              backgroundColor: PANEL_BG, border: '2px solid #e65100',
              boxShadow: '0 0 40px rgba(230,81,0,0.3)',
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-3" style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 28 }}>{gameState.pendingDilemma.icon}</span>
              <div>
                <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', color: '#e65100' }}>DILEMMA</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: TEXT_PRIMARY }}>{gameState.pendingDilemma.name}</div>
              </div>
            </div>

            {/* Headline */}
            <div style={{
              fontSize: 13, fontWeight: 700, marginBottom: 8, padding: 8, borderRadius: 4,
              backgroundColor: 'rgba(230,81,0,0.1)', border: '1px solid rgba(230,81,0,0.2)',
              color: '#ff9800',
            }}>
              {gameState.pendingDilemma.headline}
            </div>

            {/* Description */}
            <div style={{ fontSize: 13, marginBottom: 16, color: TEXT_SECONDARY, lineHeight: 1.6 }}>
              {gameState.pendingDilemma.description}
            </div>

            {/* Choices */}
            <div className="flex flex-col" style={{ gap: 12 }}>
              {gameState.pendingDilemma.choices.map(choice => (
                <button
                  key={choice.id}
                  onClick={() => {
                    onResolveDilemma(choice.id);
                    setShowDilemmaModal(false);
                  }}
                  style={{
                    padding: 12, borderRadius: 6, textAlign: 'left',
                    backgroundColor: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER_COLOR}`,
                    cursor: 'pointer', transition: 'background-color 0.15s, border-color 0.15s',
                    color: TEXT_PRIMARY,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = 'rgba(230,81,0,0.1)';
                    e.currentTarget.style.borderColor = '#e6510066';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)';
                    e.currentTarget.style.borderColor = BORDER_COLOR;
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{choice.label}</div>
                  <div style={{ fontSize: 12, marginBottom: 8, color: TEXT_SECONDARY }}>{choice.description}</div>
                  {/* Effects preview */}
                  <div className="flex" style={{ flexWrap: 'wrap', gap: 4 }}>
                    {choice.effects.map((eff, i) => (
                      <span
                        key={i}
                        style={{
                          fontFamily: 'monospace', fontSize: 9, padding: '2px 6px', borderRadius: 3,
                          backgroundColor: eff.delta > 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                          color: eff.delta > 0 ? GREEN_GOOD : RED_BAD,
                          border: `1px solid ${eff.delta > 0 ? GREEN_GOOD + '33' : RED_BAD + '33'}`,
                        }}
                      >
                        {eff.nodeId}: {eff.delta > 0 ? '+' : ''}{(eff.delta * 100).toFixed(0)}%
                        {eff.duration > 1 ? ` (${eff.duration}rd)` : ''}
                      </span>
                    ))}
                    {choice.voterReactions.map((vr, i) => {
                      const group = gameState.voterGroups.find(g => g.id === vr.groupId);
                      return (
                        <span
                          key={`vr-${i}`}
                          style={{
                            fontFamily: 'monospace', fontSize: 9, padding: '2px 6px', borderRadius: 3,
                            backgroundColor: vr.delta > 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                            color: vr.delta > 0 ? GREEN_GOOD : RED_BAD,
                            border: `1px solid ${vr.delta > 0 ? GREEN_GOOD + '33' : RED_BAD + '33'}`,
                          }}
                        >
                          {group?.icon || ''} {group?.name || vr.groupId}: {vr.delta > 0 ? '+' : ''}{(vr.delta * 100).toFixed(0)}%
                        </span>
                      );
                    })}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---- Election Results Overlay ---- */}
      {(gameState.phase === 'election' || gameState.phase === 'election_results') && latestElection && (
        <div
          style={{
            position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 50, backgroundColor: 'rgba(0,0,0,0.75)',
          }}
        >
          <div
            style={{
              padding: 24, borderRadius: 8, maxWidth: 640, width: '100%', margin: '0 16px',
              backgroundColor: PANEL_BG, border: `2px solid ${ACCENT_GOLD}`,
              boxShadow: `0 0 60px ${ACCENT_GOLD}33`,
              maxHeight: '80vh', overflowY: 'auto',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', color: ACCENT_GOLD }}>
                ELECTION RESULTS
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: TEXT_PRIMARY }}>
                Round {latestElection.round} General Election
              </div>
            </div>

            {/* Vote share bars */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', color: TEXT_MUTED, marginBottom: 8 }}>
                VOTE SHARE
              </div>
              <div className="flex flex-col" style={{ gap: 8 }}>
                {Object.entries(latestElection.voteShare)
                  .sort(([, a], [, b]) => b - a)
                  .map(([pid, share]) => {
                    const player = playerMap[pid];
                    if (!player) return null;
                    return (
                      <div key={pid}>
                        <div className="flex items-center justify-between" style={{ marginBottom: 2 }}>
                          <div className="flex items-center gap-2">
                            <div style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: player.color }} />
                            <span style={{ fontSize: 13, fontWeight: 700, color: player.color }}>{player.name}</span>
                          </div>
                          <span style={{ fontFamily: 'monospace', fontSize: 13, color: TEXT_PRIMARY }}>
                            {(share * 100).toFixed(1)}%
                          </span>
                        </div>
                        <ValueBar value={share} color={player.color} height={8} />
                      </div>
                    );
                  })
                }
              </div>
            </div>

            {/* Seat changes */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', color: TEXT_MUTED, marginBottom: 8 }}>
                SEAT CHANGES ({latestElection.swingSeats} seats changed hands)
              </div>
              <div className="flex flex-col" style={{ gap: 4, maxHeight: 160, overflowY: 'auto' }}>
                {latestElection.seatChanges.filter(sc => sc.from !== sc.to).map((sc, i) => {
                  const fromP = sc.from ? playerMap[sc.from] : null;
                  const toP = sc.to ? playerMap[sc.to] : null;
                  return (
                    <div key={i} className="flex items-center" style={{ gap: 8, fontSize: 11 }}>
                      <span style={{ fontFamily: 'monospace', color: TEXT_MUTED, width: 80, flexShrink: 0 }}>{sc.seatId}</span>
                      <span style={{ color: fromP?.color || TEXT_MUTED }}>{fromP?.name || 'Vacant'}</span>
                      <span style={{ color: TEXT_MUTED }}>&#8594;</span>
                      <span style={{ color: toP?.color || TEXT_MUTED, fontWeight: 600 }}>{toP?.name || 'Vacant'}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* New government banner */}
            {latestElection.newGovernmentId && (
              <div style={{
                padding: 12, borderRadius: 6, textAlign: 'center',
                backgroundColor: 'rgba(184,134,11,0.1)', border: `1px solid ${ACCENT_GOLD}44`,
              }}>
                <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', color: ACCENT_GOLD }}>NEW GOVERNMENT</div>
                <div style={{
                  fontSize: 18, fontWeight: 700, marginTop: 4,
                  color: playerMap[latestElection.newGovernmentId]?.color || ACCENT_GOLD,
                }}>
                  {playerMap[latestElection.newGovernmentId]?.name || 'Unknown'}
                </div>
              </div>
            )}

            {/* Continue button (host) */}
            {isHost && gameState.phase === 'election_results' && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <button
                  onClick={onForceAdvance}
                  style={{
                    fontFamily: 'monospace', fontSize: 11, padding: '8px 24px', borderRadius: 4,
                    fontWeight: 700, letterSpacing: '0.08em',
                    backgroundColor: 'rgba(184,134,11,0.25)', border: `1px solid ${ACCENT_GOLD}66`,
                    color: ACCENT_GOLD, cursor: 'pointer',
                  }}
                >
                  CONTINUE &#9654;
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- Game Over Overlay ---- */}
      {gameState.phase === 'game_over' && gameState.finalScores && (
        <div
          style={{
            position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 50, backgroundColor: 'rgba(0,0,0,0.8)',
          }}
        >
          <div
            style={{
              padding: 32, borderRadius: 8, maxWidth: 720, width: '100%', margin: '0 16px',
              backgroundColor: PANEL_BG, border: `2px solid ${ACCENT_GOLD}`,
              boxShadow: `0 0 80px ${ACCENT_GOLD}44`,
              maxHeight: '90vh', overflowY: 'auto',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', color: ACCENT_GOLD }}>
                GAME OVER
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8, color: TEXT_PRIMARY }}>
                Final Standings
              </div>
            </div>

            {/* Winner banner */}
            {gameState.winner && (
              <div style={{
                padding: 16, borderRadius: 8, marginBottom: 24, textAlign: 'center',
                background: `linear-gradient(135deg, ${ACCENT_GOLD}22, ${ACCENT_GOLD}11)`,
                border: `2px solid ${ACCENT_GOLD}`,
              }}>
                <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', color: ACCENT_GOLD }}>WINNER</div>
                <div style={{
                  fontSize: 24, fontWeight: 700, marginTop: 4,
                  color: playerMap[gameState.winner]?.color || ACCENT_GOLD,
                }}>
                  {playerMap[gameState.winner]?.name || 'Unknown'}
                </div>
              </div>
            )}

            {/* Score table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontFamily: 'monospace', fontSize: 11, borderCollapse: 'separate', borderSpacing: '0 4px' }}>
                <thead>
                  <tr style={{ color: TEXT_MUTED }}>
                    <th style={{ textAlign: 'left', padding: '4px 8px' }}>#</th>
                    <th style={{ textAlign: 'left', padding: '4px 8px' }}>PARTY</th>
                    <th style={{ textAlign: 'right', padding: '4px 8px' }}>SEATS</th>
                    <th style={{ textAlign: 'right', padding: '4px 8px' }}>VOTE %</th>
                    <th style={{ textAlign: 'right', padding: '4px 8px' }}>IDEOLOGY</th>
                    <th style={{ textAlign: 'right', padding: '4px 8px' }}>GOV</th>
                    <th style={{ textAlign: 'right', padding: '4px 8px' }}>CRISIS</th>
                    <th style={{ textAlign: 'right', padding: '4px 8px' }}>APPROVAL</th>
                    <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 700, color: ACCENT_GOLD }}>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {[...gameState.finalScores]
                    .sort((a, b) => b.total - a.total)
                    .map((score, idx) => {
                      const isWinner = gameState.winner === score.playerId;
                      const isMe = score.playerId === playerId;
                      return (
                        <tr key={score.playerId} style={{ backgroundColor: isMe ? 'rgba(184,134,11,0.1)' : 'rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '6px 8px', borderRadius: '4px 0 0 4px', color: isWinner ? ACCENT_GOLD : TEXT_MUTED }}>
                            {idx + 1}
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <div className="flex items-center gap-2">
                              <div style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: score.color }} />
                              <span style={{ color: score.color, fontWeight: 600 }}>{score.partyName}</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', padding: '6px 8px', color: TEXT_PRIMARY }}>{score.seats}</td>
                          <td style={{ textAlign: 'right', padding: '6px 8px', color: TEXT_PRIMARY }}>{(score.voteShare * 100).toFixed(1)}%</td>
                          <td style={{ textAlign: 'right', padding: '6px 8px', color: score.ideologyScore > 0 ? GREEN_GOOD : TEXT_MUTED }}>
                            {score.ideologyScore > 0 ? '+' : ''}{score.ideologyScore.toFixed(0)}
                          </td>
                          <td style={{ textAlign: 'right', padding: '6px 8px', color: score.governmentBonus > 0 ? ACCENT_GOLD : TEXT_MUTED }}>
                            {score.governmentBonus > 0 ? '+' : ''}{score.governmentBonus.toFixed(0)}
                          </td>
                          <td style={{ textAlign: 'right', padding: '6px 8px', color: score.crisisPenalty < 0 ? RED_BAD : TEXT_MUTED }}>
                            {score.crisisPenalty !== 0 ? score.crisisPenalty.toFixed(0) : '-'}
                          </td>
                          <td style={{ textAlign: 'right', padding: '6px 8px', color: score.voterApproval > 0 ? GREEN_GOOD : RED_BAD }}>
                            {score.voterApproval > 0 ? '+' : ''}{score.voterApproval.toFixed(0)}
                          </td>
                          <td style={{
                            textAlign: 'right', padding: '6px 8px', borderRadius: '0 4px 4px 0',
                            fontWeight: 700, fontSize: 13, color: isWinner ? ACCENT_GOLD : TEXT_PRIMARY,
                          }}>
                            {score.total.toFixed(0)}
                          </td>
                        </tr>
                      );
                    })
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GameBoard;
