import { Router } from 'express';
import { store, isPhoneMatch, normalizePhone } from '../store.js';
import { UserData, ChatData } from '../types.js';
import { v4 as uuidv4 } from 'uuid';
import {
  broadcastNewChat,
  getEnrichedChat,
  broadcastMessageDeleted,
  broadcastChatCleared,
  broadcastChatDeleted,
  broadcastUserUpdated,
} from '../sockets/socketHandler.js';

import { VAPID_PUBLIC_KEY } from '../services/pushService.js';

export const apiRouter = Router();

// Web Push VAPID Public Key and Subscription Endpoints
apiRouter.get('/push/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

apiRouter.post('/push/subscribe', (req, res) => {
  const { userId, subscription } = req.body;
  if (!userId || !subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Missing userId or subscription endpoint' });
  }

  const existing = store.pushSubscriptions.get(userId) || [];
  const filtered = existing.filter((s: any) => s.endpoint !== subscription.endpoint);
  filtered.push(subscription);
  store.pushSubscriptions.set(userId, filtered);
  store.saveToFile();

  console.log(`[Push] User ${userId} registered push subscription (Total: ${filtered.length})`);
  res.json({ success: true, count: filtered.length });
});

// ==========================================
// 1. Authentication & Users
// ==========================================
// Get all contacts / users
apiRouter.get('/users', (req, res) => {
  const users = Array.from(store.users.values());
  res.json(users);
});

// 1. User Registration (Create New Account)
apiRouter.post('/auth/register', (req, res) => {
  const {
    name,
    phone,
    password,
    isBusiness,
    businessName,
    businessCategory,
    businessDescription,
    avatar,
  } = req.body;

  if (!name || !phone || !password) {
    return res.status(400).json({ error: 'Name, phone number, and password are required.' });
  }

  const chosenAvatar = avatar || '';

  // Determine if this user should be admin or auto-approved
  const isAdminPhone = isPhoneMatch(phone, '02054245616') || phone.toLowerCase().trim() === 'admin';
  const existingAdmins = Array.from(store.users.values()).filter((u) => u.role === 'admin' && Boolean(u.password));
  const isFirstAdmin = existingAdmins.length === 0;
  const shouldBeAdmin = isAdminPhone || isFirstAdmin;
  const initialRole: 'admin' | 'user' = shouldBeAdmin ? 'admin' : 'user';
  const initialStatus: 'approved' | 'pending' = shouldBeAdmin ? 'approved' : 'pending';

  // Check if account already exists for this phone
  const existingUser = Array.from(store.users.values()).find((u) => isPhoneMatch(u.phone, phone));
  if (existingUser) {
    // If it is already a fully registered account with a password
    if (existingUser.password) {
      return res.status(400).json({ error: 'An account with this phone number already exists. Please log in.' });
    }

    // If it was a contact stub created when someone added this phone number, claim and activate it!
    existingUser.name = name.trim();
    existingUser.phone = phone.trim();
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

    if (!store.userContacts.has(existingUser.id)) {
      store.userContacts.set(existingUser.id, new Set());
    }

    store.saveToFile();
    return res.status(201).json({
      success: true,
      user: existingUser,
      requiresApproval: existingUser.status === 'pending',
    });
  }

  const newUser: UserData = {
    id: `usr-${uuidv4()}`,
    phone: phone.trim(),
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

  store.users.set(newUser.id, newUser);
  store.userContacts.set(newUser.id, new Set());
  store.saveToFile();
  res.status(201).json({
    success: true,
    user: newUser,
    requiresApproval: newUser.status === 'pending',
  });
});

// 2. User Login
apiRouter.post('/auth/login', (req, res) => {
  const { phone, password, demoUserId } = req.body;

  if (demoUserId) {
    const user = store.users.get(demoUserId);
    if (user) {
      user.isOnline = true;
      user.lastSeen = new Date();
      return res.json({ success: true, user });
    }
  }

  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }

  const user = Array.from(store.users.values()).find((u) => isPhoneMatch(u.phone, phone));
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
    store.saveToFile();
  }

  // Ensure role and status are set
  if (isPhoneMatch(user.phone, '02054245616') || user.phone?.toLowerCase() === 'admin') {
    user.role = 'admin';
    user.status = 'approved';
  } else if (!user.status) {
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
  store.saveToFile();

  res.json({ success: true, user });
});

// Update Profile / Business Profile
apiRouter.put('/users/:id', (req, res) => {
  const user = store.users.get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const {
    name,
    about,
    avatar,
    isBusiness,
    businessName,
    businessCategory,
    businessDescription,
    businessAddress,
    businessHours,
    businessWebsite,
  } = req.body;

  if (name !== undefined) user.name = name;
  if (about !== undefined) user.about = about;
  if (avatar !== undefined) user.avatar = avatar;
  if (isBusiness !== undefined) user.isBusiness = isBusiness;
  if (businessName !== undefined) user.businessName = businessName;
  if (businessCategory !== undefined) user.businessCategory = businessCategory;
  if (businessDescription !== undefined) user.businessDescription = businessDescription;
  if (businessAddress !== undefined) user.businessAddress = businessAddress;
  if (businessHours !== undefined) user.businessHours = businessHours;
  if (businessWebsite !== undefined) user.businessWebsite = businessWebsite;
  user.updatedAt = new Date();
  store.saveToFile();
  broadcastUserUpdated(user);

  res.json({ success: true, user });
});

// Contacts Management (Only show added contacts)
apiRouter.get('/contacts', (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const contactIds = store.userContacts.get(userId) || new Set();
  const contacts = Array.from(contactIds)
    .map((id) => store.users.get(id))
    .filter((u): u is UserData => Boolean(u));

  res.json(contacts);
});

// Add contact by Phone, Name, or User ID
apiRouter.post('/contacts', (req, res) => {
  const { userId, query } = req.body;
  if (!userId || !query) {
    return res.status(400).json({ error: 'userId and query (Phone number, Name, or User ID) are required.' });
  }

  const cleanQuery = query.trim().toLowerCase();
  const cleanDigits = normalizePhone(query);

  const currentUser = store.users.get(userId);
  if (
    userId.toLowerCase() === cleanQuery ||
    (currentUser && isPhoneMatch(currentUser.phone, query))
  ) {
    return res.status(400).json({ error: "You cannot add yourself as a contact. Please enter another user's phone number, name, or ID." });
  }

  // 1. Search among registered users first (have password)
  let contactUser = Array.from(store.users.values()).find((u) => {
    if (u.id === userId) return false;
    if (u.id.toLowerCase() === cleanQuery) return true;
    if (cleanDigits.length >= 6 && isPhoneMatch(u.phone, query) && Boolean(u.password)) return true;
    if (u.name.toLowerCase() === cleanQuery && Boolean(u.password)) return true;
    return false;
  });

  // 2. Fallback to any user matching phone, name, or ID
  if (!contactUser) {
    contactUser = Array.from(store.users.values()).find((u) => {
      if (u.id === userId) return false;
      if (u.id.toLowerCase() === cleanQuery || u.id.toLowerCase().includes(cleanQuery)) return true;
      if (cleanDigits.length >= 6 && isPhoneMatch(u.phone, query)) return true;
      if (u.name.toLowerCase().includes(cleanQuery)) return true;
      if (u.businessName && u.businessName.toLowerCase().includes(cleanQuery)) return true;
      return false;
    });
  }

  // 3. If still not found, create contact stub for this phone or name
  if (!contactUser) {
    if (cleanDigits.length >= 6) {
      const formattedPhone = query.trim();
      contactUser = {
        id: `usr-${uuidv4()}`,
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
      store.users.set(contactUser.id, contactUser);
    } else if (cleanQuery.startsWith('usr-')) {
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
      store.users.set(contactUser.id, contactUser);
    } else if (cleanQuery.length >= 2) {
      contactUser = {
        id: `usr-${uuidv4()}`,
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
      store.users.set(contactUser.id, contactUser);
    } else {
      return res.status(400).json({ error: 'Please enter a valid Phone number (at least 6 digits), Name, or User ID.' });
    }
  }

  const targetUser = contactUser;

  if (!store.userContacts.has(userId)) {
    store.userContacts.set(userId, new Set());
  }
  store.userContacts.get(userId)!.add(targetUser.id);

  // Reciprocally link contact
  if (!store.userContacts.has(targetUser.id)) {
    store.userContacts.set(targetUser.id, new Set());
  }
  store.userContacts.get(targetUser.id)!.add(userId);

  // Automatically ensure a direct chat exists so user can message immediately
  let directChat = Array.from(store.chats.values()).find(
    (c) => !c.isGroup && c.memberIds.includes(userId) && c.memberIds.includes(targetUser.id)
  );

  if (!directChat) {
    const newChat: ChatData = {
      id: `chat-${uuidv4()}`,
      isGroup: false,
      memberIds: [userId, targetUser.id],
      lastMessageAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    store.chats.set(newChat.id, newChat);
    directChat = newChat;
  }

  store.saveToFile();

  // Broadcast new chat event to both users via socket
  broadcastNewChat(directChat.id);

  const enrichedChat = getEnrichedChat(directChat.id) || directChat;
  res.json({ success: true, contact: targetUser, chat: enrichedChat });
});

// Mark chat messages as read
apiRouter.post('/chats/:id/read', (req, res) => {
  const chatId = req.params.id;
  const { userId } = req.body;

  for (const [_, msg] of store.messages.entries()) {
    if (msg.chatId === chatId && msg.senderId !== userId) {
      msg.status = 'read';
    }
  }

  store.saveToFile();
  res.json({ success: true });
});

// ==========================================
// 2. Chats (1-on-1 & Groups)
// ==========================================
apiRouter.get('/chats', (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const userChats = Array.from(store.chats.values())
    .filter((chat) => chat.memberIds.includes(userId))
    .filter((chat) => !chat.hiddenForUserIds || !chat.hiddenForUserIds.includes(userId))
    .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime())
    .map((chat) => {
      const enriched = getEnrichedChat(chat.id, userId);
      if (enriched) {
        // Calculate unread count specifically for requesting user
        const chatMessages = Array.from(store.messages.values())
          .filter((m) => m.chatId === chat.id && !m.isDeletedForEveryone && (!m.deletedForUserIds || !m.deletedForUserIds.includes(userId)));
        const unreadCount = chatMessages.filter(
          (m) => m.senderId !== userId && m.status !== 'read'
        ).length;

        return {
          ...enriched,
          unreadCount,
        };
      }
      return chat;
    });

  res.json(userChats);
});

// Create or get existing 1-on-1 chat
apiRouter.post('/chats/direct', (req, res) => {
  const { currentUserId, targetUserId } = req.body;
  if (!currentUserId || !targetUserId) {
    return res.status(400).json({ error: 'currentUserId and targetUserId required' });
  }

  let chat = Array.from(store.chats.values()).find(
    (c) =>
      !c.isGroup &&
      c.memberIds.length === 2 &&
      c.memberIds.includes(currentUserId) &&
      c.memberIds.includes(targetUserId)
  );

  if (!chat) {
    chat = {
      id: `chat-${uuidv4()}`,
      isGroup: false,
      memberIds: [currentUserId, targetUserId],
      createdAt: new Date(),
      updatedAt: new Date(),
      lastMessageAt: new Date(),
    };
    store.chats.set(chat.id, chat);
    store.saveToFile();
    broadcastNewChat(chat.id);
  }

  const enriched = getEnrichedChat(chat.id, currentUserId) || chat;
  res.json(enriched);
});

// Create Group Chat
apiRouter.post('/chats/group', (req, res) => {
  const { name, description, avatar, creatorId, memberIds } = req.body;
  if (!name || !creatorId) {
    return res.status(400).json({ error: 'Group name and creatorId are required' });
  }

  const allMembers = Array.from(new Set([creatorId, ...(memberIds || [])]));

  const newGroup: ChatData = {
    id: `chat-group-${uuidv4()}`,
    isGroup: true,
    name,
    description: description || '',
    avatar: avatar || '',
    memberIds: allMembers,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastMessageAt: new Date(),
  };

  store.chats.set(newGroup.id, newGroup);

  const creator = store.users.get(creatorId);
  const sysMsg = {
    id: `msg-${uuidv4()}`,
    chatId: newGroup.id,
    senderId: creatorId,
    type: 'text' as const,
    content: `${creator?.name || 'Someone'} created group "${name}"`,
    status: 'read' as const,
    createdAt: new Date(),
  };
  store.messages.set(sysMsg.id, sysMsg);
  store.saveToFile();

  broadcastNewChat(newGroup.id);
  const enriched = getEnrichedChat(newGroup.id, creatorId) || newGroup;
  res.json(enriched);
});

// Get Messages for a Chat
apiRouter.get('/chats/:id/messages', (req, res) => {
  const chatId = req.params.id;
  const userId = req.query.userId as string;
  const messages = Array.from(store.messages.values())
    .filter((m) => m.chatId === chatId)
    .filter((m) => !m.isDeletedForEveryone)
    .filter((m) => !userId || !m.deletedForUserIds || !m.deletedForUserIds.includes(userId))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((m) => {
      const sender = store.users.get(m.senderId);
      return { ...m, sender };
    });

  res.json(messages);
});

// ==========================================
// 3. IChat Business Catalog & Products
// ==========================================
apiRouter.get('/business/products', (req, res) => {
  const userId = req.query.userId as string;
  const products = Array.from(store.products.values()).filter(
    (p) => !userId || p.userId === userId
  );
  res.json(products);
});

apiRouter.post('/business/products', (req, res) => {
  const { userId, name, description, price, currency, imageUrl } = req.body;
  if (!userId || !name || price === undefined) {
    return res.status(400).json({ error: 'userId, name, and price are required' });
  }

  const product = {
    id: `prod-${uuidv4()}`,
    userId,
    name,
    description: description || '',
    price: Number(price),
    currency: currency || 'USD',
    imageUrl: imageUrl || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500',
    isAvailable: true,
    createdAt: new Date(),
  };

  store.products.set(product.id, product);
  store.saveToFile();
  res.json(product);
});

// ==========================================
// 4. Quick Replies
// ==========================================
apiRouter.get('/business/quick-replies', (req, res) => {
  const userId = req.query.userId as string;
  const replies = Array.from(store.quickReplies.values()).filter(
    (qr) => !userId || qr.userId === userId
  );
  res.json(replies);
});

apiRouter.post('/business/quick-replies', (req, res) => {
  const { userId, shortcut, message } = req.body;
  if (!userId || !shortcut || !message) {
    return res.status(400).json({ error: 'userId, shortcut, and message required' });
  }

  const qr = {
    id: `qr-${uuidv4()}`,
    userId,
    shortcut: shortcut.startsWith('/') ? shortcut : `/${shortcut}`,
    message,
    createdAt: new Date(),
  };

  store.quickReplies.set(qr.id, qr);
  store.saveToFile();
  res.json(qr);
});

// ==========================================
// 5. Labels & Tags
// ==========================================
apiRouter.get('/business/labels', (req, res) => {
  const userId = req.query.userId as string;
  const labels = Array.from(store.labels.values()).filter(
    (l) => !userId || l.userId === userId
  );
  res.json(labels);
});

apiRouter.post('/business/labels', (req, res) => {
  const { userId, name, color } = req.body;
  const label = {
    id: `lbl-${uuidv4()}`,
    userId,
    name,
    color: color || '#00a884',
    createdAt: new Date(),
  };
  store.labels.set(label.id, label);
  store.saveToFile();
  res.json(label);
});

apiRouter.post('/chats/:id/labels', (req, res) => {
  const chatId = req.params.id;
  const { labelId } = req.body;
  if (!store.chatLabels.has(chatId)) {
    store.chatLabels.set(chatId, new Set());
  }
  store.chatLabels.get(chatId)!.add(labelId);
  store.saveToFile();
  res.json({ success: true });
});

apiRouter.delete('/chats/:id/labels/:labelId', (req, res) => {
  const { id: chatId, labelId } = req.params;
  const set = store.chatLabels.get(chatId);
  if (set) {
    set.delete(labelId);
  }
  store.saveToFile();
  res.json({ success: true });
});

// ==========================================
// 6. Status / Stories (24h)
// ==========================================
apiRouter.get('/status', (req, res) => {
  const now = new Date();
  const activeStatuses = Array.from(store.statuses.values())
    .filter((s) => s.expiresAt > now)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((s) => {
      const user = store.users.get(s.userId);
      return {
        ...s,
        user,
        viewsCount: s.viewers.length,
      };
    });

  res.json(activeStatuses);
});

apiRouter.post('/status', (req, res) => {
  const { userId, type = 'text', mediaUrl, caption, backgroundColor } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const status = {
    id: `status-${uuidv4()}`,
    userId,
    type: type as 'text' | 'image' | 'video',
    mediaUrl,
    caption,
    backgroundColor: backgroundColor || '#075E54',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 3600 * 1000), // 24 hours
    viewers: [],
  };

  store.statuses.set(status.id, status);
  store.saveToFile();
  res.json(status);
});

// View Status
apiRouter.post('/status/:id/view', (req, res) => {
  const statusId = req.params.id;
  const { viewerId } = req.body;
  const status = store.statuses.get(statusId);
  if (status && viewerId && !status.viewers.includes(viewerId)) {
    status.viewers.push(viewerId);
    store.saveToFile();
  }
  res.json({ success: true });
});

// ==========================================
// 7. Media & File Upload
// ==========================================
apiRouter.post('/upload', (req, res) => {
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
const verifyAdmin = (req: any, res: any, next: any) => {
  const adminId =
    (req.headers['x-admin-id'] as string) ||
    (req.query.adminId as string) ||
    req.body?.adminId;

  if (!adminId) {
    return res.status(401).json({ error: 'Admin authentication required.' });
  }

  const adminUser = store.users.get(adminId);
  const isSuperAdminPhone = adminUser && (isPhoneMatch(adminUser.phone, '02054245616') || adminUser.phone?.toLowerCase() === 'admin');

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
apiRouter.get('/admin/overview', verifyAdmin, (req, res) => {
  const allUsers = Array.from(store.users.values()).filter((u) => Boolean(u.password));
  const pendingUsers = allUsers.filter((u) => u.status === 'pending');
  const approvedUsers = allUsers.filter((u) => u.status === 'approved');
  const rejectedUsers = allUsers.filter((u) => u.status === 'rejected');

  res.json({
    totalUsers: allUsers.length,
    pendingCount: pendingUsers.length,
    approvedCount: approvedUsers.length,
    rejectedCount: rejectedUsers.length,
    totalChats: store.chats.size,
    totalMessages: store.messages.size,
  });
});

// 2. Admin List Users
apiRouter.get('/admin/users', verifyAdmin, (req, res) => {
  const statusFilter = req.query.status as string;
  const users = Array.from(store.users.values())
    .filter((u) => Boolean(u.password))
    .filter((u) => !statusFilter || statusFilter === 'all' || u.status === statusFilter)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((u) => ({
      id: u.id,
      phone: u.phone,
      name: u.name,
      avatar: u.avatar,
      role: u.role || 'user',
      status: u.status || 'approved',
      isBusiness: u.isBusiness,
      businessName: u.businessName,
      isOnline: u.isOnline,
      lastSeen: u.lastSeen,
      createdAt: u.createdAt,
    }));

  res.json(users);
});

// 3. Approve User
apiRouter.post('/admin/users/:id/approve', verifyAdmin, (req, res) => {
  const user = store.users.get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  user.status = 'approved';
  user.updatedAt = new Date();
  store.saveToFile();

  res.json({ success: true, user });
});

// 4. Reject User
apiRouter.post('/admin/users/:id/reject', verifyAdmin, (req, res) => {
  const user = store.users.get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  user.status = 'rejected';
  user.updatedAt = new Date();
  store.saveToFile();

  res.json({ success: true, user });
});

// 5. Toggle Admin Role
apiRouter.post('/admin/users/:id/role', verifyAdmin, (req, res) => {
  const user = store.users.get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { role } = req.body;
  if (role !== 'admin' && role !== 'user') {
    return res.status(400).json({ error: 'Invalid role' });
  }

  user.role = role;
  user.updatedAt = new Date();
  store.saveToFile();

  res.json({ success: true, user });
});

// 6. Delete User
apiRouter.delete('/admin/users/:id', verifyAdmin, (req, res) => {
  const targetId = req.params.id;
  if (targetId === (req as any).adminUser.id) {
    return res.status(400).json({ error: 'Admin cannot delete their own account.' });
  }

  store.users.delete(targetId);
  store.userContacts.delete(targetId);
  store.saveToFile();

  res.json({ success: true });
});

// 7. Admin Chat Monitoring: List ALL chats across the app
apiRouter.get('/admin/chats', verifyAdmin, (req, res) => {
  const chats = Array.from(store.chats.values())
    .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime())
    .map((chat) => {
      const enriched = getEnrichedChat(chat.id);
      const totalMessages = Array.from(store.messages.values()).filter((m) => m.chatId === chat.id).length;
      return {
        ...(enriched || chat),
        totalMessages,
      };
    });

  res.json(chats);
});

// 8. Admin Chat Monitoring: Inspect and view all messages of ANY chat (including user-deleted)
apiRouter.get('/admin/chats/:id/messages', verifyAdmin, (req, res) => {
  const chatId = req.params.id;
  const messages = Array.from(store.messages.values())
    .filter((m) => m.chatId === chatId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((m) => {
      const sender = store.users.get(m.senderId);
      return {
        ...m,
        sender: sender ? { id: sender.id, name: sender.name, phone: sender.phone, avatar: sender.avatar } : undefined,
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
apiRouter.get('/calls', (req, res) => {
  const userId = req.query.userId as string;
  let calls = Array.from(store.calls.values());
  if (userId) {
    calls = calls.filter((c) => c.callerId === userId || c.receiverId === userId);
  }
  const enriched = calls.map((c) => {
    const caller = store.users.get(c.callerId);
    const receiver = c.receiverId ? store.users.get(c.receiverId) : undefined;
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
apiRouter.delete('/messages/:id', (req, res) => {
  const messageId = req.params.id;
  const message = store.messages.get(messageId);
  if (!message) {
    return res.status(404).json({ error: 'Message not found' });
  }

  const { userId, mode } = req.body || {};
  const queryUserId = req.query.userId as string;
  const effectiveUserId = userId || queryUserId;
  const effectiveMode = mode || (req.query.mode as string) || (effectiveUserId ? 'for_me' : 'for_everyone');
  const chatId = message.chatId;

  if (effectiveMode === 'for_everyone') {
    message.isDeletedForEveryone = true;
    message.deletedBy = effectiveUserId;
    message.deletedAt = new Date();
    store.saveToFile();
    broadcastMessageDeleted(chatId, messageId);
  } else {
    // Delete for me only
    if (effectiveUserId) {
      if (!message.deletedForUserIds) message.deletedForUserIds = [];
      if (!message.deletedForUserIds.includes(effectiveUserId)) {
        message.deletedForUserIds.push(effectiveUserId);
      }
      message.deletedAt = new Date();
      store.saveToFile();
      broadcastMessageDeleted(chatId, messageId, effectiveUserId);
    } else {
      message.isDeletedForEveryone = true;
      message.deletedAt = new Date();
      store.saveToFile();
      broadcastMessageDeleted(chatId, messageId);
    }
  }

  res.json({ success: true, messageId, chatId, mode: effectiveMode });
});

// Clear all messages in a chat (for a user or globally)
apiRouter.delete('/chats/:id/messages', (req, res) => {
  const chatId = req.params.id;
  const chat = store.chats.get(chatId);
  if (!chat) {
    return res.status(404).json({ error: 'Chat not found' });
  }

  const { userId } = req.body || {};
  const effectiveUserId = userId || (req.query.userId as string);

  if (effectiveUserId) {
    for (const [_, msg] of store.messages.entries()) {
      if (msg.chatId === chatId) {
        if (!msg.deletedForUserIds) msg.deletedForUserIds = [];
        if (!msg.deletedForUserIds.includes(effectiveUserId)) {
          msg.deletedForUserIds.push(effectiveUserId);
        }
      }
    }
    store.saveToFile();
    broadcastChatCleared(chatId, effectiveUserId);
  } else {
    for (const [_, msg] of store.messages.entries()) {
      if (msg.chatId === chatId) {
        msg.isDeletedForEveryone = true;
      }
    }
    store.saveToFile();
    broadcastChatCleared(chatId);
  }

  res.json({ success: true, chatId });
});

// Delete an entire chat conversation (soft hide for user so other user & admin keep it)
apiRouter.delete('/chats/:id', (req, res) => {
  const chatId = req.params.id;
  const chat = store.chats.get(chatId);
  if (!chat) {
    return res.status(404).json({ error: 'Chat not found' });
  }

  const { userId } = req.body || {};
  const effectiveUserId = userId || (req.query.userId as string);
  const memberIds = [...chat.memberIds];

  if (effectiveUserId) {
    if (!chat.hiddenForUserIds) chat.hiddenForUserIds = [];
    if (!chat.hiddenForUserIds.includes(effectiveUserId)) {
      chat.hiddenForUserIds.push(effectiveUserId);
    }
    for (const [_, msg] of store.messages.entries()) {
      if (msg.chatId === chatId) {
        if (!msg.deletedForUserIds) msg.deletedForUserIds = [];
        if (!msg.deletedForUserIds.includes(effectiveUserId)) {
          msg.deletedForUserIds.push(effectiveUserId);
        }
      }
    }
    store.saveToFile();
    broadcastChatDeleted(chatId, memberIds, effectiveUserId);
  } else {
    for (const [_, msg] of store.messages.entries()) {
      if (msg.chatId === chatId) {
        msg.isDeletedForEveryone = true;
      }
    }
    store.saveToFile();
    broadcastChatDeleted(chatId, memberIds);
  }

  res.json({ success: true, chatId });
});
