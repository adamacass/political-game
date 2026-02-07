import React, { useState, useEffect } from 'react';
import {
  GameState,
  PARTY_COLORS,
  PartyColorId,
  SocialIdeology,
  EconomicIdeology,
} from '../types';

interface LobbyProps {
  gameState: GameState | null;
  playerId: string;
  roomId: string | null;
  availableColors: PartyColorId[];
  error: string | null;
  onCreateRoom: (
    playerName: string, partyName: string, colorId: string,
    socialIdeology: string, economicIdeology: string,
  ) => void;
  onJoinRoom: (
    roomId: string, playerName: string, partyName: string, colorId: string,
    socialIdeology: string, economicIdeology: string,
  ) => void;
  onStartGame: () => void;
}

export function Lobby({
  gameState,
  playerId,
  roomId,
  availableColors,
  error,
  onCreateRoom,
  onJoinRoom,
  onStartGame,
}: LobbyProps) {
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [playerName, setPlayerName] = useState('');
  const [partyName, setPartyName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [selectedColor, setSelectedColor] = useState<PartyColorId | null>(null);
  const [socialIdeology, setSocialIdeology] = useState<SocialIdeology>('progressive');
  const [economicIdeology, setEconomicIdeology] = useState<EconomicIdeology>('market');
  const [copied, setCopied] = useState(false);

  const isHost = gameState?.players?.[0]?.id === playerId;

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
        selectedColor || '',
        socialIdeology,
        economicIdeology,
      );
    }
  };

  const handleJoin = () => {
    if (playerName.trim() && partyName.trim() && roomCode.trim()) {
      onJoinRoom(
        roomCode.trim().toUpperCase(),
        playerName.trim(),
        partyName.trim(),
        selectedColor || '',
        socialIdeology,
        economicIdeology,
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
      <div className="lobby-bg min-h-screen flex items-center justify-center p-4">
        <div className="lobby-card w-full max-w-md animate-fade-in">
          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="font-display text-4xl tracking-wide" style={{ color: 'var(--brass-gold)' }}>
              THE HOUSE
            </h1>
            <div className="mt-1 font-mono text-xs tracking-widest" style={{ color: 'var(--text-muted)' }}>
              AUSTRALIAN HOUSE OF REPRESENTATIVES
            </div>
            <div className="mt-4 mx-auto w-48" style={{ borderTop: '1px solid var(--brass-dark)' }} />
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setMode('create')}
              className="btn-brass w-full py-4 text-lg font-display tracking-wide"
            >
              Create New Game
            </button>
            <button
              onClick={() => setMode('join')}
              className="btn-green w-full py-4 text-lg font-display tracking-wide"
            >
              Join Existing Game
            </button>
          </div>

          <div className="mt-6 text-center font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
            151 seats &middot; 12 rounds &middot; 2-5 players
          </div>
        </div>
      </div>
    );
  }

  // Create/Join form
  if (!gameState || !gameState.roomId) {
    return (
      <div className="lobby-bg min-h-screen flex items-center justify-center p-4">
        <div className="lobby-card w-full max-w-md animate-fade-in">
          <button
            onClick={() => setMode('choose')}
            className="mb-6 font-mono text-sm hover:opacity-70 transition-opacity"
            style={{ color: 'var(--brass-gold)' }}
          >
            &#8592; Back
          </button>

          <h2 className="font-display text-2xl mb-6" style={{ color: 'var(--parchment)' }}>
            {mode === 'create' ? 'Create Game' : 'Join Game'}
          </h2>

          {error && (
            <div className="mb-4 px-3 py-2 font-mono text-sm" style={{ color: '#ff6b6b', border: '1px solid #7f0000' }}>
              {error}
            </div>
          )}

          <div className="space-y-4">
            {mode === 'join' && (
              <div>
                <label className="block font-mono text-xs mb-1 tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  ROOM CODE
                </label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={e => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="Enter code"
                  className="lobby-input w-full uppercase tracking-widest text-xl"
                  maxLength={6}
                />
              </div>
            )}

            <div>
              <label className="block font-mono text-xs mb-1 tracking-wider" style={{ color: 'var(--text-muted)' }}>
                YOUR NAME
              </label>
              <input
                type="text"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="e.g. John"
                className="lobby-input w-full"
              />
            </div>

            <div>
              <label className="block font-mono text-xs mb-1 tracking-wider" style={{ color: 'var(--text-muted)' }}>
                PARTY NAME
              </label>
              <input
                type="text"
                value={partyName}
                onChange={e => setPartyName(e.target.value)}
                placeholder="e.g. Progressive Alliance"
                className="lobby-input w-full"
              />
            </div>

            {/* Party color picker */}
            <div>
              <label className="block font-mono text-xs mb-2 tracking-wider" style={{ color: 'var(--text-muted)' }}>
                PARTY COLOUR
              </label>
              <div className="flex gap-2 flex-wrap">
                {PARTY_COLORS.map(color => {
                  const isAvailable = availableColors.length === 0 || availableColors.includes(color.id);
                  return (
                    <button
                      key={color.id}
                      onClick={() => isAvailable && setSelectedColor(color.id)}
                      disabled={!isAvailable}
                      className={`color-swatch ${selectedColor === color.id ? 'selected' : ''}`}
                      style={{
                        backgroundColor: color.hex,
                        opacity: isAvailable ? 1 : 0.25,
                        cursor: isAvailable ? 'pointer' : 'not-allowed',
                      }}
                      title={color.name}
                    />
                  );
                })}
              </div>
            </div>

            {/* Ideology pickers */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-mono text-xs mb-1 tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  SOCIAL
                </label>
                <select
                  value={socialIdeology}
                  onChange={e => setSocialIdeology(e.target.value as SocialIdeology)}
                  className="lobby-input w-full text-sm"
                >
                  <option value="progressive">Progressive</option>
                  <option value="conservative">Conservative</option>
                </select>
              </div>
              <div>
                <label className="block font-mono text-xs mb-1 tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  ECONOMIC
                </label>
                <select
                  value={economicIdeology}
                  onChange={e => setEconomicIdeology(e.target.value as EconomicIdeology)}
                  className="lobby-input w-full text-sm"
                >
                  <option value="market">Free Market</option>
                  <option value="interventionist">Interventionist</option>
                </select>
              </div>
            </div>

            <button
              onClick={mode === 'create' ? handleCreate : handleJoin}
              disabled={!playerName.trim() || !partyName.trim() || (mode === 'join' && !roomCode.trim())}
              className="btn-brass w-full py-4 text-lg font-display tracking-wide mt-2 disabled:opacity-40"
            >
              {mode === 'create' ? 'Create Game' : 'Join Game'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Waiting room — in a room, waiting for game to start
  return (
    <div className="lobby-bg min-h-screen p-4">
      <div className="max-w-3xl mx-auto animate-fade-in">
        {/* Room header */}
        <div className="panel-wood p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="font-mono text-xs tracking-wider" style={{ color: 'var(--text-muted)' }}>
                ROOM CODE
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="font-mono text-3xl font-bold tracking-widest" style={{ color: 'var(--brass-gold)' }}>
                  {gameState.roomId}
                </span>
                <button
                  onClick={copyRoomCode}
                  className="font-mono text-xs px-2 py-1 transition-opacity hover:opacity-80"
                  style={{ color: 'var(--text-muted)', border: '1px solid var(--brass-dark)' }}
                  title="Copy room code"
                >
                  {copied ? '&#10003; Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {isHost && (
              <button
                onClick={onStartGame}
                disabled={gameState.players.length < 2}
                className="btn-brass px-8 py-3 text-lg font-display tracking-wide disabled:opacity-40"
              >
                &#9654; Start Game
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 font-mono text-sm" style={{ color: '#ff6b6b', border: '1px solid #7f0000', backgroundColor: 'rgba(127,0,0,0.1)' }}>
            {error}
          </div>
        )}

        {/* Players grid */}
        <div className="panel p-6">
          <h3 className="font-display text-lg mb-4 flex items-center gap-2" style={{ color: 'var(--parchment)' }}>
            Members of Parliament ({gameState.players.length}/5)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {gameState.players.map((player, idx) => (
              <div
                key={player.id}
                className="p-4 rounded"
                style={{
                  backgroundColor: player.id === playerId ? 'rgba(184,134,11,0.08)' : 'rgba(0,0,0,0.15)',
                  border: player.id === playerId
                    ? '1px solid var(--brass-dark)'
                    : '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-10 rounded-sm"
                    style={{ backgroundColor: player.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-sm truncate" style={{ color: 'var(--parchment)' }}>
                      {player.name}
                    </div>
                    <div className="font-mono text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                      {player.playerName}
                    </div>
                  </div>
                  {idx === 0 && (
                    <span className="font-mono text-xs px-2 py-0.5" style={{ color: 'var(--brass-gold)', border: '1px solid var(--brass-dark)' }}>
                      HOST
                    </span>
                  )}
                </div>
                <div className="mt-2 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span className="capitalize">{player.socialIdeology}</span>
                  {' / '}
                  <span className="capitalize">{player.economicIdeology}</span>
                </div>
              </div>
            ))}

            {/* Empty slots */}
            {Array.from({ length: 5 - gameState.players.length }).map((_, idx) => (
              <div
                key={`empty-${idx}`}
                className="p-4 rounded flex items-center justify-center font-mono text-xs"
                style={{
                  border: '1px dashed rgba(184,134,11,0.2)',
                  color: 'var(--text-muted)',
                  minHeight: '80px',
                }}
              >
                Waiting for player...
              </div>
            ))}
          </div>
        </div>

        {/* Game settings summary */}
        <div className="panel p-6 mt-6">
          <h3 className="font-display text-lg mb-3" style={{ color: 'var(--parchment)' }}>
            Standing Orders
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
            <div>
              <div style={{ color: 'var(--text-muted)' }}>Seats</div>
              <div style={{ color: 'var(--parchment)' }}>{gameState.totalSeats}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)' }}>Rounds</div>
              <div style={{ color: 'var(--parchment)' }}>{gameState.totalRounds}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)' }}>Majority</div>
              <div style={{ color: 'var(--parchment)' }}>{Math.ceil(gameState.totalSeats / 2)} seats</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)' }}>Events</div>
              <div style={{ color: 'var(--parchment)' }}>Enabled</div>
            </div>
          </div>
        </div>

        {!isHost && (
          <div className="mt-6 text-center font-mono text-sm" style={{ color: 'var(--text-muted)' }}>
            Waiting for the host to start the game...
          </div>
        )}
      </div>
    </div>
  );
}
