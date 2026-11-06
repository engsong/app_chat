export interface User {
  id: string;
  phone: string;
  name: string;
  email?: string;
  avatar?: string;
  about: string;
  role?: 'admin' | 'user';
  status?: 'approved' | 'pending' | 'rejected';
  isBusiness: boolean;
  businessName?: string;
  businessCategory?: string;
  businessDescription?: string;
  businessAddress?: string;
  businessHours?: string;
  businessWebsite?: string;
  isOnline: boolean;
  lastSeen: string;
  createdAt?: string;
}

export interface ChatMember {
  id: string;
  chatId: string;
  userId: string;
  role: 'admin' | 'member';
  user: User;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'product';
  content: string;
  mediaUrl?: string;
  metadata?: string; // JSON with audio duration, file size, or product info
  status: 'sent' | 'delivered' | 'read';
  createdAt: string;
  sender?: User;
}

export interface Chat {
  id: string;
  isGroup: boolean;
  name?: string;
  avatar?: string;
  description?: string;
  lastMessageAt: string;
  memberIds?: string[];
  members: ChatMember[];
  lastMessage?: Message;
  unreadCount?: number;
  labels?: Label[];
}

export interface CallParticipant {
  id: string;
  callId: string;
  userId: string;
  user?: User;
}

export interface Call {
  id: string;
  chatId?: string;
  callerId: string;
  receiverId?: string;
  isGroup: boolean;
  type: 'voice' | 'video';
  status: 'ringing' | 'connected' | 'completed' | 'missed' | 'declined';
  startedAt: string;
  endedAt?: string;
  duration?: number;
  caller?: User;
  receiver?: User;
}

export interface Product {
  id: string;
  userId: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  imageUrl?: string;
  isAvailable: boolean;
  createdAt: string;
}

export interface QuickReply {
  id: string;
  userId: string;
  shortcut: string;
  message: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface StatusItem {
  id: string;
  userId: string;
  type: 'text' | 'image' | 'video';
  mediaUrl?: string;
  caption?: string;
  backgroundColor?: string;
  createdAt: string;
  expiresAt: string;
  user?: User;
  viewsCount?: number;
}
