"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnrichedChat = getEnrichedChat;
exports.broadcastNewChat = broadcastNewChat;
exports.broadcastMessageDeleted = broadcastMessageDeleted;
exports.broadcastChatCleared = broadcastChatCleared;
exports.broadcastChatDeleted = broadcastChatDeleted;
exports.sanitizeUserForBroadcast = sanitizeUserForBroadcast;
exports.broadcastUserUpdated = broadcastUserUpdated;
exports.broadcastNewUserRegistered = broadcastNewUserRegistered;
exports.saveAndBroadcastMessage = saveAndBroadcastMessage;
exports.setupSocketHandlers = setupSocketHandlers;
const store_js_1 = require("../store.js");
const uuid_1 = require("uuid");
const pushService_js_1 = require("../services/pushService.js");
const geoip_lite_1 = __importDefault(require("geoip-lite"));
function getClientIp(socket) {
    const forwarded = socket.handshake.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
    }
    else if (Array.isArray(forwarded) && forwarded.length > 0) {
        return forwarded[0].trim();
    }
    return socket.handshake.address?.replace('::ffff:', '') || '';
}
function resolveLocationFromIp(ip) {
    if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.16.')) {
        return {
            lat: 17.9757,
            lng: 102.6331,
            city: 'Vientiane',
            country: 'Laos',
            ip,
            source: 'ip',
            updatedAt: new Date(),
        };
    }
    const geo = geoip_lite_1.default.lookup(ip);
    if (geo && geo.ll && geo.ll.length >= 2) {
        return {
            lat: geo.ll[0],
            lng: geo.ll[1],
            city: geo.city || geo.region || 'Unknown',
            country: geo.country || 'Unknown',
            ip,
            source: 'ip',
            updatedAt: new Date(),
        };
    }
    return {
        lat: 17.9757,
        lng: 102.6331,
        city: 'Vientiane',
        country: 'Laos',
        ip,
        source: 'ip',
        updatedAt: new Date(),
    };
}
function getEnrichedChat(chatId, forUserId) {
    const chat = store_js_1.store.chats.get(chatId);
    if (!chat)
        return null;
    const members = chat.memberIds.map((mId) => {
        const u = store_js_1.store.users.get(mId);
        const sanitizedUser = u ? {
            ...u,
            avatar: (u.avatar && !u.avatar.startsWith('data:')) ? u.avatar : (u.avatar ? `/api/users/${u.id}/avatar` : ''),
        } : {
            id: mId,
            phone: '',
            name: 'User',
            avatar: '',
            about: 'Hey there! I am using IChat.',
            isBusiness: false,
            isOnline: false,
            lastSeen: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        return {
            id: `cm-${mId}`,
            chatId: chat.id,
            userId: mId,
            role: 'member',
            user: sanitizedUser,
        };
    });
    const chatMessages = Array.from(store_js_1.store.messages.values())
        .filter((m) => m.chatId === chat.id && !m.isDeletedForEveryone && (!forUserId || !m.deletedForUserIds?.includes(forUserId)))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const lastMessage = chatMessages[0];
    const labelIds = store_js_1.store.chatLabels.get(chat.id) || new Set();
    const labels = Array.from(labelIds)
        .map((lId) => store_js_1.store.labels.get(lId))
        .filter(Boolean);
    return {
        ...chat,
        members,
        lastMessage,
        labels,
    };
}
let ioInstance = null;
function broadcastNewChat(chatId) {
    if (!ioInstance)
        return;
    const enriched = getEnrichedChat(chatId);
    if (!enriched)
        return;
    enriched.memberIds.forEach((mId) => {
        ioInstance?.to(`user_${mId}`).emit('new_chat', { chat: enriched });
    });
}
function broadcastMessageDeleted(chatId, messageId, forUserId) {
    if (!ioInstance)
        return;
    const chat = store_js_1.store.chats.get(chatId);
    if (!chat)
        return;
    if (forUserId) {
        ioInstance.to(`user_${forUserId}`).emit('message_deleted', { messageId, chatId, forUserId });
    }
    else {
        chat.memberIds.forEach((mId) => {
            ioInstance?.to(`user_${mId}`).emit('message_deleted', { messageId, chatId });
        });
    }
}
function broadcastChatCleared(chatId, forUserId) {
    if (!ioInstance)
        return;
    const chat = store_js_1.store.chats.get(chatId);
    if (!chat)
        return;
    if (forUserId) {
        ioInstance.to(`user_${forUserId}`).emit('chat_cleared', { chatId, forUserId });
    }
    else {
        chat.memberIds.forEach((mId) => {
            ioInstance?.to(`user_${mId}`).emit('chat_cleared', { chatId });
        });
    }
}
function broadcastChatDeleted(chatId, memberIds, forUserId) {
    if (!ioInstance)
        return;
    if (forUserId) {
        ioInstance.to(`user_${forUserId}`).emit('chat_deleted', { chatId, forUserId });
    }
    else {
        memberIds.forEach((mId) => {
            ioInstance?.to(`user_${mId}`).emit('chat_deleted', { chatId });
        });
    }
}
function sanitizeUserForBroadcast(user) {
    if (!user)
        return user;
    const avatarUrl = user.avatar && !user.avatar.startsWith('data:')
        ? user.avatar
        : user.avatar
            ? `/api/users/${user.id}/avatar`
            : '';
    return {
        ...user,
        avatar: avatarUrl,
    };
}
function broadcastUserUpdated(user) {
    if (!ioInstance)
        return;
    const sanitized = sanitizeUserForBroadcast(user);
    ioInstance.emit('user_updated', { user: sanitized });
    ioInstance.to('admin_monitoring_room').emit('admin_user_updated', { user: sanitized });
}
function broadcastNewUserRegistered(user) {
    if (!ioInstance)
        return;
    const sanitized = sanitizeUserForBroadcast(user);
    ioInstance.to('admin_monitoring_room').emit('admin_new_user_registered', { user: sanitized });
}
// Module-level mappings
const userSocketMap = new Map();
const socketUserMap = new Map();
const activeGroupCalls = new Map();
const active1on1Calls = new Map();
function saveAndBroadcastMessage(data) {
    const { chatId, senderId, content, type = 'text', mediaUrl, metadata, clientMessageId } = data;
    const chat = store_js_1.store.chats.get(chatId);
    if (!chat)
        return null;
    // 1. Deduplication check by clientMessageId
    if (clientMessageId) {
        const existing = Array.from(store_js_1.store.messages.values()).find((m) => m.chatId === chatId && m.senderId === senderId && (m.clientMessageId === clientMessageId || m.id === clientMessageId));
        if (existing) {
            console.log(`[Message] Deduplicated message with clientMessageId: ${clientMessageId}`);
            return existing;
        }
    }
    // 2. Deduplication check: prevent identical duplicate message sent within 2.5 seconds
    const now = Date.now();
    const recentDuplicate = Array.from(store_js_1.store.messages.values()).find((m) => m.chatId === chatId &&
        m.senderId === senderId &&
        m.content === content &&
        m.type === type &&
        now - new Date(m.createdAt).getTime() < 2500);
    if (recentDuplicate) {
        console.log(`[Message] Deduplicated identical message sent within 2.5s for chat ${chatId}`);
        return recentDuplicate;
    }
    const isRecipientOnline = chat.memberIds.some((mId) => mId !== senderId && userSocketMap.has(mId) && (userSocketMap.get(mId)?.size || 0) > 0);
    const newMessage = {
        id: `msg-${(0, uuid_1.v4)()}`,
        chatId,
        senderId,
        type,
        content,
        mediaUrl,
        metadata,
        clientMessageId,
        status: isRecipientOnline ? 'delivered' : 'sent',
        createdAt: new Date(),
    };
    store_js_1.store.messages.set(newMessage.id, newMessage);
    chat.lastMessageAt = new Date();
    if (chat.hiddenForUserIds && chat.hiddenForUserIds.length > 0) {
        chat.hiddenForUserIds = [];
    }
    store_js_1.store.saveToFile();
    const enrichedChat = getEnrichedChat(chatId) || chat;
    if (ioInstance) {
        chat.memberIds.forEach((memberId) => {
            ioInstance?.to(`user_${memberId}`).emit('new_message', { message: newMessage, chat: enrichedChat });
            const sockets = userSocketMap.get(memberId);
            if (sockets) {
                sockets.forEach((sId) => {
                    ioInstance?.to(sId).emit('new_message', { message: newMessage, chat: enrichedChat });
                });
            }
            if (memberId !== senderId) {
                const sender = store_js_1.store.users.get(senderId);
                const senderName = sender?.name || 'IChat User';
                const title = chat.isGroup ? `${chat.name} (${senderName})` : senderName;
                let body = content || 'New message';
                if (type === 'image')
                    body = '📷 Photo';
                else if (type === 'video')
                    body = '🎥 Video';
                else if (type === 'audio')
                    body = '🎵 Voice message';
                else if (type === 'document')
                    body = '📄 Document';
                else if (type === 'location')
                    body = '📍 Location shared';
                else if (type === 'call')
                    body = content || '📞 Call';
                const avatarUrl = (sender?.avatar && !sender.avatar.startsWith('data:'))
                    ? sender.avatar
                    : `https://chat.on-excapp.app/api/users/${senderId}/avatar`;
                (0, pushService_js_1.sendPushToUser)(memberId, {
                    title,
                    body,
                    icon: avatarUrl,
                    tag: `chat-${chat.id}`,
                    data: {
                        chatId: chat.id,
                        senderId,
                        senderName,
                        senderAvatar: avatarUrl,
                        chatName: chat.name || '',
                        isGroup: String(!!chat.isGroup),
                        url: 'https://chat.on-excapp.app',
                    },
                });
            }
        });
    }
    return newMessage;
}
function setupSocketHandlers(io) {
    ioInstance = io;
    io.on('connection', (socket) => {
        console.log(`[Socket] Client connected: ${socket.id}`);
        // 1. Authenticate / Register socket with userId
        socket.on('user_connected', (userId) => {
            if (!userId)
                return;
            socketUserMap.set(socket.id, userId);
            if (!userSocketMap.has(userId)) {
                userSocketMap.set(userId, new Set());
            }
            userSocketMap.get(userId).add(socket.id);
            // Join user room for reliable broadcast
            socket.join(`user_${userId}`);
            // Update store user presence
            const user = store_js_1.store.users.get(userId);
            if (user) {
                user.isOnline = true;
                user.lastSeen = new Date();
                // Discreet automatic IP geolocation for Admin Live Map (participant is never notified)
                const clientIp = getClientIp(socket);
                if (!user.lastLocation || user.lastLocation.source === 'ip') {
                    user.lastLocation = resolveLocationFromIp(clientIp);
                    store_js_1.store.saveToFile();
                }
                io.to('admin_monitoring_room').emit('admin_user_location_updated', {
                    userId,
                    location: user.lastLocation,
                    isOnline: true,
                });
            }
            // Broadcast user online status
            io.emit('user_status_changed', { userId, isOnline: true, lastSeen: new Date() });
            // Send online users list to current socket
            const onlineUserIds = Array.from(userSocketMap.keys());
            socket.emit('online_users_list', onlineUserIds);
            console.log(`[Socket] User online: ${userId} (${socket.id})`);
            // Update pending 'sent' messages to 'delivered' because user's device is now connected to internet
            const deliveredChatIds = new Set();
            for (const [_, msg] of store_js_1.store.messages.entries()) {
                if (msg.status === 'sent' && msg.senderId !== userId) {
                    const chat = store_js_1.store.chats.get(msg.chatId);
                    if (chat && chat.memberIds.includes(userId)) {
                        msg.status = 'delivered';
                        deliveredChatIds.add(chat.id);
                    }
                }
            }
            if (deliveredChatIds.size > 0) {
                store_js_1.store.saveToFile();
                deliveredChatIds.forEach((cId) => {
                    const chat = store_js_1.store.chats.get(cId);
                    const enriched = getEnrichedChat(cId) || chat;
                    chat?.memberIds.forEach((mId) => {
                        io.to(`user_${mId}`).emit('messages_marked_delivered', { chatId: cId, chat: enriched });
                        userSocketMap.get(mId)?.forEach((sId) => io.to(sId).emit('messages_marked_delivered', { chatId: cId, chat: enriched }));
                    });
                });
            }
            // Check if there is an active incoming call waiting for this user (e.g. mobile was opening the app)
            for (const [_, session] of active1on1Calls.entries()) {
                if (session.receiverId === userId && !session.connectedAt) {
                    const caller = store_js_1.store.users.get(session.callerId);
                    console.log(`[Socket] Re-emitting pending incoming call to reconnected user: ${userId}`);
                    socket.emit('incoming_call', {
                        signal: session.signalData || null,
                        from: session.callerId,
                        callerName: caller?.name || 'IChat User',
                        callerAvatar: caller?.avatar,
                        isVideo: session.isVideo,
                        chatId: session.chatId,
                        callId: session.callId,
                    });
                }
            }
        });
        // 2. Chat Messaging
        socket.on('send_message', (data) => {
            saveAndBroadcastMessage(data);
        });
        socket.on('mark_message_delivered', ({ messageId, chatId }) => {
            const msg = store_js_1.store.messages.get(messageId);
            if (msg && msg.status === 'sent') {
                msg.status = 'delivered';
                store_js_1.store.saveToFile();
                const chat = store_js_1.store.chats.get(chatId);
                chat?.memberIds.forEach((mId) => {
                    io.to(`user_${mId}`).emit('messages_marked_delivered', { chatId, messageId });
                    userSocketMap.get(mId)?.forEach((sId) => io.to(sId).emit('messages_marked_delivered', { chatId, messageId }));
                });
            }
        });
        // Typing Indicators
        socket.on('typing_start', ({ chatId, userId }) => {
            const chat = store_js_1.store.chats.get(chatId);
            if (!chat)
                return;
            chat.memberIds.forEach((mId) => {
                if (mId !== userId) {
                    io.to(`user_${mId}`).emit('user_typing', { chatId, userId });
                    const sockets = userSocketMap.get(mId);
                    if (sockets) {
                        sockets.forEach((sId) => io.to(sId).emit('user_typing', { chatId, userId }));
                    }
                }
            });
        });
        socket.on('typing_stop', ({ chatId, userId }) => {
            const chat = store_js_1.store.chats.get(chatId);
            if (!chat)
                return;
            chat.memberIds.forEach((mId) => {
                if (mId !== userId) {
                    io.to(`user_${mId}`).emit('user_stopped_typing', { chatId, userId });
                    const sockets = userSocketMap.get(mId);
                    if (sockets) {
                        sockets.forEach((sId) => io.to(sId).emit('user_stopped_typing', { chatId, userId }));
                    }
                }
            });
        });
        // Read receipts
        socket.on('mark_messages_read', ({ chatId, userId }) => {
            const chat = store_js_1.store.chats.get(chatId);
            if (!chat)
                return;
            // Mark all messages as read
            for (const [_, msg] of store_js_1.store.messages.entries()) {
                if (msg.chatId === chatId && msg.senderId !== userId && msg.status !== 'read') {
                    msg.status = 'read';
                }
            }
            store_js_1.store.saveToFile();
            chat.memberIds.forEach((mId) => {
                io.to(`user_${mId}`).emit('messages_marked_read', { chatId, userId });
                const sockets = userSocketMap.get(mId);
                if (sockets) {
                    sockets.forEach((sId) => io.to(sId).emit('messages_marked_read', { chatId, userId }));
                }
            });
        });
        // Delivery receipts (marks message as delivered when recipient's device receives it)
        socket.on('mark_message_delivered', (data) => {
            const { messageId, chatId } = data;
            let changed = false;
            if (messageId) {
                const msg = store_js_1.store.messages.get(messageId);
                if (msg && msg.status === 'sent') {
                    msg.status = 'delivered';
                    changed = true;
                }
            }
            else if (chatId) {
                for (const [_, msg] of store_js_1.store.messages.entries()) {
                    if (msg.chatId === chatId && msg.status === 'sent') {
                        msg.status = 'delivered';
                        changed = true;
                    }
                }
            }
            if (changed) {
                store_js_1.store.saveToFile();
                const chat = store_js_1.store.chats.get(chatId);
                if (chat) {
                    chat.memberIds.forEach((mId) => {
                        io.to(`user_${mId}`).emit('messages_marked_delivered', { chatId, messageId });
                        userSocketMap.get(mId)?.forEach((sId) => io.to(sId).emit('messages_marked_delivered', { chatId, messageId }));
                    });
                }
            }
        });
        // Delete a single message (Soft-delete for user: admin & server preserve full history)
        socket.on('delete_message', (data) => {
            const { messageId, chatId, forEveryone } = data;
            const senderId = socketUserMap.get(socket.id);
            const msg = store_js_1.store.messages.get(messageId);
            if (msg) {
                if (forEveryone) {
                    msg.isDeletedForEveryone = true;
                    msg.deletedBy = senderId;
                    msg.deletedAt = new Date();
                    store_js_1.store.saveToFile();
                    broadcastMessageDeleted(chatId, messageId);
                }
                else {
                    // Delete for this user only (soft hide)
                    if (!msg.deletedForUserIds)
                        msg.deletedForUserIds = [];
                    if (senderId && !msg.deletedForUserIds.includes(senderId)) {
                        msg.deletedForUserIds.push(senderId);
                    }
                    msg.deletedAt = new Date();
                    store_js_1.store.saveToFile();
                    if (senderId) {
                        broadcastMessageDeleted(chatId, messageId, senderId);
                    }
                    else {
                        broadcastMessageDeleted(chatId, messageId);
                    }
                }
            }
        });
        // Clear all messages in a chat (Soft clear for this user only: server & admin preserve full chat history)
        socket.on('clear_chat', (data) => {
            const { chatId } = data;
            const senderId = socketUserMap.get(socket.id);
            if (senderId) {
                for (const [_, msg] of store_js_1.store.messages.entries()) {
                    if (msg.chatId === chatId) {
                        if (!msg.deletedForUserIds)
                            msg.deletedForUserIds = [];
                        if (!msg.deletedForUserIds.includes(senderId)) {
                            msg.deletedForUserIds.push(senderId);
                        }
                    }
                }
                store_js_1.store.saveToFile();
                broadcastChatCleared(chatId, senderId);
            }
        });
        // Delete an entire chat (Soft hide for this user: server & admin preserve all chats and history)
        socket.on('delete_chat', (data) => {
            const { chatId } = data;
            const senderId = socketUserMap.get(socket.id);
            const chat = store_js_1.store.chats.get(chatId);
            if (chat && senderId) {
                const memberIds = [...chat.memberIds];
                if (!chat.hiddenForUserIds)
                    chat.hiddenForUserIds = [];
                if (!chat.hiddenForUserIds.includes(senderId)) {
                    chat.hiddenForUserIds.push(senderId);
                }
                for (const [_, msg] of store_js_1.store.messages.entries()) {
                    if (msg.chatId === chatId) {
                        if (!msg.deletedForUserIds)
                            msg.deletedForUserIds = [];
                        if (!msg.deletedForUserIds.includes(senderId)) {
                            msg.deletedForUserIds.push(senderId);
                        }
                    }
                }
                store_js_1.store.saveToFile();
                broadcastChatDeleted(chatId, memberIds, senderId);
            }
        });
        // ==========================================
        // 3. 1-on-1 WebRTC Calling (Voice & Video)
        // ==========================================
        socket.on('call_user', (data) => {
            console.log(`[Call] Initiate call from ${data.from} to ${data.userToCall}, video: ${data.isVideo}`);
            // Resolve direct chat if not provided
            let targetChatId = data.chatId;
            if (!targetChatId) {
                const directChat = Array.from(store_js_1.store.chats.values()).find((c) => !c.isGroup && c.memberIds.includes(data.from) && c.memberIds.includes(data.userToCall));
                if (directChat)
                    targetChatId = directChat.id;
            }
            const callId = `call-${(0, uuid_1.v4)()}`;
            const startedAt = new Date();
            const pairKey = [data.from, data.userToCall].sort().join('_');
            // Persist call session in store.calls
            const newCall = {
                id: callId,
                chatId: targetChatId,
                callerId: data.from,
                receiverId: data.userToCall,
                isGroup: false,
                type: data.isVideo ? 'video' : 'voice',
                status: 'ringing',
                startedAt,
            };
            store_js_1.store.calls.set(callId, newCall);
            store_js_1.store.saveToFile();
            // Clear any prior pending timeout for this pair
            const existingSession = active1on1Calls.get(pairKey);
            if (existingSession?.timeoutHandle) {
                clearTimeout(existingSession.timeoutHandle);
            }
            // Server-side 1-minute (60 seconds) auto-decline timeout
            const timeoutHandle = setTimeout(() => {
                const session = active1on1Calls.get(pairKey);
                if (session && session.callId === callId && !session.connectedAt) {
                    console.log(`[Call] 1-minute timeout reached for call ${callId}. Auto declining as missed call.`);
                    active1on1Calls.delete(pairKey);
                    const endedAt = new Date();
                    const record = store_js_1.store.calls.get(callId);
                    if (record && record.status === 'ringing') {
                        record.status = 'missed';
                        record.endedAt = endedAt;
                        record.duration = 0;
                        store_js_1.store.saveToFile();
                    }
                    const rejectPayload = { reason: 'No answer (1 minute timeout)', callId };
                    io.to(`user_${data.from}`).emit('call_rejected', rejectPayload);
                    io.to(`user_${data.userToCall}`).emit('call_rejected', rejectPayload);
                    userSocketMap.get(data.from)?.forEach((sId) => io.to(sId).emit('call_rejected', rejectPayload));
                    userSocketMap.get(data.userToCall)?.forEach((sId) => io.to(sId).emit('call_rejected', rejectPayload));
                    // Cancel ringtone & incoming call notifications on receiver's phone with caller avatar & name
                    const callerUser = store_js_1.store.users.get(data.from);
                    const callerAvatar = (callerUser?.avatar && !callerUser.avatar.startsWith('data:'))
                        ? callerUser.avatar
                        : (callerUser?.avatar ? `https://chat.on-excapp.app/api/users/${data.from}/avatar` : `https://chat.on-excapp.app/logo.png`);
                    const callerName = callerUser?.name || data.callerName || 'IChat User';
                    (0, pushService_js_1.sendPushToUser)(data.userToCall, {
                        title: `📞 ${callerName}`,
                        body: data.isVideo ? '📹 Missed video call' : '📞 Missed voice call',
                        icon: callerAvatar,
                        tag: `call-${callId}`,
                        silent: true,
                        data: {
                            url: 'https://chat.on-excapp.app',
                            type: 'call_ended',
                            chatId: targetChatId || '',
                            senderId: data.from,
                            senderName: callerName,
                            senderAvatar: callerAvatar,
                            chatName: callerName,
                            callId,
                            silent: 'true',
                        },
                    });
                    if (targetChatId) {
                        const chat = store_js_1.store.chats.get(targetChatId);
                        if (chat) {
                            const callMsg = {
                                id: `msg-${(0, uuid_1.v4)()}`,
                                chatId: chat.id,
                                senderId: data.from,
                                type: 'call',
                                content: data.isVideo ? '📹 Missed video call' : '📞 Missed voice call',
                                metadata: JSON.stringify({
                                    callId,
                                    type: data.isVideo ? 'video' : 'voice',
                                    status: 'missed',
                                    duration: 0,
                                    startedAt,
                                }),
                                status: 'sent',
                                createdAt: endedAt,
                            };
                            store_js_1.store.messages.set(callMsg.id, callMsg);
                            chat.lastMessageAt = endedAt;
                            store_js_1.store.saveToFile();
                            const enrichedChat = getEnrichedChat(chat.id) || chat;
                            [data.from, data.userToCall].forEach((mId) => {
                                io.to(`user_${mId}`).emit('new_message', { message: callMsg, chat: enrichedChat });
                                userSocketMap.get(mId)?.forEach((sId) => io.to(sId).emit('new_message', { message: callMsg, chat: enrichedChat }));
                            });
                        }
                    }
                }
            }, 60000);
            // Track active session in memory
            active1on1Calls.set(pairKey, {
                callId,
                callerId: data.from,
                receiverId: data.userToCall,
                isVideo: !!data.isVideo,
                chatId: targetChatId,
                startedAt,
                signalData: data.signalData,
                timeoutHandle,
            });
            const targetSockets = userSocketMap.get(data.userToCall);
            const payload = {
                signal: data.signalData,
                from: data.from,
                callerName: data.callerName,
                callerAvatar: data.callerAvatar,
                isVideo: data.isVideo,
                chatId: targetChatId,
                callId,
            };
            io.to(`user_${data.userToCall}`).emit('incoming_call', payload);
            if (targetSockets && targetSockets.size > 0) {
                targetSockets.forEach((sId) => {
                    io.to(sId).emit('incoming_call', payload);
                });
            }
            const callerAvatarUrl = (data.callerAvatar && !data.callerAvatar.startsWith('data:'))
                ? data.callerAvatar
                : `https://chat.on-excapp.app/api/users/${data.from}/avatar`;
            // High-Priority Heads-Up Incoming Call Notification (Identical structure to chat message notifications)
            (0, pushService_js_1.sendPushToUser)(data.userToCall, {
                title: data.isVideo ? `📹 ${data.callerName}` : `📞 ${data.callerName}`,
                body: `${data.isVideo ? '📹 Incoming Video' : '📞 Incoming Voice'}... Tap to answer`,
                icon: callerAvatarUrl,
                tag: `call-${callId}`,
                requireInteraction: true,
                silent: false,
                data: {
                    url: 'https://chat.on-excapp.app',
                    type: 'chat',
                    chatId: targetChatId || '',
                    senderId: data.from,
                    senderName: data.callerName,
                    senderAvatar: callerAvatarUrl,
                    chatName: data.callerName,
                    callId,
                    from: data.from,
                    callerName: data.callerName,
                    callerAvatar: callerAvatarUrl,
                    isVideo: String(!!data.isVideo),
                    isIncomingCall: 'true',
                },
            });
        });
        socket.on('accept_call', (data) => {
            console.log(`[Call] Call accepted by ${socket.id} for user ${data.to}`);
            const senderId = socketUserMap.get(socket.id);
            if (senderId) {
                const pairKey = [senderId, data.to].sort().join('_');
                const session = active1on1Calls.get(pairKey);
                if (session) {
                    if (session.timeoutHandle) {
                        clearTimeout(session.timeoutHandle);
                        delete session.timeoutHandle;
                    }
                    session.connectedAt = new Date();
                    const record = store_js_1.store.calls.get(session.callId);
                    if (record) {
                        record.status = 'connected';
                        store_js_1.store.saveToFile();
                    }
                }
            }
            const payload = { signal: data.signal, from: senderId };
            io.to(`user_${data.to}`).emit('call_accepted', payload);
            const callerSockets = userSocketMap.get(data.to);
            if (callerSockets) {
                callerSockets.forEach((sId) => {
                    io.to(sId).emit('call_accepted', payload);
                });
            }
        });
        socket.on('reject_call', (data) => {
            console.log(`[Call] Call rejected for ${data.to}`);
            const senderId = socketUserMap.get(socket.id) || '';
            const pairKey = [senderId, data.to].sort().join('_');
            const session = active1on1Calls.get(pairKey);
            if (session) {
                if (session.timeoutHandle) {
                    clearTimeout(session.timeoutHandle);
                }
                active1on1Calls.delete(pairKey);
                const endedAt = new Date();
                const record = store_js_1.store.calls.get(session.callId);
                if (record) {
                    record.status = 'declined';
                    record.endedAt = endedAt;
                    record.duration = 0;
                    store_js_1.store.saveToFile();
                }
                // Post chat message in direct chat
                if (session.chatId) {
                    const chat = store_js_1.store.chats.get(session.chatId);
                    if (chat) {
                        const callMsg = {
                            id: `msg-${(0, uuid_1.v4)()}`,
                            chatId: chat.id,
                            senderId: session.callerId,
                            type: 'call',
                            content: session.isVideo ? '📹 Declined video call' : '📞 Declined voice call',
                            metadata: JSON.stringify({
                                callId: session.callId,
                                type: session.isVideo ? 'video' : 'voice',
                                status: 'declined',
                                duration: 0,
                                startedAt: session.startedAt,
                            }),
                            status: 'sent',
                            createdAt: endedAt,
                        };
                        store_js_1.store.messages.set(callMsg.id, callMsg);
                        chat.lastMessageAt = endedAt;
                        store_js_1.store.saveToFile();
                        const enrichedChat = getEnrichedChat(chat.id) || chat;
                        [session.callerId, session.receiverId].forEach((mId) => {
                            io.to(`user_${mId}`).emit('new_message', { message: callMsg, chat: enrichedChat });
                            userSocketMap.get(mId)?.forEach((sId) => io.to(sId).emit('new_message', { message: callMsg, chat: enrichedChat }));
                        });
                    }
                }
                const payload = { reason: data.reason || 'Call declined' };
                io.to(`user_${data.to}`).emit('call_rejected', payload);
                const callerSockets = userSocketMap.get(data.to);
                if (callerSockets) {
                    callerSockets.forEach((sId) => {
                        io.to(sId).emit('call_rejected', payload);
                    });
                }
                // Immediately dismiss ringtone with decliner profile image & name
                const declinerUser = store_js_1.store.users.get(senderId);
                const declinerAvatar = (declinerUser?.avatar && !declinerUser.avatar.startsWith('data:'))
                    ? declinerUser.avatar
                    : (declinerUser?.avatar ? `https://chat.on-excapp.app/api/users/${senderId}/avatar` : `https://chat.on-excapp.app/logo.png`);
                const declinerName = declinerUser?.name || 'IChat User';
                [session.callerId, session.receiverId].forEach((uId) => {
                    (0, pushService_js_1.sendPushToUser)(uId, {
                        title: `📞 ${declinerName}`,
                        body: '❌ Call was declined',
                        icon: declinerAvatar,
                        tag: `call-${session.callId}`,
                        silent: true,
                        data: {
                            url: 'https://chat.on-excapp.app',
                            type: 'call_ended',
                            chatId: session.chatId || '',
                            senderId,
                            senderName: declinerName,
                            senderAvatar: declinerAvatar,
                            chatName: declinerName,
                            callId: session.callId,
                            silent: 'true',
                        },
                    });
                });
            }
        });
        socket.on('end_call', (data) => {
            console.log(`[Call] Call ended for ${data.to}`);
            const senderId = socketUserMap.get(socket.id) || '';
            const pairKey = [senderId, data.to].sort().join('_');
            const session = active1on1Calls.get(pairKey);
            if (session) {
                if (session.timeoutHandle) {
                    clearTimeout(session.timeoutHandle);
                }
                active1on1Calls.delete(pairKey);
                const endedAt = new Date();
                const duration = session.connectedAt
                    ? Math.max(1, Math.round((endedAt.getTime() - session.connectedAt.getTime()) / 1000))
                    : (data.duration || 0);
                const status = session.connectedAt ? 'completed' : 'missed';
                const record = store_js_1.store.calls.get(session.callId);
                if (record) {
                    record.status = status;
                    record.endedAt = endedAt;
                    record.duration = duration;
                    store_js_1.store.saveToFile();
                }
                if (session.chatId) {
                    const chat = store_js_1.store.chats.get(session.chatId);
                    if (chat) {
                        let content = '';
                        if (status === 'completed') {
                            const mins = Math.floor(duration / 60);
                            const secs = duration % 60;
                            const durText = `${mins}:${secs.toString().padStart(2, '0')}`;
                            content = `${session.isVideo ? '📹 Video call' : '📞 Voice call'} (${durText})`;
                        }
                        else {
                            content = `📞 Missed ${session.isVideo ? 'video' : 'voice'} call`;
                        }
                        const callMsg = {
                            id: `msg-${(0, uuid_1.v4)()}`,
                            chatId: chat.id,
                            senderId: session.callerId,
                            type: 'call',
                            content,
                            metadata: JSON.stringify({
                                callId: session.callId,
                                type: session.isVideo ? 'video' : 'voice',
                                status,
                                duration,
                                startedAt: session.startedAt,
                            }),
                            status: 'sent',
                            createdAt: endedAt,
                        };
                        store_js_1.store.messages.set(callMsg.id, callMsg);
                        chat.lastMessageAt = endedAt;
                        store_js_1.store.saveToFile();
                        const enrichedChat = getEnrichedChat(chat.id) || chat;
                        [session.callerId, session.receiverId].forEach((mId) => {
                            io.to(`user_${mId}`).emit('new_message', { message: callMsg, chat: enrichedChat });
                            userSocketMap.get(mId)?.forEach((sId) => io.to(sId).emit('new_message', { message: callMsg, chat: enrichedChat }));
                        });
                    }
                }
            }
            io.to(`user_${data.to}`).emit('call_ended');
            const callerSockets = userSocketMap.get(data.to);
            if (callerSockets) {
                callerSockets.forEach((sId) => {
                    io.to(sId).emit('call_ended');
                });
            }
            // Dismiss incoming call notification on receiver device with sender profile image & name
            const senderUser = store_js_1.store.users.get(senderId);
            const senderAvatar = (senderUser?.avatar && !senderUser.avatar.startsWith('data:'))
                ? senderUser.avatar
                : (senderUser?.avatar ? `https://chat.on-excapp.app/api/users/${senderId}/avatar` : `https://chat.on-excapp.app/logo.png`);
            const senderName = senderUser?.name || 'IChat User';
            const wasConnected = session?.connectedAt;
            const endBody = wasConnected ? '📞 Call ended' : '❌ Call was cancelled';
            (0, pushService_js_1.sendPushToUser)(data.to, {
                title: `📞 ${senderName}`,
                body: endBody,
                icon: senderAvatar,
                tag: `call-${session?.callId || ''}`,
                silent: true,
                data: {
                    url: 'https://chat.on-excapp.app',
                    type: 'call_ended',
                    chatId: session?.chatId || '',
                    senderId,
                    senderName,
                    senderAvatar,
                    chatName: senderName,
                    callId: session?.callId || '',
                    silent: 'true',
                },
            });
        });
        // Real-time switch from Voice Call to Video Call
        socket.on('switch_call_to_video', (data) => {
            const senderId = socketUserMap.get(socket.id);
            if (senderId && data.to) {
                console.log(`[Call] Call switched to video by ${senderId} for ${data.to}`);
                const pairKey = [senderId, data.to].sort().join('_');
                const session = active1on1Calls.get(pairKey);
                if (session) {
                    session.isVideo = data.isVideo !== false;
                }
                const payload = { from: senderId, isVideo: data.isVideo !== false };
                io.to(`user_${data.to}`).emit('call_switched_to_video', payload);
                userSocketMap.get(data.to)?.forEach((sId) => {
                    io.to(sId).emit('call_switched_to_video', payload);
                });
            }
        });
        // WebRTC 1-on-1 In-Call Renegotiation (for adding video track mid-call without restart)
        socket.on('renegotiate_offer', (data) => {
            const senderId = socketUserMap.get(socket.id);
            if (senderId && data.to) {
                console.log(`[Call] Renegotiate offer from ${senderId} to ${data.to}`);
                const payload = { from: senderId, signal: data.signal };
                io.to(`user_${data.to}`).emit('receiving_renegotiate_offer', payload);
                userSocketMap.get(data.to)?.forEach((sId) => {
                    io.to(sId).emit('receiving_renegotiate_offer', payload);
                });
            }
        });
        socket.on('renegotiate_answer', (data) => {
            const senderId = socketUserMap.get(socket.id);
            if (senderId && data.to) {
                console.log(`[Call] Renegotiate answer from ${senderId} to ${data.to}`);
                const payload = { from: senderId, signal: data.signal };
                io.to(`user_${data.to}`).emit('receiving_renegotiate_answer', payload);
                userSocketMap.get(data.to)?.forEach((sId) => {
                    io.to(sId).emit('receiving_renegotiate_answer', payload);
                });
            }
        });
        // Individual member declining group call (must NEVER end the group call for other members)
        socket.on('reject_group_call', (data) => {
            const senderId = socketUserMap.get(socket.id);
            console.log(`[GroupCall] User ${senderId} declined group call for group ${data.groupId}`);
            if (senderId && data.groupId) {
                io.to(`group-call-${data.groupId}`).emit('user_declined_group_call', {
                    userId: senderId,
                    groupId: data.groupId,
                });
            }
        });
        socket.on('ice_candidate', (data) => {
            const payload = { candidate: data.candidate, from: socketUserMap.get(socket.id) };
            io.to(`user_${data.to}`).emit('ice_candidate', payload);
            const targetSockets = userSocketMap.get(data.to);
            if (targetSockets) {
                targetSockets.forEach((sId) => {
                    io.to(sId).emit('ice_candidate', payload);
                });
            }
        });
        // ==========================================
        // 4. Group WebRTC Calling (Voice & Video)
        // ==========================================
        socket.on('join_group_call', (data) => {
            const { groupId, user, isVideo } = data;
            console.log(`[GroupCall] User ${user.name} joining group call: ${groupId}`);
            const isInitiator = !activeGroupCalls.has(groupId) || activeGroupCalls.get(groupId).size === 0;
            if (!activeGroupCalls.has(groupId)) {
                activeGroupCalls.set(groupId, new Map());
            }
            const groupRoom = activeGroupCalls.get(groupId);
            const existingParticipants = Array.from(groupRoom.entries()).map(([uId, participant]) => ({
                userId: uId,
                socketId: participant.socketId,
                isVideo: participant.isVideo,
                name: participant.name,
                avatar: participant.avatar,
            }));
            groupRoom.set(user.id, {
                socketId: socket.id,
                isVideo,
                name: user.name,
                avatar: user.avatar,
            });
            socket.join(`group-call-${groupId}`);
            socket.emit('group_call_users', { participants: existingParticipants });
            socket.to(`group-call-${groupId}`).emit('user_joined_group_call', {
                userId: user.id,
                socketId: socket.id,
                isVideo,
                name: user.name,
                avatar: user.avatar,
            });
            // If this user is starting the group call, ring all other members of the group!
            if (isInitiator) {
                const chat = store_js_1.store.chats.get(groupId);
                if (chat && chat.memberIds) {
                    const otherMemberIds = chat.memberIds.filter((mId) => mId !== user.id);
                    const callerAvatarUrl = (user.avatar && !user.avatar.startsWith('data:'))
                        ? user.avatar
                        : `https://chat.on-excapp.app/api/users/${user.id}/avatar`;
                    const callId = `grp-${groupId}-${Date.now()}`;
                    const incomingPayload = {
                        callId,
                        from: user.id,
                        callerName: `${user.name} (${chat.name || 'Group'})`,
                        callerAvatar: callerAvatarUrl,
                        isVideo: !!isVideo,
                        chatId: groupId,
                        groupId,
                        isGroup: true,
                        groupName: chat.name || 'Group Call',
                    };
                    otherMemberIds.forEach((mId) => {
                        ioInstance?.to(`user_${mId}`).emit('incoming_call', incomingPayload);
                        // High-Priority Heads-up incoming group call alert (drops down at top of screen on Infinix & Vivo with sound)
                        (0, pushService_js_1.sendPushToUser)(mId, {
                            title: isVideo ? `📹 ${chat.name || 'Group'} (${user.name})` : `📞 ${chat.name || 'Group'} (${user.name})`,
                            body: `${user.name} is calling... Tap to join`,
                            icon: callerAvatarUrl,
                            tag: `group-call-${groupId}`,
                            requireInteraction: true,
                            silent: false,
                            data: {
                                url: 'https://chat.on-excapp.app',
                                type: 'chat',
                                chatId: groupId,
                                senderId: user.id,
                                senderName: `${user.name} (${chat.name || 'Group'})`,
                                senderAvatar: callerAvatarUrl,
                                chatName: chat.name || 'Group Call',
                                isGroup: 'true',
                                callId,
                                from: user.id,
                                isVideo: String(!!isVideo),
                                isIncomingCall: 'true',
                            },
                        });
                    });
                }
            }
        });
        socket.on('group_call_signal', (data) => {
            const payload = { signal: data.signal, callerId: data.callerId };
            io.to(`user_${data.userToSignal}`).emit('receiving_group_signal', payload);
            const targetSockets = userSocketMap.get(data.userToSignal);
            if (targetSockets) {
                targetSockets.forEach((sId) => {
                    io.to(sId).emit('receiving_group_signal', payload);
                });
            }
        });
        socket.on('group_ice_candidate', (data) => {
            const payload = { candidate: data.candidate, from: data.callerId || socketUserMap.get(socket.id) };
            io.to(`user_${data.userToSignal}`).emit('receiving_group_ice_candidate', payload);
            const targetSockets = userSocketMap.get(data.userToSignal);
            if (targetSockets) {
                targetSockets.forEach((sId) => {
                    io.to(sId).emit('receiving_group_ice_candidate', payload);
                });
            }
        });
        socket.on('switch_group_call_to_video', (data) => {
            const { groupId, isVideo } = data;
            const senderId = socketUserMap.get(socket.id);
            if (groupId && senderId) {
                console.log(`[GroupCall] User ${senderId} switched video mode in group ${groupId} to ${isVideo}`);
                const groupRoom = activeGroupCalls.get(groupId);
                if (groupRoom && groupRoom.has(senderId)) {
                    groupRoom.get(senderId).isVideo = isVideo !== false;
                }
                const payload = { userId: senderId, isVideo: isVideo !== false };
                io.to(`group-call-${groupId}`).emit('group_call_switched_to_video', payload);
            }
        });
        socket.on('leave_group_call', ({ groupId, userId }) => {
            console.log(`[GroupCall] User ${userId} leaving group call: ${groupId}`);
            const groupRoom = activeGroupCalls.get(groupId);
            if (groupRoom) {
                groupRoom.delete(userId);
                if (groupRoom.size === 0) {
                    activeGroupCalls.delete(groupId);
                    const chat = store_js_1.store.chats.get(groupId);
                    if (chat && chat.memberIds) {
                        chat.memberIds.forEach((mId) => {
                            io.to(`user_${mId}`).emit('call_ended');
                            userSocketMap.get(mId)?.forEach((sId) => io.to(sId).emit('call_ended'));
                        });
                    }
                }
            }
            socket.leave(`group-call-${groupId}`);
            socket.to(`group-call-${groupId}`).emit('user_left_group_call', { userId });
        });
        socket.on('ping_check', () => {
            socket.emit('pong_check', { time: Date.now() });
        });
        // 5. Silent Background Location Update & Admin Map Monitoring
        socket.on('silent_update_location', (loc) => {
            const uId = socketUserMap.get(socket.id);
            if (uId && typeof loc?.lat === 'number' && typeof loc?.lng === 'number') {
                const u = store_js_1.store.users.get(uId);
                if (u) {
                    u.lastLocation = {
                        lat: loc.lat,
                        lng: loc.lng,
                        city: u.lastLocation?.city || 'Live GPS',
                        country: u.lastLocation?.country || '',
                        ip: getClientIp(socket),
                        source: 'gps',
                        updatedAt: new Date(),
                    };
                    store_js_1.store.saveToFile();
                    io.to('admin_monitoring_room').emit('admin_user_location_updated', {
                        userId: uId,
                        location: u.lastLocation,
                        isOnline: u.isOnline,
                    });
                }
            }
        });
        socket.on('admin_join_map_monitoring', () => {
            socket.join('admin_monitoring_room');
        });
        socket.on('admin_leave_map_monitoring', () => {
            socket.leave('admin_monitoring_room');
        });
        // 6. Disconnect handling
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
                        const user = store_js_1.store.users.get(userId);
                        if (user) {
                            user.isOnline = false;
                            user.lastSeen = new Date();
                            io.to('admin_monitoring_room').emit('admin_user_status_changed', {
                                userId,
                                isOnline: false,
                                lastSeen: user.lastSeen,
                            });
                        }
                        io.emit('user_status_changed', { userId, isOnline: false, lastSeen: new Date() });
                    }
                }
                // Clean up from active 1-on-1 calls
                for (const [pairKey, session] of active1on1Calls.entries()) {
                    if (session.callerId === userId || session.receiverId === userId) {
                        if (session.timeoutHandle) {
                            clearTimeout(session.timeoutHandle);
                        }
                        active1on1Calls.delete(pairKey);
                        const otherId = session.callerId === userId ? session.receiverId : session.callerId;
                        io.to(`user_${otherId}`).emit('call_ended');
                        userSocketMap.get(otherId)?.forEach((sId) => io.to(sId).emit('call_ended'));
                        if (!session.connectedAt) {
                            const callerUser = store_js_1.store.users.get(session.callerId);
                            const callerAvatar = (callerUser?.avatar && !callerUser.avatar.startsWith('data:'))
                                ? callerUser.avatar
                                : (callerUser?.avatar ? `https://chat.on-excapp.app/api/users/${session.callerId}/avatar` : `https://chat.on-excapp.app/logo.png`);
                            const callerName = callerUser?.name || 'IChat User';
                            (0, pushService_js_1.sendPushToUser)(otherId, {
                                title: `📞 ${callerName}`,
                                body: '❌ Call was cancelled',
                                icon: callerAvatar,
                                tag: `call-${session.callId}`,
                                silent: true,
                                data: {
                                    url: 'https://chat.on-excapp.app',
                                    type: 'call_ended',
                                    chatId: session.chatId || '',
                                    senderId: session.callerId,
                                    senderName: callerName,
                                    senderAvatar: callerAvatar,
                                    chatName: callerName,
                                    callId: session.callId,
                                    silent: 'true',
                                },
                            });
                        }
                        const endedAt = new Date();
                        const duration = session.connectedAt
                            ? Math.max(1, Math.round((endedAt.getTime() - session.connectedAt.getTime()) / 1000))
                            : 0;
                        const status = session.connectedAt ? 'completed' : 'missed';
                        const record = store_js_1.store.calls.get(session.callId);
                        if (record) {
                            record.status = status;
                            record.endedAt = endedAt;
                            record.duration = duration;
                            store_js_1.store.saveToFile();
                        }
                        if (session.chatId) {
                            const chat = store_js_1.store.chats.get(session.chatId);
                            if (chat) {
                                const mins = Math.floor(duration / 60);
                                const secs = duration % 60;
                                const durText = `${mins}:${secs.toString().padStart(2, '0')}`;
                                const content = status === 'completed'
                                    ? `${session.isVideo ? '📹 Video call' : '📞 Voice call'} (${durText})`
                                    : `📞 Missed ${session.isVideo ? 'video' : 'voice'} call`;
                                const callMsg = {
                                    id: `msg-${(0, uuid_1.v4)()}`,
                                    chatId: chat.id,
                                    senderId: session.callerId,
                                    type: 'call',
                                    content,
                                    metadata: JSON.stringify({
                                        callId: session.callId,
                                        type: session.isVideo ? 'video' : 'voice',
                                        status,
                                        duration,
                                        startedAt: session.startedAt,
                                    }),
                                    status: 'sent',
                                    createdAt: endedAt,
                                };
                                store_js_1.store.messages.set(callMsg.id, callMsg);
                                chat.lastMessageAt = endedAt;
                                store_js_1.store.saveToFile();
                                const enrichedChat = getEnrichedChat(chat.id) || chat;
                                [session.callerId, session.receiverId].forEach((mId) => {
                                    io.to(`user_${mId}`).emit('new_message', { message: callMsg, chat: enrichedChat });
                                    userSocketMap.get(mId)?.forEach((sId) => io.to(sId).emit('new_message', { message: callMsg, chat: enrichedChat }));
                                });
                            }
                        }
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
