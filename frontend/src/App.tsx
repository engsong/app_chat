import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { MessageSquare, ShieldCheck, Lock, Laptop } from 'lucide-react';
import { Sidebar } from './components/chat/Sidebar.js';
import { ChatArea } from './components/chat/ChatArea.js';
import { CallModal } from './components/calls/CallModal.js';
import { GroupCallModal } from './components/calls/GroupCallModal.js';
import { CatalogModal } from './components/business/CatalogModal.js';
import { QuickRepliesModal } from './components/business/QuickRepliesModal.js';
import { BusinessProfileModal } from './components/business/BusinessProfileModal.js';
import { LabelsModal } from './components/business/LabelsModal.js';
import { StatusModal } from './components/status/StatusModal.js';
import { NewChatModal } from './components/chat/NewChatModal.js';
import { AuthPage } from './components/auth/AuthPage.js';
import { useWebRTC } from './hooks/useWebRTC.js';
import { User, Chat, Message, Product, QuickReply, Label, StatusItem } from './types/index.js';

export const App: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  // Modals state
  const [showCatalog, setShowCatalog] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [profileModalUser, setProfileModalUser] = useState<User | null>(null);

  // Initialize WebRTC Calling Hook
  const webrtc = useWebRTC(socket, currentUser?.id || null);

  // 1. Initialize Socket.io connection
  useEffect(() => {
    const s = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
    });
    setSocket(s);

    s.on('connect', () => {
      console.log('[Socket] Connected to server, ID:', s.id);
    });

    return () => {
      s.disconnect();
    };
  }, []);

  // 2. Fetch Initial Users, Products, Labels, Statuses
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [usersRes, productsRes, qrRes, labelsRes, statusRes] = await Promise.all([
          fetch('/api/users').then((r) => r.json()),
          fetch('/api/business/products').then((r) => r.json()),
          fetch('/api/business/quick-replies').then((r) => r.json()),
          fetch('/api/business/labels').then((r) => r.json()),
          fetch('/api/status').then((r) => r.json()),
        ]);

        setAllUsers(usersRes);
        setProducts(productsRes);
        setQuickReplies(qrRes);
        setLabels(labelsRes);
        // Restore user from localStorage if saved
        const saved = localStorage.getItem('whatsapp_user');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            setCurrentUser(parsed);
          } catch (e) {
            // Ignore
          }
        }
      } catch (err) {
        console.error('Error fetching initial data:', err);
      }
    };

    fetchInitialData();
  }, []);

  // 3. Register user with Socket when currentUser changes & load user's chats
  useEffect(() => {
    if (!socket || !currentUser) return;

    socket.emit('user_connected', currentUser.id);

    const loadUserChats = async () => {
      try {
        const res = await fetch(`/api/chats?userId=${currentUser.id}`);
        const userChats: Chat[] = await res.json();
        setChats(userChats);
        if (userChats.length > 0 && !activeChatId) {
          setActiveChatId(userChats[0].id);
        }
      } catch (err) {
        console.error('Error fetching chats:', err);
      }
    };

    loadUserChats();
  }, [socket, currentUser]);

  // 4. Load messages for active chat
  useEffect(() => {
    if (!activeChatId) return;

    const loadMessages = async () => {
      try {
        const res = await fetch(`/api/chats/${activeChatId}/messages`);
        const msgs = await res.json();
        setMessages(msgs);

        // Mark messages as read
        if (socket && currentUser) {
          socket.emit('mark_messages_read', { chatId: activeChatId, userId: currentUser.id });
        }
      } catch (err) {
        console.error('Error loading messages:', err);
      }
    };

    loadMessages();
  }, [activeChatId, socket, currentUser]);

  // 5. Socket listeners for real-time messages, typing, receipts
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data: { message: Message; chat: Chat }) => {
      // Append if in current chat
      if (data.message.chatId === activeChatId) {
        setMessages((prev) => [...prev, data.message]);
      }

      // Update chats list lastMessage
      setChats((prev) => {
        const updated = prev.map((c) => {
          if (c.id === data.message.chatId) {
            return {
              ...c,
              lastMessage: data.message,
              lastMessageAt: data.message.createdAt,
              unreadCount:
                data.message.chatId !== activeChatId && data.message.senderId !== currentUser?.id
                  ? (c.unreadCount || 0) + 1
                  : c.unreadCount,
            };
          }
          return c;
        });
        return updated.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
      });
    };

    const handleUserTyping = (data: { chatId: string; userId: string }) => {
      if (data.chatId === activeChatId) {
        setTypingUsers((prev) => (prev.includes(data.userId) ? prev : [...prev, data.userId]));
      }
    };

    const handleUserStoppedTyping = (data: { chatId: string; userId: string }) => {
      if (data.chatId === activeChatId) {
        setTypingUsers((prev) => prev.filter((id) => id !== data.userId));
      }
    };

    const handleUserStatusChanged = (data: { userId: string; isOnline: boolean; lastSeen: string }) => {
      setAllUsers((prev) =>
        prev.map((u) => (u.id === data.userId ? { ...u, isOnline: data.isOnline, lastSeen: data.lastSeen } : u))
      );
      setChats((prev) =>
        prev.map((c) => ({
          ...c,
          members: c.members.map((m) =>
            m.userId === data.userId ? { ...m, user: { ...m.user, isOnline: data.isOnline } } : m
          ),
        }))
      );
    };

    socket.on('new_message', handleNewMessage);
    socket.on('user_typing', handleUserTyping);
    socket.on('user_stopped_typing', handleUserStoppedTyping);
    socket.on('user_status_changed', handleUserStatusChanged);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stopped_typing', handleUserStoppedTyping);
      socket.off('user_status_changed', handleUserStatusChanged);
    };
  }, [socket, activeChatId, currentUser]);

  // Send message handler
  const handleSendMessage = (
    content: string,
    type: 'text' | 'image' | 'video' | 'audio' | 'product' = 'text',
    metadata?: string
  ) => {
    if (!socket || !activeChatId || !currentUser) return;

    socket.emit('send_message', {
      chatId: activeChatId,
      senderId: currentUser.id,
      content,
      type,
      metadata,
    });
  };

  // Start 1-on-1 Calls
  const handleStartAudioCall = () => {
    const activeChat = chats.find((c) => c.id === activeChatId);
    if (!activeChat || !currentUser) return;

    if (activeChat.isGroup) {
      // Group voice call
      webrtc.joinGroupCall(activeChat.id, { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar }, false);
    } else {
      // 1-on-1 Voice Call
      const other = activeChat.members.find((m) => m.userId !== currentUser.id)?.user;
      if (other) {
        webrtc.startCall(other.id, other.name, other.avatar, false, activeChat.id);
      }
    }
  };

  const handleStartVideoCall = () => {
    const activeChat = chats.find((c) => c.id === activeChatId);
    if (!activeChat || !currentUser) return;

    if (activeChat.isGroup) {
      // Group video call
      webrtc.joinGroupCall(activeChat.id, { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar }, true);
    } else {
      // 1-on-1 Video Call
      const other = activeChat.members.find((m) => m.userId !== currentUser.id)?.user;
      if (other) {
        webrtc.startCall(other.id, other.name, other.avatar, true, activeChat.id);
      }
    }
  };

  // Switch Active User (for testing WhatsApp Business side vs Client side)
  const handleSwitchUser = (user: User) => {
    localStorage.setItem('whatsapp_user', JSON.stringify(user));
    setCurrentUser(user);
    setActiveChatId(null);
  };

  const handleLoginSuccess = (user: User) => {
    localStorage.setItem('whatsapp_user', JSON.stringify(user));
    setCurrentUser(user);
    setActiveChatId(null);
    // Refresh all users so any newly registered user is visible in contacts
    fetch('/api/users')
      .then((r) => r.json())
      .then((data) => setAllUsers(data))
      .catch(() => {});
  };

  const handleLogout = () => {
    localStorage.removeItem('whatsapp_user');
    setCurrentUser(null);
    setActiveChatId(null);
    setMessages([]);
  };

  // Add Product to Business Catalog
  const handleAddProduct = async (prod: Partial<Product>) => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/business/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...prod, userId: currentUser.id }),
      });
      const newProd = await res.json();
      setProducts((prev) => [newProd, ...prev]);
    } catch (err) {
      console.error('Error adding product:', err);
    }
  };

  // Add Quick Reply
  const handleAddQuickReply = async (qr: { shortcut: string; message: string }) => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/business/quick-replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...qr, userId: currentUser.id }),
      });
      const newQr = await res.json();
      setQuickReplies((prev) => [newQr, ...prev]);
    } catch (err) {
      console.error('Error adding quick reply:', err);
    }
  };

  // Add Label
  const handleAddLabel = async (name: string, color: string) => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/business/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color, userId: currentUser.id }),
      });
      const newLabel = await res.json();
      setLabels((prev) => [...prev, newLabel]);
    } catch (err) {
      console.error('Error adding label:', err);
    }
  };

  // Post Status / 24h Story
  const handlePostStatus = async (data: { type: 'text' | 'image'; caption: string; mediaUrl?: string; backgroundColor?: string }) => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, userId: currentUser.id }),
      });
      const newStatus = await res.json();
      setStatuses((prev) => [{ ...newStatus, user: currentUser, viewsCount: 0 }, ...prev]);
    } catch (err) {
      console.error('Error posting status:', err);
    }
  };

  // View Status
  const handleViewStatus = async (statusId: string) => {
    if (!currentUser) return;
    try {
      await fetch(`/api/status/${statusId}/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ viewerId: currentUser.id }),
      });
    } catch (err) {
      // Ignore
    }
  };

  // Start direct 1-on-1 chat with a user
  const handleStartDirectChat = async (targetUserId: string) => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/chats/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentUserId: currentUser.id, targetUserId }),
      });
      const chat = await res.json();
      // Reload chats
      const chatsRes = await fetch(`/api/chats?userId=${currentUser.id}`).then((r) => r.json());
      setChats(chatsRes);
      setActiveChatId(chat.id);
    } catch (err) {
      console.error('Error starting direct chat:', err);
    }
  };

  // Create Group Chat
  const handleCreateGroupChat = async (name: string, description: string, memberIds: string[]) => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/chats/group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, creatorId: currentUser.id, memberIds }),
      });
      const newGroup = await res.json();
      const chatsRes = await fetch(`/api/chats?userId=${currentUser.id}`).then((r) => r.json());
      setChats(chatsRes);
      setActiveChatId(newGroup.id);
    } catch (err) {
      console.error('Error creating group chat:', err);
    }
  };

  // Send Catalog Product Card directly into active chat
  const handleSendProductToChat = (product: Product) => {
    handleSendMessage(`Catalog item: ${product.name}`, 'product', JSON.stringify(product));
  };

  const activeChat = chats.find((c) => c.id === activeChatId);

  if (!currentUser) {
    return (
      <AuthPage
        onLoginSuccess={handleLoginSuccess}
        demoUsers={allUsers}
      />
    );
  }

  return (
    <div className="h-screen w-screen flex bg-[#111b21] text-white overflow-hidden font-sans">
      {/* 1. Sidebar */}
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={(id) => setActiveChatId(id)}
        currentUser={currentUser}
        allUsers={allUsers}
        onSwitchUser={handleSwitchUser}
        onOpenNewChat={() => setShowNewChat(true)}
        onOpenStatus={() => setShowStatus(true)}
        onOpenCatalog={() => setShowCatalog(true)}
        onOpenLabels={() => setShowLabels(true)}
        onOpenMyProfile={() => setProfileModalUser(currentUser)}
        onLogout={handleLogout}
        selectedLabelId={selectedLabelId}
        onClearLabelFilter={() => setSelectedLabelId(null)}
        labels={labels}
      />

      {/* 2. Main Chat Area or Empty Welcome State */}
      {activeChat ? (
        <ChatArea
          chat={activeChat}
          messages={messages}
          currentUser={currentUser}
          onSendMessage={handleSendMessage}
          onStartAudioCall={handleStartAudioCall}
          onStartVideoCall={handleStartVideoCall}
          onOpenBusinessProfile={(u) => setProfileModalUser(u)}
          onOpenCatalog={() => setShowCatalog(true)}
          quickReplies={quickReplies}
          products={products}
          typingUsers={typingUsers}
          onStartTyping={() => socket?.emit('typing_start', { chatId: activeChat.id, userId: currentUser.id })}
          onStopTyping={() => socket?.emit('typing_stop', { chatId: activeChat.id, userId: currentUser.id })}
        />
      ) : (
        <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-[#222e35] border-b-[6px] border-[#00a884] p-8 text-center">
          <div className="max-w-md flex flex-col items-center">
            <div className="w-24 h-24 rounded-full bg-[#111b21] flex items-center justify-center mb-6 shadow-xl border border-[#2a3942]">
              <Laptop className="w-12 h-12 text-[#00a884]" />
            </div>
            <h2 className="text-2xl font-light text-white mb-2">WhatsApp Business Web</h2>
            <p className="text-xs text-[#8696a0] leading-relaxed mb-8">
              Send and receive real-time messages, make 1-on-1 audio & video calls, organize group conferences, and manage your products catalog with ultra-fast latency.
            </p>
            <div className="flex items-center gap-2 text-xs text-[#8696a0]">
              <Lock className="w-3.5 h-3.5 text-[#00a884]" />
              <span>End-to-end encrypted WebRTC & Real-time Sockets</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. 1-on-1 Call Modal (WebRTC) */}
      <CallModal
        callActive={webrtc.callActive}
        isCalling={webrtc.isCalling}
        incomingCall={webrtc.incomingCall}
        isVideoCall={webrtc.isVideoCall}
        remoteUserName={webrtc.remoteUserName}
        remoteUserAvatar={webrtc.remoteUserAvatar}
        callDuration={webrtc.callDuration}
        isMuted={webrtc.isMuted}
        isVideoDisabled={webrtc.isVideoDisabled}
        isScreenSharing={webrtc.isScreenSharing}
        localStreamRef={webrtc.localStreamRef}
        remoteStreamRef={webrtc.remoteStreamRef}
        onAnswer={webrtc.answerCall}
        onReject={webrtc.rejectCall}
        onEndCall={webrtc.endCall}
        onToggleMute={webrtc.toggleMute}
        onToggleVideo={webrtc.toggleVideo}
        onToggleScreenShare={webrtc.toggleScreenShare}
      />

      {/* 4. Group Call Modal (WebRTC Mesh) */}
      {webrtc.inGroupCall && (
        <GroupCallModal
          groupId={webrtc.activeGroupId || ''}
          groupName={activeChat?.name || 'Group Call'}
          isVideoCall={webrtc.isVideoCall}
          participants={webrtc.groupParticipants}
          currentUserId={currentUser.id}
          isMuted={webrtc.isMuted}
          isVideoDisabled={webrtc.isVideoDisabled}
          localStreamRef={webrtc.localStreamRef}
          onToggleMute={webrtc.toggleMute}
          onToggleVideo={webrtc.toggleVideo}
          onLeaveCall={webrtc.leaveGroupCall}
        />
      )}

      {/* 5. Business Catalog Modal */}
      <CatalogModal
        isOpen={showCatalog}
        onClose={() => setShowCatalog(false)}
        products={products}
        isBusinessOwner={currentUser.isBusiness}
        onAddProduct={handleAddProduct}
        onSendProductToChat={handleSendProductToChat}
      />

      {/* 6. Quick Replies Modal */}
      <QuickRepliesModal
        isOpen={showQuickReplies}
        onClose={() => setShowQuickReplies(false)}
        quickReplies={quickReplies}
        onAddReply={handleAddQuickReply}
      />

      {/* 7. Business Profile / User Details Modal */}
      {profileModalUser && (
        <BusinessProfileModal
          isOpen={Boolean(profileModalUser)}
          onClose={() => setProfileModalUser(null)}
          user={profileModalUser}
          isCurrentUser={profileModalUser.id === currentUser.id}
          onUpdateProfile={(updated) => {
            setCurrentUser({ ...currentUser, ...updated });
            setAllUsers((prev) =>
              prev.map((u) => (u.id === currentUser.id ? { ...u, ...updated } : u))
            );
          }}
        />
      )}

      {/* 8. Labels Modal */}
      <LabelsModal
        isOpen={showLabels}
        onClose={() => setShowLabels(false)}
        labels={labels}
        selectedLabelId={selectedLabelId}
        onSelectFilterLabel={(id) => setSelectedLabelId(id)}
        onAddLabel={handleAddLabel}
      />

      {/* 9. Status / Stories Modal */}
      <StatusModal
        isOpen={showStatus}
        onClose={() => setShowStatus(false)}
        statuses={statuses}
        currentUser={currentUser}
        onPostStatus={handlePostStatus}
        onViewStatus={handleViewStatus}
      />

      {/* 10. New Chat / New Group Modal */}
      <NewChatModal
        isOpen={showNewChat}
        onClose={() => setShowNewChat(false)}
        users={allUsers}
        currentUserId={currentUser.id}
        onStartDirectChat={handleStartDirectChat}
        onCreateGroupChat={handleCreateGroupChat}
      />
    </div>
  );
};
