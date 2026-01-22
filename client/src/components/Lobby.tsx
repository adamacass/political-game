import React, { useState, useEffect } from 'react';
import { 
  GameState, 
  GameConfig, 
  Player,
  PARTY_COLORS,
  PartyColorId,
  SocialIdeology,
  EconomicIdeology,
} from '../types';
import { 
  Users, 
  Play, 
  Settings, 
  Copy, 
  Check, 
  Palette,
  Star,
  GitMerge,
  Target,
  RefreshCw,
  Brain,
} from 'lucide-react';

interface LobbyProps {
  gameState: GameState | null;
  gameConfig: GameConfig | null;
  playerId: string;
  availableColors: PartyColorId[];
  onStartGame: () => void;
  onUpdateConfig: (config: Partial<GameConfig>) => void;
  onCreateRoom: (playerName: string, partyName: string, colorId?: PartyColorId, social?: SocialIdeology, economic?: EconomicIdeology) => void;
  onJoinRoom: (roomId: string, playerName: string, partyName: string, colorId?: PartyColorId, social?: SocialIdeology, economic?: EconomicIdeology) => void;
}

export function Lobby({
  gameState,
  gameConfig,
  playerId,
  availableColors,
  onStartGame,
  onUpdateConfig,
  onCreateRoom,
  onJoinRoom,
}: LobbyProps) {
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [playerName, setPlayerName] = useState('');
  const [partyName, setPartyName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [selectedColor, setSelectedColor] = useState<PartyColorId | null>(null);
  const [socialIdeology, setSocialIdeology] = useState<SocialIdeology>('progressive');
  const [economicIdeology, setEconomicIdeology] = useState<EconomicIdeology>('market');
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const isHost = gameState?.players[0]?.id === playerId;
  const currentPlayer = gameState?.players.find(p => p.id === playerId);

  // Update available colors when they change
  useEffect(() => {
    if (availableColors.length > 0 && !selectedColor) {
      setSelectedColor(availableColors[0]);
    }
  }, [availableColors, selectedColor]);

  const handleCreate = () => {
    if (playerName.trim() && partyName.trim()) {
      onCreateRoom(
        playerName.trim(), 
        partyName.trim(), 
        selectedColor || undefined,
        gameConfig?.ideologyMode === 'choose' ? socialIdeology : undefined,
        gameConfig?.ideologyMode === 'choose' ? economicIdeology : undefined
      );
    }
  };

  const handleJoin = () => {
    if (playerName.trim() && partyName.trim() && roomCode.trim()) {
      onJoinRoom(
        roomCode.trim().toUpperCase(), 
        playerName.trim(), 
        partyName.trim(),
        selectedColor || undefined,
        gameConfig?.ideologyMode === 'choose' ? socialIdeology : undefined,
        gameConfig?.ideologyMode === 'choose' ? economicIdeology : undefined
      );
    }
  };

  const copyRoomCode = () => {
    if (gameState) {
      navigator.clipboard.writeText(gameState.roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Mode selection screen
  if (mode === 'choose') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <h1 className="text-3xl font-bold text-center mb-2">Political Game</h1>
          <p className="text-gray-500 text-center mb-8">Compete for seats in parliament</p>
          
          <div className="space-y-4">
            <button
              onClick={() => setMode('create')}
              className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-lg transition-all hover:scale-105 shadow-lg"
            >
              Create New Game
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full py-4 px-6 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-semibold text-lg transition-all hover:scale-105"
            >
              Join Existing Game
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Create/Join form
  if (!gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <button
            onClick={() => setMode('choose')}
            className="text-gray-500 hover:text-gray-700 mb-4"
          >
            ← Back
          </button>
          
          <h2 className="text-2xl font-bold mb-6">
            {mode === 'create' ? 'Create Game' : 'Join Game'}
          </h2>

          <div className="space-y-4">
            {mode === 'join' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room Code</label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={e => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="Enter 6-letter code"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase font-mono text-xl tracking-wider"
                  maxLength={6}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
              <input
                type="text"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="John"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Party Name</label>
              <input
                type="text"
                value={partyName}
                onChange={e => setPartyName(e.target.value)}
                placeholder="Progressive Alliance"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Color picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Party Color
              </label>
              <div className="flex gap-2 flex-wrap">
                {PARTY_COLORS.map(color => {
                  const isAvailable = availableColors.length === 0 || availableColors.includes(color.id);
                  return (
                    <button
                      key={color.id}
                      onClick={() => isAvailable && setSelectedColor(color.id)}
                      disabled={!isAvailable}
                      className={`w-10 h-10 rounded-full transition-all ${
                        selectedColor === color.id
                          ? 'ring-4 ring-offset-2 ring-gray-400 scale-110'
                          : isAvailable
                          ? 'hover:scale-105'
                          : 'opacity-30 cursor-not-allowed'
                      }`}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                    />
                  );
                })}
              </div>
            </div>

            <button
              onClick={mode === 'create' ? handleCreate : handleJoin}
              disabled={!playerName.trim() || !partyName.trim() || (mode === 'join' && !roomCode.trim())}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-xl font-semibold text-lg transition-colors"
            >
              {mode === 'create' ? 'Create Game' : 'Join Game'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Lobby view (in room, waiting for game to start)
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Room header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Room Code</div>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-mono font-bold tracking-wider">{gameState.roomId}</span>
                <button
                  onClick={copyRoomCode}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  title="Copy room code"
                >
                  {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5 text-gray-400" />}
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {isHost && (
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-3 rounded-lg transition-colors ${
                    showSettings ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                  }`}
                >
                  <Settings className="w-5 h-5" />
                </button>
              )}
              
              {isHost && (
                <button
                  onClick={onStartGame}
                  disabled={gameState.players.length < 2}
                  className="flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white rounded-xl font-semibold transition-colors"
                >
                  <Play className="w-5 h-5" />
                  Start Game
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Players list */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-xl p-6">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Players ({gameState.players.length}/5)
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {gameState.players.map((player, idx) => (
                <div
                  key={player.id}
                  className={`p-4 rounded-xl border-2 ${
                    player.id === playerId ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl"
                      style={{ backgroundColor: player.color }}
                    >
                      {player.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">{player.name}</div>
                      <div className="text-sm text-gray-500">{player.playerName}</div>
                    </div>
                    {idx === 0 && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium flex items-center gap-1">
                        <Star className="w-3 h-3" /> Host
                      </span>
                    )}
                  </div>
                  
                  {gameConfig?.ideologyMode !== 'derived' && (
                    <div className="mt-3 text-xs">
                      <span className="text-gray-500">Ideology: </span>
                      <span className="font-medium capitalize">{player.socialIdeology} / {player.economicIdeology}</span>
                    </div>
                  )}
                </div>
              ))}
              
              {/* Empty slots */}
              {Array.from({ length: 5 - gameState.players.length }).map((_, idx) => (
                <div
                  key={`empty-${idx}`}
                  className="p-4 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-400"
                >
                  Waiting for player...
                </div>
              ))}
            </div>
          </div>

          {/* Settings panel */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Game Settings
            </h3>
            
            {showSettings && isHost && gameConfig ? (
              <SettingsPanel config={gameConfig} onUpdate={onUpdateConfig} />
            ) : (
              <SettingsDisplay config={gameConfig} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({ config, onUpdate }: { config: GameConfig; onUpdate: (c: Partial<GameConfig>) => void }) {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <label className="font-medium flex items-center gap-2">
          <Target className="w-4 h-4" />
          Total Seats
        </label>
        <input
          type="number"
          value={config.totalSeats}
          onChange={e => onUpdate({ totalSeats: parseInt(e.target.value) || 50 })}
          className="w-full mt-1 px-3 py-2 border rounded-lg"
          min={20}
          max={200}
        />
      </div>
      
      <div>
        <label className="font-medium flex items-center gap-2">
          <Brain className="w-4 h-4" />
          Ideology Mode
        </label>
        <select
          value={config.ideologyMode}
          onChange={e => onUpdate({ ideologyMode: e.target.value as any })}
          className="w-full mt-1 px-3 py-2 border rounded-lg"
        >
          <option value="derived">Derived (from actions)</option>
          <option value="choose">Player Choice</option>
          <option value="random">Random Assignment</option>
        </select>
      </div>
      
      <div className="flex items-center justify-between">
        <label className="font-medium flex items-center gap-2">
          <GitMerge className="w-4 h-4" />
          Negotiation Phase
        </label>
        <input
          type="checkbox"
          checked={config.enableNegotiation}
          onChange={e => onUpdate({ enableNegotiation: e.target.checked })}
          className="w-5 h-5 rounded"
        />
      </div>
      
      <div className="flex items-center justify-between">
        <label className="font-medium flex items-center gap-2">
          <Target className="w-4 h-4" />
          Seat Targeting
        </label>
        <input
          type="checkbox"
          checked={config.enableSeatTargeting}
          onChange={e => onUpdate({ 
            enableSeatTargeting: e.target.checked,
            seatTransferRule: e.target.checked ? 'player_choice' : 'from_leader'
          })}
          className="w-5 h-5 rounded"
        />
      </div>
      
      <div className="flex items-center justify-between">
        <label className="font-medium flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Auto-Refill Hand
        </label>
        <input
          type="checkbox"
          checked={config.autoRefillHand}
          onChange={e => onUpdate({ autoRefillHand: e.target.checked })}
          className="w-5 h-5 rounded"
        />
      </div>
      
      <div className="flex items-center justify-between">
        <label className="font-medium">Skip & Replace</label>
        <input
          type="checkbox"
          checked={config.allowSkipReplace}
          onChange={e => onUpdate({ allowSkipReplace: e.target.checked })}
          className="w-5 h-5 rounded"
        />
      </div>
      
      <div>
        <label className="font-medium">Max Rounds (0 = unlimited)</label>
        <input
          type="number"
          value={config.maxRounds || 0}
          onChange={e => onUpdate({ maxRounds: parseInt(e.target.value) || null })}
          className="w-full mt-1 px-3 py-2 border rounded-lg"
          min={0}
          max={50}
        />
      </div>
    </div>
  );
}

function SettingsDisplay({ config }: { config: GameConfig | null }) {
  if (!config) return null;
  
  return (
    <div className="space-y-3 text-sm">
      <div className="flex justify-between">
        <span className="text-gray-500">Total Seats:</span>
        <span className="font-medium">{config.totalSeats}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">Ideology:</span>
        <span className="font-medium capitalize">{config.ideologyMode}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">Negotiation:</span>
        <span className={`font-medium ${config.enableNegotiation ? 'text-green-600' : 'text-gray-400'}`}>
          {config.enableNegotiation ? 'Enabled' : 'Disabled'}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">Seat Targeting:</span>
        <span className={`font-medium ${config.enableSeatTargeting ? 'text-green-600' : 'text-gray-400'}`}>
          {config.enableSeatTargeting ? 'Enabled' : 'Disabled'}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">Auto-Refill:</span>
        <span className={`font-medium ${config.autoRefillHand ? 'text-green-600' : 'text-gray-400'}`}>
          {config.autoRefillHand ? 'On' : 'Off'}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">Skip & Replace:</span>
        <span className={`font-medium ${config.allowSkipReplace ? 'text-green-600' : 'text-gray-400'}`}>
          {config.allowSkipReplace ? 'Allowed' : 'Disabled'}
        </span>
      </div>
    </div>
  );
}
