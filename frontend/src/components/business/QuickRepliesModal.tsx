import React, { useState } from 'react';
import { X, Plus, Zap, MessageSquare } from 'lucide-react';
import { QuickReply } from '../../types/index.js';

interface QuickRepliesModalProps {
  isOpen: boolean;
  onClose: () => void;
  quickReplies: QuickReply[];
  onAddReply: (reply: { shortcut: string; message: string }) => void;
  onSelectReply?: (reply: QuickReply) => void;
}

export const QuickRepliesModal: React.FC<QuickRepliesModalProps> = ({
  isOpen,
  onClose,
  quickReplies,
  onAddReply,
  onSelectReply,
}) => {
  const [showAdd, setShowAdd] = useState(false);
  const [shortcut, setShortcut] = useState('');
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shortcut || !message) return;
    onAddReply({ shortcut, message });
    setShortcut('');
    setMessage('');
    setShowAdd(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-[#202c33] border border-[#2a3942] rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a3942] bg-[#111b21]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#00a884]/20 flex items-center justify-center text-[#00a884]">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Quick Replies</h3>
              <p className="text-xs text-gray-400">Save frequent messages and trigger with /</p>
            </div>
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
          {!showAdd && (
            <button
              onClick={() => setShowAdd(true)}
              className="w-full py-2.5 px-4 border border-dashed border-[#00a884] rounded-xl text-[#00a884] font-medium flex items-center justify-center gap-2 hover:bg-[#00a884]/10 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" /> Add New Quick Reply
            </button>
          )}

          {showAdd && (
            <form onSubmit={handleSubmit} className="bg-[#111b21] p-4 rounded-xl border border-[#2a3942] space-y-3">
              <h4 className="text-sm font-semibold text-[#00a884]">Create Shortcut</h4>
              <input
                type="text"
                placeholder="Shortcut (e.g. /hours, /thanks)"
                value={shortcut}
                onChange={(e) => setShortcut(e.target.value)}
                required
                className="w-full px-3 py-2 bg-[#202c33] border border-[#2a3942] rounded-lg text-white text-sm focus:outline-none focus:border-[#00a884]"
              />
              <textarea
                placeholder="Message response..."
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                className="w-full px-3 py-2 bg-[#202c33] border border-[#2a3942] rounded-lg text-white text-sm focus:outline-none focus:border-[#00a884]"
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#00a884] hover:bg-[#008f6f] text-white rounded-lg text-xs font-semibold"
                >
                  Save Shortcut
                </button>
              </div>
            </form>
          )}

          {/* List of Quick Replies */}
          <div className="space-y-2">
            {quickReplies.map((qr) => (
              <div
                key={qr.id}
                onClick={() => {
                  if (onSelectReply) {
                    onSelectReply(qr);
                    onClose();
                  }
                }}
                className="p-3.5 bg-[#111b21] rounded-xl border border-[#2a3942] hover:border-[#00a884] cursor-pointer transition-all flex items-start justify-between group"
              >
                <div className="flex-1 pr-3">
                  <span className="inline-block px-2.5 py-0.5 rounded-md bg-[#00a884]/20 text-[#00a884] text-xs font-mono font-semibold mb-1">
                    {qr.shortcut}
                  </span>
                  <p className="text-xs text-gray-300 line-clamp-2">{qr.message}</p>
                </div>
                <div className="opacity-0 group-hover:opacity-100 text-[#00a884] text-xs font-medium flex items-center gap-1 self-center">
                  <MessageSquare className="w-3.5 h-3.5" /> Use
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
