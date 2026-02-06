import React, { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  GameState,
  GameConfig,
  ChatMessage,
  PartyColorId,
  ActionType,
} from './types';
import { Lobby } from './components/Lobby';
import { GameBoard } from './components/GameBoard';

const SOCKET_URL = import.meta.env.PROD
  ? window.location.origin
  : 'http://localhost:3001';

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);
  const [playerId, setPlayerId] = useState<string>('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [availableColors, setAvailableColors] = useState<PartyColorId[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setError(null);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    newSocket.on('connect_error', (err) => {
      console.error('Connection error:', err);
      setError('Unable to connect to server');
    });

    newSocket.on('room_created', ({ roomId: rid }) => {
      console.log('Room created:', rid);
      setRoomId(rid);
    });

    newSocket.on('room_joined', ({ roomId: rid, playerId: pid }) => {
      console.log('Joined room:', rid, 'as', pid);
      setPlayerId(pid);
      setRoomId(rid);
    });

    newSocket.on('state_update', ({ state, config }) => {
      setGameState(state);
      setGameConfig(config);
    });

    newSocket.on('chat_message', ({ message }: { message: ChatMessage }) => {
      console.log('Chat:', message.senderName, message.content);
    });

    newSocket.on('available_colors', ({ colors }) => {
      setAvailableColors(colors);
    });

    newSocket.on('error', ({ message }) => {
      setError(message);
      setTimeout(() => setError(null), 5000);
    });

    newSocket.on('player_disconnected', ({ playerId: pid }) => {
      console.log('Player disconnected:', pid);
    });

    newSocket.on('player_reconnected', ({ playerId: pid }) => {
      console.log('Player reconnected:', pid);
    });

    newSocket.on('session_restored', ({ success, roomId: rid }) => {
      if (success) {
        console.log('Session restored for room:', rid);
      } else {
        setError('Could not restore saved game session');
      }
    });

    newSocket.on('game_exported', ({ eventLog, config, seed, chatLog, history }) => {
      const exportData = { exportedAt: new Date().toISOString(), seed, config, eventLog, chatLog, history };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `the-house-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    setSocket(newSocket);
    return () => { newSocket.close(); };
  }, []);

  // Session restore
  useEffect(() => {
    if (!socket) return;
    const urlParams = new URLSearchParams(window.location.search);
    const restoreRoomId = urlParams.get('restore');
    if (restoreRoomId) {
      try {
        const savedData = localStorage.getItem(`game_${restoreRoomId}`);
        if (savedData) {
          const parsed = JSON.parse(savedData);
          socket.emit('restore_session', { roomId: restoreRoomId, playerId: parsed.playerId });
        }
      } catch (err) {
        console.error('Failed to restore:', err);
      }
    }
  }, [socket]);

  // Auto-save
  useEffect(() => {
    if (!gameState || !gameState.roomId || gameState.phase === 'waiting') return;
    const interval = setInterval(() => {
      try {
        localStorage.setItem(`game_${gameState.roomId}`, JSON.stringify({ playerId, timestamp: Date.now() }));
      } catch { /* ignore */ }
    }, 30000);
    return () => clearInterval(interval);
  }, [gameState, playerId]);

  // Room actions
  const createRoom = useCallback((
    playerName: string, partyName: string, colorId: string, symbolId: string,
    socialIdeology: string, economicIdeology: string
  ) => {
    socket?.emit('create_room', { playerName, partyName, colorId, symbolId, socialIdeology, economicIdeology });
  }, [socket]);

  const joinRoom = useCallback((
    rid: string, playerName: string, partyName: string, colorId: string,
    symbolId: string, socialIdeology: string, economicIdeology: string
  ) => {
    socket?.emit('join_room', { roomId: rid, playerName, partyName, colorId, symbolId, socialIdeology, economicIdeology });
  }, [socket]);

  const startGame = useCallback(() => { socket?.emit('start_game'); }, [socket]);

  // Game actions
  const performAction = useCallback((
    actionType: ActionType, targetSeatId?: string, targetPlayerId?: string, fundsSpent?: number
  ) => {
    socket?.emit('perform_action', { actionType, targetSeatId, targetPlayerId, fundsSpent });
  }, [socket]);

  const endTurn = useCallback(() => { socket?.emit('end_turn'); }, [socket]);
  const proposeBill = useCallback((billId: string) => { socket?.emit('propose_bill', { billId }); }, [socket]);
  const skipProposal = useCallback(() => { socket?.emit('skip_proposal'); }, [socket]);
  const castVote = useCallback((vote: 'aye' | 'no') => { socket?.emit('cast_vote', { vote }); }, [socket]);
  const acknowledgeEvent = useCallback(() => { socket?.emit('acknowledge_event'); }, [socket]);
  const acknowledgeResult = useCallback(() => { socket?.emit('acknowledge_result'); }, [socket]);
  const sendChat = useCallback((content: string, recipientId: string | null) => {
    socket?.emit('send_chat', { content, recipientId });
  }, [socket]);
  const forceAdvance = useCallback(() => { socket?.emit('force_advance_phase'); }, [socket]);

  const isInGame = gameState && gameState.phase !== 'waiting';

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {error && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 font-mono text-sm"
          style={{ backgroundColor: 'var(--no-red)', color: 'var(--parchment)', border: '1px solid #7f0000' }}>
          {error}
        </div>
      )}

      {!isInGame ? (
        <Lobby
          gameState={gameState}
          playerId={playerId}
          roomId={roomId}
          availableColors={availableColors}
          error={error}
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
          onStartGame={startGame}
        />
      ) : (
        <GameBoard
          gameState={gameState}
          config={gameConfig!}
          playerId={playerId}
          onAction={performAction}
          onEndTurn={endTurn}
          onProposeBill={proposeBill}
          onSkipProposal={skipProposal}
          onCastVote={castVote}
          onAcknowledgeEvent={acknowledgeEvent}
          onAcknowledgeResult={acknowledgeResult}
          onSendChat={sendChat}
          onForceAdvance={forceAdvance}
        />
      )}
    </div>
  );
}

export default App;
