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

export function ChatPanel({
  messages,
  players,
  currentPlayerId,
  onSendMessage,
  onClose,
}: ChatPanelProps) {
  const [message, setMessage] = useState('');
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message.trim(), recipientId);
      setMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const otherPlayers = players.filter(p => p.id !== currentPlayerId);
  const currentPlayer = players.find(p => p.id === currentPlayerId);

  // Filter messages for current player
  const visibleMessages = messages.filter(m => 
    !m.isPrivate || 
    m.senderId === currentPlayerId || 
    m.recipientId === currentPlayerId
  );

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-white rounded-lg shadow-lg flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between">
        <h3 className="font-semibold">Chat</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Recipient selector */}
      <div className="p-2 border-b bg-gray-50">
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setRecipientId(null)}
            className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
              recipientId === null ? 'bg-blue-500 text-white' : 'bg-white border hover:bg-gray-100'
            }`}
          >
            <Globe className="w-3 h-3" />
            All
          </button>
          {otherPlayers.map(player => (
            <button
              key={player.id}
              onClick={() => setRecipientId(player.id)}
              className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
                recipientId === player.id ? 'text-white' : 'bg-white border hover:bg-gray-100'
              }`}
              style={{ backgroundColor: recipientId === player.id ? player.color : undefined }}
            >
              <Lock className="w-3 h-3" />
              {player.name}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px]">
        {visibleMessages.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-4">
            No messages yet
          </div>
        ) : (
          visibleMessages.map(msg => {
            const sender = players.find(p => p.id === msg.senderId);
            const isMe = msg.senderId === currentPlayerId;
            
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                  {!isMe && (
                    <>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sender?.color }} />
                      <span className="font-medium">{msg.senderName}</span>
                    </>
                  )}
                  {msg.isPrivate && (
                    <span className="text-purple-500 flex items-center gap-0.5">
                      <Lock className="w-3 h-3" />
                      Private
                    </span>
                  )}
                  <span>{formatTime(msg.timestamp)}</span>
                </div>
                <div
                  className={`px-3 py-2 rounded-lg max-w-[80%] ${
                    isMe
                      ? 'bg-blue-500 text-white rounded-br-none'
                      : msg.isPrivate
                      ? 'bg-purple-100 text-purple-900 rounded-bl-none'
                      : 'bg-gray-100 text-gray-900 rounded-bl-none'
                  }`}
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
      <div className="p-3 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={recipientId ? `Private message to ${players.find(p => p.id === recipientId)?.name}...` : 'Message everyone...'}
            className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            maxLength={500}
          />
          <button
            onClick={handleSend}
            disabled={!message.trim()}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
