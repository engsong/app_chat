import React, { useEffect, useRef } from 'react';
import { Phone, PhoneOff, Video, Mic, MicOff, VideoOff, Monitor, Maximize2 } from 'lucide-react';
import { IncomingCallInfo } from '../../hooks/useWebRTC.js';

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
  localStreamRef: React.RefObject<MediaStream | null>;
  remoteStreamRef: React.RefObject<MediaStream | null>;
  onAnswer: () => void;
  onReject: () => void;
  onEndCall: () => void;
  onToggleMute: () => void;
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
  localStreamRef,
  remoteStreamRef,
  onAnswer,
  onReject,
  onEndCall,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Attach local and remote streams to video elements
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [localStreamRef.current, callActive, isCalling, isVideoDisabled]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
    }
  }, [remoteStreamRef.current, callActive]);

  // Format seconds to mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 1. Incoming Call Dialog (WhatsApp style toast/modal)
  if (incomingCall && !callActive) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
        <div className="bg-[#202c33] border border-[#2a3942] rounded-2xl p-6 w-96 shadow-2xl flex flex-col items-center text-center animate-scale-up">
          <div className="relative mb-4">
            <img
              src={incomingCall.callerAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
              alt={incomingCall.callerName}
              className="w-24 h-24 rounded-full object-cover ring-4 ring-[#00a884] ring-offset-4 ring-offset-[#202c33] animate-pulse"
            />
            <span className="absolute bottom-0 right-0 p-2 bg-[#00a884] rounded-full text-white">
              {incomingCall.isVideo ? <Video className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
            </span>
          </div>

          <h3 className="text-xl font-semibold text-white mb-1">{incomingCall.callerName}</h3>
          <p className="text-sm text-[#00a884] font-medium mb-6">
            Incoming IChat {incomingCall.isVideo ? 'Video' : 'Voice'} Call...
          </p>

          <div className="flex items-center justify-center gap-8 w-full mt-2">
            <button
              onClick={onReject}
              className="flex flex-col items-center gap-1 group"
            >
              <div className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white transition-all shadow-lg shadow-red-600/30">
                <PhoneOff className="w-6 h-6" />
              </div>
              <span className="text-xs text-gray-400 group-hover:text-white">Decline</span>
            </button>

            <button
              onClick={onAnswer}
              className="flex flex-col items-center gap-1 group"
            >
              <div className="w-14 h-14 rounded-full bg-[#00a884] hover:bg-[#008f6f] flex items-center justify-center text-white transition-all shadow-lg shadow-[#00a884]/30 animate-bounce">
                {incomingCall.isVideo ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
              </div>
              <span className="text-xs text-gray-400 group-hover:text-white">Accept</span>
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
              src={remoteUserAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
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
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs rounded-full bg-[#202c33]/80 border border-white/10 text-[#00a884] font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#00a884] animate-ping" />
              End-to-End Encrypted
            </span>
          </div>
        </div>

        {/* Video / Visualizer Area */}
        <div className="relative flex-1 flex items-center justify-center bg-[#0c1317] overflow-hidden">
          {isVideoCall ? (
            <>
              {/* Remote Video */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />

              {/* Local Video PIP */}
              <div className="absolute top-6 right-6 w-36 h-48 sm:w-48 sm:h-64 rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl bg-black/60 z-10">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${isVideoDisabled ? 'hidden' : ''}`}
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
            </>
          ) : (
            /* Voice Call View with audio waveform */
            <div className="flex flex-col items-center text-center p-8">
              <div className="relative mb-6">
                <img
                  src={remoteUserAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
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
            className={`w-13 h-13 p-3.5 rounded-full transition-all ${
              isMuted ? 'bg-red-600 text-white' : 'bg-[#202c33]/90 hover:bg-[#2a3942] text-white'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          {/* Toggle Video */}
          {isVideoCall && (
            <button
              onClick={onToggleVideo}
              className={`w-13 h-13 p-3.5 rounded-full transition-all ${
                isVideoDisabled ? 'bg-red-600 text-white' : 'bg-[#202c33]/90 hover:bg-[#2a3942] text-white'
              }`}
              title={isVideoDisabled ? 'Turn Camera On' : 'Turn Camera Off'}
            >
              {isVideoDisabled ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
            </button>
          )}

          {/* Screen Share */}
          {isVideoCall && (
            <button
              onClick={onToggleScreenShare}
              className={`w-13 h-13 p-3.5 rounded-full transition-all ${
                isScreenSharing ? 'bg-[#00a884] text-white' : 'bg-[#202c33]/90 hover:bg-[#2a3942] text-white'
              }`}
              title="Share Screen"
            >
              <Monitor className="w-6 h-6" />
            </button>
          )}

          {/* End Call */}
          <button
            onClick={onEndCall}
            className="w-14 h-14 p-4 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/40 transition-transform active:scale-95"
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
