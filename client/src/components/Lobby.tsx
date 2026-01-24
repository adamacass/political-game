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
  Map,
} from 'lucide-react';

// Design tokens - ballot paper aesthetic
const colors = {
  paper1: '#F4F1E8',
  paper2: '#EEEBE2',
  paper3: '#E8E5DC',
  ink: '#111111',
  inkSecondary: '#3A3A3A',
  rule: '#1A1A1A',
  accent: '#2563EB',  // Keep a subtle accent for interactive elements
};

interface LobbyProps {
  gameState: GameState | null;
  gameConfig: GameConfig | null;
  playerId: string;
  availableColors: PartyColorId[];
  savedGames: Array<{ roomId: string; playerId: string; timestamp: number; version: string }>;
  onStartGame: () => void;
  onUpdateConfig: (config: Partial<GameConfig>) => void;
  onCreateRoom: (playerName: string, partyName: string, colorId?: PartyColorId, social?: SocialIdeology, economic?: EconomicIdeology) => void;
  onJoinRoom: (roomId: string, playerName: string, partyName: string, colorId?: PartyColorId, social?: SocialIdeology, economic?: EconomicIdeology) => void;
  onResumeGame: (roomId: string, playerId: string) => void;
}

export function Lobby({
  gameState,
  gameConfig,
  playerId,
  availableColors,
  savedGames,
  onStartGame,
  onUpdateConfig,
  onCreateRoom,
  onJoinRoom,
  onResumeGame,
}: LobbyProps) {
  const [mode, setMode] = useState<'choose' | 'create' | 'join' | 'resume'>('choose');
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

  // Input styling - ballot paper style
  const inputStyle = {
    backgroundColor: colors.paper1,
    border: `1px solid ${colors.rule}`,
    color: colors.ink,
  };

  // Mode selection screen
  if (mode === 'choose') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: colors.paper2 }}>
        <div className="rounded-lg p-8 w-full max-w-md paper-texture" style={{ backgroundColor: colors.paper1, border: `2px solid ${colors.rule}` }}>
          <h1 className="text-3xl font-bold text-center mb-2" style={{ color: colors.ink }}>Political Game</h1>
          <p className="text-center mb-8" style={{ color: colors.inkSecondary }}>Compete for seats in parliament</p>

          <div className="space-y-4">
            <button
              onClick={() => setMode('create')}
              className="w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all hover:opacity-90"
              style={{ backgroundColor: colors.ink, color: colors.paper1, border: `2px solid ${colors.rule}` }}
            >
              Create New Game
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all hover:opacity-90"
              style={{ backgroundColor: colors.paper2, color: colors.ink, border: `2px solid ${colors.rule}` }}
            >
              Join Existing Game
            </button>
            {savedGames.length > 0 && (
              <button
                onClick={() => setMode('resume')}
                className="w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all hover:opacity-90"
                style={{ backgroundColor: colors.paper3, color: colors.ink, border: `2px dashed ${colors.rule}` }}
              >
                Resume Saved Game
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'resume') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: colors.paper2 }}>
        <div className="rounded-lg p-8 w-full max-w-md paper-texture" style={{ backgroundColor: colors.paper1, border: `2px solid ${colors.rule}` }}>
          <button
            onClick={() => setMode('choose')}
            className="mb-4 hover:opacity-70"
            style={{ color: colors.inkSecondary }}
          >
            &larr; Back
          </button>
          <h2 className="text-2xl font-bold mb-6" style={{ color: colors.ink }}>
            Resume Saved Game
          </h2>
          <div className="space-y-3">
            {savedGames.map(saved => (
              <button
                key={`${saved.roomId}-${saved.playerId}`}
                onClick={() => onResumeGame(saved.roomId, saved.playerId)}
                className="w-full p-4 rounded-lg flex items-center justify-between hover:opacity-90 transition-colors"
                style={{ backgroundColor: colors.paper2, border: `1px solid ${colors.rule}` }}
              >
                <div className="text-left">
                  <div className="font-semibold" style={{ color: colors.ink }}>
                    Room {saved.roomId}
                  </div>
                  <div className="text-xs" style={{ color: colors.inkSecondary }}>
                    Saved {new Date(saved.timestamp).toLocaleString()}
                  </div>
                </div>
                <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: colors.paper3, color: colors.ink }}>
                  v{saved.version}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Create/Join form
  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: colors.paper2 }}>
        <div className="rounded-lg p-8 w-full max-w-md paper-texture" style={{ backgroundColor: colors.paper1, border: `2px solid ${colors.rule}` }}>
          <button
            onClick={() => setMode('choose')}
            className="mb-4 hover:opacity-70"
            style={{ color: colors.inkSecondary }}
          >
            &larr; Back
          </button>

          <h2 className="text-2xl font-bold mb-6" style={{ color: colors.ink }}>
            {mode === 'create' ? 'Create Game' : 'Join Game'}
          </h2>

          <div className="space-y-4">
            {mode === 'join' && (
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: colors.inkSecondary }}>Room Code</label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={e => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="Enter 6-letter code"
                  className="w-full px-4 py-3 rounded-lg uppercase font-mono text-xl tracking-wider focus:outline-none focus:ring-2"
                  style={{ ...inputStyle, '--tw-ring-color': colors.ink } as any}
                  maxLength={6}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.inkSecondary }}>Your Name</label>
              <input
                type="text"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="John"
                className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2"
                style={inputStyle}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.inkSecondary }}>Party Name</label>
              <input
                type="text"
                value={partyName}
                onChange={e => setPartyName(e.target.value)}
                placeholder="Progressive Alliance"
                className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2"
                style={inputStyle}
              />
            </div>

            {/* Color picker */}
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-2" style={{ color: colors.inkSecondary }}>
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
                          ? 'ring-4 ring-offset-2 scale-110'
                          : isAvailable
                          ? 'hover:scale-105'
                          : 'opacity-30 cursor-not-allowed'
                      }`}
                      style={{
                        backgroundColor: color.hex,
                        border: `2px solid ${colors.rule}`,
                        '--tw-ring-color': colors.ink,
                        '--tw-ring-offset-color': colors.paper1,
                      } as any}
                      title={color.name}
                    />
                  );
                })}
              </div>
            </div>

            <button
              onClick={mode === 'create' ? handleCreate : handleJoin}
              disabled={!playerName.trim() || !partyName.trim() || (mode === 'join' && !roomCode.trim())}
              className="w-full py-4 rounded-lg font-semibold text-lg transition-colors disabled:opacity-40"
              style={{ backgroundColor: colors.ink, color: colors.paper1, border: `2px solid ${colors.rule}` }}
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
    <div className="min-h-screen p-4" style={{ backgroundColor: colors.paper2 }}>
      <div className="max-w-4xl mx-auto">
        {/* Room header */}
        <div className="rounded-lg p-6 mb-6" style={{ backgroundColor: colors.paper1, border: `2px solid ${colors.rule}` }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm" style={{ color: colors.inkSecondary }}>Room Code</div>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-mono font-bold tracking-wider" style={{ color: colors.ink }}>{gameState.roomId}</span>
                <button
                  onClick={copyRoomCode}
                  className="p-2 rounded-lg transition-colors hover:opacity-70"
                  title="Copy room code"
                >
                  {copied ? <Check className="w-5 h-5" style={{ color: '#16a34a' }} /> : <Copy className="w-5 h-5" style={{ color: colors.inkSecondary }} />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isHost && (
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-3 rounded-lg transition-colors"
                  style={{
                    backgroundColor: showSettings ? colors.paper3 : colors.paper2,
                    border: `1px solid ${colors.rule}`,
                    color: colors.ink
                  }}
                >
                  <Settings className="w-5 h-5" />
                </button>
              )}

              {isHost && (
                <button
                  onClick={onStartGame}
                  disabled={gameState.players.length < 2}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-40"
                  style={{ backgroundColor: colors.ink, color: colors.paper1, border: `2px solid ${colors.rule}` }}
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
          <div className="lg:col-span-2 rounded-lg p-6" style={{ backgroundColor: colors.paper1, border: `2px solid ${colors.rule}` }}>
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2" style={{ color: colors.ink }}>
              <Users className="w-5 h-5" />
              Players ({gameState.players.length}/5)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {gameState.players.map((player, idx) => (
                <div
                  key={player.id}
                  className="p-4 rounded-lg"
                  style={{
                    backgroundColor: player.id === playerId ? colors.paper3 : colors.paper2,
                    border: `2px solid ${colors.rule}`
                  }}
                >
                  <div className="flex items-center gap-3">
                    {/* Party color stripe on left */}
                    <div
                      className="w-1 h-12 rounded-full"
                      style={{ backgroundColor: player.color }}
                    />
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg"
                      style={{ backgroundColor: player.color, color: '#fff', border: `2px solid ${colors.rule}` }}
                    >
                      {player.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold" style={{ color: colors.ink }}>{player.name}</div>
                      <div className="text-sm" style={{ color: colors.inkSecondary }}>{player.playerName}</div>
                    </div>
                    {idx === 0 && (
                      <span className="px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1"
                        style={{ backgroundColor: colors.paper1, color: colors.ink, border: `1px solid ${colors.rule}` }}>
                        <Star className="w-3 h-3" /> Host
                      </span>
                    )}
                  </div>

                  {gameConfig?.ideologyMode !== 'derived' && (
                    <div className="mt-3 text-xs" style={{ color: colors.inkSecondary }}>
                      <span>Ideology: </span>
                      <span className="font-medium capitalize" style={{ color: colors.ink }}>
                        {player.socialIdeology} / {player.economicIdeology}
                      </span>
                    </div>
                  )}
                </div>
              ))}

              {/* Empty slots */}
              {Array.from({ length: 5 - gameState.players.length }).map((_, idx) => (
                <div
                  key={`empty-${idx}`}
                  className="p-4 rounded-lg flex items-center justify-center"
                  style={{
                    backgroundColor: colors.paper2,
                    border: `2px dashed ${colors.inkSecondary}`,
                    color: colors.inkSecondary
                  }}
                >
                  Waiting for player...
                </div>
              ))}
            </div>
          </div>

          {/* Settings panel */}
          <div className="rounded-lg p-6" style={{ backgroundColor: colors.paper1, border: `2px solid ${colors.rule}` }}>
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2" style={{ color: colors.ink }}>
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
  const inputStyle = {
    backgroundColor: colors.paper2,
    border: `1px solid ${colors.rule}`,
    color: colors.ink,
  };

  return (
    <div className="space-y-4 text-sm">
      <div>
        <label className="font-medium flex items-center gap-2" style={{ color: colors.ink }}>
          <Target className="w-4 h-4" />
          Total Seats
        </label>
        <input
          type="number"
          value={config.totalSeats}
          onChange={e => onUpdate({ totalSeats: parseInt(e.target.value) || 50 })}
          className="w-full mt-1 px-3 py-2 rounded-lg focus:outline-none"
          style={inputStyle}
          min={20}
          max={200}
        />
      </div>

      <div>
        <label className="font-medium flex items-center gap-2" style={{ color: colors.ink }}>
          <Brain className="w-4 h-4" />
          Ideology Mode
        </label>
        <select
          value={config.ideologyMode}
          onChange={e => onUpdate({ ideologyMode: e.target.value as any })}
          className="w-full mt-1 px-3 py-2 rounded-lg focus:outline-none"
          style={inputStyle}
        >
          <option value="derived">Derived (from actions)</option>
          <option value="choose">Player Choice</option>
          <option value="random">Random Assignment</option>
        </select>
      </div>

      <div>
        <label className="font-medium flex items-center gap-2" style={{ color: colors.ink }}>
          <Map className="w-4 h-4" />
          Seat Ideology Distribution
        </label>
        <select
          value={config.seatIdeologyMode || 'random'}
          onChange={e => onUpdate({ seatIdeologyMode: e.target.value as 'random' | 'realistic' })}
          className="w-full mt-1 px-3 py-2 rounded-lg focus:outline-none"
          style={inputStyle}
        >
          <option value="random">Random (grouped by state)</option>
          <option value="realistic">Realistic (voting patterns)</option>
        </select>
        <p className="text-xs mt-1" style={{ color: colors.inkSecondary }}>
          {config.seatIdeologyMode === 'realistic'
            ? 'Inner city = progressive, rural = conservative'
            : 'Randomly distributed with state-based grouping'}
        </p>
      </div>

      <div className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${colors.paper3}` }}>
        <label className="font-medium flex items-center gap-2" style={{ color: colors.ink }}>
          <GitMerge className="w-4 h-4" />
          Negotiation Phase
        </label>
        <input
          type="checkbox"
          checked={config.enableNegotiation}
          onChange={e => onUpdate({ enableNegotiation: e.target.checked })}
          className="w-5 h-5 rounded-lg"
          style={{ accentColor: colors.ink }}
        />
      </div>

      <div className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${colors.paper3}` }}>
        <label className="font-medium flex items-center gap-2" style={{ color: colors.ink }}>
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
          className="w-5 h-5 rounded-lg"
          style={{ accentColor: colors.ink }}
        />
      </div>

      <div className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${colors.paper3}` }}>
        <label className="font-medium flex items-center gap-2" style={{ color: colors.ink }}>
          <RefreshCw className="w-4 h-4" />
          Auto-Refill Hand
        </label>
        <input
          type="checkbox"
          checked={config.autoRefillHand}
          onChange={e => onUpdate({ autoRefillHand: e.target.checked })}
          className="w-5 h-5 rounded-lg"
          style={{ accentColor: colors.ink }}
        />
      </div>

      <div className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${colors.paper3}` }}>
        <label className="font-medium" style={{ color: colors.ink }}>Skip & Replace</label>
        <input
          type="checkbox"
          checked={config.allowSkipReplace}
          onChange={e => onUpdate({ allowSkipReplace: e.target.checked })}
          className="w-5 h-5 rounded-lg"
          style={{ accentColor: colors.ink }}
        />
      </div>

      <div>
        <label className="font-medium" style={{ color: colors.ink }}>Max Rounds (0 = unlimited)</label>
        <input
          type="number"
          value={config.maxRounds || 0}
          onChange={e => onUpdate({ maxRounds: parseInt(e.target.value) || null })}
          className="w-full mt-1 px-3 py-2 rounded-lg focus:outline-none"
          style={inputStyle}
          min={0}
          max={50}
        />
      </div>
    </div>
  );
}

function SettingsDisplay({ config }: { config: GameConfig | null }) {
  if (!config) return null;

  const rowStyle = { borderBottom: `1px solid ${colors.paper3}` };

  return (
    <div className="space-y-3 text-sm">
      <div className="flex justify-between py-2" style={rowStyle}>
        <span style={{ color: colors.inkSecondary }}>Total Seats:</span>
        <span className="font-medium" style={{ color: colors.ink }}>{config.totalSeats}</span>
      </div>
      <div className="flex justify-between py-2" style={rowStyle}>
        <span style={{ color: colors.inkSecondary }}>Ideology:</span>
        <span className="font-medium capitalize" style={{ color: colors.ink }}>{config.ideologyMode}</span>
      </div>
      <div className="flex justify-between py-2" style={rowStyle}>
        <span style={{ color: colors.inkSecondary }}>Seat Distribution:</span>
        <span className="font-medium capitalize" style={{ color: colors.ink }}>{config.seatIdeologyMode || 'random'}</span>
      </div>
      <div className="flex justify-between py-2" style={rowStyle}>
        <span style={{ color: colors.inkSecondary }}>Negotiation:</span>
        <span className="font-medium" style={{ color: config.enableNegotiation ? colors.ink : colors.inkSecondary }}>
          {config.enableNegotiation ? 'Enabled' : 'Disabled'}
        </span>
      </div>
      <div className="flex justify-between py-2" style={rowStyle}>
        <span style={{ color: colors.inkSecondary }}>Seat Targeting:</span>
        <span className="font-medium" style={{ color: config.enableSeatTargeting ? colors.ink : colors.inkSecondary }}>
          {config.enableSeatTargeting ? 'Enabled' : 'Disabled'}
        </span>
      </div>
      <div className="flex justify-between py-2" style={rowStyle}>
        <span style={{ color: colors.inkSecondary }}>Auto-Refill:</span>
        <span className="font-medium" style={{ color: config.autoRefillHand ? colors.ink : colors.inkSecondary }}>
          {config.autoRefillHand ? 'On' : 'Off'}
        </span>
      </div>
      <div className="flex justify-between py-2">
        <span style={{ color: colors.inkSecondary }}>Skip & Replace:</span>
        <span className="font-medium" style={{ color: config.allowSkipReplace ? colors.ink : colors.inkSecondary }}>
          {config.allowSkipReplace ? 'Allowed' : 'Disabled'}
        </span>
      </div>
    </div>
  );
}
