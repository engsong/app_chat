import { useState, useRef, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { soundEffects } from '../utils/audioTones.js';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export interface IncomingCallInfo {
  signal: any;
  from: string;
  callerName: string;
  callerAvatar?: string;
  isVideo: boolean;
  chatId?: string;
}

export interface GroupParticipantInfo {
  userId: string;
  socketId: string;
  name: string;
  avatar?: string;
  isVideo: boolean;
  stream?: MediaStream;
}

export function useWebRTC(socket: Socket | null, currentUserId: string | null) {
  // 1-on-1 Call States
  const [callActive, setCallActive] = useState(false);
  const [isCalling, setIsCalling] = useState(false); // Outgoing ringing
  const [incomingCall, setIncomingCall] = useState<IncomingCallInfo | null>(null);
  const [isVideoCall, setIsVideoCall] = useState(false);
  const [remoteUserName, setRemoteUserName] = useState('');
  const [remoteUserAvatar, setRemoteUserAvatar] = useState<string | undefined>();
  const [callDuration, setCallDuration] = useState(0);

  // Audio/Video control states
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Group Call States
  const [inGroupCall, setInGroupCall] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [groupParticipants, setGroupParticipants] = useState<GroupParticipantInfo[]>([]);

  // Refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const groupPeersRef = useRef<Map<string, RTCPeerConnection>>(new Map()); // userId -> RTCPeerConnection
  const groupStreamsRef = useRef<Map<string, MediaStream>>(new Map());     // userId -> MediaStream
  const callPartnerIdRef = useRef<string | null>(null);
  const timerRef = useRef<any>(null);

  // Initialize Local Media Stream
  const getMediaStream = async (video: boolean): Promise<MediaStream> => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: video ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
      });
      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      console.warn('getUserMedia error, falling back to audio only', err);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      return stream;
    }
  };

  // Clean up all streams and peer connections
  const cleanupCall = useCallback(() => {
    soundEffects.stopRingtone();
    soundEffects.playDisconnectTone();

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Close group peers
    groupPeersRef.current.forEach((pc) => pc.close());
    groupPeersRef.current.clear();
    groupStreamsRef.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    remoteStreamRef.current = null;
    callPartnerIdRef.current = null;

    setCallActive(false);
    setIsCalling(false);
    setIncomingCall(null);
    setCallDuration(0);
    setIsMuted(false);
    setIsVideoDisabled(false);
    setIsScreenSharing(false);
    setInGroupCall(false);
    setActiveGroupId(null);
    setGroupParticipants([]);
  }, []);

  // Start Call Duration Timer
  const startTimer = () => {
    setCallDuration(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  };

  // ==========================================
  // 1-on-1 Call Methods
  // ==========================================
  const startCall = async (
    targetUserId: string,
    targetName: string,
    targetAvatar: string | undefined,
    video: boolean,
    chatId?: string
  ) => {
    if (!socket || !currentUserId) return;

    callPartnerIdRef.current = targetUserId;
    setIsVideoCall(video);
    setRemoteUserName(targetName);
    setRemoteUserAvatar(targetAvatar);
    setIsCalling(true);
    soundEffects.startOutgoingRingtone();

    const stream = await getMediaStream(video);

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = pc;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.ontrack = (event) => {
      console.log('[WebRTC] Received remote track');
      if (event.streams && event.streams[0]) {
        remoteStreamRef.current = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice_candidate', { to: targetUserId, candidate: event.candidate });
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit('call_user', {
      userToCall: targetUserId,
      signalData: offer,
      from: currentUserId,
      callerName: targetName,
      callerAvatar: targetAvatar,
      isVideo: video,
      chatId,
    });
  };

  const answerCall = async () => {
    if (!socket || !incomingCall) return;

    soundEffects.stopRingtone();
    soundEffects.playConnectTone();

    const video = incomingCall.isVideo;
    setIsVideoCall(video);
    callPartnerIdRef.current = incomingCall.from;
    setRemoteUserName(incomingCall.callerName);
    setRemoteUserAvatar(incomingCall.callerAvatar);

    const stream = await getMediaStream(video);

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = pc;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        remoteStreamRef.current = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice_candidate', { to: incomingCall.from, candidate: event.candidate });
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.signal));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit('accept_call', { signal: answer, to: incomingCall.from });

    setIncomingCall(null);
    setCallActive(true);
    startTimer();
  };

  const rejectCall = () => {
    if (socket && incomingCall) {
      socket.emit('reject_call', { to: incomingCall.from });
    }
    soundEffects.stopRingtone();
    setIncomingCall(null);
  };

  const endCall = () => {
    if (socket && callPartnerIdRef.current) {
      socket.emit('end_call', { to: callPartnerIdRef.current });
    }
    cleanupCall();
  };

  // Toggle Mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // Toggle Camera
  const toggleVideo = async () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoDisabled(!videoTrack.enabled);
      }
    }
  };

  // Toggle Screen Share
  const toggleScreenShare = async () => {
    if (!peerConnectionRef.current) return;
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(screenTrack);
        }

        screenTrack.onended = () => {
          stopScreenShare();
        };

        setIsScreenSharing(true);
      } else {
        stopScreenShare();
      }
    } catch (err) {
      console.warn('Screen share cancelled or error:', err);
    }
  };

  const stopScreenShare = () => {
    if (localStreamRef.current && peerConnectionRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      const senders = peerConnectionRef.current.getSenders();
      const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
      if (videoSender && videoTrack) {
        videoSender.replaceTrack(videoTrack);
      }
    }
    setIsScreenSharing(false);
  };

  // ==========================================
  // Group Call Methods (Mesh Architecture)
  // ==========================================
  const joinGroupCall = async (
    groupId: string,
    currentUser: { id: string; name: string; avatar?: string },
    video: boolean
  ) => {
    if (!socket) return;

    setActiveGroupId(groupId);
    setInGroupCall(true);
    setIsVideoCall(video);
    soundEffects.playConnectTone();

    const stream = await getMediaStream(video);

    socket.emit('join_group_call', {
      groupId,
      user: currentUser,
      isVideo: video,
    });
  };

  const leaveGroupCall = () => {
    if (socket && activeGroupId && currentUserId) {
      socket.emit('leave_group_call', { groupId: activeGroupId, userId: currentUserId });
    }
    cleanupCall();
  };

  // ==========================================
  // Socket Event Listeners
  // ==========================================
  useEffect(() => {
    if (!socket) return;

    // Incoming 1-on-1 Call
    const handleIncomingCall = (data: IncomingCallInfo) => {
      console.log('[WebRTC] Incoming call from:', data.callerName);
      setIncomingCall(data);
      soundEffects.startIncomingRingtone();
    };

    // Call Accepted by remote user
    const handleCallAccepted = async (data: { signal: any }) => {
      console.log('[WebRTC] Call accepted by remote party');
      soundEffects.stopRingtone();
      soundEffects.playConnectTone();
      setIsCalling(false);
      setCallActive(true);
      startTimer();

      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.signal));
      }
    };

    // Call Rejected
    const handleCallRejected = () => {
      soundEffects.stopRingtone();
      cleanupCall();
    };

    // Call Ended
    const handleCallEnded = () => {
      cleanupCall();
    };

    // ICE Candidate
    const handleIceCandidate = async (data: { candidate: any }) => {
      try {
        if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } catch (err) {
        console.warn('Error adding ICE candidate:', err);
      }
    };

    // Group call participants listing
    const handleGroupCallUsers = (data: { participants: GroupParticipantInfo[] }) => {
      setGroupParticipants(data.participants);
    };

    const handleUserJoinedGroup = (user: GroupParticipantInfo) => {
      setGroupParticipants((prev) => [...prev.filter((p) => p.userId !== user.userId), user]);
    };

    const handleUserLeftGroup = (data: { userId: string }) => {
      setGroupParticipants((prev) => prev.filter((p) => p.userId !== data.userId));
    };

    socket.on('incoming_call', handleIncomingCall);
    socket.on('call_accepted', handleCallAccepted);
    socket.on('call_rejected', handleCallRejected);
    socket.on('call_ended', handleCallEnded);
    socket.on('call_failed', handleCallRejected);
    socket.on('ice_candidate', handleIceCandidate);
    socket.on('group_call_users', handleGroupCallUsers);
    socket.on('user_joined_group_call', handleUserJoinedGroup);
    socket.on('user_left_group_call', handleUserLeftGroup);

    return () => {
      socket.off('incoming_call', handleIncomingCall);
      socket.off('call_accepted', handleCallAccepted);
      socket.off('call_rejected', handleCallRejected);
      socket.off('call_ended', handleCallEnded);
      socket.off('call_failed', handleCallRejected);
      socket.off('ice_candidate', handleIceCandidate);
      socket.off('group_call_users', handleGroupCallUsers);
      socket.off('user_joined_group_call', handleUserJoinedGroup);
      socket.off('user_left_group_call', handleUserLeftGroup);
    };
  }, [socket, cleanupCall]);

  return {
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
    startCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    // Group Calling
    inGroupCall,
    activeGroupId,
    groupParticipants,
    joinGroupCall,
    leaveGroupCall,
  };
}
