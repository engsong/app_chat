import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  CircleDashed,
  ShoppingBag,
  Tag,
  Search,
  Check,
  CheckCheck,
  X,
  Phone,
  PhoneCall,
  Trash2,
  ArrowLeft,
  Camera,
  MoreVertical,
  Users,
  MessageSquarePlus,
  Star,
  Settings,
  LogOut,
  Bell,
  BellOff,
} from 'lucide-react';
import { Chat, User, Label } from '../../types/index.js';
import { getAvatarUrl } from '../../utils/avatar.js';
import {
  requestNotificationPermission,
  isNotificationSupported,
  getNotificationPermission,
  subscribeUserToWebPush,
  sendTestPushNotification,
} from '../../utils/notifications.js';
import { NotificationHelpModal } from './NotificationHelpModal.js';

interface SidebarProps {
  chats: Chat[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  currentUser: User;
  onOpenNewChat: () => void;
  onOpenCallsHistory: () => void;
  onOpenStatus: () => void;
  onOpenCatalog: () => void;
  onOpenLabels: () => void;
  onOpenMyProfile: () => void;
  onOpenAdminDashboard?: () => void;
  pendingUsersCount?: number;
  onLogout: () => void;
  onDeleteChat?: (chatId: string) => void;
  onDeleteChats?: (chatIds: string[]) => void;
  selectedLabelId: string | null;
  onClearLabelFilter: () => void;
  labels: Label[];
}

type TabFilter = 'all' | 'unread' | 'favorites' | 'groups';
type BottomTab = 'chats' | 'updates' | 'communities' | 'calls' | 'you';

export const Sidebar: React.FC<SidebarProps> = ({
  chats,
  activeChatId,
  onSelectChat,
  currentUser,
  onOpenNewChat,
  onOpenCallsHistory,
  onOpenStatus,
  onOpenCatalog,
  onOpenLabels,
  onOpenMyProfile,
  onOpenAdminDashboard,
  pendingUsersCount,
  onLogout,
  onDeleteChat,
  onDeleteChats,
  selectedLabelId,
  onClearLabelFilter,
  labels,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTabFilter, setActiveTabFilter] = useState<TabFilter>('all');
  const [activeBottomTab, setActiveBottomTab] = useState<BottomTab>('chats');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);
  const [showDeleteChatsModal, setShowDeleteChatsModal] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() => {
    return isNotificationSupported() ? getNotificationPermission() : 'denied';
  });
  const [showNotifBanner, setShowNotifBanner] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return isNotificationSupported() && getNotificationPermission() !== 'granted';
  });
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);

  const moreMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close more menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    if (showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMoreMenu]);

  const handleEnableNotifications = async () => {
    const res = await requestNotificationPermission();
    setNotifPermission(res);
    if (res === 'granted') {
      setShowNotifBanner(false);
      setShowHelpModal(false);
      const subscribed = await subscribeUserToWebPush(currentUser.id, true);
      if (subscribed) {
        await sendTestPushNotification(currentUser.id);
        alert('✅ Notifications enabled! A test notification was sent to your device.');
      } else {
        alert('✅ Notifications enabled for IChat.');
      }
    } else if (res === 'denied') {
      setShowHelpModal(true);
    }
  };

  const handleCheckPermissionFromModal = async () => {
    const current = getNotificationPermission();
    setNotifPermission(current);
    if (current === 'granted') {
      setShowHelpModal(false);
      setShowNotifBanner(false);
      const subscribed = await subscribeUserToWebPush(currentUser.id, true);
      if (subscribed) {
        await sendTestPushNotification(currentUser.id);
        alert('🎉 Awesome! Notifications are now active. A test notification was sent to your screen.');
      } else {
        alert('🎉 Notifications are now active!');
      }
    } else {
      alert('Notifications are still blocked in Chrome settings. Please follow Step 1-3 above to allow chat.on-excapp.app.');
    }
  };

  const chatLongPressTimerRef = useRef<any>(null);
  const chatTouchMovedRef = useRef(false);

  const toggleSelectChat = (chatId: string) => {
    setSelectedChatIds((prev) =>
      prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [...prev, chatId]
    );
  };

  const handleChatTouchStart = (chatId: string) => {
    chatTouchMovedRef.current = false;
    chatLongPressTimerRef.current = setTimeout(() => {
      if (!chatTouchMovedRef.current) {
        toggleSelectChat(chatId);
        if (navigator.vibrate) {
          try { navigator.vibrate(40); } catch (_) {}
        }
      }
    }, 450);
  };

  const handleChatTouchMove = () => {
    chatTouchMovedRef.current = true;
    if (chatLongPressTimerRef.current) {
      clearTimeout(chatLongPressTimerRef.current);
      chatLongPressTimerRef.current = null;
    }
  };

  const handleChatTouchEnd = () => {
    if (chatLongPressTimerRef.current) {
      clearTimeout(chatLongPressTimerRef.current);
      chatLongPressTimerRef.current = null;
    }
  };

  const handleConfirmDeleteChats = () => {
    if (selectedChatIds.length === 0) return;
    if (onDeleteChats) {
      onDeleteChats(selectedChatIds);
    } else if (onDeleteChat) {
      selectedChatIds.forEach((id) => onDeleteChat(id));
    }
    setSelectedChatIds([]);
    setShowDeleteChatsModal(false);
  };

  // Calculate counts for badges
  const totalUnreadCount = chats.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  const groupsCount = chats.filter((c) => c.isGroup).length;

  // Filter chats by search, category tab filter, and label
  const filteredChats = chats.filter((c) => {
    // 1. Label filter
    if (selectedLabelId) {
      const hasLabel = c.labels?.some((l) => l.id === selectedLabelId);
      if (!hasLabel) return false;
    }

    // 2. Tab Category filter
    if (activeTabFilter === 'unread') {
      if (!c.unreadCount || c.unreadCount <= 0) return false;
    } else if (activeTabFilter === 'groups') {
      if (!c.isGroup) return false;
    } else if (activeTabFilter === 'favorites') {
      const otherMember = c.members?.find((m) => m.userId !== currentUser.id)?.user;
      if (!otherMember?.isBusiness && !c.isGroup) {
        // Can be customized if favorites tag exists
      }
    }

    // 3. Search query filter
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();

    if (c.isGroup && c.name?.toLowerCase().includes(q)) return true;

    const otherMember = c.members?.find((m) => m.userId !== currentUser.id)?.user;
    if (otherMember?.name?.toLowerCase().includes(q)) return true;
    if (otherMember?.businessName?.toLowerCase().includes(q)) return true;
    if (c.lastMessage?.content?.toLowerCase().includes(q)) return true;

    return false;
  });

  const activeFilterLabel = labels.find((l) => l.id === selectedLabelId);

  return (
    <div
      className={`${
        activeChatId ? 'hidden md:flex' : 'flex'
      } w-full md:w-96 lg:w-[420px] h-full min-h-0 flex-col bg-[#111b21] border-r border-[#202c33] z-20 flex-shrink-0 relative`}
    >
      {/* 1. Header: Selection Mode vs Normal WhatsApp Header */}
      {selectedChatIds.length > 0 ? (
        <div className="h-16 px-4 bg-[#202c33] flex items-center justify-between border-b border-[#2a3942] animate-fade-in flex-shrink-0">
          {/* Back button & Selection Count */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedChatIds([])}
              className="p-2 -ml-1 text-gray-200 hover:text-white rounded-full hover:bg-[#374248] transition-colors"
              title="Cancel selection"
              aria-label="Cancel selection"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <span className="text-xl font-semibold text-white tracking-wide">
              {selectedChatIds.length}
            </span>
          </div>

          {/* Delete Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDeleteChatsModal(true)}
              className="p-2.5 rounded-full hover:bg-[#374248] text-white hover:text-red-400 transition-colors"
              title="Delete selected conversation(s)"
              aria-label="Delete selected conversation(s)"
            >
              <Trash2 className="w-5 h-5 text-white hover:text-red-400" />
            </button>
          </div>
        </div>
      ) : (
        <div className="h-16 px-4 bg-[#111b21] flex items-center justify-between border-b border-[#202c33] flex-shrink-0">
          {/* WhatsApp / IChat Title */}
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white select-none">
              WhatsApp
            </h1>
          </div>

          {/* Top Right Action Icons */}
          <div className="flex items-center gap-1 text-[#aebac1]">
            {/* Camera Icon */}
            <button
              onClick={onOpenStatus}
              className="p-2 rounded-full hover:bg-[#202c33] text-gray-200 hover:text-white transition-colors"
              title="Camera / Updates"
            >
              <Camera className="w-5 h-5" />
            </button>

            {/* Three Dots Menu Icon */}
            <div className="relative" ref={moreMenuRef}>
              <button
                onClick={() => setShowMoreMenu((prev) => !prev)}
                className="p-2 rounded-full hover:bg-[#202c33] text-gray-200 hover:text-white transition-colors"
                title="More options"
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {/* WhatsApp Dropdown Menu */}
              {showMoreMenu && (
                <div className="absolute right-0 top-12 w-56 bg-[#233138] border border-[#2a3942] rounded-2xl shadow-2xl py-2 z-50 text-sm text-gray-200 animate-scale-up">
                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      onOpenNewChat();
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-[#182229] hover:text-white flex items-center gap-3 transition-colors"
                  >
                    <MessageSquarePlus className="w-4 h-4 text-[#00a884]" />
                    <span>New chat or group</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      onOpenStatus();
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-[#182229] hover:text-white flex items-center gap-3 transition-colors"
                  >
                    <CircleDashed className="w-4 h-4 text-[#00a884]" />
                    <span>Status & Updates</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      onOpenCatalog();
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-[#182229] hover:text-white flex items-center gap-3 transition-colors"
                  >
                    <ShoppingBag className="w-4 h-4 text-[#00a884]" />
                    <span>Business Catalog</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      onOpenLabels();
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-[#182229] hover:text-white flex items-center gap-3 transition-colors"
                  >
                    <Tag className="w-4 h-4 text-[#00a884]" />
                    <span>Labels & Tags</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      onOpenCallsHistory();
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-[#182229] hover:text-white flex items-center gap-3 transition-colors"
                  >
                    <PhoneCall className="w-4 h-4 text-[#00a884]" />
                    <span>Calls history</span>
                  </button>

                  <div className="border-t border-[#2a3942] my-1" />

                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      onOpenMyProfile();
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-[#182229] hover:text-white flex items-center gap-3 transition-colors"
                  >
                    <Settings className="w-4 h-4 text-[#00a884]" />
                    <span>Settings & Profile</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      onLogout();
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-[#182229] text-red-400 hover:text-red-300 flex items-center gap-3 transition-colors"
                  >
                    <LogOut className="w-4 h-4 text-red-400" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. WhatsApp Modern Pill Search Bar */}
      <div className="px-3 pt-2 pb-2.5 bg-[#111b21] flex-shrink-0">
        <div className="flex items-center gap-2.5 bg-[#202c33] rounded-full px-4 py-2 border border-transparent focus-within:border-[#00a884]/40 transition-all">
          <Search className="w-4 h-4 text-[#8696a0] flex-shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Ask Meta AI or Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-[13px] text-white placeholder-[#8696a0] w-full focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-[#8696a0] hover:text-white transition-colors"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 3. WhatsApp Filter Pills Row (All, Unread, Favorites, Groups) */}
        <div className="flex items-center gap-2 mt-2.5 overflow-x-auto no-scrollbar pb-0.5 select-none">
          {/* All */}
          <button
            onClick={() => setActiveTabFilter('all')}
            className={`px-3 py-1 rounded-full text-xs transition-all whitespace-nowrap flex-shrink-0 font-medium ${
              activeTabFilter === 'all'
                ? 'bg-[#103629] text-[#25d366] border border-[#25d366]/40'
                : 'bg-[#202c33] text-[#8696a0] hover:text-white hover:bg-[#2a3942]'
            }`}
          >
            All
          </button>

          {/* Unread */}
          <button
            onClick={() => setActiveTabFilter('unread')}
            className={`px-3 py-1 rounded-full text-xs transition-all whitespace-nowrap flex-shrink-0 font-medium flex items-center gap-1.5 ${
              activeTabFilter === 'unread'
                ? 'bg-[#103629] text-[#25d366] border border-[#25d366]/40'
                : 'bg-[#202c33] text-[#8696a0] hover:text-white hover:bg-[#2a3942]'
            }`}
          >
            <span>Unread</span>
            {totalUnreadCount > 0 && (
              <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.2 ${
                activeTabFilter === 'unread' ? 'bg-[#25d366] text-[#0b141a]' : 'bg-[#00a884] text-white'
              }`}>
                {totalUnreadCount}
              </span>
            )}
          </button>

          {/* Favorites */}
          <button
            onClick={() => setActiveTabFilter('favorites')}
            className={`px-3 py-1 rounded-full text-xs transition-all whitespace-nowrap flex-shrink-0 font-medium ${
              activeTabFilter === 'favorites'
                ? 'bg-[#103629] text-[#25d366] border border-[#25d366]/40'
                : 'bg-[#202c33] text-[#8696a0] hover:text-white hover:bg-[#2a3942]'
            }`}
          >
            Favorites
          </button>

          {/* Groups */}
          <button
            onClick={() => setActiveTabFilter('groups')}
            className={`px-3 py-1 rounded-full text-xs transition-all whitespace-nowrap flex-shrink-0 font-medium flex items-center gap-1.5 ${
              activeTabFilter === 'groups'
                ? 'bg-[#103629] text-[#25d366] border border-[#25d366]/40'
                : 'bg-[#202c33] text-[#8696a0] hover:text-white hover:bg-[#2a3942]'
            }`}
          >
            <span>Groups</span>
            {groupsCount > 0 && (
              <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.2 ${
                activeTabFilter === 'groups' ? 'bg-[#25d366] text-[#0b141a]' : 'bg-[#2a3942] text-gray-300'
              }`}>
                {groupsCount}
              </span>
            )}
          </button>
        </div>

        {/* Active Label Filter Banner if user filtered by label */}
        {activeFilterLabel && (
          <div className="flex items-center justify-between mt-2 px-3 py-1 bg-[#202c33] rounded-lg border border-[#2a3942]">
            <div className="flex items-center gap-2 text-xs text-white">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activeFilterLabel.color }} />
              <span>Label: <strong>{activeFilterLabel.name}</strong></span>
            </div>
            <button onClick={onClearLabelFilter} className="text-gray-400 hover:text-white p-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Notification Prompt Banner if permission not yet granted */}
      {showNotifBanner && (
        <div className="bg-[#182229] border-b border-[#00a884]/30 px-3 py-2 flex items-center justify-between text-xs animate-fade-in flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <Bell className="w-4 h-4 text-[#00a884] flex-shrink-0" />
            <span className="text-[#d1d7db] truncate">Get alerts for calls & messages</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleEnableNotifications}
              className="px-2.5 py-1 bg-[#00a884] text-white rounded-md font-medium text-[11px] hover:bg-[#008f6f] transition-colors shadow-sm"
            >
              Turn On
            </button>
            <button
              onClick={() => setShowNotifBanner(false)}
              className="text-[#8696a0] hover:text-white p-1"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 4. Chat List (WhatsApp Item Styling) */}
      <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[#202c33]/40 pb-20 sm:pb-4">
        {filteredChats.map((chat) => {
          const isSelected = chat.id === activeChatId;
          const isMarkedSelected = selectedChatIds.includes(chat.id);
          const isGroup = chat.isGroup;
          const otherMember = chat.members?.find((m) => m.userId !== currentUser.id)?.user;
          const title = isGroup ? chat.name : (otherMember?.businessName || otherMember?.name || 'Chat');
          const avatar = isGroup
            ? getAvatarUrl(chat.avatar)
            : getAvatarUrl(otherMember?.avatar);
          const isBusiness = !isGroup && otherMember?.isBusiness;

          const lastMsg = chat.lastMessage;
          const isMe = lastMsg?.senderId === currentUser.id;
          const time = lastMsg ? new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
          const hasUnread = (chat.unreadCount || 0) > 0;

          return (
            <div
              key={chat.id}
              onClick={() => {
                if (selectedChatIds.length > 0) {
                  toggleSelectChat(chat.id);
                } else {
                  onSelectChat(chat.id);
                }
              }}
              onTouchStart={() => handleChatTouchStart(chat.id)}
              onTouchMove={handleChatTouchMove}
              onTouchEnd={handleChatTouchEnd}
              onContextMenu={(e) => {
                e.preventDefault();
                toggleSelectChat(chat.id);
              }}
              className={`flex items-center gap-3.5 px-3.5 py-3 cursor-pointer transition-colors select-none group relative ${
                isMarkedSelected
                  ? 'bg-[#2a3942]'
                  : isSelected
                  ? 'bg-[#2a3942]'
                  : 'hover:bg-[#202c33]'
              }`}
            >
              {/* Checkbox overlay when selecting */}
              {selectedChatIds.length > 0 && (
                <div className="flex-shrink-0 animate-scale-up">
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                      isMarkedSelected
                        ? 'bg-[#00a884] text-white'
                        : 'border border-gray-500 bg-transparent'
                    }`}
                  >
                    {isMarkedSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>
              )}

              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <img
                  src={avatar}
                  alt={title}
                  className="w-12 h-12 rounded-full object-cover ring-1 ring-white/10"
                />
                {isBusiness && (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[#00a884] text-white rounded-full flex items-center justify-center text-[9px] ring-2 ring-[#111b21]"
                    title="Business Account"
                  >
                    ✓
                  </span>
                )}
              </div>

              {/* Chat Info */}
              <div className="flex-1 min-w-0">
                {/* Title & Time */}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[15px] font-semibold text-white truncate max-w-[200px] group-hover:text-white">
                    {title}
                  </span>
                  <span
                    className={`text-[11px] font-normal flex-shrink-0 ${
                      hasUnread ? 'text-[#25D366] font-semibold' : 'text-[#8696a0]'
                    }`}
                  >
                    {time}
                  </span>
                </div>

                {/* Last Message & Unread Badge */}
                <div className="flex items-center justify-between text-xs text-[#8696a0]">
                  <div className="flex items-center gap-1 truncate max-w-[220px]">
                    {isMe && lastMsg && (
                      <span
                        className="inline-flex items-center flex-shrink-0"
                        title={
                          lastMsg.status === 'read'
                            ? 'Read'
                            : lastMsg.status === 'delivered'
                            ? 'Delivered'
                            : 'Sent'
                        }
                      >
                        {lastMsg.status === 'read' ? (
                          <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] inline" />
                        ) : lastMsg.status === 'delivered' ? (
                          <CheckCheck className="w-3.5 h-3.5 text-[#8696a0] inline" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-[#8696a0] inline" />
                        )}
                      </span>
                    )}
                    <span className="truncate text-[#8696a0]">
                      {lastMsg?.type === 'product'
                        ? '🛍️ Shared a product'
                        : lastMsg?.type === 'audio'
                        ? '🎤 Voice message'
                        : lastMsg?.content || 'Tap to chat'}
                    </span>
                  </div>

                  {/* Badges / Unread Count */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {chat.labels && chat.labels.length > 0 && (
                      <div className="flex gap-1">
                        {chat.labels.slice(0, 2).map((lbl) => (
                          <span
                            key={lbl.id}
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: lbl.color }}
                            title={lbl.name}
                          />
                        ))}
                      </div>
                    )}
                    {hasUnread && (
                      <span className="min-w-[20px] h-[20px] px-1.5 rounded-full bg-[#25D366] text-[#0b141a] text-[11px] font-bold flex items-center justify-center">
                        {chat.unreadCount}
                      </span>
                    )}

                    {/* Delete chat button (hover or touch) */}
                    {(onDeleteChat || onDeleteChats) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedChatIds([chat.id]);
                          setShowDeleteChatsModal(true);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-rose-500/20 text-[#8696a0] hover:text-rose-400 transition-all ml-0.5"
                        title="Delete chat"
                        aria-label="Delete chat"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filteredChats.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-25" />
            <p className="text-xs">No conversations found</p>
          </div>
        )}
      </div>

      {/* 5. WhatsApp Floating Action Button (FAB) at Bottom Right */}
      <button
        onClick={onOpenNewChat}
        className="fixed sm:absolute bottom-20 right-4 sm:bottom-20 sm:right-5 w-14 h-14 bg-[#25D366] hover:bg-[#20ba59] active:scale-95 text-[#0b141a] rounded-2xl shadow-2xl flex items-center justify-center transition-all z-30"
        title="New Chat"
        aria-label="New Chat"
      >
        <MessageSquarePlus className="w-6 h-6 fill-current text-[#0b141a]" />
      </button>

      {/* 6. WhatsApp Bottom Navigation Bar (5 Tabs) */}
      <div className="h-16 bg-[#111b21] border-t border-[#202c33] flex items-center justify-around px-2 flex-shrink-0 z-20">
        {/* Tab 1: Chats */}
        <button
          onClick={() => setActiveBottomTab('chats')}
          className="flex flex-col items-center justify-center gap-1 flex-1 py-1 group transition-colors"
        >
          <div
            className={`px-4 py-0.5 rounded-full transition-all relative ${
              activeBottomTab === 'chats'
                ? 'bg-[#103629] text-[#25d366]'
                : 'text-gray-400 group-hover:text-white'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            {totalUnreadCount > 0 && (
              <span className="absolute -top-1 right-2 min-w-4 h-4 px-1 rounded-full bg-[#25D366] text-[#0b141a] text-[9px] font-bold flex items-center justify-center">
                {totalUnreadCount}
              </span>
            )}
          </div>
          <span
            className={`text-[11px] font-medium leading-none ${
              activeBottomTab === 'chats' ? 'text-white font-bold' : 'text-gray-400'
            }`}
          >
            Chats
          </span>
        </button>

        {/* Tab 2: Updates (Status / Stories) */}
        <button
          onClick={() => {
            setActiveBottomTab('updates');
            onOpenStatus();
          }}
          className="flex flex-col items-center justify-center gap-1 flex-1 py-1 group transition-colors"
        >
          <div
            className={`px-4 py-0.5 rounded-full transition-all ${
              activeBottomTab === 'updates'
                ? 'bg-[#103629] text-[#25d366]'
                : 'text-gray-400 group-hover:text-white'
            }`}
          >
            <CircleDashed className="w-5 h-5" />
          </div>
          <span
            className={`text-[11px] font-medium leading-none ${
              activeBottomTab === 'updates' ? 'text-white font-bold' : 'text-gray-400'
            }`}
          >
            Updates
          </span>
        </button>

        {/* Tab 3: Communities (Catalog / Tools) */}
        <button
          onClick={() => {
            setActiveBottomTab('communities');
            onOpenCatalog();
          }}
          className="flex flex-col items-center justify-center gap-1 flex-1 py-1 group transition-colors"
        >
          <div
            className={`px-4 py-0.5 rounded-full transition-all ${
              activeBottomTab === 'communities'
                ? 'bg-[#103629] text-[#25d366]'
                : 'text-gray-400 group-hover:text-white'
            }`}
          >
            <Users className="w-5 h-5" />
          </div>
          <span
            className={`text-[11px] font-medium leading-none ${
              activeBottomTab === 'communities' ? 'text-white font-bold' : 'text-gray-400'
            }`}
          >
            Communities
          </span>
        </button>

        {/* Tab 4: Calls */}
        <button
          onClick={() => {
            setActiveBottomTab('calls');
            onOpenCallsHistory();
          }}
          className="flex flex-col items-center justify-center gap-1 flex-1 py-1 group transition-colors"
        >
          <div
            className={`px-4 py-0.5 rounded-full transition-all ${
              activeBottomTab === 'calls'
                ? 'bg-[#103629] text-[#25d366]'
                : 'text-gray-400 group-hover:text-white'
            }`}
          >
            <Phone className="w-5 h-5" />
          </div>
          <span
            className={`text-[11px] font-medium leading-none ${
              activeBottomTab === 'calls' ? 'text-white font-bold' : 'text-gray-400'
            }`}
          >
            Calls
          </span>
        </button>

        {/* Tab 5: You (Profile & Settings) */}
        <button
          onClick={() => {
            setActiveBottomTab('you');
            onOpenMyProfile();
          }}
          className="flex flex-col items-center justify-center gap-1 flex-1 py-1 group transition-colors"
        >
          <div
            className={`p-0.5 rounded-full transition-all ${
              activeBottomTab === 'you'
                ? 'ring-2 ring-[#25d366]'
                : 'ring-1 ring-white/20 group-hover:ring-white'
            }`}
          >
            <img
              src={getAvatarUrl(currentUser.avatar)}
              alt={currentUser.name}
              className="w-5 h-5 rounded-full object-cover"
            />
          </div>
          <span
            className={`text-[11px] font-medium leading-none ${
              activeBottomTab === 'you' ? 'text-white font-bold' : 'text-gray-400'
            }`}
          >
            You
          </span>
        </button>
      </div>

      {/* WhatsApp-style Delete Conversation Modal */}
      {showDeleteChatsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setShowDeleteChatsModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#2a3942] border border-[#3b4a54] rounded-2xl max-w-sm w-full p-6 shadow-2xl text-left animate-scale-up"
          >
            <h3 className="text-base font-semibold text-white mb-2">
              Delete {selectedChatIds.length > 1 ? `${selectedChatIds.length} chats` : 'this chat'}?
            </h3>
            <p className="text-xs text-[#aebac1] mb-6">
              Messages and media will be permanently removed for selected chat{selectedChatIds.length > 1 ? 's' : ''}.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleConfirmDeleteChats}
                className="w-full py-2.5 px-4 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium text-xs transition-colors text-center"
              >
                Delete chat{selectedChatIds.length > 1 ? 's' : ''}
              </button>
              <button
                onClick={() => setShowDeleteChatsModal(false)}
                className="w-full py-2 px-4 rounded-xl text-[#8696a0] hover:text-white text-xs transition-colors text-center"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Help Guide Modal for unblocking permissions */}
      <NotificationHelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        onCheckPermission={handleCheckPermissionFromModal}
      />
    </div>
  );
};
