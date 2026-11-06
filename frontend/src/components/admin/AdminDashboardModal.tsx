import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Users,
  MessageSquare,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Search,
  Trash2,
  X,
  ArrowLeft,
  Eye,
  FileText,
  MapPin,
  Image as ImageIcon,
  Mic,
  ExternalLink
} from 'lucide-react';
import { User, Chat, Message } from '../../types/index.js';
import { getAvatarUrl } from '../../utils/avatar.js';

interface AdminDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
}

interface OverviewData {
  totalUsers: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  totalChats: number;
  totalMessages: number;
}

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'chats' | 'overview'>('users');
  const [userFilter, setUserFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [selectedAuditChat, setSelectedAuditChat] = useState<any | null>(null);
  const [auditMessages, setAuditMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchOverview = async () => {
    try {
      const res = await fetch('/api/admin/overview', {
        headers: { 'x-admin-id': currentUser.id },
      });
      if (res.ok) {
        const data = await res.json();
        setOverview(data);
      }
    } catch (e) {
      console.error('Error fetching admin overview:', e);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/users?status=${userFilter}`, {
        headers: { 'x-admin-id': currentUser.id },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (e) {
      console.error('Error fetching admin users:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchChats = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/chats', {
        headers: { 'x-admin-id': currentUser.id },
      });
      if (res.ok) {
        const data = await res.json();
        setChats(data);
      }
    } catch (e) {
      console.error('Error fetching admin chats:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditMessages = async (chatId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/chats/${chatId}/messages`, {
        headers: { 'x-admin-id': currentUser.id },
      });
      if (res.ok) {
        const data = await res.json();
        setAuditMessages(data);
      }
    } catch (e) {
      console.error('Error fetching audit messages:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchOverview();
    if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'chats') {
      fetchChats();
    }
  }, [isOpen, activeTab, userFilter]);

  const handleApprove = async (userId: string) => {
    try {
      setActionLoadingId(userId);
      const res = await fetch(`/api/admin/users/${userId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': currentUser.id },
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, status: 'approved' } : u))
        );
        fetchOverview();
      }
    } catch (e) {
      console.error('Error approving user:', e);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (userId: string) => {
    try {
      setActionLoadingId(userId);
      const res = await fetch(`/api/admin/users/${userId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': currentUser.id },
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, status: 'rejected' } : u))
        );
        fetchOverview();
      }
    } catch (e) {
      console.error('Error rejecting user:', e);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleAdmin = async (userId: string, currentRole?: string) => {
    const nextRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      setActionLoadingId(userId);
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': currentUser.id },
        body: JSON.stringify({ role: nextRole }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: nextRole as any } : u))
        );
      }
    } catch (e) {
      console.error('Error changing user role:', e);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      setActionLoadingId(userId);
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'x-admin-id': currentUser.id },
      });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        fetchOverview();
      }
    } catch (e) {
      console.error('Error deleting user:', e);
    } finally {
      setActionLoadingId(null);
    }
  };

  if (!isOpen) return null;

  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.phone.toLowerCase().includes(q) ||
      (u.businessName && u.businessName.toLowerCase().includes(q))
    );
  });

  const filteredChats = chats.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    if (c.name && c.name.toLowerCase().includes(q)) return true;
    return c.members?.some((m: any) =>
      m.user?.name?.toLowerCase().includes(q) || m.user?.phone?.includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-[#111b21] border border-[#2a3942] rounded-2xl w-full max-w-4xl h-[92dvh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="px-4 py-3 bg-[#202c33] border-b border-[#2a3942] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#00a884]/20 border border-[#00a884]/40 flex items-center justify-center text-[#00a884]">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-semibold text-white">
                  IChat Admin Console
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00a884] text-white font-bold">
                  SUPER ADMIN
                </span>
              </div>
              <p className="text-[11px] text-[#8696a0]">
                User approvals, registration management & chat monitoring
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[#8696a0] hover:text-white rounded-full hover:bg-[#374248] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-4 pt-2 bg-[#202c33] border-b border-[#2a3942] flex items-center gap-2 flex-shrink-0 overflow-x-auto">
          <button
            onClick={() => {
              setActiveTab('users');
              setSelectedAuditChat(null);
            }}
            className={`pb-2.5 px-3 text-xs font-medium flex items-center gap-1.5 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'users'
                ? 'border-[#00a884] text-[#00a884]'
                : 'border-transparent text-[#8696a0] hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>User Registrations</span>
            {overview && overview.pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-black font-bold">
                {overview.pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('chats');
              setSelectedAuditChat(null);
            }}
            className={`pb-2.5 px-3 text-xs font-medium flex items-center gap-1.5 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'chats'
                ? 'border-[#00a884] text-[#00a884]'
                : 'border-transparent text-[#8696a0] hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chat Monitor & Audit</span>
            {overview && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#2a3942] text-gray-300">
                {overview.totalChats}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('overview');
              setSelectedAuditChat(null);
            }}
            className={`pb-2.5 px-3 text-xs font-medium flex items-center gap-1.5 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-[#00a884] text-[#00a884]'
                : 'border-transparent text-[#8696a0] hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>System Stats</span>
          </button>
        </div>

        {/* Tab 1: Users & Approvals */}
        {activeTab === 'users' && (
          <div className="flex-1 flex flex-col min-h-0 bg-[#111b21]">
            {/* Search and Filters */}
            <div className="p-3 bg-[#111b21] border-b border-[#2a3942] flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between flex-shrink-0">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#8696a0]" />
                <input
                  type="text"
                  placeholder="Search user by name, phone, or business..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#202c33] text-white text-xs pl-9 pr-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00a884]"
                />
              </div>

              {/* Status filter tabs */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                {(['all', 'pending', 'approved', 'rejected'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setUserFilter(filter)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                      userFilter === filter
                        ? 'bg-[#00a884] text-white font-semibold'
                        : 'bg-[#202c33] text-[#8696a0] hover:text-white'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Users List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {loading ? (
                <div className="py-12 text-center text-xs text-[#8696a0]">Loading users...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#8696a0]">
                  No users found in this category.
                </div>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrent = u.id === currentUser.id;
                  const isPending = u.status === 'pending';
                  const isApproved = u.status === 'approved';
                  const isRejected = u.status === 'rejected';

                  return (
                    <div
                      key={u.id}
                      className="p-3 bg-[#202c33] rounded-xl border border-[#2a3942] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-[#374248] transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={getAvatarUrl(u.avatar)}
                          alt={u.name}
                          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-white truncate">
                              {u.name}
                            </span>
                            {u.role === 'admin' && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30 flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" /> Admin
                              </span>
                            )}
                            {isPending && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Pending Approval
                              </span>
                            )}
                            {isApproved && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#00a884]/20 text-[#00a884] font-bold border border-[#00a884]/30 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Approved
                              </span>
                            )}
                            {isRejected && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30 flex items-center gap-1">
                                <XCircle className="w-3 h-3" /> Rejected
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-[#8696a0] flex items-center gap-2 flex-wrap mt-0.5">
                            <span className="font-mono text-gray-300">📞 {u.phone}</span>
                            <span>•</span>
                            <span>Registered: {new Date(u.createdAt || Date.now()).toLocaleDateString()}</span>
                            {u.isBusiness && (
                              <>
                                <span>•</span>
                                <span className="text-[#00a884]">💼 {u.businessName || 'Business'}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 self-end sm:self-center flex-wrap">
                        {isPending && (
                          <>
                            <button
                              onClick={() => handleApprove(u.id)}
                              disabled={actionLoadingId === u.id}
                              className="px-3 py-1.5 rounded-lg bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-semibold flex items-center gap-1 shadow transition-all active:scale-95"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                            </button>
                            <button
                              onClick={() => handleReject(u.id)}
                              disabled={actionLoadingId === u.id}
                              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1 shadow transition-all active:scale-95"
                            >
                              <XCircle className="w-3.5 h-3.5" /> Reject
                            </button>
                          </>
                        )}

                        {isApproved && !isCurrent && (
                          <button
                            onClick={() => handleReject(u.id)}
                            disabled={actionLoadingId === u.id}
                            className="px-2.5 py-1.5 rounded-lg bg-[#2a3942] hover:bg-rose-900/40 text-gray-300 hover:text-rose-400 text-xs font-medium transition-colors"
                            title="Revoke and Reject Account"
                          >
                            Reject
                          </button>
                        )}

                        {isRejected && (
                          <button
                            onClick={() => handleApprove(u.id)}
                            disabled={actionLoadingId === u.id}
                            className="px-2.5 py-1.5 rounded-lg bg-[#00a884]/20 hover:bg-[#00a884]/40 text-[#00a884] text-xs font-semibold transition-colors"
                          >
                            Re-Approve
                          </button>
                        )}

                        {!isCurrent && (
                          <button
                            onClick={() => handleToggleAdmin(u.id, u.role)}
                            disabled={actionLoadingId === u.id}
                            className={`p-1.5 rounded-lg text-xs transition-colors ${
                              u.role === 'admin'
                                ? 'bg-blue-600/30 text-blue-300 hover:bg-blue-600/50'
                                : 'bg-[#2a3942] text-gray-400 hover:text-white'
                            }`}
                            title={u.role === 'admin' ? 'Demote from Admin' : 'Make Admin'}
                          >
                            <ShieldCheck className="w-4 h-4" />
                          </button>
                        )}

                        {!isCurrent && (
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            disabled={actionLoadingId === u.id}
                            className="p-1.5 rounded-lg bg-[#2a3942] hover:bg-rose-950 text-gray-400 hover:text-rose-400 text-xs transition-colors"
                            title="Delete user account"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Chat Monitor & Audit (Seen other chating only admin) */}
        {activeTab === 'chats' && (
          <div className="flex-1 flex flex-col min-h-0 bg-[#111b21]">
            {selectedAuditChat ? (
              // Active Chat Transcript Inspector
              <div className="flex-1 flex flex-col min-h-0">
                <div className="px-4 py-2.5 bg-[#202c33] border-b border-[#2a3942] flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedAuditChat(null)}
                      className="p-1.5 rounded-full hover:bg-[#374248] text-[#8696a0] hover:text-white transition-colors"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                      <h3 className="text-xs sm:text-sm font-semibold text-white">
                        {selectedAuditChat.isGroup
                          ? `Group: ${selectedAuditChat.name}`
                          : `Direct Chat: ${selectedAuditChat.members?.map((m: any) => m.user?.name || m.user?.phone).join(' ↔ ')}`}
                      </h3>
                      <p className="text-[10px] text-[#8696a0]">
                        Audit Mode • {auditMessages.length} total messages
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono">
                    ADMIN AUDIT VIEW
                  </span>
                </div>

                {/* Audit Messages Stream */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-[#0b141a]">
                  {loading ? (
                    <div className="py-12 text-center text-xs text-[#8696a0]">
                      Loading chat messages...
                    </div>
                  ) : auditMessages.length === 0 ? (
                    <div className="py-12 text-center text-xs text-[#8696a0]">
                      No messages recorded in this chat yet.
                    </div>
                  ) : (
                    auditMessages.map((msg: any) => (
                      <div
                        key={msg.id}
                        className="p-3 bg-[#202c33] border border-[#2a3942] rounded-xl max-w-xl shadow"
                      >
                        <div className="flex items-center justify-between text-[11px] text-[#8696a0] border-b border-[#2a3942] pb-1.5 mb-1.5 flex-wrap gap-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-[#00a884]">
                              {msg.sender?.name || 'Unknown User'} ({msg.sender?.phone || 'No phone'})
                            </span>
                            {msg.wasDeletedForEveryone && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-medium border border-red-500/30">
                                🗑️ Deleted for everyone
                              </span>
                            )}
                            {msg.wasDeletedForUsers && !msg.wasDeletedForEveryone && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30">
                                🗑️ Deleted/Cleared by user
                              </span>
                            )}
                          </div>
                          <span>{new Date(msg.createdAt).toLocaleString()}</span>
                        </div>

                        {/* Content based on type */}
                        {msg.type === 'image' && (
                          <div className="mb-2">
                            <img
                              src={msg.mediaUrl}
                              alt="Attached"
                              className="max-h-60 rounded-lg object-contain bg-black/40"
                            />
                            {msg.content && msg.content !== 'Photo' && (
                              <p className="text-xs text-white mt-1">{msg.content}</p>
                            )}
                          </div>
                        )}

                        {msg.type === 'location' && (
                          <div className="p-2 bg-[#111b21] rounded-lg border border-[#2a3942] flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs text-white">
                              <MapPin className="w-4 h-4 text-rose-500" />
                              <span>{msg.content}</span>
                            </div>
                            {msg.metadata && (
                              <a
                                href={JSON.parse(msg.metadata).mapUrl || `https://maps.google.com?q=${JSON.parse(msg.metadata).lat},${JSON.parse(msg.metadata).lng}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 text-[#00a884] hover:text-white"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        )}

                        {msg.type === 'audio' && (
                          <div className="p-2 bg-[#111b21] rounded-lg border border-[#2a3942] flex items-center gap-2">
                            <Mic className="w-4 h-4 text-[#00a884]" />
                            <audio controls src={msg.mediaUrl} className="h-8 flex-1" />
                          </div>
                        )}

                        {msg.type === 'document' && (
                          <div className="p-2 bg-[#111b21] rounded-lg border border-[#2a3942] flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs text-white">
                              <FileText className="w-4 h-4 text-blue-400" />
                              <span className="font-mono truncate">{msg.content}</span>
                            </div>
                            {msg.mediaUrl && (
                              <a
                                href={msg.mediaUrl}
                                download={msg.content}
                                className="px-2 py-1 bg-[#202c33] rounded text-[11px] text-[#00a884]"
                              >
                                Download
                              </a>
                            )}
                          </div>
                        )}

                        {(msg.type === 'text' || !msg.type) && (
                          <p className="text-xs sm:text-sm text-gray-200 whitespace-pre-wrap">
                            {msg.content}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              // Chat List
              <div className="flex-1 flex flex-col min-h-0">
                <div className="p-3 bg-[#111b21] border-b border-[#2a3942] flex-shrink-0">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#8696a0]" />
                    <input
                      type="text"
                      placeholder="Search conversations by participant name or phone..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-[#202c33] text-white text-xs pl-9 pr-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00a884]"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {loading ? (
                    <div className="py-12 text-center text-xs text-[#8696a0]">Loading chats...</div>
                  ) : filteredChats.length === 0 ? (
                    <div className="py-12 text-center text-xs text-[#8696a0]">
                      No conversations found.
                    </div>
                  ) : (
                    filteredChats.map((c) => {
                      const memberNames = c.members?.map((m: any) => `${m.user?.name || 'User'} (${m.user?.phone || 'No phone'})`).join(', ');

                      return (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedAuditChat(c);
                            fetchAuditMessages(c.id);
                          }}
                          className="p-3 bg-[#202c33] rounded-xl border border-[#2a3942] hover:border-[#00a884]/60 cursor-pointer transition-all flex items-center justify-between gap-3 group"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs sm:text-sm font-semibold text-white group-hover:text-[#00a884] transition-colors truncate">
                                {c.isGroup ? `Group: ${c.name}` : `Direct: ${c.members?.map((m: any) => m.user?.name).join(' ↔ ')}`}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#111b21] text-[#8696a0]">
                                {c.totalMessages || 0} msgs
                              </span>
                            </div>

                            <p className="text-[11px] text-[#8696a0] line-clamp-1 mt-0.5">
                              Members: {memberNames || 'None'}
                            </p>

                            {c.lastMessage && (
                              <p className="text-[11px] text-gray-400 line-clamp-1 mt-1 font-mono">
                                Last: {c.lastMessage.content}
                              </p>
                            )}
                          </div>

                          <button className="px-3 py-1.5 rounded-lg bg-[#111b21] group-hover:bg-[#00a884] text-gray-300 group-hover:text-white text-xs font-medium flex items-center gap-1 transition-all flex-shrink-0">
                            <Eye className="w-3.5 h-3.5" /> Inspect
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: System Overview */}
        {activeTab === 'overview' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#111b21]">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
              <div className="p-4 bg-[#202c33] border border-[#2a3942] rounded-2xl">
                <span className="text-[11px] text-[#8696a0] block uppercase tracking-wider font-semibold">
                  Registered Users
                </span>
                <span className="text-2xl sm:text-3xl font-bold text-white mt-1 block">
                  {overview?.totalUsers || 0}
                </span>
              </div>

              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
                <span className="text-[11px] text-amber-400 block uppercase tracking-wider font-semibold">
                  Pending Approvals
                </span>
                <span className="text-2xl sm:text-3xl font-bold text-amber-400 mt-1 block">
                  {overview?.pendingCount || 0}
                </span>
              </div>

              <div className="p-4 bg-[#00a884]/10 border border-[#00a884]/30 rounded-2xl">
                <span className="text-[11px] text-[#00a884] block uppercase tracking-wider font-semibold">
                  Approved Users
                </span>
                <span className="text-2xl sm:text-3xl font-bold text-[#00a884] mt-1 block">
                  {overview?.approvedCount || 0}
                </span>
              </div>

              <div className="p-4 bg-[#202c33] border border-[#2a3942] rounded-2xl">
                <span className="text-[11px] text-[#8696a0] block uppercase tracking-wider font-semibold">
                  Total Conversations
                </span>
                <span className="text-2xl sm:text-3xl font-bold text-white mt-1 block">
                  {overview?.totalChats || 0}
                </span>
              </div>

              <div className="p-4 bg-[#202c33] border border-[#2a3942] rounded-2xl">
                <span className="text-[11px] text-[#8696a0] block uppercase tracking-wider font-semibold">
                  Total Messages Sent
                </span>
                <span className="text-2xl sm:text-3xl font-bold text-white mt-1 block">
                  {overview?.totalMessages || 0}
                </span>
              </div>

              <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl">
                <span className="text-[11px] text-rose-400 block uppercase tracking-wider font-semibold">
                  Rejected Users
                </span>
                <span className="text-2xl sm:text-3xl font-bold text-rose-400 mt-1 block">
                  {overview?.rejectedCount || 0}
                </span>
              </div>
            </div>

            <div className="p-4 bg-[#202c33] border border-[#2a3942] rounded-2xl text-xs text-[#8696a0] space-y-2">
              <h4 className="text-sm font-semibold text-white">Admin Policy & Security Rules:</h4>
              <p>• Only users with role &apos;admin&apos; or phone &apos;02054245616&apos; have access to this console.</p>
              <p>• When a new user registers, their account is flagged as &apos;Pending Approval&apos; until approved here.</p>
              <p>• The Chat Monitoring tab allows compliance inspection of all 1-on-1 and group chats.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
