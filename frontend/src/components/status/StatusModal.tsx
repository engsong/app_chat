import React, { useState, useEffect } from 'react';
import { X, Plus, Eye, ChevronLeft, ChevronRight, Image as ImageIcon, Type } from 'lucide-react';
import { StatusItem, User } from '../../types/index.js';

interface StatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  statuses: StatusItem[];
  currentUser: User;
  onPostStatus: (data: { type: 'text' | 'image'; caption: string; mediaUrl?: string; backgroundColor?: string }) => void;
  onViewStatus: (statusId: string) => void;
}

export const StatusModal: React.FC<StatusModalProps> = ({
  isOpen,
  onClose,
  statuses,
  currentUser,
  onPostStatus,
  onViewStatus,
}) => {
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [newCaption, setNewCaption] = useState('');
  const [newType, setNewType] = useState<'text' | 'image'>('text');
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newBgColor, setNewBgColor] = useState('#075E54');

  const bgColors = ['#075E54', '#128C7E', '#25D366', '#005c4b', '#7c3aed', '#db2777', '#dc2626'];

  const activeStory = activeStoryIndex !== null ? statuses[activeStoryIndex] : null;

  // Auto-advance story timer
  useEffect(() => {
    if (activeStoryIndex === null || !activeStory) return;

    onViewStatus(activeStory.id);
    setProgress(0);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          // Advance to next or close
          if (activeStoryIndex < statuses.length - 1) {
            setActiveStoryIndex(activeStoryIndex + 1);
            return 0;
          } else {
            setActiveStoryIndex(null);
            return 0;
          }
        }
        return prev + 2;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [activeStoryIndex, statuses.length]);

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCaption && !newMediaUrl) return;

    onPostStatus({
      type: newType,
      caption: newCaption,
      mediaUrl: newMediaUrl,
      backgroundColor: newBgColor,
    });

    setNewCaption('');
    setNewMediaUrl('');
    setIsCreating(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-4">
      {/* 1. Fullscreen Story Viewer */}
      {activeStory && activeStoryIndex !== null && (
        <div className="relative w-full max-w-md h-[80vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between bg-black animate-scale-up">
          {/* Progress Bars */}
          <div className="absolute top-3 left-3 right-3 flex items-center gap-1.5 z-30">
            {statuses.map((_, idx) => (
              <div key={idx} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-100 ease-linear"
                  style={{
                    width:
                      idx === activeStoryIndex
                        ? `${progress}%`
                        : idx < (activeStoryIndex as number)
                        ? '100%'
                        : '0%',
                  }}
                />
              </div>
            ))}
          </div>

          {/* User Header */}
          <div className="absolute top-6 left-4 right-4 flex items-center justify-between text-white z-30">
            <div className="flex items-center gap-2.5">
              <img
                src={activeStory.user?.avatar || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=150'}
                alt=""
                className="w-10 h-10 rounded-full object-cover border-2 border-white"
              />
              <div>
                <p className="text-sm font-semibold leading-tight">{activeStory.user?.name || 'Contact'}</p>
                <p className="text-[10px] text-gray-300">Just now • 24h Status</p>
              </div>
            </div>
            <button
              onClick={() => setActiveStoryIndex(null)}
              className="p-1.5 rounded-full bg-black/40 hover:bg-black/60"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Story Body */}
          <div
            className="w-full h-full flex flex-col items-center justify-center p-8 text-center relative"
            style={{
              backgroundColor: activeStory.type === 'text' ? activeStory.backgroundColor || '#075E54' : '#000',
            }}
          >
            {activeStory.type === 'image' && activeStory.mediaUrl && (
              <img
                src={activeStory.mediaUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}

            {/* Caption */}
            <div className="relative z-10 max-w-xs">
              <p className={`text-white font-medium ${activeStory.type === 'text' ? 'text-2xl leading-relaxed' : 'text-sm bg-black/60 backdrop-blur-sm px-4 py-2 rounded-xl mt-48'}`}>
                {activeStory.caption}
              </p>
            </div>
          </div>

          {/* Left/Right Click Navigators */}
          <button
            onClick={() => {
              if (activeStoryIndex !== null && activeStoryIndex > 0) setActiveStoryIndex(activeStoryIndex - 1);
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 text-white/50 hover:text-white z-30"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
          <button
            onClick={() => {
              if (activeStoryIndex !== null && activeStoryIndex < statuses.length - 1) setActiveStoryIndex(activeStoryIndex + 1);
              else setActiveStoryIndex(null);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-white/50 hover:text-white z-30"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </div>
      )}

      {/* 2. Status Listing & Creation Modal */}
      {!activeStory && (
        <div className="bg-[#202c33] border border-[#2a3942] rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a3942] bg-[#111b21]">
            <div>
              <h3 className="text-lg font-semibold text-white">Status / Stories</h3>
              <p className="text-xs text-gray-400">Share instant business updates that vanish in 24 hours</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-[#2a3942]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Post New Status Card */}
            {!isCreating && (
              <div
                onClick={() => setIsCreating(true)}
                className="flex items-center gap-4 p-3 bg-[#111b21] rounded-xl border border-[#2a3942] hover:border-[#00a884] cursor-pointer transition-colors"
              >
                <div className="relative">
                  <img
                    src={currentUser.avatar || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=150'}
                    alt=""
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div className="absolute bottom-0 right-0 p-1 bg-[#00a884] rounded-full text-white">
                    <Plus className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">My Status</h4>
                  <p className="text-xs text-gray-400">Click to add business update</p>
                </div>
              </div>
            )}

            {/* Status Creation Form */}
            {isCreating && (
              <form onSubmit={handleCreate} className="bg-[#111b21] p-4 rounded-xl border border-[#2a3942] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#00a884]">Create 24h Update</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNewType('text')}
                      className={`p-1.5 rounded-lg text-xs flex items-center gap-1 ${
                        newType === 'text' ? 'bg-[#00a884] text-white' : 'text-gray-400'
                      }`}
                    >
                      <Type className="w-3.5 h-3.5" /> Text
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewType('image')}
                      className={`p-1.5 rounded-lg text-xs flex items-center gap-1 ${
                        newType === 'image' ? 'bg-[#00a884] text-white' : 'text-gray-400'
                      }`}
                    >
                      <ImageIcon className="w-3.5 h-3.5" /> Photo
                    </button>
                  </div>
                </div>

                {newType === 'image' && (
                  <input
                    type="url"
                    placeholder="Image URL..."
                    value={newMediaUrl}
                    onChange={(e) => setNewMediaUrl(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-[#202c33] border border-[#2a3942] rounded-lg text-white text-xs"
                  />
                )}

                {newType === 'text' && (
                  <div className="flex gap-1.5 py-1">
                    {bgColors.map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setNewBgColor(col)}
                        className={`w-6 h-6 rounded-full border-2 ${
                          newBgColor === col ? 'border-white scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: col }}
                      />
                    ))}
                  </div>
                )}

                <textarea
                  placeholder="Type a status update or caption..."
                  rows={3}
                  value={newCaption}
                  onChange={(e) => setNewCaption(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-[#202c33] border border-[#2a3942] rounded-lg text-white text-xs"
                />

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-3 py-1 text-xs text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[#00a884] hover:bg-[#008f6f] text-white rounded-lg text-xs font-semibold"
                  >
                    Post Status
                  </button>
                </div>
              </form>
            )}

            {/* Recent Status Updates List */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Recent Updates ({statuses.length})
              </p>
              <div className="space-y-2">
                {statuses.map((s, idx) => (
                  <div
                    key={s.id}
                    onClick={() => setActiveStoryIndex(idx)}
                    className="flex items-center justify-between p-3 bg-[#111b21] rounded-xl border border-[#2a3942] hover:border-[#00a884] cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-0.5 rounded-full ring-2 ring-[#00a884] ring-offset-2 ring-offset-[#111b21]">
                        <img
                          src={s.user?.avatar || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=150'}
                          alt=""
                          className="w-11 h-11 rounded-full object-cover"
                        />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">{s.user?.name || 'Contact'}</h4>
                        <p className="text-xs text-gray-400 line-clamp-1">{s.caption}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Eye className="w-3.5 h-3.5 text-[#00a884]" />
                      <span>{s.viewsCount || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
