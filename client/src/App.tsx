import React, { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  GameState, 
  GameConfig, 
  ChatMessage,
  PartyColorId,
  SocialIdeology,
  EconomicIdeology,
  TradeOffer,
} from './types';
import { Lobby } from './components/Lobby';
import { GameBoard } from './components/GameBoard';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);
  const [playerId, setPlayerId] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [availableColors, setAvailableColors] = useState<PartyColorId[]>([]);
  const [error, setError] = useState<string>('');

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setError('');
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    newSocket.on('connect_error', (err) => {
      console.error('Connection error:', err);
      setError('Unable to connect to server');
    });

    newSocket.on('room_created', ({ roomId }) => {
      console.log('Room created:', roomId);
    });

    newSocket.on('room_joined', ({ roomId, playerId: pid }) => {
      console.log('Joined room:', roomId, 'as', pid);
      setPlayerId(pid);
    });

    newSocket.on('state_update', ({ state, config }) => {
      setGameState(state);
      setGameConfig(config);
      
      // Sync chat messages from state
      if (state.chatMessages) {
        setChatMessages(state.chatMessages);
      }
    });

    newSocket.on('chat_message', ({ message }) => {
      setChatMessages(prev => {
        // Avoid duplicates
        if (prev.find(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
    });

    newSocket.on('available_colors', ({ colors }) => {
      setAvailableColors(colors);
    });

    newSocket.on('trade_offer_received', ({ offer }) => {
      // Could show a notification here
      console.log('Trade offer received:', offer);
    });

    newSocket.on('error', ({ message }) => {
      setError(message);
      setTimeout(() => setError(''), 5000);
    });

    newSocket.on('player_disconnected', ({ playerId }) => {
      console.log('Player disconnected:', playerId);
    });

    newSocket.on('player_reconnected', ({ playerId }) => {
      console.log('Player reconnected:', playerId);
    });

    newSocket.on('game_exported', ({ eventLog, config, seed, chatLog, history }) => {
      const exportData = {
        exportedAt: new Date().toISOString(),
        seed,
        config,
        eventLog,
        chatLog,
        history,
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `game-log-${gameState?.roomId || 'unknown'}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  // Actions
  const createRoom = useCallback((
    playerName: string, 
    partyName: string, 
    colorId?: PartyColorId,
    socialIdeology?: SocialIdeology,
    economicIdeology?: EconomicIdeology
  ) => {
    socket?.emit('create_room', { 
      playerName, 
      partyName, 
      colorId,
      socialIdeology,
      economicIdeology,
    });
  }, [socket]);

  const joinRoom = useCallback((
    roomId: string, 
    playerName: string, 
    partyName: string,
    colorId?: PartyColorId,
    socialIdeology?: SocialIdeology,
    economicIdeology?: EconomicIdeology
  ) => {
    socket?.emit('join_room', { 
      roomId, 
      playerName, 
      partyName,
      colorId,
      socialIdeology,
      economicIdeology,
    });
  }, [socket]);

  const startGame = useCallback(() => {
    socket?.emit('start_game');
  }, [socket]);

  const updateConfig = useCallback((config: Partial<GameConfig>) => {
    socket?.emit('update_config', { config });
  }, [socket]);

  const drawCard = useCallback((deckType: 'campaign' | 'policy') => {
    socket?.emit('draw_card', { deckType });
  }, [socket]);

  const playCampaign = useCallback((cardId: string) => {
    socket?.emit('play_campaign', { cardId });
  }, [socket]);

  const selectTarget = useCallback((targetPlayerId: string) => {
    socket?.emit('select_campaign_target', { targetPlayerId });
  }, [socket]);

  const skipCampaign = useCallback(() => {
    socket?.emit('skip_campaign');
  }, [socket]);

  const skipAndReplace = useCallback((cardId: string) => {
    socket?.emit('skip_and_replace', { cardId });
  }, [socket]);

  const proposePolicy = useCallback((cardId: string) => {
    socket?.emit('propose_policy', { cardId });
  }, [socket]);

  const skipProposal = useCallback(() => {
    socket?.emit('skip_proposal');
  }, [socket]);

  const castVote = useCallback((vote: 'yes' | 'no') => {
    socket?.emit('cast_vote', { vote });
  }, [socket]);

  const acknowledgeWildcard = useCallback(() => {
    socket?.emit('acknowledge_wildcard');
  }, [socket]);

  const adjustIssue = useCallback((direction: -1 | 0 | 1) => {
    socket?.emit('adjust_issue', { direction });
  }, [socket]);

  const exportGame = useCallback(() => {
    socket?.emit('export_game');
  }, [socket]);

  const sendChat = useCallback((content: string, recipientId: string | null) => {
    socket?.emit('send_chat', { content, recipientId });
  }, [socket]);

  const makeTradeOffer = useCallback((toPlayerId: string, offeredCardIds: string[], requestedCardIds: string[]) => {
    socket?.emit('make_trade_offer', { toPlayerId, offeredCardIds, requestedCardIds });
  }, [socket]);

  const respondToOffer = useCallback((offerId: string, accept: boolean) => {
    socket?.emit('respond_to_offer', { offerId, accept });
  }, [socket]);

  const cancelOffer = useCallback((offerId: string) => {
    socket?.emit('cancel_offer', { offerId });
  }, [socket]);

  const negotiationReady = useCallback(() => {
    socket?.emit('negotiation_ready');
  }, [socket]);

const selectNewAgenda = useCallback((issue: string) => {
  socket?.emit('select_new_agenda', { issue });
}, [socket]);

const hostSkipCampaign = useCallback(() => {
  socket?.emit('host_skip_campaign');
}, [socket]);

const hostSkipToPolicy = useCallback(() => {
  socket?.emit('host_skip_to_policy');
}, [socket]);

const hostSkipToNextRound = useCallback(() => {
  socket?.emit('host_skip_to_next_round');
}, [socket]);

  // Render
  const isInGame = gameState && gameState.phase !== 'waiting';

  return (
    <div className="min-h-screen bg-gray-100">
      {error && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-red-500 text-white rounded-lg shadow-lg">
          {error}
        </div>
      )}

      {!isInGame ? (
        <Lobby
          gameState={gameState}
          gameConfig={gameConfig}
          playerId={playerId}
          availableColors={availableColors}
          onStartGame={startGame}
          onUpdateConfig={updateConfig}
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
        />
      ) : (
        <GameBoard
          gameState={gameState}
          gameConfig={gameConfig!}
          playerId={playerId}
          chatMessages={chatMessages}
          onDrawCard={drawCard}
          onPlayCampaign={playCampaign}
          onSelectTarget={selectTarget}
          onSkipCampaign={skipCampaign}
          onSkipAndReplace={skipAndReplace}
          onProposePolicy={proposePolicy}
          onSkipProposal={skipProposal}
          onCastVote={castVote}
          onAcknowledgeWildcard={acknowledgeWildcard}
          onExportGame={exportGame}
          onSendChat={sendChat}
          onMakeTradeOffer={makeTradeOffer}
          onRespondToOffer={respondToOffer}
          onCancelOffer={cancelOffer}
          onNegotiationReady={negotiationReady}
	  onSelectNewAgenda={selectNewAgenda}
          onHostSkipCampaign={hostSkipCampaign}
          onHostSkipToPolicy={hostSkipToPolicy}
          onHostSkipToNextRound={hostSkipToNextRound}
        />
      )}
    </div>
  );
}

export default App;
