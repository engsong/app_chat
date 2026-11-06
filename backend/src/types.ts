export interface UserData {
  id: string;
  phone: string;
  password?: string;
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
  lastSeen: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageData {
  id: string;
  chatId: string;
  senderId: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'product' | 'call';
  content: string;
  mediaUrl?: string;
  metadata?: string;
  status: 'sent' | 'delivered' | 'read';
  createdAt: Date;
  deletedForUserIds?: string[];
  isDeletedForEveryone?: boolean;
  deletedBy?: string;
  deletedAt?: Date;
}

export interface ChatData {
  id: string;
  isGroup: boolean;
  name?: string;
  avatar?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
  memberIds: string[];
  hiddenForUserIds?: string[];
}

export interface CallData {
  id: string;
  chatId?: string;
  callerId: string;
  receiverId?: string;
  isGroup: boolean;
  type: 'voice' | 'video';
  status: 'ringing' | 'connected' | 'completed' | 'missed' | 'declined';
  startedAt: Date;
  endedAt?: Date;
  duration?: number;
}
