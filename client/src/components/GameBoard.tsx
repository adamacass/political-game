import React, { useState, useMemo, useEffect } from 'react';
import { GameState, GameConfig, Player, CampaignCard, PolicyCard, ChatMessage, HandCard, Issue, SeatId } from '../types';
import { SeatLayout } from './SeatLayout';
import { ChatPanel } from './ChatPanel';
import { WormGraph, WormGraphMini } from './WormGraph';
import { NegotiationPanel } from './NegotiationPanel';
import { TargetingModal } from './TargetingModal';
import { AustraliaMap, AustraliaMapMini } from './AustraliaMap';
import { MySeatsList } from './MySeatsList';
import { MessageSquare, Download, Star, Scroll, Zap, TrendingUp, RefreshCw, Users, Target, Sparkles, ChevronRight, AlertCircle, CheckCircle2, Award, AlertTriangle, History, Map, LayoutGrid } from 'lucide-react';

interface PCapChangeRecord { playerId: string; pCapDelta: number; seatDelta: number; reason: string; changeType: 'award' | 'penalty'; timestamp: number; }

interface GameBoardProps {
  gameState: GameState; gameConfig: GameConfig; playerId: string; chatMessages: ChatMessage[];
  onDrawCard: (deckType: 'campaign' | 'policy') => void; onPlayCampaign: (cardId: string) => void;
  onSelectTarget: (targetId: string) => void; onSkipCampaign: () => void; onSkipAndReplace: (cardId: string) => void;
  onProposePolicy: (cardId: string) => void; onSkipProposal: () => void; onCastVote: (vote: 'yes' | 'no') => void;
  onAcknowledgeWildcard: () => void; onSelectNewAgenda?: (issue: Issue) => void; onForceAdvance?: () => void; onExportGame: () => void;
  onSendChat: (content: string, recipientId: string | null) => void;
  onMakeTradeOffer: (toPlayerId: string, offered: string[], requested: string[]) => void;
  onRespondToOffer: (offerId: string, accept: boolean) => void; onCancelOffer: (offerId: string) => void; onNegotiationReady: () => void;
  onCaptureSeat?: (seatId: SeatId) => void;
}

function getIdeologyStrength(actions: number) { if (actions < 1) return { label: 'Unknown', strength: 'none' }; if (actions < 3) return { label: 'Weak', strength: 'weak' }; if (actions < 6) return { label: 'Moderate', strength: 'moderate' }; return { label: 'Strong', strength: 'strong' }; }

function getIdeologyLabel(profile: Player['ideologyProfile']) {
  const sA = profile.progressiveActions + profile.conservativeActions, eA = profile.marketActions + profile.interventionistActions;
  const sS = getIdeologyStrength(sA), eS = getIdeologyStrength(eA);
  let sL = 'Centrist'; if (profile.socialScore > 60) sL = 'Progressive'; else if (profile.socialScore < 40) sL = 'Conservative';
  let eL = 'Mixed'; if (profile.economicScore > 60) eL = 'Interventionist'; else if (profile.economicScore < 40) eL = 'Market';
  return { social: sL, economic: eL, socialStrength: sS.label, economicStrength: eS.label };
}

function checkCardAlignment(card: CampaignCard | PolicyCard, profile: Player['ideologyProfile']): 'aligned' | 'contrary' | 'neutral' {
  if (!('stanceTable' in card) || !card.stanceTable) return 'neutral';
  const total = profile.progressiveActions + profile.conservativeActions + profile.marketActions + profile.interventionistActions;
  if (total < 1) return 'neutral';
  let aligned = 0, contrary = 0;
  if (profile.dominantSocial !== 'neutral') { const s = card.stanceTable[profile.dominantSocial as keyof typeof card.stanceTable]; if (s === 'favoured') aligned++; else if (s === 'opposed') contrary++; }
  if (profile.dominantEconomic !== 'neutral') { const s = card.stanceTable[profile.dominantEconomic as keyof typeof card.stanceTable]; if (s === 'favoured') aligned++; else if (s === 'opposed') contrary++; }
  if (aligned > contrary) return 'aligned'; if (contrary > aligned) return 'contrary'; return 'neutral';
}

// Stance table display component - shows ideology effects
function StanceDisplay({ stanceTable, compact = false }: { stanceTable: any; compact?: boolean }) {
  if (!stanceTable) return null;
  const stances = [
    { key: 'progressive', label: 'Prog', color: 'blue' },
    { key: 'conservative', label: 'Cons', color: 'red' },
    { key: 'market', label: 'Mkt', color: 'yellow' },
    { key: 'interventionist', label: 'Int', color: 'green' },
  ];
  if (compact) {
    return (
      <div className="flex gap-1 flex-wrap mt-1">
        {stances.map(s => {
          const stance = stanceTable[s.key];
          if (stance === 'neutral') return null;
          return (
            <span key={s.key} className={`text-[10px] px-1 rounded ${stance === 'favoured' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {s.label}: {stance === 'favoured' ? '+' : '-'}
            </span>
          );
        })}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-1 text-xs mt-2 pt-2 border-t border-gray-200">
      {stances.map(s => (
        <div key={s.key} className="flex justify-between">
          <span className="text-gray-500">{s.label}:</span>
          <span className={stanceTable[s.key] === 'favoured' ? 'text-green-600 font-medium' : stanceTable[s.key] === 'opposed' ? 'text-red-600 font-medium' : 'text-gray-400'}>
            {stanceTable[s.key]}
          </span>
        </div>
      ))}
    </div>
  );
}

function PCapToast({ changes, players }: { changes: PCapChangeRecord[]; players: Player[] }) {
  const [visible, setVisible] = useState(changes.length > 0);
  useEffect(() => { if (changes.length > 0) { setVisible(true); const t = setTimeout(() => setVisible(false), 5000); return () => clearTimeout(t); } }, [changes]);
  if (!visible || changes.length === 0) return null;
  return (
    <div className="fixed top-20 right-4 z-50 space-y-2 max-w-sm">
      {changes.slice(-5).map((c, i) => {
        const player = players.find(p => p.id === c.playerId);
        return (
          <div key={i} className={`p-3 rounded-lg shadow-lg flex items-center gap-2 ${c.changeType === 'award' ? 'bg-green-100 border-l-4 border-green-500' : 'bg-red-100 border-l-4 border-red-500'}`}>
            {c.changeType === 'award' ? <Award className="w-5 h-5 text-green-600" /> : <AlertTriangle className="w-5 h-5 text-red-600" />}
            <div>
              <div className="font-medium text-sm">{player?.name || 'Unknown'}</div>
              <div className="text-xs text-gray-600">{c.reason}</div>
              <div className={`text-sm font-bold ${c.changeType === 'award' ? 'text-green-600' : 'text-red-600'}`}>
                {c.pCapDelta !== 0 && `${c.pCapDelta > 0 ? '+' : ''}${c.pCapDelta} PCap`}
                {c.seatDelta !== 0 && ` ${c.seatDelta > 0 ? '+' : ''}${c.seatDelta} seats`}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RoundHistoryPanel({ history, players }: { history: GameState['history']; players: Player[] }) {
  const [expanded, setExpanded] = useState(false);
  if (history.length === 0) return null;
  const latest = history[history.length - 1];
  const pCapChanges = (latest as any).pCapChanges || [];
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between text-left">
        <h3 className="font-semibold flex items-center gap-2"><History className="w-4 h-4" />Round {latest.round} Summary</h3>
        <span className="text-sm text-blue-600">{expanded ? 'Hide' : 'Show'}</span>
      </button>
      {expanded && (
        <div className="mt-3 space-y-3 text-sm">
          {latest.campaignsPlayed.length > 0 && (
            <div><div className="font-medium text-gray-700 mb-1">Campaigns:</div>
              {latest.campaignsPlayed.map((c, i) => { const p = players.find(x => x.id === c.playerId); return <div key={i} className="ml-2 text-gray-600">• {p?.name}: {c.cardName} (+{c.seatDelta} seats{c.agendaBonus > 0 ? `, +${c.agendaBonus} agenda` : ''})</div>; })}
            </div>
          )}
          {latest.policyResult && (
            <div><div className="font-medium text-gray-700 mb-1">Policy:</div>
              <div className="ml-2 text-gray-600">• {latest.policyResult.cardName}: {latest.policyResult.passed ? <span className="text-green-600 font-medium">PASSED</span> : <span className="text-red-600 font-medium">FAILED</span>} ({latest.policyResult.yesVotes}/{latest.policyResult.noVotes})</div>
            </div>
          )}
          {latest.wildcardDrawn && <div className="text-yellow-700">🎲 Wildcard: {latest.wildcardDrawn.cardName}</div>}
          {pCapChanges.length > 0 && (
            <div><div className="font-medium text-gray-700 mb-1">PCap Changes:</div>
              {pCapChanges.map((c: PCapChangeRecord, i: number) => { const p = players.find(x => x.id === c.playerId); return <div key={i} className={`ml-2 ${c.changeType === 'award' ? 'text-green-600' : 'text-red-600'}`}>• {p?.name}: {c.reason}</div>; })}
            </div>
          )}
          {latest.issueChangedTo && <div className="text-purple-600">📋 Agenda → {latest.issueChangedTo.replace('_', ' ')}</div>}
        </div>
      )}
    </div>
  );
}

export function GameBoard(props: GameBoardProps) {
  const { gameState, gameConfig, playerId, chatMessages, onDrawCard, onPlayCampaign, onSelectTarget, onSkipCampaign, onSkipAndReplace, onProposePolicy, onSkipProposal, onCastVote, onAcknowledgeWildcard, onSelectNewAgenda, onForceAdvance, onExportGame, onSendChat, onMakeTradeOffer, onRespondToOffer, onCancelOffer, onNegotiationReady, onCaptureSeat } = props;
  const [showChat, setShowChat] = useState(false);
  const [showWormGraph, setShowWormGraph] = useState(false);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState<string | null>(null);
  const [mapView, setMapView] = useState<'map' | 'hemicycle'>('map');  // Default to Australia map

  const currentPlayer = gameState.players.find(p => p.id === playerId);
  const currentTurnPlayerId = gameState.turnOrder[gameState.currentPlayerIndex];
  const speakerId = gameState.turnOrder[gameState.speakerIndex];
  const isMyTurn = currentTurnPlayerId === playerId;
  const iAmSpeaker = speakerId === playerId;
  const currentTurnPlayer = gameState.players.find(p => p.id === currentTurnPlayerId);
  const isHost = gameState.players[0]?.id === playerId;

  const { campaignCards, policyCards } = useMemo(() => {
    const campaigns: HandCard[] = [], policies: HandCard[] = [];
    currentPlayer?.hand.forEach(h => { if ('seatDelta' in h.card) campaigns.push(h); else if ('stanceTable' in h.card) policies.push(h); });
    return { campaignCards: campaigns, policyCards: policies };
  }, [currentPlayer?.hand]);

  const cardsNeeded = currentPlayer ? Math.max(0, gameConfig.handLimit - currentPlayer.hand.length) : 0;

  const getPlayerPCap = (p: Player) => p.pCapCards.reduce((s, c) => s + c.value, 0);
  const formatIssue = (i: string) => i.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const getPhaseInfo = () => {
    const phase = gameState.phase;
    let label = '', description = '', icon = null as React.ReactNode, actionRequired = false;
    switch (phase) {
      case 'draw': 
        label = 'DRAW'; 
        description = cardsNeeded > 0 ? `Draw ${cardsNeeded} card${cardsNeeded > 1 ? 's' : ''}` : 'Waiting...'; 
        actionRequired = cardsNeeded > 0; 
        break;
      case 'negotiation': const ir = gameState.negotiation.playersReady.includes(playerId); label = 'TRADE'; description = ir ? 'Waiting...' : 'Trade or ready up'; icon = <Users className="w-5 h-5" />; actionRequired = !ir; break;
      case 'campaign': label = 'CAMPAIGN'; description = isMyTurn ? 'Your turn!' : `${currentTurnPlayer?.name || 'Next'}'s turn`; icon = <Target className="w-5 h-5" />; actionRequired = isMyTurn; break;
      case 'campaign_targeting': label = 'TARGET'; description = gameState.pendingCampaign?.playerId === playerId ? 'Pick target!' : 'Waiting...'; icon = <Target className="w-5 h-5" />; actionRequired = gameState.pendingCampaign?.playerId === playerId; break;
      case 'seat_capture': label = 'CAPTURE'; description = gameState.pendingSeatCapture?.actorId === playerId ? `Select ${gameState.pendingSeatCapture?.remaining} seat(s) on map!` : 'Waiting...'; icon = <Map className="w-5 h-5" />; actionRequired = gameState.pendingSeatCapture?.actorId === playerId; break;
      case 'policy_proposal': label = 'POLICY'; description = iAmSpeaker ? 'Propose!' : 'Waiting for Speaker'; icon = <Scroll className="w-5 h-5" />; actionRequired = iAmSpeaker; break;
      case 'policy_vote': const hv = gameState.votes.some(v => v.playerId === playerId); label = 'VOTE'; description = hv ? 'Waiting...' : 'Cast vote!'; actionRequired = !hv; break;
      case 'agenda_selection': label = 'SET AGENDA'; description = gameState.proposerId === playerId ? 'Pick new agenda!' : 'Waiting...'; actionRequired = gameState.proposerId === playerId; break;
      case 'wildcard_resolution': label = 'WILDCARD!'; description = gameState.pendingWildcard?.name || 'Event'; icon = <Zap className="w-5 h-5" />; actionRequired = true; break;
      case 'game_over': label = 'GAME OVER'; description = `${gameState.players.find(p => p.id === gameState.winner)?.name} wins!`; break;
      default: label = phase.toUpperCase();
    }
    return { label, description, icon, actionRequired };
  };

  const phaseInfo = getPhaseInfo();
  const myColor = currentPlayer?.color || '#666';
  const hasVoted = gameState.votes.some(v => v.playerId === playerId);
  const hasCampaigned = gameState.playersCampaigned.includes(playerId);
  const roundPCapChanges = (gameState as any).roundPCapChanges || [];

  return (
    <div className="min-h-screen bg-gray-100">
      <PCapToast changes={roundPCapChanges} players={gameState.players} />
      
      <div className="sticky top-0 z-40 shadow-lg" style={{ background: `linear-gradient(135deg, ${myColor}22 0%, ${myColor}11 100%)`, borderBottom: `3px solid ${myColor}` }}>
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md" style={{ backgroundColor: myColor }}>{currentPlayer?.name.charAt(0)}</div>
              <div><div className="font-bold text-gray-900">{currentPlayer?.name}</div><div className="text-xs text-gray-600">{currentPlayer?.playerName} • {currentPlayer?.seats} seats • {currentPlayer ? getPlayerPCap(currentPlayer) : 0} PCap</div></div>
            </div>
            <div className="flex-1 flex justify-center">
              <div className={`flex items-center gap-3 px-6 py-2 rounded-full shadow-md ${phaseInfo.actionRequired ? 'animate-pulse ring-2 ring-offset-2' : ''}`} style={{ backgroundColor: phaseInfo.actionRequired ? myColor : '#fff', color: phaseInfo.actionRequired ? '#fff' : '#333' }}>
                {phaseInfo.icon}
                <div className="text-center"><div className="text-xs font-medium opacity-80">Round {gameState.round}</div><div className="font-bold">{phaseInfo.label}</div></div>
                {phaseInfo.actionRequired && <ChevronRight className="w-5 h-5 animate-bounce" />}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1 bg-white rounded-full shadow text-sm"><span className="text-gray-500">Agenda:</span> <span className="font-bold text-blue-600">{formatIssue(gameState.activeIssue)}</span></div>
              {isHost && onForceAdvance && gameState.phase !== 'waiting' && gameState.phase !== 'game_over' && (
                <button onClick={onForceAdvance} className="p-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs" title="Force skip phase">⏭</button>
              )}
              <button onClick={() => setShowWormGraph(!showWormGraph)} className={`p-2 rounded-lg ${showWormGraph ? 'bg-blue-500 text-white' : 'bg-white hover:bg-gray-100'}`}><TrendingUp className="w-5 h-5" /></button>
              <button onClick={() => setShowChat(!showChat)} className={`p-2 rounded-lg relative ${showChat ? 'bg-blue-500 text-white' : 'bg-white hover:bg-gray-100'}`}><MessageSquare className="w-5 h-5" /></button>
              <button onClick={onExportGame} className="p-2 rounded-lg bg-white hover:bg-gray-100"><Download className="w-5 h-5" /></button>
            </div>
          </div>
          <div className="mt-2 text-center text-sm text-gray-600">{phaseInfo.description}</div>
        </div>
      </div>

      {showWormGraph && <div className="max-w-7xl mx-auto px-4 py-4"><WormGraph history={gameState.history} players={gameState.players} totalSeats={gameState.totalSeats} currentRound={gameState.round} /></div>}

      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-1 space-y-4">
            {/* Map/Hemicycle toggle */}
            <div className="bg-white rounded-lg shadow">
              <div className="flex items-center justify-between p-2 border-b">
                <div className="flex gap-1">
                  <button onClick={() => setMapView('map')} className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${mapView === 'map' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}><Map className="w-3 h-3" />Map</button>
                  <button onClick={() => setMapView('hemicycle')} className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${mapView === 'hemicycle' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}><LayoutGrid className="w-3 h-3" />Hemicycle</button>
                </div>
              </div>
              {mapView === 'map' ? (
                <AustraliaMap
                  seats={gameState.seats || {}}
                  players={gameState.players}
                  pendingSeatCapture={gameState.pendingSeatCapture}
                  currentPlayerId={playerId}
                  onCaptureSeat={onCaptureSeat}
                />
              ) : (
                <SeatLayout players={gameState.players} totalSeats={gameState.totalSeats} speakerId={speakerId} />
              )}
            </div>
            {/* My Seats List */}
            {currentPlayer && Object.keys(gameState.seats || {}).length > 0 && (
              <MySeatsList
                seats={gameState.seats || {}}
                playerId={playerId}
                playerColor={myColor}
              />
            )}
            {!showWormGraph && gameState.history.length > 0 && <div className="bg-white rounded-lg shadow p-3"><div className="flex justify-between items-center mb-2"><h4 className="text-sm font-semibold">Trend</h4><button onClick={() => setShowWormGraph(true)} className="text-xs text-blue-600 hover:underline">Expand</button></div><WormGraphMini history={gameState.history} players={gameState.players} totalSeats={gameState.totalSeats} /></div>}
            <RoundHistoryPanel history={gameState.history} players={gameState.players} />
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold mb-3">Players</h3>
              <div className="space-y-2">
                {gameState.players.map(player => {
                  const isCurrent = player.id === currentTurnPlayerId, isSpeaker = player.id === speakerId, isMe = player.id === playerId;
                  const ideology = getIdeologyLabel(player.ideologyProfile);
                  return (
                    <div key={player.id} className={`p-2 rounded-lg ${isCurrent ? 'ring-2 ring-yellow-400 bg-yellow-50' : ''} ${isMe ? 'border-2' : 'border border-transparent'}`} style={{ borderColor: isMe ? player.color : 'transparent' }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: player.color }} />
                          <div className="flex flex-col"><span className="font-medium text-sm">{player.name}</span><span className="text-xs text-gray-500">{player.playerName}</span></div>
                          {isSpeaker && <Star className="w-4 h-4 text-yellow-500" />}
                        </div>
                        <div className="text-right"><div className="text-sm font-bold">{player.seats}</div><div className="text-xs text-gray-500">{getPlayerPCap(player)} PCap</div></div>
                      </div>
                      {gameConfig.ideologyMode === 'derived' && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <div className="grid grid-cols-2 gap-1 text-xs">
                            <div className="flex items-center gap-1">
                              <span className={`w-2 h-2 rounded-full ${ideology.social === 'Progressive' ? 'bg-blue-500' : ideology.social === 'Conservative' ? 'bg-red-500' : 'bg-gray-400'}`} />
                              <span className="text-gray-600">{ideology.socialStrength === 'Unknown' ? '?' : ideology.social}</span>
                              {ideology.socialStrength !== 'Unknown' && <span className={`text-[10px] ${ideology.socialStrength === 'Strong' ? 'text-green-600 font-medium' : ideology.socialStrength === 'Moderate' ? 'text-yellow-600' : 'text-gray-400'}`}>({ideology.socialStrength})</span>}
                            </div>
                            <div className="flex items-center gap-1">
                              <span className={`w-2 h-2 rounded-full ${ideology.economic === 'Interventionist' ? 'bg-green-500' : ideology.economic === 'Market' ? 'bg-yellow-500' : 'bg-gray-400'}`} />
                              <span className="text-gray-600">{ideology.economicStrength === 'Unknown' ? '?' : ideology.economic}</span>
                              {ideology.economicStrength !== 'Unknown' && <span className={`text-[10px] ${ideology.economicStrength === 'Strong' ? 'text-green-600 font-medium' : ideology.economicStrength === 'Moderate' ? 'text-yellow-600' : 'text-gray-400'}`}>({ideology.economicStrength})</span>}
                            </div>
                          </div>
                          <div className="mt-1 flex gap-1">
                            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-red-400 to-blue-400" style={{ width: `${player.ideologyProfile.socialScore}%` }} /></div>
                            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-yellow-400 to-green-400" style={{ width: `${player.ideologyProfile.economicScore}%` }} /></div>
                          </div>
                        </div>
                      )}
                      {!player.connected && <div className="text-xs text-red-500 mt-1">Disconnected</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            {gameState.phase === 'campaign_targeting' && gameState.pendingCampaign?.playerId === playerId && <TargetingModal pendingCampaign={gameState.pendingCampaign} players={gameState.players} currentPlayerId={playerId} onSelectTarget={onSelectTarget} />}
            {gameState.phase === 'draw' && <DrawPhaseUI cardsNeeded={cardsNeeded} currentPlayer={currentPlayer} onDraw={onDrawCard} playerColor={myColor} />}
            {gameState.phase === 'negotiation' && <NegotiationPanel gameState={gameState} playerId={playerId} onMakeOffer={onMakeTradeOffer} onRespond={onRespondToOffer} onCancel={onCancelOffer} onReady={onNegotiationReady} />}
            {gameState.phase === 'campaign' && <CampaignPhaseUI isMyTurn={isMyTurn} hasCampaigned={hasCampaigned} cards={campaignCards} activeIssue={gameState.activeIssue} selectedCard={selectedCard} playerColor={myColor} playerProfile={currentPlayer?.ideologyProfile} canSkipReplace={!!gameConfig.allowSkipReplace && !!currentPlayer && !currentPlayer.hasSkippedThisRound} showReplaceConfirm={showReplaceConfirm} onSelectCard={setSelectedCard} onPlay={onPlayCampaign} onSkip={onSkipCampaign} onShowReplaceConfirm={setShowReplaceConfirm} onSkipAndReplace={(id) => { onSkipAndReplace(id); setShowReplaceConfirm(null); }} />}
            {gameState.phase === 'policy_proposal' && <PolicyProposalUI canPropose={iAmSpeaker || gameConfig.policyProposalRule === 'any_player'} cards={policyCards} selectedCard={selectedCard} currentPlayer={currentPlayer} playerColor={myColor} onSelectCard={setSelectedCard} onPropose={onProposePolicy} onSkip={onSkipProposal} />}
            {gameState.phase === 'policy_vote' && gameState.proposedPolicy && <PolicyVoteUI policy={gameState.proposedPolicy} proposer={gameState.players.find(p => p.id === gameState.proposerId)} currentPlayer={currentPlayer} hasVoted={hasVoted} votes={gameState.votes} players={gameState.players} playerColor={myColor} speakerId={speakerId} activeIssue={gameState.activeIssue} onVote={onCastVote} />}
            {gameState.phase === 'agenda_selection' && gameState.proposerId === playerId && onSelectNewAgenda && <AgendaSelectionUI currentIssue={gameState.activeIssue} playerColor={myColor} onSelect={onSelectNewAgenda} />}
            {gameState.phase === 'wildcard_resolution' && gameState.pendingWildcard && <WildcardUI wildcard={gameState.pendingWildcard} onAcknowledge={onAcknowledgeWildcard} />}
            {gameState.phase === 'game_over' && <GameOverUI gameState={gameState} playerId={playerId} />}
            {currentPlayer && !['game_over', 'negotiation'].includes(gameState.phase) && (
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">Your Hand ({currentPlayer.hand.length}/{gameConfig.handLimit})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {currentPlayer.hand.map(h => <CardDisplayFull key={h.card.id} handCard={h} selected={selectedCard === h.card.id} onClick={() => setSelectedCard(selectedCard === h.card.id ? null : h.card.id)} activeIssue={gameState.activeIssue} playerProfile={currentPlayer.ideologyProfile} />)}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            {showChat ? <div className="h-[500px]"><ChatPanel messages={chatMessages} players={gameState.players} currentPlayerId={playerId} onSendMessage={onSendChat} onClose={() => setShowChat(false)} /></div> : (
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-semibold mb-3">Game Info</h3>
                <div className="space-y-3 text-sm">
                  <div><span className="text-gray-500">Room:</span><span className="ml-2 font-mono font-bold">{gameState.roomId}</span></div>
                  <div><span className="text-gray-500">Decks:</span><span className="ml-2">{gameState.campaignDeck.length}C / {gameState.policyDeck.length}P</span></div>
                </div>
                {currentPlayer && currentPlayer.pCapCards.length > 0 && <div className="mt-4 pt-4 border-t"><h4 className="text-sm font-medium mb-2">Your PCap ({getPlayerPCap(currentPlayer)})</h4><div className="space-y-1 max-h-40 overflow-y-auto">{currentPlayer.pCapCards.map((c, i) => <div key={i} className="flex justify-between text-xs"><span className="text-gray-600 truncate">{c.source}</span><span className="font-medium text-green-600">+{c.value}</span></div>)}</div></div>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DrawPhaseUI({ cardsNeeded, currentPlayer, onDraw, playerColor }: { cardsNeeded: number; currentPlayer?: Player; onDraw: (type: 'campaign' | 'policy') => void; playerColor: string }) {
  if (cardsNeeded <= 0) return <div className="bg-white rounded-lg shadow p-6 text-center"><CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" /><p className="text-gray-600">Hand full. Waiting for others...</p></div>;
  return (
    <div className="bg-white rounded-lg shadow p-6" style={{ borderTop: `4px solid ${playerColor}` }}>
      <h3 className="text-lg font-semibold mb-2 text-center flex items-center justify-center gap-2">
        <AlertCircle className="w-5 h-5 text-blue-500" />
        Replenish Hand
      </h3>
      <p className="text-center text-gray-600 mb-4">Draw {cardsNeeded} more card{cardsNeeded > 1 ? 's' : ''} ({currentPlayer?.hand.length || 0}/5)</p>
      <div className="flex gap-4 justify-center">
        <button onClick={() => onDraw('campaign')} className="px-6 py-4 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-all hover:scale-105 shadow-lg">
          <Target className="w-6 h-6 mx-auto mb-1" />Campaign
        </button>
        <button onClick={() => onDraw('policy')} className="px-6 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-all hover:scale-105 shadow-lg">
          <Scroll className="w-6 h-6 mx-auto mb-1" />Policy
        </button>
      </div>
    </div>
  );
}

function CampaignPhaseUI({ isMyTurn, hasCampaigned, cards, activeIssue, selectedCard, playerColor, playerProfile, canSkipReplace, showReplaceConfirm, onSelectCard, onPlay, onSkip, onShowReplaceConfirm, onSkipAndReplace }: { isMyTurn: boolean; hasCampaigned: boolean; cards: HandCard[]; activeIssue: string; selectedCard: string | null; playerColor: string; playerProfile?: Player['ideologyProfile']; canSkipReplace: boolean; showReplaceConfirm: string | null; onSelectCard: (id: string | null) => void; onPlay: (id: string) => void; onSkip: () => void; onShowReplaceConfirm: (id: string | null) => void; onSkipAndReplace: (id: string) => void }) {
  if (hasCampaigned) return <div className="bg-white rounded-lg shadow p-6 text-center"><CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" /><p className="text-gray-600">Done. Waiting...</p></div>;
  if (!isMyTurn) return <div className="bg-white rounded-lg shadow p-6 text-center"><p className="text-gray-600">Waiting...</p></div>;
  const sel = cards.find(h => h.card.id === selectedCard);
  const alignment = sel && playerProfile ? checkCardAlignment(sel.card, playerProfile) : 'neutral';
  return (
    <div className="bg-white rounded-lg shadow p-6" style={{ borderTop: `4px solid ${playerColor}` }}>
      <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><Target className="w-5 h-5" style={{ color: playerColor }} />Your Turn - Play Campaign</h3>
      <p className="text-sm text-gray-600 mb-3">Agenda bonus: <span className="font-medium text-purple-600">{activeIssue.replace('_', ' ')}</span> (+1 seat)</p>
      
      {sel && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="font-medium">{sel.card.name}</div>
          <div className="text-sm text-gray-600">{sel.card.description}</div>
          <div className="text-sm font-bold text-green-600 mt-1">+{(sel.card as CampaignCard).seatDelta} seats</div>
          {(sel.card as CampaignCard).stanceTable && <StanceDisplay stanceTable={(sel.card as CampaignCard).stanceTable} />}
        </div>
      )}
      
      {sel && alignment !== 'neutral' && (
        <div className={`mb-3 p-2 rounded text-sm ${alignment === 'aligned' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {alignment === 'aligned' ? <><Award className="w-4 h-4 inline mr-1" />Aligned with your ideology: +1 PCap</> : <><AlertTriangle className="w-4 h-4 inline mr-1" />Contrary to your ideology: -1 seat</>}
        </div>
      )}
      {showReplaceConfirm && <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg"><p className="text-sm font-medium text-yellow-800 mb-2">Discard and replace?</p><div className="flex gap-2"><button onClick={() => onSkipAndReplace(showReplaceConfirm)} className="px-3 py-1 bg-yellow-500 text-white rounded text-sm">Yes</button><button onClick={() => onShowReplaceConfirm(null)} className="px-3 py-1 bg-gray-200 rounded text-sm">Cancel</button></div></div>}
      <div className="flex gap-4"><button onClick={() => selectedCard && onPlay(selectedCard)} disabled={!sel} className={`flex-1 py-3 rounded-lg font-medium ${sel ? 'text-white hover:opacity-90' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`} style={{ backgroundColor: sel ? playerColor : undefined }}>Play</button><button onClick={onSkip} className="px-6 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium">Skip</button></div>
      {canSkipReplace && selectedCard && <button onClick={() => onShowReplaceConfirm(selectedCard)} className="mt-2 w-full py-2 text-sm text-gray-600 hover:text-gray-800 flex items-center justify-center gap-1"><RefreshCw className="w-4 h-4" />Skip & replace</button>}
    </div>
  );
}

function PolicyProposalUI({ canPropose, cards, selectedCard, currentPlayer, playerColor, onSelectCard, onPropose, onSkip }: { canPropose: boolean; cards: HandCard[]; selectedCard: string | null; currentPlayer?: Player; playerColor: string; onSelectCard: (id: string | null) => void; onPropose: (id: string) => void; onSkip: () => void }) {
  if (!canPropose) return <div className="bg-white rounded-lg shadow p-6 text-center"><p className="text-gray-600">Waiting for Speaker...</p></div>;
  const sel = cards.find(h => h.card.id === selectedCard);
  const alignment = sel && currentPlayer ? checkCardAlignment(sel.card, currentPlayer.ideologyProfile) : 'neutral';
  const hasSeats = currentPlayer && currentPlayer.seats >= 1;
  return (
    <div className="bg-white rounded-lg shadow p-6" style={{ borderTop: `4px solid ${playerColor}` }}>
      <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><Scroll className="w-5 h-5" style={{ color: playerColor }} />Propose Policy</h3>
      {!hasSeats && <div className="mb-4 p-3 bg-yellow-50 text-yellow-800 rounded-lg text-sm">Need 1+ seat to propose.</div>}
      
      {sel && (
        <div className="mb-3 p-3 bg-blue-50 rounded-lg">
          <div className="font-medium">{(sel.card as PolicyCard).name}</div>
          <div className="text-sm text-gray-600">{sel.card.description}</div>
          <div className="text-xs text-gray-500 mt-1">Issue: {(sel.card as PolicyCard).issue?.replace('_', ' ')}</div>
          <StanceDisplay stanceTable={(sel.card as PolicyCard).stanceTable} />
        </div>
      )}
      
      {sel && alignment !== 'neutral' && (
        <div className={`mb-3 p-2 rounded text-sm ${alignment === 'aligned' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {alignment === 'aligned' ? <><Award className="w-4 h-4 inline mr-1" />Aligned: +2 PCap</> : <><AlertTriangle className="w-4 h-4 inline mr-1" />Contrary: -2 seats</>}
        </div>
      )}
      <div className="flex gap-4"><button onClick={() => selectedCard && onPropose(selectedCard)} disabled={!sel || !hasSeats} className={`flex-1 py-3 rounded-lg font-medium ${sel && hasSeats ? 'text-white hover:opacity-90' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`} style={{ backgroundColor: sel && hasSeats ? playerColor : undefined }}>Propose</button><button onClick={onSkip} className="px-6 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium">Skip</button></div>
    </div>
  );
}

function PolicyVoteUI({ policy, proposer, currentPlayer, hasVoted, votes, players, playerColor, speakerId, activeIssue, onVote }: { policy: PolicyCard; proposer?: Player; currentPlayer?: Player; hasVoted: boolean; votes: { playerId: string; vote: 'yes' | 'no'; seatWeight: number }[]; players: Player[]; playerColor: string; speakerId: string; activeIssue: string; onVote: (vote: 'yes' | 'no') => void }) {
  const alignment = currentPlayer ? checkCardAlignment(policy, currentPlayer.ideologyProfile) : 'neutral';
  const yesVotes = votes.filter(v => v.vote === 'yes').reduce((s, v) => s + v.seatWeight, 0);
  const noVotes = votes.filter(v => v.vote === 'no').reduce((s, v) => s + v.seatWeight, 0);
  const isTied = yesVotes === noVotes && votes.length === players.length;
  const matchesAgenda = policy.issue === activeIssue;
  return (
    <div className="bg-white rounded-lg shadow p-6" style={{ borderTop: `4px solid ${playerColor}` }}>
      <h3 className="text-lg font-semibold mb-2">Vote on Policy</h3>
      <div className="mb-4 p-4 bg-blue-50 rounded-lg">
        <div className="text-xl font-bold">{policy.name}</div>
        <div className="text-gray-600 mb-2">{policy.description}</div>
        <div className="text-sm text-gray-500">By: {proposer?.name || '?'} • {policy.issue?.replace('_', ' ')}</div>
        {matchesAgenda && <div className="mt-1 text-sm text-purple-600 font-medium">⚡ Matches agenda - proposer picks next agenda if passed!</div>}
        <StanceDisplay stanceTable={policy.stanceTable} />
        {alignment !== 'neutral' && (
          <div className={`mt-2 text-sm font-medium ${alignment === 'aligned' ? 'text-green-600' : 'text-red-600'}`}>
            Your alignment: {alignment === 'aligned' ? '✓ Aligned (Yes vote: +1 PCap)' : '⚠ Contrary (Yes vote: -1 seat)'}
          </div>
        )}
      </div>
      <div className="mb-4">
        <div className="text-sm text-gray-600 mb-2">Votes: {votes.length}/{players.length} ({yesVotes} yes / {noVotes} no)</div>
        {isTied && <div className="text-sm text-purple-600 mb-2">⚖️ Tied! Speaker ({players.find(p => p.id === speakerId)?.name}) decides.</div>}
        <div className="flex gap-1">{players.map(p => { const v = votes.find(x => x.playerId === p.id); return <div key={p.id} className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${v ? (v.vote === 'yes' ? 'bg-green-500' : 'bg-red-500') : ''}`} style={{ backgroundColor: v ? undefined : p.color }} title={p.name}>{v ? (v.vote === 'yes' ? '✓' : '✗') : '?'}</div>; })}</div>
      </div>
      {!hasVoted ? <div className="flex gap-4"><button onClick={() => onVote('yes')} className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium">Yes</button><button onClick={() => onVote('no')} className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium">No</button></div> : <div className="text-center text-gray-600 py-3 flex items-center justify-center gap-2"><CheckCircle2 className="w-5 h-5 text-green-500" />Waiting...</div>}
    </div>
  );
}

function AgendaSelectionUI({ currentIssue, playerColor, onSelect }: { currentIssue: string; playerColor: string; onSelect: (issue: Issue) => void }) {
  const issues: Issue[] = ['economy', 'cost_of_living', 'housing', 'climate', 'security'];
  return (
    <div className="bg-white rounded-lg shadow p-6" style={{ borderTop: `4px solid ${playerColor}` }}>
      <h3 className="text-lg font-semibold mb-2 text-center">🎯 Choose New Agenda!</h3>
      <p className="text-sm text-gray-600 mb-4 text-center">Your policy matched the agenda. Pick the next national focus.</p>
      <div className="grid grid-cols-2 gap-2">
        {issues.map(issue => (
          <button key={issue} onClick={() => onSelect(issue)} className={`p-3 rounded-lg font-medium transition-all hover:scale-105 ${issue === currentIssue ? 'bg-gray-200 text-gray-500' : 'text-white hover:opacity-90'}`} style={{ backgroundColor: issue === currentIssue ? undefined : playerColor }}>
            {issue.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            {issue === currentIssue && ' (current)'}
          </button>
        ))}
      </div>
    </div>
  );
}

function WildcardUI({ wildcard, onAcknowledge }: { wildcard: any; onAcknowledge: () => void }) {
  return <div className="bg-white rounded-lg shadow p-6 border-t-4 border-yellow-400"><div className="text-center mb-4"><Zap className="w-12 h-12 text-yellow-500 mx-auto mb-2 animate-bounce" /><h3 className="text-xl font-bold">Wildcard!</h3></div><div className="p-4 bg-yellow-50 rounded-lg mb-4"><div className="text-lg font-bold">{wildcard.name}</div><div className="text-gray-600">{wildcard.description}</div></div><button onClick={onAcknowledge} className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium">Continue</button></div>;
}

function GameOverUI({ gameState, playerId }: { gameState: GameState; playerId: string }) {
  const winner = gameState.players.find(p => p.id === gameState.winner);
  const rankings = [...gameState.players].sort((a, b) => (gameState.finalScores?.[b.id] || 0) - (gameState.finalScores?.[a.id] || 0));
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="text-center mb-6"><h2 className="text-3xl font-bold mb-2">{gameState.winner === playerId ? '🎉 Victory!' : 'Game Over'}</h2><p className="text-xl" style={{ color: winner?.color }}>{winner?.name} wins!</p></div>
      <div className="space-y-3">{rankings.map((p, i) => <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg ${i === 0 ? 'ring-2 ring-yellow-400' : ''}`} style={{ backgroundColor: `${p.color}22` }}><div className="flex items-center gap-3"><span className="text-2xl">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span><div><div className="font-medium">{p.name}</div><div className="text-sm text-gray-500">{p.seats} seats</div></div></div><div className="text-2xl font-bold">{gameState.finalScores?.[p.id] || 0}</div></div>)}</div>
    </div>
  );
}

// Full card display with stance table
function CardDisplayFull({ handCard, selected, onClick, activeIssue, playerProfile }: { handCard: HandCard; selected: boolean; onClick: () => void; activeIssue: string; playerProfile: Player['ideologyProfile'] }) {
  const { card, isNew } = handCard;
  const isCampaign = 'seatDelta' in card;
  const matchesAgenda = 'issue' in card && card.issue === activeIssue;
  const alignment = checkCardAlignment(card, playerProfile);
  const stanceTable = 'stanceTable' in card ? card.stanceTable : null;
  
  return (
    <div onClick={onClick} className={`relative p-3 rounded-lg border-2 cursor-pointer transition-all ${selected ? 'border-blue-500 bg-blue-50 shadow-lg scale-[1.02]' : 'border-gray-200 hover:border-gray-300 hover:shadow'} ${isNew ? 'ring-2 ring-yellow-400 ring-offset-2' : ''}`}>
      {isNew && <div className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1"><Sparkles className="w-3 h-3" />NEW</div>}
      <div className="flex justify-between items-start mb-2">
        <span className={`text-xs px-2 py-0.5 rounded ${isCampaign ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{isCampaign ? 'Campaign' : 'Policy'}</span>
        <div className="flex gap-1">
          {matchesAgenda && <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">+Agenda</span>}
          {alignment === 'aligned' && <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">✓ Aligned</span>}
          {alignment === 'contrary' && <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">⚠ Contrary</span>}
        </div>
      </div>
      <div className="font-medium">{card.name}</div>
      <div className="text-xs text-gray-500 mt-1">{card.description}</div>
      {isCampaign && <div className="mt-2 text-sm font-bold text-green-600">+{(card as CampaignCard).seatDelta} seats</div>}
      {'issue' in card && card.issue && <div className="text-xs text-gray-400 mt-1">Issue: {card.issue.replace('_', ' ')}</div>}
      {stanceTable && <StanceDisplay stanceTable={stanceTable} compact />}
    </div>
  );
}
