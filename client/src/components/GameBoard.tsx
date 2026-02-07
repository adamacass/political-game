import React, { useState, useMemo, useCallback } from 'react';
import {
  GameState,
  GameConfig,
  Player,
  Seat,
  SeatId,
  ActionType,
  Phase,
  Bill,
  PoliticalEvent,
  PlayerAction,
  GameEvent,
  Issue,
  EconomicStateData,
  VoterGroupState,
} from '../types';
import { Chamber } from './Chamber';
import { AustraliaMapView } from './AustraliaMapView';

// ============================================================
// THE HOUSE - Main Game Board Component
// ============================================================

interface GameBoardProps {
  gameState: GameState;
  config: GameConfig;
  playerId: string;
  onAction: (actionType: ActionType, targetSeatId?: string, targetPlayerId?: string, fundsSpent?: number) => void;
  onEndTurn: () => void;
  onProposeBill: (billId: string) => void;
  onSkipProposal: () => void;
  onCastVote: (vote: 'aye' | 'no') => void;
  onAcknowledgeEvent: () => void;
  onAcknowledgeResult: () => void;
  onSendChat: (content: string, recipientId: string | null) => void;
  onForceAdvance: () => void;
}

// ---- Action definitions ----

interface ActionDef {
  type: ActionType;
  label: string;
  apCost: number;
  fundsCost: number | null; // null = free, number = config-driven
  description: string;
  icon: string;
  needsTarget: 'seat' | 'player' | null;
}

function getActionDefs(config: GameConfig): ActionDef[] {
  return [
    {
      type: 'campaign',
      label: 'CAMPAIGN',
      apCost: 1,
      fundsCost: config.campaignBaseCost,
      description: 'Deploy resources to win a seat',
      icon: '\u2691', // flag
      needsTarget: 'seat',
    },
    {
      type: 'policy_speech',
      label: 'POLICY SPEECH',
      apCost: 1,
      fundsCost: 0,
      description: 'Rally the base, boost approval',
      icon: '\u2606', // star
      needsTarget: null,
    },
    {
      type: 'attack_ad',
      label: 'ATTACK AD',
      apCost: 1,
      fundsCost: config.attackAdCost,
      description: "Target opponent's reputation",
      icon: '\u2620', // skull
      needsTarget: 'player',
    },
    {
      type: 'fundraise',
      label: 'FUNDRAISE',
      apCost: 1,
      fundsCost: 0,
      description: 'Shore up the war chest',
      icon: '$',
      needsTarget: null,
    },
    {
      type: 'media_blitz',
      label: 'MEDIA BLITZ',
      apCost: 1,
      fundsCost: config.mediaBlitzCost,
      description: 'Dominate the news cycle',
      icon: '\u260A', // ascending node (newspaper-like)
      needsTarget: null,
    },
    {
      type: 'pork_barrel',
      label: 'PORK BARREL',
      apCost: 1,
      fundsCost: config.porkBarrelCost,
      description: 'Lock down marginal seats',
      icon: '\u2302', // house
      needsTarget: null,
    },
  ];
}

// ---- Phase ordering for the top bar ----

const PHASE_SEQUENCE: { key: Phase; label: string }[] = [
  { key: 'budget', label: 'Budget' },
  { key: 'action', label: 'Action' },
  { key: 'legislation_propose', label: 'Legislation' },
  { key: 'event', label: 'Event' },
];

function phaseIndex(phase: Phase): number {
  if (phase === 'legislation_vote' || phase === 'legislation_result') return 2;
  const idx = PHASE_SEQUENCE.findIndex((p) => p.key === phase);
  return idx >= 0 ? idx : -1;
}

// ---- Helpers ----

function issueClass(issue: Issue): string {
  return `issue-${issue}`;
}

function formatIssue(issue: Issue): string {
  return issue.charAt(0).toUpperCase() + issue.slice(1);
}

function formatEventMessage(evt: GameEvent, players: Player[]): string {
  const playerName = (id: string) => players.find((p) => p.id === id)?.name ?? 'Unknown';
  switch (evt.type) {
    case 'seat_captured':
      return `${playerName(evt.toPlayerId)} captured ${evt.seatName}`;
    case 'seat_lost':
      return `${playerName(evt.fromPlayerId)} lost ${evt.seatName}`;
    case 'bill_resolved':
      return `Bill ${evt.passed ? 'PASSED' : 'DEFEATED'} (${evt.yesWeight}-${evt.noWeight})`;
    case 'action_performed': {
      const a = evt.action;
      const msg = a.result?.message ?? a.type.replace('_', ' ');
      return `${playerName(a.playerId)}: ${msg}`;
    }
    case 'event_occurred':
      return `Event: ${evt.eventName}`;
    case 'round_started':
      return `Round ${evt.round} \u2014 Issue: ${formatIssue(evt.activeIssue)}`;
    case 'approval_changed':
      return `${playerName(evt.playerId)} approval ${evt.delta > 0 ? '+' : ''}${evt.delta} (${evt.reason})`;
    case 'state_control_changed':
      return `${evt.state} control changed to ${evt.newController ? playerName(evt.newController) : 'none'}`;
    case 'phase_changed':
      return `Phase: ${evt.toPhase.replace('_', ' ')}`;
    case 'game_ended':
      return `Game Over! ${playerName(evt.winner)} wins!`;
    default:
      return '';
  }
}

function stanceLabel(stance: 'favoured' | 'neutral' | 'opposed'): string {
  if (stance === 'favoured') return '+';
  if (stance === 'opposed') return '\u2212'; // minus
  return '\u00B7'; // middle dot
}

function stanceColor(stance: 'favoured' | 'neutral' | 'opposed'): string {
  if (stance === 'favoured') return 'var(--aye-green)';
  if (stance === 'opposed') return 'var(--no-red)';
  return 'var(--text-muted)';
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export const GameBoard: React.FC<GameBoardProps> = ({
  gameState,
  config,
  playerId,
  onAction,
  onEndTurn,
  onProposeBill,
  onSkipProposal,
  onCastVote,
  onAcknowledgeEvent,
  onAcknowledgeResult,
  onSendChat,
  onForceAdvance,
}) => {
  // ---- Local state ----
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  const [selectedSeatId, setSelectedSeatId] = useState<SeatId | null>(null);
  const [selectedTargetPlayer, setSelectedTargetPlayer] = useState<string | null>(null);
  const [campaignSpend, setCampaignSpend] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'chamber' | 'map' | 'economy'>('chamber');

  // ---- Derived data ----
  const currentPlayer = useMemo(
    () => gameState.players.find((p) => p.id === playerId) ?? null,
    [gameState.players, playerId],
  );

  const isMyTurn = gameState.turnOrder[gameState.currentPlayerIndex] === playerId;
  const activePlayerName = useMemo(() => {
    const id = gameState.turnOrder[gameState.currentPlayerIndex];
    return gameState.players.find((p) => p.id === id)?.name ?? 'Unknown';
  }, [gameState.turnOrder, gameState.currentPlayerIndex, gameState.players]);

  const speakerId = gameState.turnOrder[gameState.speakerIndex];
  const speakerPlayer = useMemo(
    () => gameState.players.find((p) => p.id === speakerId) ?? null,
    [gameState.players, speakerId],
  );
  const iAmSpeaker = speakerId === playerId;

  const actionDefs = useMemo(() => getActionDefs(config), [config]);

  const seats = useMemo(() => Object.values(gameState.seats), [gameState.seats]);

  // Targetable seats: opponent-held or unclaimed seats (for campaign)
  const targetableSeatIds = useMemo<SeatId[]>(() => {
    if (selectedAction !== 'campaign') return [];
    return seats
      .filter((s) => s.ownerPlayerId !== playerId)
      .map((s) => s.id);
  }, [selectedAction, seats, playerId]);

  // Other players (for attack ad targeting)
  const otherPlayers = useMemo(
    () => gameState.players.filter((p) => p.id !== playerId),
    [gameState.players, playerId],
  );

  // Current phase index for phase bar
  const currentPhaseIdx = phaseIndex(gameState.phase);

  // Recent events for ticker
  const recentEvents = useMemo(() => {
    return gameState.eventLog
      .filter((e) => {
        const msg = formatEventMessage(e, gameState.players);
        return msg.length > 0;
      })
      .slice(-5)
      .reverse();
  }, [gameState.eventLog, gameState.players]);

  // Budget amounts (from recent budget_distributed event)
  const budgetAmounts = useMemo(() => {
    const evt = [...gameState.eventLog].reverse().find((e) => e.type === 'budget_distributed');
    if (evt && evt.type === 'budget_distributed') return evt.amounts;
    return null;
  }, [gameState.eventLog]);

  // ---- Action handlers ----

  const handleActionTileClick = useCallback(
    (actionType: ActionType) => {
      if (!isMyTurn || !currentPlayer) return;
      const def = actionDefs.find((d) => d.type === actionType);
      if (!def) return;

      // Check AP
      if (currentPlayer.actionPoints < def.apCost) return;

      // Check funds
      const cost = def.fundsCost ?? 0;
      if (cost > 0 && currentPlayer.funds < cost) return;

      if (selectedAction === actionType) {
        // Deselect
        setSelectedAction(null);
        setSelectedSeatId(null);
        setSelectedTargetPlayer(null);
        setCampaignSpend(0);
        return;
      }

      setSelectedAction(actionType);
      setSelectedSeatId(null);
      setSelectedTargetPlayer(null);
      setCampaignSpend(cost);

      // If action needs no target, fire immediately
      if (!def.needsTarget) {
        onAction(actionType, undefined, undefined, cost > 0 ? cost : undefined);
        setSelectedAction(null);
        setCampaignSpend(0);
      }
    },
    [isMyTurn, currentPlayer, actionDefs, selectedAction, onAction],
  );

  const handleSeatClick = useCallback(
    (seatId: SeatId) => {
      if (selectedAction === 'campaign' && targetableSeatIds.includes(seatId)) {
        setSelectedSeatId(seatId);
        onAction('campaign', seatId, undefined, campaignSpend > 0 ? campaignSpend : undefined);
        setSelectedAction(null);
        setSelectedSeatId(null);
        setCampaignSpend(0);
      }
    },
    [selectedAction, targetableSeatIds, campaignSpend, onAction],
  );

  const handleTargetPlayerClick = useCallback(
    (targetId: string) => {
      if (selectedAction === 'attack_ad') {
        setSelectedTargetPlayer(targetId);
        const def = actionDefs.find((d) => d.type === 'attack_ad');
        const cost = def?.fundsCost ?? 0;
        onAction('attack_ad', undefined, targetId, cost > 0 ? cost : undefined);
        setSelectedAction(null);
        setSelectedTargetPlayer(null);
      }
    },
    [selectedAction, actionDefs, onAction],
  );

  // ---- Render helpers ----

  const renderApPips = (current: number, max: number) => {
    const pips: React.ReactNode[] = [];
    for (let i = 0; i < max; i++) {
      pips.push(
        <span
          key={i}
          style={{
            display: 'inline-block',
            width: 10,
            height: 10,
            borderRadius: '50%',
            marginRight: 3,
            background: i < current ? 'var(--brass-light)' : 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
          }}
        />,
      );
    }
    return <div style={{ display: 'flex', alignItems: 'center' }}>{pips}</div>;
  };

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
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
      }}
    >
      {/* ============================================================
          TOP BAR - Phase indicator + round info
          ============================================================ */}
      <div className="phase-bar" style={{ flexShrink: 0 }}>
        {PHASE_SEQUENCE.map((ps, idx) => {
          let cls = 'phase-step';
          if (idx === currentPhaseIdx) cls += ' active';
          else if (idx < currentPhaseIdx) cls += ' completed';
          return (
            <div key={ps.key} className={cls}>
              {idx < currentPhaseIdx && '\u2713 '}
              {ps.label}
            </div>
          );
        })}

        {/* Round number */}
        <div
          className="phase-step"
          style={{
            flex: '0 0 auto',
            padding: '0 16px',
            borderRight: 'none',
            color: 'var(--brass-light)',
            fontWeight: 600,
          }}
        >
          Round {gameState.round}/{gameState.maxRounds}
        </div>

        {/* Active issue badge */}
        <div
          className="phase-step"
          style={{ flex: '0 0 auto', padding: '0 12px', borderRight: 'none' }}
        >
          <span
            className={`bill-card-issue ${issueClass(gameState.activeIssue)}`}
            style={{ fontSize: '0.6rem' }}
          >
            {formatIssue(gameState.activeIssue)}
          </span>
        </div>

        {/* Force advance (host) */}
        {currentPlayer?.isHost && gameState.phase !== 'game_over' && gameState.phase !== 'waiting' && (
          <div
            className="phase-step"
            style={{ flex: '0 0 auto', padding: '0 8px', borderRight: 'none', cursor: 'pointer' }}
            onClick={onForceAdvance}
            title="Force advance phase"
          >
            <span style={{ color: 'var(--warning)', fontSize: '0.7rem' }}>{'\u25B6'} Skip</span>
          </div>
        )}
      </div>

      {/* ============================================================
          MAIN AREA - Three columns
          ============================================================ */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* ---- LEFT COLUMN: Player Dashboard ---- */}
        <div
          style={{
            width: 260,
            flexShrink: 0,
            overflowY: 'auto',
            borderRight: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
          }}
        >
          {/* My stats panel */}
          <div className="panel" style={{ margin: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none' }}>
            <div className="panel-header">
              {currentPlayer?.name ?? 'You'}
              {currentPlayer && (
                <span
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    backgroundColor: currentPlayer.color,
                    marginLeft: 8,
                    verticalAlign: 'middle',
                  }}
                />
              )}
            </div>
            {currentPlayer && (
              <div style={{ padding: '12px 16px' }}>
                {/* Seats - large number */}
                <div className="stat-block" style={{ marginBottom: 8 }}>
                  <div className="stat-value" style={{ fontSize: '2rem' }}>
                    {currentPlayer.seats}
                  </div>
                  <div className="stat-label">Seats</div>
                </div>

                {/* Approval rating */}
                <div style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      marginBottom: 3,
                    }}
                  >
                    <span className="stat-label" style={{ margin: 0 }}>
                      Approval
                    </span>
                    <span className="font-mono" style={{ color: 'var(--parchment)', fontSize: '0.9rem', fontWeight: 600 }}>
                      {currentPlayer.approval}%
                    </span>
                  </div>
                  <div className="approval-bar">
                    <div
                      className="approval-fill"
                      style={{
                        width: `${Math.min(100, Math.max(0, currentPlayer.approval))}%`,
                        background:
                          currentPlayer.approval >= 60
                            ? 'var(--aye-green)'
                            : currentPlayer.approval >= 40
                              ? 'var(--brass)'
                              : 'var(--no-red)',
                      }}
                    />
                  </div>
                </div>

                {/* Funds + PCap row */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <div className="stat-block panel-inset" style={{ flex: 1, borderRadius: 2 }}>
                    <div className="stat-value" style={{ fontSize: '1.1rem' }}>
                      ${currentPlayer.funds}
                    </div>
                    <div className="stat-label">Funds</div>
                  </div>
                  <div className="stat-block panel-inset" style={{ flex: 1, borderRadius: 2 }}>
                    <div className="stat-value" style={{ fontSize: '1.1rem', color: 'var(--gold)' }}>
                      {currentPlayer.pcap}
                    </div>
                    <div className="stat-label">PCap</div>
                  </div>
                </div>

                {/* Action Points */}
                <div style={{ marginBottom: 4 }}>
                  <div className="stat-label" style={{ marginBottom: 4 }}>
                    Action Points
                  </div>
                  {renderApPips(currentPlayer.actionPoints, currentPlayer.maxActionPoints)}
                </div>
              </div>
            )}
          </div>

          {/* All players summary */}
          <div className="panel" style={{ flex: 1, margin: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none' }}>
            <div className="panel-header">All Parties</div>
            <div style={{ padding: '8px 0' }}>
              {gameState.players.map((p) => {
                const isActive = gameState.turnOrder[gameState.currentPlayerIndex] === p.id;
                const isMe = p.id === playerId;
                return (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 12px',
                      background: isActive
                        ? 'rgba(184,134,11,0.08)'
                        : isMe
                          ? 'rgba(255,255,255,0.03)'
                          : 'transparent',
                      borderLeft: isActive ? '3px solid var(--brass-light)' : '3px solid transparent',
                    }}
                  >
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 2,
                        backgroundColor: p.color,
                        flexShrink: 0,
                        border: isMe ? '1px solid rgba(255,255,255,0.4)' : '1px solid rgba(0,0,0,0.3)',
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        className="font-serif"
                        style={{
                          fontSize: '0.8rem',
                          color: isMe ? 'var(--text-bright)' : 'var(--text-primary)',
                          fontWeight: isMe ? 600 : 400,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {p.name}
                        {p.id === speakerId && (
                          <span
                            style={{ color: 'var(--gold)', marginLeft: 4, fontSize: '0.65rem' }}
                            title="Speaker"
                          >
                            {'\u2655'}
                          </span>
                        )}
                        {!p.connected && (
                          <span
                            style={{ color: 'var(--no-red)', marginLeft: 4, fontSize: '0.6rem' }}
                          >
                            (DC)
                          </span>
                        )}
                      </div>
                    </div>
                    <div
                      className="font-mono"
                      style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'right' }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--parchment)' }}>{p.seats}</span>
                      <span style={{ margin: '0 3px', color: 'var(--text-muted)' }}>/</span>
                      <span>{p.approval}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ---- CENTER: Chamber / Map / Economy ---- */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* View toggle bar */}
          <div style={{
            display: 'flex', gap: 0, flexShrink: 0,
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            {([
              { key: 'chamber', label: 'Chamber' },
              { key: 'map', label: 'Map' },
              { key: 'economy', label: 'Economy' },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setViewMode(tab.key)}
                style={{
                  flex: 1,
                  padding: '6px 0',
                  background: viewMode === tab.key ? 'rgba(184,134,11,0.1)' : 'transparent',
                  border: 'none',
                  borderBottom: viewMode === tab.key ? '2px solid var(--brass-gold)' : '2px solid transparent',
                  color: viewMode === tab.key ? 'var(--brass-light)' : 'var(--text-muted)',
                  fontSize: '0.7rem',
                  fontFamily: "'IBM Plex Mono', monospace",
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflow: 'auto' }}>
            {/* Chamber view */}
            {viewMode === 'chamber' && (
              <Chamber
                gameState={gameState}
                playerId={playerId}
                selectedSeatId={selectedSeatId}
                targetableSeatIds={targetableSeatIds}
                onSeatClick={handleSeatClick}
              />
            )}

            {/* Map view */}
            {viewMode === 'map' && (
              <AustraliaMapView
                gameState={gameState}
                playerId={playerId}
                selectedSeatId={selectedSeatId}
                targetableSeatIds={targetableSeatIds}
                onSeatClick={handleSeatClick}
              />
            )}

            {/* Economy dashboard view */}
            {viewMode === 'economy' && (
              <EconomyDashboard
                economy={gameState.economy}
                voterGroups={gameState.voterGroups}
                players={gameState.players}
              />
            )}
          </div>

          {/* Instruction overlay on chamber when selecting targets */}
          {selectedAction === 'campaign' && viewMode !== 'economy' && (
            <div
              style={{
                position: 'absolute',
                top: 44,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'var(--wood-dark)',
                border: '1px solid var(--brass-dim)',
                padding: '6px 16px',
                fontSize: '0.75rem',
                color: 'var(--brass-light)',
                zIndex: 10,
                fontFamily: "'IBM Plex Mono', monospace",
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {'\u25C9'} Select a seat to campaign in
            </div>
          )}
        </div>

        {/* ---- RIGHT COLUMN: Context Panel ---- */}
        <div
          style={{
            width: 280,
            flexShrink: 0,
            overflowY: 'auto',
            borderLeft: '1px solid var(--border-subtle)',
          }}
        >
          {/* Budget phase */}
          {gameState.phase === 'budget' && (
            <BudgetPanel
              players={gameState.players}
              budgetAmounts={budgetAmounts}
              config={config}
            />
          )}

          {/* Action phase */}
          {gameState.phase === 'action' && (
            <ActionPanel
              currentPlayer={currentPlayer}
              isMyTurn={isMyTurn}
              activePlayerName={activePlayerName}
              actionDefs={actionDefs}
              selectedAction={selectedAction}
              selectedTargetPlayer={selectedTargetPlayer}
              otherPlayers={otherPlayers}
              onActionTileClick={handleActionTileClick}
              onTargetPlayerClick={handleTargetPlayerClick}
              onEndTurn={onEndTurn}
            />
          )}

          {/* Legislation: Propose */}
          {gameState.phase === 'legislation_propose' && (
            <ProposalPanel
              bills={gameState.availableBills}
              iAmSpeaker={iAmSpeaker}
              speakerName={speakerPlayer?.name ?? 'the Speaker'}
              onProposeBill={onProposeBill}
              onSkipProposal={onSkipProposal}
            />
          )}

          {/* Legislation: Vote */}
          {gameState.phase === 'legislation_vote' && gameState.pendingLegislation && (
            <VotePanel
              pending={gameState.pendingLegislation}
              players={gameState.players}
              playerId={playerId}
              onCastVote={onCastVote}
            />
          )}

          {/* Legislation: Result */}
          {gameState.phase === 'legislation_result' && (
            <ResultPanel
              pending={gameState.pendingLegislation}
              players={gameState.players}
              onAcknowledgeResult={onAcknowledgeResult}
            />
          )}

          {/* Event phase */}
          {gameState.phase === 'event' && gameState.currentEvent && (
            <EventPanel
              event={gameState.currentEvent}
              onAcknowledge={onAcknowledgeEvent}
            />
          )}

          {/* Game over */}
          {gameState.phase === 'game_over' && (
            <GameOverPanel
              players={gameState.players}
              winnerId={gameState.winner}
              finalScores={gameState.finalScores}
              playerId={playerId}
            />
          )}

          {/* Waiting / fallback */}
          {gameState.phase === 'waiting' && (
            <div className="panel" style={{ margin: 0, border: 'none' }}>
              <div className="panel-header">Waiting</div>
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>{'\u23F3'}</div>
                <div className="font-serif">Waiting for the game to begin...</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================
          BOTTOM BAR - Event ticker / feed
          ============================================================ */}
      <div className="ticker" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontWeight: 600, color: 'var(--brass)', flexShrink: 0, letterSpacing: '0.12em' }}>
          {'\u25CF'} FEED
        </span>
        <div style={{ display: 'flex', gap: 24, overflow: 'hidden' }}>
          {recentEvents.length === 0 && (
            <span style={{ color: 'var(--text-muted)' }}>No events yet.</span>
          )}
          {recentEvents.map((evt, idx) => (
            <span
              key={`${evt.timestamp}-${idx}`}
              style={{ color: idx === 0 ? 'var(--parchment)' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}
            >
              {formatEventMessage(evt, gameState.players)}
              {idx < recentEvents.length - 1 && (
                <span style={{ color: 'var(--text-muted)', margin: '0 0 0 24px' }}>{'\u2022'}</span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* ============================================================
          GAME OVER OVERLAY
          ============================================================ */}
      {gameState.phase === 'game_over' && gameState.winner && (
        <GameOverOverlay
          players={gameState.players}
          winnerId={gameState.winner}
          finalScores={gameState.finalScores}
          playerId={playerId}
        />
      )}
    </div>
  );
};

// ============================================================
// SUB-COMPONENTS
// ============================================================

// ---- Budget Panel ----

const BudgetPanel: React.FC<{
  players: Player[];
  budgetAmounts: Record<string, number> | null;
  config: GameConfig;
}> = ({ players, budgetAmounts, config }) => (
  <div className="panel" style={{ margin: 0, border: 'none' }}>
    <div className="panel-header">{'\u00A7'} Budget Phase</div>
    <div style={{ padding: 16 }}>
      <div
        className="font-serif"
        style={{ color: 'var(--text-secondary)', marginBottom: 12, fontSize: '0.85rem' }}
      >
        Collecting revenue... Each seat generates ${config.incomePerSeat}.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {players.map((p) => {
          const income = budgetAmounts?.[p.id] ?? p.seats * config.incomePerSeat;
          return (
            <div
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 8px',
                background: 'rgba(0,0,0,0.15)',
                borderLeft: `3px solid ${p.color}`,
              }}
            >
              <span className="font-serif" style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                {p.name}
              </span>
              <span
                className="font-mono"
                style={{ fontSize: '0.8rem', color: 'var(--aye-green)', fontWeight: 600 }}
              >
                +${income}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

// ---- Action Panel ----

const ActionPanel: React.FC<{
  currentPlayer: Player | null;
  isMyTurn: boolean;
  activePlayerName: string;
  actionDefs: ActionDef[];
  selectedAction: ActionType | null;
  selectedTargetPlayer: string | null;
  otherPlayers: Player[];
  onActionTileClick: (type: ActionType) => void;
  onTargetPlayerClick: (id: string) => void;
  onEndTurn: () => void;
}> = ({
  currentPlayer,
  isMyTurn,
  activePlayerName,
  actionDefs,
  selectedAction,
  selectedTargetPlayer,
  otherPlayers,
  onActionTileClick,
  onTargetPlayerClick,
  onEndTurn,
}) => (
  <div className="panel" style={{ margin: 0, border: 'none', display: 'flex', flexDirection: 'column', height: '100%' }}>
    <div className="panel-header">
      {'\u2694'} Actions
    </div>
    <div style={{ padding: '8px 10px', flex: 1, overflowY: 'auto' }}>
      {/* Turn indicator */}
      <div
        className="panel-inset font-mono"
        style={{
          padding: '6px 10px',
          marginBottom: 10,
          fontSize: '0.7rem',
          textAlign: 'center',
          color: isMyTurn ? 'var(--brass-light)' : 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        {isMyTurn ? '\u25B6 Your Turn' : `Waiting for ${activePlayerName}...`}
      </div>

      {/* Action tiles grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {actionDefs.map((def) => {
          const canAffordAP = currentPlayer ? currentPlayer.actionPoints >= def.apCost : false;
          const cost = def.fundsCost ?? 0;
          const canAffordFunds = currentPlayer ? currentPlayer.funds >= cost : false;
          const disabled = !isMyTurn || !canAffordAP || (cost > 0 && !canAffordFunds);
          const isSelected = selectedAction === def.type;

          return (
            <div
              key={def.type}
              className={`action-tile${disabled ? ' disabled' : ''}${isSelected ? ' selected' : ''}`}
              onClick={() => !disabled && onActionTileClick(def.type)}
              style={{ padding: '10px 12px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div
                    className="font-display"
                    style={{
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      color: isSelected ? 'var(--gold)' : 'var(--parchment)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    <span style={{ marginRight: 6 }}>{def.icon}</span>
                    {def.label}
                  </div>
                  <div
                    className="font-serif"
                    style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 2 }}
                  >
                    {def.description}
                  </div>
                </div>
                <div
                  className="font-mono"
                  style={{
                    textAlign: 'right',
                    fontSize: '0.6rem',
                    color: 'var(--text-muted)',
                    flexShrink: 0,
                    marginLeft: 8,
                  }}
                >
                  <div>{def.apCost} AP</div>
                  <div>{cost > 0 ? `$${cost}` : 'Free'}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Attack ad target selection */}
      {selectedAction === 'attack_ad' && (
        <div style={{ marginTop: 10 }}>
          <div
            className="font-mono"
            style={{
              fontSize: '0.65rem',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--brass-light)',
              marginBottom: 6,
            }}
          >
            Select Target Party
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {otherPlayers.map((p) => (
              <div
                key={p.id}
                onClick={() => onTargetPlayerClick(p.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  cursor: 'pointer',
                  background:
                    selectedTargetPlayer === p.id
                      ? 'rgba(184,134,11,0.12)'
                      : 'rgba(0,0,0,0.15)',
                  border:
                    selectedTargetPlayer === p.id
                      ? '1px solid var(--gold)'
                      : '1px solid var(--border-subtle)',
                  transition: 'all 0.12s',
                }}
              >
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 2,
                    backgroundColor: p.color,
                  }}
                />
                <span className="font-serif" style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                  {p.name}
                </span>
                <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  {p.approval}% appr.
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>

    {/* End Turn button */}
    {isMyTurn && (
      <div style={{ padding: '10px 10px 12px' }}>
        <button
          className="btn-brass"
          style={{ width: '100%', textAlign: 'center' }}
          onClick={onEndTurn}
        >
          End Turn
        </button>
      </div>
    )}
  </div>
);

// ---- Proposal Panel ----

const ProposalPanel: React.FC<{
  bills: Bill[];
  iAmSpeaker: boolean;
  speakerName: string;
  onProposeBill: (billId: string) => void;
  onSkipProposal: () => void;
}> = ({ bills, iAmSpeaker, speakerName, onProposeBill, onSkipProposal }) => (
  <div className="panel" style={{ margin: 0, border: 'none' }}>
    <div className="panel-header">{'\u2696'} Legislation</div>
    <div style={{ padding: 12 }}>
      {!iAmSpeaker ? (
        <div
          className="font-serif"
          style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px 8px' }}
        >
          <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>{'\u2696'}</div>
          Waiting for <strong style={{ color: 'var(--parchment)' }}>{speakerName}</strong> to propose
          a bill...
        </div>
      ) : (
        <>
          <div
            className="font-mono"
            style={{
              fontSize: '0.65rem',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--brass-light)',
              marginBottom: 10,
            }}
          >
            You are the Speaker. Choose a bill:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bills.map((bill) => (
              <BillCard key={bill.id} bill={bill} onClick={() => onProposeBill(bill.id)} />
            ))}
          </div>
          <button
            className="btn-wood"
            style={{ width: '100%', marginTop: 10, textAlign: 'center' }}
            onClick={onSkipProposal}
          >
            Skip Proposal
          </button>
        </>
      )}
    </div>
  </div>
);

// ---- Bill Card ----

const BillCard: React.FC<{ bill: Bill; onClick: () => void }> = ({ bill, onClick }) => (
  <div
    className={`bill-card${bill.isLandmark ? ' landmark' : ''}`}
    style={{ cursor: 'pointer' }}
    onClick={onClick}
  >
    <div className="bill-card-title">{bill.name}</div>
    <div style={{ marginBottom: 6 }}>
      <span className={`bill-card-issue ${issueClass(bill.issue)}`}>{formatIssue(bill.issue)}</span>
    </div>
    <div className="font-serif" style={{ fontSize: '0.78rem', color: 'var(--ink-light)', marginBottom: 8 }}>
      {bill.description}
    </div>
    {/* Stance indicators */}
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
      {(
        [
          ['Prog', bill.stanceTable.progressive],
          ['Cons', bill.stanceTable.conservative],
          ['Mkt', bill.stanceTable.market],
          ['Int', bill.stanceTable.interventionist],
        ] as [string, 'favoured' | 'neutral' | 'opposed'][]
      ).map(([label, stance]) => (
        <span
          key={label}
          style={{
            fontSize: '0.6rem',
            fontFamily: "'IBM Plex Mono', monospace",
            color: stanceColor(stance),
            letterSpacing: '0.05em',
          }}
        >
          {label}: {stanceLabel(stance)}
        </span>
      ))}
    </div>
    {/* PCap reward */}
    {bill.pCapReward > 0 && (
      <div
        className="font-mono"
        style={{ fontSize: '0.65rem', color: 'var(--gold)' }}
      >
        +{bill.pCapReward} PCap
        {bill.isLandmark && (
          <span style={{ marginLeft: 6, color: 'var(--brass-light)' }}>{'\u2605'} Landmark</span>
        )}
      </div>
    )}
  </div>
);

// ---- Vote Panel ----

const VotePanel: React.FC<{
  pending: NonNullable<GameState['pendingLegislation']>;
  players: Player[];
  playerId: string;
  onCastVote: (vote: 'aye' | 'no') => void;
}> = ({ pending, players, playerId, onCastVote }) => {
  const hasVoted = pending.votes.some((v) => v.playerId === playerId);
  const ayeWeight = pending.votes
    .filter((v) => v.vote === 'aye')
    .reduce((s, v) => s + v.seatWeight, 0);
  const noWeight = pending.votes
    .filter((v) => v.vote === 'no')
    .reduce((s, v) => s + v.seatWeight, 0);

  return (
    <div className="panel" style={{ margin: 0, border: 'none' }}>
      <div className="panel-header">{'\u2696'} Division</div>
      <div style={{ padding: 12 }}>
        {/* Bill details */}
        <div
          className="bill-card"
          style={{ marginBottom: 12, cursor: 'default' }}
        >
          <div className="bill-card-title">{pending.bill.name}</div>
          <div style={{ marginBottom: 4 }}>
            <span className={`bill-card-issue ${issueClass(pending.bill.issue)}`}>
              {formatIssue(pending.bill.issue)}
            </span>
          </div>
          <div className="font-serif" style={{ fontSize: '0.78rem', color: 'var(--ink-light)' }}>
            {pending.bill.description}
          </div>
        </div>

        {/* Vote tally */}
        <div
          className="panel-inset"
          style={{ padding: 10, marginBottom: 12, textAlign: 'center' }}
        >
          <div
            className="font-mono"
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 20,
              fontSize: '1.1rem',
              fontWeight: 600,
            }}
          >
            <span style={{ color: 'var(--aye-green)' }}>AYE {ayeWeight}</span>
            <span style={{ color: 'var(--text-muted)' }}>{'\u2014'}</span>
            <span style={{ color: 'var(--no-red)' }}>NO {noWeight}</span>
          </div>
          <div
            className="font-mono"
            style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 4 }}
          >
            {pending.votes.length}/{players.length} voted
          </div>
        </div>

        {/* Who has voted */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
          {players.map((p) => {
            const vote = pending.votes.find((v) => v.playerId === p.id);
            return (
              <div
                key={p.id}
                title={`${p.name}${vote ? `: ${vote.vote.toUpperCase()}` : ': pending'}`}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  fontFamily: "'IBM Plex Mono', monospace",
                  background: vote
                    ? vote.vote === 'aye'
                      ? 'var(--aye-green)'
                      : 'var(--no-red)'
                    : p.color,
                  color: '#fff',
                  border: '1px solid rgba(0,0,0,0.3)',
                }}
              >
                {vote ? (vote.vote === 'aye' ? 'Y' : 'N') : '?'}
              </div>
            );
          })}
        </div>

        {/* Vote buttons */}
        {!hasVoted ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn-aye"
              style={{ flex: 1 }}
              onClick={() => onCastVote('aye')}
            >
              AYE
            </button>
            <button
              className="btn-no"
              style={{ flex: 1 }}
              onClick={() => onCastVote('no')}
            >
              NO
            </button>
          </div>
        ) : (
          <div
            className="font-mono"
            style={{
              textAlign: 'center',
              padding: '10px 0',
              color: 'var(--text-muted)',
              fontSize: '0.7rem',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            {'\u2713'} Vote recorded. Awaiting others...
          </div>
        )}
      </div>
    </div>
  );
};

// ---- Result Panel ----

const ResultPanel: React.FC<{
  pending: GameState['pendingLegislation'];
  players: Player[];
  onAcknowledgeResult: () => void;
}> = ({ pending, players, onAcknowledgeResult }) => {
  if (!pending) return null;

  const ayeWeight = pending.votes
    .filter((v) => v.vote === 'aye')
    .reduce((s, v) => s + v.seatWeight, 0);
  const noWeight = pending.votes
    .filter((v) => v.vote === 'no')
    .reduce((s, v) => s + v.seatWeight, 0);
  const passed = ayeWeight > noWeight;

  return (
    <div className="panel" style={{ margin: 0, border: 'none' }}>
      <div className="panel-header">{'\u2696'} Result</div>
      <div style={{ padding: 16, textAlign: 'center' }}>
        <div
          className="font-display"
          style={{
            fontSize: '1.8rem',
            fontWeight: 900,
            color: passed ? 'var(--aye-green)' : 'var(--no-red)',
            marginBottom: 8,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {passed ? 'PASSED' : 'DEFEATED'}
        </div>
        <div className="font-display" style={{ fontSize: '0.95rem', color: 'var(--parchment)', marginBottom: 12 }}>
          {pending.bill.name}
        </div>
        <div
          className="font-mono"
          style={{
            fontSize: '1rem',
            fontWeight: 600,
            marginBottom: 16,
          }}
        >
          <span style={{ color: 'var(--aye-green)' }}>AYE {ayeWeight}</span>
          <span style={{ color: 'var(--text-muted)', margin: '0 12px' }}>{'\u2014'}</span>
          <span style={{ color: 'var(--no-red)' }}>NO {noWeight}</span>
        </div>

        {/* Vote breakdown */}
        <div style={{ marginBottom: 16 }}>
          {pending.votes.map((v) => {
            const player = players.find((p) => p.id === v.playerId);
            return (
              <div
                key={v.playerId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 8px',
                  fontSize: '0.75rem',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      backgroundColor: player?.color ?? '#666',
                      display: 'inline-block',
                    }}
                  />
                  <span className="font-serif" style={{ color: 'var(--text-primary)' }}>
                    {player?.name ?? 'Unknown'}
                  </span>
                </span>
                <span
                  className="font-mono"
                  style={{
                    fontWeight: 600,
                    color: v.vote === 'aye' ? 'var(--aye-green)' : 'var(--no-red)',
                  }}
                >
                  {v.vote.toUpperCase()} ({v.seatWeight})
                </span>
              </div>
            );
          })}
        </div>

        <button
          className="btn-brass"
          style={{ width: '100%', textAlign: 'center' }}
          onClick={onAcknowledgeResult}
        >
          Continue
        </button>
      </div>
    </div>
  );
};

// ---- Event Panel ----

const EventPanel: React.FC<{
  event: PoliticalEvent;
  onAcknowledge: () => void;
}> = ({ event, onAcknowledge }) => (
  <div className="panel" style={{ margin: 0, border: 'none' }}>
    <div className="panel-header">{'\u26A0'} Event</div>
    <div style={{ padding: 12 }}>
      <div className="event-banner" style={{ marginBottom: 12 }}>
        <div className="event-category">{event.category}</div>
        <div className="event-headline" style={{ marginTop: 4 }}>{event.headline}</div>
      </div>
      <div
        className="font-serif"
        style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}
      >
        {event.description}
      </div>

      {/* Effects */}
      {event.effects.length > 0 && (
        <div
          className="panel-inset"
          style={{ padding: 10, marginBottom: 12 }}
        >
          <div
            className="font-mono"
            style={{
              fontSize: '0.6rem',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'var(--brass-light)',
              marginBottom: 6,
            }}
          >
            Effects
          </div>
          {event.effects.map((eff, idx) => (
            <div
              key={idx}
              className="font-mono"
              style={{
                fontSize: '0.7rem',
                color: eff.amount >= 0 ? 'var(--aye-green)' : 'var(--no-red)',
                marginBottom: 3,
              }}
            >
              {eff.target}: {eff.type} {eff.amount > 0 ? '+' : ''}
              {eff.amount}
            </div>
          ))}
        </div>
      )}

      <button
        className="btn-brass"
        style={{ width: '100%', textAlign: 'center' }}
        onClick={onAcknowledge}
      >
        Acknowledge
      </button>
    </div>
  </div>
);

// ---- Game Over Panel (sidebar) ----

const GameOverPanel: React.FC<{
  players: Player[];
  winnerId: string | null;
  finalScores: Record<string, number> | null;
  playerId: string;
}> = ({ players, winnerId, finalScores, playerId }) => {
  const sorted = [...players].sort(
    (a, b) => (finalScores?.[b.id] ?? b.pcap) - (finalScores?.[a.id] ?? a.pcap),
  );
  const winner = players.find((p) => p.id === winnerId);

  return (
    <div className="panel" style={{ margin: 0, border: 'none' }}>
      <div className="panel-header">{'\u2605'} Final Results</div>
      <div style={{ padding: 12 }}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div className="font-display" style={{ fontSize: '1.1rem', color: 'var(--gold)', fontWeight: 700 }}>
            {winner?.name ?? 'Unknown'} Wins!
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sorted.map((p, rank) => (
            <div
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                background:
                  rank === 0
                    ? 'rgba(218,165,32,0.1)'
                    : p.id === playerId
                      ? 'rgba(255,255,255,0.04)'
                      : 'transparent',
                borderLeft: `3px solid ${p.color}`,
              }}
            >
              <span
                className="font-mono"
                style={{ width: 18, textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}
              >
                {rank + 1}.
              </span>
              <span className="font-serif" style={{ flex: 1, fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                {p.name}
              </span>
              <span className="font-mono" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--parchment)' }}>
                {finalScores?.[p.id] ?? p.pcap}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ---- Game Over Overlay (fullscreen) ----

const GameOverOverlay: React.FC<{
  players: Player[];
  winnerId: string | null;
  finalScores: Record<string, number> | null;
  playerId: string;
}> = ({ players, winnerId, finalScores, playerId }) => {
  const [dismissed, setDismissed] = useState(false);
  const winner = players.find((p) => p.id === winnerId);
  const isMe = winnerId === playerId;

  const sorted = [...players].sort(
    (a, b) => (finalScores?.[b.id] ?? b.pcap) - (finalScores?.[a.id] ?? a.pcap),
  );

  if (dismissed) return null;

  return (
    <div
      className="game-over-overlay"
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
      }}
      onClick={() => setDismissed(true)}
    >
      <div
        className="animate-in"
        style={{
          maxWidth: 500,
          width: '90%',
          textAlign: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="game-over-title" style={{ marginBottom: 8 }}>
          {isMe ? 'Victory!' : 'Game Over'}
        </div>
        <div
          className="font-display"
          style={{
            fontSize: '1.3rem',
            color: winner?.color ?? 'var(--parchment)',
            fontWeight: 600,
            marginBottom: 24,
          }}
        >
          {winner?.name ?? 'Unknown'} has formed government.
        </div>

        <div
          className="panel-wood"
          style={{ padding: 20, textAlign: 'left', marginBottom: 16 }}
        >
          <div
            className="font-mono"
            style={{
              fontSize: '0.65rem',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'var(--brass-light)',
              marginBottom: 10,
              textAlign: 'center',
            }}
          >
            Final Standings
          </div>
          {sorted.map((p, rank) => (
            <div
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 6px',
                borderBottom: rank < sorted.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              }}
            >
              <span
                className="font-display"
                style={{
                  fontSize: rank === 0 ? '1.4rem' : '1rem',
                  fontWeight: 700,
                  color: rank === 0 ? 'var(--gold)' : 'var(--text-muted)',
                  width: 28,
                  textAlign: 'center',
                }}
              >
                {rank === 0 ? '\u2655' : `${rank + 1}.`}
              </span>
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 2,
                  backgroundColor: p.color,
                  flexShrink: 0,
                }}
              />
              <span
                className="font-serif"
                style={{
                  flex: 1,
                  fontSize: '0.9rem',
                  color: 'var(--text-primary)',
                  fontWeight: p.id === playerId ? 600 : 400,
                }}
              >
                {p.name}
                {p.id === playerId && (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginLeft: 4 }}>
                    (you)
                  </span>
                )}
              </span>
              <span className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {p.seats} seats
              </span>
              <span
                className="font-mono"
                style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--parchment)' }}
              >
                {finalScores?.[p.id] ?? p.pcap}
              </span>
            </div>
          ))}
        </div>

        <button
          className="btn-brass"
          style={{ padding: '10px 32px' }}
          onClick={() => setDismissed(true)}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

// ---- Economy Dashboard (center panel view) ----

const SECTOR_LABELS: Record<string, string> = {
  manufacturing: 'Manufacturing', services: 'Services', finance: 'Finance',
  technology: 'Technology', healthcare: 'Healthcare', education: 'Education',
  housing: 'Housing', energy: 'Energy', agriculture: 'Agriculture',
};

const EconomyDashboard: React.FC<{
  economy: EconomicStateData;
  voterGroups: VoterGroupState[];
  players: Player[];
}> = ({ economy, voterGroups, players }) => {
  const indicator = (label: string, value: number, unit: string, good: 'high' | 'low' | 'zero', precision = 1) => {
    let color = 'var(--text-primary)';
    if (good === 'high' && value > 3) color = 'var(--aye-green)';
    else if (good === 'high' && value < 0) color = 'var(--no-red)';
    else if (good === 'low' && value < 4) color = 'var(--aye-green)';
    else if (good === 'low' && value > 8) color = 'var(--no-red)';
    else if (good === 'zero' && Math.abs(value) < 2) color = 'var(--aye-green)';
    else if (good === 'zero' && value < -5) color = 'var(--no-red)';

    return (
      <div style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {label}
        </div>
        <div className="font-display" style={{ fontSize: '1.1rem', fontWeight: 600, color }}>
          {value.toFixed(precision)}{unit}
        </div>
      </div>
    );
  };

  const sectorBar = (name: string, health: number) => {
    const pct = Math.max(0, Math.min(100, health));
    const color = pct > 60 ? 'var(--aye-green)' : pct > 35 ? 'var(--brass-gold)' : 'var(--no-red)';
    return (
      <div key={name} style={{ marginBottom: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}>
          <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
            {SECTOR_LABELS[name] || name}
          </span>
          <span className="font-mono" style={{ fontSize: '0.6rem', color }}>{pct.toFixed(0)}</span>
        </div>
        <div style={{ height: 4, background: 'var(--bg-secondary)', borderRadius: 2 }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.5s' }} />
        </div>
      </div>
    );
  };

  const playerName = (id: string | null) => {
    if (!id) return 'None';
    return players.find(p => p.id === id)?.name || 'Unknown';
  };

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Macro indicators */}
      <div className="panel" style={{ margin: 0 }}>
        <div className="panel-header">Economic Indicators</div>
        <div style={{ padding: '8px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          {indicator('GDP Growth', economy.gdpGrowth, '%', 'high')}
          {indicator('Unemployment', economy.unemployment, '%', 'low')}
          {indicator('Inflation', economy.inflation, '%', 'low')}
          {indicator('Interest Rate', economy.interestRate, '%', 'low')}
          {indicator('Budget Balance', economy.budgetBalance, '% GDP', 'zero')}
          {indicator('Public Debt', economy.publicDebt, '% GDP', 'low', 0)}
        </div>
        <div style={{ padding: '4px 16px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          {indicator('Consumer Conf.', economy.consumerConfidence, '', 'high', 0)}
          {indicator('Business Conf.', economy.businessConfidence, '', 'high', 0)}
        </div>
      </div>

      {/* Sectors */}
      <div className="panel" style={{ margin: 0 }}>
        <div className="panel-header">Sector Health</div>
        <div style={{ padding: '8px 16px' }}>
          {Object.entries(economy.sectors).map(([name, health]) => sectorBar(name, health))}
        </div>
      </div>

      {/* Voter groups */}
      {voterGroups.length > 0 && (
        <div className="panel" style={{ margin: 0 }}>
          <div className="panel-header">Voter Groups</div>
          <div style={{ padding: '8px 16px' }}>
            {voterGroups.map(group => {
              const satisfactionColor = group.satisfaction > 60 ? 'var(--aye-green)' : group.satisfaction > 35 ? 'var(--brass-gold)' : 'var(--no-red)';
              return (
                <div key={group.id} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="font-serif" style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                      {group.name}
                    </span>
                    <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      {(group.population * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                    <div style={{ flex: 1, height: 4, background: 'var(--bg-secondary)', borderRadius: 2 }}>
                      <div style={{
                        width: `${group.satisfaction}%`,
                        height: '100%',
                        background: satisfactionColor,
                        borderRadius: 2,
                        transition: 'width 0.5s',
                      }} />
                    </div>
                    <span className="font-mono" style={{ fontSize: '0.6rem', color: satisfactionColor, width: 24, textAlign: 'right' }}>
                      {group.satisfaction.toFixed(0)}
                    </span>
                  </div>
                  {group.leaningPartyId && (
                    <div className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      Leaning: {playerName(group.leaningPartyId)}
                    </div>
                  )}
                  {group.topConcerns.length > 0 && (
                    <div className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: 1 }}>
                      Concerns: {group.topConcerns.slice(0, 2).map(c => c.variable).join(', ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default GameBoard;
