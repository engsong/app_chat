import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Lock } from 'lucide-react';
import { Sidebar } from './components/chat/Sidebar.js';
import { ChatArea } from './components/chat/ChatArea.js';
import { CallModal } from './components/calls/CallModal.js';
import { GroupCallModal } from './components/calls/GroupCallModal.js';
import { CallsHistoryModal } from './components/calls/CallsHistoryModal.js';
import { CatalogModal } from './components/business/CatalogModal.js';
import { QuickRepliesModal } from './components/business/QuickRepliesModal.js';
import { BusinessProfileModal } from './components/business/BusinessProfileModal.js';
import { LabelsModal } from './components/business/LabelsModal.js';
import { StatusModal } from './components/status/StatusModal.js';
import { NewChatModal } from './components/chat/NewChatModal.js';
import { AdminDashboardModal } from './components/admin/AdminDashboardModal.js';
import { AuthPage } from './components/auth/AuthPage.js';
import { WallpaperModal } from './components/chat/WallpaperModal.js';
import { useWebRTC } from './hooks/useWebRTC.js';
import { User, Chat, Message, Product, QuickReply, Label, StatusItem } from './types/index.js';
import { soundEffects } from './utils/audioTones.js';
import { getAvatarUrl } from './utils/avatar.js';
import {
  registerServiceWorker,
  requestNotificationPermission,
  showMessageNotification,
} from './utils/notifications.js';

export const App: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [contacts, setContacts] = useState<User[]>([]);
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
  const [showCallsHistory, setShowCallsHistory] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [showWallpaperModal, setShowWallpaperModal] = useState(false);
  const [customWallpaper, setCustomWallpaper] = useState<string>(
    () => localStorage.getItem('ichat_chat_wallpaper') || ''
  );
  const [pendingUsersCount, setPendingUsersCount] = useState(0);
  const [profileModalUser, setProfileModalUser] = useState<User | null>(null);

  // Ref to track currentUser in socket and lifecycle callbacks
  const currentUserRef = useRef<User | null>(null);
  currentUserRef.current = currentUser;

  // Initialize WebRTC Calling Hook
  const webrtc = useWebRTC(socket, currentUser?.id || null);

  // 1. Initialize Socket.io connection with automatic background reconnection, keep-alive & notifications
  useEffect(() => {
    // Register Service Worker and prompt for notification permissions
    registerServiceWorker();
    requestNotificationPermission();

    const s = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });
    setSocket(s);

    s.on('connect', () => {
      console.log('[Socket] Connected to server, ID:', s.id);
      if (currentUserRef.current) {
        s.emit('user_connected', currentUserRef.current.id);
      }
    });

    s.on('reconnect', () => {
      console.log('[Socket] Reconnected, re-registering user:', currentUserRef.current?.id);
      if (currentUserRef.current) {
        s.emit('user_connected', currentUserRef.current.id);
      }
    });

    // Handle background wake-up and tab visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (!s.connected) {
          console.log('[Socket] Reconnecting on page visible...');
          s.connect();
        }
        if (currentUserRef.current) {
          s.emit('user_connected', currentUserRef.current.id);
        }
        document.title = 'IChat - Ultra-Fast Real-Time Messenger';
      }
    };

    const handleWindowFocus = () => {
      if (!s.connected) {
        s.connect();
      }
      document.title = 'IChat - Ultra-Fast Real-Time Messenger';
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    // Keep-alive heartbeat every 25 seconds (prevents proxy/NAT timeouts)
    const keepAliveTimer = setInterval(() => {
      if (s.connected && currentUserRef.current) {
        s.emit('ping_check', { userId: currentUserRef.current.id });
      } else if (!s.connected && currentUserRef.current) {
        s.connect();
      }
    }, 25000);

    // Handle service worker notification click navigation
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'NAVIGATE_TO_CHAT' && event.data.chatId) {
        setActiveChatId(event.data.chatId);
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
      clearInterval(keepAliveTimer);
      s.disconnect();
    };
  }, []);

  // 2. Fetch Initial Users, Products, Labels, Statuses & restore session
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
        setStatuses(statusRes);

        // Restore user from localStorage only if user hasn't set 'Always require login'
        const alwaysRequireLogin = localStorage.getItem('ichat_always_require_login') === 'true';
        if (!alwaysRequireLogin) {
          const saved = localStorage.getItem('ichat_user') || localStorage.getItem('whatsapp_user');
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              const freshUser = usersRes?.find((u: any) => u.id === parsed.id);
              if (freshUser) {
                const merged = { ...parsed, ...freshUser };
                setCurrentUser(merged);
                localStorage.setItem('ichat_user', JSON.stringify(merged));
              } else {
                setCurrentUser(parsed);
              }
            } catch (e) {
              // Ignore corrupted storage
            }
          }
        }
      } catch (err) {
        console.error('Error fetching initial data:', err);
      }
    };

    fetchInitialData();
  }, []);

  const fetchContacts = async (userId: string) => {
    try {
      const res = await fetch(`/api/contacts?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setContacts(data);
      }
    } catch (err) {
      console.error('Error fetching contacts:', err);
    }
  };

  // 3. Register user with Socket when currentUser changes & load user's chats & contacts
  useEffect(() => {
    if (!currentUser) return;

    if (socket && socket.connected) {
      socket.emit('user_connected', currentUser.id);
    }
    fetchContacts(currentUser.id);

    const loadUserChats = async () => {
      try {
        const res = await fetch(`/api/chats?userId=${currentUser.id}`);
        const userChats: Chat[] = await res.json();
        setChats(userChats);
        // Only auto-open first chat on desktop screens (>= 768px).
        // On mobile (< 768px), keep activeChatId null so user lands on the Home Page (Chat list)!
        const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
        if (isDesktop && userChats.length > 0 && !activeChatId) {
          setActiveChatId(userChats[0].id);
        }
      } catch (err) {
        console.error('Error fetching chats:', err);
      }
    };

    loadUserChats();

    // Fetch admin stats if user is super admin
    if (currentUser.role === 'admin' || currentUser.phone === '02054245616' || currentUser.phone?.toLowerCase() === 'admin') {
      fetch('/api/admin/overview', {
        headers: { 'x-admin-id': currentUser.id },
      })
        .then((r) => r.json())
        .then((d) => {
          if (d?.pendingCount !== undefined) {
            setPendingUsersCount(d.pendingCount);
          }
        })
        .catch(() => {});
    }
  }, [socket, currentUser]);

  // 4. Load messages for active chat
  useEffect(() => {
    if (!activeChatId || !currentUser) return;

    const loadMessages = async () => {
      try {
        const res = await fetch(`/api/chats/${activeChatId}/messages?userId=${currentUser.id}`);
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

  // 5. Socket listeners for real-time messages, typing, receipts, new chats
  useEffect(() => {
    if (!socket || !currentUser) return;

    const handleNewMessage = (data: { message: Message; chat: Chat }) => {
      // Append if in current chat
      if (data.message.chatId === activeChatId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });

        // Automatically mark as read if received while looking at active chat
        if (data.message.senderId !== currentUser.id) {
          socket.emit('mark_messages_read', { chatId: activeChatId, userId: currentUser.id });
          fetch(`/api/chats/${activeChatId}/read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id }),
          }).catch(() => {});
        }
      }

      // Update chats list (or add new chat if not yet in list)
      setChats((prev) => {
        const exists = prev.some((c) => c.id === data.message.chatId);
        let updated: Chat[];

        if (!exists) {
          updated = [
            {
              ...data.chat,
              lastMessage: data.message,
              lastMessageAt: data.message.createdAt,
              unreadCount: data.message.senderId !== currentUser.id ? 1 : 0,
            },
            ...prev,
          ];
        } else {
          updated = prev.map((c) => {
            if (c.id === data.message.chatId) {
              return {
                ...c,
                lastMessage: data.message,
                lastMessageAt: data.message.createdAt,
                unreadCount:
                  data.message.chatId !== activeChatId && data.message.senderId !== currentUser.id
                    ? (c.unreadCount || 0) + 1
                    : data.message.chatId === activeChatId
                    ? 0
                    : c.unreadCount,
              };
            }
            return c;
          });
        }
        return updated.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
      });

      // Auto notification, sound & vibration when receiving message from someone else
      if (data.message.senderId !== currentUser.id) {
        try {
          soundEffects.playMessagePop();
        } catch (_) {}

        const isNotActiveChat = data.message.chatId !== activeChatId;
        const isBackgrounded = typeof document !== 'undefined' && (document.hidden || !document.hasFocus());

        if (isNotActiveChat || isBackgrounded) {
          const sender = allUsers.find((u) => u.id === data.message.senderId) ||
            data.chat?.members?.find((m) => m.userId === data.message.senderId)?.user;
          const senderName = sender?.name || data.chat?.name || 'Someone';

          let preview = data.message.content || 'New message';
          if (data.message.type === 'image') preview = '📷 Photo';
          else if (data.message.type === 'video') preview = '🎥 Video';
          else if (data.message.type === 'audio') preview = '🎵 Voice message';
          else if (data.message.type === 'document') preview = '📄 Document';
          else if (data.message.type === 'location') preview = '📍 Location shared';
          else if (data.message.type === 'call') preview = data.message.content || '📞 Call';

          const notifTitle = data.chat?.isGroup && data.chat?.name
            ? `${data.chat.name} (${senderName})`
            : senderName;

          showMessageNotification({
            title: notifTitle,
            body: preview,
            icon: getAvatarUrl(sender?.avatar),
            chatId: data.message.chatId,
            onClick: () => {
              setActiveChatId(data.message.chatId);
            },
          });

          document.title = `(1) ${senderName}: ${preview.slice(0, 20)}...`;
        }
      }
    };

    const handleNewChat = (data: { chat: Chat }) => {
      const isMember =
        data.chat?.memberIds?.includes(currentUser.id) ||
        data.chat?.members?.some((m) => m.userId === currentUser.id);
      if (isMember) {
        setChats((prev) => {
          if (prev.some((c) => c.id === data.chat.id)) return prev;
          return [data.chat, ...prev];
        });
        fetchContacts(currentUser.id);
      }
    };

    const handleMessagesMarkedRead = (data: { chatId: string; userId: string }) => {
      if (data.chatId === activeChatId) {
        setMessages((prev) =>
          prev.map((m) => (m.status !== 'read' ? { ...m, status: 'read' } : m))
        );
      }
      setChats((prev) =>
        prev.map((c) => {
          if (c.id === data.chatId) {
            return {
              ...c,
              unreadCount: data.userId === currentUser.id ? 0 : c.unreadCount,
              lastMessage: c.lastMessage ? { ...c.lastMessage, status: 'read' } : c.lastMessage,
            };
          }
          return c;
        })
      );
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
          members: c.members?.map((m) =>
            m.userId === data.userId ? { ...m, user: { ...m.user, isOnline: data.isOnline } } : m
          ) || [],
        }))
      );
    };

    const handleMessageDeleted = (data: { messageId: string; chatId: string; forUserId?: string }) => {
      if (data.forUserId && data.forUserId !== currentUser.id) return;
      if (data.chatId === activeChatId) {
        setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
      }
      setChats((prev) =>
        prev.map((c) => {
          if (c.id === data.chatId && c.lastMessage?.id === data.messageId) {
            return { ...c, lastMessage: undefined };
          }
          return c;
        })
      );
    };

    const handleChatCleared = (data: { chatId: string; forUserId?: string }) => {
      if (data.forUserId && data.forUserId !== currentUser.id) return;
      if (data.chatId === activeChatId) {
        setMessages([]);
      }
      setChats((prev) =>
        prev.map((c) => (c.id === data.chatId ? { ...c, lastMessage: undefined, unreadCount: 0 } : c))
      );
    };

    const handleChatDeleted = (data: { chatId: string; forUserId?: string }) => {
      if (data.forUserId && data.forUserId !== currentUser.id) return;
      setChats((prev) => prev.filter((c) => c.id !== data.chatId));
      if (activeChatId === data.chatId) {
        setActiveChatId(null);
        setMessages([]);
      }
    };

    const handleUserUpdated = (data: { user: User }) => {
      setAllUsers((prev) => prev.map((u) => (u.id === data.user.id ? { ...u, ...data.user } : u)));
      setContacts((prev) => prev.map((u) => (u.id === data.user.id ? { ...u, ...data.user } : u)));
      setChats((prev) =>
        prev.map((c) => ({
          ...c,
          members: c.members?.map((m) =>
            m.userId === data.user.id ? { ...m, user: { ...m.user, ...data.user } } : m
          ),
        }))
      );
      if (currentUserRef.current?.id === data.user.id) {
        setCurrentUser((prev) => {
          const merged = prev ? { ...prev, ...data.user } : null;
          if (merged) {
            localStorage.setItem('ichat_user', JSON.stringify(merged));
          }
          return merged;
        });
      }
    };

    socket.on('new_message', handleNewMessage);
    socket.on('new_chat', handleNewChat);
    socket.on('messages_marked_read', handleMessagesMarkedRead);
    socket.on('user_typing', handleUserTyping);
    socket.on('user_stopped_typing', handleUserStoppedTyping);
    socket.on('user_status_changed', handleUserStatusChanged);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('chat_cleared', handleChatCleared);
    socket.on('chat_deleted', handleChatDeleted);
    socket.on('user_updated', handleUserUpdated);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('new_chat', handleNewChat);
      socket.off('messages_marked_read', handleMessagesMarkedRead);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stopped_typing', handleUserStoppedTyping);
      socket.off('user_status_changed', handleUserStatusChanged);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('chat_cleared', handleChatCleared);
      socket.off('chat_deleted', handleChatDeleted);
      socket.off('user_updated', handleUserUpdated);
    };
  }, [socket, activeChatId, currentUser]);

  // Periodic background refresh for chats & messages + window focus recovery (mobile resilient)
  useEffect(() => {
    if (!currentUser) return;

    const refreshData = async () => {
      try {
        const res = await fetch(`/api/chats?userId=${currentUser.id}`);
        if (res.ok) {
          const freshChats: Chat[] = await res.json();
          setChats((prev) => {
            return freshChats.map((fc) => (fc.id === activeChatId ? { ...fc, unreadCount: 0 } : fc));
          });
        }

        if (activeChatId) {
          const mRes = await fetch(`/api/chats/${activeChatId}/messages?userId=${currentUser.id}`);
          if (mRes.ok) {
            const freshMsgs: Message[] = await mRes.json();
            setMessages(freshMsgs);
          }
        }
      } catch (e) {
        // Ignore network glitches
      }
    };

    const interval = setInterval(refreshData, 3000);

    const handleFocus = () => {
      if (socket && socket.connected && currentUser) {
        socket.emit('user_connected', currentUser.id);
      }
      refreshData();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        handleFocus();
      }
    });

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [currentUser, activeChatId, socket]);

  // Send message handler
  const handleSendMessage = (
    content: string,
    type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'product' | 'call' = 'text',
    metadata?: string,
    mediaUrl?: string
  ) => {
    if (!socket || !activeChatId || !currentUser) return;

    socket.emit('send_message', {
      chatId: activeChatId,
      senderId: currentUser.id,
      content,
      type,
      metadata,
      mediaUrl,
    });
  };

  // Start 1-on-1 Calls
  const handleStartAudioCall = () => {
    const activeChat = chats.find((c) => c.id === activeChatId);
    if (!activeChat || !currentUser) return;

    if (activeChat.isGroup) {
      webrtc.joinGroupCall(activeChat.id, { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar }, false);
    } else {
      const other = activeChat.members?.find((m) => m.userId !== currentUser.id)?.user;
      if (other) {
        webrtc.startCall(other.id, other.name, other.avatar, false, activeChat.id, currentUser.name, currentUser.avatar);
      }
    }
  };

  const handleStartVideoCall = () => {
    const activeChat = chats.find((c) => c.id === activeChatId);
    if (!activeChat || !currentUser) return;

    if (activeChat.isGroup) {
      webrtc.joinGroupCall(activeChat.id, { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar }, true);
    } else {
      const other = activeChat.members?.find((m) => m.userId !== currentUser.id)?.user;
      if (other) {
        webrtc.startCall(other.id, other.name, other.avatar, true, activeChat.id, currentUser.name, currentUser.avatar);
      }
    }
  };

  const handleLoginSuccess = (user: User) => {
    localStorage.setItem('ichat_user', JSON.stringify(user));
    setCurrentUser(user);
    setActiveChatId(null);
    fetch('/api/users')
      .then((r) => r.json())
      .then((data) => setAllUsers(data))
      .catch(() => {});
  };

  const handleLogout = () => {
    localStorage.removeItem('ichat_user');
    localStorage.removeItem('whatsapp_user');
    setCurrentUser(null);
    setActiveChatId(null);
    setMessages([]);
  };

  // Delete individual message
  const handleDeleteMessage = async (messageId: string, mode: 'for_me' | 'for_everyone' = 'for_me') => {
    if (!currentUser) return;
    try {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, mode }),
      });
    } catch (err) {
      console.error('Error deleting message:', err);
    }
  };

  // Delete multiple messages (WhatsApp select & delete)
  const handleDeleteMessages = async (messageIds: string[], mode: 'for_me' | 'for_everyone' = 'for_me') => {
    if (!messageIds || messageIds.length === 0 || !currentUser) return;
    try {
      setMessages((prev) => prev.filter((m) => !messageIds.includes(m.id)));
      await Promise.all(
        messageIds.map((id) =>
          fetch(`/api/messages/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, mode }),
          }).catch(() => {})
        )
      );
    } catch (err) {
      console.error('Error deleting messages:', err);
    }
  };

  // Clear all messages in current chat
  const handleClearChat = async (targetId?: string) => {
    const id = targetId || activeChatId;
    if (!id || !currentUser) return;
    try {
      if (id === activeChatId) setMessages([]);
      setChats((prev) =>
        prev.map((c) => (c.id === id ? { ...c, lastMessage: undefined, unreadCount: 0 } : c))
      );
      await fetch(`/api/chats/${id}/messages`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
    } catch (err) {
      console.error('Error clearing chat:', err);
    }
  };

  // Delete chat conversation
  const handleDeleteChat = async (targetChatId?: string) => {
    const id = targetChatId || activeChatId;
    if (!id || !currentUser) return;
    try {
      setChats((prev) => prev.filter((c) => c.id !== id));
      if (activeChatId === id) {
        setActiveChatId(null);
        setMessages([]);
      }
      await fetch(`/api/chats/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
    } catch (err) {
      console.error('Error deleting chat:', err);
    }
  };

  // Delete multiple chats (WhatsApp select & delete)
  const handleDeleteChats = async (chatIds: string[]) => {
    if (!chatIds || chatIds.length === 0 || !currentUser) return;
    try {
      setChats((prev) => prev.filter((c) => !chatIds.includes(c.id)));
      if (activeChatId && chatIds.includes(activeChatId)) {
        setActiveChatId(null);
        setMessages([]);
      }
      await Promise.all(
        chatIds.map((id) =>
          fetch(`/api/chats/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id }),
          }).catch(() => {})
        )
      );
    } catch (err) {
      console.error('Error deleting multiple chats:', err);
    }
  };

  // Select Wallpaper
  const handleSelectWallpaper = (wallpaper: string) => {
    setCustomWallpaper(wallpaper);
    localStorage.setItem('ichat_chat_wallpaper', wallpaper);
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
      setStatuses((prev) => [newStatus, ...prev]);
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

  // Create Group Chat
  const handleCreateGroupChat = async (name: string, description: string, memberIds: string[]) => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/chats/group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          creatorId: currentUser.id,
          memberIds,
        }),
      });
      const newChat: Chat = await res.json();
      setChats((prev) => [newChat, ...prev]);
      setActiveChatId(newChat.id);
    } catch (err) {
      console.error('Error creating group chat:', err);
    }
  };

  // Direct chat selection
  const handleStartDirectChat = async (targetUserId: string) => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/chats/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentUserId: currentUser.id,
          targetUserId,
        }),
      });
      const directChat: Chat = await res.json();
      setChats((prev) => {
        if (prev.some((c) => c.id === directChat.id)) return prev;
        return [directChat, ...prev];
      });
      setActiveChatId(directChat.id);
    } catch (err) {
      console.error('Error starting direct chat:', err);
    }
  };

  const handleSelectChat = (chatId: string) => {
    setActiveChatId(chatId);
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, unreadCount: 0 } : c))
    );

    if (currentUser) {
      fetch(`/api/chats/${chatId}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      }).catch(() => {});

      if (socket) {
        socket.emit('mark_messages_read', { chatId, userId: currentUser.id });
      }
    }
  };

  // Add Contact handler by Phone, Name, or ID
  const handleAddContact = async (query: string): Promise<{ success: boolean; message?: string }> => {
    if (!currentUser) return { success: false, message: 'Please log in first' };
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, query }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.error || 'User not found' };
      }
      await fetchContacts(currentUser.id);
      const userChats: Chat[] = await fetch(`/api/chats?userId=${currentUser.id}`).then((r) => r.json());
      setChats(userChats);
      if (data.chat) {
        setActiveChatId(data.chat.id);
      }
      return { success: true, message: `Added "${data.contact.name}" to your contacts!` };
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to add contact' };
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
      />
    );
  }

  return (
    <div className="fixed inset-0 h-full w-full flex bg-[#111b21] text-white overflow-hidden font-sans">
      {/* 1. Sidebar */}
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        currentUser={currentUser}
        onOpenNewChat={() => setShowNewChat(true)}
        onOpenCallsHistory={() => setShowCallsHistory(true)}
        onOpenStatus={() => setShowStatus(true)}
        onOpenCatalog={() => setShowCatalog(true)}
        onOpenLabels={() => setShowLabels(true)}
        onOpenMyProfile={() => setProfileModalUser(currentUser)}
        onOpenAdminDashboard={() => setShowAdminDashboard(true)}
        pendingUsersCount={pendingUsersCount}
        onLogout={handleLogout}
        onDeleteChat={handleDeleteChat}
        onDeleteChats={handleDeleteChats}
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
          onBack={() => setActiveChatId(null)}
          onDeleteMessage={handleDeleteMessage}
          onDeleteMessages={handleDeleteMessages}
          onClearChat={handleClearChat}
          onDeleteChat={() => handleDeleteChat(activeChat.id)}
          onOpenWallpaper={() => setShowWallpaperModal(true)}
          customWallpaper={customWallpaper}
        />
      ) : (
        <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-[#222e35] border-b-[6px] border-[#00a884] p-8 text-center">
          <div className="max-w-md flex flex-col items-center">
            <div className="w-24 h-24 rounded-3xl bg-[#111b21] flex items-center justify-center mb-6 shadow-xl border border-[#2a3942] p-3">
              <img src="/logo.png" alt="IChat" className="w-full h-full object-contain" />
            </div>
            <h2 className="text-2xl font-semibold text-white mb-2">IChat Web</h2>
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
          onLogout={handleLogout}
          onOpenWallpaper={() => setShowWallpaperModal(true)}
          onUpdateProfile={(updated) => {
            const merged = { ...currentUser, ...updated };
            setCurrentUser(merged);
            localStorage.setItem('ichat_user', JSON.stringify(merged));
            setAllUsers((prev) =>
              prev.map((u) => (u.id === currentUser.id ? { ...u, ...updated } : u))
            );
            fetch(`/api/users/${currentUser.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updated),
            }).catch(() => {});
          }}
        />
      )}

      {/* 8. Labels Modal */}
      <LabelsModal
        isOpen={showLabels}
        onClose={() => setShowLabels(false)}
        labels={labels}
        selectedLabelId={selectedLabelId}
        onSelectFilterLabel={(labelId: string | null) => setSelectedLabelId(labelId)}
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

      {/* 10. New Chat Modal */}
      <NewChatModal
        isOpen={showNewChat}
        onClose={() => setShowNewChat(false)}
        contacts={contacts}
        currentUserId={currentUser.id}
        onStartDirectChat={handleStartDirectChat}
        onCreateGroupChat={handleCreateGroupChat}
        onAddContact={handleAddContact}
      />

      {/* 11. Super Admin Dashboard Modal (User Approvals & Chat Monitoring) */}
      {currentUser && (currentUser.role === 'admin' || currentUser.phone === '02054245616' || currentUser.phone?.toLowerCase() === 'admin') && (
        <AdminDashboardModal
          isOpen={showAdminDashboard}
          onClose={() => {
            setShowAdminDashboard(false);
            fetch('/api/admin/overview', { headers: { 'x-admin-id': currentUser.id } })
              .then((r) => r.json())
              .then((d) => setPendingUsersCount(d.pendingCount || 0))
              .catch(() => {});
          }}
          currentUser={currentUser}
        />
      )}

      {/* 12. Call History Modal */}
      {showCallsHistory && currentUser && (
        <CallsHistoryModal
          currentUser={currentUser}
          onClose={() => setShowCallsHistory(false)}
          onStartCall={(targetUser, isVideo) => {
            setShowCallsHistory(false);
            const directChat = chats.find(
              (c) => !c.isGroup && c.members?.some((m) => m.userId === targetUser.id)
            );
            if (directChat) {
              setActiveChatId(directChat.id);
            }
            webrtc.startCall(
              targetUser.id,
              targetUser.name,
              targetUser.avatar,
              isVideo,
              directChat?.id,
              currentUser.name,
              currentUser.avatar
            );
          }}
        />
      )}

      {/* 13. Chat Wallpaper Customizer Modal */}
      <WallpaperModal
        isOpen={showWallpaperModal}
        onClose={() => setShowWallpaperModal(false)}
        currentWallpaper={customWallpaper}
        onSelectWallpaper={handleSelectWallpaper}
      />
    </div>
  );
};
