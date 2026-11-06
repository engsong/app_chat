import React, { useState, useEffect, useRef } from 'react';
import {
  Phone,
  Video,
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
  X,
  ArrowLeft,
  Image as ImageIcon,
  MapPin,
  FileText,
  Download,
  Trash2,
  ExternalLink,
  Maximize2,
  PhoneCall,
  PhoneMissed
} from 'lucide-react';
import { Chat, Message, User, Product, QuickReply } from '../../types/index.js';
import { soundEffects } from '../../utils/audioTones.js';
import { EmojiPicker } from './EmojiPicker.js';

interface ChatAreaProps {
  chat: Chat;
  messages: Message[];
  currentUser: User;
  onSendMessage: (
    content: string,
    type?: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'product' | 'call',
    metadata?: string,
    mediaUrl?: string
  ) => void;
  onStartAudioCall: () => void;
  onStartVideoCall: () => void;
  onOpenBusinessProfile: (user: User) => void;
  onOpenCatalog: () => void;
  quickReplies: QuickReply[];
  products: Product[];
  typingUsers: string[];
  onStartTyping: () => void;
  onStopTyping: () => void;
  onBack?: () => void;
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
  onBack,
}) => {
  const [inputText, setInputText] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showQuickReplyPicker, setShowQuickReplyPicker] = useState(false);
  const [filteredQuickReplies, setFilteredQuickReplies] = useState<QuickReply[]>([]);
  
  // Audio playback state
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Real voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  // Image lightbox modal
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Click outside to dismiss attach menu and emoji picker
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        attachMenuRef.current &&
        !attachMenuRef.current.contains(target) &&
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(target)
      ) {
        setShowAttachMenu(false);
        setShowEmojiPicker(false);
      }
    };

    if (showAttachMenu || showEmojiPicker) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [showAttachMenu, showEmojiPicker]);

  // Auto-scroll to latest message safely inside the container (prevents whole window from scrolling)
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, typingUsers]);

  // Clean up audio and recording when changing chats
  useEffect(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    setPlayingAudioId(null);
    cancelRecording();
  }, [chat.id]);

  // Determine chat header details
  const isGroup = chat.isGroup;
  const otherMember = chat.members?.find((m) => m.userId !== currentUser.id)?.user;
  const title = isGroup ? chat.name : (otherMember?.businessName || otherMember?.name || 'User');
  const avatar = isGroup
    ? (chat.avatar || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150')
    : (otherMember?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150');

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
    setShowEmojiPicker(false);
    onStopTyping();
    soundEffects.playMessagePop();
  };

  const handleSelectQuickReply = (qr: QuickReply) => {
    setInputText(qr.message);
    setShowQuickReplyPicker(false);
  };

  // 1. Send Image File
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      onSendMessage('', 'image', undefined, dataUrl);
      soundEffects.playMessagePop();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
    setShowAttachMenu(false);
  };

  // 2. Send Document File
  const handleDocFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const metadata = JSON.stringify({
        name: file.name,
        size: file.size,
      });
      onSendMessage(file.name, 'document', metadata, dataUrl);
      soundEffects.playMessagePop();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
    setShowAttachMenu(false);
  };

  // 3. Send Location
  const handleSendLocation = () => {
    setShowAttachMenu(false);
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
        const metadata = JSON.stringify({ lat, lng, mapUrl });
        onSendMessage(
          `📍 Location: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          'location',
          metadata
        );
        soundEffects.playMessagePop();
      },
      (err) => {
        console.warn('Geolocation error:', err);
        // Fallback or prompt
        const manualLoc = prompt('Enter a city or location to share:', 'Vientiane, Laos');
        if (manualLoc) {
          onSendMessage(`📍 Location: ${manualLoc}`, 'location');
          soundEffects.playMessagePop();
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // 4. Real Voice Note Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      // Fallback voice message simulation if mic access blocked
      const duration = Math.floor(10 + Math.random() * 20);
      onSendMessage('Voice message', 'audio', JSON.stringify({ duration }));
      soundEffects.playMessagePop();
    }
  };

  const cancelRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    setIsRecording(false);
    setRecordingSeconds(0);
    audioChunksRef.current = [];
  };

  const stopAndSendRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    const duration = recordingSeconds;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          onSendMessage(
            'Voice message',
            'audio',
            JSON.stringify({ duration: duration || 1 }),
            dataUrl
          );
          soundEffects.playMessagePop();
        };
        reader.readAsDataURL(audioBlob);

        mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      };
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  // Audio Playback
  const togglePlayAudio = (msg: Message) => {
    if (playingAudioId === msg.id) {
      audioPlayerRef.current?.pause();
      setPlayingAudioId(null);
      return;
    }

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }

    if (msg.mediaUrl) {
      const audio = new Audio(msg.mediaUrl);
      audioPlayerRef.current = audio;
      setPlayingAudioId(msg.id);

      audio.play().catch(() => {
        soundEffects.playMessagePop();
      });

      audio.onended = () => {
        setPlayingAudioId(null);
      };
    } else {
      // Simulated tone if no media url
      setPlayingAudioId(msg.id);
      soundEffects.playMessagePop();
      setTimeout(() => setPlayingAudioId(null), 3000);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '128 KB';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isOtherTyping = typingUsers.length > 0;

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 max-h-full w-full bg-[#0b141a] relative overflow-hidden">
      {/* Hidden file inputs for image and document upload */}
      <input
        type="file"
        ref={imageInputRef}
        accept="image/*,video/*"
        onChange={handleImageFileChange}
        className="hidden"
      />
      <input
        type="file"
        ref={docInputRef}
        accept="*/*"
        onChange={handleDocFileChange}
        className="hidden"
      />

      {/* 1. Chat Header */}
      <div className="h-16 flex-shrink-0 px-3 sm:px-4 bg-[#202c33] border-b border-[#2a3942] flex items-center justify-between z-20">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden p-2 -ml-1 text-gray-200 hover:text-white rounded-full hover:bg-[#374248] active:bg-[#00a884]/30 transition-colors flex-shrink-0"
              title="Back to Chats"
              aria-label="Back to Chats"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          )}

          <div
            onClick={() => {
              if (!isGroup && otherMember) {
                onOpenBusinessProfile(otherMember);
              }
            }}
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group min-w-0"
          >
            <div className="relative flex-shrink-0">
              <img
                src={avatar}
                alt={title || ''}
                className="w-10 h-10 rounded-full object-cover"
              />
              {!isGroup && otherMember?.isOnline && (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#00a884] rounded-full border-2 border-[#202c33]" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm sm:text-base text-white group-hover:text-[#00a884] transition-colors truncate">
                {title}
              </h3>
              <p className="text-[11px] text-[#8696a0] truncate">
                {isOtherTyping ? (
                  <span className="text-[#00a884] font-medium animate-pulse">typing...</span>
                ) : isGroup ? (
                  `${chat.members?.length || 0} participants`
                ) : otherMember?.isOnline ? (
                  <span className="text-[#00a884]">online</span>
                ) : otherMember?.lastSeen ? (
                  `last seen ${new Date(otherMember.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                ) : (
                  'offline'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Action Call & Business Buttons */}
        <div className="flex items-center gap-0.5 sm:gap-1 text-[#aebac1] flex-shrink-0">
          {/* Audio Call */}
          <button
            onClick={onStartAudioCall}
            className="p-2 sm:p-2.5 rounded-full hover:bg-[#374248] text-white hover:text-[#00a884] transition-colors"
            title={isGroup ? 'Start Group Voice Call' : 'Start Voice Call'}
          >
            <Phone className="w-5 h-5" />
          </button>

          {/* Video Call */}
          <button
            onClick={onStartVideoCall}
            className="p-2 sm:p-2.5 rounded-full hover:bg-[#374248] text-white hover:text-[#00a884] transition-colors"
            title={isGroup ? 'Start Group Video Call' : 'Start Video Call'}
          >
            <Video className="w-5 h-5" />
          </button>

          {/* Business Catalog Quick Button */}
          {currentUser.isBusiness && (
            <button
              onClick={onOpenCatalog}
              className="p-2 sm:p-2.5 rounded-full hover:bg-[#374248] text-white hover:text-[#00a884] transition-colors"
              title="Business Catalog"
            >
              <ShoppingBag className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Messages List Body */}
      <div
        ref={messagesContainerRef}
        className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-2.5 whatsapp-chat-bg overscroll-contain"
      >
        {/* Encryption Security Badge */}
        <div className="flex justify-center mb-3">
          <div className="bg-[#182229] border border-[#2a3942]/60 text-[#ffd279] text-[11px] px-3.5 py-1.5 rounded-xl max-w-sm text-center shadow-sm">
            🔒 Messages and calls are end-to-end encrypted with WebRTC & Real-time Sockets.
          </div>
        </div>

        {/* Message Bubbles */}
        {messages.map((msg) => {
          const isMe = msg.senderId === currentUser.id;
          const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-fade-in`}
            >
              <div
                className={`max-w-[88%] sm:max-w-md rounded-2xl p-2.5 sm:p-3 shadow-md relative ${
                  isMe
                    ? 'bg-[#005c4b] text-white rounded-tr-none'
                    : 'bg-[#202c33] text-white rounded-tl-none border border-[#2a3942]/50'
                }`}
              >
                {/* Sender Name in Group Chat */}
                {isGroup && !isMe && (
                  <p className="text-[11px] font-semibold text-[#00a884] mb-1">
                    {msg.sender?.name || 'Member'}
                  </p>
                )}

                {/* 1. Text Message */}
                {msg.type === 'text' && (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {msg.content}
                  </p>
                )}

                {/* 2. Image / Photo Message */}
                {msg.type === 'image' && (
                  <div className="space-y-1.5">
                    <div
                      onClick={() => msg.mediaUrl && setLightboxUrl(msg.mediaUrl)}
                      className="cursor-pointer relative group overflow-hidden rounded-xl bg-black/30"
                    >
                      <img
                        src={msg.mediaUrl}
                        alt="Photo"
                        className="max-h-56 sm:max-h-72 w-full max-w-[260px] sm:max-w-xs object-cover rounded-xl transition-transform group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="p-2 rounded-full bg-black/60 text-white">
                          <Maximize2 className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                    {msg.content &&
                      msg.content.trim() !== '' &&
                      msg.content.trim() !== 'Photo' &&
                      !/\.(jpe?g|png|gif|webp|bmp|heic|svg)$/i.test(msg.content.trim()) &&
                      !/^Screenshot[_\s\d\-.]+/i.test(msg.content.trim()) &&
                      !/^\d{6,}[_\d\-.]*\.(jpe?g|png|gif|webp)$/i.test(msg.content.trim()) && (
                        <p className="text-sm text-white pt-1">{msg.content}</p>
                      )}
                  </div>
                )}

                {/* 3. Location Message */}
                {msg.type === 'location' && (
                  (() => {
                    let mapUrl = 'https://maps.google.com';
                    if (msg.metadata) {
                      try {
                        const parsed = JSON.parse(msg.metadata);
                        mapUrl = parsed.mapUrl || `https://maps.google.com?q=${parsed.lat},${parsed.lng}`;
                      } catch (e) {}
                    }
                    return (
                      <div className="p-2.5 bg-[#111b21] rounded-xl border border-[#2a3942] min-w-[200px] sm:min-w-[240px]">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center flex-shrink-0">
                            <MapPin className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h5 className="font-semibold text-xs text-white">Shared Location</h5>
                            <p className="text-[10px] text-[#8696a0] truncate">{msg.content}</p>
                          </div>
                        </div>

                        <a
                          href={mapUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full py-1.5 px-3 rounded-lg bg-[#202c33] hover:bg-[#00a884] text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Open in Google Maps</span>
                        </a>
                      </div>
                    );
                  })()
                )}

                {/* 4. Document Message */}
                {msg.type === 'document' && (
                  <div className="p-2.5 bg-[#111b21] rounded-xl border border-[#2a3942] flex items-center justify-between gap-3 min-w-[220px]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate max-w-[160px]">
                          {msg.content}
                        </p>
                        <p className="text-[10px] text-[#8696a0]">
                          {msg.metadata ? formatFileSize(JSON.parse(msg.metadata).size) : 'File'}
                        </p>
                      </div>
                    </div>

                    {msg.mediaUrl && (
                      <a
                        href={msg.mediaUrl}
                        download={msg.content}
                        className="p-2 rounded-full bg-[#202c33] hover:bg-[#00a884] text-white transition-colors flex-shrink-0"
                        title="Download Document"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                )}

                {/* 5. Audio / Voice Note Message */}
                {msg.type === 'audio' && (
                  <div className="flex items-center gap-2.5 py-1 min-w-[210px] sm:min-w-[240px]">
                    <button
                      onClick={() => togglePlayAudio(msg)}
                      className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#008f6f] flex items-center justify-center text-white flex-shrink-0 transition-transform active:scale-95 shadow-md"
                    >
                      {playingAudioId === msg.id ? (
                        <Pause className="w-5 h-5 fill-current" />
                      ) : (
                        <Play className="w-5 h-5 ml-0.5 fill-current" />
                      )}
                    </button>

                    {/* Audio Wave Visualizer Bars */}
                    <div className="flex-1 flex items-center gap-0.5 h-6">
                      {[12, 24, 16, 28, 20, 14, 22, 18, 26, 12, 20, 16, 24, 18].map((h, i) => (
                        <div
                          key={i}
                          className={`w-1 rounded-full transition-all ${
                            playingAudioId === msg.id
                              ? 'bg-[#00a884] soundwave-bar'
                              : 'bg-white/40'
                          }`}
                          style={{
                            height: playingAudioId === msg.id ? undefined : `${h}px`,
                            animationDelay: `${i * 0.08}s`,
                          }}
                        />
                      ))}
                    </div>

                    <span className="text-[11px] text-white/70 font-mono flex-shrink-0">
                      0:{msg.metadata ? JSON.parse(msg.metadata).duration : '15'}
                    </span>
                  </div>
                )}

                {/* 6. Product Catalog Card Message */}
                {msg.type === 'product' && msg.metadata && (
                  (() => {
                    try {
                      const prod: Product = JSON.parse(msg.metadata);
                      return (
                        <div className="space-y-2 max-w-xs">
                          {prod.imageUrl && (
                            <img
                              src={prod.imageUrl}
                              alt={prod.name}
                              className="w-full h-36 object-cover rounded-xl"
                            />
                          )}
                          <div>
                            <h5 className="font-semibold text-sm text-white">{prod.name}</h5>
                            <p className="text-xs text-gray-300 line-clamp-2">{prod.description}</p>
                            <p className="text-sm font-bold text-[#00a884] mt-1">
                              ${prod.price.toFixed(2)} {prod.currency}
                            </p>
                          </div>
                        </div>
                      );
                    } catch (e) {
                      return <p className="text-sm">{msg.content}</p>;
                    }
                  })()
                )}

                {/* 7. Call Event Message */}
                {msg.type === 'call' && (
                  (() => {
                    let callMeta: { type?: 'voice' | 'video'; status?: string; duration?: number } = {};
                    try {
                      if (msg.metadata) callMeta = JSON.parse(msg.metadata);
                    } catch (e) {}

                    const isVideo = callMeta.type === 'video' || msg.content.toLowerCase().includes('video');
                    const isMissed =
                      callMeta.status === 'missed' ||
                      callMeta.status === 'declined' ||
                      msg.content.toLowerCase().includes('missed') ||
                      msg.content.toLowerCase().includes('declined');
                    const durationSec = callMeta.duration || 0;
                    const mins = Math.floor(durationSec / 60);
                    const secs = durationSec % 60;
                    const durStr = durationSec > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : '';

                    return (
                      <div className="flex items-center gap-3 py-1 min-w-[200px] sm:min-w-[230px]">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isMissed ? 'bg-rose-500/20 text-rose-400' : 'bg-[#00a884]/20 text-[#00a884]'
                          }`}
                        >
                          {isVideo ? (
                            <Video className="w-5 h-5" />
                          ) : isMissed ? (
                            <PhoneMissed className="w-5 h-5" />
                          ) : (
                            <PhoneCall className="w-5 h-5" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white truncate">
                            {isVideo ? 'Video Call' : 'Voice Call'}
                          </p>
                          <p className="text-[11px] text-[#8696a0] flex items-center gap-1.5">
                            <span className={isMissed ? 'text-rose-400 font-medium' : 'text-[#00a884] font-medium'}>
                              {isMissed
                                ? callMeta.status === 'declined'
                                  ? 'Declined'
                                  : 'Missed'
                                : 'Completed'}
                            </span>
                            {durStr && <span>• {durStr}</span>}
                          </p>
                        </div>

                        {/* Quick Call Back Button */}
                        <button
                          onClick={() => (isVideo ? onStartVideoCall() : onStartAudioCall())}
                          className="p-2 rounded-full bg-[#111b21] hover:bg-[#00a884] text-[#8696a0] hover:text-white transition-colors flex-shrink-0 shadow-sm"
                          title={`Call back (${isVideo ? 'Video' : 'Voice'})`}
                        >
                          {isVideo ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                        </button>
                      </div>
                    );
                  })()
                )}

                {/* Timestamp & Status Checkmarks */}
                <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-white/60">
                  <span>{time}</span>
                  {isMe && (
                    <span>
                      {msg.status === 'read' ? (
                        <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-white/70" />
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Quick Replies Autocomplete Popover */}
      {showQuickReplyPicker && filteredQuickReplies.length > 0 && (
        <div className="absolute bottom-16 left-3 right-3 sm:left-4 sm:right-auto sm:w-80 bg-[#202c33] border border-[#2a3942] rounded-xl shadow-2xl p-2 z-30 animate-scale-up">
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
                <span className="text-gray-300 line-clamp-1 max-w-[200px]">{qr.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Click-outside backdrop for attach menu & emoji picker */}
      {(showAttachMenu || showEmojiPicker) && (
        <div
          className="fixed inset-0 z-30 bg-transparent"
          onClick={() => {
            setShowAttachMenu(false);
            setShowEmojiPicker(false);
          }}
        />
      )}

      {/* 4. Chat Input Bar */}
      <div className="relative flex-shrink-0 px-2 sm:px-4 py-2.5 bg-[#202c33] border-t border-[#2a3942] flex items-center gap-1.5 sm:gap-2 z-40 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
        {isRecording ? (
          // Recording Audio Bar
          <div className="flex-1 flex items-center justify-between bg-[#111b21] rounded-xl px-3 py-2 border border-[#2a3942] animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
              <span className="text-xs font-mono font-semibold text-rose-400">
                Recording {formatSeconds(recordingSeconds)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={cancelRecording}
                className="p-2 rounded-full hover:bg-rose-900/40 text-[#8696a0] hover:text-rose-400 transition-colors"
                title="Cancel recording"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={stopAndSendRecording}
                className="w-8 h-8 rounded-full bg-[#00a884] hover:bg-[#008f6f] flex items-center justify-center text-white transition-all shadow-md active:scale-95"
                title="Send voice message"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            </div>
          </div>
        ) : (
          // Standard Input Bar
          <>
            {/* Attach Menu Toggle */}
            <div ref={attachMenuRef} className="relative flex-shrink-0 z-50">
              <button
                type="button"
                onClick={() => {
                  setShowAttachMenu(!showAttachMenu);
                  setShowEmojiPicker(false);
                }}
                className={`p-2 sm:p-2.5 rounded-full transition-colors ${
                  showAttachMenu ? 'text-[#00a884] bg-[#2a3942]' : 'text-[#8696a0] hover:text-white hover:bg-[#374248]'
                }`}
                title="Attach photo, video, location, document, or catalog product"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              {/* Attach Flyout */}
              {showAttachMenu && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-full left-0 mb-3 bg-[#202c33] border border-[#2a3942] rounded-2xl p-2 shadow-2xl flex flex-col gap-1 w-52 z-50 animate-scale-up"
                >
                  {/* Photo & Video */}
                  <button
                    type="button"
                    onClick={() => {
                      imageInputRef.current?.click();
                      setShowAttachMenu(false);
                    }}
                    className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-[#111b21] text-xs text-white"
                  >
                    <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                    <span>Photo & Video</span>
                  </button>

                  {/* Location */}
                  <button
                    type="button"
                    onClick={() => {
                      handleSendLocation();
                      setShowAttachMenu(false);
                    }}
                    className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-[#111b21] text-xs text-white"
                  >
                    <div className="w-7 h-7 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <span>Send Location</span>
                  </button>

                  {/* Document */}
                  <button
                    type="button"
                    onClick={() => {
                      docInputRef.current?.click();
                      setShowAttachMenu(false);
                    }}
                    className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-[#111b21] text-xs text-white"
                  >
                    <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                      <FileText className="w-4 h-4" />
                    </div>
                    <span>Document File</span>
                  </button>

                  {/* Catalog Product */}
                  <button
                    type="button"
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

                  {/* Quick Reply */}
                  <button
                    type="button"
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

            {/* Emoji Picker Popover */}
            {showEmojiPicker && (
              <div
                ref={emojiPickerRef}
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-full left-2 right-2 sm:left-4 sm:right-auto sm:w-80 mb-3 z-50"
              >
                <EmojiPicker
                  onSelectEmoji={(emoji) => {
                    setInputText((prev) => prev + emoji);
                  }}
                  onClose={() => setShowEmojiPicker(false)}
                />
              </div>
            )}

            {/* Emoji Button (Visible on both Mobile & Desktop) */}
            <button
              type="button"
              onClick={() => {
                setShowEmojiPicker((prev) => !prev);
                setShowAttachMenu(false);
              }}
              className={`p-2 sm:p-2.5 rounded-full transition-colors flex-shrink-0 ${
                showEmojiPicker
                  ? 'text-[#00a884] bg-[#2a3942]'
                  : 'text-[#8696a0] hover:text-white hover:bg-[#374248]'
              }`}
              title="Insert emoji"
            >
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
              className="flex-1 min-w-0 bg-[#2a3942] text-white placeholder-[#8696a0] text-sm rounded-xl px-3 sm:px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#00a884]"
            />

            {/* Send / Voice Note Button */}
            {inputText.trim() ? (
              <button
                onClick={handleSend}
                className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#008f6f] flex items-center justify-center text-white transition-all shadow-md active:scale-95 flex-shrink-0"
                title="Send Message"
              >
                <Send className="w-5 h-5 ml-0.5" />
              </button>
            ) : (
              <button
                onClick={startRecording}
                className="p-2 sm:p-2.5 rounded-full text-[#8696a0] hover:text-white hover:bg-[#374248] transition-colors flex-shrink-0"
                title="Record Voice Note"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
          </>
        )}
      </div>

      {/* 5. Image Lightbox Modal */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90dvh] flex flex-col items-center"
          >
            <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
              <a
                href={lightboxUrl}
                download="photo.jpg"
                className="p-2 rounded-full bg-black/60 text-white hover:bg-[#00a884] transition-colors"
                title="Download image"
              >
                <Download className="w-5 h-5" />
              </a>
              <button
                onClick={() => setLightboxUrl(null)}
                className="p-2 rounded-full bg-black/60 text-white hover:bg-rose-600 transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={lightboxUrl}
              alt="Enlarged"
              className="max-h-[85dvh] max-w-full rounded-2xl object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
