"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRouter = void 0;
const express_1 = require("express");
const store_js_1 = require("../store.js");
const uuid_1 = require("uuid");
const socketHandler_js_1 = require("../sockets/socketHandler.js");
const pushService_js_1 = require("../services/pushService.js");
exports.apiRouter = (0, express_1.Router)();
// Web Push VAPID Public Key and Subscription Endpoints
exports.apiRouter.get('/push/vapid-public-key', (req, res) => {
    res.json({ publicKey: pushService_js_1.VAPID_PUBLIC_KEY });
});
exports.apiRouter.post('/push/subscribe', (req, res) => {
    const { userId, subscription } = req.body;
    if (!userId || !subscription || !subscription.endpoint) {
        return res.status(400).json({ error: 'Missing userId or subscription endpoint' });
    }
    const existing = store_js_1.store.pushSubscriptions.get(userId) || [];
    const filtered = existing.filter((s) => s.endpoint !== subscription.endpoint);
    filtered.push(subscription);
    store_js_1.store.pushSubscriptions.set(userId, filtered);
    store_js_1.store.saveToFile();
    console.log(`[Push] User ${userId} registered push subscription (Total devices: ${filtered.length})`);
    res.json({ success: true, count: filtered.length });
});
// Register native device push token (Android FCM / iOS APNs)
exports.apiRouter.post('/devices/register', (req, res) => {
    const { userId, pushToken, platform = 'ANDROID', provider = 'FCM' } = req.body;
    if (!userId || !pushToken) {
        return res.status(400).json({ error: 'userId and pushToken required' });
    }
    const deviceId = `dev-${userId}-${platform.toLowerCase()}`;
    store_js_1.store.devices.set(deviceId, {
        id: deviceId,
        userId,
        pushToken,
        platform: platform.toUpperCase(),
        provider: provider.toUpperCase(),
        updatedAt: new Date(),
    });
    const existing = store_js_1.store.pushSubscriptions.get(userId) || [];
    const filtered = existing.filter((s) => s.token !== pushToken && s.endpoint !== pushToken);
    filtered.push({
        type: 'fcm',
        token: pushToken,
        platform,
    });
    store_js_1.store.pushSubscriptions.set(userId, filtered);
    store_js_1.store.saveToFile();
    console.log(`[Push] Registered native ${provider} device for user ${userId}`);
    res.json({ success: true, deviceId });
});
// Test push notification endpoint (trigger immediately to verify lock screen delivery)
exports.apiRouter.post('/push/test', async (req, res) => {
    const userId = (req.body?.userId || req.query?.userId);
    if (!userId)
        return res.status(400).json({ error: 'userId is required' });
    const subs = store_js_1.store.pushSubscriptions.get(userId);
    if (!subs || subs.length === 0) {
        return res.status(404).json({
            error: 'No active push subscriptions found for this user. Please tap "Turn On" in the app first.',
            count: 0,
        });
    }
    await (0, pushService_js_1.sendPushToUser)(userId, {
        title: 'IChat Notification Test',
        body: '🎉 Notifications are working! You will now receive calls and messages on your lock screen.',
        icon: '/logo.png',
        tag: 'test-notification',
    });
    res.json({ success: true, count: subs.length, message: 'Test notification sent' });
});
// Get push status for a user
exports.apiRouter.get('/push/status', (req, res) => {
    const userId = req.query.userId;
    if (!userId)
        return res.status(400).json({ error: 'userId required' });
    const subs = store_js_1.store.pushSubscriptions.get(userId) || [];
    res.json({ hasSubscription: subs.length > 0, count: subs.length });
});
// Debug endpoint to view active push subscriptions count across system
exports.apiRouter.get('/push/debug', (req, res) => {
    const result = {};
    for (const [uId, subs] of store_js_1.store.pushSubscriptions.entries()) {
        const user = store_js_1.store.users.get(uId);
        result[uId] = {
            name: user?.name,
            phone: user?.phone,
            subscriptionCount: subs.length,
            endpoints: subs.map((s) => s.endpoint?.slice(0, 45) + '...'),
        };
    }
    res.json({
        totalUsersWithPush: store_js_1.store.pushSubscriptions.size,
        subscriptions: result,
    });
});
// ==========================================
// 1. Authentication & Users
// ==========================================
// Get all contacts / users
exports.apiRouter.get('/users', (req, res) => {
    const users = Array.from(store_js_1.store.users.values()).map((u) => ({
        ...u,
        avatar: u.avatar && !u.avatar.startsWith('data:') ? u.avatar : (u.avatar ? `/api/users/${u.id}/avatar` : ''),
    }));
    res.json(users);
});
// Serve user profile avatar (handles base64 data URLs, external URLs, or default avatar)
exports.apiRouter.get('/users/:id/avatar', (req, res) => {
    const user = store_js_1.store.users.get(req.params.id);
    const avatar = user?.avatar;
    if (!avatar) {
        return res.redirect(302, '/logo.png');
    }
    if (avatar.startsWith('data:image/')) {
        const matches = avatar.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
            const mime = `image/${matches[1]}`;
            const buf = Buffer.from(matches[2], 'base64');
            res.setHeader('Content-Type', mime);
            res.setHeader('Cache-Control', 'public, max-age=86400');
            return res.send(buf);
        }
    }
    if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
        return res.redirect(302, avatar);
    }
    if (avatar.startsWith('/')) {
        return res.redirect(302, avatar);
    }
    return res.redirect(302, '/logo.png');
});
// 1. User Registration (Create New Account)
exports.apiRouter.post('/auth/register', (req, res) => {
    const { name, phone, password, isBusiness, businessName, businessCategory, businessDescription, avatar, } = req.body;
    if (!name || !phone || !password) {
        return res.status(400).json({ error: 'Name, phone number, and password are required.' });
    }
    const chosenAvatar = avatar || '';
    const standardPhone = (0, store_js_1.formatStandardLaoPhone)(phone);
    // Determine if this user should be admin or auto-approved
    const isAdminPhone = (0, store_js_1.isPhoneMatch)(standardPhone, '02054245616') || standardPhone.toLowerCase().trim() === 'admin';
    const existingAdmins = Array.from(store_js_1.store.users.values()).filter((u) => u.role === 'admin' && Boolean(u.password));
    const isFirstAdmin = existingAdmins.length === 0;
    const shouldBeAdmin = isAdminPhone || isFirstAdmin;
    const initialRole = shouldBeAdmin ? 'admin' : 'user';
    const initialStatus = shouldBeAdmin ? 'approved' : 'pending';
    // Check if account already exists for this phone (strictly prevent duplicates across all formats)
    const existingUser = Array.from(store_js_1.store.users.values()).find((u) => (0, store_js_1.isPhoneMatch)(u.phone, phone) || (0, store_js_1.isPhoneMatch)(u.phone, standardPhone) || u.phone === standardPhone);
    if (existingUser) {
        // If it is already a fully registered account with a password
        if (existingUser.password) {
            return res.status(400).json({
                error: 'This phone number is already registered. Please log in.',
                phone: standardPhone,
            });
        }
        // If it was a contact stub created when someone added this phone number, claim and activate it!
        existingUser.name = name.trim();
        existingUser.phone = standardPhone;
        existingUser.password = password;
        existingUser.avatar = chosenAvatar;
        existingUser.role = shouldBeAdmin ? 'admin' : (existingUser.role || 'user');
        existingUser.status = initialStatus;
        existingUser.about = isBusiness
            ? 'Welcome to our official business chat!'
            : 'Hey there! I am using IChat.';
        existingUser.isBusiness = Boolean(isBusiness);
        existingUser.businessName = isBusiness ? (businessName || name) : undefined;
        existingUser.businessCategory = isBusiness ? (businessCategory || 'General Business') : undefined;
        existingUser.businessDescription = isBusiness ? businessDescription : undefined;
        existingUser.isOnline = true;
        existingUser.lastSeen = new Date();
        existingUser.updatedAt = new Date();
        if (!store_js_1.store.userContacts.has(existingUser.id)) {
            store_js_1.store.userContacts.set(existingUser.id, new Set());
        }
        store_js_1.store.saveToFile();
        (0, socketHandler_js_1.broadcastNewUserRegistered)(existingUser);
        return res.status(201).json({
            success: true,
            user: existingUser,
            requiresApproval: existingUser.status === 'pending',
        });
    }
    const newUser = {
        id: `usr-${(0, uuid_1.v4)()}`,
        phone: standardPhone,
        password,
        name: name.trim(),
        avatar: chosenAvatar,
        role: initialRole,
        status: initialStatus,
        about: isBusiness
            ? 'Welcome to our official business chat!'
            : 'Hey there! I am using IChat.',
        isBusiness: Boolean(isBusiness),
        businessName: isBusiness ? (businessName || name) : undefined,
        businessCategory: isBusiness ? (businessCategory || 'General Business') : undefined,
        businessDescription: isBusiness ? businessDescription : undefined,
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    store_js_1.store.users.set(newUser.id, newUser);
    store_js_1.store.userContacts.set(newUser.id, new Set());
    store_js_1.store.saveToFile();
    (0, socketHandler_js_1.broadcastNewUserRegistered)(newUser);
    res.status(201).json({
        success: true,
        user: newUser,
        requiresApproval: newUser.status === 'pending',
    });
});
// 2. User Login
exports.apiRouter.post('/auth/login', (req, res) => {
    const { phone, password, demoUserId } = req.body;
    if (demoUserId) {
        const user = store_js_1.store.users.get(demoUserId);
        if (user) {
            user.isOnline = true;
            user.lastSeen = new Date();
            return res.json({ success: true, user });
        }
    }
    if (!phone) {
        return res.status(400).json({ error: 'Phone number is required.' });
    }
    const user = Array.from(store_js_1.store.users.values()).find((u) => (0, store_js_1.isPhoneMatch)(u.phone, phone));
    if (!user) {
        return res.status(401).json({ error: 'No account found with this phone number. Please check or create a new account.' });
    }
    // If user has a password set and password was provided, verify it
    if (user.password && password && user.password !== password) {
        return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }
    // If user was an auto-created contact stub without a password, set it on initial login
    if (!user.password && password) {
        user.password = password;
        user.updatedAt = new Date();
        store_js_1.store.saveToFile();
    }
    // Ensure role and status are set
    if ((0, store_js_1.isPhoneMatch)(user.phone, '02054245616') || user.phone?.toLowerCase() === 'admin') {
        user.role = 'admin';
        user.status = 'approved';
    }
    else if (!user.status) {
        user.status = 'approved';
    }
    // Check registration approval status
    if (user.status === 'pending') {
        return res.status(403).json({
            error: 'Your account registration is pending approval by the administrator. Please wait for an admin to approve your account.',
            status: 'pending',
        });
    }
    if (user.status === 'rejected') {
        return res.status(403).json({
            error: 'Your account registration was rejected by the administrator.',
            status: 'rejected',
        });
    }
    user.isOnline = true;
    user.lastSeen = new Date();
    store_js_1.store.saveToFile();
    res.json({ success: true, user });
});
// Update Profile / Business Profile
exports.apiRouter.put('/users/:id', (req, res) => {
    const user = store_js_1.store.users.get(req.params.id);
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    const { name, about, avatar, isBusiness, businessName, businessCategory, businessDescription, businessAddress, businessHours, businessWebsite, } = req.body;
    if (name !== undefined)
        user.name = name;
    if (about !== undefined)
        user.about = about;
    if (avatar !== undefined)
        user.avatar = avatar;
    if (isBusiness !== undefined)
        user.isBusiness = isBusiness;
    if (businessName !== undefined)
        user.businessName = businessName;
    if (businessCategory !== undefined)
        user.businessCategory = businessCategory;
    if (businessDescription !== undefined)
        user.businessDescription = businessDescription;
    if (businessAddress !== undefined)
        user.businessAddress = businessAddress;
    if (businessHours !== undefined)
        user.businessHours = businessHours;
    if (businessWebsite !== undefined)
        user.businessWebsite = businessWebsite;
    user.updatedAt = new Date();
    store_js_1.store.saveToFile();
    (0, socketHandler_js_1.broadcastUserUpdated)(user);
    res.json({ success: true, user });
});
// Contacts Management (Only show added contacts)
exports.apiRouter.get('/contacts', (req, res) => {
    const userId = req.query.userId;
    if (!userId)
        return res.status(400).json({ error: 'userId is required' });
    const contactIds = store_js_1.store.userContacts.get(userId) || new Set();
    const contacts = Array.from(contactIds)
        .map((id) => store_js_1.store.users.get(id))
        .filter((u) => Boolean(u))
        .map((u) => ({
        ...u,
        avatar: u.avatar && !u.avatar.startsWith('data:') ? u.avatar : (u.avatar ? `/api/users/${u.id}/avatar` : ''),
    }));
    res.json(contacts);
});
// Add contact by Phone, Name, or User ID
exports.apiRouter.post('/contacts', (req, res) => {
    const { userId, query } = req.body;
    if (!userId || !query) {
        return res.status(400).json({ error: 'userId and query (Phone number, Name, or User ID) are required.' });
    }
    const cleanQuery = query.trim().toLowerCase();
    const cleanDigits = (0, store_js_1.normalizePhone)(query);
    const currentUser = store_js_1.store.users.get(userId);
    if (userId.toLowerCase() === cleanQuery ||
        (currentUser && (0, store_js_1.isPhoneMatch)(currentUser.phone, query))) {
        return res.status(400).json({ error: "You cannot add yourself as a contact. Please enter another user's phone number, name, or ID." });
    }
    // 1. Search among registered users first (have password)
    let contactUser = Array.from(store_js_1.store.users.values()).find((u) => {
        if (u.id === userId)
            return false;
        if (u.id.toLowerCase() === cleanQuery)
            return true;
        if (cleanDigits.length >= 6 && (0, store_js_1.isPhoneMatch)(u.phone, query) && Boolean(u.password))
            return true;
        if (u.name.toLowerCase() === cleanQuery && Boolean(u.password))
            return true;
        return false;
    });
    // 2. Fallback to any user matching phone, name, or ID
    if (!contactUser) {
        contactUser = Array.from(store_js_1.store.users.values()).find((u) => {
            if (u.id === userId)
                return false;
            if (u.id.toLowerCase() === cleanQuery || u.id.toLowerCase().includes(cleanQuery))
                return true;
            if (cleanDigits.length >= 6 && (0, store_js_1.isPhoneMatch)(u.phone, query))
                return true;
            if (u.name.toLowerCase().includes(cleanQuery))
                return true;
            if (u.businessName && u.businessName.toLowerCase().includes(cleanQuery))
                return true;
            return false;
        });
    }
    // 3. If still not found, create contact stub for this phone or name
    if (!contactUser) {
        if (cleanDigits.length >= 6) {
            const formattedPhone = (0, store_js_1.formatStandardLaoPhone)(query.trim());
            contactUser = {
                id: `usr-${(0, uuid_1.v4)()}`,
                phone: formattedPhone,
                name: formattedPhone,
                about: 'Hey there! I am using IChat.',
                avatar: '',
                isBusiness: false,
                isOnline: false,
                lastSeen: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            store_js_1.store.users.set(contactUser.id, contactUser);
        }
        else if (cleanQuery.startsWith('usr-')) {
            contactUser = {
                id: cleanQuery,
                phone: `+${Math.floor(1000000000 + Math.random() * 9000000000)}`,
                name: `User ${cleanQuery.slice(4, 12)}`,
                about: 'Hey there! I am using IChat.',
                avatar: '',
                isBusiness: false,
                isOnline: false,
                lastSeen: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            store_js_1.store.users.set(contactUser.id, contactUser);
        }
        else if (cleanQuery.length >= 2) {
            contactUser = {
                id: `usr-${(0, uuid_1.v4)()}`,
                phone: `+${Math.floor(1000000000 + Math.random() * 9000000000)}`,
                name: query.trim(),
                about: 'Hey there! I am using IChat.',
                avatar: '',
                isBusiness: false,
                isOnline: false,
                lastSeen: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            store_js_1.store.users.set(contactUser.id, contactUser);
        }
        else {
            return res.status(400).json({ error: 'Please enter a valid Phone number (at least 6 digits), Name, or User ID.' });
        }
    }
    const targetUser = contactUser;
    if (!store_js_1.store.userContacts.has(userId)) {
        store_js_1.store.userContacts.set(userId, new Set());
    }
    store_js_1.store.userContacts.get(userId).add(targetUser.id);
    // Reciprocally link contact
    if (!store_js_1.store.userContacts.has(targetUser.id)) {
        store_js_1.store.userContacts.set(targetUser.id, new Set());
    }
    store_js_1.store.userContacts.get(targetUser.id).add(userId);
    // Automatically ensure a direct chat exists so user can message immediately
    let directChat = Array.from(store_js_1.store.chats.values()).find((c) => !c.isGroup && c.memberIds.includes(userId) && c.memberIds.includes(targetUser.id));
    if (!directChat) {
        const newChat = {
            id: `chat-${(0, uuid_1.v4)()}`,
            isGroup: false,
            memberIds: [userId, targetUser.id],
            lastMessageAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        store_js_1.store.chats.set(newChat.id, newChat);
        directChat = newChat;
    }
    store_js_1.store.saveToFile();
    // Broadcast new chat event to both users via socket
    (0, socketHandler_js_1.broadcastNewChat)(directChat.id);
    const enrichedChat = (0, socketHandler_js_1.getEnrichedChat)(directChat.id) || directChat;
    res.json({ success: true, contact: targetUser, chat: enrichedChat });
});
// Mark chat messages as read
exports.apiRouter.post('/chats/:id/read', (req, res) => {
    const chatId = req.params.id;
    const { userId } = req.body;
    for (const [_, msg] of store_js_1.store.messages.entries()) {
        if (msg.chatId === chatId && msg.senderId !== userId) {
            msg.status = 'read';
        }
    }
    store_js_1.store.saveToFile();
    res.json({ success: true });
});
// ==========================================
// 2. Chats (1-on-1 & Groups)
// ==========================================
exports.apiRouter.get('/chats', (req, res) => {
    const userId = req.query.userId;
    if (!userId)
        return res.status(400).json({ error: 'userId is required' });
    // Precompute unread message count map for this userId in a single O(M) pass
    const unreadCounts = new Map();
    for (const m of store_js_1.store.messages.values()) {
        if (!m.isDeletedForEveryone &&
            (!m.deletedForUserIds || !m.deletedForUserIds.includes(userId)) &&
            m.senderId !== userId &&
            m.status !== 'read') {
            unreadCounts.set(m.chatId, (unreadCounts.get(m.chatId) || 0) + 1);
        }
    }
    const userChats = Array.from(store_js_1.store.chats.values())
        .filter((chat) => chat.memberIds.includes(userId))
        .filter((chat) => !chat.hiddenForUserIds || !chat.hiddenForUserIds.includes(userId))
        .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime())
        .map((chat) => {
        const enriched = (0, socketHandler_js_1.getEnrichedChat)(chat.id, userId);
        if (enriched) {
            return {
                ...enriched,
                unreadCount: unreadCounts.get(chat.id) || 0,
            };
        }
        return chat;
    });
    res.json(userChats);
});
// Create or get existing 1-on-1 chat
exports.apiRouter.post('/chats/direct', (req, res) => {
    const { currentUserId, targetUserId } = req.body;
    if (!currentUserId || !targetUserId) {
        return res.status(400).json({ error: 'currentUserId and targetUserId required' });
    }
    let chat = Array.from(store_js_1.store.chats.values()).find((c) => !c.isGroup &&
        c.memberIds.length === 2 &&
        c.memberIds.includes(currentUserId) &&
        c.memberIds.includes(targetUserId));
    if (!chat) {
        chat = {
            id: `chat-${(0, uuid_1.v4)()}`,
            isGroup: false,
            memberIds: [currentUserId, targetUserId],
            createdAt: new Date(),
            updatedAt: new Date(),
            lastMessageAt: new Date(),
        };
        store_js_1.store.chats.set(chat.id, chat);
        store_js_1.store.saveToFile();
        (0, socketHandler_js_1.broadcastNewChat)(chat.id);
    }
    const enriched = (0, socketHandler_js_1.getEnrichedChat)(chat.id, currentUserId) || chat;
    res.json(enriched);
});
// Create Group Chat
exports.apiRouter.post('/chats/group', (req, res) => {
    const { name, description, avatar, creatorId, memberIds } = req.body;
    if (!name || !creatorId) {
        return res.status(400).json({ error: 'Group name and creatorId are required' });
    }
    const allMembers = Array.from(new Set([creatorId, ...(memberIds || [])]));
    const newGroup = {
        id: `chat-group-${(0, uuid_1.v4)()}`,
        isGroup: true,
        name,
        description: description || '',
        avatar: avatar || '',
        memberIds: allMembers,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastMessageAt: new Date(),
    };
    store_js_1.store.chats.set(newGroup.id, newGroup);
    const creator = store_js_1.store.users.get(creatorId);
    const sysMsg = {
        id: `msg-${(0, uuid_1.v4)()}`,
        chatId: newGroup.id,
        senderId: creatorId,
        type: 'text',
        content: `${creator?.name || 'Someone'} created group "${name}"`,
        status: 'read',
        createdAt: new Date(),
    };
    store_js_1.store.messages.set(sysMsg.id, sysMsg);
    store_js_1.store.saveToFile();
    (0, socketHandler_js_1.broadcastNewChat)(newGroup.id);
    const enriched = (0, socketHandler_js_1.getEnrichedChat)(newGroup.id, creatorId) || newGroup;
    res.json(enriched);
});
// Get Messages for a Chat (with auto-deduplication of any past duplicates)
exports.apiRouter.get('/chats/:id/messages', (req, res) => {
    const chatId = req.params.id;
    const userId = req.query.userId;
    const rawMessages = Array.from(store_js_1.store.messages.values())
        .filter((m) => m.chatId === chatId)
        .filter((m) => !m.isDeletedForEveryone)
        .filter((m) => !userId || !m.deletedForUserIds || !m.deletedForUserIds.includes(userId))
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    // Clean up any historical duplicate messages sent within 2.5s window
    const uniqueMessages = [];
    const duplicateIdsToRemove = [];
    for (const m of rawMessages) {
        const isDuplicate = uniqueMessages.some((u) => u.senderId === m.senderId &&
            u.content === m.content &&
            u.type === m.type &&
            Math.abs(u.createdAt.getTime() - m.createdAt.getTime()) < 2500);
        if (!isDuplicate) {
            uniqueMessages.push(m);
        }
        else {
            duplicateIdsToRemove.push(m.id);
        }
    }
    if (duplicateIdsToRemove.length > 0) {
        duplicateIdsToRemove.forEach((id) => store_js_1.store.messages.delete(id));
        store_js_1.store.saveToFile();
    }
    const messages = uniqueMessages.map((m) => {
        const sender = store_js_1.store.users.get(m.senderId);
        const senderAvatar = sender?.avatar && !sender.avatar.startsWith('data:')
            ? sender.avatar
            : (sender?.avatar ? `/api/users/${sender.id}/avatar` : '');
        const sanitizedSender = sender ? {
            id: sender.id,
            name: sender.name,
            phone: sender.phone,
            avatar: senderAvatar,
            isBusiness: sender.isBusiness,
            businessName: sender.businessName,
        } : undefined;
        return { ...m, sender: sanitizedSender };
    });
    res.json(messages);
});
// Send message via HTTP POST (robust fallback ensuring delivery & persistence)
exports.apiRouter.post('/messages', (req, res) => {
    const { chatId, senderId, content, type = 'text', mediaUrl, metadata, clientMessageId } = req.body;
    if (!chatId || !senderId) {
        return res.status(400).json({ error: 'chatId and senderId are required' });
    }
    const msg = (0, socketHandler_js_1.saveAndBroadcastMessage)({
        chatId,
        senderId,
        content: content || '',
        type,
        mediaUrl,
        metadata,
        clientMessageId,
    });
    if (!msg) {
        return res.status(404).json({ error: 'Chat not found' });
    }
    const sender = store_js_1.store.users.get(senderId);
    res.json({ ...msg, sender });
});
// ==========================================
// 3. IChat Business Catalog & Products
// ==========================================
exports.apiRouter.get('/business/products', (req, res) => {
    const userId = req.query.userId;
    const products = Array.from(store_js_1.store.products.values()).filter((p) => !userId || p.userId === userId);
    res.json(products);
});
exports.apiRouter.post('/business/products', (req, res) => {
    const { userId, name, description, price, currency, imageUrl } = req.body;
    if (!userId || !name || price === undefined) {
        return res.status(400).json({ error: 'userId, name, and price are required' });
    }
    const product = {
        id: `prod-${(0, uuid_1.v4)()}`,
        userId,
        name,
        description: description || '',
        price: Number(price),
        currency: currency || 'USD',
        imageUrl: imageUrl || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500',
        isAvailable: true,
        createdAt: new Date(),
    };
    store_js_1.store.products.set(product.id, product);
    store_js_1.store.saveToFile();
    res.json(product);
});
// ==========================================
// 4. Quick Replies
// ==========================================
exports.apiRouter.get('/business/quick-replies', (req, res) => {
    const userId = req.query.userId;
    const replies = Array.from(store_js_1.store.quickReplies.values()).filter((qr) => !userId || qr.userId === userId);
    res.json(replies);
});
exports.apiRouter.post('/business/quick-replies', (req, res) => {
    const { userId, shortcut, message } = req.body;
    if (!userId || !shortcut || !message) {
        return res.status(400).json({ error: 'userId, shortcut, and message required' });
    }
    const qr = {
        id: `qr-${(0, uuid_1.v4)()}`,
        userId,
        shortcut: shortcut.startsWith('/') ? shortcut : `/${shortcut}`,
        message,
        createdAt: new Date(),
    };
    store_js_1.store.quickReplies.set(qr.id, qr);
    store_js_1.store.saveToFile();
    res.json(qr);
});
// ==========================================
// 5. Labels & Tags
// ==========================================
exports.apiRouter.get('/business/labels', (req, res) => {
    const userId = req.query.userId;
    const labels = Array.from(store_js_1.store.labels.values()).filter((l) => !userId || l.userId === userId);
    res.json(labels);
});
exports.apiRouter.post('/business/labels', (req, res) => {
    const { userId, name, color } = req.body;
    const label = {
        id: `lbl-${(0, uuid_1.v4)()}`,
        userId,
        name,
        color: color || '#00a884',
        createdAt: new Date(),
    };
    store_js_1.store.labels.set(label.id, label);
    store_js_1.store.saveToFile();
    res.json(label);
});
exports.apiRouter.post('/chats/:id/labels', (req, res) => {
    const chatId = req.params.id;
    const { labelId } = req.body;
    if (!store_js_1.store.chatLabels.has(chatId)) {
        store_js_1.store.chatLabels.set(chatId, new Set());
    }
    store_js_1.store.chatLabels.get(chatId).add(labelId);
    store_js_1.store.saveToFile();
    res.json({ success: true });
});
exports.apiRouter.delete('/chats/:id/labels/:labelId', (req, res) => {
    const { id: chatId, labelId } = req.params;
    const set = store_js_1.store.chatLabels.get(chatId);
    if (set) {
        set.delete(labelId);
    }
    store_js_1.store.saveToFile();
    res.json({ success: true });
});
// ==========================================
// 6. Status / Stories (24h)
// ==========================================
exports.apiRouter.get('/status', (req, res) => {
    const now = new Date();
    const activeStatuses = Array.from(store_js_1.store.statuses.values())
        .filter((s) => s.expiresAt > now)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((s) => {
        const user = store_js_1.store.users.get(s.userId);
        return {
            ...s,
            user,
            viewsCount: s.viewers.length,
        };
    });
    res.json(activeStatuses);
});
exports.apiRouter.post('/status', (req, res) => {
    const { userId, type = 'text', mediaUrl, caption, backgroundColor } = req.body;
    if (!userId)
        return res.status(400).json({ error: 'userId is required' });
    const status = {
        id: `status-${(0, uuid_1.v4)()}`,
        userId,
        type: type,
        mediaUrl,
        caption,
        backgroundColor: backgroundColor || '#075E54',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000), // 24 hours
        viewers: [],
    };
    store_js_1.store.statuses.set(status.id, status);
    store_js_1.store.saveToFile();
    res.json(status);
});
// View Status
exports.apiRouter.post('/status/:id/view', (req, res) => {
    const statusId = req.params.id;
    const { viewerId } = req.body;
    const status = store_js_1.store.statuses.get(statusId);
    if (status && viewerId && !status.viewers.includes(viewerId)) {
        status.viewers.push(viewerId);
        store_js_1.store.saveToFile();
    }
    res.json({ success: true });
});
// ==========================================
// 7. Media & File Upload
// ==========================================
exports.apiRouter.post('/upload', (req, res) => {
    const { dataUrl, filename, type } = req.body;
    if (!dataUrl) {
        return res.status(400).json({ error: 'dataUrl is required' });
    }
    res.json({
        success: true,
        url: dataUrl,
        filename: filename || 'file',
        type: type || 'file',
    });
});
// ==========================================
// 8. Super Admin System & Chat Monitoring
// ==========================================
const verifyAdmin = (req, res, next) => {
    const adminId = req.headers['x-admin-id'] ||
        req.query.adminId ||
        req.body?.adminId;
    if (!adminId) {
        return res.status(401).json({ error: 'Admin authentication required.' });
    }
    const adminUser = store_js_1.store.users.get(adminId);
    const isSuperAdminPhone = adminUser && ((0, store_js_1.isPhoneMatch)(adminUser.phone, '02054245616') || adminUser.phone?.toLowerCase() === 'admin');
    if (!adminUser || (adminUser.role !== 'admin' && !isSuperAdminPhone)) {
        return res.status(403).json({ error: 'Access denied: Admin privileges required.' });
    }
    // Ensure role is admin
    adminUser.role = 'admin';
    adminUser.status = 'approved';
    req.adminUser = adminUser;
    next();
};
// 1. Admin Overview
exports.apiRouter.get('/admin/overview', verifyAdmin, (req, res) => {
    const allUsers = Array.from(store_js_1.store.users.values()).filter((u) => Boolean(u.password));
    const pendingUsers = allUsers.filter((u) => u.status === 'pending');
    const approvedUsers = allUsers.filter((u) => u.status === 'approved');
    const rejectedUsers = allUsers.filter((u) => u.status === 'rejected');
    res.json({
        totalUsers: allUsers.length,
        pendingCount: pendingUsers.length,
        approvedCount: approvedUsers.length,
        rejectedCount: rejectedUsers.length,
        totalChats: store_js_1.store.chats.size,
        totalMessages: store_js_1.store.messages.size,
    });
});
// 2. Admin List Users
exports.apiRouter.get('/admin/users', verifyAdmin, (req, res) => {
    const statusFilter = req.query.status;
    const users = Array.from(store_js_1.store.users.values())
        .filter((u) => Boolean(u.password))
        .filter((u) => !statusFilter || statusFilter === 'all' || u.status === statusFilter)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((u) => ({
        id: u.id,
        phone: u.phone,
        name: u.name,
        avatar: u.avatar && !u.avatar.startsWith('data:') ? u.avatar : (u.avatar ? `/api/users/${u.id}/avatar` : ''),
        role: u.role || 'user',
        status: u.status || 'approved',
        isBusiness: u.isBusiness,
        businessName: u.businessName,
        isOnline: u.isOnline,
        lastSeen: u.lastSeen,
        location: u.lastLocation || null,
        createdAt: u.createdAt,
    }));
    res.json(users);
});
// Admin Live Map: Geolocation of all participants / online users
exports.apiRouter.get('/admin/online-locations', verifyAdmin, (req, res) => {
    const users = Array.from(store_js_1.store.users.values())
        .filter((u) => Boolean(u.password))
        .map((u) => {
        let loc = u.lastLocation;
        if (!loc) {
            loc = {
                lat: 17.9757,
                lng: 102.6331,
                city: 'Vientiane',
                country: 'Laos',
                source: 'ip',
                updatedAt: u.lastSeen,
            };
        }
        return {
            id: u.id,
            phone: u.phone,
            name: u.name,
            avatar: u.avatar && !u.avatar.startsWith('data:') ? u.avatar : (u.avatar ? `/api/users/${u.id}/avatar` : ''),
            role: u.role || 'user',
            isOnline: Boolean(u.isOnline),
            lastSeen: u.lastSeen,
            location: loc,
        };
    });
    res.json(users);
});
// 3. Approve User
exports.apiRouter.post('/admin/users/:id/approve', verifyAdmin, (req, res) => {
    const user = store_js_1.store.users.get(req.params.id);
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    user.status = 'approved';
    user.updatedAt = new Date();
    store_js_1.store.saveToFile();
    (0, socketHandler_js_1.broadcastUserUpdated)(user);
    res.json({ success: true, user });
});
// 4. Reject User
exports.apiRouter.post('/admin/users/:id/reject', verifyAdmin, (req, res) => {
    const user = store_js_1.store.users.get(req.params.id);
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    user.status = 'rejected';
    user.updatedAt = new Date();
    store_js_1.store.saveToFile();
    (0, socketHandler_js_1.broadcastUserUpdated)(user);
    res.json({ success: true, user });
});
// 5. Toggle Admin Role
exports.apiRouter.post('/admin/users/:id/role', verifyAdmin, (req, res) => {
    const user = store_js_1.store.users.get(req.params.id);
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    const { role } = req.body;
    if (role !== 'admin' && role !== 'user') {
        return res.status(400).json({ error: 'Invalid role' });
    }
    user.role = role;
    user.updatedAt = new Date();
    store_js_1.store.saveToFile();
    (0, socketHandler_js_1.broadcastUserUpdated)(user);
    res.json({ success: true, user });
});
// 6. Delete User
exports.apiRouter.delete('/admin/users/:id', verifyAdmin, (req, res) => {
    const targetId = req.params.id;
    if (targetId === req.adminUser.id) {
        return res.status(400).json({ error: 'Admin cannot delete their own account.' });
    }
    const existing = store_js_1.store.users.get(targetId);
    store_js_1.store.users.delete(targetId);
    store_js_1.store.userContacts.delete(targetId);
    store_js_1.store.saveToFile();
    if (existing) {
        (0, socketHandler_js_1.broadcastUserUpdated)({ ...existing, deleted: true });
    }
    res.json({ success: true });
});
// 7. Admin Chat Monitoring: List ALL chats across the app
exports.apiRouter.get('/admin/chats', verifyAdmin, (req, res) => {
    // Precompute message counts in a single O(M) pass
    const messageCounts = new Map();
    for (const m of store_js_1.store.messages.values()) {
        messageCounts.set(m.chatId, (messageCounts.get(m.chatId) || 0) + 1);
    }
    const chats = Array.from(store_js_1.store.chats.values())
        .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime())
        .map((chat) => {
        const enriched = (0, socketHandler_js_1.getEnrichedChat)(chat.id);
        return {
            ...(enriched || chat),
            totalMessages: messageCounts.get(chat.id) || 0,
        };
    });
    res.json(chats);
});
// 8. Admin Chat Monitoring: Inspect and view all messages of ANY chat (including user-deleted)
exports.apiRouter.get('/admin/chats/:id/messages', verifyAdmin, (req, res) => {
    const chatId = req.params.id;
    const messages = Array.from(store_js_1.store.messages.values())
        .filter((m) => m.chatId === chatId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((m) => {
        const sender = store_js_1.store.users.get(m.senderId);
        const senderAvatar = sender?.avatar && !sender.avatar.startsWith('data:')
            ? sender.avatar
            : (sender?.avatar ? `/api/users/${sender.id}/avatar` : '');
        return {
            ...m,
            sender: sender ? { id: sender.id, name: sender.name, phone: sender.phone, avatar: senderAvatar } : undefined,
            wasDeletedForUsers: Boolean(m.deletedForUserIds && m.deletedForUserIds.length > 0),
            wasDeletedForEveryone: Boolean(m.isDeletedForEveryone),
            deletedForUserIds: m.deletedForUserIds || [],
        };
    });
    res.json(messages);
});
// ==========================================
// 9. Call History
// ==========================================
exports.apiRouter.get('/calls', (req, res) => {
    const userId = req.query.userId;
    let calls = Array.from(store_js_1.store.calls.values());
    if (userId) {
        calls = calls.filter((c) => c.callerId === userId || c.receiverId === userId);
    }
    const enriched = calls.map((c) => {
        const caller = store_js_1.store.users.get(c.callerId);
        const receiver = c.receiverId ? store_js_1.store.users.get(c.receiverId) : undefined;
        return {
            ...c,
            caller: caller ? { id: caller.id, name: caller.name, phone: caller.phone, avatar: caller.avatar } : undefined,
            receiver: receiver ? { id: receiver.id, name: receiver.name, phone: receiver.phone, avatar: receiver.avatar } : undefined,
        };
    });
    enriched.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    res.json(enriched);
});
// ==========================================
// 10. Chat & Message Deletion (Soft Deletion: Admin never loses data)
// ==========================================
// Delete a single message
exports.apiRouter.delete('/messages/:id', (req, res) => {
    const messageId = req.params.id;
    const message = store_js_1.store.messages.get(messageId);
    if (!message) {
        return res.status(404).json({ error: 'Message not found' });
    }
    const { userId, mode } = req.body || {};
    const queryUserId = req.query.userId;
    const effectiveUserId = userId || queryUserId;
    const effectiveMode = mode || req.query.mode || (effectiveUserId ? 'for_me' : 'for_everyone');
    const chatId = message.chatId;
    if (effectiveMode === 'for_everyone') {
        message.isDeletedForEveryone = true;
        message.deletedBy = effectiveUserId;
        message.deletedAt = new Date();
        store_js_1.store.saveToFile();
        (0, socketHandler_js_1.broadcastMessageDeleted)(chatId, messageId);
    }
    else {
        // Delete for me only
        if (effectiveUserId) {
            if (!message.deletedForUserIds)
                message.deletedForUserIds = [];
            if (!message.deletedForUserIds.includes(effectiveUserId)) {
                message.deletedForUserIds.push(effectiveUserId);
            }
            message.deletedAt = new Date();
            store_js_1.store.saveToFile();
            (0, socketHandler_js_1.broadcastMessageDeleted)(chatId, messageId, effectiveUserId);
        }
        else {
            message.isDeletedForEveryone = true;
            message.deletedAt = new Date();
            store_js_1.store.saveToFile();
            (0, socketHandler_js_1.broadcastMessageDeleted)(chatId, messageId);
        }
    }
    res.json({ success: true, messageId, chatId, mode: effectiveMode });
});
// Clear all messages in a chat (for a user or globally)
exports.apiRouter.delete('/chats/:id/messages', (req, res) => {
    const chatId = req.params.id;
    const chat = store_js_1.store.chats.get(chatId);
    if (!chat) {
        return res.status(404).json({ error: 'Chat not found' });
    }
    const { userId } = req.body || {};
    const effectiveUserId = userId || req.query.userId;
    if (effectiveUserId) {
        for (const [_, msg] of store_js_1.store.messages.entries()) {
            if (msg.chatId === chatId) {
                if (!msg.deletedForUserIds)
                    msg.deletedForUserIds = [];
                if (!msg.deletedForUserIds.includes(effectiveUserId)) {
                    msg.deletedForUserIds.push(effectiveUserId);
                }
            }
        }
        store_js_1.store.saveToFile();
        (0, socketHandler_js_1.broadcastChatCleared)(chatId, effectiveUserId);
    }
    else {
        for (const [_, msg] of store_js_1.store.messages.entries()) {
            if (msg.chatId === chatId) {
                msg.isDeletedForEveryone = true;
            }
        }
        store_js_1.store.saveToFile();
        (0, socketHandler_js_1.broadcastChatCleared)(chatId);
    }
    res.json({ success: true, chatId });
});
// Delete an entire chat conversation (soft hide for user so other user & admin keep it)
exports.apiRouter.delete('/chats/:id', (req, res) => {
    const chatId = req.params.id;
    const chat = store_js_1.store.chats.get(chatId);
    if (!chat) {
        return res.status(404).json({ error: 'Chat not found' });
    }
    const { userId } = req.body || {};
    const effectiveUserId = userId || req.query.userId;
    const memberIds = [...chat.memberIds];
    if (effectiveUserId) {
        if (!chat.hiddenForUserIds)
            chat.hiddenForUserIds = [];
        if (!chat.hiddenForUserIds.includes(effectiveUserId)) {
            chat.hiddenForUserIds.push(effectiveUserId);
        }
        for (const [_, msg] of store_js_1.store.messages.entries()) {
            if (msg.chatId === chatId) {
                if (!msg.deletedForUserIds)
                    msg.deletedForUserIds = [];
                if (!msg.deletedForUserIds.includes(effectiveUserId)) {
                    msg.deletedForUserIds.push(effectiveUserId);
                }
            }
        }
        store_js_1.store.saveToFile();
        (0, socketHandler_js_1.broadcastChatDeleted)(chatId, memberIds, effectiveUserId);
    }
    else {
        for (const [_, msg] of store_js_1.store.messages.entries()) {
            if (msg.chatId === chatId) {
                msg.isDeletedForEveryone = true;
            }
        }
        store_js_1.store.saveToFile();
        (0, socketHandler_js_1.broadcastChatDeleted)(chatId, memberIds);
    }
    res.json({ success: true, chatId });
});
