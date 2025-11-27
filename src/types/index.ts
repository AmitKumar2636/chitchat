// TypeScript interfaces for the application

export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
  isOnline?: boolean;
  lastSeen?: Date;
}

export interface Chat {
  id: string;
  participants: string[];
  participantNames?: Record<string, string>; // { odId1: "Name1", odId2: "Name2" }
  lastMessage: string;
  updatedAt: Date;
  typing?: Record<string, boolean>; // { odId: true/false }
}

export interface Message {
  id: string;
  senderId: string;
  senderName?: string;
  text: string;
  timestamp: Date;
}
