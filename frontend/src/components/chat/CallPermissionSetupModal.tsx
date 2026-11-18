import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  X,
  PhoneCall,
  Layers,
  BatteryCharging,
  Smartphone,
  ShieldCheck,
  Play,
  RotateCw,
} from 'lucide-react';

export interface AndroidPermissionStatus {
  notifications: boolean;
  canDrawOverlays: boolean;
  isIgnoringBattery: boolean;
  canUseFullScreenIntent: boolean;
  manufacturer: string;
  model: string;
  brand: string;
  sdkInt: number;
}

interface CallPermissionSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleted?: () => void;
}

export const CallPermissionSetupModal: React.FC<CallPermissionSetupModalProps> = ({
  isOpen,
  onClose,
  onCompleted,
}) => {
  const [status, setStatus] = useState<AndroidPermissionStatus | null>(null);
  const [testCallCountdown, setTestCallCountdown] = useState<number | null>(null);

  const bridge = typeof window !== 'undefined' ? (window as any).AndroidAudioBridge : null;

  const refreshStatus = useCallback(() => {
    if (!bridge || typeof bridge.getCallPermissionStatus !== 'function') return;
    try {
      const raw = bridge.getCallPermissionStatus();
      if (raw) {
        const parsed = JSON.parse(raw);
        setStatus(parsed);
      }
    } catch (e) {
      console.warn('[CallSetup] Error reading permission status:', e);
    }
  }, [bridge]);

  useEffect(() => {
    if (!isOpen) return;
    refreshStatus();

    const handleFocus = () => {
      refreshStatus();
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', handleFocus);

    const interval = setInterval(refreshStatus, 2000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleFocus);
      clearInterval(interval);
    };
  }, [isOpen, refreshStatus]);

  if (!isOpen) return null;

  const isAndroid = !!bridge;
  const mfg = (status?.manufacturer || '').toLowerCase();
  const brand = (status?.brand || '').toLowerCase();
  const isInfinix = mfg.includes('infinix') || mfg.includes('tecno') || mfg.includes('transsion') || brand.includes('infinix') || brand.includes('tecno');
  const isXiaomi = mfg.includes('xiaomi') || brand.includes('redmi') || brand.includes('poco');
  const isOppo = mfg.includes('oppo') || mfg.includes('realme') || brand.includes('oppo') || brand.includes('realme');
  const isVivo = mfg.includes('vivo') || brand.includes('vivo');
  const isSamsung = mfg.includes('samsung') || brand.includes('samsung');

  const allCriticalGranted = status?.notifications && status?.canDrawOverlays && status?.isIgnoringBattery;

  const handleTestCall = () => {
    if (!bridge || typeof bridge.triggerTestCall !== 'function') return;
    setTestCallCountdown(3);
    bridge.triggerTestCall(3);

    const timer = setInterval(() => {
      setTestCallCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in text-left">
      <div className="bg-[#202c33] border border-[#2a3942] rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#2a3942] bg-[#111b21]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#00a884]/20 flex items-center justify-center text-[#00a884]">
              <PhoneCall className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Incoming Call Screen Setup</h3>
              <p className="text-[11px] text-[#8696a0]">
                {status?.model ? `Device: ${status.model}` : 'ตั้งค่าเพื่อให้แสดงหน้าจอสายโทรเข้าเมื่อล็อกหน้าจอ'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#2a3942] text-[#8696a0] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto space-y-3.5 text-xs text-[#d1d7db]">
          {/* Device Specific Tip Banner */}
          <div className="p-3 bg-[#111b21] rounded-xl border border-[#2a3942]">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs mb-1">
              <Smartphone className="w-4 h-4 flex-shrink-0" />
              <span>
                {isInfinix && 'Infinix / Tecno XOS Detected'}
                {isXiaomi && 'Xiaomi / Redmi MIUI Detected'}
                {isOppo && 'Oppo / Realme ColorOS Detected'}
                {isVivo && 'Vivo FuntouchOS Detected'}
                {isSamsung && 'Samsung OneUI Detected'}
                {!isInfinix && !isXiaomi && !isOppo && !isVivo && !isSamsung && 'Android Device Detected'}
              </span>
            </div>
            <p className="text-[11px] text-[#8696a0] leading-relaxed">
              {isInfinix && (
                <>
                  On Infinix XOS, please enable <strong>Background Pop-up Interface Permissions</strong>,{' '}
                  <strong>Screen turn-on control</strong>, and <strong>Auto-start in Phone Master</strong> so calls can wake your screen.
                  <br />
                  <span className="text-[#00a884] font-medium">
                    (บนมือถือ Infinix ต้องเปิด "Background Pop-up Interface", "Screen turn-on control" และ "Auto-start")
                  </span>
                </>
              )}
              {isXiaomi && (
                <>
                  On Xiaomi/Redmi, please enable <strong>Autostart</strong>, <strong>Show on Lock Screen</strong>, and set Battery to <strong>No restrictions</strong>.
                </>
              )}
              {isOppo && (
                <>
                  On Oppo/Realme, please allow <strong>Display pop-up windows</strong> and <strong>Allow background activity</strong>.
                </>
              )}
              {isVivo && (
                <>
                  On Vivo, please enable <strong>Autostart</strong> and <strong>Background pop-up</strong> in Permission Management.
                </>
              )}
              {isSamsung && (
                <>
                  On Samsung, set Battery to <strong>Unrestricted</strong> and enable <strong>Appear on top</strong>.
                </>
              )}
              {!isInfinix && !isXiaomi && !isOppo && !isVivo && !isSamsung && (
                <>
                  Please allow <strong>Display over other apps</strong> and set Battery to <strong>Unrestricted</strong> so incoming calls ring when the phone is locked.
                </>
              )}
            </p>
          </div>

          {/* Step 1: Notifications */}
          <div className="p-3.5 bg-[#182229] rounded-xl border border-[#2a3942] flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                status?.notifications ? 'bg-[#00a884]/20 text-[#00a884]' : 'bg-amber-500/20 text-amber-400'
              }`}>
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 font-semibold text-white">
                  <span>1. Notifications & Ringtone</span>
                  {status?.notifications ? (
                    <span className="text-[10px] text-[#00a884] bg-[#00a884]/15 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Allowed
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Needed
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#8696a0] mt-0.5">
                  Allows incoming call alerts, ringing sounds, and message banners.
                </p>
              </div>
            </div>
            {!status?.notifications && (
              <button
                onClick={() => {
                  if (bridge?.requestNotificationPermission) {
                    bridge.requestNotificationPermission();
                  } else if (bridge?.openNotificationSettings) {
                    bridge.openNotificationSettings();
                  }
                }}
                className="px-3 py-1.5 bg-[#00a884] hover:bg-[#008f6f] active:scale-95 text-white font-medium rounded-lg text-xs flex items-center gap-1 flex-shrink-0 transition-all shadow-md"
              >
                <span>Enable</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Step 2: Display Over Other Apps / Pop-up in Background */}
          <div className="p-3.5 bg-[#182229] rounded-xl border border-[#2a3942] flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                status?.canDrawOverlays ? 'bg-[#00a884]/20 text-[#00a884]' : 'bg-amber-500/20 text-amber-400'
              }`}>
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 font-semibold text-white">
                  <span>2. Display Over Other Apps / Pop-up</span>
                  {status?.canDrawOverlays ? (
                    <span className="text-[10px] text-[#00a884] bg-[#00a884]/15 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Allowed
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Required
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#8696a0] mt-0.5">
                  {isInfinix
                    ? 'Allows IChat to pop up full-screen call UI when another app or lock screen is active.'
                    : 'Shows incoming call screen when you are using other apps or phone is locked.'}
                </p>
              </div>
            </div>
            {!status?.canDrawOverlays && (
              <button
                onClick={() => {
                  if (bridge?.openOverlaySettings) {
                    bridge.openOverlaySettings();
                  }
                }}
                className="px-3 py-1.5 bg-[#00a884] hover:bg-[#008f6f] active:scale-95 text-white font-medium rounded-lg text-xs flex items-center gap-1 flex-shrink-0 transition-all shadow-md"
              >
                <span>Allow</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Step 3: Battery Optimization / Unrestricted */}
          <div className="p-3.5 bg-[#182229] rounded-xl border border-[#2a3942] flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                status?.isIgnoringBattery ? 'bg-[#00a884]/20 text-[#00a884]' : 'bg-amber-500/20 text-amber-400'
              }`}>
                <BatteryCharging className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 font-semibold text-white">
                  <span>3. Unrestricted Battery (No Sleep)</span>
                  {status?.isIgnoringBattery ? (
                    <span className="text-[10px] text-[#00a884] bg-[#00a884]/15 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Unrestricted
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Recommended
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#8696a0] mt-0.5">
                  Prevents Android from freezing IChat when your phone screen turns off.
                </p>
              </div>
            </div>
            {!status?.isIgnoringBattery && (
              <button
                onClick={() => {
                  if (bridge?.requestIgnoreBatteryOptimizations) {
                    bridge.requestIgnoreBatteryOptimizations();
                  }
                }}
                className="px-3 py-1.5 bg-[#00a884] hover:bg-[#008f6f] active:scale-95 text-white font-medium rounded-lg text-xs flex items-center gap-1 flex-shrink-0 transition-all shadow-md"
              >
                <span>Don't Optimize</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Step 4: Auto-start / Phone Master (OEM Specific) */}
          {(isInfinix || isXiaomi || isOppo || isVivo) && (
            <div className="p-3.5 bg-[#182229] rounded-xl border border-[#2a3942] flex items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-white">
                    <span>4. Auto-Start & Background Permission</span>
                  </div>
                  <p className="text-[11px] text-[#8696a0] mt-0.5">
                    {isInfinix && 'Open Phone Master → App Auto-start → Turn ON for IChat.'}
                    {isXiaomi && 'Open Security → Autostart → Turn ON for IChat.'}
                    {isOppo && 'Open App Management → Auto-launch → Turn ON for IChat.'}
                    {isVivo && 'Open Permission Manager → Autostart → Turn ON for IChat.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (bridge?.openAutoStartSettings) {
                    bridge.openAutoStartSettings();
                  }
                }}
                className="px-3 py-1.5 bg-[#2a3942] hover:bg-[#374248] active:scale-95 text-white font-medium rounded-lg text-xs flex items-center gap-1 flex-shrink-0 transition-all border border-[#3b4a54]"
              >
                <span>Open</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Additional Helpers for Infinix Special App Access */}
          {isInfinix && (
            <div className="p-2.5 bg-[#111b21] rounded-xl border border-[#2a3942]/60 flex items-center justify-between text-[11px]">
              <span className="text-[#8696a0]">
                Need to access <strong>Special App Access</strong> directly?
              </span>
              <button
                onClick={() => {
                  if (bridge?.openAppSettings) {
                    bridge.openAppSettings();
                  }
                }}
                className="text-[#00a884] hover:underline flex items-center gap-1 font-medium"
              >
                <span>App Info Settings</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 border-t border-[#2a3942] bg-[#111b21] flex items-center justify-between gap-2.5">
          <button
            onClick={refreshStatus}
            className="p-2 rounded-xl bg-[#202c33] hover:bg-[#2a3942] text-[#8696a0] hover:text-white transition-colors"
            title="Refresh permissions status"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleTestCall}
            disabled={testCallCountdown !== null}
            className="py-2.5 px-3 bg-[#202c33] hover:bg-[#2a3942] active:scale-95 text-white font-medium rounded-xl text-xs flex items-center gap-1.5 border border-[#2a3942] transition-all"
          >
            <Play className="w-3.5 h-3.5 text-[#00a884]" />
            <span>
              {testCallCountdown !== null
                ? `Lock screen now! Ringing in ${testCallCountdown}s...`
                : 'Test Call Screen (3s)'}
            </span>
          </button>

          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                localStorage.setItem('ichat_call_permissions_configured', 'true');
              }
              if (onCompleted) onCompleted();
              onClose();
            }}
            className="py-2.5 px-4 bg-[#00a884] hover:bg-[#008f6f] active:scale-95 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-lg transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{allCriticalGranted ? 'All Ready! Done' : 'Done'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
