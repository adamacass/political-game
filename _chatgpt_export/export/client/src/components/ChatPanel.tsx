import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Player } from '../types';
import { Send, X, Lock, Globe } from 'lucide-react';

interface ChatPanelProps {
  messages: ChatMessage[];
  players: Player[];
  currentPlayerId: string;
  onSendMessage: (content: string, recipientId: string | null) => void;
  onClose: () => void;
}

export function ChatPanel({ messages, players, currentPlayerId, onSendMessage, onClose }: ChatPanelProps) {
  const [message, setMessage] = useState('');
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message, recipientId);
      setMessage('');
    }
  };

  // Filter messages visible to current player
  const visibleMessages = messages.filter(msg => {
    if (!msg.isPrivate) return true; // Global messages visible to all
    return msg.senderId === currentPlayerId || msg.recipientId === currentPlayerId;
  });

  const otherPlayers = players.filter(p => p.id !== currentPlayerId);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getPlayerColor = (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    return player?.color || '#666';
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-gray-50 rounded-t-lg">
        <h3 className="font-semibold">Chat</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-200 rounded transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Recipient selector */}
      <div className="p-2 border-b bg-gray-50">
        <select
          value={recipientId || ''}
          onChange={(e) => setRecipientId(e.target.value || null)}
          className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">🌐 Global (All Players)</option>
          {otherPlayers.map(player => (
            <option key={player.id} value={player.id}>
              🔒 Private to {player.name}
            </option>
          ))}
        </select>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {visibleMessages.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            No messages yet. Start the conversation!
          </div>
        ) : (
          visibleMessages.map(msg => {
            const isOwn = msg.senderId === currentPlayerId;
            const recipient = msg.recipientId ? players.find(p => p.id === msg.recipientId) : null;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
              >
                {/* Sender info */}
                <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                  {msg.isPrivate ? (
                    <Lock className="w-3 h-3" />
                  ) : (
                    <Globe className="w-3 h-3" />
                  )}
                  <span style={{ color: getPlayerColor(msg.senderId) }} className="font-medium">
                    {msg.senderName}
                  </span>
                  {msg.isPrivate && recipient && (
                    <span className="text-gray-400">
                      → {isOwn ? recipient.name : 'you'}
                    </span>
                  )}
                  <span className="text-gray-400">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>

                {/* Message bubble */}
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-lg ${
                    isOwn
                      ? 'bg-blue-500 text-white rounded-br-sm'
                      : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  } ${msg.isPrivate ? 'border-2 border-dashed' : ''}`}
                  style={msg.isPrivate ? { borderColor: isOwn ? '#93c5fd' : '#d1d5db' } : {}}
                >
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={recipientId ? 'Private message...' : 'Message everyone...'}
            className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            maxLength={500}
          />
          <button
            type="submit"
            disabled={!message.trim()}
            className={`px-4 py-2 rounded-lg transition-colors ${
              message.trim()
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        {recipientId && (
          <div className="mt-1 text-xs text-gray-500 flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Sending private message
          </div>
        )}
      </form>
    </div>
  );
}
