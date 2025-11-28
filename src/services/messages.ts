// Messaging service for Firestore operations
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  where,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  limit,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Message, Chat, User } from '../types';

// Subscribe to messages in a chat (real-time)
export function subscribeToMessages(
  chatId: string,
  callback: (messages: Message[]) => void
): Unsubscribe {
  const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('timestamp', 'asc'));

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Message[];
    callback(messages);
  });
}

// Send a new message
export async function sendMessage(
  chatId: string,
  senderId: string,
  senderName: string,
  text: string
): Promise<string> {
  const messagesRef = collection(db, 'chats', chatId, 'messages');
  const docRef = await addDoc(messagesRef, {
    senderId,
    senderName,
    text,
    timestamp: serverTimestamp(),
  });

  // Update chat's last message and clear typing indicator
  await updateDoc(doc(db, 'chats', chatId), {
    lastMessage: text,
    updatedAt: serverTimestamp(),
    [`typing.${senderId}`]: false,
  });

  return docRef.id;
}

// Subscribe to user's chats (real-time)
export function subscribeToChats(userId: string, callback: (chats: Chat[]) => void): Unsubscribe {
  const q = query(
    collection(db, 'chats'),
    where('participants', 'array-contains', userId),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const chats = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Chat[];
    callback(chats);
  });
}

// Get user by ID
export async function getUserById(userId: string): Promise<User | null> {
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (!userDoc.exists()) {
    return null;
  }
  return { id: userDoc.id, ...userDoc.data() } as User;
}

// Create a new chat between two users
export async function createChat(
  userId1: string,
  userId2: string,
  userName1: string,
  userName2: string
): Promise<string> {
  // Check if chat already exists
  const q = query(collection(db, 'chats'), where('participants', 'array-contains', userId1));
  const snapshot = await getDocs(q);

  for (const doc of snapshot.docs) {
    const participants = doc.data().participants as string[];
    if (participants.includes(userId2)) {
      return doc.id; // Chat already exists
    }
  }

  // Create new chat with participant names
  const chatRef = await addDoc(collection(db, 'chats'), {
    participants: [userId1, userId2],
    participantNames: {
      [userId1]: userName1,
      [userId2]: userName2,
    },
    lastMessage: '',
    updatedAt: serverTimestamp(),
    typing: {},
  });

  return chatRef.id;
}

// Find user by email
export async function findUserByEmail(email: string): Promise<User | null> {
  const q = query(collection(db, 'users'), where('email', '==', email), limit(1));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  const docSnap = snapshot.docs[0];
  return { id: docSnap.id, ...docSnap.data() } as User;
}

// Update typing status
export async function setTypingStatus(
  chatId: string,
  odId: string,
  isTyping: boolean
): Promise<void> {
  await updateDoc(doc(db, 'chats', chatId), {
    [`typing.${odId}`]: isTyping,
  });
}

// Update user presence (online/offline)
export async function updateUserPresence(userId: string, isOnline: boolean): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', userId), {
      isOnline,
      lastSeen: serverTimestamp(),
    });
  } catch (error) {
    // If doc doesn't exist, the update will fail - log but don't throw
    console.error('Failed to update presence:', error);
  }
}

// Subscribe to a user's presence
export function subscribeToUserPresence(
  odId: string,
  callback: (user: User | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, 'users', odId), (snapshot) => {
    if (snapshot.exists()) {
      callback({ id: snapshot.id, ...snapshot.data() } as User);
    } else {
      callback(null);
    }
  });
}
