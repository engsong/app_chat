import React, { useRef, useEffect } from 'react';
import { PhoneOff, Mic, MicOff, Video, VideoOff, Users } from 'lucide-react';
import { GroupParticipantInfo } from '../../hooks/useWebRTC.js';

interface GroupCallModalProps {
  groupId: string;
  groupName: string;
  isVideoCall: boolean;
  participants: GroupParticipantInfo[];
  currentUserId: string;
  isMuted: boolean;
  isVideoDisabled: boolean;
  localStreamRef: React.RefObject<MediaStream | null>;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onLeaveCall: () => void;
}

export const GroupCallModal: React.FC<GroupCallModalProps> = ({
  groupName,
  isVideoCall,
  participants,
  isMuted,
  isVideoDisabled,
  localStreamRef,
  onToggleMute,
  onToggleVideo,
  onLeaveCall,
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [localStreamRef.current, isVideoDisabled]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#111b21] text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/70 to-transparent z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center font-bold">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="font-semibold text-base">{groupName}</h4>
            <p className="text-xs text-[#00a884] flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#00a884] animate-ping" />
              Group {isVideoCall ? 'Video' : 'Voice'} Call • {participants.length + 1} Participants
            </p>
          </div>
        </div>
      </div>

      {/* Grid of Call Participants */}
      <div className="flex-1 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr overflow-y-auto">
        {/* Local Participant Tile */}
        <div className="relative rounded-2xl overflow-hidden bg-[#202c33] border border-[#2a3942] flex items-center justify-center min-h-[180px] shadow-lg">
          {isVideoCall && !isVideoDisabled ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-[#00a884] flex items-center justify-center text-2xl font-bold mb-2 shadow-inner">
                You
              </div>
              <span className="text-sm font-medium text-gray-300">You (Speaking)</span>
            </div>
          )}

          <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs flex items-center gap-2">
            <span>You</span>
            {isMuted ? <MicOff className="w-3.5 h-3.5 text-red-400" /> : <Mic className="w-3.5 h-3.5 text-green-400" />}
          </div>
        </div>

        {/* Remote Participants */}
        {participants.map((p) => (
          <div
            key={p.userId}
            className="relative rounded-2xl overflow-hidden bg-[#202c33] border border-[#2a3942] flex items-center justify-center min-h-[180px] shadow-lg"
          >
            <div className="flex flex-col items-center">
              <img
                src={p.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                alt={p.name}
                className="w-20 h-20 rounded-full object-cover mb-2 ring-2 ring-[#00a884]/40"
              />
              <span className="text-sm font-semibold">{p.name}</span>
            </div>

            <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs flex items-center gap-2">
              <span>{p.name}</span>
              <Mic className="w-3.5 h-3.5 text-green-400" />
            </div>
          </div>
        ))}
      </div>

      {/* Control Bar */}
      <div className="py-6 px-8 bg-gradient-to-t from-black/90 to-transparent flex items-center justify-center gap-6 z-10">
        <button
          onClick={onToggleMute}
          className={`w-13 h-13 p-3.5 rounded-full transition-all ${
            isMuted ? 'bg-red-600 text-white' : 'bg-[#202c33] hover:bg-[#2a3942] text-white'
          }`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        {isVideoCall && (
          <button
            onClick={onToggleVideo}
            className={`w-13 h-13 p-3.5 rounded-full transition-all ${
              isVideoDisabled ? 'bg-red-600 text-white' : 'bg-[#202c33] hover:bg-[#2a3942] text-white'
            }`}
            title={isVideoDisabled ? 'Camera On' : 'Camera Off'}
          >
            {isVideoDisabled ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
          </button>
        )}

        <button
          onClick={onLeaveCall}
          className="w-14 h-14 p-4 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/40"
          title="Leave Group Call"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
