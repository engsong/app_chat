import React, { useState } from 'react';
import { X, Tag, Plus, Check } from 'lucide-react';
import { Label } from '../../types/index.js';

interface LabelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  labels: Label[];
  selectedLabelId: string | null;
  onSelectFilterLabel: (labelId: string | null) => void;
  onAddLabel: (name: string, color: string) => void;
}

export const LabelsModal: React.FC<LabelsModalProps> = ({
  isOpen,
  onClose,
  labels,
  selectedLabelId,
  onSelectFilterLabel,
  onAddLabel,
}) => {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#00a884');

  const palette = ['#00a884', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onAddLabel(name, color);
    setName('');
    setShowAdd(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-[#202c33] border border-[#2a3942] rounded-2xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a3942] bg-[#111b21]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#00a884]/20 flex items-center justify-center text-[#00a884]">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Labels & Tags</h3>
              <p className="text-xs text-gray-400">Filter chats and track client lifecycle</p>
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
        <div className="p-6 space-y-4">
          <button
            onClick={() => {
              onSelectFilterLabel(null);
              onClose();
            }}
            className={`w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors ${
              selectedLabelId === null ? 'bg-[#00a884] text-white' : 'bg-[#111b21] text-gray-300 hover:bg-[#2a3942]'
            }`}
          >
            <span>All Conversations (No Filter)</span>
            {selectedLabelId === null && <Check className="w-4 h-4" />}
          </button>

          <div className="space-y-2">
            {labels.map((l) => (
              <button
                key={l.id}
                onClick={() => {
                  onSelectFilterLabel(l.id);
                  onClose();
                }}
                className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors ${
                  selectedLabelId === l.id
                    ? 'bg-[#00a884] text-white'
                    : 'bg-[#111b21] text-gray-300 hover:bg-[#2a3942]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: l.color }} />
                  <span>{l.name}</span>
                </div>
                {selectedLabelId === l.id && <Check className="w-4 h-4" />}
              </button>
            ))}
          </div>

          {!showAdd ? (
            <button
              onClick={() => setShowAdd(true)}
              className="w-full py-2 border border-dashed border-[#00a884] rounded-xl text-[#00a884] text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-[#00a884]/10 transition-colors"
            >
              <Plus className="w-4 h-4" /> Create New Label
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="bg-[#111b21] p-3 rounded-xl border border-[#2a3942] space-y-2.5">
              <input
                type="text"
                placeholder="Label name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 bg-[#202c33] border border-[#2a3942] rounded-lg text-white text-xs"
              />
              <div className="flex items-center gap-2">
                {palette.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-5 h-5 rounded-full border-2 ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="px-2.5 py-1 text-xs text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-[#00a884] text-white rounded text-xs font-semibold"
                >
                  Save
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
