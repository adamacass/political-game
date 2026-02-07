import React, { useState, useMemo, useCallback } from 'react';
import {
  GameState,
  GameConfig,
  Player,
  PlayerAction,
  ActionType,
  ActionResult,
  Policy,
  PolicyCategory,
  PlayerScore,
  SeatId,
  StateCode,
  EconomicStateData,
  VoterGroupState,
  GameEvent,
  ElectionResult,
  PoliticalEvent,
  StateControl,
} from '../types';
import { Chamber } from './Chamber';
import { AustraliaMapView } from './AustraliaMapView';

// ============================================================
// THE HOUSE - Simultaneous Play Game Board
// ============================================================

interface GameBoardProps {
  gameState: GameState;
  config: GameConfig;
  playerId: string;
  onSubmitActions: (actions: PlayerAction[]) => void;
  onSendChat: (content: string, recipientId: string | null) => void;
  onForceAdvance: () => void;
}

// ---- Constants ----

const ALL_STATES: StateCode[] = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

const POLICY_CATEGORIES: PolicyCategory[] = [
  'taxation', 'healthcare', 'education', 'housing', 'climate',
  'defence', 'infrastructure', 'welfare', 'immigration', 'trade',
];

const ACTION_LABELS: Record<ActionType, string> = {
  campaign: 'CAMPAIGN',
  propose_policy: 'PROPOSE POLICY',
  attack_ad: 'ATTACK AD',
  fundraise: 'FUNDRAISE',
  media_blitz: 'MEDIA BLITZ',
  coalition_talk: 'COALITION TALK',
};

const ACTION_ICONS: Record<ActionType, string> = {
  campaign: '\u2691',
  propose_policy: '\u2696',
  attack_ad: '\u2620',
  fundraise: '$',
  media_blitz: '\u260A',
  coalition_talk: '\u2637',
};

const ACTION_DESCRIPTIONS: Record<ActionType, string> = {
  campaign: 'Build influence in a state',
  propose_policy: 'Propose a policy for vote',
  attack_ad: "Damage an opponent's approval",
  fundraise: 'Gain funds for your war chest',
  media_blitz: 'Boost your approval rating',
  coalition_talk: 'Build relationship with a player',
};

type CenterTab = 'chamber' | 'map' | 'economy';

// ---- Styling constants ----

const S = {
  bgPrimary: '#1a3c2a',
  bgPanel: 'rgba(10, 25, 16, 0.85)',
  bgPanelLight: 'rgba(20, 40, 28, 0.7)',
  parchment: '#f5f0e1',
  brass: '#c5a55a',
  brassLight: '#d4b86a',
  brassDim: '#8a7a40',
  textPrimary: '#f5f0e1',
  textSecondary: '#b8b0a0',
  textMuted: '#706858',
  borderSubtle: 'rgba(197, 165, 90, 0.2)',
  borderBrass: 'rgba(197, 165, 90, 0.4)',
  ayeGreen: '#4caf50',
  noRed: '#e53935',
  gold: '#daa520',
  warning: '#ff9800',
  fontMono: "'IBM Plex Mono', 'Courier New', monospace",
} as const;

// ---- Helpers ----

function getActionCost(type: ActionType, config: GameConfig): number {
  switch (type) {
    case 'campaign': return config.campaignCost;
    case 'attack_ad': return config.attackAdCost;
    case 'media_blitz': return config.mediaBlitzCost;
    case 'coalition_talk': return config.coalitionTalkCost;
    case 'fundraise': return 0;
    case 'propose_policy': return 0;
    default: return 0;
  }
}

function formatEventMessage(evt: GameEvent, players: Player[]): string {
  const pName = (id: string) => players.find((p) => p.id === id)?.name ?? 'Unknown';
  switch (evt.type) {
    case 'game_started': return 'Game started';
    case 'round_started': return `Round ${evt.round} begins`;
    case 'actions_submitted': return `${pName(evt.playerId)} submitted actions`;
    case 'action_resolved': return `${pName(evt.result.playerId)}: ${evt.result.description}`;
    case 'policy_voted': return `${evt.result.policyName} ${evt.result.passed ? 'PASSED' : 'DEFEATED'} (${evt.result.supportSeats}-${evt.result.opposeSeats})`;
    case 'seat_captured': return `${pName(evt.toPlayerId)} captured ${evt.seatName}`;
    case 'seat_lost': return `${pName(evt.fromPlayerId)} lost ${evt.seatName}`;
    case 'election_held': return `Election held - ${evt.result.seatChanges.length} seats changed`;
    case 'government_formed': return `${pName(evt.leaderId)} forms government (${evt.seats} seats)`;
    case 'event_occurred': return `Event: ${evt.eventName}`;
    case 'approval_changed': return `${pName(evt.playerId)} approval ${evt.delta > 0 ? '+' : ''}${evt.delta} (${evt.reason})`;
    case 'funds_changed': return `${pName(evt.playerId)} funds ${evt.delta > 0 ? '+' : ''}${evt.delta} (${evt.reason})`;
    case 'state_control_changed': return `${evt.state} control: ${evt.newController ? pName(evt.newController) : 'contested'}`;
    case 'phase_changed': return `Phase: ${evt.toPhase}`;
    case 'game_ended': return `Game Over! ${pName(evt.winner)} wins!`;
    default: return '';
  }
}

function stanceColor(stance: 'favoured' | 'neutral' | 'opposed'): string {
  if (stance === 'favoured') return S.ayeGreen;
  if (stance === 'opposed') return S.noRed;
  return S.textMuted;
}

function stanceDot(stance: 'favoured' | 'neutral' | 'opposed'): string {
  if (stance === 'favoured') return '\u25CF';
  if (stance === 'opposed') return '\u25CF';
  return '\u25CB';
}

function categoryLabel(cat: PolicyCategory): string {
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

function approvalColor(approval: number): string {
  if (approval >= 30) return S.ayeGreen;
  if (approval >= 0) return S.brass;
  return S.noRed;
}

function indicatorColor(value: number, good: 'high' | 'low' | 'zero'): string {
  if (good === 'high') {
    if (value > 3) return S.ayeGreen;
    if (value < 0) return S.noRed;
    return S.parchment;
  }
  if (good === 'low') {
    if (value < 4) return S.ayeGreen;
    if (value > 8) return S.noRed;
    return S.parchment;
  }
  // zero
  if (Math.abs(value) < 2) return S.ayeGreen;
  if (Math.abs(value) > 5) return S.noRed;
  return S.parchment;
}

function deltaArrow(curr: number, prev: number | undefined): { arrow: string; color: string } {
  if (prev === undefined) return { arrow: '', color: S.textMuted };
  const d = curr - prev;
  if (Math.abs(d) < 0.01) return { arrow: '\u2192', color: S.textMuted };
  if (d > 0) return { arrow: '\u2191', color: S.ayeGreen };
  return { arrow: '\u2193', color: S.noRed };
}

// ---- SVG Sparkline helper ----

function Sparkline({ data, width = 80, height = 24, color = S.brass }: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ============================================================
// ACTION SLOT - individual action slot in planning panel
// ============================================================

interface ActionSlotState {
  type: ActionType | null;
  targetState: StateCode | null;
  policyId: string | null;
  targetPlayerId: string | null;
}

function emptySlot(): ActionSlotState {
  return { type: null, targetState: null, policyId: null, targetPlayerId: null };
}

function isSlotComplete(slot: ActionSlotState): boolean {
  if (!slot.type) return false;
  switch (slot.type) {
    case 'campaign': return slot.targetState !== null;
    case 'propose_policy': return slot.policyId !== null;
    case 'attack_ad': return slot.targetPlayerId !== null;
    case 'coalition_talk': return slot.targetPlayerId !== null;
    case 'fundraise': return true;
    case 'media_blitz': return true;
    default: return false;
  }
}

function slotToAction(slot: ActionSlotState): PlayerAction | null {
  if (!slot.type || !isSlotComplete(slot)) return null;
  const action: PlayerAction = { type: slot.type };
  if (slot.targetState) action.targetState = slot.targetState;
  if (slot.policyId) action.policyId = slot.policyId;
  if (slot.targetPlayerId) action.targetPlayerId = slot.targetPlayerId;
  return action;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export const GameBoard: React.FC<GameBoardProps> = ({
  gameState,
  config,
  playerId,
  onSubmitActions,
  onSendChat,
  onForceAdvance,
}) => {
  // ---- Local state ----
  const [centerTab, setCenterTab] = useState<CenterTab>('chamber');
  const [actionSlots, setActionSlots] = useState<ActionSlotState[]>(() =>
    Array.from({ length: config.actionsPerRound }, () => emptySlot())
  );
  const [policyBrowserOpen, setPolicyBrowserOpen] = useState<number | null>(null);
  const [policyCategoryFilter, setPolicyCategoryFilter] = useState<PolicyCategory | 'all'>('all');
  const [policySearch, setPolicySearch] = useState('');
  const [gameOverDismissed, setGameOverDismissed] = useState(false);

  // ---- Derived data ----
  const currentPlayer = useMemo(
    () => gameState.players.find((p) => p.id === playerId) ?? null,
    [gameState.players, playerId],
  );

  const otherPlayers = useMemo(
    () => gameState.players.filter((p) => p.id !== playerId),
    [gameState.players, playerId],
  );

  const sortedPlayers = useMemo(
    () => [...gameState.players].sort((a, b) => b.seats - a.seats),
    [gameState.players],
  );

  const isGovernmentLeader = gameState.governmentLeaderId === playerId;

  const activePolicyIds = useMemo(
    () => new Set(gameState.activePolicies.map((ap) => ap.policy.id)),
    [gameState.activePolicies],
  );

  const myActivePolicies = useMemo(
    () => gameState.activePolicies.filter((ap) => ap.proposerId === playerId),
    [gameState.activePolicies, playerId],
  );

  const roundsUntilElection = gameState.nextElectionRound - gameState.round;

  // Cost tally for current action slots
  const totalCost = useMemo(() => {
    return actionSlots.reduce((sum, slot) => {
      if (!slot.type) return sum;
      return sum + getActionCost(slot.type, config);
    }, 0);
  }, [actionSlots, config]);

  const allSlotsFilled = useMemo(() => {
    return actionSlots.every((s) => isSlotComplete(s));
  }, [actionSlots]);

  const canAfford = currentPlayer ? currentPlayer.funds >= totalCost : false;
  const hasSubmitted = currentPlayer?.submittedActions ?? false;

  // Recent events for ticker
  const recentEvents = useMemo(() => {
    return gameState.eventLog
      .filter((e) => {
        const msg = formatEventMessage(e, gameState.players);
        return msg.length > 0;
      })
      .slice(-8)
      .reverse();
  }, [gameState.eventLog, gameState.players]);

  // Economy history arrays for sparklines
  const gdpHistory = useMemo(() => gameState.economyHistory.map((e) => e.gdpGrowth), [gameState.economyHistory]);
  const unemploymentHistory = useMemo(() => gameState.economyHistory.map((e) => e.unemployment), [gameState.economyHistory]);
  const inflationHistory = useMemo(() => gameState.economyHistory.map((e) => e.inflation), [gameState.economyHistory]);

  const prevEconomy = gameState.economyHistory.length >= 2
    ? gameState.economyHistory[gameState.economyHistory.length - 2]
    : undefined;

  // Filtered policies for browser
  const filteredPolicies = useMemo(() => {
    let list = gameState.policyMenu;
    if (policyCategoryFilter !== 'all') {
      list = list.filter((p) => p.category === policyCategoryFilter);
    }
    if (policySearch.trim()) {
      const q = policySearch.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.shortName.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q),
      );
    }
    return list;
  }, [gameState.policyMenu, policyCategoryFilter, policySearch]);

  // ---- Action handlers ----

  const updateSlot = useCallback((index: number, updates: Partial<ActionSlotState>) => {
    setActionSlots((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  }, []);

  const clearSlot = useCallback((index: number) => {
    setActionSlots((prev) => {
      const next = [...prev];
      next[index] = emptySlot();
      return next;
    });
    if (policyBrowserOpen === index) {
      setPolicyBrowserOpen(null);
    }
  }, [policyBrowserOpen]);

  const handleActionTypeChange = useCallback((index: number, type: ActionType | '') => {
    if (type === '') {
      clearSlot(index);
      return;
    }
    setActionSlots((prev) => {
      const next = [...prev];
      next[index] = { type: type as ActionType, targetState: null, policyId: null, targetPlayerId: null };
      return next;
    });
    if (type === 'propose_policy') {
      setPolicyBrowserOpen(index);
    } else if (policyBrowserOpen === index) {
      setPolicyBrowserOpen(null);
    }
  }, [clearSlot, policyBrowserOpen]);

  const handlePolicySelect = useCallback((index: number, policyId: string) => {
    updateSlot(index, { policyId });
    setPolicyBrowserOpen(null);
  }, [updateSlot]);

  const handleSubmit = useCallback(() => {
    const actions: PlayerAction[] = [];
    for (const slot of actionSlots) {
      const a = slotToAction(slot);
      if (a) actions.push(a);
    }
    if (actions.length === config.actionsPerRound) {
      onSubmitActions(actions);
    }
  }, [actionSlots, config.actionsPerRound, onSubmitActions]);

  // Reset action slots when round changes or phase goes to planning
  const [lastRound, setLastRound] = useState(gameState.round);
  if (gameState.round !== lastRound) {
    setLastRound(gameState.round);
    setActionSlots(Array.from({ length: config.actionsPerRound }, () => emptySlot()));
    setPolicyBrowserOpen(null);
  }

  // ---- Chamber/Map click handler (no-op for now, but required by components) ----
  const handleSeatClick = useCallback((_seatId: SeatId) => {
    // Seat clicks are handled in the action slots for campaign targeting
  }, []);

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        background: S.bgPrimary,
        color: S.textPrimary,
        fontFamily: S.fontMono,
      }}
    >
      {/* ============================================================
          MAIN AREA - Three columns
          ============================================================ */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ======== LEFT PANEL: Player Dashboard (250px) ======== */}
        <div
          style={{
            width: 250,
            flexShrink: 0,
            overflowY: 'auto',
            borderRight: `1px solid ${S.borderSubtle}`,
            background: S.bgPanel,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* -- My Party Info -- */}
          {currentPlayer && (
            <div style={{ padding: '14px 16px 10px', borderBottom: `1px solid ${S.borderSubtle}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 3,
                    backgroundColor: currentPlayer.color,
                    flexShrink: 0,
                    border: '1px solid rgba(255,255,255,0.2)',
                  }}
                />
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: S.parchment, letterSpacing: '0.04em' }}>
                  {currentPlayer.name}
                </div>
              </div>
              <div style={{ fontSize: '0.6rem', color: S.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
                {currentPlayer.playerName}
              </div>
              <div style={{ fontSize: '0.6rem', color: S.textSecondary }}>
                {currentPlayer.socialIdeology === 'progressive' ? 'Progressive' : 'Conservative'}
                {' / '}
                {currentPlayer.economicIdeology === 'market' ? 'Market' : 'Interventionist'}
              </div>

              {/* Government badge */}
              {gameState.governmentLeaderId && (
                <div style={{
                  marginTop: 8,
                  padding: '4px 8px',
                  fontSize: '0.6rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  textAlign: 'center',
                  background: isGovernmentLeader ? 'rgba(218,165,32,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isGovernmentLeader ? S.gold : S.borderSubtle}`,
                  color: isGovernmentLeader ? S.gold : S.textMuted,
                }}>
                  {isGovernmentLeader ? '\u2655 Government Leader' : 'Opposition'}
                </div>
              )}
            </div>
          )}

          {/* -- Big Resource Numbers -- */}
          {currentPlayer && (
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${S.borderSubtle}` }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {/* Seats */}
                <div style={{ flex: 1, textAlign: 'center', padding: '8px 4px', background: 'rgba(0,0,0,0.2)', borderRadius: 3 }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: S.parchment, lineHeight: 1 }}>
                    {currentPlayer.seats}
                  </div>
                  <div style={{ fontSize: '0.55rem', color: S.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4 }}>
                    Seats
                  </div>
                </div>
                {/* Funds */}
                <div style={{ flex: 1, textAlign: 'center', padding: '8px 4px', background: 'rgba(0,0,0,0.2)', borderRadius: 3 }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: S.brass, lineHeight: 1 }}>
                    ${currentPlayer.funds}
                  </div>
                  <div style={{ fontSize: '0.55rem', color: S.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4 }}>
                    Funds
                  </div>
                </div>
              </div>
              {/* Approval */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.6rem', color: S.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Approval</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: approvalColor(currentPlayer.approval) }}>
                    {currentPlayer.approval > 0 ? '+' : ''}{currentPlayer.approval}
                  </span>
                </div>
                <div style={{ height: 6, background: 'rgba(0,0,0,0.3)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.max(0, Math.min(100, (currentPlayer.approval + 100) / 2))}%`,
                    height: '100%',
                    background: approvalColor(currentPlayer.approval),
                    borderRadius: 3,
                    transition: 'width 0.5s',
                  }} />
                </div>
              </div>
            </div>
          )}

          {/* -- Scoreboard -- */}
          <div style={{ padding: '10px 0', borderBottom: `1px solid ${S.borderSubtle}` }}>
            <div style={{
              padding: '0 16px 6px',
              fontSize: '0.6rem',
              color: S.brass,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              fontWeight: 600,
            }}>
              Scoreboard
            </div>
            {sortedPlayers.map((p, idx) => {
              const isMe = p.id === playerId;
              const isLeader = p.id === gameState.governmentLeaderId;
              return (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 16px',
                    background: isMe ? 'rgba(245,240,225,0.04)' : 'transparent',
                    borderLeft: isMe ? `3px solid ${S.brass}` : '3px solid transparent',
                  }}
                >
                  <span style={{ fontSize: '0.6rem', color: S.textMuted, width: 14, textAlign: 'right' }}>
                    {idx + 1}.
                  </span>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      backgroundColor: p.color,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{
                    flex: 1,
                    fontSize: '0.72rem',
                    color: isMe ? S.parchment : S.textPrimary,
                    fontWeight: isMe ? 600 : 400,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {p.name}
                    {isLeader && <span style={{ color: S.gold, marginLeft: 4, fontSize: '0.6rem' }}>{'\u2655'}</span>}
                    {!p.connected && <span style={{ color: S.noRed, marginLeft: 4, fontSize: '0.55rem' }}>(DC)</span>}
                    {p.isAI && <span style={{ color: S.textMuted, marginLeft: 4, fontSize: '0.55rem' }}>(AI)</span>}
                  </div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: S.parchment, minWidth: 20, textAlign: 'right' }}>
                    {p.seats}
                  </span>
                </div>
              );
            })}
          </div>

          {/* -- Round / Election Info -- */}
          <div style={{ padding: '10px 16px', borderBottom: `1px solid ${S.borderSubtle}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '0.6rem', color: S.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Round</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: S.brass }}>
                {gameState.round} / {gameState.totalRounds}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.6rem', color: S.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Next Election</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: roundsUntilElection <= 1 ? S.warning : S.textSecondary }}>
                {roundsUntilElection <= 0 ? 'NOW' : `in ${roundsUntilElection} round${roundsUntilElection !== 1 ? 's' : ''}`}
              </span>
            </div>
          </div>

          {/* -- Active Policies (mine) -- */}
          <div style={{ flex: 1, padding: '10px 0', overflowY: 'auto' }}>
            <div style={{
              padding: '0 16px 6px',
              fontSize: '0.6rem',
              color: S.brass,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              fontWeight: 600,
            }}>
              Your Active Policies
            </div>
            {myActivePolicies.length === 0 && (
              <div style={{ padding: '8px 16px', fontSize: '0.7rem', color: S.textMuted, fontStyle: 'italic' }}>
                No active policies yet.
              </div>
            )}
            {myActivePolicies.map((ap) => (
              <div key={ap.policy.id} style={{
                padding: '6px 16px',
                borderBottom: `1px solid rgba(255,255,255,0.03)`,
              }}>
                <div style={{ fontSize: '0.7rem', color: S.parchment, fontWeight: 600 }}>
                  {ap.policy.shortName}
                  {ap.policy.isLandmark && (
                    <span style={{ color: S.gold, marginLeft: 4, fontSize: '0.6rem' }}>{'\u2605'}</span>
                  )}
                </div>
                <div style={{ fontSize: '0.55rem', color: S.textMuted }}>
                  {ap.roundsRemaining > 0 ? `${ap.roundsRemaining} rounds remaining` : 'Permanent'}
                </div>
              </div>
            ))}
          </div>

          {/* Force Advance button for host */}
          {currentPlayer?.isHost && gameState.phase !== 'game_over' && gameState.phase !== 'waiting' && (
            <div style={{ padding: '8px 16px', borderTop: `1px solid ${S.borderSubtle}` }}>
              <button
                onClick={onForceAdvance}
                style={{
                  width: '100%',
                  padding: '6px 0',
                  background: 'rgba(255,152,0,0.1)',
                  border: `1px solid ${S.warning}`,
                  color: S.warning,
                  fontSize: '0.6rem',
                  fontFamily: S.fontMono,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  cursor: 'pointer',
                }}
              >
                {'\u25B6'} Force Advance
              </button>
            </div>
          )}
        </div>

        {/* ======== CENTER PANEL: Tabs (flex) ======== */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Tab bar */}
          <div style={{
            display: 'flex',
            flexShrink: 0,
            borderBottom: `1px solid ${S.borderSubtle}`,
            background: S.bgPanel,
          }}>
            {([
              { key: 'chamber' as CenterTab, label: 'Chamber' },
              { key: 'map' as CenterTab, label: 'Map' },
              { key: 'economy' as CenterTab, label: 'Economy' },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setCenterTab(tab.key)}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  background: centerTab === tab.key ? 'rgba(197,165,90,0.1)' : 'transparent',
                  border: 'none',
                  borderBottom: centerTab === tab.key ? `2px solid ${S.brass}` : '2px solid transparent',
                  color: centerTab === tab.key ? S.brassLight : S.textMuted,
                  fontSize: '0.7rem',
                  fontFamily: S.fontMono,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {/* Chamber tab */}
            {centerTab === 'chamber' && (
              <Chamber
                gameState={gameState}
                playerId={playerId}
                selectedSeatId={null}
                onSeatClick={handleSeatClick}
              />
            )}

            {/* Map tab */}
            {centerTab === 'map' && (
              <AustraliaMapView
                gameState={gameState}
                playerId={playerId}
                selectedSeatId={null}
                onSeatClick={handleSeatClick}
              />
            )}

            {/* Economy tab */}
            {centerTab === 'economy' && (
              <EconomyTab
                economy={gameState.economy}
                economyHistory={gameState.economyHistory}
                prevEconomy={prevEconomy}
                gdpHistory={gdpHistory}
                unemploymentHistory={unemploymentHistory}
                inflationHistory={inflationHistory}
                voterGroups={gameState.voterGroups}
                players={gameState.players}
              />
            )}
          </div>
        </div>

        {/* ======== RIGHT PANEL: Action Panel (320px) ======== */}
        <div
          style={{
            width: 320,
            flexShrink: 0,
            overflowY: 'auto',
            borderLeft: `1px solid ${S.borderSubtle}`,
            background: S.bgPanel,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Planning Phase */}
          {gameState.phase === 'planning' && (
            <PlanningPanel
              currentPlayer={currentPlayer}
              config={config}
              actionSlots={actionSlots}
              totalCost={totalCost}
              canAfford={canAfford}
              allSlotsFilled={allSlotsFilled}
              hasSubmitted={hasSubmitted}
              players={gameState.players}
              otherPlayers={otherPlayers}
              playerId={playerId}
              round={gameState.round}
              policyMenu={gameState.policyMenu}
              activePolicyIds={activePolicyIds}
              filteredPolicies={filteredPolicies}
              policyBrowserOpen={policyBrowserOpen}
              policyCategoryFilter={policyCategoryFilter}
              policySearch={policySearch}
              onActionTypeChange={handleActionTypeChange}
              onUpdateSlot={updateSlot}
              onClearSlot={clearSlot}
              onPolicySelect={handlePolicySelect}
              onSetPolicyBrowserOpen={setPolicyBrowserOpen}
              onSetPolicyCategoryFilter={setPolicyCategoryFilter}
              onSetPolicySearch={setPolicySearch}
              onSubmit={handleSubmit}
            />
          )}

          {/* Resolution Phase */}
          {gameState.phase === 'resolution' && (
            <ResolutionPanel
              results={gameState.lastRoundResults}
              policyHistory={gameState.policyHistory}
              players={gameState.players}
              economy={gameState.economy}
              prevEconomy={prevEconomy}
              currentEvent={gameState.currentEvent}
            />
          )}

          {/* Election Phase */}
          {gameState.phase === 'election' && (
            <ElectionPanel
              electionHistory={gameState.electionHistory}
              players={gameState.players}
              governmentLeaderId={gameState.governmentLeaderId}
              stateControl={gameState.stateControl}
            />
          )}

          {/* Game Over Phase */}
          {gameState.phase === 'game_over' && (
            <GameOverPanel
              players={gameState.players}
              winnerId={gameState.winner}
              finalScores={gameState.finalScores}
              playerId={playerId}
            />
          )}

          {/* Waiting Phase */}
          {gameState.phase === 'waiting' && (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: 12 }}>{'\u23F3'}</div>
              <div style={{ fontSize: '0.85rem', color: S.textMuted }}>
                Waiting for the game to begin...
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================
          BOTTOM BAR - Event log ticker
          ============================================================ */}
      <div style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '6px 16px',
        background: 'rgba(0,0,0,0.3)',
        borderTop: `1px solid ${S.borderSubtle}`,
        overflow: 'hidden',
      }}>
        <span style={{
          fontWeight: 700,
          color: S.brass,
          flexShrink: 0,
          letterSpacing: '0.12em',
          fontSize: '0.6rem',
          textTransform: 'uppercase',
        }}>
          {'\u25CF'} Feed
        </span>
        <div style={{ display: 'flex', gap: 24, overflow: 'hidden', flex: 1 }}>
          {recentEvents.length === 0 && (
            <span style={{ color: S.textMuted, fontSize: '0.7rem' }}>No events yet.</span>
          )}
          {recentEvents.map((evt, idx) => (
            <span
              key={`${evt.timestamp}-${idx}`}
              style={{
                color: idx === 0 ? S.parchment : S.textSecondary,
                whiteSpace: 'nowrap',
                fontSize: '0.7rem',
              }}
            >
              {formatEventMessage(evt, gameState.players)}
              {idx < recentEvents.length - 1 && (
                <span style={{ color: S.textMuted, margin: '0 0 0 24px' }}>{'\u2022'}</span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* ============================================================
          GAME OVER OVERLAY
          ============================================================ */}
      {gameState.phase === 'game_over' && gameState.winner && !gameOverDismissed && (
        <GameOverOverlay
          players={gameState.players}
          winnerId={gameState.winner}
          finalScores={gameState.finalScores}
          playerId={playerId}
          onDismiss={() => setGameOverDismissed(true)}
        />
      )}
    </div>
  );
};

// ============================================================
// PLANNING PANEL
// ============================================================

const PlanningPanel: React.FC<{
  currentPlayer: Player | null;
  config: GameConfig;
  actionSlots: ActionSlotState[];
  totalCost: number;
  canAfford: boolean;
  allSlotsFilled: boolean;
  hasSubmitted: boolean;
  players: Player[];
  otherPlayers: Player[];
  playerId: string;
  round: number;
  policyMenu: Policy[];
  activePolicyIds: Set<string>;
  filteredPolicies: Policy[];
  policyBrowserOpen: number | null;
  policyCategoryFilter: PolicyCategory | 'all';
  policySearch: string;
  onActionTypeChange: (index: number, type: ActionType | '') => void;
  onUpdateSlot: (index: number, updates: Partial<ActionSlotState>) => void;
  onClearSlot: (index: number) => void;
  onPolicySelect: (index: number, policyId: string) => void;
  onSetPolicyBrowserOpen: (index: number | null) => void;
  onSetPolicyCategoryFilter: (cat: PolicyCategory | 'all') => void;
  onSetPolicySearch: (q: string) => void;
  onSubmit: () => void;
}> = ({
  currentPlayer,
  config,
  actionSlots,
  totalCost,
  canAfford,
  allSlotsFilled,
  hasSubmitted,
  players,
  otherPlayers,
  playerId,
  round,
  policyMenu,
  activePolicyIds,
  filteredPolicies,
  policyBrowserOpen,
  policyCategoryFilter,
  policySearch,
  onActionTypeChange,
  onUpdateSlot,
  onClearSlot,
  onPolicySelect,
  onSetPolicyBrowserOpen,
  onSetPolicyCategoryFilter,
  onSetPolicySearch,
  onSubmit,
}) => {
  const allActionTypes: ActionType[] = ['campaign', 'propose_policy', 'attack_ad', 'fundraise', 'media_blitz', 'coalition_talk'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: `1px solid ${S.borderSubtle}`,
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          color: S.brass,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
        }}>
          Round {round} - Plan Your Actions
        </div>
        {currentPlayer && (
          <div style={{ fontSize: '0.6rem', color: S.textMuted, marginTop: 4 }}>
            Budget: ${currentPlayer.funds} available
          </div>
        )}
      </div>

      {/* Action slots */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {hasSubmitted ? (
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>{'\u2713'}</div>
            <div style={{ fontSize: '0.8rem', color: S.ayeGreen, fontWeight: 600, marginBottom: 16 }}>
              Actions Submitted
            </div>
            {/* Who has submitted */}
            <div style={{ fontSize: '0.6rem', color: S.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              Waiting for players...
            </div>
            {players.map((p) => (
              <div key={p.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 12px',
                justifyContent: 'center',
              }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: p.color }} />
                <span style={{ fontSize: '0.7rem', color: S.textSecondary }}>{p.name}</span>
                <span style={{
                  fontSize: '0.6rem',
                  color: p.submittedActions ? S.ayeGreen : S.textMuted,
                  fontWeight: 600,
                }}>
                  {p.submittedActions ? '\u2713' : '\u23F3'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <>
            {actionSlots.map((slot, idx) => (
              <div key={idx} style={{
                marginBottom: 10,
                padding: '10px 12px',
                background: 'rgba(0,0,0,0.2)',
                border: `1px solid ${slot.type ? S.borderBrass : S.borderSubtle}`,
                borderRadius: 3,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.6rem', color: S.brass, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
                    Action {idx + 1}
                  </span>
                  {slot.type && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.6rem', color: S.textMuted }}>
                        Cost: ${getActionCost(slot.type, config)}
                      </span>
                      <button
                        onClick={() => onClearSlot(idx)}
                        style={{
                          background: 'none',
                          border: `1px solid ${S.noRed}`,
                          color: S.noRed,
                          fontSize: '0.55rem',
                          padding: '2px 6px',
                          cursor: 'pointer',
                          fontFamily: S.fontMono,
                          borderRadius: 2,
                        }}
                      >
                        X
                      </button>
                    </div>
                  )}
                </div>

                {/* Action type selector */}
                <select
                  value={slot.type ?? ''}
                  onChange={(e) => onActionTypeChange(idx, e.target.value as ActionType | '')}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    background: 'rgba(0,0,0,0.3)',
                    border: `1px solid ${S.borderSubtle}`,
                    color: S.parchment,
                    fontSize: '0.72rem',
                    fontFamily: S.fontMono,
                    borderRadius: 2,
                    cursor: 'pointer',
                    marginBottom: slot.type ? 8 : 0,
                  }}
                >
                  <option value="">-- Select Action --</option>
                  {allActionTypes.map((at) => (
                    <option key={at} value={at}>
                      {ACTION_ICONS[at]} {ACTION_LABELS[at]} (${getActionCost(at, config)})
                    </option>
                  ))}
                </select>

                {/* Type-specific controls */}
                {slot.type === 'campaign' && (
                  <div>
                    <div style={{ fontSize: '0.6rem', color: S.textMuted, marginBottom: 4 }}>
                      {ACTION_DESCRIPTIONS.campaign}
                    </div>
                    <select
                      value={slot.targetState ?? ''}
                      onChange={(e) => onUpdateSlot(idx, { targetState: e.target.value as StateCode })}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        background: 'rgba(0,0,0,0.3)',
                        border: `1px solid ${S.borderSubtle}`,
                        color: S.parchment,
                        fontSize: '0.72rem',
                        fontFamily: S.fontMono,
                        borderRadius: 2,
                        cursor: 'pointer',
                      }}
                    >
                      <option value="">-- Select State --</option>
                      {ALL_STATES.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>
                )}

                {slot.type === 'propose_policy' && (
                  <div>
                    <div style={{ fontSize: '0.6rem', color: S.textMuted, marginBottom: 4 }}>
                      {ACTION_DESCRIPTIONS.propose_policy}
                    </div>
                    {slot.policyId ? (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        background: 'rgba(197,165,90,0.1)',
                        border: `1px solid ${S.borderBrass}`,
                        borderRadius: 2,
                      }}>
                        <span style={{ fontSize: '0.72rem', color: S.parchment }}>
                          {policyMenu.find((p) => p.id === slot.policyId)?.shortName ?? slot.policyId}
                        </span>
                        <button
                          onClick={() => onSetPolicyBrowserOpen(idx)}
                          style={{
                            background: 'none',
                            border: `1px solid ${S.brassDim}`,
                            color: S.brass,
                            fontSize: '0.55rem',
                            padding: '2px 6px',
                            cursor: 'pointer',
                            fontFamily: S.fontMono,
                            borderRadius: 2,
                          }}
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => onSetPolicyBrowserOpen(idx)}
                        style={{
                          width: '100%',
                          padding: '8px 0',
                          background: 'rgba(0,0,0,0.2)',
                          border: `1px dashed ${S.borderBrass}`,
                          color: S.brass,
                          fontSize: '0.7rem',
                          fontFamily: S.fontMono,
                          cursor: 'pointer',
                          borderRadius: 2,
                        }}
                      >
                        Browse Policies...
                      </button>
                    )}
                  </div>
                )}

                {slot.type === 'attack_ad' && (
                  <div>
                    <div style={{ fontSize: '0.6rem', color: S.textMuted, marginBottom: 4 }}>
                      {ACTION_DESCRIPTIONS.attack_ad}
                    </div>
                    <select
                      value={slot.targetPlayerId ?? ''}
                      onChange={(e) => onUpdateSlot(idx, { targetPlayerId: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        background: 'rgba(0,0,0,0.3)',
                        border: `1px solid ${S.borderSubtle}`,
                        color: S.parchment,
                        fontSize: '0.72rem',
                        fontFamily: S.fontMono,
                        borderRadius: 2,
                        cursor: 'pointer',
                      }}
                    >
                      <option value="">-- Select Target --</option>
                      {otherPlayers.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.seats} seats)</option>
                      ))}
                    </select>
                  </div>
                )}

                {slot.type === 'coalition_talk' && (
                  <div>
                    <div style={{ fontSize: '0.6rem', color: S.textMuted, marginBottom: 4 }}>
                      {ACTION_DESCRIPTIONS.coalition_talk}
                    </div>
                    <select
                      value={slot.targetPlayerId ?? ''}
                      onChange={(e) => onUpdateSlot(idx, { targetPlayerId: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        background: 'rgba(0,0,0,0.3)',
                        border: `1px solid ${S.borderSubtle}`,
                        color: S.parchment,
                        fontSize: '0.72rem',
                        fontFamily: S.fontMono,
                        borderRadius: 2,
                        cursor: 'pointer',
                      }}
                    >
                      <option value="">-- Select Player --</option>
                      {otherPlayers.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {slot.type === 'fundraise' && (
                  <div style={{ fontSize: '0.6rem', color: S.textMuted }}>
                    {ACTION_DESCRIPTIONS.fundraise}. Gain ${config.fundraiseAmount}.
                  </div>
                )}

                {slot.type === 'media_blitz' && (
                  <div style={{ fontSize: '0.6rem', color: S.textMuted }}>
                    {ACTION_DESCRIPTIONS.media_blitz}
                  </div>
                )}
              </div>
            ))}

            {/* Policy Browser (shown inline when open) */}
            {policyBrowserOpen !== null && (
              <PolicyBrowser
                policies={filteredPolicies}
                activePolicyIds={activePolicyIds}
                categoryFilter={policyCategoryFilter}
                searchQuery={policySearch}
                slotIndex={policyBrowserOpen}
                onSelect={onPolicySelect}
                onClose={() => onSetPolicyBrowserOpen(null)}
                onSetCategoryFilter={onSetPolicyCategoryFilter}
                onSetSearch={onSetPolicySearch}
              />
            )}
          </>
        )}
      </div>

      {/* Submit bar */}
      {!hasSubmitted && (
        <div style={{ padding: '10px 12px', borderTop: `1px solid ${S.borderSubtle}` }}>
          {/* Cost tally */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 8,
            fontSize: '0.65rem',
          }}>
            <span style={{ color: S.textMuted }}>Total Cost:</span>
            <span style={{ color: canAfford ? S.parchment : S.noRed, fontWeight: 700 }}>
              ${totalCost}
              {!canAfford && ' (insufficient funds)'}
            </span>
          </div>
          <button
            onClick={onSubmit}
            disabled={!allSlotsFilled || !canAfford}
            style={{
              width: '100%',
              padding: '10px 0',
              background: allSlotsFilled && canAfford ? S.brass : 'rgba(100,90,70,0.3)',
              border: `1px solid ${allSlotsFilled && canAfford ? S.brassLight : S.brassDim}`,
              color: allSlotsFilled && canAfford ? '#1a1a1a' : S.textMuted,
              fontSize: '0.8rem',
              fontWeight: 800,
              fontFamily: S.fontMono,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              cursor: allSlotsFilled && canAfford ? 'pointer' : 'not-allowed',
              borderRadius: 3,
              transition: 'all 0.15s',
            }}
          >
            Submit Actions
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================================
// POLICY BROWSER
// ============================================================

const PolicyBrowser: React.FC<{
  policies: Policy[];
  activePolicyIds: Set<string>;
  categoryFilter: PolicyCategory | 'all';
  searchQuery: string;
  slotIndex: number;
  onSelect: (index: number, policyId: string) => void;
  onClose: () => void;
  onSetCategoryFilter: (cat: PolicyCategory | 'all') => void;
  onSetSearch: (q: string) => void;
}> = ({
  policies,
  activePolicyIds,
  categoryFilter,
  searchQuery,
  slotIndex,
  onSelect,
  onClose,
  onSetCategoryFilter,
  onSetSearch,
}) => {
  return (
    <div style={{
      marginTop: 8,
      background: 'rgba(0,0,0,0.3)',
      border: `1px solid ${S.borderBrass}`,
      borderRadius: 3,
      padding: '10px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: '0.7rem', color: S.brass, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Policy Browser
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: `1px solid ${S.textMuted}`,
            color: S.textMuted,
            fontSize: '0.55rem',
            padding: '2px 6px',
            cursor: 'pointer',
            fontFamily: S.fontMono,
            borderRadius: 2,
          }}
        >
          Close
        </button>
      </div>

      {/* Search bar */}
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => onSetSearch(e.target.value)}
        placeholder="Search policies..."
        style={{
          width: '100%',
          padding: '6px 8px',
          background: 'rgba(0,0,0,0.3)',
          border: `1px solid ${S.borderSubtle}`,
          color: S.parchment,
          fontSize: '0.7rem',
          fontFamily: S.fontMono,
          borderRadius: 2,
          marginBottom: 8,
          boxSizing: 'border-box',
        }}
      />

      {/* Category tabs */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 3,
        marginBottom: 8,
      }}>
        <button
          onClick={() => onSetCategoryFilter('all')}
          style={{
            padding: '3px 6px',
            background: categoryFilter === 'all' ? 'rgba(197,165,90,0.2)' : 'transparent',
            border: `1px solid ${categoryFilter === 'all' ? S.brass : S.borderSubtle}`,
            color: categoryFilter === 'all' ? S.brass : S.textMuted,
            fontSize: '0.5rem',
            fontFamily: S.fontMono,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            cursor: 'pointer',
            borderRadius: 2,
          }}
        >
          All
        </button>
        {POLICY_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => onSetCategoryFilter(cat)}
            style={{
              padding: '3px 6px',
              background: categoryFilter === cat ? 'rgba(197,165,90,0.2)' : 'transparent',
              border: `1px solid ${categoryFilter === cat ? S.brass : S.borderSubtle}`,
              color: categoryFilter === cat ? S.brass : S.textMuted,
              fontSize: '0.5rem',
              fontFamily: S.fontMono,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              cursor: 'pointer',
              borderRadius: 2,
            }}
          >
            {categoryLabel(cat)}
          </button>
        ))}
      </div>

      {/* Policy list */}
      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
        {policies.length === 0 && (
          <div style={{ padding: 12, textAlign: 'center', color: S.textMuted, fontSize: '0.7rem' }}>
            No policies match your search.
          </div>
        )}
        {policies.map((policy) => {
          const isActive = activePolicyIds.has(policy.id);
          return (
            <div
              key={policy.id}
              onClick={() => !isActive && onSelect(slotIndex, policy.id)}
              style={{
                padding: '8px 10px',
                marginBottom: 4,
                background: isActive ? 'rgba(100,100,100,0.1)' : 'rgba(0,0,0,0.15)',
                border: `1px solid ${isActive ? S.textMuted : S.borderSubtle}`,
                borderRadius: 2,
                cursor: isActive ? 'not-allowed' : 'pointer',
                opacity: isActive ? 0.5 : 1,
                transition: 'background 0.1s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 }}>
                <div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: S.parchment }}>
                    {policy.name}
                  </span>
                  {policy.isLandmark && (
                    <span style={{ color: S.gold, marginLeft: 6, fontSize: '0.6rem' }}>{'\u2605'} Landmark</span>
                  )}
                  {isActive && (
                    <span style={{
                      marginLeft: 6,
                      fontSize: '0.5rem',
                      color: S.textMuted,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      background: 'rgba(255,255,255,0.06)',
                      padding: '1px 4px',
                      borderRadius: 2,
                    }}>
                      Already Active
                    </span>
                  )}
                </div>
                <span style={{
                  fontSize: '0.55rem',
                  color: S.brass,
                  padding: '1px 4px',
                  background: 'rgba(197,165,90,0.15)',
                  borderRadius: 2,
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}>
                  {categoryLabel(policy.category)}
                </span>
              </div>
              <div style={{ fontSize: '0.62rem', color: S.textSecondary, marginBottom: 4 }}>
                {policy.description}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Cost */}
                <span style={{ fontSize: '0.55rem', color: S.textMuted }}>
                  Budget: {policy.budgetCost > 0 ? `+$${policy.budgetCost}` : `-$${Math.abs(policy.budgetCost)}`}
                </span>
                {/* Ideology alignment dots */}
                <div style={{ display: 'flex', gap: 4 }}>
                  {(
                    [
                      ['P', policy.stanceTable.progressive],
                      ['C', policy.stanceTable.conservative],
                      ['M', policy.stanceTable.market],
                      ['I', policy.stanceTable.interventionist],
                    ] as [string, 'favoured' | 'neutral' | 'opposed'][]
                  ).map(([label, stance]) => (
                    <span
                      key={label}
                      title={`${label === 'P' ? 'Progressive' : label === 'C' ? 'Conservative' : label === 'M' ? 'Market' : 'Interventionist'}: ${stance}`}
                      style={{
                        fontSize: '0.55rem',
                        color: stanceColor(stance),
                      }}
                    >
                      {label}:{stanceDot(stance)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================
// RESOLUTION PANEL
// ============================================================

const ResolutionPanel: React.FC<{
  results: ActionResult[];
  policyHistory: { policyId: string; policyName: string; proposerId: string; passed: boolean; supportSeats: number; opposeSeats: number; totalSeats: number }[];
  players: Player[];
  economy: EconomicStateData;
  prevEconomy: EconomicStateData | undefined;
  currentEvent: PoliticalEvent | null;
}> = ({ results, policyHistory, players, economy, prevEconomy, currentEvent }) => {
  const playerName = (id: string) => players.find((p) => p.id === id)?.name ?? 'Unknown';
  const playerColor = (id: string) => players.find((p) => p.id === id)?.color ?? '#666';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: `1px solid ${S.borderSubtle}`,
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          color: S.brass,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
        }}>
          Resolution
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {/* Current Event */}
        {currentEvent && (
          <div style={{
            marginBottom: 12,
            padding: '10px 12px',
            background: 'rgba(255,152,0,0.08)',
            border: `1px solid rgba(255,152,0,0.3)`,
            borderRadius: 3,
          }}>
            <div style={{ fontSize: '0.55rem', color: S.warning, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
              {'\u26A0'} Event: {currentEvent.category}
            </div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: S.parchment, marginBottom: 4 }}>
              {currentEvent.headline}
            </div>
            <div style={{ fontSize: '0.65rem', color: S.textSecondary }}>
              {currentEvent.description}
            </div>
          </div>
        )}

        {/* Action Results */}
        <div style={{ marginBottom: 12 }}>
          <div style={{
            fontSize: '0.6rem',
            color: S.brass,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 6,
            fontWeight: 600,
          }}>
            Action Results
          </div>
          {results.length === 0 && (
            <div style={{ padding: 8, fontSize: '0.7rem', color: S.textMuted, textAlign: 'center' }}>
              Resolving actions...
            </div>
          )}
          {results.map((r, idx) => (
            <div key={idx} style={{
              padding: '8px 10px',
              marginBottom: 4,
              background: 'rgba(0,0,0,0.15)',
              borderLeft: `3px solid ${playerColor(r.playerId)}`,
              borderRadius: 2,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: S.parchment }}>
                  {playerName(r.playerId)}
                </span>
                <span style={{
                  fontSize: '0.55rem',
                  color: r.success ? S.ayeGreen : S.noRed,
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}>
                  {r.success ? 'Success' : 'Failed'}
                </span>
              </div>
              <div style={{ fontSize: '0.6rem', color: S.textMuted, marginBottom: 2 }}>
                {ACTION_LABELS[r.action.type]}
              </div>
              <div style={{ fontSize: '0.65rem', color: S.textSecondary }}>
                {r.description}
              </div>
              {/* Effects */}
              <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                {r.seatsCaptured !== undefined && r.seatsCaptured > 0 && (
                  <span style={{ fontSize: '0.55rem', color: S.ayeGreen }}>+{r.seatsCaptured} seats</span>
                )}
                {r.approvalChange !== undefined && r.approvalChange !== 0 && (
                  <span style={{ fontSize: '0.55rem', color: r.approvalChange > 0 ? S.ayeGreen : S.noRed }}>
                    {r.approvalChange > 0 ? '+' : ''}{r.approvalChange} approval
                  </span>
                )}
                {r.fundsChange !== undefined && r.fundsChange !== 0 && (
                  <span style={{ fontSize: '0.55rem', color: r.fundsChange > 0 ? S.ayeGreen : S.noRed }}>
                    {r.fundsChange > 0 ? '+' : ''}${r.fundsChange}
                  </span>
                )}
                {r.policyPassed !== undefined && (
                  <span style={{ fontSize: '0.55rem', color: r.policyPassed ? S.ayeGreen : S.noRed }}>
                    Policy {r.policyPassed ? 'Passed' : 'Defeated'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Policy vote results from this round */}
        {policyHistory.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{
              fontSize: '0.6rem',
              color: S.brass,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 6,
              fontWeight: 600,
            }}>
              Policy Votes
            </div>
            {policyHistory.slice(-3).map((pv, idx) => (
              <div key={idx} style={{
                padding: '6px 10px',
                marginBottom: 3,
                background: 'rgba(0,0,0,0.1)',
                borderRadius: 2,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span style={{ fontSize: '0.7rem', color: S.parchment }}>{pv.policyName}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.6rem', color: S.ayeGreen }}>Y:{pv.supportSeats}</span>
                  <span style={{ fontSize: '0.6rem', color: S.noRed }}>N:{pv.opposeSeats}</span>
                  <span style={{
                    fontSize: '0.55rem',
                    fontWeight: 700,
                    color: pv.passed ? S.ayeGreen : S.noRed,
                  }}>
                    {pv.passed ? 'PASSED' : 'DEFEATED'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Economy change summary */}
        {prevEconomy && (
          <div>
            <div style={{
              fontSize: '0.6rem',
              color: S.brass,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 6,
              fontWeight: 600,
            }}>
              Economy Changes
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              {([
                ['GDP', economy.gdpGrowth, prevEconomy.gdpGrowth, '%'],
                ['Jobs', economy.unemployment, prevEconomy.unemployment, '%'],
                ['Inflation', economy.inflation, prevEconomy.inflation, '%'],
                ['Debt', economy.publicDebt, prevEconomy.publicDebt, '%'],
              ] as [string, number, number, string][]).map(([label, curr, prev, unit]) => {
                const d = curr - prev;
                return (
                  <div key={label} style={{
                    padding: '4px 8px',
                    background: 'rgba(0,0,0,0.1)',
                    borderRadius: 2,
                  }}>
                    <div style={{ fontSize: '0.55rem', color: S.textMuted }}>{label}</div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: S.parchment }}>
                      {curr.toFixed(1)}{unit}
                      <span style={{
                        fontSize: '0.55rem',
                        marginLeft: 4,
                        color: Math.abs(d) < 0.01 ? S.textMuted : d > 0 ? S.ayeGreen : S.noRed,
                      }}>
                        {d > 0 ? '+' : ''}{d.toFixed(1)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// ELECTION PANEL
// ============================================================

const ElectionPanel: React.FC<{
  electionHistory: ElectionResult[];
  players: Player[];
  governmentLeaderId: string | null;
  stateControl: Record<StateCode, StateControl>;
}> = ({ electionHistory, players, governmentLeaderId, stateControl }) => {
  const latestElection = electionHistory.length > 0 ? electionHistory[electionHistory.length - 1] : null;
  const playerName = (id: string | null) => (id ? players.find((p) => p.id === id)?.name ?? 'Unknown' : 'None');
  const playerColor = (id: string | null) => (id ? players.find((p) => p.id === id)?.color ?? '#666' : '#444');
  const leader = governmentLeaderId ? players.find((p) => p.id === governmentLeaderId) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: `1px solid ${S.borderSubtle}`,
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          color: S.gold,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
        }}>
          {'\u2617'} Election Results
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {/* Government formation */}
        {leader && (
          <div style={{
            padding: '16px',
            marginBottom: 12,
            background: 'rgba(218,165,32,0.1)',
            border: `1px solid ${S.gold}`,
            borderRadius: 3,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '0.6rem', color: S.gold, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
              Government Formed
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ width: 16, height: 16, borderRadius: 3, backgroundColor: leader.color }} />
              <span style={{ fontSize: '1rem', fontWeight: 800, color: S.parchment }}>
                {leader.name}
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: S.brass }}>
              {leader.seats} seats
            </div>
          </div>
        )}

        {/* Seat changes */}
        {latestElection && latestElection.seatChanges.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{
              fontSize: '0.6rem',
              color: S.brass,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 6,
              fontWeight: 600,
            }}>
              Seat Changes ({latestElection.seatChanges.length})
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {latestElection.seatChanges.map((sc, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 8px',
                  borderBottom: `1px solid rgba(255,255,255,0.03)`,
                  fontSize: '0.65rem',
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: playerColor(sc.oldOwner) }} />
                  <span style={{ color: S.textMuted }}>{'\u2192'}</span>
                  <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: playerColor(sc.newOwner) }} />
                  <span style={{ color: S.textSecondary, flex: 1 }}>{sc.seatId}</span>
                  <span style={{ color: S.textMuted }}>{playerName(sc.newOwner)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* National swing */}
        {latestElection && latestElection.nationalSwing && (
          <div style={{ marginBottom: 12 }}>
            <div style={{
              fontSize: '0.6rem',
              color: S.brass,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 6,
              fontWeight: 600,
            }}>
              National Swing
            </div>
            {Object.entries(latestElection.nationalSwing).map(([pid, swing]) => {
              const p = players.find((pl) => pl.id === pid);
              if (!p) return null;
              return (
                <div key={pid} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 8px',
                  borderBottom: `1px solid rgba(255,255,255,0.03)`,
                }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: p.color }} />
                  <span style={{ flex: 1, fontSize: '0.7rem', color: S.textPrimary }}>{p.name}</span>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: swing > 0 ? S.ayeGreen : swing < 0 ? S.noRed : S.textMuted,
                  }}>
                    {swing > 0 ? '+' : ''}{swing.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* State control */}
        <div>
          <div style={{
            fontSize: '0.6rem',
            color: S.brass,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 6,
            fontWeight: 600,
          }}>
            State Control
          </div>
          {ALL_STATES.map((st) => {
            const sc = stateControl[st];
            if (!sc) return null;
            return (
              <div key={st} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 8px',
                borderBottom: `1px solid rgba(255,255,255,0.03)`,
              }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: S.parchment, width: 30 }}>{st}</span>
                <div style={{
                  flex: 1,
                  height: 6,
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: sc.totalSeats > 0 ? `${(sc.seatCount / sc.totalSeats) * 100}%` : '0%',
                    height: '100%',
                    background: playerColor(sc.controllerId),
                    borderRadius: 3,
                    transition: 'width 0.5s',
                  }} />
                </div>
                <span style={{ fontSize: '0.6rem', color: S.textSecondary, minWidth: 30, textAlign: 'right' }}>
                  {sc.seatCount}/{sc.totalSeats}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// GAME OVER PANEL (sidebar)
// ============================================================

const GameOverPanel: React.FC<{
  players: Player[];
  winnerId: string | null;
  finalScores: PlayerScore[] | null;
  playerId: string;
}> = ({ players, winnerId, finalScores, playerId }) => {
  const winner = players.find((p) => p.id === winnerId);

  const sortedScores = useMemo(() => {
    if (finalScores) {
      return [...finalScores].sort((a, b) => b.total - a.total);
    }
    return [...players].sort((a, b) => b.seats - a.seats).map((p) => ({
      playerId: p.id,
      seats: p.seats,
      policyAlignment: p.policyScore,
      economicPerformance: 0,
      total: p.seats,
    }));
  }, [finalScores, players]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        padding: '16px',
        borderBottom: `1px solid ${S.borderSubtle}`,
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: '0.85rem',
          fontWeight: 900,
          color: S.gold,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          marginBottom: 4,
        }}>
          {'\u2605'} Final Results
        </div>
        {winner && (
          <div style={{ fontSize: '1rem', fontWeight: 700, color: winner.color }}>
            {winner.name} Wins!
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {/* Score breakdown */}
        <div style={{
          fontSize: '0.6rem',
          color: S.brass,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: 6,
          fontWeight: 600,
        }}>
          Final Standings
        </div>

        {/* Header row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '24px 1fr 40px 40px 40px 48px',
          gap: 4,
          padding: '4px 8px',
          fontSize: '0.5rem',
          color: S.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          borderBottom: `1px solid ${S.borderSubtle}`,
          marginBottom: 4,
        }}>
          <span>#</span>
          <span>Party</span>
          <span style={{ textAlign: 'right' }}>Seats</span>
          <span style={{ textAlign: 'right' }}>Policy</span>
          <span style={{ textAlign: 'right' }}>Econ</span>
          <span style={{ textAlign: 'right' }}>Total</span>
        </div>

        {sortedScores.map((score, rank) => {
          const p = players.find((pl) => pl.id === score.playerId);
          if (!p) return null;
          const isMe = p.id === playerId;
          return (
            <div
              key={score.playerId}
              style={{
                display: 'grid',
                gridTemplateColumns: '24px 1fr 40px 40px 40px 48px',
                gap: 4,
                padding: '6px 8px',
                alignItems: 'center',
                background: rank === 0
                  ? 'rgba(218,165,32,0.1)'
                  : isMe
                    ? 'rgba(245,240,225,0.04)'
                    : 'transparent',
                borderBottom: `1px solid rgba(255,255,255,0.03)`,
              }}
            >
              <span style={{
                fontSize: rank === 0 ? '0.85rem' : '0.65rem',
                color: rank === 0 ? S.gold : S.textMuted,
                fontWeight: 700,
              }}>
                {rank === 0 ? '\u2655' : `${rank + 1}.`}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: p.color, flexShrink: 0 }} />
                <span style={{
                  fontSize: '0.72rem',
                  color: isMe ? S.parchment : S.textPrimary,
                  fontWeight: isMe ? 600 : 400,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {p.name}
                  {isMe && <span style={{ color: S.textMuted, fontSize: '0.55rem', marginLeft: 3 }}>(you)</span>}
                </span>
              </div>
              <span style={{ fontSize: '0.7rem', color: S.textSecondary, textAlign: 'right' }}>{score.seats}</span>
              <span style={{ fontSize: '0.7rem', color: S.textSecondary, textAlign: 'right' }}>{score.policyAlignment.toFixed(0)}</span>
              <span style={{ fontSize: '0.7rem', color: S.textSecondary, textAlign: 'right' }}>{score.economicPerformance.toFixed(0)}</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: S.parchment, textAlign: 'right' }}>
                {score.total.toFixed(0)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================
// GAME OVER OVERLAY (fullscreen)
// ============================================================

const GameOverOverlay: React.FC<{
  players: Player[];
  winnerId: string | null;
  finalScores: PlayerScore[] | null;
  playerId: string;
  onDismiss: () => void;
}> = ({ players, winnerId, finalScores, playerId, onDismiss }) => {
  const winner = players.find((p) => p.id === winnerId);
  const isMe = winnerId === playerId;

  const sortedScores = useMemo(() => {
    if (finalScores) {
      return [...finalScores].sort((a, b) => b.total - a.total);
    }
    return [...players].sort((a, b) => b.seats - a.seats).map((p) => ({
      playerId: p.id,
      seats: p.seats,
      policyAlignment: p.policyScore,
      economicPerformance: 0,
      total: p.seats,
    }));
  }, [finalScores, players]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onDismiss}
    >
      <div
        style={{
          maxWidth: 520,
          width: '90%',
          textAlign: 'center',
          background: S.bgPrimary,
          border: `2px solid ${S.gold}`,
          borderRadius: 6,
          padding: '32px 24px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          fontSize: '2.2rem',
          fontWeight: 900,
          color: isMe ? S.gold : S.parchment,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 8,
        }}>
          {isMe ? 'Victory!' : 'Game Over'}
        </div>
        {winner && (
          <div style={{
            fontSize: '1.3rem',
            fontWeight: 600,
            color: winner.color,
            marginBottom: 24,
          }}>
            {winner.name} has formed government.
          </div>
        )}

        {/* Final standings */}
        <div style={{
          background: 'rgba(0,0,0,0.3)',
          border: `1px solid ${S.borderBrass}`,
          borderRadius: 4,
          padding: '16px',
          textAlign: 'left',
          marginBottom: 20,
        }}>
          <div style={{
            fontSize: '0.65rem',
            color: S.brass,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            marginBottom: 10,
            textAlign: 'center',
            fontWeight: 600,
          }}>
            Final Standings
          </div>
          {sortedScores.map((score, rank) => {
            const p = players.find((pl) => pl.id === score.playerId);
            if (!p) return null;
            const isCurrentPlayer = p.id === playerId;
            return (
              <div
                key={score.playerId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 6px',
                  borderBottom: rank < sortedScores.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}
              >
                <span style={{
                  fontSize: rank === 0 ? '1.4rem' : '1rem',
                  fontWeight: 700,
                  color: rank === 0 ? S.gold : S.textMuted,
                  width: 28,
                  textAlign: 'center',
                }}>
                  {rank === 0 ? '\u2655' : `${rank + 1}.`}
                </span>
                <span style={{
                  width: 14,
                  height: 14,
                  borderRadius: 2,
                  backgroundColor: p.color,
                  display: 'inline-block',
                  flexShrink: 0,
                }} />
                <span style={{
                  flex: 1,
                  fontSize: '0.9rem',
                  color: S.textPrimary,
                  fontWeight: isCurrentPlayer ? 600 : 400,
                }}>
                  {p.name}
                  {isCurrentPlayer && (
                    <span style={{ color: S.textMuted, fontSize: '0.7rem', marginLeft: 4 }}>(you)</span>
                  )}
                </span>
                <span style={{ fontSize: '0.75rem', color: S.textSecondary }}>
                  {score.seats} seats
                </span>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: S.parchment }}>
                  {score.total.toFixed(0)}
                </span>
              </div>
            );
          })}
        </div>

        <button
          onClick={onDismiss}
          style={{
            padding: '10px 32px',
            background: S.brass,
            border: `1px solid ${S.brassLight}`,
            color: '#1a1a1a',
            fontSize: '0.85rem',
            fontWeight: 800,
            fontFamily: S.fontMono,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            cursor: 'pointer',
            borderRadius: 3,
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

// ============================================================
// ECONOMY TAB (center panel)
// ============================================================

const SECTOR_LABELS: Record<string, string> = {
  manufacturing: 'Manufacturing', services: 'Services', finance: 'Finance',
  technology: 'Technology', healthcare: 'Healthcare', education: 'Education',
  housing: 'Housing', energy: 'Energy', agriculture: 'Agriculture',
};

const EconomyTab: React.FC<{
  economy: EconomicStateData;
  economyHistory: EconomicStateData[];
  prevEconomy: EconomicStateData | undefined;
  gdpHistory: number[];
  unemploymentHistory: number[];
  inflationHistory: number[];
  voterGroups: VoterGroupState[];
  players: Player[];
}> = ({ economy, economyHistory, prevEconomy, gdpHistory, unemploymentHistory, inflationHistory, voterGroups, players }) => {
  const playerName = (id: string | null) => {
    if (!id) return 'None';
    return players.find((p) => p.id === id)?.name ?? 'Unknown';
  };
  const playerColor = (id: string | null) => {
    if (!id) return '#444';
    return players.find((p) => p.id === id)?.color ?? '#444';
  };

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Sparklines row */}
      <div style={{
        display: 'flex',
        gap: 12,
        padding: '12px',
        background: S.bgPanel,
        border: `1px solid ${S.borderSubtle}`,
        borderRadius: 4,
      }}>
        {([
          { label: 'GDP Growth', data: gdpHistory, color: S.ayeGreen },
          { label: 'Unemployment', data: unemploymentHistory, color: S.noRed },
          { label: 'Inflation', data: inflationHistory, color: S.warning },
        ]).map((sp) => (
          <div key={sp.label} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '0.55rem', color: S.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
              {sp.label}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Sparkline data={sp.data} color={sp.color} width={100} height={28} />
            </div>
          </div>
        ))}
      </div>

      {/* Big indicators grid */}
      <div style={{
        padding: '12px',
        background: S.bgPanel,
        border: `1px solid ${S.borderSubtle}`,
        borderRadius: 4,
      }}>
        <div style={{
          fontSize: '0.6rem',
          color: S.brass,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          marginBottom: 10,
          fontWeight: 600,
        }}>
          Economic Indicators
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
          {([
            { label: 'GDP Growth', value: economy.gdpGrowth, prev: prevEconomy?.gdpGrowth, unit: '%', good: 'high' as const, precision: 1 },
            { label: 'Unemployment', value: economy.unemployment, prev: prevEconomy?.unemployment, unit: '%', good: 'low' as const, precision: 1 },
            { label: 'Inflation', value: economy.inflation, prev: prevEconomy?.inflation, unit: '%', good: 'low' as const, precision: 1 },
            { label: 'Interest Rate', value: economy.interestRate, prev: prevEconomy?.interestRate, unit: '%', good: 'low' as const, precision: 1 },
            { label: 'Budget Bal.', value: economy.budgetBalance, prev: prevEconomy?.budgetBalance, unit: '% GDP', good: 'zero' as const, precision: 1 },
            { label: 'Public Debt', value: economy.publicDebt, prev: prevEconomy?.publicDebt, unit: '% GDP', good: 'low' as const, precision: 0 },
            { label: 'Consumer Conf.', value: economy.consumerConfidence, prev: prevEconomy?.consumerConfidence, unit: '', good: 'high' as const, precision: 0 },
            { label: 'Business Conf.', value: economy.businessConfidence, prev: prevEconomy?.businessConfidence, unit: '', good: 'high' as const, precision: 0 },
          ]).map((ind) => {
            const da = deltaArrow(ind.value, ind.prev);
            return (
              <div key={ind.label} style={{ padding: '6px 0' }}>
                <div style={{ fontSize: '0.52rem', color: S.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
                  {ind.label}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: indicatorColor(ind.value, ind.good) }}>
                    {ind.value.toFixed(ind.precision)}{ind.unit}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: da.color }}>{da.arrow}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sector health bars */}
      <div style={{
        padding: '12px',
        background: S.bgPanel,
        border: `1px solid ${S.borderSubtle}`,
        borderRadius: 4,
      }}>
        <div style={{
          fontSize: '0.6rem',
          color: S.brass,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          marginBottom: 10,
          fontWeight: 600,
        }}>
          Sector Health
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px 16px' }}>
          {Object.entries(economy.sectors).map(([name, health]) => {
            const pct = Math.max(0, Math.min(100, health));
            const barColor = pct > 60 ? S.ayeGreen : pct > 35 ? S.brass : S.noRed;
            return (
              <div key={name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: '0.55rem', color: S.textMuted }}>{SECTOR_LABELS[name] || name}</span>
                  <span style={{ fontSize: '0.55rem', color: barColor }}>{pct.toFixed(0)}</span>
                </div>
                <div style={{ height: 5, background: 'rgba(0,0,0,0.3)', borderRadius: 3 }}>
                  <div style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: barColor,
                    borderRadius: 3,
                    transition: 'width 0.5s',
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Voter group satisfaction */}
      {voterGroups.length > 0 && (
        <div style={{
          padding: '12px',
          background: S.bgPanel,
          border: `1px solid ${S.borderSubtle}`,
          borderRadius: 4,
        }}>
          <div style={{
            fontSize: '0.6rem',
            color: S.brass,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            marginBottom: 10,
            fontWeight: 600,
          }}>
            Voter Groups
          </div>
          {voterGroups.map((group) => {
            const satisfactionColor = group.satisfaction > 60 ? S.ayeGreen : group.satisfaction > 35 ? S.brass : S.noRed;
            return (
              <div key={group.id} style={{
                padding: '8px 0',
                borderBottom: `1px solid rgba(255,255,255,0.04)`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.78rem', color: S.textPrimary }}>
                    {group.name}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.55rem', color: S.textMuted }}>
                      Pop: {(group.population * 100).toFixed(0)}%
                    </span>
                    {group.leaningPartyId && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <div style={{
                          width: 6,
                          height: 6,
                          borderRadius: 1,
                          backgroundColor: playerColor(group.leaningPartyId),
                        }} />
                        <span style={{ fontSize: '0.5rem', color: S.textMuted }}>
                          {playerName(group.leaningPartyId)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 5, background: 'rgba(0,0,0,0.3)', borderRadius: 3 }}>
                    <div style={{
                      width: `${Math.max(0, Math.min(100, group.satisfaction))}%`,
                      height: '100%',
                      background: satisfactionColor,
                      borderRadius: 3,
                      transition: 'width 0.5s',
                    }} />
                  </div>
                  <span style={{ fontSize: '0.6rem', color: satisfactionColor, width: 24, textAlign: 'right', fontWeight: 600 }}>
                    {group.satisfaction.toFixed(0)}
                  </span>
                </div>
                {group.topConcerns.length > 0 && (
                  <div style={{ fontSize: '0.5rem', color: S.textMuted, marginTop: 3 }}>
                    Concerns: {group.topConcerns.slice(0, 3).map((c) => c.variable).join(', ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GameBoard;
