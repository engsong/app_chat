import React from 'react';
import { Bell, CheckCircle, ExternalLink, X, ShieldAlert, Sparkles } from 'lucide-react';

interface NotificationHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckPermission: () => void;
}

export const NotificationHelpModal: React.FC<NotificationHelpModalProps> = ({
  isOpen,
  onClose,
  onCheckPermission,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#202c33] border border-[#2a3942] rounded-2xl w-full max-w-md p-5 shadow-2xl flex flex-col text-left animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2a3942]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400">
              <Bell className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Enable Notifications on Phone</h3>
              <p className="text-[11px] text-[#8696a0]">วิธีเปิดการแจ้งเตือนบนมือถือ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#374248] text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Instructions */}
        <div className="my-4 space-y-3 text-xs text-[#d1d7db]">
          <div className="p-3 bg-[#111b21] rounded-xl border border-[#2a3942] flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-[#00a884] text-white flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">
              1
            </span>
            <div>
              <p className="font-semibold text-white">Tap the 3 dots (⋮) in Chrome</p>
              <p className="text-[11px] text-[#8696a0]">
                แตะปุ่ม 3 จุด (⋮) ที่มุมขวาบนของเบราว์เซอร์ Chrome (หรือแตะไอคอนรูปการตั้งค่าข้าง URL)
              </p>
            </div>
          </div>

          <div className="p-3 bg-[#111b21] rounded-xl border border-[#2a3942] flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-[#00a884] text-white flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">
              2
            </span>
            <div>
              <p className="font-semibold text-white">Settings → Site settings → Notifications</p>
              <p className="text-[11px] text-[#8696a0]">
                เลือก <strong>การตั้งค่า (Settings)</strong> → <strong>การตั้งค่าไซต์ (Site settings)</strong> → <strong>การแจ้งเตือน (Notifications)</strong>
              </p>
            </div>
          </div>

          <div className="p-3 bg-[#111b21] rounded-xl border border-[#2a3942] flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-[#00a884] text-white flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">
              3
            </span>
            <div>
              <p className="font-semibold text-white">Change to Allow (อนุญาต)</p>
              <p className="text-[11px] text-[#8696a0]">
                แตะ <strong>chat.on-excapp.app</strong> ในส่วนถูกบล็อก แล้วกด <strong>อนุญาต (Allow)</strong>
              </p>
            </div>
          </div>

          <div className="p-2.5 bg-[#00a884]/10 rounded-xl border border-[#00a884]/30 text-[11px] text-[#00a884] flex items-center gap-2">
            <Sparkles className="w-4 h-4 flex-shrink-0" />
            <span>
              Once allowed, you will receive phone calls and messages even with your screen locked!
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2 pt-2 border-t border-[#2a3942]">
          <button
            onClick={onCheckPermission}
            className="flex-1 py-2.5 px-4 bg-[#00a884] hover:bg-[#008f6f] active:scale-95 text-white font-semibold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5"
          >
            <CheckCircle className="w-4 h-4" />
            <span>I have allowed it (Check now) / ฉันเปิดอนุญาตแล้ว</span>
          </button>
        </div>
      </div>
    </div>
  );
};
