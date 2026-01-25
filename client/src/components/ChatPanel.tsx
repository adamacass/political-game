import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Player } from '../types';
import { Send, X, Lock, Globe } from 'lucide-react';

// Design tokens - ballot paper aesthetic
const colors = {
  paper1: '#F4F1E8',
  paper2: '#EEEBE2',
  paper3: '#E8E5DC',
  ink: '#111111',
  inkSecondary: '#3A3A3A',
  rule: '#1A1A1A',
};

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
    <div className="ballot-paper rounded-lg flex flex-col h-full" style={{ backgroundColor: colors.paper1, border: `2px solid ${colors.rule}` }}>
      {/* Header */}
      <div className="p-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${colors.rule}` }}>
        <h3 className="font-semibold" style={{ color: colors.ink }}>Chat</h3>
        <button onClick={onClose} className="p-1 rounded hover:opacity-70" style={{ color: colors.ink }}>
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Recipient selector */}
      <div className="p-2" style={{ backgroundColor: colors.paper2, borderBottom: `1px solid ${colors.rule}` }}>
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setRecipientId(null)}
            className="px-2 py-1 rounded text-xs flex items-center gap-1"
            style={{
              backgroundColor: recipientId === null ? colors.ink : colors.paper1,
              color: recipientId === null ? colors.paper1 : colors.ink,
              border: `1px solid ${colors.rule}`
            }}
          >
            <Globe className="w-3 h-3" />
            All
          </button>
          {otherPlayers.map(player => (
            <button
              key={player.id}
              onClick={() => setRecipientId(player.id)}
              className="px-2 py-1 rounded text-xs flex items-center gap-1"
              style={{
                backgroundColor: recipientId === player.id ? player.color : colors.paper1,
                color: recipientId === player.id ? '#fff' : colors.ink,
                border: `1px solid ${colors.rule}`
              }}
            >
              <Lock className="w-3 h-3" />
              {player.name}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px]" style={{ backgroundColor: colors.paper2 }}>
        {visibleMessages.length === 0 ? (
          <div className="text-center text-sm py-4" style={{ color: colors.inkSecondary }}>
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
                <div className="flex items-center gap-1 text-xs mb-1" style={{ color: colors.inkSecondary }}>
                  {!isMe && (
                    <>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sender?.color, border: `1px solid ${colors.rule}` }} />
                      <span className="font-medium" style={{ color: colors.ink }}>{msg.senderName}</span>
                    </>
                  )}
                  {msg.isPrivate && (
                    <span className="flex items-center gap-0.5" style={{ color: colors.ink }}>
                      <Lock className="w-3 h-3" />
                      Private
                    </span>
                  )}
                  <span>{formatTime(msg.timestamp)}</span>
                </div>
                <div
                  className="px-3 py-2 rounded-lg max-w-[80%]"
                  style={{
                    backgroundColor: isMe ? colors.ink : colors.paper1,
                    color: isMe ? colors.paper1 : colors.ink,
                    border: `1px solid ${colors.rule}`,
                    borderBottomRightRadius: isMe ? 0 : undefined,
                    borderBottomLeftRadius: !isMe ? 0 : undefined,
                  }}
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
      <div className="p-3" style={{ borderTop: `1px solid ${colors.rule}` }}>
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={recipientId ? `Private message to ${players.find(p => p.id === recipientId)?.name}...` : 'Message everyone...'}
            className="flex-1 px-3 py-2 rounded text-sm focus:outline-none"
            style={{ backgroundColor: colors.paper2, border: `1px solid ${colors.rule}`, color: colors.ink }}
            maxLength={500}
          />
          <button
            onClick={handleSend}
            disabled={!message.trim()}
            className="px-4 py-2 rounded transition-colors disabled:opacity-40"
            style={{ backgroundColor: colors.ink, color: colors.paper1, border: `1px solid ${colors.rule}` }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
