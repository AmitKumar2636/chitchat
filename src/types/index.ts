// TypeScript interfaces for the application

export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date | number;
  isOnline?: boolean;
  lastSeen?: Date | number;
}

export interface Chat {
  id: string;
  participants: Record<string, boolean>; // { odId1: true, odId2: true } for RTDB rules
  participantNames?: Record<string, string>; // { odId1: "Name1", odId2: "Name2" }
  lastMessage: string;
  lastMessageSenderId?: string; // ID of user who sent the last message
  updatedAt: Date | number;
  typing?: Record<string, boolean>; // { odId: true/false }
}

export interface Message {
  id: string;
  senderId: string;
  senderName?: string;
  text: string;
  timestamp: Date | number;
}
