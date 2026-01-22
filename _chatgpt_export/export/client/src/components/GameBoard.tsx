import React, { useState, useMemo } from 'react';
import { 
  GameState, 
  GameConfig, 
  Player, 
  CampaignCard, 
  PolicyCard,
  ChatMessage 
} from '../types';
import { SeatLayout, SeatLayoutCompact } from './SeatLayout';
import { ChatPanel } from './ChatPanel';
import { 
  MessageSquare, 
  Download, 
  ChevronDown, 
  ChevronUp,
  Star,
  Vote,
  Scroll,
  Zap
} from 'lucide-react';

interface GameBoardProps {
  gameState: GameState;
  gameConfig: GameConfig;
  playerId: string;
  chatMessages: ChatMessage[];
  onDrawCard: (deckType: 'campaign' | 'policy') => void;
  onPlayCampaign: (cardId: string) => void;
  onSkipCampaign: () => void;
  onProposePolicy: (cardId: string) => void;
  onSkipProposal: () => void;
  onCastVote: (vote: 'yes' | 'no') => void;
  onAcknowledgeWildcard: () => void;
  onAdjustIssue: (direction: -1 | 0 | 1) => void;
  onExportGame: () => void;
  onSendChat: (content: string, recipientId: string | null) => void;
}

export function GameBoard({
  gameState,
  gameConfig,
  playerId,
  chatMessages,
  onDrawCard,
  onPlayCampaign,
  onSkipCampaign,
  onProposePolicy,
  onSkipProposal,
  onCastVote,
  onAcknowledgeWildcard,
  onAdjustIssue,
  onExportGame,
  onSendChat,
}: GameBoardProps) {
  const [showChat, setShowChat] = useState(false);
  const [showEventLog, setShowEventLog] = useState(false);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  const currentPlayer = gameState.players.find(p => p.id === playerId);
  const currentTurnPlayerId = gameState.turnOrder[gameState.currentPlayerIndex];
  const speakerId = gameState.turnOrder[gameState.speakerIndex];
  const isMyTurn = currentTurnPlayerId === playerId;
  const iAmSpeaker = speakerId === playerId;

  // Separate hand into campaign and policy cards
  const { campaignCards, policyCards } = useMemo(() => {
    const campaigns: CampaignCard[] = [];
    const policies: PolicyCard[] = [];
    
    currentPlayer?.hand.forEach(card => {
      if ('seatDelta' in card) {
        campaigns.push(card);
      } else if ('stanceTable' in card) {
        policies.push(card);
      }
    });
    
    return { campaignCards: campaigns, policyCards: policies };
  }, [currentPlayer?.hand]);

  // Calculate player's PCap total
  const getPlayerPCap = (player: Player) => {
    return player.pCapCards.reduce((sum, card) => sum + card.value, 0);
  };

  // Format issue name
  const formatIssue = (issue: string) => {
    return issue.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  // Get phase description
  const getPhaseDescription = () => {
    switch (gameState.phase) {
      case 'draw':
        return 'Draw Phase - All players draw a card';
      case 'campaign':
        return `Campaign Phase - ${gameState.players.find(p => p.id === currentTurnPlayerId)?.name}'s turn`;
      case 'policy_proposal':
        return iAmSpeaker 
          ? 'Your turn to propose a policy' 
          : `Waiting for ${gameState.players.find(p => p.id === speakerId)?.name} to propose`;
      case 'policy_vote':
        return 'Vote on the proposed policy';
      case 'policy_resolution':
        return 'Resolving policy effects...';
      case 'wildcard_resolution':
        return 'Wildcard event!';
      case 'issue_adjustment':
        return 'Adjust the national agenda';
      case 'game_over':
        return 'Game Over!';
      default:
        return '';
    }
  };

  // Check if player has voted
  const hasVoted = gameState.votes.some(v => v.playerId === playerId);

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Round {gameState.round}</h1>
              <p className="text-gray-600">{getPhaseDescription()}</p>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Active Issue */}
              <div className="text-center">
                <div className="text-xs text-gray-500 uppercase">Agenda</div>
                <div className="font-bold text-lg text-blue-600">
                  {formatIssue(gameState.activeIssue)}
                </div>
              </div>
              
              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowChat(!showChat)}
                  className={`p-2 rounded-lg transition-colors relative ${
                    showChat ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                  title="Chat"
                >
                  <MessageSquare className="w-5 h-5" />
                  {chatMessages.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {chatMessages.length > 9 ? '9+' : chatMessages.length}
                    </span>
                  )}
                </button>
                
                <button
                  onClick={() => setShowEventLog(!showEventLog)}
                  className={`p-2 rounded-lg transition-colors ${
                    showEventLog ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                  title="Event Log"
                >
                  <Scroll className="w-5 h-5" />
                </button>
                
                <button
                  onClick={onExportGame}
                  className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                  title="Download Game Log"
                >
                  <Download className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Left sidebar - Players & Seats */}
          <div className="lg:col-span-1 space-y-4">
            {/* Seat Layout */}
            <SeatLayout 
              players={gameState.players} 
              totalSeats={gameState.totalSeats}
              speakerId={speakerId}
            />
            
            {/* Players list */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold mb-3">Players</h3>
              <div className="space-y-2">
                {gameState.players.map(player => {
                  const isCurrent = player.id === currentTurnPlayerId;
                  const isSpeaker = player.id === speakerId;
                  const pcap = getPlayerPCap(player);
                  
                  return (
                    <div
                      key={player.id}
                      className={`p-2 rounded-lg border-2 transition-all ${
                        isCurrent ? 'border-yellow-400 bg-yellow-50' : 'border-transparent'
                      } ${player.id === playerId ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: player.color }}
                          />
                          <span className="font-medium text-sm">{player.name}</span>
                          {isSpeaker && <Star className="w-4 h-4 text-yellow-500" />}
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold">{player.seats} seats</div>
                          <div className="text-xs text-gray-500">{pcap} PCap</div>
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {player.socialIdeology} / {player.economicIdeology}
                      </div>
                      {!player.connected && (
                        <div className="text-xs text-red-500 mt-1">Disconnected</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main content area */}
          <div className="lg:col-span-2 space-y-4">
            {/* Phase-specific UI */}
            {gameState.phase === 'draw' && (
              <DrawPhaseUI
                hasDrawn={gameState.playersDrawn.includes(playerId)}
                onDraw={onDrawCard}
              />
            )}

            {gameState.phase === 'campaign' && (
              <CampaignPhaseUI
                isMyTurn={isMyTurn}
                cards={campaignCards}
                activeIssue={gameState.activeIssue}
                selectedCard={selectedCard}
                onSelectCard={setSelectedCard}
                onPlay={onPlayCampaign}
                onSkip={onSkipCampaign}
              />
            )}

            {gameState.phase === 'policy_proposal' && (
              <PolicyProposalUI
                canPropose={iAmSpeaker || gameConfig.policyProposalRule === 'any_player'}
                cards={policyCards}
                selectedCard={selectedCard}
                currentPlayer={currentPlayer}
                onSelectCard={setSelectedCard}
                onPropose={onProposePolicy}
                onSkip={onSkipProposal}
              />
            )}

            {gameState.phase === 'policy_vote' && gameState.proposedPolicy && (
              <PolicyVoteUI
                policy={gameState.proposedPolicy}
                proposer={gameState.players.find(p => p.id === gameState.proposerId)}
                currentPlayer={currentPlayer}
                hasVoted={hasVoted}
                votes={gameState.votes}
                players={gameState.players}
                onVote={onCastVote}
              />
            )}

            {gameState.phase === 'wildcard_resolution' && gameState.pendingWildcard && (
              <WildcardUI
                wildcard={gameState.pendingWildcard}
                onAcknowledge={onAcknowledgeWildcard}
              />
            )}

            {gameState.phase === 'issue_adjustment' && (
              <IssueAdjustmentUI
                currentIssue={gameState.activeIssue}
                issueTrack={gameState.issueTrack}
                onAdjust={onAdjustIssue}
              />
            )}

            {gameState.phase === 'game_over' && (
              <GameOverUI
                gameState={gameState}
                playerId={playerId}
              />
            )}

            {/* Hand display */}
            {currentPlayer && gameState.phase !== 'game_over' && (
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-semibold mb-3">Your Hand ({currentPlayer.hand.length}/{gameConfig.handLimit})</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {currentPlayer.hand.map(card => (
                    <CardDisplay
                      key={card.id}
                      card={card}
                      selected={selectedCard === card.id}
                      onClick={() => setSelectedCard(selectedCard === card.id ? null : card.id)}
                      activeIssue={gameState.activeIssue}
                      playerIdeology={{
                        social: currentPlayer.socialIdeology,
                        economic: currentPlayer.economicIdeology
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar - Chat or Event Log */}
          <div className="lg:col-span-1">
            {showChat ? (
              <div className="h-[500px]">
                <ChatPanel
                  messages={chatMessages}
                  players={gameState.players}
                  currentPlayerId={playerId}
                  onSendMessage={onSendChat}
                  onClose={() => setShowChat(false)}
                />
              </div>
            ) : showEventLog ? (
              <EventLogPanel
                events={gameState.eventLog}
                players={gameState.players}
                onClose={() => setShowEventLog(false)}
              />
            ) : (
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-semibold mb-3">Quick Info</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-gray-500">Room:</span>
                    <span className="ml-2 font-mono font-bold">{gameState.roomId}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Campaign Deck:</span>
                    <span className="ml-2">{gameState.campaignDeck.length} cards</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Policy Deck:</span>
                    <span className="ml-2">{gameState.policyDeck.length} cards</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Your PCap:</span>
                    <span className="ml-2 font-bold">{currentPlayer ? getPlayerPCap(currentPlayer) : 0}</span>
                  </div>
                </div>
                
                {/* PCap breakdown */}
                {currentPlayer && currentPlayer.pCapCards.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="text-sm font-medium mb-2">Your Political Capital</h4>
                    <div className="space-y-1">
                      {currentPlayer.pCapCards.map((card, idx) => (
                        <div key={idx} className="flex justify-between text-xs">
                          <span className="text-gray-600">{card.name}</span>
                          <span className="font-medium">+{card.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Sub-components for each phase

function DrawPhaseUI({ hasDrawn, onDraw }: { hasDrawn: boolean; onDraw: (type: 'campaign' | 'policy') => void }) {
  if (hasDrawn) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <p className="text-gray-600">Waiting for other players to draw...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4 text-center">Draw a Card</h3>
      <div className="flex gap-4 justify-center">
        <button
          onClick={() => onDraw('campaign')}
          className="px-6 py-4 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
        >
          <Zap className="w-6 h-6 mx-auto mb-1" />
          Campaign Card
        </button>
        <button
          onClick={() => onDraw('policy')}
          className="px-6 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
        >
          <Scroll className="w-6 h-6 mx-auto mb-1" />
          Policy Card
        </button>
      </div>
    </div>
  );
}

function CampaignPhaseUI({
  isMyTurn,
  cards,
  activeIssue,
  selectedCard,
  onSelectCard,
  onPlay,
  onSkip,
}: {
  isMyTurn: boolean;
  cards: CampaignCard[];
  activeIssue: string;
  selectedCard: string | null;
  onSelectCard: (id: string | null) => void;
  onPlay: (id: string) => void;
  onSkip: () => void;
}) {
  if (!isMyTurn) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <p className="text-gray-600">Waiting for other players to campaign...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Play a Campaign Card</h3>
      <p className="text-sm text-gray-600 mb-4">
        Cards matching the current agenda ({activeIssue.replace('_', ' ')}) get a bonus!
      </p>
      
      <div className="flex gap-4">
        <button
          onClick={() => selectedCard && onPlay(selectedCard)}
          disabled={!selectedCard || !cards.find(c => c.id === selectedCard)}
          className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
            selectedCard && cards.find(c => c.id === selectedCard)
              ? 'bg-green-500 hover:bg-green-600 text-white'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
        >
          Play Selected Card
        </button>
        <button
          onClick={onSkip}
          className="px-6 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

function PolicyProposalUI({
  canPropose,
  cards,
  selectedCard,
  currentPlayer,
  onSelectCard,
  onPropose,
  onSkip,
}: {
  canPropose: boolean;
  cards: PolicyCard[];
  selectedCard: string | null;
  currentPlayer?: Player;
  onSelectCard: (id: string | null) => void;
  onPropose: (id: string) => void;
  onSkip: () => void;
}) {
  if (!canPropose) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <p className="text-gray-600">Waiting for the Speaker to propose a policy...</p>
      </div>
    );
  }

  const selectedPolicy = cards.find(c => c.id === selectedCard);
  const hasSeats = currentPlayer && currentPlayer.seats >= 1;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Propose a Policy</h3>
      
      {!hasSeats && (
        <div className="mb-4 p-3 bg-yellow-50 text-yellow-800 rounded-lg text-sm">
          You need at least 1 seat to propose a policy.
        </div>
      )}
      
      {selectedPolicy && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <div className="font-medium">{selectedPolicy.name}</div>
          <div className="text-sm text-gray-600">{selectedPolicy.description}</div>
        </div>
      )}
      
      <div className="flex gap-4">
        <button
          onClick={() => selectedCard && onPropose(selectedCard)}
          disabled={!selectedCard || !selectedPolicy || !hasSeats}
          className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
            selectedCard && selectedPolicy && hasSeats
              ? 'bg-blue-500 hover:bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
        >
          Propose Policy
        </button>
        <button
          onClick={onSkip}
          className="px-6 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
        >
          Skip Round
        </button>
      </div>
    </div>
  );
}

function PolicyVoteUI({
  policy,
  proposer,
  currentPlayer,
  hasVoted,
  votes,
  players,
  onVote,
}: {
  policy: PolicyCard;
  proposer?: Player;
  currentPlayer?: Player;
  hasVoted: boolean;
  votes: { playerId: string; vote: 'yes' | 'no'; seatWeight: number }[];
  players: Player[];
  onVote: (vote: 'yes' | 'no') => void;
}) {
  // Calculate alignment for current player
  const getAlignment = () => {
    if (!currentPlayer) return null;
    
    const socialStance = policy.stanceTable[currentPlayer.socialIdeology];
    const economicStance = policy.stanceTable[currentPlayer.economicIdeology];
    
    if (socialStance === 'favoured' && economicStance === 'favoured') return 'Double Favoured (+2 PCap)';
    if (socialStance === 'favoured' || economicStance === 'favoured') return 'Favoured (+1 PCap)';
    if (socialStance === 'opposed' || economicStance === 'opposed') return 'Opposed';
    return 'Neutral';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-2">Vote on Policy</h3>
      
      <div className="mb-4 p-4 bg-blue-50 rounded-lg">
        <div className="text-xl font-bold">{policy.name}</div>
        <div className="text-gray-600 mb-2">{policy.description}</div>
        <div className="text-sm text-gray-500">
          Proposed by: {proposer?.name || 'Unknown'} • Issue: {policy.issue.replace('_', ' ')}
        </div>
        {currentPlayer && (
          <div className="mt-2 text-sm font-medium">
            Your alignment: <span className="text-blue-600">{getAlignment()}</span>
          </div>
        )}
      </div>

      {/* Stance table */}
      <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
        {Object.entries(policy.stanceTable).map(([ideology, stance]) => (
          <div key={ideology} className="flex justify-between">
            <span className="capitalize">{ideology}:</span>
            <span className={`font-medium ${
              stance === 'favoured' ? 'text-green-600' : 
              stance === 'opposed' ? 'text-red-600' : 'text-gray-500'
            }`}>
              {stance}
            </span>
          </div>
        ))}
      </div>

      {/* Vote status */}
      <div className="mb-4">
        <div className="text-sm text-gray-600 mb-2">Votes: {votes.length}/{players.length}</div>
        <div className="flex gap-1">
          {players.map(p => {
            const vote = votes.find(v => v.playerId === p.id);
            return (
              <div
                key={p.id}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                  vote ? (vote.vote === 'yes' ? 'bg-green-500' : 'bg-red-500') : 'bg-gray-300'
                }`}
                title={p.name}
                style={{ backgroundColor: vote ? undefined : p.color }}
              >
                {vote ? (vote.vote === 'yes' ? '✓' : '✗') : '?'}
              </div>
            );
          })}
        </div>
      </div>

      {/* Vote buttons */}
      {!hasVoted ? (
        <div className="flex gap-4">
          <button
            onClick={() => onVote('yes')}
            className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
          >
            Vote Yes
          </button>
          <button
            onClick={() => onVote('no')}
            className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
          >
            Vote No
          </button>
        </div>
      ) : (
        <div className="text-center text-gray-600 py-3">
          Waiting for other votes...
        </div>
      )}
    </div>
  );
}

function WildcardUI({ wildcard, onAcknowledge }: { wildcard: any; onAcknowledge: () => void }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="text-center mb-4">
        <Zap className="w-12 h-12 text-yellow-500 mx-auto mb-2" />
        <h3 className="text-xl font-bold">Wildcard Event!</h3>
      </div>
      
      <div className="p-4 bg-yellow-50 rounded-lg mb-4">
        <div className="text-lg font-bold">{wildcard.name}</div>
        <div className="text-gray-600">{wildcard.description}</div>
      </div>
      
      <button
        onClick={onAcknowledge}
        className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium transition-colors"
      >
        Continue
      </button>
    </div>
  );
}

function IssueAdjustmentUI({
  currentIssue,
  issueTrack,
  onAdjust,
}: {
  currentIssue: string;
  issueTrack: string[];
  onAdjust: (direction: -1 | 0 | 1) => void;
}) {
  const currentIndex = issueTrack.indexOf(currentIssue);
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4 text-center">Adjust National Agenda</h3>
      
      <div className="flex items-center justify-center gap-2 mb-6">
        {issueTrack.map((issue, idx) => (
          <div
            key={issue}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              idx === currentIndex
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {issue.replace('_', ' ')}
          </div>
        ))}
      </div>
      
      <div className="flex gap-4 justify-center">
        <button
          onClick={() => onAdjust(-1)}
          disabled={currentIndex === 0}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            currentIndex > 0
              ? 'bg-gray-200 hover:bg-gray-300'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          ← Previous
        </button>
        <button
          onClick={() => onAdjust(0)}
          className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
        >
          Keep Current
        </button>
        <button
          onClick={() => onAdjust(1)}
          disabled={currentIndex === issueTrack.length - 1}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            currentIndex < issueTrack.length - 1
              ? 'bg-gray-200 hover:bg-gray-300'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

function GameOverUI({ gameState, playerId }: { gameState: GameState; playerId: string }) {
  const winner = gameState.players.find(p => p.id === gameState.winner);
  const isWinner = gameState.winner === playerId;
  
  // Sort players by final score
  const rankings = [...gameState.players].sort((a, b) => {
    const aScore = gameState.finalScores?.[a.id] || 0;
    const bScore = gameState.finalScores?.[b.id] || 0;
    return bScore - aScore;
  });

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold mb-2">
          {isWinner ? '🎉 Victory!' : 'Game Over'}
        </h2>
        <p className="text-xl">
          {winner?.name} wins!
        </p>
      </div>
      
      <div className="space-y-3">
        {rankings.map((player, idx) => {
          const score = gameState.finalScores?.[player.id] || 0;
          return (
            <div
              key={player.id}
              className={`flex items-center justify-between p-3 rounded-lg ${
                idx === 0 ? 'bg-yellow-50 border-2 border-yellow-400' : 'bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                </span>
                <div>
                  <div className="font-medium">{player.name}</div>
                  <div className="text-sm text-gray-500">{player.seats} seats</div>
                </div>
              </div>
              <div className="text-2xl font-bold">{score} PCap</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CardDisplay({
  card,
  selected,
  onClick,
  activeIssue,
  playerIdeology,
}: {
  card: CampaignCard | PolicyCard;
  selected: boolean;
  onClick: () => void;
  activeIssue: string;
  playerIdeology: { social: string; economic: string };
}) {
  const isCampaign = 'seatDelta' in card;
  const matchesAgenda = 'issue' in card && card.issue === activeIssue;
  
  // For policy cards, show alignment
  let alignment = '';
  if (!isCampaign && 'stanceTable' in card) {
    const socialStance = card.stanceTable[playerIdeology.social as keyof typeof card.stanceTable];
    const economicStance = card.stanceTable[playerIdeology.economic as keyof typeof card.stanceTable];
    
    if (socialStance === 'favoured' && economicStance === 'favoured') alignment = '★★';
    else if (socialStance === 'favoured' || economicStance === 'favoured') alignment = '★';
    else if (socialStance === 'opposed' || economicStance === 'opposed') alignment = '⚠';
  }

  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
        selected
          ? 'border-blue-500 bg-blue-50 shadow-lg'
          : 'border-gray-200 hover:border-gray-300 hover:shadow'
      }`}
    >
      <div className="flex justify-between items-start mb-1">
        <span className={`text-xs px-2 py-0.5 rounded ${
          isCampaign ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
        }`}>
          {isCampaign ? 'Campaign' : 'Policy'}
        </span>
        {matchesAgenda && (
          <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">
            +Agenda
          </span>
        )}
        {alignment && (
          <span className={`text-xs ${alignment === '⚠' ? 'text-red-500' : 'text-yellow-500'}`}>
            {alignment}
          </span>
        )}
      </div>
      <div className="font-medium text-sm">{card.name}</div>
      <div className="text-xs text-gray-500 mt-1">{card.description}</div>
      {isCampaign && (
        <div className="mt-2 text-sm font-bold text-green-600">
          +{(card as CampaignCard).seatDelta} seats
        </div>
      )}
    </div>
  );
}

function EventLogPanel({
  events,
  players,
  onClose,
}: {
  events: any[];
  players: Player[];
  onClose: () => void;
}) {
  const getPlayerName = (playerId: string) => {
    return players.find(p => p.id === playerId)?.name || 'Unknown';
  };

  const formatEvent = (event: any) => {
    switch (event.type) {
      case 'round_started':
        return `Round ${event.round} started - Agenda: ${event.activeIssue}`;
      case 'card_drawn':
        return `${getPlayerName(event.playerId)} drew a ${event.cardType} card`;
      case 'campaign_played':
        return `${getPlayerName(event.playerId)} campaigned (+${event.seatDelta} seats)`;
      case 'policy_proposed':
        return `${getPlayerName(event.playerId)} proposed a policy`;
      case 'vote_cast':
        return `${getPlayerName(event.playerId)} voted ${event.vote}`;
      case 'policy_resolved':
        return `Policy ${event.passed ? 'PASSED' : 'FAILED'} (${event.yesVotes}-${event.noVotes})`;
      case 'pcap_awarded':
        return `${getPlayerName(event.playerId)} earned ${event.value} PCap`;
      case 'seats_changed':
        return `${getPlayerName(event.playerId)}: ${event.delta > 0 ? '+' : ''}${event.delta} seats (${event.reason})`;
      default:
        return event.type;
    }
  };

  const recentEvents = events.slice(-20).reverse();

  return (
    <div className="bg-white rounded-lg shadow p-4 h-[500px] flex flex-col">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold">Event Log</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2">
        {recentEvents.map((event, idx) => (
          <div key={idx} className="text-sm p-2 bg-gray-50 rounded">
            {formatEvent(event)}
          </div>
        ))}
      </div>
    </div>
  );
}
