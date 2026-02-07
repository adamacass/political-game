import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { roomManager } from './rooms/RoomManager';
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
  socket.on('create_room', ({ playerName, partyName, colorId, socialIdeology, economicIdeology, configOverrides }) => {
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

  // Restore session
  socket.on('restore_session', ({ roomId, playerId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        socket.emit('session_restored', { success: false, roomId });
        return;
      }

      const state = roomManager.getState(roomId);
      if (!state) {
        socket.emit('session_restored', { success: false, roomId });
        return;
      }

      const player = state.players.find(p => p.id === playerId);
      if (!player) {
        socket.emit('session_restored', { success: false, roomId });
        return;
      }

      const normalizedRoomId = roomId.toUpperCase();
      currentRoomId = normalizedRoomId;
      currentPlayerId = playerId;
      socket.join(normalizedRoomId);

      socket.emit('session_restored', { success: true, roomId: normalizedRoomId });
      socket.emit('room_joined', { roomId: normalizedRoomId, playerId });
      socket.emit('available_colors', { colors: roomManager.getAvailableColors(normalizedRoomId) });

      broadcastState(normalizedRoomId);
    } catch (error) {
      console.error('Error restoring session:', error);
      socket.emit('session_restored', { success: false, roomId });
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
        socket.emit('error', { message: 'Cannot start game (need at least 1 human player)' });
      }
    } catch (error) {
      console.error('Error starting game:', error);
      socket.emit('error', { message: 'Server error starting game' });
    }
  });

  // Submit policy adjustments (government player)
  socket.on('submit_policy_adjustments', ({ adjustments }) => {
    if (!currentRoomId || !currentPlayerId) {
      socket.emit('error', { message: 'Not in a game' });
      return;
    }

    try {
      const success = roomManager.submitPolicyAdjustments(currentRoomId, currentPlayerId, adjustments);
      if (success) {
        broadcastState(currentRoomId);
      } else {
        socket.emit('error', { message: 'Cannot submit policy adjustments' });
      }
    } catch (error) {
      console.error('Error submitting adjustments:', error);
      socket.emit('error', { message: 'Server error' });
    }
  });

  // Submit actions (opposition players)
  socket.on('submit_actions', ({ actions }) => {
    if (!currentRoomId || !currentPlayerId) {
      socket.emit('error', { message: 'Not in a game' });
      return;
    }

    try {
      const success = roomManager.submitActions(currentRoomId, currentPlayerId, actions);
      if (success) {
        broadcastState(currentRoomId);
      } else {
        socket.emit('error', { message: 'Cannot submit actions' });
      }
    } catch (error) {
      console.error('Error submitting actions:', error);
      socket.emit('error', { message: 'Server error' });
    }
  });

  // Resolve dilemma (government player)
  socket.on('resolve_dilemma', ({ choiceId }) => {
    if (!currentRoomId || !currentPlayerId) {
      socket.emit('error', { message: 'Not in a game' });
      return;
    }

    try {
      const success = roomManager.resolveDilemma(currentRoomId, currentPlayerId, choiceId);
      if (success) {
        broadcastState(currentRoomId);
      } else {
        socket.emit('error', { message: 'Cannot resolve dilemma' });
      }
    } catch (error) {
      console.error('Error resolving dilemma:', error);
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
      console.error('Error updating config:', error);
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
      console.error('Error requesting state:', error);
    }
  });

  // Send chat
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
        isPrivate: recipientId !== null,
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

// Cleanup stale rooms every hour
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
