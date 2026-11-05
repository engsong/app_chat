import { Server, Socket } from 'socket.io';
import { store } from '../store.js';
import { v4 as uuidv4 } from 'uuid';

interface ConnectedUser {
  socketId: string;
  userId: string;
}

export function setupSocketHandlers(io: Server) {
  // Mapping of userId -> Set of socketIds (to support multiple tabs/devices)
  const userSocketMap = new Map<string, Set<string>>();
  // Mapping of socketId -> userId
  const socketUserMap = new Map<string, string>();
  // Active group calls: groupId -> Map<userId, socketId>
  const activeGroupCalls = new Map<string, Map<string, { socketId: string; isVideo: boolean; name: string; avatar?: string }>>();

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // 1. Authenticate / Register socket with userId
    socket.on('user_connected', (userId: string) => {
      if (!userId) return;

      socketUserMap.set(socket.id, userId);
      if (!userSocketMap.has(userId)) {
        userSocketMap.set(userId, new Set());
      }
      userSocketMap.get(userId)!.add(socket.id);

      // Update store user presence
      const user = store.users.get(userId);
      if (user) {
        user.isOnline = true;
        user.lastSeen = new Date();
      }

      // Broadcast user online status
      io.emit('user_status_changed', { userId, isOnline: true, lastSeen: new Date() });

      // Send online users list to current socket
      const onlineUserIds = Array.from(userSocketMap.keys());
      socket.emit('online_users_list', onlineUserIds);
      console.log(`[Socket] User online: ${userId} (${socket.id})`);
    });

    // 2. Chat Messaging
    socket.on('send_message', (data: {
      chatId: string;
      senderId: string;
      content: string;
      type?: 'text' | 'image' | 'video' | 'audio' | 'document' | 'product';
      mediaUrl?: string;
      metadata?: string;
    }) => {
      const { chatId, senderId, content, type = 'text', mediaUrl, metadata } = data;
      const chat = store.chats.get(chatId);
      if (!chat) return;

      const newMessage = {
        id: `msg-${uuidv4()}`,
        chatId,
        senderId,
        type,
        content,
        mediaUrl,
        metadata,
        status: 'sent' as const,
        createdAt: new Date(),
      };

      store.messages.set(newMessage.id, newMessage);
      chat.lastMessageAt = new Date();
      store.saveToFile();

      // Emit to all members in this chat
      chat.memberIds.forEach((memberId) => {
        const sockets = userSocketMap.get(memberId);
        if (sockets) {
          sockets.forEach((sId) => {
            io.to(sId).emit('new_message', { message: newMessage, chat });
          });
        }
      });
    });

    // Typing Indicators
    socket.on('typing_start', ({ chatId, userId }: { chatId: string; userId: string }) => {
      const chat = store.chats.get(chatId);
      if (!chat) return;

      chat.memberIds.forEach((mId) => {
        if (mId !== userId) {
          const sockets = userSocketMap.get(mId);
          if (sockets) {
            sockets.forEach((sId) => io.to(sId).emit('user_typing', { chatId, userId }));
          }
        }
      });
    });

    socket.on('typing_stop', ({ chatId, userId }: { chatId: string; userId: string }) => {
      const chat = store.chats.get(chatId);
      if (!chat) return;

      chat.memberIds.forEach((mId) => {
        if (mId !== userId) {
          const sockets = userSocketMap.get(mId);
          if (sockets) {
            sockets.forEach((sId) => io.to(sId).emit('user_stopped_typing', { chatId, userId }));
          }
        }
      });
    });

    // Read receipts
    socket.on('mark_messages_read', ({ chatId, userId }: { chatId: string; userId: string }) => {
      const chat = store.chats.get(chatId);
      if (!chat) return;

      // Mark all messages as read
      for (const [msgId, msg] of store.messages.entries()) {
        if (msg.chatId === chatId && msg.senderId !== userId && msg.status !== 'read') {
          msg.status = 'read';
        }
      }
      store.saveToFile();

      chat.memberIds.forEach((mId) => {
        const sockets = userSocketMap.get(mId);
        if (sockets) {
          sockets.forEach((sId) => io.to(sId).emit('messages_marked_read', { chatId, userId }));
        }
      });
    });

    // ==========================================
    // 3. 1-on-1 WebRTC Calling (Voice & Video)
    // ==========================================
    socket.on('call_user', (data: {
      userToCall: string;
      signalData: any;
      from: string;
      callerName: string;
      callerAvatar?: string;
      isVideo: boolean;
      chatId?: string;
    }) => {
      const targetSockets = userSocketMap.get(data.userToCall);
      console.log(`[Call] Initiate call from ${data.from} to ${data.userToCall}, video: ${data.isVideo}`);
      if (targetSockets && targetSockets.size > 0) {
        targetSockets.forEach((sId) => {
          io.to(sId).emit('incoming_call', {
            signal: data.signalData,
            from: data.from,
            callerName: data.callerName,
            callerAvatar: data.callerAvatar,
            isVideo: data.isVideo,
            chatId: data.chatId,
          });
        });
      } else {
        // User is offline or unavailable
        socket.emit('call_failed', { reason: 'User is currently offline' });
      }
    });

    socket.on('accept_call', (data: { signal: any; to: string }) => {
      console.log(`[Call] Call accepted by ${socket.id} for user ${data.to}`);
      const callerSockets = userSocketMap.get(data.to);
      if (callerSockets) {
        callerSockets.forEach((sId) => {
          io.to(sId).emit('call_accepted', { signal: data.signal, from: socketUserMap.get(socket.id) });
        });
      }
    });

    socket.on('reject_call', (data: { to: string; reason?: string }) => {
      console.log(`[Call] Call rejected for ${data.to}`);
      const callerSockets = userSocketMap.get(data.to);
      if (callerSockets) {
        callerSockets.forEach((sId) => {
          io.to(sId).emit('call_rejected', { reason: data.reason || 'Call declined' });
        });
      }
    });

    socket.on('end_call', (data: { to: string }) => {
      console.log(`[Call] Call ended for ${data.to}`);
      const callerSockets = userSocketMap.get(data.to);
      if (callerSockets) {
        callerSockets.forEach((sId) => {
          io.to(sId).emit('call_ended');
        });
      }
    });

    socket.on('ice_candidate', (data: { to: string; candidate: any }) => {
      const targetSockets = userSocketMap.get(data.to);
      if (targetSockets) {
        targetSockets.forEach((sId) => {
          io.to(sId).emit('ice_candidate', { candidate: data.candidate, from: socketUserMap.get(socket.id) });
        });
      }
    });

    // ==========================================
    // 4. Group WebRTC Calling (Voice & Video)
    // ==========================================
    socket.on('join_group_call', (data: {
      groupId: string;
      user: { id: string; name: string; avatar?: string };
      isVideo: boolean;
    }) => {
      const { groupId, user, isVideo } = data;
      console.log(`[GroupCall] User ${user.name} joining group call: ${groupId}`);

      if (!activeGroupCalls.has(groupId)) {
        activeGroupCalls.set(groupId, new Map());
      }

      const groupRoom = activeGroupCalls.get(groupId)!;
      // Get all existing participants in this group call before adding new user
      const existingParticipants = Array.from(groupRoom.entries()).map(([uId, participant]) => ({
        userId: uId,
        socketId: participant.socketId,
        isVideo: participant.isVideo,
        name: participant.name,
        avatar: participant.avatar,
      }));

      // Add to room
      groupRoom.set(user.id, {
        socketId: socket.id,
        isVideo,
        name: user.name,
        avatar: user.avatar,
      });

      // Join socket room
      socket.join(`group-call-${groupId}`);

      // Tell the new user about all existing participants
      socket.emit('group_call_users', { participants: existingParticipants });

      // Notify other participants that a new peer joined
      socket.to(`group-call-${groupId}`).emit('user_joined_group_call', {
        userId: user.id,
        socketId: socket.id,
        isVideo,
        name: user.name,
        avatar: user.avatar,
      });
    });

    socket.on('group_call_signal', (data: {
      userToSignal: string; // target userId
      callerId: string;     // initiator userId
      signal: any;
    }) => {
      const targetSockets = userSocketMap.get(data.userToSignal);
      if (targetSockets) {
        targetSockets.forEach((sId) => {
          io.to(sId).emit('receiving_group_signal', {
            signal: data.signal,
            callerId: data.callerId,
          });
        });
      }
    });

    socket.on('leave_group_call', ({ groupId, userId }: { groupId: string; userId: string }) => {
      console.log(`[GroupCall] User ${userId} leaving group call: ${groupId}`);
      const groupRoom = activeGroupCalls.get(groupId);
      if (groupRoom) {
        groupRoom.delete(userId);
        if (groupRoom.size === 0) {
          activeGroupCalls.delete(groupId);
        }
      }

      socket.leave(`group-call-${groupId}`);
      socket.to(`group-call-${groupId}`).emit('user_left_group_call', { userId });
    });

    // 5. Disconnect handling
    socket.on('disconnect', () => {
      const userId = socketUserMap.get(socket.id);
      console.log(`[Socket] Disconnected: ${socket.id} (User: ${userId})`);

      if (userId) {
        socketUserMap.delete(socket.id);
        const userSockets = userSocketMap.get(userId);
        if (userSockets) {
          userSockets.delete(socket.id);
          if (userSockets.size === 0) {
            userSocketMap.delete(userId);

            const user = store.users.get(userId);
            if (user) {
              user.isOnline = false;
              user.lastSeen = new Date();
            }

            io.emit('user_status_changed', { userId, isOnline: false, lastSeen: new Date() });
          }
        }

        // Clean up from active group calls
        for (const [groupId, groupRoom] of activeGroupCalls.entries()) {
          if (groupRoom.has(userId)) {
            groupRoom.delete(userId);
            io.to(`group-call-${groupId}`).emit('user_left_group_call', { userId });
            if (groupRoom.size === 0) {
              activeGroupCalls.delete(groupId);
            }
          }
        }
      }
    });
  });
}
