import React, { useState } from 'react';
import { X, Smile, ThumbsUp, Heart, Sparkles, Utensils } from 'lucide-react';

interface EmojiPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onClose: () => void;
}

const EMOJI_CATEGORIES = [
  {
    id: 'smileys',
    name: 'Smileys',
    icon: Smile,
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🥹', '😊',
      '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙',
      '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎',
      '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '😣',
      '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬',
      '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗',
      '🤔', '🫣', '🤭', '🥱', '😴', '🤤', '😵', '🤐', '🥴', '🤠'
    ],
  },
  {
    id: 'gestures',
    name: 'Hands',
    icon: ThumbsUp,
    emojis: [
      '👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘',
      '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👋', '🤚', '🖐️',
      '✋', '🖖', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪',
      '🦵', '🦶', '👂', '👃', '👁️', '👅', '👄', '🫂', '🧑‍💻', '🙋‍♂️'
    ],
  },
  {
    id: 'hearts',
    name: 'Hearts',
    icon: Heart,
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝',
      '💟', '💌', '💋', '💐', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻'
    ],
  },
  {
    id: 'celebrate',
    name: 'Party & Fun',
    icon: Sparkles,
    emojis: [
      '🎉', '🎊', '🎈', '🎂', '🎁', '🏆', '🥇', '🥈', '🥉', '⚽',
      '🏀', '🏈', '⚾', '🎾', '🏐', '🎮', '🎯', '🎲', '🎵', '🎶',
      '🎸', '🥁', '📱', '💻', '📷', '💡', '🔥', '✨', '⭐', '🌟',
      '💰', '💵', '💎', '🔑', '🔒', '🔔', '📢', '🚀', '✈️', '💯'
    ],
  },
  {
    id: 'food',
    name: 'Food',
    icon: Utensils,
    emojis: [
      '☕', '🍵', '🧃', '🥤', '🍺', '🍻', '🍷', '🥂', '🍕', '🍔',
      '🍟', '🌭', '🥪', '🌮', '🌯', '🥗', '🍜', '🍝', '🍣', '🍱',
      '🍦', '🍧', '🍰', '🎂', '🍩', '🍪', '🍫', '🍬', '🍎', '🍓',
      '🍉', '🍇', '🥑', '🌽', '🥖', '🥐', '🧀', '🍳', '🥥', '🥭'
    ],
  },
];

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelectEmoji, onClose }) => {
  const [activeCategory, setActiveCategory] = useState('smileys');

  const currentCategory = EMOJI_CATEGORIES.find((c) => c.id === activeCategory) || EMOJI_CATEGORIES[0];

  return (
    <div className="absolute bottom-full left-0 right-0 sm:left-4 sm:right-auto sm:w-80 mb-2 bg-[#202c33] border border-[#2a3942] rounded-2xl shadow-2xl overflow-hidden z-40 animate-scale-up">
      {/* Category Tabs Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#111b21] border-b border-[#2a3942]">
        <div className="flex items-center gap-1">
          {EMOJI_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`p-2 rounded-xl transition-colors ${
                  isActive
                    ? 'bg-[#00a884] text-white'
                    : 'text-[#8696a0] hover:text-white hover:bg-[#202c33]'
                }`}
                title={cat.name}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-full text-[#8696a0] hover:text-white hover:bg-[#202c33] transition-colors"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Emoji Grid */}
      <div className="p-3 max-h-56 overflow-y-auto scrollbar-thin">
        <p className="text-[11px] font-semibold text-[#8696a0] uppercase tracking-wider mb-2">
          {currentCategory.name}
        </p>
        <div className="grid grid-cols-7 sm:grid-cols-8 gap-1.5">
          {currentCategory.emojis.map((emoji, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectEmoji(emoji)}
              className="w-9 h-9 flex items-center justify-center text-xl rounded-xl hover:bg-[#374248] active:scale-125 transition-all"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
