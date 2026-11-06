import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { UserData, MessageData, ChatData, CallData } from './types.js';

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

export const normalizePhone = (p?: string | null): string => {
  if (!p) return '';
  return p.replace(/\D/g, '');
};

export const isPhoneMatch = (phone1?: string | null, phone2?: string | null): boolean => {
  const n1 = normalizePhone(phone1);
  const n2 = normalizePhone(phone2);
  if (!n1 || !n2) return false;
  if (n1 === n2) return true;
  // Match by minimum common suffix (e.g. 02054245616 and 54245616 or +8562054245616)
  const minLen = Math.min(n1.length, n2.length);
  if (minLen >= 7) {
    return n1.slice(-minLen) === n2.slice(-minLen);
  }
  return false;
};

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
  public userContacts: Map<string, Set<string>> = new Map(); // userId -> Set<contactUserId>
  public pushSubscriptions: Map<string, Array<any>> = new Map(); // userId -> PushSubscription[]

  constructor() {
    if (!this.loadFromFile()) {
      this.seedInitialData();
      this.saveToFile();
    }
  }

  public saveToFile() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const data = {
        users: Array.from(this.users.entries()),
        chats: Array.from(this.chats.entries()),
        messages: Array.from(this.messages.entries()),
        products: Array.from(this.products.entries()),
        quickReplies: Array.from(this.quickReplies.entries()),
        labels: Array.from(this.labels.entries()),
        chatLabels: Array.from(this.chatLabels.entries()).map(([k, set]) => [k, Array.from(set)]),
        statuses: Array.from(this.statuses.entries()),
        calls: Array.from(this.calls.entries()),
        userContacts: Array.from(this.userContacts.entries()).map(([k, set]) => [k, Array.from(set)]),
        pushSubscriptions: Array.from(this.pushSubscriptions.entries()),
      };
      fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error('[Store] Failed to save store to file:', err);
    }
  }

  public loadFromFile(): boolean {
    try {
      if (!fs.existsSync(STORE_FILE)) return false;
      const raw = fs.readFileSync(STORE_FILE, 'utf8');
      const data = JSON.parse(raw);

      if (!data.users || data.users.length === 0) return false;

      this.users = new Map(
        data.users.map(([k, v]: [string, any]) => {
          const isAdmin = isPhoneMatch(v.phone, '02054245616') || v.phone?.toLowerCase() === 'admin' || v.role === 'admin';
          return [
            k,
            {
              ...v,
              role: isAdmin ? 'admin' : (v.role || 'user'),
              status: isAdmin ? 'approved' : (v.status || (v.password ? 'approved' : 'pending')),
              createdAt: v.createdAt ? new Date(v.createdAt) : new Date(),
              updatedAt: v.updatedAt ? new Date(v.updatedAt) : new Date(),
              lastSeen: v.lastSeen ? new Date(v.lastSeen) : new Date(),
            },
          ];
        })
      );

      this.chats = new Map(
        data.chats.map(([k, v]: [string, any]) => [
          k,
          {
            ...v,
            createdAt: v.createdAt ? new Date(v.createdAt) : new Date(),
            updatedAt: v.updatedAt ? new Date(v.updatedAt) : new Date(),
            lastMessageAt: v.lastMessageAt ? new Date(v.lastMessageAt) : new Date(),
          },
        ])
      );

      this.messages = new Map(
        data.messages.map(([k, v]: [string, any]) => [
          k,
          {
            ...v,
            createdAt: v.createdAt ? new Date(v.createdAt) : new Date(),
          },
        ])
      );

      this.products = new Map(
        (data.products || []).map(([k, v]: [string, any]) => [
          k,
          { ...v, createdAt: v.createdAt ? new Date(v.createdAt) : new Date() },
        ])
      );

      this.quickReplies = new Map(
        (data.quickReplies || []).map(([k, v]: [string, any]) => [
          k,
          { ...v, createdAt: v.createdAt ? new Date(v.createdAt) : new Date() },
        ])
      );

      this.labels = new Map(
        (data.labels || []).map(([k, v]: [string, any]) => [
          k,
          { ...v, createdAt: v.createdAt ? new Date(v.createdAt) : new Date() },
        ])
      );

      this.chatLabels = new Map(
        (data.chatLabels || []).map(([k, arr]: [string, string[]]) => [k, new Set(arr)])
      );

      this.statuses = new Map(
        (data.statuses || []).map(([k, v]: [string, any]) => [
          k,
          {
            ...v,
            createdAt: v.createdAt ? new Date(v.createdAt) : new Date(),
            expiresAt: v.expiresAt ? new Date(v.expiresAt) : new Date(),
          },
        ])
      );

      this.userContacts = new Map(
        (data.userContacts || []).map(([k, arr]: [string, string[]]) => [k, new Set(arr)])
      );

      this.calls = new Map(
        (data.calls || []).map(([k, v]: [string, any]) => [
          k,
          {
            ...v,
            startedAt: v.startedAt ? new Date(v.startedAt) : new Date(),
            endedAt: v.endedAt ? new Date(v.endedAt) : undefined,
          },
        ])
      );

      this.pushSubscriptions = new Map(data.pushSubscriptions || []);

      // Clean up legacy demo accounts
      const demoIds = ['usr-biz-1', 'usr-client-2', 'usr-client-3', 'usr-biz-4'];
      demoIds.forEach((dId) => {
        this.users.delete(dId);
        this.userContacts.delete(dId);
      });

      // Remove demo chats
      for (const [cId, chat] of Array.from(this.chats.entries())) {
        if (cId === 'chat-1' || cId === 'chat-group-1') {
          this.chats.delete(cId);
          continue;
        }
        // Remove chats that contain only demo ids
        chat.memberIds = chat.memberIds.filter((m) => !demoIds.includes(m));
        if (chat.memberIds.length === 0) {
          this.chats.delete(cId);
        }
      }

      // Remove demo messages
      for (const [mId, msg] of Array.from(this.messages.entries())) {
        if (demoIds.includes(msg.senderId) || msg.chatId === 'chat-1' || msg.chatId === 'chat-group-1') {
          this.messages.delete(mId);
        }
      }

      // Clean up user contacts references to demo ids
      for (const [uId, contacts] of this.userContacts.entries()) {
        demoIds.forEach((dId) => contacts.delete(dId));
      }

      // Consolidate duplicate phone accounts (e.g. dummy contact stub vs real registered user)
      this.consolidateUsers();

      console.log(`[Store] Loaded persistent store: ${this.users.size} users, ${this.chats.size} chats, ${this.messages.size} messages.`);
      return true;
    } catch (err) {
      console.error('[Store] Failed to load store from file:', err);
      return false;
    }
  }

  public consolidateUsers() {
    const allUsers = Array.from(this.users.values());
    const processedPhones = new Set<string>();

    for (const u of allUsers) {
      const norm = normalizePhone(u.phone);
      if (!norm || processedPhones.has(norm)) continue;

      // Find all user records matching this phone
      const matchingUsers = allUsers.filter((cand) => isPhoneMatch(cand.phone, u.phone));
      if (matchingUsers.length > 1) {
        // Find the registered user (one with a password or non-generated name)
        const primaryUser = matchingUsers.find((m) => Boolean(m.password)) || matchingUsers[0];
        const secondaryUsers = matchingUsers.filter((m) => m.id !== primaryUser.id);

        for (const sec of secondaryUsers) {
          console.log(`[Store] Merging duplicate user ${sec.id} (${sec.phone}) into primary user ${primaryUser.id} (${primaryUser.name})`);

          // 1. Update chats memberIds
          for (const [_, chat] of this.chats.entries()) {
            if (chat.memberIds.includes(sec.id)) {
              chat.memberIds = Array.from(new Set(chat.memberIds.map((m) => (m === sec.id ? primaryUser.id : m))));
            }
          }

          // 2. Update messages senderId
          for (const [_, msg] of this.messages.entries()) {
            if (msg.senderId === sec.id) {
              msg.senderId = primaryUser.id;
            }
          }

          // 3. Update userContacts
          const secContacts = this.userContacts.get(sec.id);
          if (secContacts) {
            if (!this.userContacts.has(primaryUser.id)) {
              this.userContacts.set(primaryUser.id, new Set());
            }
            const primSet = this.userContacts.get(primaryUser.id)!;
            secContacts.forEach((c) => {
              if (c !== primaryUser.id) primSet.add(c);
            });
            this.userContacts.delete(sec.id);
          }

          for (const [_, cSet] of this.userContacts.entries()) {
            if (cSet.has(sec.id)) {
              cSet.delete(sec.id);
              cSet.add(primaryUser.id);
            }
          }

          // 4. Remove secondary user
          this.users.delete(sec.id);
        }
      }

      processedPhones.add(norm);
    }

    // Clean up any test accounts with phone starting with usr-
    for (const [uId, u] of Array.from(this.users.entries())) {
      if (u.phone.startsWith('usr-') || u.name.startsWith('usr-')) {
        this.users.delete(uId);
        this.userContacts.delete(uId);
      } else if (isPhoneMatch(u.phone, '02054245616') || u.phone?.toLowerCase() === 'admin') {
        // Ensure Engsong's name is set properly and is admin
        if (u.name === '02054245616') {
          u.name = 'Engsong';
        }
        u.about = 'Hey there! I am using IChat.';
        u.role = 'admin';
        u.status = 'approved';
      }
    }

    // Resolve memberIds in chats and prune ghost chats
    for (const [cId, chat] of Array.from(this.chats.entries())) {
      chat.memberIds = chat.memberIds.map((mId) => {
        if (this.users.has(mId)) return mId;
        const byPhone = Array.from(this.users.values()).find((u) => u.phone === mId || isPhoneMatch(u.phone, mId));
        if (byPhone) return byPhone.id;
        return mId;
      });

      // Keep only members that exist in users
      chat.memberIds = chat.memberIds.filter((mId) => this.users.has(mId));
      if (chat.memberIds.length === 0) {
        this.chats.delete(cId);
      }
    }

    // Prune messages for deleted chats or unknown senders
    for (const [mId, msg] of Array.from(this.messages.entries())) {
      if (!this.chats.has(msg.chatId) || !this.users.has(msg.senderId)) {
        this.messages.delete(mId);
      }
    }

    this.saveToFile();
  }

  private seedInitialData() {
    // Fresh store starts clean with no demo users
    console.log('[Store] Fresh store initialized.');
  }
}

export const store = new InMemoryStore();
