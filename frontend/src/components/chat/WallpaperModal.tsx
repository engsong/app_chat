import React, { useRef } from 'react';
import { X, Image as ImageIcon, Check, Upload, Trash2 } from 'lucide-react';

interface WallpaperModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWallpaper: string;
  onSelectWallpaper: (wallpaperUrl: string) => void;
}

const PRESET_WALLPAPERS = [
  {
    id: 'default',
    name: 'Default Doodle',
    value: '',
    preview: 'bg-[#0b141a] whatsapp-chat-bg',
  },
  {
    id: 'slate',
    name: 'Dark Slate',
    value: '#111b21',
    preview: 'bg-[#111b21]',
  },
  {
    id: 'emerald',
    name: 'Deep Emerald',
    value: 'linear-gradient(135deg, #062a22 0%, #0b141a 100%)',
    preview: 'bg-gradient-to-br from-[#062a22] to-[#0b141a]',
  },
  {
    id: 'midnight',
    name: 'Midnight Blue',
    value: 'linear-gradient(135deg, #0d1b2a 0%, #111b21 100%)',
    preview: 'bg-gradient-to-br from-[#0d1b2a] to-[#111b21]',
  },
  {
    id: 'dark-purple',
    name: 'Deep Violet',
    value: 'linear-gradient(135deg, #1b0a2a 0%, #0b141a 100%)',
    preview: 'bg-gradient-to-br from-[#1b0a2a] to-[#0b141a]',
  },
];

export const WallpaperModal: React.FC<WallpaperModalProps> = ({
  isOpen,
  onClose,
  currentWallpaper,
  onSelectWallpaper,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleCustomFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      onSelectWallpaper(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#202c33] border border-[#2a3942] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#111b21] border-b border-[#2a3942] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#00a884]/20 text-[#00a884] flex items-center justify-center">
              <ImageIcon className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-white">Chat Background Wallpaper</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#8696a0] hover:text-white hover:bg-[#202c33] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Custom Upload Button */}
          <div>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleCustomFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 px-4 rounded-xl border border-dashed border-[#00a884] bg-[#00a884]/10 hover:bg-[#00a884]/20 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors active:scale-98"
            >
              <Upload className="w-4 h-4 text-[#00a884]" />
              <span>Upload Custom Photo Wallpaper</span>
            </button>
          </div>

          {/* Current Custom Wallpaper Preview */}
          {currentWallpaper && currentWallpaper.startsWith('data:') && (
            <div className="bg-[#111b21] p-3 rounded-xl border border-[#2a3942] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={currentWallpaper}
                  alt="Custom Wallpaper"
                  className="w-12 h-12 rounded-lg object-cover border border-[#2a3942]"
                />
                <div>
                  <p className="text-xs font-semibold text-white">Custom Photo</p>
                  <p className="text-[10px] text-[#00a884]">Active Wallpaper</p>
                </div>
              </div>
              <button
                onClick={() => onSelectWallpaper('')}
                className="p-2 rounded-lg hover:bg-rose-500/20 text-[#8696a0] hover:text-rose-400 transition-colors"
                title="Reset to default"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Preset Styles */}
          <div>
            <p className="text-xs font-semibold text-[#8696a0] uppercase tracking-wider mb-2.5">
              Preset Themes
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {PRESET_WALLPAPERS.map((preset) => {
                const isSelected = currentWallpaper === preset.value;
                return (
                  <button
                    key={preset.id}
                    onClick={() => onSelectWallpaper(preset.value)}
                    className={`h-24 rounded-xl border-2 flex flex-col justify-end p-2.5 relative overflow-hidden transition-all text-left group ${
                      isSelected
                        ? 'border-[#00a884] ring-2 ring-[#00a884]/30'
                        : 'border-[#2a3942] hover:border-gray-500'
                    }`}
                    style={
                      preset.value.startsWith('linear-gradient')
                        ? { background: preset.value }
                        : preset.value.startsWith('#')
                        ? { backgroundColor: preset.value }
                        : undefined
                    }
                  >
                    {!preset.value && (
                      <div className="absolute inset-0 bg-[#0b141a] whatsapp-chat-bg opacity-70" />
                    )}

                    {isSelected && (
                      <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#00a884] text-white flex items-center justify-center shadow-md">
                        <Check className="w-3 h-3" />
                      </span>
                    )}

                    <span className="relative z-10 text-xs font-semibold text-white drop-shadow">
                      {preset.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#111b21] border-t border-[#2a3942] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
