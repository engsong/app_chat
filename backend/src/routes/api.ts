import { Router } from 'express';
import { store } from '../store.js';
import { UserData } from '../types.js';
import { v4 as uuidv4 } from 'uuid';

export const apiRouter = Router();

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

  // Check if phone already registered
  const existingUser = Array.from(store.users.values()).find((u) => u.phone === phone);
  if (existingUser) {
    return res.status(400).json({ error: 'An account with this phone number already exists. Please log in.' });
  }

  const defaultAvatars = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=150',
  ];
  const chosenAvatar = avatar || defaultAvatars[Math.floor(Math.random() * defaultAvatars.length)];

  const newUser: UserData = {
    id: `usr-${uuidv4()}`,
    phone,
    password,
    name,
    avatar: chosenAvatar,
    about: isBusiness
      ? 'Welcome to our official business chat!'
      : 'Hey there! I am using WhatsApp Business.',
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
  res.status(201).json({ success: true, user: newUser });
});

// 2. User Login
apiRouter.post('/auth/login', (req, res) => {
  const { phone, password, demoUserId } = req.body;

  // Fast demo user login bypass if selected directly
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

  const user = Array.from(store.users.values()).find((u) => u.phone === phone);
  if (!user) {
    return res.status(401).json({ error: 'No account found with this phone number. Please check or create a new account.' });
  }

  // If user has a password set and password was provided, verify it
  if (user.password && password && user.password !== password) {
    return res.status(401).json({ error: 'Incorrect password. Please try again.' });
  }

  user.isOnline = true;
  user.lastSeen = new Date();

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

  res.json({ success: true, user });
});

// ==========================================
// 2. Chats (1-on-1 & Groups)
// ==========================================
apiRouter.get('/chats', (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const userChats = Array.from(store.chats.values())
    .filter((chat) => chat.memberIds.includes(userId))
    .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime())
    .map((chat) => {
      // Find members
      const members = chat.memberIds.map((mId) => {
        const u = store.users.get(mId);
        return {
          id: `cm-${mId}`,
          chatId: chat.id,
          userId: mId,
          role: 'member' as const,
          user: u,
        };
      });

      // Find last message
      const chatMessages = Array.from(store.messages.values())
        .filter((m) => m.chatId === chat.id)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const lastMessage = chatMessages[0];
      const unreadCount = chatMessages.filter(
        (m) => m.senderId !== userId && m.status !== 'read'
      ).length;

      // Labels
      const labelIds = store.chatLabels.get(chat.id) || new Set();
      const labels = Array.from(labelIds)
        .map((lId) => store.labels.get(lId))
        .filter(Boolean);

      return {
        ...chat,
        members,
        lastMessage,
        unreadCount,
        labels,
      };
    });

  res.json(userChats);
});

// Create or get existing 1-on-1 chat
apiRouter.post('/chats/direct', (req, res) => {
  const { currentUserId, targetUserId } = req.body;
  if (!currentUserId || !targetUserId) {
    return res.status(400).json({ error: 'currentUserId and targetUserId required' });
  }

  // Look for existing direct chat between these two
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
  }

  res.json(chat);
});

// Create Group Chat
apiRouter.post('/chats/group', (req, res) => {
  const { name, description, avatar, creatorId, memberIds } = req.body;
  if (!name || !creatorId) {
    return res.status(400).json({ error: 'Group name and creatorId are required' });
  }

  const allMembers = Array.from(new Set([creatorId, ...(memberIds || [])]));

  const newGroup = {
    id: `chat-group-${uuidv4()}`,
    isGroup: true,
    name,
    description: description || '',
    avatar: avatar || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150',
    memberIds: allMembers,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastMessageAt: new Date(),
  };

  store.chats.set(newGroup.id, newGroup);

  // System join message
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

  res.json(newGroup);
});

// Get Messages for a Chat
apiRouter.get('/chats/:id/messages', (req, res) => {
  const chatId = req.params.id;
  const messages = Array.from(store.messages.values())
    .filter((m) => m.chatId === chatId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((m) => {
      const sender = store.users.get(m.senderId);
      return { ...m, sender };
    });

  res.json(messages);
});

// ==========================================
// 3. WhatsApp Business Catalog & Products
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
  res.json(label);
});

apiRouter.post('/chats/:id/labels', (req, res) => {
  const chatId = req.params.id;
  const { labelId } = req.body;
  if (!store.chatLabels.has(chatId)) {
    store.chatLabels.set(chatId, new Set());
  }
  store.chatLabels.get(chatId)!.add(labelId);
  res.json({ success: true });
});

apiRouter.delete('/chats/:id/labels/:labelId', (req, res) => {
  const { id: chatId, labelId } = req.params;
  const set = store.chatLabels.get(chatId);
  if (set) {
    set.delete(labelId);
  }
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
  res.json(status);
});

// View Status
apiRouter.post('/status/:id/view', (req, res) => {
  const statusId = req.params.id;
  const { viewerId } = req.body;
  const status = store.statuses.get(statusId);
  if (status && viewerId && !status.viewers.includes(viewerId)) {
    status.viewers.push(viewerId);
  }
  res.json({ success: true });
});
