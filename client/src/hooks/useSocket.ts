import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  GameState, 
  GameConfig, 
  GameEvent, 
  ChatMessage,
  SocialIdeology,
  EconomicIdeology 
} from '../types';

const SOCKET_URL = import.meta.env.PROD 
  ? 'https://political-game-1.onrender.com'
  : 'http://localhost:3001';

const socket = io(SOCKET_URL);

interface UseSocketReturn {
  connected: boolean;
  roomId: string | null;
  playerId: string | null;
  gameState: GameState | null;
  gameConfig: GameConfig | null;
  chatMessages: ChatMessage[];
  error: string | null;
  
  // Room actions
  createRoom: (playerName: string, partyName: string, configOverrides?: Partial<GameConfig>, socialIdeology?: SocialIdeology, economicIdeology?: EconomicIdeology) => void;
  joinRoom: (roomId: string, playerName: string, partyName: string, socialIdeology?: SocialIdeology, economicIdeology?: EconomicIdeology) => void;
  
  // Game actions
  startGame: () => void;
  drawCard: (deckType: 'campaign' | 'policy') => void;
  playCampaign: (cardId: string) => void;
  skipCampaign: () => void;
  proposePolicy: (cardId: string) => void;
  skipProposal: () => void;
  castVote: (vote: 'yes' | 'no') => void;
  acknowledgeWildcard: () => void;
  adjustIssue: (direction: -1 | 0 | 1) => void;
  updateConfig: (config: Partial<GameConfig>) => void;
  exportGame: () => void;
  
  // Chat actions
  sendChat: (content: string, recipientId?: string | null) => void;
  
  clearError: () => void;
}

export function useSocket(): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
      setError(null);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('Connection error:', err);
      setError('Failed to connect to server');
    });

    socket.on('room_created', ({ roomId }) => {
      console.log('Room created:', roomId);
      setRoomId(roomId);
    });

    socket.on('room_joined', ({ roomId, playerId }) => {
      console.log('Joined room:', roomId, 'as player:', playerId);
      setRoomId(roomId);
      setPlayerId(playerId);
    });

    socket.on('state_update', ({ state, config }) => {
      setGameState(state);
      setGameConfig(config);
      // Sync chat messages from state
      if (state.chatMessages) {
        setChatMessages(state.chatMessages);
      }
    });

    socket.on('chat_message', ({ message }) => {
      setChatMessages(prev => [...prev, message]);
    });

    socket.on('error', ({ message }) => {
      console.error('Server error:', message);
      setError(message);
    });

    socket.on('game_exported', ({ eventLog, config, seed, chatLog }) => {
      // Create downloadable JSON file
      const exportData = {
        exportedAt: new Date().toISOString(),
        seed,
        config,
        eventLog,
        chatLog,
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `game-log-${roomId || 'unknown'}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });

    socket.on('player_disconnected', ({ playerId }) => {
      console.log('Player disconnected:', playerId);
    });

    socket.on('player_reconnected', ({ playerId }) => {
      console.log('Player reconnected:', playerId);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Room actions
  const createRoom = useCallback((
    playerName: string, 
    partyName: string, 
    configOverrides?: Partial<GameConfig>,
    socialIdeology?: SocialIdeology,
    economicIdeology?: EconomicIdeology
  ) => {
    socketRef.current?.emit('create_room', { 
      playerName, 
      partyName, 
      configOverrides,
      socialIdeology,
      economicIdeology
    });
  }, []);

  const joinRoom = useCallback((
    roomId: string, 
    playerName: string, 
    partyName: string,
    socialIdeology?: SocialIdeology,
    economicIdeology?: EconomicIdeology
  ) => {
    socketRef.current?.emit('join_room', { 
      roomId, 
      playerName, 
      partyName,
      socialIdeology,
      economicIdeology
    });
  }, []);

  // Game actions
  const startGame = useCallback(() => {
    socketRef.current?.emit('start_game');
  }, []);

  const drawCard = useCallback((deckType: 'campaign' | 'policy') => {
    socketRef.current?.emit('draw_card', { deckType });
  }, []);

  const playCampaign = useCallback((cardId: string) => {
    socketRef.current?.emit('play_campaign', { cardId });
  }, []);

  const skipCampaign = useCallback(() => {
    socketRef.current?.emit('skip_campaign');
  }, []);

  const proposePolicy = useCallback((cardId: string) => {
    socketRef.current?.emit('propose_policy', { cardId });
  }, []);

  const skipProposal = useCallback(() => {
    socketRef.current?.emit('skip_proposal');
  }, []);

  const castVote = useCallback((vote: 'yes' | 'no') => {
    socketRef.current?.emit('cast_vote', { vote });
  }, []);

  const acknowledgeWildcard = useCallback(() => {
    socketRef.current?.emit('acknowledge_wildcard');
  }, []);

  const adjustIssue = useCallback((direction: -1 | 0 | 1) => {
    socketRef.current?.emit('adjust_issue', { direction });
  }, []);

  const updateConfig = useCallback((config: Partial<GameConfig>) => {
    socketRef.current?.emit('update_config', { config });
  }, []);

  const exportGame = useCallback(() => {
    socketRef.current?.emit('export_game');
  }, []);

  // Chat actions
  const sendChat = useCallback((content: string, recipientId: string | null = null) => {
    if (content.trim()) {
      socketRef.current?.emit('send_chat', { content: content.trim(), recipientId });
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    connected,
    roomId,
    playerId,
    gameState,
    gameConfig,
    chatMessages,
    error,
    createRoom,
    joinRoom,
    startGame,
    drawCard,
    playCampaign,
    skipCampaign,
    proposePolicy,
    skipProposal,
    castVote,
    acknowledgeWildcard,
    adjustIssue,
    updateConfig,
    exportGame,
    sendChat,
    clearError,
  };
}
