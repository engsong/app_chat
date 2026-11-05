import React, { useState } from 'react';
import { X, Users, User as UserIcon, Check } from 'lucide-react';
import { User } from '../../types/index.js';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  currentUserId: string;
  onStartDirectChat: (targetUserId: string) => void;
  onCreateGroupChat: (name: string, description: string, memberIds: string[]) => void;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({
  isOpen,
  onClose,
  users,
  currentUserId,
  onStartDirectChat,
  onCreateGroupChat,
}) => {
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  if (!isOpen) return null;

  const availableContacts = users.filter((u) => u.id !== currentUserId);

  const toggleSelectUser = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName || selectedUserIds.length === 0) return;
    onCreateGroupChat(groupName, groupDesc, selectedUserIds);
    setGroupName('');
    setGroupDesc('');
    setSelectedUserIds([]);
    setIsGroupMode(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-[#202c33] border border-[#2a3942] rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a3942] bg-[#111b21]">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-white">
              {isGroupMode ? 'New Group Chat' : 'Start New Chat'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-[#2a3942]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
                  <p className="text-xs text-gray-400">Collaborate, group call & message</p>
                </div>
              </button>

              <div className="pt-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Select Contact for 1-on-1 Chat
                </p>
                <div className="space-y-1">
                  {availableContacts.map((u) => (
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
                          className="w-10 h-10 rounded-full object-cover"
                        />
                        <div>
                          <h4 className="text-sm font-medium text-white">{u.name}</h4>
                          <p className="text-xs text-gray-400 line-clamp-1">{u.about}</p>
                        </div>
                      </div>
                      <span className="text-[10px] text-[#00a884]">{u.isOnline ? 'Online' : 'Offline'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Group Subject</label>
                <input
                  type="text"
                  placeholder="e.g. Support Team, VIP Client Circle"
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
                <label className="text-xs text-gray-400 block mb-2">Select Participants</label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {availableContacts.map((u) => {
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
                          <span className="text-xs font-medium text-white">{u.name}</span>
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
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsGroupMode(false)}
                  className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={!groupName || selectedUserIds.length === 0}
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
