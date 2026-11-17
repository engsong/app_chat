import React, { useEffect, useRef } from 'react';
import { Phone, PhoneOff, Video, Mic, MicOff, VideoOff, Monitor, Maximize2, Volume2, VolumeX } from 'lucide-react';
import { IncomingCallInfo } from '../../hooks/useWebRTC.js';
import { getAvatarUrl } from '../../utils/avatar.js';

interface CallModalProps {
  callActive: boolean;
  isCalling: boolean;
  incomingCall: IncomingCallInfo | null;
  isVideoCall: boolean;
  remoteUserName: string;
  remoteUserAvatar?: string;
  callDuration: number;
  isMuted: boolean;
  isVideoDisabled: boolean;
  isScreenSharing: boolean;
  isSpeakerOn?: boolean;
  localStreamRef: React.RefObject<MediaStream | null>;
  remoteStreamRef: React.RefObject<MediaStream | null>;
  remoteStream?: MediaStream | null;
  onAnswer: () => void;
  onReject: () => void;
  onEndCall: () => void;
  onToggleMute: () => void;
  onToggleSpeaker?: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
}

export const CallModal: React.FC<CallModalProps> = ({
  callActive,
  isCalling,
  incomingCall,
  isVideoCall,
  remoteUserName,
  remoteUserAvatar,
  callDuration,
  isMuted,
  isVideoDisabled,
  isScreenSharing,
  isSpeakerOn,
  localStreamRef,
  remoteStreamRef,
  remoteStream,
  onAnswer,
  onReject,
  onEndCall,
  onToggleMute,
  onToggleSpeaker,
  onToggleVideo,
  onToggleScreenShare,
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Attach local and remote streams to video and audio elements
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStreamRef.current, callActive, isCalling, isVideoCall, isVideoDisabled]);

  useEffect(() => {
    const stream = remoteStream || remoteStreamRef.current;
    if (stream) {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
        remoteVideoRef.current.play().catch((err) => console.warn('[Video] Play note:', err));
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.play().catch((err) => console.warn('[Audio] Play note:', err));
      }
    }
  }, [remoteStream, remoteStreamRef.current, callActive, isVideoCall]);

  // Format seconds to mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 1. Incoming Call Screen (Full Screen WhatsApp Style)
  if (incomingCall && !callActive) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col justify-between bg-[#0b141a] text-white overflow-hidden select-none animate-fade-in">
        {/* Background Caller Photo (Blurred Backdrop) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <img
            src={getAvatarUrl(incomingCall.callerAvatar)}
            alt=""
            className="w-full h-full object-cover filter blur-3xl scale-150 opacity-25"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0b141a]/85 via-[#0b141a]/90 to-black/95" />
        </div>

        {/* Top Header Section */}
        <div className="relative z-10 flex flex-col items-center pt-12 sm:pt-16 px-6 text-center">
          <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
            <svg className="w-3.5 h-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span className="tracking-wide">End-to-end encrypted</span>
          </div>
          <h4 className="text-sm font-semibold tracking-wider text-gray-300 uppercase">
            IChat {incomingCall.isVideo ? 'Video Call' : 'Voice Call'}
          </h4>
        </div>

        {/* Center Caller Profile & Pulsing Rings */}
        <div className="relative z-10 flex flex-col items-center justify-center my-auto px-6 text-center">
          <div className="relative mb-8">
            {/* Concentric Animated Pulse Rings */}
            <div className="absolute -inset-4 rounded-full bg-[#00a884]/20 animate-ping opacity-60" />
            <div className="absolute -inset-8 rounded-full border border-[#00a884]/30 animate-pulse" />
            
            <img
              src={getAvatarUrl(incomingCall.callerAvatar)}
              alt={incomingCall.callerName}
              className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-full object-cover shadow-2xl ring-4 ring-[#00a884]/50"
            />
            
            <div className="absolute bottom-1 right-2 p-3 bg-[#00a884] rounded-full text-white shadow-xl shadow-[#00a884]/40">
              {incomingCall.isVideo ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
            </div>
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2 tracking-wide drop-shadow-md">
            {incomingCall.callerName}
          </h2>
          <p className="text-base text-[#00a884] font-medium flex items-center gap-2 drop-shadow">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00a884] animate-ping" />
            Incoming {incomingCall.isVideo ? 'Video' : 'Voice'} Call...
          </p>
        </div>

        {/* Bottom Section - Full WhatsApp Style Accept & Decline Actions */}
        <div className="relative z-10 flex flex-col items-center pb-12 sm:pb-16 px-8">
          {/* Swipe indicator animation */}
          <div className="flex flex-col items-center mb-8 text-gray-400/90 animate-bounce cursor-pointer" onClick={onAnswer}>
            <svg className="w-6 h-6 text-[#00a884]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 15l7-7 7 7"/>
            </svg>
            <span className="text-xs font-medium tracking-widest uppercase text-gray-300">Swipe up or tap to answer</span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-around w-full max-w-xs sm:max-w-sm">
            {/* Decline Button */}
            <button
              onClick={onReject}
              className="flex flex-col items-center gap-2 group active:scale-95 transition-all"
            >
              <div className="w-[76px] h-[76px] sm:w-[84px] sm:h-[84px] rounded-full bg-[#ea0038] hover:bg-[#c90030] flex items-center justify-center text-white shadow-2xl shadow-red-600/60 ring-4 ring-red-500/30 active:scale-90 transition-all">
                <PhoneOff className="w-8 h-8 sm:w-9 sm:h-9" />
              </div>
              <span className="text-sm font-medium text-gray-300 group-hover:text-white">Decline</span>
            </button>

            {/* Accept Button */}
            <button
              onClick={onAnswer}
              className="flex flex-col items-center gap-2 group active:scale-95 transition-all"
            >
              <div className="w-[76px] h-[76px] sm:w-[84px] sm:h-[84px] rounded-full bg-[#25D366] hover:bg-[#20ba59] flex items-center justify-center text-white shadow-2xl shadow-emerald-500/60 ring-4 ring-emerald-500/35 animate-pulse active:scale-90 transition-all">
                {incomingCall.isVideo ? (
                  <Video className="w-8 h-8 sm:w-9 sm:h-9" />
                ) : (
                  <Phone className="w-8 h-8 sm:w-9 sm:h-9" />
                )}
              </div>
              <span className="text-sm font-medium text-gray-300 group-hover:text-white">Accept</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Outgoing Call Screen or Active 1-on-1 Call Screen
  if (isCalling || callActive) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-[#111b21] text-white">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/60 to-transparent z-20">
          <div className="flex items-center gap-3">
            <img
              src={getAvatarUrl(remoteUserAvatar)}
              alt={remoteUserName}
              className="w-10 h-10 rounded-full object-cover"
            />
            <div>
              <h4 className="font-semibold text-base leading-tight">{remoteUserName}</h4>
              <p className="text-xs text-[#00a884]">
                {isCalling ? 'Calling...' : `IChat ${isVideoCall ? 'Video' : 'Voice'} • ${formatTime(callDuration)}`}
              </p>
            </div>
          </div>
        </div>

        {/* Dedicated Audio Element for Voice and Video audio stream playback */}
        <audio
          ref={remoteAudioRef}
          autoPlay
          playsInline
          className="hidden"
        />

        {/* Video / Visualizer Area */}
        <div className="relative flex-1 flex items-center justify-center bg-[#0c1317] overflow-hidden">
          {/* Remote Video - permanently mounted to preserve ref and active stream attachment */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={`w-full h-full object-cover ${isVideoCall ? 'block' : 'hidden'}`}
          />

          {/* Local Video PIP - permanently mounted */}
          <div className={`absolute top-6 right-6 w-36 h-48 sm:w-48 sm:h-64 rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl bg-black/60 z-10 ${isVideoCall ? 'block' : 'hidden'}`}>
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${isVideoDisabled ? 'hidden' : 'block'}`}
            />
            {isVideoDisabled && (
              <div className="w-full h-full flex flex-col items-center justify-center bg-[#202c33] text-gray-400">
                <VideoOff className="w-8 h-8 mb-2" />
                <span className="text-xs">Camera Off</span>
              </div>
            )}
            <div className="absolute bottom-2 left-2 text-[10px] bg-black/60 px-2 py-0.5 rounded text-white">
              You
            </div>
          </div>

          {/* Voice Call View with audio waveform (shown when not video call) */}
          {!isVideoCall && (
            <div className="flex flex-col items-center text-center p-8 z-10">
              <div className="relative mb-6">
                <img
                  src={getAvatarUrl(remoteUserAvatar)}
                  alt={remoteUserName}
                  className="w-32 h-32 rounded-full object-cover ring-8 ring-[#202c33] shadow-2xl"
                />
                {callActive && (
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-[#00a884] px-3 py-0.5 rounded-full text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    Live
                  </div>
                )}
              </div>
              <h2 className="text-2xl font-bold mb-2">{remoteUserName}</h2>
              <p className="text-sm text-gray-400 mb-8">
                {isCalling ? 'Ringing...' : `In Call • ${formatTime(callDuration)}`}
              </p>

              {/* Sound waves animation */}
              {callActive && (
                <div className="flex items-center gap-1.5 h-12">
                  {[...Array(12)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1.5 bg-[#00a884] rounded-full soundwave-bar"
                      style={{
                        animationDelay: `${(i * 0.1).toFixed(2)}s`,
                        height: `${Math.max(6, (i % 5) * 8 + 8)}px`,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Control Bar */}
        <div className="py-6 px-8 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-4 sm:gap-6 z-20">
          {/* Mute Mic */}
          <button
            onClick={onToggleMute}
            className={`w-12 h-12 p-3 rounded-full flex items-center justify-center transition-all ${
              isMuted ? 'bg-red-600 text-white' : 'bg-[#202c33]/90 hover:bg-[#2a3942] text-white'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Speakerphone Toggle (Loudspeaker vs Earpiece) */}
          {onToggleSpeaker && (
            <button
              onClick={onToggleSpeaker}
              className={`w-12 h-12 p-3 rounded-full flex items-center justify-center transition-all ${
                isSpeakerOn
                  ? 'bg-[#00a884] text-white shadow-lg shadow-[#00a884]/40'
                  : 'bg-[#202c33]/90 hover:bg-[#2a3942] text-gray-300'
              }`}
              title={isSpeakerOn ? 'Speakerphone On (Tap for Earpiece)' : 'Speakerphone Off (Tap for Loudspeaker)'}
            >
              {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
          )}

          {/* Switch to Video / Toggle Camera */}
          <button
            onClick={onToggleVideo}
            className={`w-12 h-12 p-3 rounded-full flex items-center justify-center transition-all ${
              !isVideoCall
                ? 'bg-[#202c33]/90 hover:bg-[#2a3942] text-gray-200 hover:text-[#00a884]'
                : isVideoDisabled
                ? 'bg-red-600 text-white'
                : 'bg-[#00a884] text-white shadow-lg shadow-[#00a884]/40'
            }`}
            title={
              !isVideoCall
                ? 'Switch to Video Call'
                : isVideoDisabled
                ? 'Turn Camera On'
                : 'Turn Camera Off'
            }
          >
            {isVideoCall && !isVideoDisabled ? (
              <Video className="w-5 h-5" />
            ) : (
              <VideoOff className="w-5 h-5" />
            )}
          </button>

          {/* Screen Share */}
          {isVideoCall && (
            <button
              onClick={onToggleScreenShare}
              className={`w-12 h-12 p-3 rounded-full flex items-center justify-center transition-all ${
                isScreenSharing ? 'bg-[#00a884] text-white' : 'bg-[#202c33]/90 hover:bg-[#2a3942] text-white'
              }`}
              title="Share Screen"
            >
              <Monitor className="w-5 h-5" />
            </button>
          )}

          {/* End Call */}
          <button
            onClick={onEndCall}
            className="w-14 h-14 p-4 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/40 flex items-center justify-center transition-transform active:scale-95"
            title="End Call"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>
      </div>
    );
  }

  return null;
};
