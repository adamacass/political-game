import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { roomManager } from './rooms/RoomManager';
import { loadCardData } from './config/loader';
import { ClientToServerEvents, ServerToClientEvents, ChatMessage, PARTY_COLORS } from './types';

const app = express();
const httpServer = createServer(app);

const corsOptions = {
  origin: process.env.CLIENT_URL || ['http://localhost:5173', 'http://localhost:3000'],
  methods: ['GET', 'POST'],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: corsOptions,
  pingTimeout: 60000,
  pingInterval: 25000,
});

const configDir = process.env.CONFIG_DIR || path.join(__dirname, '../../config');
loadCardData(configDir);

// REST endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', rooms: roomManager.getRoomCount() });
});

app.get('/api/rooms', (req, res) => {
  res.json(roomManager.getRoomList());
});

app.get('/api/colors', (req, res) => {
  res.json(PARTY_COLORS);
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
  });
}

// Socket.IO
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  let currentRoomId: string | null = null;
  let currentPlayerId: string | null = null;

  const broadcastState = (roomId: string) => {
    try {
      const state = roomManager.getState(roomId);
      const config = roomManager.getConfig(roomId);
      if (state && config) {
        io.to(roomId).emit('state_update', { state, config });
      }
    } catch (error) {
      console.error('Error broadcasting state:', error);
    }
  };

  // Create room
  socket.on('create_room', ({ playerName, partyName, colorId, configOverrides, socialIdeology, economicIdeology }) => {
    try {
      const roomId = roomManager.createRoom(configOverrides);
      const result = roomManager.joinRoom(roomId, socket.id, playerName, partyName, colorId, socialIdeology, economicIdeology);
      
      if (result.success && result.playerId) {
        currentRoomId = roomId;
        currentPlayerId = result.playerId;
        socket.join(roomId);
        socket.emit('room_created', { roomId });
        socket.emit('room_joined', { roomId, playerId: result.playerId });
        socket.emit('available_colors', { colors: roomManager.getAvailableColors(roomId) });
        broadcastState(roomId);
      } else {
        socket.emit('error', { message: result.error || 'Failed to create room' });
      }
    } catch (error) {
      console.error('Error creating room:', error);
      socket.emit('error', { message: 'Server error creating room' });
    }
  });

  // Join room
  socket.on('join_room', ({ roomId, playerName, partyName, colorId, socialIdeology, economicIdeology }) => {
    try {
      const result = roomManager.joinRoom(roomId, socket.id, playerName, partyName, colorId, socialIdeology, economicIdeology);
      
      if (result.success && result.playerId) {
        currentRoomId = roomId.toUpperCase();
        currentPlayerId = result.playerId;
        socket.join(currentRoomId);
        socket.emit('room_joined', { roomId: currentRoomId, playerId: result.playerId });
        
        // Notify all clients of updated available colors
        const availableColors = roomManager.getAvailableColors(currentRoomId);
        io.to(currentRoomId).emit('available_colors', { colors: availableColors });
        
        broadcastState(currentRoomId);
      } else {
        socket.emit('error', { message: result.error || 'Failed to join room' });
      }
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Server error joining room' });
    }
  });

  // Start game
  socket.on('start_game', () => {
    if (!currentRoomId) {
      socket.emit('error', { message: 'Not in a room' });
      return;
    }

    try {
      const success = roomManager.startGame(currentRoomId);
      if (success) {
        broadcastState(currentRoomId);
      } else {
        socket.emit('error', { message: 'Cannot start game (need at least 2 players)' });
      }
    } catch (error) {
      console.error('Error starting game:', error);
      socket.emit('error', { message: 'Server error starting game' });
    }
  });

  // Draw card
  socket.on('draw_card', ({ deckType }) => {
    if (!currentRoomId || !currentPlayerId) {
      socket.emit('error', { message: 'Not in a game' });
      return;
    }

    try {
      const success = roomManager.drawCard(currentRoomId, currentPlayerId, deckType);
      if (success) {
        broadcastState(currentRoomId);
      } else {
        socket.emit('error', { message: 'Cannot draw card' });
      }
    } catch (error) {
      console.error('Error drawing card:', error);
      socket.emit('error', { message: 'Server error' });
    }
  });

  // Play campaign card
  socket.on('play_campaign', ({ cardId }) => {
    if (!currentRoomId || !currentPlayerId) {
      socket.emit('error', { message: 'Not in a game' });
      return;
    }

    try {
      const success = roomManager.playCampaignCard(currentRoomId, currentPlayerId, cardId);
      if (success) {
        broadcastState(currentRoomId);
      } else {
        socket.emit('error', { message: 'Cannot play card' });
      }
    } catch (error) {
      console.error('Error playing card:', error);
      socket.emit('error', { message: 'Server error' });
    }
  });

  // Select campaign target
  socket.on('select_campaign_target', ({ targetPlayerId }) => {
    if (!currentRoomId || !currentPlayerId) {
      socket.emit('error', { message: 'Not in a game' });
      return;
    }

    try {
      const success = roomManager.selectCampaignTarget(currentRoomId, currentPlayerId, targetPlayerId);
      if (success) {
        broadcastState(currentRoomId);
      } else {
        socket.emit('error', { message: 'Cannot select target' });
      }
    } catch (error) {
      console.error('Error selecting target:', error);
      socket.emit('error', { message: 'Server error' });
    }
  });

  // Skip campaign
  socket.on('skip_campaign', () => {
    if (!currentRoomId || !currentPlayerId) {
      socket.emit('error', { message: 'Not in a game' });
      return;
    }

    try {
      const success = roomManager.skipCampaign(currentRoomId, currentPlayerId);
      if (success) {
        broadcastState(currentRoomId);
      } else {
        socket.emit('error', { message: 'Cannot skip' });
      }
    } catch (error) {
      console.error('Error:', error);
      socket.emit('error', { message: 'Server error' });
    }
  });

  // Skip and replace card
  socket.on('skip_and_replace', ({ cardId }) => {
    if (!currentRoomId || !currentPlayerId) {
      socket.emit('error', { message: 'Not in a game' });
      return;
    }

    try {
      const success = roomManager.skipAndReplace(currentRoomId, currentPlayerId, cardId);
      if (success) {
        broadcastState(currentRoomId);
      } else {
        socket.emit('error', { message: 'Cannot replace card' });
      }
    } catch (error) {
      console.error('Error:', error);
      socket.emit('error', { message: 'Server error' });
    }
  });

  // Propose policy
  socket.on('propose_policy', ({ cardId }) => {
    if (!currentRoomId || !currentPlayerId) {
      socket.emit('error', { message: 'Not in a game' });
      return;
    }

    try {
      const success = roomManager.proposePolicy(currentRoomId, currentPlayerId, cardId);
      if (success) {
        broadcastState(currentRoomId);
      } else {
        socket.emit('error', { message: 'Cannot propose policy' });
      }
    } catch (error) {
      console.error('Error:', error);
      socket.emit('error', { message: 'Server error' });
    }
  });

  // Skip proposal
  socket.on('skip_proposal', () => {
    if (!currentRoomId || !currentPlayerId) {
      socket.emit('error', { message: 'Not in a game' });
      return;
    }

    try {
      const success = roomManager.skipProposal(currentRoomId, currentPlayerId);
      if (success) {
        broadcastState(currentRoomId);
      } else {
        socket.emit('error', { message: 'Cannot skip proposal' });
      }
    } catch (error) {
      console.error('Error:', error);
      socket.emit('error', { message: 'Server error' });
    }
  });

  // Cast vote
  socket.on('cast_vote', ({ vote }) => {
    if (!currentRoomId || !currentPlayerId) {
      socket.emit('error', { message: 'Not in a game' });
      return;
    }

    try {
      const success = roomManager.castVote(currentRoomId, currentPlayerId, vote);
      if (success) {
        broadcastState(currentRoomId);
      } else {
        socket.emit('error', { message: 'Cannot vote' });
      }
    } catch (error) {
      console.error('Error:', error);
      socket.emit('error', { message: 'Server error' });
    }
  });

  // Acknowledge wildcard
  socket.on('acknowledge_wildcard', () => {
    if (!currentRoomId || !currentPlayerId) {
      socket.emit('error', { message: 'Not in a game' });
      return;
    }

    try {
      const success = roomManager.acknowledgeWildcard(currentRoomId, currentPlayerId);
      if (success) {
        broadcastState(currentRoomId);
      } else {
        socket.emit('error', { message: 'Cannot acknowledge' });
      }
    } catch (error) {
      console.error('Error:', error);
      socket.emit('error', { message: 'Server error' });
    }
  });

  // Adjust issue
  socket.on('adjust_issue', ({ direction }) => {
    if (!currentRoomId || !currentPlayerId) {
      socket.emit('error', { message: 'Not in a game' });
      return;
    }

    try {
      const success = roomManager.adjustIssue(currentRoomId, currentPlayerId, direction);
      if (success) {
        broadcastState(currentRoomId);
      } else {
        socket.emit('error', { message: 'Cannot adjust issue' });
      }
    } catch (error) {
      console.error('Error:', error);
      socket.emit('error', { message: 'Server error' });
    }
  });

  // NEGOTIATION HANDLERS

  socket.on('make_trade_offer', ({ toPlayerId, offeredCardIds, requestedCardIds }) => {
    if (!currentRoomId || !currentPlayerId) {
      socket.emit('error', { message: 'Not in a game' });
      return;
    }

    try {
      const offer = roomManager.makeTradeOffer(
        currentRoomId, 
        currentPlayerId, 
        toPlayerId, 
        offeredCardIds, 
        requestedCardIds
      );
      if (offer) {
        // Notify the recipient
        const recipientSocketId = roomManager.getSocketIdForPlayer(currentRoomId, toPlayerId);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('trade_offer_received', { offer });
        }
        broadcastState(currentRoomId);
      } else {
        socket.emit('error', { message: 'Cannot make offer' });
      }
    } catch (error) {
      console.error('Error:', error);
      socket.emit('error', { message: 'Server error' });
    }
  });

  socket.on('respond_to_offer', ({ offerId, accept }) => {
    if (!currentRoomId || !currentPlayerId) {
      socket.emit('error', { message: 'Not in a game' });
      return;
    }

    try {
      const success = roomManager.respondToOffer(currentRoomId, currentPlayerId, offerId, accept);
      if (success) {
        broadcastState(currentRoomId);
      } else {
        socket.emit('error', { message: 'Cannot respond to offer' });
      }
    } catch (error) {
      console.error('Error:', error);
      socket.emit('error', { message: 'Server error' });
    }
  });

  socket.on('cancel_offer', ({ offerId }) => {
    if (!currentRoomId || !currentPlayerId) {
      socket.emit('error', { message: 'Not in a game' });
      return;
    }

    try {
      const success = roomManager.cancelOffer(currentRoomId, currentPlayerId, offerId);
      if (success) {
        broadcastState(currentRoomId);
      } else {
        socket.emit('error', { message: 'Cannot cancel offer' });
      }
    } catch (error) {
      console.error('Error:', error);
      socket.emit('error', { message: 'Server error' });
    }
  });

  socket.on('negotiation_ready', () => {
    if (!currentRoomId || !currentPlayerId) {
      socket.emit('error', { message: 'Not in a game' });
      return;
    }

    try {
      const success = roomManager.markNegotiationReady(currentRoomId, currentPlayerId);
      if (success) {
        broadcastState(currentRoomId);
      } else {
        socket.emit('error', { message: 'Cannot mark ready' });
      }
    } catch (error) {
      console.error('Error:', error);
      socket.emit('error', { message: 'Server error' });
    }
  });

  // Update config
  socket.on('update_config', ({ config }) => {
    if (!currentRoomId) {
      socket.emit('error', { message: 'Not in a room' });
      return;
    }

    try {
      const success = roomManager.updateConfig(currentRoomId, config);
      if (success) {
        broadcastState(currentRoomId);
      } else {
        socket.emit('error', { message: 'Cannot update config' });
      }
    } catch (error) {
      console.error('Error:', error);
      socket.emit('error', { message: 'Server error' });
    }
  });

  // Request state
  socket.on('request_state', () => {
    if (!currentRoomId) {
      socket.emit('error', { message: 'Not in a room' });
      return;
    }

    try {
      const state = roomManager.getState(currentRoomId);
      const config = roomManager.getConfig(currentRoomId);
      if (state && config) {
        socket.emit('state_update', { state, config });
        socket.emit('available_colors', { colors: roomManager.getAvailableColors(currentRoomId) });
      }
    } catch (error) {
      console.error('Error:', error);
    }
  });

  // Export game
  socket.on('export_game', () => {
    if (!currentRoomId) {
      socket.emit('error', { message: 'Not in a room' });
      return;
    }

    try {
      const eventLog = roomManager.getEventLog(currentRoomId);
      const config = roomManager.getConfig(currentRoomId);
      const state = roomManager.getState(currentRoomId);
      const gameLog = roomManager.getGameLog(currentRoomId);
      const gameLogCsv = roomManager.getGameLogCsv(currentRoomId);
      
      if (eventLog && config && state) {
        socket.emit('game_exported', { 
          eventLog, 
          config, 
          seed: state.seed,
          chatLog: state.chatMessages || [],
          history: state.history || [],
          gameLog: gameLog || [],
          gameLogCsv: gameLogCsv || ''
        });
      }
    } catch (error) {
      console.error('Error:', error);
      socket.emit('error', { message: 'Server error' });
    }
  });

  // Chat
  socket.on('send_chat', ({ content, recipientId }) => {
    if (!currentRoomId || !currentPlayerId) {
      socket.emit('error', { message: 'Not in a room' });
      return;
    }

    try {
      const state = roomManager.getState(currentRoomId);
      if (!state) return;

      const sender = state.players.find(p => p.id === currentPlayerId);
      if (!sender) return;

      const message: ChatMessage = {
        id: uuidv4(),
        senderId: currentPlayerId,
        senderName: sender.name,
        recipientId: recipientId,
        content: content.substring(0, 500),
        timestamp: Date.now(),
        isPrivate: recipientId !== null
      };

      roomManager.addChatMessage(currentRoomId, message);

      if (recipientId) {
        const recipientSocketId = roomManager.getSocketIdForPlayer(currentRoomId, recipientId);
        socket.emit('chat_message', { message });
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('chat_message', { message });
        }
      } else {
        io.to(currentRoomId).emit('chat_message', { message });
      }
    } catch (error) {
      console.error('Error sending chat:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('restore_session', ({ roomId, playerId }) => {
    if (!roomId || !playerId) {
      socket.emit('error', { message: 'Missing restore details' });
      return;
    }
    try {
      const restored = roomManager.restoreSession(roomId, playerId, socket.id);
      if (!restored) {
        socket.emit('error', { message: 'Unable to restore session' });
        return;
      }
      currentRoomId = roomId.toUpperCase();
      currentPlayerId = playerId;
      socket.join(currentRoomId);
      socket.emit('session_restored', { success: true, roomId: currentRoomId, playerId });
      socket.emit('available_colors', { colors: roomManager.getAvailableColors(currentRoomId) });
      broadcastState(currentRoomId);
    } catch (error) {
      console.error('Error restoring session:', error);
      socket.emit('error', { message: 'Server error' });
    }
  });
  // ... your existing handlers above ...

  socket.on('cast_vote', ({ vote }) => {
    // ... existing code ...
  });

  // =====================
  // ADD THESE NEW ONES HERE:
  // =====================

// Agenda selection
  socket.on('select_new_agenda', ({ issue }) => {
    if (!currentRoomId || !currentPlayerId) {
      socket.emit('error', { message: 'Not in a room' });
      return;
    }
    try {
      const success = roomManager.selectNewAgenda(currentRoomId, currentPlayerId, issue);
      if (success) {
        broadcastState(currentRoomId);
      } else {
        socket.emit('error', { message: 'Cannot select agenda' });
      }
    } catch (error) {
      console.error('Error selecting agenda:', error);
      socket.emit('error', { message: 'Server error' });
    }
  });

  // Force advance phase (host only)
  socket.on('force_advance_phase', () => {
    if (!currentRoomId || !currentPlayerId) {
      socket.emit('error', { message: 'Not in a room' });
      return;
    }
    try {
      const success = roomManager.forceAdvancePhase(currentRoomId, currentPlayerId);
      if (success) {
        broadcastState(currentRoomId);
      } else {
        socket.emit('error', { message: 'Cannot advance phase' });
      }
    } catch (error) {
      console.error('Error advancing phase:', error);
      socket.emit('error', { message: 'Server error' });
    }
  });

  // NEW: Resolve seat capture (Australian map)
  socket.on('resolve_capture_seat', ({ seatId }) => {
    if (!currentRoomId || !currentPlayerId) {
      socket.emit('error', { message: 'Not in a room' });
      return;
    }
    try {
      const success = roomManager.resolveCaptureSeat(currentRoomId, currentPlayerId, seatId);
      if (success) {
        broadcastState(currentRoomId);
      } else {
        socket.emit('error', { message: 'Cannot capture seat' });
      }
    } catch (error) {
      console.error('Error capturing seat:', error);
      socket.emit('error', { message: 'Server error' });
    }
  });

  // =====================
  // END OF NEW HANDLERS
  // =====================

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    
    if (currentRoomId && currentPlayerId) {
      try {
        const leftPlayerId = roomManager.leaveRoom(currentRoomId, socket.id);
        if (leftPlayerId) {
          io.to(currentRoomId).emit('player_disconnected', { playerId: leftPlayerId });
          io.to(currentRoomId).emit('available_colors', { colors: roomManager.getAvailableColors(currentRoomId) });
          broadcastState(currentRoomId);
        }
      } catch (error) {
        console.error('Error handling disconnect:', error);
      }
    }
  });
});

// Cleanup
setInterval(() => {
  try {
    const cleaned = roomManager.cleanupStaleRooms();
    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} stale rooms`);
    }
  } catch (error) {
    console.error('Error cleaning up rooms:', error);
  }
}, 60 * 60 * 1000);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export { io, httpServer };
