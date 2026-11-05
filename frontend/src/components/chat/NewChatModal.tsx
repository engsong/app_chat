import React, { useState } from 'react';
import { X, Users, UserPlus, Check, Search, AlertCircle, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';
import { User } from '../../types/index.js';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: User[];
  currentUserId: string;
  onStartDirectChat: (targetUserId: string) => void;
  onCreateGroupChat: (name: string, description: string, memberIds: string[]) => void;
  onAddContact: (query: string) => Promise<{ success: boolean; message?: string }>;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({
  isOpen,
  onClose,
  contacts,
  currentUserId,
  onStartDirectChat,
  onCreateGroupChat,
  onAddContact,
}) => {
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Add Contact by phone, name, or ID
  const [addQuery, setAddQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filter existing contacts
  const [filterQuery, setFilterQuery] = useState('');

  if (!isOpen) return null;

  // Filter contacts by current user's search
  const filteredContacts = contacts.filter((c) => {
    if (c.id === currentUserId) return false;
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q)
    );
  });

  const toggleSelectUser = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleAddContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addQuery.trim() || isAdding) return;

    setIsAdding(true);
    setFeedback(null);

    const result = await onAddContact(addQuery.trim());
    setIsAdding(false);

    if (result.success) {
      setFeedback({ type: 'success', message: result.message || 'Contact added! Opening chat...' });
      setAddQuery('');
      setTimeout(() => {
        onClose();
      }, 500);
    } else {
      setFeedback({ type: 'error', message: result.message || 'Could not find or add contact.' });
    }
  };

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || selectedUserIds.length === 0) return;
    onCreateGroupChat(groupName.trim(), groupDesc.trim(), selectedUserIds);
    setGroupName('');
    setGroupDesc('');
    setSelectedUserIds([]);
    setIsGroupMode(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-[#202c33] border border-[#2a3942] rounded-2xl w-full max-w-md max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a3942] bg-[#111b21]">
          <div className="flex items-center gap-2.5">
            {isGroupMode && (
              <button
                onClick={() => setIsGroupMode(false)}
                className="p-1 hover:bg-[#2a3942] rounded-full text-gray-400 hover:text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h3 className="text-lg font-semibold text-white">
              {isGroupMode ? 'New Group' : 'New Chat'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-[#2a3942] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Step to Add Member/Contact by Phone Number, Name, or ID */}
          <div className="bg-[#111b21] p-3.5 rounded-xl border border-[#2a3942]">
            <p className="text-xs font-semibold text-[#00a884] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5" /> Add Contact by Phone, Name, or ID
            </p>
            <form onSubmit={handleAddContactSubmit} className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. +14155552671, Alex, or usr-id"
                value={addQuery}
                onChange={(e) => {
                  setAddQuery(e.target.value);
                  if (feedback) setFeedback(null);
                }}
                className="flex-1 px-3 py-2 bg-[#202c33] border border-[#2a3942] rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-[#00a884]"
              />
              <button
                type="submit"
                disabled={!addQuery.trim() || isAdding}
                className="px-3.5 py-2 bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors flex-shrink-0"
              >
                {isAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                Add
              </button>
            </form>

            {/* Feedback Message */}
            {feedback && (
              <div
                className={`mt-2.5 p-2 rounded-lg text-xs flex items-center gap-2 ${
                  feedback.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}
              >
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                )}
                <span>{feedback.message}</span>
              </div>
            )}
          </div>

          {!isGroupMode ? (
            <>
              {/* Option to create group */}
              <button
                onClick={() => setIsGroupMode(true)}
                className="w-full p-3 rounded-xl bg-[#111b21] hover:bg-[#2a3942] text-left flex items-center gap-3 transition-colors border border-[#2a3942]"
              >
                <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-white">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">New Group</h4>
                  <p className="text-xs text-gray-400">Collaborate with added contacts</p>
                </div>
              </button>

              {/* Added Contacts List */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    My Added Contacts ({filteredContacts.length})
                  </p>
                </div>

                {/* Filter contacts if more than 3 */}
                {contacts.length > 3 && (
                  <div className="relative mb-2">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search added contacts..."
                      value={filterQuery}
                      onChange={(e) => setFilterQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-[#111b21] border border-[#2a3942] rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#00a884]"
                    />
                  </div>
                )}

                {filteredContacts.length === 0 ? (
                  <div className="text-center py-6 px-4 bg-[#111b21] rounded-xl border border-[#2a3942]">
                    <Users className="w-8 h-8 text-gray-500 mx-auto mb-2 opacity-50" />
                    <p className="text-xs text-gray-300 font-medium">No added contacts found</p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Use the search box above to add friends or clients by their Phone Number, Name, or User ID.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                    {filteredContacts.map((u) => (
                      <div
                        key={u.id}
                        onClick={() => {
                          onStartDirectChat(u.id);
                          onClose();
                        }}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[#111b21] cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={u.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                            alt={u.name}
                            className="w-9 h-9 rounded-full object-cover"
                          />
                          <div>
                            <h4 className="text-sm font-medium text-white">{u.name}</h4>
                            <p className="text-[11px] text-gray-400">{u.phone}</p>
                          </div>
                        </div>
                        <span className="text-[10px] text-[#00a884] font-medium">
                          {u.isOnline ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Group Subject</label>
                <input
                  type="text"
                  placeholder="e.g. Project Team, Family Circle"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-[#111b21] border border-[#2a3942] rounded-lg text-white text-sm focus:outline-none focus:border-[#00a884]"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Group Description (Optional)</label>
                <textarea
                  placeholder="What is this group about?"
                  rows={2}
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-[#111b21] border border-[#2a3942] rounded-lg text-white text-xs focus:outline-none focus:border-[#00a884]"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-2">
                  Select Added Contacts ({selectedUserIds.length} selected)
                </label>
                {filteredContacts.length === 0 ? (
                  <p className="text-xs text-gray-500 py-3 text-center bg-[#111b21] rounded-lg border border-[#2a3942]">
                    No added contacts to choose from. Please add contacts above first.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {filteredContacts.map((u) => {
                      const isSelected = selectedUserIds.includes(u.id);
                      return (
                        <div
                          key={u.id}
                          onClick={() => toggleSelectUser(u.id)}
                          className={`flex items-center justify-between p-2 rounded-xl cursor-pointer border transition-colors ${
                            isSelected ? 'bg-[#00a884]/20 border-[#00a884]' : 'bg-[#111b21] border-[#2a3942]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <img
                              src={u.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover"
                            />
                            <div>
                              <p className="text-xs font-medium text-white">{u.name}</p>
                              <p className="text-[10px] text-gray-400">{u.phone}</p>
                            </div>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                              isSelected ? 'bg-[#00a884] border-[#00a884] text-white' : 'border-gray-500'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#2a3942]">
                <button
                  type="button"
                  onClick={() => setIsGroupMode(false)}
                  className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={!groupName.trim() || selectedUserIds.length === 0}
                  className="px-4 py-2 bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-50 text-white rounded-xl text-xs font-semibold"
                >
                  Create Group ({selectedUserIds.length})
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
