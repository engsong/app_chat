import React, { useState } from 'react';
import {
  MessageSquare,
  CircleDashed,
  ShoppingBag,
  Tag,
  Search,
  ShieldCheck,
  Check,
  CheckCheck,
  X,
  LogOut
} from 'lucide-react';
import { Chat, User, Label } from '../../types/index.js';

interface SidebarProps {
  chats: Chat[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  currentUser: User;
  onOpenNewChat: () => void;
  onOpenStatus: () => void;
  onOpenCatalog: () => void;
  onOpenLabels: () => void;
  onOpenMyProfile: () => void;
  onLogout: () => void;
  selectedLabelId: string | null;
  onClearLabelFilter: () => void;
  labels: Label[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  chats,
  activeChatId,
  onSelectChat,
  currentUser,
  onOpenNewChat,
  onOpenStatus,
  onOpenCatalog,
  onOpenLabels,
  onOpenMyProfile,
  onLogout,
  selectedLabelId,
  onClearLabelFilter,
  labels,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter chats by search and label
  const filteredChats = chats.filter((c) => {
    // Label filter
    if (selectedLabelId) {
      const hasLabel = c.labels?.some((l) => l.id === selectedLabelId);
      if (!hasLabel) return false;
    }

    // Search query
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
      } w-full md:w-96 lg:w-[420px] h-full h-[100dvh] flex-col bg-[#111b21] border-r border-[#202c33] z-20 flex-shrink-0`}
    >
      {/* 1. IChat Top Bar */}
      <div className="h-16 px-4 bg-[#202c33] flex items-center justify-between border-b border-[#2a3942]">
        {/* Current User Profile - Click opens Profile Info */}
        <div
          onClick={onOpenMyProfile}
          className="flex items-center gap-2.5 cursor-pointer group hover:opacity-90 transition-opacity"
          title="Click to view profile info"
        >
          <div className="relative">
            <img
              src={currentUser.avatar || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=150'}
              alt={currentUser.name}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-transparent group-hover:ring-[#00a884] transition-all"
            />
            {currentUser.isBusiness && (
              <span className="absolute -bottom-0.5 -right-0.5 p-0.5 bg-[#00a884] rounded-full text-white">
                <ShieldCheck className="w-3 h-3" />
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-white group-hover:text-[#00a884] transition-colors max-w-[110px] truncate">
                {currentUser.name}
              </span>
              <img src="/logo.png" alt="IChat" className="w-4 h-4 object-contain inline-block" title="IChat" />
            </div>
            <span className="text-[10px] text-[#00a884] font-medium block">
              {currentUser.isBusiness ? 'Business Profile' : 'Personal Account'}
            </span>
          </div>
        </div>

        {/* Action Icons */}
        <div className="flex items-center gap-1 text-[#aebac1]">
          {/* Status / Stories */}
          <button
            onClick={onOpenStatus}
            className="p-2 rounded-full hover:bg-[#374248] hover:text-white transition-colors"
            title="Status / Stories (24h)"
          >
            <CircleDashed className="w-5 h-5" />
          </button>

          {/* Business Tools Catalog */}
          <button
            onClick={onOpenCatalog}
            className="p-2 rounded-full hover:bg-[#374248] hover:text-white transition-colors"
            title="Business Catalog & Products"
          >
            <ShoppingBag className="w-5 h-5" />
          </button>

          {/* Labels & Tags Filter */}
          <button
            onClick={onOpenLabels}
            className={`p-2 rounded-full hover:bg-[#374248] transition-colors ${
              selectedLabelId ? 'text-[#00a884]' : 'hover:text-white'
            }`}
            title="Filter by Labels"
          >
            <Tag className="w-5 h-5" />
          </button>

          {/* New Chat / New Group */}
          <button
            onClick={onOpenNewChat}
            className="p-2 rounded-full hover:bg-[#374248] hover:text-white transition-colors"
            title="New Chat or Group"
          >
            <MessageSquare className="w-5 h-5" />
          </button>

          {/* Sign Out */}
          <button
            onClick={onLogout}
            className="p-2 rounded-full hover:bg-[#374248] hover:text-red-400 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 2. Search & Label Filter Bar */}
      <div className="px-3 py-2 border-b border-[#202c33] bg-[#111b21]">
        <div className="relative flex items-center bg-[#202c33] rounded-xl px-3 py-1.5">
          <Search className="w-4 h-4 text-[#8696a0] mr-2" />
          <input
            type="text"
            placeholder="Search or start new chat"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-xs text-white placeholder-[#8696a0] w-full focus:outline-none"
          />
        </div>

        {/* Active Label Pill */}
        {activeFilterLabel && (
          <div className="flex items-center justify-between mt-2 px-2.5 py-1 bg-[#202c33] rounded-lg border border-[#2a3942]">
            <div className="flex items-center gap-1.5 text-xs text-white">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activeFilterLabel.color }} />
              <span>Filtering: <strong>{activeFilterLabel.name}</strong></span>
            </div>
            <button onClick={onClearLabelFilter} className="text-gray-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 3. Chats List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#202c33]">
        {filteredChats.map((chat) => {
          const isSelected = chat.id === activeChatId;
          const isGroup = chat.isGroup;
          const otherMember = chat.members?.find((m) => m.userId !== currentUser.id)?.user;
          const title = isGroup ? chat.name : (otherMember?.businessName || otherMember?.name || 'Chat');
          const avatar = isGroup
            ? (chat.avatar || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150')
            : (otherMember?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150');
          const isBusiness = !isGroup && otherMember?.isBusiness;

          const lastMsg = chat.lastMessage;
          const isMe = lastMsg?.senderId === currentUser.id;
          const time = lastMsg ? new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

          return (
            <div
              key={chat.id}
              onClick={() => onSelectChat(chat.id)}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                isSelected ? 'bg-[#2a3942]' : 'hover:bg-[#202c33]'
              }`}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <img
                  src={avatar}
                  alt={title || ''}
                  className="w-12 h-12 rounded-full object-cover"
                />
                {!isGroup && otherMember?.isOnline && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#00a884] rounded-full border-2 border-[#111b21]" />
                )}
              </div>

              {/* Chat Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-1.5 truncate">
                    <h4 className="text-sm font-semibold text-white truncate leading-tight">
                      {title}
                    </h4>
                    {isBusiness && (
                      <ShieldCheck className="w-3.5 h-3.5 text-[#00a884] flex-shrink-0" />
                    )}
                  </div>
                  {time && <span className="text-[11px] text-[#8696a0] flex-shrink-0">{time}</span>}
                </div>

                <div className="flex items-center justify-between">
                  {/* Last message preview */}
                  <div className="flex items-center gap-1 text-xs text-[#8696a0] truncate pr-2">
                    {isMe && lastMsg && (
                      <span>
                        {lastMsg.status === 'read' ? (
                          <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] inline" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-gray-400 inline" />
                        )}
                      </span>
                    )}
                    <span className="truncate">
                      {lastMsg?.type === 'product'
                        ? '🛍️ Shared a catalog product'
                        : lastMsg?.type === 'audio'
                        ? '🎤 Voice message'
                        : lastMsg?.content || 'No messages yet'}
                    </span>
                  </div>

                  {/* Unread badge & labels */}
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
                    {chat.unreadCount && chat.unreadCount > 0 ? (
                      <span className="px-1.5 py-0.5 rounded-full bg-[#00a884] text-white text-[10px] font-bold min-w-4 text-center">
                        {chat.unreadCount}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filteredChats.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p className="text-xs">No conversations found</p>
          </div>
        )}
      </div>
    </div>
  );
};
