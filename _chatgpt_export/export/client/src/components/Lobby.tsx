import React, { useState } from 'react';
import { GameState, GameConfig, SocialIdeology, EconomicIdeology } from '../types';

interface LobbyProps {
  gameState: GameState;
  gameConfig: GameConfig;
  playerId: string;
  onStartGame: () => void;
  onUpdateConfig: (config: Partial<GameConfig>) => void;
}

export function Lobby({ gameState, gameConfig, playerId, onStartGame, onUpdateConfig }: LobbyProps) {
  const isHost = gameState.players[0]?.id === playerId;
  const canStart = gameState.players.length >= 2;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Room: {gameState.roomId}</h2>
          <span className="text-sm text-gray-500">
            {gameState.players.length}/5 players
          </span>
        </div>

        {/* Players list */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Players</h3>
          <div className="space-y-2">
            {gameState.players.map((player, idx) => (
              <div
                key={player.id}
                className="flex items-center justify-between p-3 rounded-lg border"
                style={{ borderColor: player.color }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: player.color }}
                  />
                  <div>
                    <span className="font-medium">{player.name}</span>
                    <span className="text-gray-500 text-sm ml-2">({player.playerName})</span>
                  </div>
                  {idx === 0 && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                      Host
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600">
                  {player.socialIdeology} / {player.economicIdeology}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Config (host only) */}
        {isHost && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">Game Settings</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Total Seats</label>
                <input
                  type="number"
                  value={gameConfig.totalSeats}
                  onChange={(e) => onUpdateConfig({ totalSeats: parseInt(e.target.value) || 50 })}
                  className="w-full px-3 py-2 border rounded-lg"
                  min="10"
                  max="150"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Hand Limit</label>
                <input
                  type="number"
                  value={gameConfig.handLimit}
                  onChange={(e) => onUpdateConfig({ handLimit: parseInt(e.target.value) || 5 })}
                  className="w-full px-3 py-2 border rounded-lg"
                  min="3"
                  max="10"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Max Rounds</label>
                <input
                  type="number"
                  value={gameConfig.maxRounds || ''}
                  onChange={(e) => onUpdateConfig({ maxRounds: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="No limit"
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Ideology Mode</label>
                <select
                  value={gameConfig.ideologyMode}
                  onChange={(e) => onUpdateConfig({ ideologyMode: e.target.value as 'random' | 'choose' })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="random">Random Assignment</option>
                  <option value="choose">Player Choice</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Policy Proposal</label>
                <select
                  value={gameConfig.policyProposalRule}
                  onChange={(e) => onUpdateConfig({ policyProposalRule: e.target.value as 'speaker_only' | 'any_player' })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="speaker_only">Speaker Only</option>
                  <option value="any_player">Any Player</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Agenda Bonus</label>
                <input
                  type="number"
                  value={gameConfig.agendaBonus}
                  onChange={(e) => onUpdateConfig({ agendaBonus: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border rounded-lg"
                  min="0"
                  max="5"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={gameConfig.wildcardOnPolicyPass}
                  onChange={(e) => onUpdateConfig({ wildcardOnPolicyPass: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Draw wildcard when policy passes</span>
              </label>
            </div>
          </div>
        )}

        {/* Start button */}
        {isHost ? (
          <button
            onClick={onStartGame}
            disabled={!canStart}
            className={`w-full py-3 rounded-lg font-semibold text-white transition-colors ${
              canStart
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            {canStart ? 'Start Game' : 'Need at least 2 players'}
          </button>
        ) : (
          <div className="text-center text-gray-600 py-3">
            Waiting for host to start the game...
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
        <h4 className="font-semibold mb-2">How to Play</h4>
        <ul className="list-disc list-inside space-y-1">
          <li>Share the room code with friends to join</li>
          <li>Each round: Draw cards → Campaign → Propose & Vote on Policies</li>
          <li>Gain seats through campaigns and favorable policies</li>
          <li>Earn Political Capital (PCap) for ideology alignment and passing policies</li>
          <li>The player with the most PCap at the end wins!</li>
        </ul>
      </div>
    </div>
  );
}

// Join/Create form component
interface JoinFormProps {
  onJoin: (roomId: string, playerName: string, partyName: string, socialIdeology?: SocialIdeology, economicIdeology?: EconomicIdeology) => void;
  onCreate: (playerName: string, partyName: string, configOverrides?: Partial<GameConfig>, socialIdeology?: SocialIdeology, economicIdeology?: EconomicIdeology) => void;
  ideologyMode?: 'random' | 'choose';
}

export function JoinForm({ onJoin, onCreate, ideologyMode = 'random' }: JoinFormProps) {
  const [mode, setMode] = useState<'join' | 'create'>('join');
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [partyName, setPartyName] = useState('');
  const [socialIdeology, setSocialIdeology] = useState<SocialIdeology>('progressive');
  const [economicIdeology, setEconomicIdeology] = useState<EconomicIdeology>('market');
  const [showIdeologyChoice, setShowIdeologyChoice] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalSocial = showIdeologyChoice ? socialIdeology : undefined;
    const finalEconomic = showIdeologyChoice ? economicIdeology : undefined;
    
    if (mode === 'join') {
      onJoin(roomCode.toUpperCase(), playerName, partyName, finalSocial, finalEconomic);
    } else {
      onCreate(
        playerName, 
        partyName, 
        showIdeologyChoice ? { ideologyMode: 'choose' } : { ideologyMode: 'random' },
        finalSocial,
        finalEconomic
      );
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold text-center mb-6">Political Capital</h1>
        
        {/* Mode toggle */}
        <div className="flex mb-6">
          <button
            onClick={() => setMode('join')}
            className={`flex-1 py-2 text-center font-medium transition-colors ${
              mode === 'join'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            } rounded-l-lg`}
          >
            Join Game
          </button>
          <button
            onClick={() => setMode('create')}
            className={`flex-1 py-2 text-center font-medium transition-colors ${
              mode === 'create'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            } rounded-r-lg`}
          >
            Create Game
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'join' && (
            <div>
              <label className="block text-sm font-medium mb-1">Room Code</label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Enter 6-character code"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                maxLength={6}
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Your Name</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Party Name</label>
            <input
              type="text"
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              placeholder="e.g., Labor Party, Liberal Democrats"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {mode === 'create' && (
            <div>
              <label className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  checked={showIdeologyChoice}
                  onChange={(e) => setShowIdeologyChoice(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm font-medium">Let players choose their ideology</span>
              </label>
            </div>
          )}

          {(showIdeologyChoice || (mode === 'join' && ideologyMode === 'choose')) && (
            <div className="p-4 bg-gray-50 rounded-lg space-y-3">
              <h4 className="font-medium text-sm">Choose Your Ideology</h4>
              
              <div>
                <label className="block text-sm mb-1">Social Position</label>
                <select
                  value={socialIdeology}
                  onChange={(e) => setSocialIdeology(e.target.value as SocialIdeology)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="progressive">Progressive</option>
                  <option value="conservative">Conservative</option>
                </select>
              </div>

              <div>
                <label className="block text-sm mb-1">Economic Position</label>
                <select
                  value={economicIdeology}
                  onChange={(e) => setEconomicIdeology(e.target.value as EconomicIdeology)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="market">Market-Oriented</option>
                  <option value="interventionist">Interventionist</option>
                </select>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            {mode === 'join' ? 'Join Game' : 'Create Game'}
          </button>
        </form>
      </div>
    </div>
  );
}
