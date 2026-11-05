import { v4 as uuidv4 } from 'uuid';
import { UserData, MessageData, ChatData, CallData } from './types.js';

export interface ProductData {
  id: string;
  userId: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  imageUrl?: string;
  isAvailable: boolean;
  createdAt: Date;
}

export interface QuickReplyData {
  id: string;
  userId: string;
  shortcut: string;
  message: string;
  createdAt: Date;
}

export interface LabelData {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: Date;
}

export interface StatusData {
  id: string;
  userId: string;
  type: 'text' | 'image' | 'video';
  mediaUrl?: string;
  caption?: string;
  backgroundColor?: string;
  createdAt: Date;
  expiresAt: Date;
  viewers: string[]; // userIds
}

class InMemoryStore {
  public users: Map<string, UserData> = new Map();
  public chats: Map<string, ChatData> = new Map();
  public messages: Map<string, MessageData> = new Map();
  public products: Map<string, ProductData> = new Map();
  public quickReplies: Map<string, QuickReplyData> = new Map();
  public labels: Map<string, LabelData> = new Map();
  public chatLabels: Map<string, Set<string>> = new Map(); // chatId -> Set<labelId>
  public statuses: Map<string, StatusData> = new Map();
  public calls: Map<string, CallData> = new Map();

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    // Seed Demo Users (1 Business User + Multiple Client/Partner Users)
    const user1: UserData = {
      id: 'usr-biz-1',
      phone: '+1 800 555 0199',
      password: 'password123',
      name: 'Nexus Electronics',
      email: 'support@nexuselectronics.com',
      avatar: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=150',
      about: 'Premium Gadgets & Smart Office Solutions • Official Store',
      isBusiness: true,
      businessName: 'Nexus Electronics Official',
      businessCategory: 'Computers & Electronics',
      businessDescription: 'Providing next-generation laptops, smart accessories, and business audio headsets with 24/7 technical concierge.',
      businessAddress: '450 Innovation Way, Suite 800, Silicon Valley, CA',
      businessHours: 'Mon - Fri: 08:00 AM - 08:00 PM\nSat - Sun: 09:00 AM - 05:00 PM',
      businessWebsite: 'https://nexuselectronics.com',
      isOnline: true,
      lastSeen: new Date(),
      createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000),
      updatedAt: new Date(),
    };

    const user2: UserData = {
      id: 'usr-client-2',
      phone: '+1 415 555 2468',
      password: 'password123',
      name: 'Sarah Connor',
      email: 'sarah.c@cyberdyne.org',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      about: 'Design Lead at Horizon Labs',
      isBusiness: false,
      isOnline: true,
      lastSeen: new Date(),
      createdAt: new Date(Date.now() - 20 * 24 * 3600 * 1000),
      updatedAt: new Date(),
    };

    const user3: UserData = {
      id: 'usr-client-3',
      phone: '+1 212 555 7890',
      password: 'password123',
      name: 'David Miller',
      email: 'david@venturecap.co',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      about: 'Managing Director • Always reachable via audio/video call',
      isBusiness: false,
      isOnline: false,
      lastSeen: new Date(Date.now() - 15 * 60 * 1000),
      createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000),
      updatedAt: new Date(),
    };

    const user4: UserData = {
      id: 'usr-biz-4',
      phone: '+1 650 555 9922',
      password: 'password123',
      name: 'Artisan Coffee Roasters',
      email: 'orders@artisancoffee.shop',
      avatar: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=150',
      about: 'Single origin specialty coffee roasted fresh daily ☕',
      isBusiness: true,
      businessName: 'Artisan Coffee Roasters',
      businessCategory: 'Food & Beverage',
      businessDescription: 'Direct-trade Ethiopian, Colombian & Costa Rican whole-bean coffee for offices and cafes.',
      businessAddress: '124 Market Square, Portland, OR',
      businessHours: 'Daily: 06:30 AM - 06:00 PM',
      businessWebsite: 'https://artisancoffee.shop',
      isOnline: true,
      lastSeen: new Date(),
      createdAt: new Date(Date.now() - 15 * 24 * 3600 * 1000),
      updatedAt: new Date(),
    };

    this.users.set(user1.id, user1);
    this.users.set(user2.id, user2);
    this.users.set(user3.id, user3);
    this.users.set(user4.id, user4);

    // Products for Nexus Electronics
    const prod1: ProductData = {
      id: 'prod-1',
      userId: user1.id,
      name: 'Ultra-Clear ANC Wireless Headset Pro',
      description: 'Active Noise Cancellation, 40h battery life, crystal clear voice mic with studio EQ.',
      price: 199.99,
      currency: 'USD',
      imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500',
      isAvailable: true,
      createdAt: new Date(),
    };

    const prod2: ProductData = {
      id: 'prod-2',
      userId: user1.id,
      name: '4K Ultra-Wide Conference Webcam',
      description: 'AI auto-framing, dual beamforming microphones, HDR 60fps streaming.',
      price: 149.00,
      currency: 'USD',
      imageUrl: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=500',
      isAvailable: true,
      createdAt: new Date(),
    };

    const prod3: ProductData = {
      id: 'prod-3',
      userId: user1.id,
      name: 'Ergonomic Mechanical Office Keyboard',
      description: 'Wireless Bluetooth 5.2 + 2.4Ghz, hot-swappable quiet switches, multi-device sync.',
      price: 119.50,
      currency: 'USD',
      imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500',
      isAvailable: true,
      createdAt: new Date(),
    };

    this.products.set(prod1.id, prod1);
    this.products.set(prod2.id, prod2);
    this.products.set(prod3.id, prod3);

    // Quick Replies for Nexus
    const qr1: QuickReplyData = {
      id: 'qr-1',
      userId: user1.id,
      shortcut: '/hours',
      message: 'Hello! Our business hours are Mon - Fri: 08:00 AM - 08:00 PM and Sat - Sun: 09:00 AM - 05:00 PM PST.',
      createdAt: new Date(),
    };

    const qr2: QuickReplyData = {
      id: 'qr-2',
      userId: user1.id,
      shortcut: '/shipping',
      message: 'We offer free express overnight delivery on all orders over $99! Tracking links are sent automatically via WhatsApp.',
      createdAt: new Date(),
    };

    const qr3: QuickReplyData = {
      id: 'qr-3',
      userId: user1.id,
      shortcut: '/thanks',
      message: 'Thank you for choosing Nexus Electronics! Let us know if you need any assistance with setup or warranty.',
      createdAt: new Date(),
    };

    this.quickReplies.set(qr1.id, qr1);
    this.quickReplies.set(qr2.id, qr2);
    this.quickReplies.set(qr3.id, qr3);

    // Labels
    const lbl1: LabelData = { id: 'lbl-1', userId: user1.id, name: 'New Customer', color: '#00a884', createdAt: new Date() };
    const lbl2: LabelData = { id: 'lbl-2', userId: user1.id, name: 'Pending Order', color: '#f59e0b', createdAt: new Date() };
    const lbl3: LabelData = { id: 'lbl-3', userId: user1.id, name: 'VIP Client', color: '#8b5cf6', createdAt: new Date() };
    const lbl4: LabelData = { id: 'lbl-4', userId: user1.id, name: 'Support Request', color: '#ef4444', createdAt: new Date() };

    this.labels.set(lbl1.id, lbl1);
    this.labels.set(lbl2.id, lbl2);
    this.labels.set(lbl3.id, lbl3);
    this.labels.set(lbl4.id, lbl4);

    // 1-on-1 Chat: Nexus Electronics <-> Sarah Connor
    const chat1: ChatData = {
      id: 'chat-1',
      isGroup: false,
      memberIds: [user1.id, user2.id],
      createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000),
      updatedAt: new Date(),
      lastMessageAt: new Date(Date.now() - 2 * 60 * 1000),
    };
    this.chats.set(chat1.id, chat1);
    this.chatLabels.set(chat1.id, new Set(['lbl-1', 'lbl-3']));

    // Messages for Chat 1
    const msg1: MessageData = {
      id: 'msg-1',
      chatId: chat1.id,
      senderId: user2.id,
      type: 'text',
      content: 'Hi! I saw your 4K Ultra-Wide Conference Webcam in your catalog. Does it support Mac and Windows out of the box?',
      status: 'read',
      createdAt: new Date(Date.now() - 30 * 60 * 1000),
    };

    const msg2: MessageData = {
      id: 'msg-2',
      chatId: chat1.id,
      senderId: user1.id,
      type: 'text',
      content: 'Hello Sarah! Yes, absolutely. It is 100% plug-and-play UVC compliant for macOS, Windows 11/10, and Linux. No extra drivers needed!',
      status: 'read',
      createdAt: new Date(Date.now() - 25 * 60 * 1000),
    };

    const msg3: MessageData = {
      id: 'msg-3',
      chatId: chat1.id,
      senderId: user1.id,
      type: 'product',
      content: 'Here is the direct product card for quick specs & ordering:',
      metadata: JSON.stringify(prod2),
      status: 'read',
      createdAt: new Date(Date.now() - 20 * 60 * 1000),
    };

    const msg4: MessageData = {
      id: 'msg-4',
      chatId: chat1.id,
      senderId: user2.id,
      type: 'text',
      content: 'Fantastic! Can we do a quick video call test to see the mic quality?',
      status: 'read',
      createdAt: new Date(Date.now() - 2 * 60 * 1000),
    };

    this.messages.set(msg1.id, msg1);
    this.messages.set(msg2.id, msg2);
    this.messages.set(msg3.id, msg3);
    this.messages.set(msg4.id, msg4);

    // Group Chat: "Product Launch & Dev Team"
    const groupChat: ChatData = {
      id: 'chat-group-1',
      isGroup: true,
      name: '🚀 Product Launch & Tech HQ',
      avatar: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150',
      description: 'Official collaboration group for business launches, live video conferences, and order dispatching.',
      memberIds: [user1.id, user2.id, user3.id, user4.id],
      createdAt: new Date(Date.now() - 7 * 24 * 3600 * 1000),
      updatedAt: new Date(),
      lastMessageAt: new Date(Date.now() - 10 * 60 * 1000),
    };
    this.chats.set(groupChat.id, groupChat);

    const gmsg1: MessageData = {
      id: 'gmsg-1',
      chatId: groupChat.id,
      senderId: user1.id,
      type: 'text',
      content: 'Welcome everyone! We have set up group voice and video calling right inside this channel for quick standups.',
      status: 'read',
      createdAt: new Date(Date.now() - 40 * 60 * 1000),
    };

    const gmsg2: MessageData = {
      id: 'gmsg-2',
      chatId: groupChat.id,
      senderId: user3.id,
      type: 'text',
      content: 'Awesome! Ready to test group video calling anytime.',
      status: 'read',
      createdAt: new Date(Date.now() - 10 * 60 * 1000),
    };

    this.messages.set(gmsg1.id, gmsg1);
    this.messages.set(gmsg2.id, gmsg2);

    // Status / Stories
    const status1: StatusData = {
      id: 'status-1',
      userId: user1.id,
      type: 'image',
      mediaUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800',
      caption: '🔥 New shipment of ANC Wireless Headsets just arrived! Order today for express dispatch.',
      createdAt: new Date(Date.now() - 2 * 3600 * 1000),
      expiresAt: new Date(Date.now() + 22 * 3600 * 1000),
      viewers: [user2.id],
    };

    const status2: StatusData = {
      id: 'status-2',
      userId: user4.id,
      type: 'text',
      caption: '☕ Fresh single-origin Ethiopian Yirgacheffe batch now roasting! Grab a cup.',
      backgroundColor: '#005c4b',
      createdAt: new Date(Date.now() - 5 * 3600 * 1000),
      expiresAt: new Date(Date.now() + 19 * 3600 * 1000),
      viewers: [],
    };

    this.statuses.set(status1.id, status1);
    this.statuses.set(status2.id, status2);
  }
}

export const store = new InMemoryStore();
