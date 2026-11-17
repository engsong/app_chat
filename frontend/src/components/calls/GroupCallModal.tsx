import React, { useRef, useEffect, useState } from 'react';
import { PhoneOff, Mic, MicOff, Video, VideoOff, Users, Volume2, VolumeX } from 'lucide-react';
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
  remoteStreams?: Map<string, MediaStream>;
  isSpeakerOn?: boolean;
  onToggleSpeaker?: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onLeaveCall: () => void;
}

const RemoteAudioSink: React.FC<{ userId: string; stream: MediaStream }> = ({ userId, stream }) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
      audioRef.current.volume = 1.0;
      audioRef.current.muted = false;
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn(`[RemoteAudioSink:${userId}] Autoplay note:`, err);
          const unlock = () => {
            audioRef.current?.play().catch(() => {});
            window.removeEventListener('click', unlock);
            window.removeEventListener('touchstart', unlock);
          };
          window.addEventListener('click', unlock);
          window.addEventListener('touchstart', unlock);
        });
      }
    }
  }, [stream, userId]);

  // Keep element in active DOM flow without visual obstruction so WebView never suspends playback
  return (
    <audio
      ref={audioRef}
      autoPlay
      playsInline
      style={{ position: 'fixed', top: -9999, left: -9999, width: 1, height: 1, opacity: 0.01, pointerEvents: 'none' }}
    />
  );
};

const RemoteParticipantTile: React.FC<{
  participant: GroupParticipantInfo;
  stream?: MediaStream;
}> = ({ participant, stream }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasVideoTrack, setHasVideoTrack] = useState(false);

  useEffect(() => {
    if (!stream) {
      setHasVideoTrack(false);
      return;
    }

    const evaluateTracks = () => {
      const vTracks = stream.getVideoTracks();
      const valid = vTracks.length > 0 && vTracks.some((t) => t.readyState !== 'ended');
      setHasVideoTrack(valid);
      if (videoRef.current) {
        if (videoRef.current.srcObject !== stream) {
          videoRef.current.srcObject = stream;
        }
        videoRef.current.play().catch(() => {});
      }
    };

    evaluateTracks();
    stream.onaddtrack = evaluateTracks;
    stream.onremovetrack = evaluateTracks;

    stream.getVideoTracks().forEach((track) => {
      track.onunmute = evaluateTracks;
      track.onmute = evaluateTracks;
      track.onended = evaluateTracks;
    });

    const interval = setInterval(evaluateTracks, 1000);
    return () => clearInterval(interval);
  }, [stream, participant.isVideo]);

  const liveTracks = (stream?.getVideoTracks() || []).filter((t) => t.readyState !== 'ended');
  const showVideo = (participant.isVideo || hasVideoTrack || liveTracks.length > 0) && liveTracks.length > 0;

  return (
    <div className="relative rounded-2xl overflow-hidden bg-[#202c33] border border-[#2a3942] flex items-center justify-center min-h-[180px] shadow-lg">
      {/* Video is muted so it never conflicts with the dedicated audio sink */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover ${showVideo ? 'block' : 'hidden'}`}
      />
      {!showVideo && (
        <div className="flex flex-col items-center">
          <img
            src={participant.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
            alt={participant.name}
            className="w-20 h-20 rounded-full object-cover mb-2 ring-2 ring-[#00a884]/40"
          />
          <span className="text-sm font-semibold">{participant.name}</span>
          {participant.isVideo && (
            <span className="text-xs text-[#00a884] mt-1 animate-pulse">Connecting video...</span>
          )}
        </div>
      )}

      <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs flex items-center gap-2">
        <span>{participant.name}</span>
        {participant.isVideo || showVideo ? (
          <Video className="w-3.5 h-3.5 text-[#00a884]" />
        ) : (
          <Mic className="w-3.5 h-3.5 text-[#00a884]" />
        )}
      </div>
    </div>
  );
};

export const GroupCallModal: React.FC<GroupCallModalProps> = ({
  groupName,
  isVideoCall,
  participants,
  isMuted,
  isVideoDisabled,
  localStreamRef,
  remoteStreams,
  isSpeakerOn,
  onToggleSpeaker,
  onToggleMute,
  onToggleVideo,
  onLeaveCall,
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStreamRef.current, isVideoCall, isVideoDisabled]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#111b21] text-white">
      {/* Dedicated audio sinks for ALL active remote participants in the group call */}
      {Array.from(remoteStreams?.entries() || []).map(([uId, rStream]) => (
        <RemoteAudioSink key={uId} userId={uId} stream={rStream} />
      ))}
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
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${isVideoCall && !isVideoDisabled ? 'block' : 'hidden'}`}
          />
          {(!isVideoCall || isVideoDisabled) && (
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
          <RemoteParticipantTile
            key={p.userId}
            participant={p}
            stream={remoteStreams?.get(p.userId)}
          />
        ))}
      </div>

      {/* Control Bar */}
      <div className="py-6 px-8 bg-gradient-to-t from-black/90 to-transparent flex items-center justify-center gap-6 z-10">
        {/* Toggle Microphone */}
        <button
          onClick={onToggleMute}
          className={`w-13 h-13 p-3.5 rounded-full transition-all ${
            isMuted ? 'bg-red-600 text-white' : 'bg-[#202c33] hover:bg-[#2a3942] text-white'
          }`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        {/* Toggle Speaker (Loudspeaker vs Earpiece) */}
        {onToggleSpeaker && (
          <button
            onClick={onToggleSpeaker}
            className={`w-13 h-13 p-3.5 rounded-full transition-all ${
              isSpeakerOn
                ? 'bg-[#00a884] hover:bg-[#008f6f] text-white shadow-lg shadow-[#00a884]/30'
                : 'bg-[#202c33] hover:bg-[#2a3942] text-gray-300'
            }`}
            title={isSpeakerOn ? 'Speakerphone On (Tap for Earpiece)' : 'Speakerphone Off (Tap for Loudspeaker)'}
          >
            {isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
          </button>
        )}

        {/* Camera / Video Button (ALWAYS available: switches voice call to video call, or toggles camera) */}
        <button
          onClick={onToggleVideo}
          className={`w-13 h-13 p-3.5 rounded-full transition-all ${
            !isVideoCall || isVideoDisabled
              ? 'bg-red-600/80 hover:bg-red-600 text-white'
              : 'bg-[#00a884] hover:bg-[#008f6f] text-white'
          }`}
          title={!isVideoCall ? 'Switch to Video Call' : isVideoDisabled ? 'Turn Camera On' : 'Turn Camera Off'}
        >
          {!isVideoCall || isVideoDisabled ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
        </button>

        {/* Leave Call */}
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
