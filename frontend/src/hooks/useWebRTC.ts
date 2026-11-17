import { useState, useRef, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { soundEffects } from '../utils/audioTones.js';
import { showCallNotification, closeCallNotification } from '../utils/notifications.js';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    // Free public TURN relay servers for mobile carrier CGNAT / symmetric NAT traversal
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
};

export interface IncomingCallInfo {
  signal?: any;
  from: string;
  callerName: string;
  callerAvatar?: string;
  isVideo: boolean;
  chatId?: string;
  groupId?: string;
  isGroup?: boolean;
  groupName?: string;
}

export interface GroupParticipantInfo {
  userId: string;
  socketId: string;
  name: string;
  avatar?: string;
  isVideo: boolean;
  stream?: MediaStream;
}

export function useWebRTC(
  socket: Socket | null,
  currentUserId: string | null,
  currentUser?: { id: string; name: string; avatar?: string } | null
) {
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
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  // Group Call States
  const [inGroupCall, setInGroupCall] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [groupParticipants, setGroupParticipants] = useState<GroupParticipantInfo[]>([]);
  const [groupRemoteStreams, setGroupRemoteStreams] = useState<Map<string, MediaStream>>(new Map());

  // Refs
  const inGroupCallRef = useRef(false);
  inGroupCallRef.current = inGroupCall;
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pendingCandidatesRef = useRef<any[]>([]);
  const pendingGroupCandidatesRef = useRef<Map<string, any[]>>(new Map());
  const groupPeersRef = useRef<Map<string, RTCPeerConnection>>(new Map()); // userId -> RTCPeerConnection
  const groupStreamsRef = useRef<Map<string, MediaStream>>(new Map());     // userId -> MediaStream
  const callPartnerIdRef = useRef<string | null>(null);
  const timerRef = useRef<any>(null);
  const callTimeoutRef = useRef<any>(null);          // 1-minute timeout for outgoing ringing
  const incomingCallTimeoutRef = useRef<any>(null);  // 1-minute auto-decline for incoming calls

  // Helper to create synthetic silent audio track when microphone hardware is unavailable
  const createSyntheticAudioTrack = (): MediaStreamTrack => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const dst = ctx.createMediaStreamDestination();
        osc.connect(dst);
        osc.start();
        const track = dst.stream.getAudioTracks()[0];
        if (track) {
          track.enabled = false;
          return track;
        }
      }
    } catch (_) {}
    // Dummy track object fallback
    return new MediaStream().getAudioTracks()[0];
  };

  // Initialize Local Media Stream safely (never throws)
  const getMediaStream = async (video: boolean): Promise<MediaStream> => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    if (video) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30, max: 30 },
            facingMode: 'user',
          },
        });
        localStreamRef.current = stream;
        return stream;
      } catch (err) {
        console.warn('Video + Audio failed, falling back to audio only', err);
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      console.warn('Microphone hardware unavailable or permission denied, using silent fallback track', err);
      try {
        const silentTrack = createSyntheticAudioTrack();
        if (silentTrack) {
          const fallbackStream = new MediaStream([silentTrack]);
          localStreamRef.current = fallbackStream;
          return fallbackStream;
        }
      } catch (_) {}
      const emptyStream = new MediaStream();
      localStreamRef.current = emptyStream;
      return emptyStream;
    }
  };

  // Clean up all streams and peer connections
  const cleanupCall = useCallback(() => {
    soundEffects.stopRingtone();
    soundEffects.playDisconnectTone();
    closeCallNotification();

    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }

    if (incomingCallTimeoutRef.current) {
      clearTimeout(incomingCallTimeoutRef.current);
      incomingCallTimeoutRef.current = null;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Close group peers
    groupPeersRef.current.forEach((pc) => {
      try {
        pc.close();
      } catch (_) {}
    });
    groupPeersRef.current.clear();
    groupStreamsRef.current.clear();
    pendingGroupCandidatesRef.current.clear();
    setGroupRemoteStreams(new Map());

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    remoteStreamRef.current = null;
    callPartnerIdRef.current = null;
    pendingCandidatesRef.current = [];
    setRemoteStream(null);

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

    if ((window as any).AndroidAudioBridge?.resetAudioMode) {
      try {
        (window as any).AndroidAudioBridge.resetAudioMode();
      } catch (_) {}
    }
    setIsSpeakerOn(true);
  }, []);

  // Toggle Speakerphone (Earpiece vs Loudspeaker)
  const toggleSpeaker = (forceState?: boolean) => {
    setIsSpeakerOn((prev) => {
      const next = forceState !== undefined ? forceState : !prev;
      if ((window as any).AndroidAudioBridge?.setSpeakerphoneOn) {
        try {
          (window as any).AndroidAudioBridge.setSpeakerphoneOn(next);
        } catch (err) {
          console.warn('[WebRTC] Error toggling Android speakerphone:', err);
        }
      }
      return next;
    });
  };

  // Helper to drain queued ICE candidates once remoteDescription is set
  const drainCandidateQueue = async (pc: RTCPeerConnection) => {
    while (pendingCandidatesRef.current.length > 0) {
      const cand = pendingCandidatesRef.current.shift();
      if (cand) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
          console.log('[WebRTC] Processed queued ICE candidate');
        } catch (err) {
          console.warn('[WebRTC] Error adding queued candidate:', err);
        }
      }
    }
  };

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
    chatId?: string,
    currentUserName?: string,
    currentUserAvatar?: string
  ) => {
    if (!socket || !currentUserId) return;
    if (!socket.connected) {
      console.log('[WebRTC] Socket not connected, reconnecting before starting call...');
      socket.connect();
    }

    try {
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
        console.log('[WebRTC] Received remote track:', event.track.kind);
        let stream = event.streams && event.streams[0];
        if (!stream) {
          stream = remoteStreamRef.current || new MediaStream();
          stream.addTrack(event.track);
        }
        remoteStreamRef.current = stream;
        setRemoteStream(new MediaStream(stream.getTracks()));
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice_candidate', { to: targetUserId, candidate: event.candidate });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Start 1-minute (60 seconds) outgoing ringing timeout - auto decline if no answer
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = setTimeout(() => {
        console.log('[WebRTC] Outgoing call timed out after 1 minute (no answer)');
        if (socket && targetUserId) {
          socket.emit('end_call', { to: targetUserId, reason: 'no_answer' });
        }
        cleanupCall();
      }, 60000);

      socket.emit('call_user', {
        userToCall: targetUserId,
        signalData: offer,
        from: currentUserId,
        callerName: currentUserName || 'IChat User',
        callerAvatar: currentUserAvatar,
        isVideo: video,
        chatId,
      });
    } catch (err) {
      console.error('[WebRTC] Error initiating call:', err);
      cleanupCall();
      alert('Unable to start call. Please check camera and microphone permissions.');
    }
  };

  const answerCall = async () => {
    if (!socket || !incomingCall) return;

    if (incomingCallTimeoutRef.current) {
      clearTimeout(incomingCallTimeoutRef.current);
      incomingCallTimeoutRef.current = null;
    }
    closeCallNotification();

    soundEffects.stopRingtone();
    soundEffects.playConnectTone();

    // If incoming call is a Group Call:
    if (incomingCall.isGroup && incomingCall.chatId) {
      const gid = incomingCall.chatId;
      const vid = incomingCall.isVideo;
      setIncomingCall(null);
      await joinGroupCall(
        gid,
        currentUser || { id: currentUserId || '', name: 'Me' },
        vid
      );
      return;
    }

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
      console.log('[WebRTC] Received remote track:', event.track.kind);
      let rStream = event.streams && event.streams[0];
      if (!rStream) {
        rStream = remoteStreamRef.current || new MediaStream();
        rStream.addTrack(event.track);
      }
      remoteStreamRef.current = rStream;
      setRemoteStream(new MediaStream(rStream.getTracks()));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice_candidate', { to: incomingCall.from, candidate: event.candidate });
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.signal));
    await drainCandidateQueue(pc);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit('accept_call', { signal: answer, to: incomingCall.from });

    setIncomingCall(null);
    setCallActive(true);
    startTimer();
  };

  const rejectCall = () => {
    if (incomingCallTimeoutRef.current) {
      clearTimeout(incomingCallTimeoutRef.current);
      incomingCallTimeoutRef.current = null;
    }
    closeCallNotification();

    if (socket && incomingCall) {
      const isGrp = Boolean(incomingCall.isGroup);
      const grpId = incomingCall.groupId || incomingCall.chatId;
      if (isGrp && grpId) {
        socket.emit('reject_group_call', { groupId: grpId, callerId: incomingCall.from });
      } else if (incomingCall.from) {
        socket.emit('reject_call', { to: incomingCall.from });
      }
    }
    soundEffects.stopRingtone();
    setIncomingCall(null);
  };

  const endCall = () => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    if (incomingCallTimeoutRef.current) {
      clearTimeout(incomingCallTimeoutRef.current);
      incomingCallTimeoutRef.current = null;
    }
    closeCallNotification();

    if (socket && callPartnerIdRef.current) {
      socket.emit('end_call', { to: callPartnerIdRef.current, duration: callDuration });
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

  // Toggle Camera / Switch Voice Call to Video Call
  const toggleVideo = async () => {
    try {
      if (!localStreamRef.current) {
        localStreamRef.current = new MediaStream();
      }

      let videoTrack = localStreamRef.current.getVideoTracks()[0];

      // If call is currently voice-only or doesn't have video track, acquire camera
      if (!videoTrack) {
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30, max: 30 },
            facingMode: 'user',
          },
        });
        videoTrack = camStream.getVideoTracks()[0];
        if (videoTrack) {
          localStreamRef.current.addTrack(videoTrack);

          // Add or replace on peer connection (1-on-1 Call)
          if (!inGroupCall && peerConnectionRef.current) {
            const senders = peerConnectionRef.current.getSenders();
            const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
            if (videoSender) {
              await videoSender.replaceTrack(videoTrack);
            } else {
              peerConnectionRef.current.addTrack(videoTrack, localStreamRef.current);
            }

            // In-call WebRTC renegotiation for 1-on-1 call
            try {
              const offer = await peerConnectionRef.current.createOffer();
              await peerConnectionRef.current.setLocalDescription(offer);
              if (socket && callPartnerIdRef.current) {
                socket.emit('renegotiate_offer', {
                  to: callPartnerIdRef.current,
                  signal: offer,
                });
              }
            } catch (renegErr) {
              console.warn('[WebRTC] In-call renegotiation error:', renegErr);
            }
          }

          // If in Group Call:
          if (inGroupCall) {
            for (const [targetUid, pc] of groupPeersRef.current.entries()) {
              try {
                const transceivers = pc.getTransceivers();
                const videoTransceiver = transceivers.find(
                  (t) => t.sender.track?.kind === 'video' || t.receiver.track?.kind === 'video'
                );
                if (videoTransceiver) {
                  videoTransceiver.direction = 'sendrecv';
                  await videoTransceiver.sender.replaceTrack(videoTrack);
                } else {
                  pc.addTrack(videoTrack, localStreamRef.current!);
                }
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                if (socket && currentUserId) {
                  socket.emit('group_call_signal', {
                    userToSignal: targetUid,
                    callerId: currentUserId,
                    signal: offer,
                  });
                }
              } catch (e) {
                console.warn('[GroupWebRTC] Error renegotiating video for peer:', e);
              }
            }
            if (socket && activeGroupId) {
              socket.emit('switch_group_call_to_video', { groupId: activeGroupId, isVideo: true });
            }
          }

          setIsVideoCall(true);
          setIsVideoDisabled(false);
          toggleSpeaker(true);

          // Notify remote peer to switch to video UI (1-on-1 call)
          if (!inGroupCall && socket && callPartnerIdRef.current) {
            socket.emit('switch_call_to_video', { to: callPartnerIdRef.current, isVideo: true });
          }
        }
      } else {
        // Toggle camera on/off
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoDisabled(!videoTrack.enabled);
        if (inGroupCall) {
          for (const [, pc] of groupPeersRef.current.entries()) {
            try {
              const transceivers = pc.getTransceivers();
              const videoTransceiver = transceivers.find(
                (t) => t.sender.track?.kind === 'video' || t.receiver.track?.kind === 'video'
              );
              if (videoTransceiver) {
                videoTransceiver.direction = videoTrack.enabled ? 'sendrecv' : 'recvonly';
              }
            } catch (_) {}
          }
          if (socket && activeGroupId) {
            socket.emit('switch_group_call_to_video', { groupId: activeGroupId, isVideo: videoTrack.enabled });
          }
        }
      }
    } catch (err) {
      console.warn('[WebRTC] Error toggling or switching to video:', err);
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
    toggleSpeaker(true);

    const stream = await getMediaStream(video);

    socket.emit('join_group_call', {
      groupId,
      user: currentUser,
      isVideo: video,
    });
  };

  const createPeerForGroupMember = async (
    targetUserId: string,
    isInitiator: boolean,
    stream: MediaStream
  ) => {
    if (!socket || !currentUserId) return null;

    let pc = groupPeersRef.current.get(targetUserId);
    if (pc && pc.signalingState !== 'closed') {
      console.log(`[GroupWebRTC] Reusing active peer connection for ${targetUserId}`);
      // Ensure audio track is present in senders
      const senders = pc.getSenders();
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack && !senders.some((s) => s.track && s.track.kind === 'audio')) {
        try {
          audioTrack.enabled = true;
          pc.addTrack(audioTrack, stream);
        } catch (_) {}
      }
      return pc;
    }

    if (pc) {
      try {
        pc.close();
      } catch (_) {}
      groupPeersRef.current.delete(targetUserId);
    }

    pc = new RTCPeerConnection(ICE_SERVERS);
    groupPeersRef.current.set(targetUserId, pc);

    pc.oniceconnectionstatechange = () => {
      console.log(`[GroupWebRTC] Peer ${targetUserId} iceConnectionState: ${pc?.iceConnectionState}`);
    };

    pc.onconnectionstatechange = () => {
      console.log(`[GroupWebRTC] Peer ${targetUserId} connectionState: ${pc?.connectionState}`);
    };

    // Add audio track directly for crystal-clear voice communication
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      try {
        audioTrack.enabled = true;
        pc.addTrack(audioTrack, stream);
      } catch (err) {
        console.warn(`[GroupWebRTC] Error adding audio track to ${targetUserId}:`, err);
      }
    }

    // Add video track or video receiver transceiver
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      try {
        videoTrack.enabled = true;
        pc.addTrack(videoTrack, stream);
      } catch (err) {
        console.warn(`[GroupWebRTC] Error adding video track to ${targetUserId}:`, err);
      }
    } else {
      try {
        pc.addTransceiver('video', { direction: 'recvonly' });
      } catch (_) {}
    }

    pc.ontrack = (event) => {
      console.log(`[GroupWebRTC] Received remote ${event.track.kind} track from ${targetUserId}`);
      try {
        event.track.enabled = true;
      } catch (_) {}

      let currentStream = groupStreamsRef.current.get(targetUserId);
      if (!currentStream) {
        currentStream = new MediaStream();
      }
      if (!currentStream.getTracks().some((t) => t.id === event.track.id)) {
        currentStream.addTrack(event.track);
      }
      // Re-wrap in brand new MediaStream to ensure React state identity triggers UI update & audio play
      const newStream = new MediaStream(currentStream.getTracks());
      groupStreamsRef.current.set(targetUserId, newStream);
      setGroupRemoteStreams(new Map(groupStreamsRef.current));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('group_ice_candidate', {
          userToSignal: targetUserId,
          candidate: event.candidate,
          callerId: currentUserId,
        });
      }
    };

    if (isInitiator) {
      try {
        // Clean unified plan offer without conflicting offerToReceiveAudio
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('group_call_signal', {
          userToSignal: targetUserId,
          callerId: currentUserId,
          signal: offer,
        });
      } catch (err) {
        console.warn(`[GroupWebRTC] Error creating offer for ${targetUserId}:`, err);
      }
    }

    return pc;
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

      if ((window as any).__autoAcceptPendingCall) {
        console.log('[WebRTC] Auto-accepting pending call accepted from native screen');
        (window as any).__autoAcceptPendingCall = false;
        setTimeout(() => {
          answerCall();
        }, 200);
        return;
      }

      soundEffects.startIncomingRingtone();

      // Show native system & browser notification for incoming call
      showCallNotification({
        callerName: data.callerName,
        isVideo: data.isVideo,
        callerAvatar: data.callerAvatar,
      });

      // 1-minute (60 seconds) auto-decline timeout for incoming call
      if (incomingCallTimeoutRef.current) clearTimeout(incomingCallTimeoutRef.current);
      incomingCallTimeoutRef.current = setTimeout(() => {
        console.log('[WebRTC] Incoming call not answered within 1 minute, auto declining');
        if (socket) {
          if (data.isGroup && (data.groupId || data.chatId)) {
            socket.emit('reject_group_call', { groupId: data.groupId || data.chatId });
          } else if (data.from) {
            socket.emit('reject_call', { to: data.from, reason: 'no_answer' });
          }
        }
        soundEffects.stopRingtone();
        closeCallNotification();
        setIncomingCall(null);
      }, 60000);
    };

    // Call Accepted by remote user
    const handleCallAccepted = async (data: { signal: any }) => {
      console.log('[WebRTC] Call accepted by remote party');
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      closeCallNotification();

      soundEffects.stopRingtone();
      soundEffects.playConnectTone();
      setIsCalling(false);
      setCallActive(true);
      startTimer();

      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.signal));
        await drainCandidateQueue(peerConnectionRef.current);
      }
    };

    // Call Rejected
    const handleCallRejected = () => {
      // If currently active in a group call, a rejection from an invited peer must NOT kill the group call!
      if (inGroupCallRef.current) {
        console.log('[WebRTC] Ignored call_rejected because inGroupCall is active');
        return;
      }
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      if (incomingCallTimeoutRef.current) {
        clearTimeout(incomingCallTimeoutRef.current);
        incomingCallTimeoutRef.current = null;
      }
      closeCallNotification();
      soundEffects.stopRingtone();
      cleanupCall();
    };

    // Call Ended
    const handleCallEnded = () => {
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      if (incomingCallTimeoutRef.current) {
        clearTimeout(incomingCallTimeoutRef.current);
        incomingCallTimeoutRef.current = null;
      }
      closeCallNotification();
      cleanupCall();
    };

    // ICE Candidate
    const handleIceCandidate = async (data: { candidate: any }) => {
      try {
        const pc = peerConnectionRef.current;
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } else {
          console.log('[WebRTC] Buffering ICE candidate until remoteDescription is set');
          pendingCandidatesRef.current.push(data.candidate);
        }
      } catch (err) {
        console.warn('Error adding ICE candidate:', err);
      }
    };

    // Group call participants listing (new joiner receives list of existing peers)
    const handleGroupCallUsers = async (data: { participants: GroupParticipantInfo[] }) => {
      console.log('[GroupWebRTC] group_call_users received:', data.participants);
      setGroupParticipants(data.participants);

      let stream = localStreamRef.current;
      if (!stream) {
        stream = await getMediaStream(isVideoCall);
      }

      // Initiate peer connections to all existing participants
      for (const p of data.participants) {
        if (p.userId !== currentUserId) {
          await createPeerForGroupMember(p.userId, true, stream);
        }
      }
    };

    // A new user joined the group call
    const handleUserJoinedGroup = (user: GroupParticipantInfo) => {
      console.log('[GroupWebRTC] user_joined_group_call:', user.name);
      setGroupParticipants((prev) => [...prev.filter((p) => p.userId !== user.userId), user]);
    };

    // Handling peer-to-peer WebRTC signals in Group Call
    const handleReceivingGroupSignal = async (data: { signal: any; callerId: string }) => {
      const { signal, callerId } = data;
      if (!socket || !currentUserId || callerId === currentUserId) return;

      if (signal.type === 'offer') {
        console.log(`[GroupWebRTC] Received offer from ${callerId}`);
        let stream = localStreamRef.current;
        if (!stream) {
          stream = await getMediaStream(isVideoCall);
        }

        const pc = await createPeerForGroupMember(callerId, false, stream);
        if (!pc) return;

        try {
          const transceivers = pc.getTransceivers();
          const videoTransceiver = transceivers.find(
            (t) => t.receiver.track?.kind === 'video' || t.sender.track?.kind === 'video'
          );
          if (videoTransceiver && videoTransceiver.direction === 'sendonly') {
            videoTransceiver.direction = 'sendrecv';
          }
        } catch (_) {}

        await pc.setRemoteDescription(new RTCSessionDescription(signal));

        // Drain any buffered ICE candidates for callerId
        const pending = pendingGroupCandidatesRef.current.get(callerId) || [];
        for (const cand of pending) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch (e) {
            console.warn('[GroupWebRTC] Error adding buffered ICE:', e);
          }
        }
        pendingGroupCandidatesRef.current.delete(callerId);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('group_call_signal', {
          userToSignal: callerId,
          callerId: currentUserId,
          signal: answer,
        });
      } else if (signal.type === 'answer') {
        console.log(`[GroupWebRTC] Received answer from ${callerId}`);
        const pc = groupPeersRef.current.get(callerId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));

          // Drain any buffered ICE candidates
          const pending = pendingGroupCandidatesRef.current.get(callerId) || [];
          for (const cand of pending) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch (e) {
              console.warn('[GroupWebRTC] Error adding buffered ICE:', e);
            }
          }
          pendingGroupCandidatesRef.current.delete(callerId);
        }
      }
    };

    // Handling ICE Candidates in Group Call
    const handleReceivingGroupIceCandidate = async (data: { candidate: any; from: string }) => {
      const { candidate, from } = data;
      if (!candidate || !from) return;

      const pc = groupPeersRef.current.get(from);
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn(`[GroupWebRTC] Error adding ICE candidate from ${from}:`, err);
        }
      } else {
        if (!pendingGroupCandidatesRef.current.has(from)) {
          pendingGroupCandidatesRef.current.set(from, []);
        }
        pendingGroupCandidatesRef.current.get(from)!.push(candidate);
      }
    };

    const handleUserLeftGroup = (data: { userId: string }) => {
      console.log('[GroupWebRTC] user_left_group_call:', data.userId);
      const pc = groupPeersRef.current.get(data.userId);
      if (pc) {
        try {
          pc.close();
        } catch (_) {}
        groupPeersRef.current.delete(data.userId);
      }
      groupStreamsRef.current.delete(data.userId);
      pendingGroupCandidatesRef.current.delete(data.userId);
      setGroupRemoteStreams(new Map(groupStreamsRef.current));
      setGroupParticipants((prev) => prev.filter((p) => p.userId !== data.userId));
    };

    const handleGroupCallSwitchedToVideo = (data: { userId: string; isVideo: boolean }) => {
      console.log('[GroupWebRTC] group_call_switched_to_video:', data);
      setGroupParticipants((prev) =>
        prev.map((p) => (p.userId === data.userId ? { ...p, isVideo: data.isVideo } : p))
      );
      if (data.isVideo) {
        setIsVideoCall(true);
      }
    };

    const handleReceivingRenegotiateOffer = async (data: { from: string; signal: any }) => {
      console.log('[WebRTC] Received renegotiate offer from:', data.from);
      const pc = peerConnectionRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
        await drainCandidateQueue(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (socket) {
          socket.emit('renegotiate_answer', { to: data.from, signal: answer });
        }
      } catch (err) {
        console.warn('[WebRTC] Error handling renegotiate offer:', err);
      }
    };

    const handleReceivingRenegotiateAnswer = async (data: { from: string; signal: any }) => {
      console.log('[WebRTC] Received renegotiate answer from:', data.from);
      const pc = peerConnectionRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
        await drainCandidateQueue(pc);
      } catch (err) {
        console.warn('[WebRTC] Error handling renegotiate answer:', err);
      }
    };

    const handleCallSwitchedToVideo = async (data: { from: string; isVideo: boolean }) => {
      console.log('[WebRTC] Call switched to video by remote peer', data);
      setIsVideoCall(true);
      setIsVideoDisabled(false);

      try {
        if (!localStreamRef.current?.getVideoTracks().length) {
          const camStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 },
              frameRate: { ideal: 30, max: 30 },
              facingMode: 'user',
            },
          });
          const videoTrack = camStream.getVideoTracks()[0];
          if (videoTrack) {
            if (localStreamRef.current) {
              localStreamRef.current.addTrack(videoTrack);
            } else {
              localStreamRef.current = camStream;
            }
            if (peerConnectionRef.current) {
              peerConnectionRef.current.addTrack(videoTrack, localStreamRef.current);
              const offer = await peerConnectionRef.current.createOffer();
              await peerConnectionRef.current.setLocalDescription(offer);
              if (socket && callPartnerIdRef.current) {
                socket.emit('renegotiate_offer', {
                  to: callPartnerIdRef.current,
                  signal: offer,
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn('[WebRTC] Could not auto-acquire camera when switched to video:', err);
      }
    };

    socket.on('incoming_call', handleIncomingCall);
    socket.on('call_accepted', handleCallAccepted);
    socket.on('call_rejected', handleCallRejected);
    socket.on('call_ended', handleCallEnded);
    socket.on('call_failed', handleCallRejected);
    socket.on('call_switched_to_video', handleCallSwitchedToVideo);
    socket.on('receiving_renegotiate_offer', handleReceivingRenegotiateOffer);
    socket.on('receiving_renegotiate_answer', handleReceivingRenegotiateAnswer);
    socket.on('ice_candidate', handleIceCandidate);

    // Group Call WebRTC Socket Events
    socket.on('group_call_users', handleGroupCallUsers);
    socket.on('user_joined_group_call', handleUserJoinedGroup);
    socket.on('receiving_group_signal', handleReceivingGroupSignal);
    socket.on('receiving_group_ice_candidate', handleReceivingGroupIceCandidate);
    socket.on('group_call_switched_to_video', handleGroupCallSwitchedToVideo);
    socket.on('user_left_group_call', handleUserLeftGroup);

    return () => {
      socket.off('incoming_call', handleIncomingCall);
      socket.off('call_accepted', handleCallAccepted);
      socket.off('call_rejected', handleCallRejected);
      socket.off('call_ended', handleCallEnded);
      socket.off('call_failed', handleCallRejected);
      socket.off('call_switched_to_video', handleCallSwitchedToVideo);
      socket.off('receiving_renegotiate_offer', handleReceivingRenegotiateOffer);
      socket.off('receiving_renegotiate_answer', handleReceivingRenegotiateAnswer);
      socket.off('ice_candidate', handleIceCandidate);

      socket.off('group_call_users', handleGroupCallUsers);
      socket.off('user_joined_group_call', handleUserJoinedGroup);
      socket.off('receiving_group_signal', handleReceivingGroupSignal);
      socket.off('receiving_group_ice_candidate', handleReceivingGroupIceCandidate);
      socket.off('group_call_switched_to_video', handleGroupCallSwitchedToVideo);
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
    isSpeakerOn,
    localStreamRef,
    remoteStreamRef,
    remoteStream,
    startCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleSpeaker,
    toggleVideo,
    toggleScreenShare,
    // Group Calling
    inGroupCall,
    activeGroupId,
    groupParticipants,
    groupRemoteStreams,
    joinGroupCall,
    leaveGroupCall,
  };
}
