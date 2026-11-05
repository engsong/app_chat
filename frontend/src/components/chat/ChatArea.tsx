import React, { useState, useEffect, useRef } from 'react';
import {
  Phone,
  Video,
  MoreVertical,
  Search,
  Paperclip,
  Smile,
  Mic,
  Send,
  ShoppingBag,
  Zap,
  Check,
  CheckCheck,
  Play,
  Pause,
  Users,
  ShieldCheck,
  X
} from 'lucide-react';
import { Chat, Message, User, Product, QuickReply } from '../../types/index.js';
import { soundEffects } from '../../utils/audioTones.js';

interface ChatAreaProps {
  chat: Chat;
  messages: Message[];
  currentUser: User;
  onSendMessage: (content: string, type?: 'text' | 'image' | 'video' | 'audio' | 'product', metadata?: string) => void;
  onStartAudioCall: () => void;
  onStartVideoCall: () => void;
  onOpenBusinessProfile: (user: User) => void;
  onOpenCatalog: () => void;
  quickReplies: QuickReply[];
  products: Product[];
  typingUsers: string[];
  onStartTyping: () => void;
  onStopTyping: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  chat,
  messages,
  currentUser,
  onSendMessage,
  onStartAudioCall,
  onStartVideoCall,
  onOpenBusinessProfile,
  onOpenCatalog,
  quickReplies,
  products,
  typingUsers,
  onStartTyping,
  onStopTyping,
}) => {
  const [inputText, setInputText] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showQuickReplyPicker, setShowQuickReplyPicker] = useState(false);
  const [filteredQuickReplies, setFilteredQuickReplies] = useState<QuickReply[]>([]);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // Determine chat header details
  const isGroup = chat.isGroup;
  const otherMember = chat.members.find((m) => m.userId !== currentUser.id)?.user;
  const title = isGroup ? chat.name : (otherMember?.businessName || otherMember?.name || 'Chat');
  const avatar = isGroup
    ? (chat.avatar || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150')
    : (otherMember?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150');
  const isBusiness = !isGroup && otherMember?.isBusiness;

  // Typing event handler
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputText(text);

    // Quick replies triggered by "/"
    if (text.startsWith('/')) {
      const query = text.toLowerCase();
      const matches = quickReplies.filter((qr) => qr.shortcut.toLowerCase().startsWith(query));
      setFilteredQuickReplies(matches);
      setShowQuickReplyPicker(matches.length > 0);
    } else {
      setShowQuickReplyPicker(false);
    }

    // Emit typing indicator
    onStartTyping();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onStopTyping();
    }, 1500);
  };

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim(), 'text');
    setInputText('');
    setShowQuickReplyPicker(false);
    onStopTyping();
    soundEffects.playMessagePop();
  };

  const handleSelectQuickReply = (qr: QuickReply) => {
    setInputText(qr.message);
    setShowQuickReplyPicker(false);
  };

  // Simulate sending voice note
  const handleSendVoiceNote = () => {
    const durations = [12, 24, 38, 45, 18];
    const duration = durations[Math.floor(Math.random() * durations.length)];
    onSendMessage('Voice message', 'audio', JSON.stringify({ duration }));
    soundEffects.playMessagePop();
  };

  const isOtherTyping = typingUsers.length > 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b141a] relative overflow-hidden">
      {/* 1. Chat Header */}
      <div className="h-16 px-4 bg-[#202c33] border-b border-[#2a3942] flex items-center justify-between z-10">
        <div
          onClick={() => {
            if (!isGroup && otherMember) {
              onOpenBusinessProfile(otherMember);
            }
          }}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="relative">
            <img
              src={avatar}
              alt={title || ''}
              className="w-10 h-10 rounded-full object-cover"
            />
            {!isGroup && otherMember?.isOnline && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#00a884] rounded-full border-2 border-[#202c33]" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-sm text-white group-hover:text-[#00a884] transition-colors leading-tight">
                {title}
              </h3>
              {isBusiness && (
                <span title="Official Business Account">
                  <ShieldCheck className="w-4 h-4 text-[#00a884]" />
                </span>
              )}
            </div>
            <p className="text-xs text-[#8696a0] leading-none mt-0.5">
              {isOtherTyping ? (
                <span className="text-[#00a884] font-medium">typing...</span>
              ) : isGroup ? (
                `${chat.members.length} participants`
              ) : otherMember?.isOnline ? (
                'Online'
              ) : (
                'Last seen recently'
              )}
            </p>
          </div>
        </div>

        {/* Action Buttons: Voice Call, Video Call, Menu */}
        <div className="flex items-center gap-2 text-[#aebac1]">
          {/* Audio Call */}
          <button
            onClick={onStartAudioCall}
            className="p-2.5 rounded-full hover:bg-[#374248] text-white hover:text-[#00a884] transition-colors"
            title={isGroup ? 'Start Group Voice Call' : 'Start Voice Call'}
          >
            <Phone className="w-5 h-5" />
          </button>

          {/* Video Call */}
          <button
            onClick={onStartVideoCall}
            className="p-2.5 rounded-full hover:bg-[#374248] text-white hover:text-[#00a884] transition-colors"
            title={isGroup ? 'Start Group Video Call' : 'Start Video Call'}
          >
            <Video className="w-5 h-5" />
          </button>

          {/* Business Catalog Quick Button */}
          {currentUser.isBusiness && (
            <button
              onClick={onOpenCatalog}
              className="p-2.5 rounded-full hover:bg-[#374248] text-white hover:text-[#00a884] transition-colors"
              title="Open Catalog & Send Products"
            >
              <ShoppingBag className="w-5 h-5" />
            </button>
          )}

          <div className="w-[1px] h-6 bg-[#2a3942] mx-1" />

          <button className="p-2.5 rounded-full hover:bg-[#374248] transition-colors">
            <Search className="w-5 h-5" />
          </button>
          <button className="p-2.5 rounded-full hover:bg-[#374248] transition-colors">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 2. Messages List Body (WhatsApp Pattern Background) */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2 whatsapp-chat-bg">
        {/* End-to-end encryption banner */}
        <div className="flex justify-center my-2">
          <div className="bg-[#182229]/90 border border-[#2a3942] text-[#ffd279] text-[11px] px-3.5 py-1.5 rounded-lg max-w-md text-center shadow">
            🔒 Messages and calls are end-to-end encrypted. No one outside of this chat can read or listen.
          </div>
        </div>

        {messages.map((msg) => {
          const isMe = msg.senderId === currentUser.id;
          const msgTime = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          // Parse metadata if present
          let metadataObj: any = null;
          if (msg.metadata) {
            try {
              metadataObj = JSON.parse(msg.metadata);
            } catch (e) {
              // Ignore
            }
          }

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} my-1 animate-fade-in`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3.5 py-2 shadow-md relative ${
                  isMe
                    ? 'bg-[#005c4b] text-white rounded-tr-none'
                    : 'bg-[#202c33] text-[#e9edef] rounded-tl-none'
                }`}
              >
                {/* Group message sender name */}
                {isGroup && !isMe && msg.sender && (
                  <p className="text-xs font-semibold text-[#00a884] mb-1">
                    {msg.sender.name}
                  </p>
                )}

                {/* 1. Product Card Message */}
                {msg.type === 'product' && metadataObj && (
                  <div className="mb-2 bg-[#111b21] rounded-xl overflow-hidden border border-black/20">
                    <img
                      src={metadataObj.imageUrl || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500'}
                      alt={metadataObj.name}
                      className="w-full h-32 object-cover"
                    />
                    <div className="p-3">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-semibold text-xs text-white">{metadataObj.name}</h4>
                        <span className="text-[#00a884] font-bold text-xs">${metadataObj.price}</span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1 line-clamp-2">{metadataObj.description}</p>
                      <button className="w-full mt-2 py-1 bg-[#00a884] hover:bg-[#008f6f] text-white text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1">
                        <ShoppingBag className="w-3 h-3" /> View Product in Catalog
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. Audio Voice Note Message */}
                {msg.type === 'audio' && (
                  <div className="flex items-center gap-3 py-1 min-w-[200px]">
                    <button
                      onClick={() => setPlayingAudioId(playingAudioId === msg.id ? null : msg.id)}
                      className="w-9 h-9 rounded-full bg-[#00a884] flex items-center justify-center text-white shadow"
                    >
                      {playingAudioId === msg.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                    </button>
                    <div className="flex-1">
                      {/* Audio waveform simulation */}
                      <div className="flex items-center gap-0.5 h-6">
                        {[4, 8, 14, 18, 10, 16, 22, 12, 19, 8, 14, 6, 12, 18, 9, 14].map((h, i) => (
                          <div
                            key={i}
                            className={`w-1 rounded-full ${
                              playingAudioId === msg.id ? 'bg-[#25D366] soundwave-bar' : 'bg-gray-400'
                            }`}
                            style={{ height: `${h}px` }}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] text-gray-300">
                        {metadataObj?.duration ? `0:${metadataObj.duration}` : '0:18'}
                      </span>
                    </div>
                  </div>
                )}

                {/* 3. Text Message */}
                {msg.type === 'text' && (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                )}

                {/* Timestamp & Status Checkmark */}
                <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-[#8696a0]">
                  <span>{msgTime}</span>
                  {isMe && (
                    <span>
                      {msg.status === 'read' ? (
                        <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-gray-400" />
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. Quick Replies Autocomplete Popover */}
      {showQuickReplyPicker && filteredQuickReplies.length > 0 && (
        <div className="absolute bottom-16 left-4 right-4 max-w-lg bg-[#202c33] border border-[#2a3942] rounded-xl shadow-2xl p-2 z-30 animate-scale-up">
          <div className="flex items-center justify-between px-2 py-1 border-b border-[#2a3942] text-[11px] text-gray-400">
            <span className="flex items-center gap-1 font-semibold text-[#00a884]">
              <Zap className="w-3.5 h-3.5" /> Quick Replies (Type /shortcut)
            </span>
            <button onClick={() => setShowQuickReplyPicker(false)}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1 mt-1">
            {filteredQuickReplies.map((qr) => (
              <div
                key={qr.id}
                onClick={() => handleSelectQuickReply(qr)}
                className="p-2 rounded-lg hover:bg-[#111b21] cursor-pointer flex items-center justify-between text-xs"
              >
                <span className="font-mono text-[#00a884] font-semibold">{qr.shortcut}</span>
                <span className="text-gray-300 line-clamp-1 max-w-[280px]">{qr.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Chat Input Bar */}
      <div className="min-h-16 px-4 py-2 bg-[#202c33] border-t border-[#2a3942] flex items-center gap-2 z-20">
        {/* Attach Menu Toggle */}
        <div className="relative">
          <button
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            className="p-2.5 rounded-full text-[#8696a0] hover:text-white hover:bg-[#374248] transition-colors"
            title="Attach file, catalog item, or quick reply"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Attach Flyout */}
          {showAttachMenu && (
            <div className="absolute bottom-12 left-0 bg-[#202c33] border border-[#2a3942] rounded-2xl p-2 shadow-2xl flex flex-col gap-1 w-48 z-30 animate-scale-up">
              <button
                onClick={() => {
                  onOpenCatalog();
                  setShowAttachMenu(false);
                }}
                className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-[#111b21] text-xs text-white"
              >
                <div className="w-7 h-7 rounded-full bg-[#00a884]/20 flex items-center justify-center text-[#00a884]">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <span>Catalog Product</span>
              </button>

              <button
                onClick={() => {
                  setInputText('/');
                  setShowQuickReplyPicker(true);
                  setFilteredQuickReplies(quickReplies);
                  setShowAttachMenu(false);
                }}
                className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-[#111b21] text-xs text-white"
              >
                <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400">
                  <Zap className="w-4 h-4" />
                </div>
                <span>Quick Reply</span>
              </button>
            </div>
          )}
        </div>

        <button className="p-2.5 rounded-full text-[#8696a0] hover:text-white hover:bg-[#374248] transition-colors">
          <Smile className="w-5 h-5" />
        </button>

        {/* Input Text Field */}
        <input
          type="text"
          placeholder="Type a message or '/' for quick replies..."
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSend();
            }
          }}
          className="flex-1 bg-[#2a3942] text-white placeholder-[#8696a0] text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#00a884]"
        />

        {/* Send / Voice Note Button */}
        {inputText.trim() ? (
          <button
            onClick={handleSend}
            className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#008f6f] flex items-center justify-center text-white transition-all shadow-md active:scale-95"
            title="Send Message"
          >
            <Send className="w-5 h-5 ml-0.5" />
          </button>
        ) : (
          <button
            onClick={handleSendVoiceNote}
            className="p-2.5 rounded-full text-[#8696a0] hover:text-white hover:bg-[#374248] transition-colors"
            title="Record & Send Voice Note"
          >
            <Mic className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};
