// Messaging service for Realtime Database operations
import {
  ref,
  onValue,
  push,
  set,
  update,
  get,
  query,
  orderByChild,
  equalTo,
  serverTimestamp,
  onDisconnect,
  type Unsubscribe,
} from 'firebase/database';
import { db } from './firebase';
import type { Message, Chat, User } from '../types';

// Subscribe to messages in a chat (real-time)
export function subscribeToMessages(
  chatId: string,
  callback: (messages: Message[]) => void
): Unsubscribe {
  const messagesRef = ref(db, `messages/${chatId}`);

  const unsubscribe = onValue(messagesRef, (snapshot) => {
    const messages: Message[] = [];
    if (snapshot.exists()) {
      snapshot.forEach((child) => {
        messages.push({
          id: child.key!,
          ...child.val(),
        });
      });
      // Sort by timestamp (RTDB doesn't guarantee order like Firestore)
      messages.sort((a, b) => {
        const timeA = typeof a.timestamp === 'number' ? a.timestamp : a.timestamp?.getTime?.() || 0;
        const timeB = typeof b.timestamp === 'number' ? b.timestamp : b.timestamp?.getTime?.() || 0;
        return timeA - timeB;
      });
    }
    callback(messages);
  });

  return unsubscribe;
}

// Send a new message
export async function sendMessage(
  chatId: string,
  senderId: string,
  senderName: string,
  text: string
): Promise<string> {
  // Messages are stored at /messages/{chatId}/ (separate from chat metadata)
  const messagesRef = ref(db, `messages/${chatId}`);
  const newMessageRef = push(messagesRef);

  await set(newMessageRef, {
    senderId,
    senderName,
    text,
    timestamp: serverTimestamp(),
  });

  // Update chat's last message, sender info, and clear typing indicator
  const chatRef = ref(db, `chats/${chatId}`);
  await update(chatRef, {
    lastMessage: text,
    lastMessageSenderId: senderId,
    updatedAt: serverTimestamp(),
    [`typing/${senderId}`]: false,
  });

  return newMessageRef.key!;
}

// Subscribe to user's chats using userChats index (real-time)
// This subscribes to the userChats/{odId} index, then subscribes to each individual chat
export function subscribeToChats(userId: string, callback: (chats: Chat[]) => void): Unsubscribe {
  const userChatsRef = ref(db, `userChats/${userId}`);
  const chatSubscriptions: Map<string, Unsubscribe> = new Map();
  const chatData: Map<string, Chat> = new Map();

  // Function to update and notify
  const notifyUpdate = () => {
    const chats = Array.from(chatData.values());
    // Sort by updatedAt descending
    chats.sort((a, b) => {
      const timeA = typeof a.updatedAt === 'number' ? a.updatedAt : a.updatedAt?.getTime?.() || 0;
      const timeB = typeof b.updatedAt === 'number' ? b.updatedAt : b.updatedAt?.getTime?.() || 0;
      return timeB - timeA;
    });
    callback(chats);
  };

  // Subscribe to userChats index
  const userChatsUnsubscribe = onValue(
    userChatsRef,
    (snapshot) => {
      const currentChatIds = new Set<string>();

      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          const chatId = child.key!;
          currentChatIds.add(chatId);

          // Subscribe to this chat if not already subscribed
          if (!chatSubscriptions.has(chatId)) {
            const chatRef = ref(db, `chats/${chatId}`);
            const chatUnsub = onValue(chatRef, (chatSnapshot) => {
              if (chatSnapshot.exists()) {
                chatData.set(chatId, {
                  id: chatId,
                  ...chatSnapshot.val(),
                });
              } else {
                chatData.delete(chatId);
              }
              notifyUpdate();
            });
            chatSubscriptions.set(chatId, chatUnsub);
          }
        });
      }

      // Unsubscribe from chats that were removed
      chatSubscriptions.forEach((unsub, chatId) => {
        if (!currentChatIds.has(chatId)) {
          unsub();
          chatSubscriptions.delete(chatId);
          chatData.delete(chatId);
        }
      });

      // If no chats, notify with empty array
      if (currentChatIds.size === 0) {
        notifyUpdate();
      }
    },
    (error) => {
      console.error('RTDB subscription error:', error);
    }
  );

  // Return cleanup function
  return () => {
    userChatsUnsubscribe();
    chatSubscriptions.forEach((unsub) => unsub());
    chatSubscriptions.clear();
    chatData.clear();
  };
}

// Get user by ID
export async function getUserById(userId: string): Promise<User | null> {
  const userRef = ref(db, `users/${userId}`);
  const snapshot = await get(userRef);

  if (!snapshot.exists()) {
    return null;
  }
  return { id: userId, ...snapshot.val() } as User;
}

// Create a new chat between two users
export async function createChat(
  userId1: string,
  userId2: string,
  userName1: string,
  userName2: string
): Promise<string> {
  // Check if chat already exists by checking user1's chats
  const userChatsRef = ref(db, `userChats/${userId1}`);
  const snapshot = await get(userChatsRef);

  if (snapshot.exists()) {
    // Check each chat to see if it includes both users
    const chatIds = Object.keys(snapshot.val());
    for (const chatId of chatIds) {
      const chatRef = ref(db, `chats/${chatId}`);
      const chatSnapshot = await get(chatRef);
      if (chatSnapshot.exists()) {
        const participants = chatSnapshot.val().participants || {};
        if (participants[userId2]) {
          return chatId; // Chat already exists
        }
      }
    }
  }

  // Create new chat with participants as object (for RTDB rules)
  const chatsRef = ref(db, 'chats');
  const newChatRef = push(chatsRef);
  const chatId = newChatRef.key!;

  await set(newChatRef, {
    participants: {
      [userId1]: true,
      [userId2]: true,
    },
    participantNames: {
      [userId1]: userName1,
      [userId2]: userName2,
    },
    lastMessage: '',
    updatedAt: serverTimestamp(),
    typing: {},
  });

  // Add chat to both users' userChats index
  const updates: Record<string, boolean> = {};
  updates[`userChats/${userId1}/${chatId}`] = true;
  updates[`userChats/${userId2}/${chatId}`] = true;
  await update(ref(db), updates);

  return chatId;
}

// Find user by email
export async function findUserByEmail(email: string): Promise<User | null> {
  const usersRef = ref(db, 'users');
  const q = query(usersRef, orderByChild('email'), equalTo(email));
  const snapshot = await get(q);

  if (!snapshot.exists()) {
    return null;
  }

  let user: User | null = null;
  snapshot.forEach((child) => {
    user = { id: child.key!, ...child.val() } as User;
  });
  return user;
}

// Update typing status
export async function setTypingStatus(
  chatId: string,
  odId: string,
  isTyping: boolean
): Promise<void> {
  const chatRef = ref(db, `chats/${chatId}`);
  await update(chatRef, {
    [`typing/${odId}`]: isTyping,
  });
}

// Track active presence listener cleanup function
let presenceCleanup: (() => void) | null = null;

/**
 * Update user presence (online/offline) with robust onDisconnect handling.
 * 
 * Uses Firebase's .info/connected to detect connection state and re-register
 * onDisconnect handlers whenever the connection is re-established.
 * This is the recommended approach by Firebase for presence systems.
 */
export async function updateUserPresence(userId: string, isOnline: boolean): Promise<void> {
  try {
    const userRef = ref(db, `users/${userId}`);

    if (isOnline) {
      // Clean up any existing presence listener
      if (presenceCleanup) {
        presenceCleanup();
        presenceCleanup = null;
      }

      // Subscribe to .info/connected to know when we're connected to Firebase
      const connectedRef = ref(db, '.info/connected');
      
      const unsubscribe = onValue(connectedRef, async (snapshot) => {
        // If we're not connected, don't do anything yet
        if (snapshot.val() === false) {
          return;
        }

        try {
          // We're connected (or reconnected)!
          // First, set up the onDisconnect handler BEFORE setting online status
          // This ensures the handler is registered even if we disconnect immediately after
          await onDisconnect(userRef).update({
            isOnline: false,
            lastSeen: serverTimestamp(),
          });

          // Now set the user as online
          await update(userRef, {
            isOnline: true,
            lastSeen: serverTimestamp(),
          });
        } catch (error) {
          console.error('Failed to set presence on connect:', error);
        }
      });

      // Store cleanup function
      presenceCleanup = unsubscribe;
    } else {
      // Going offline explicitly
      // Clean up the connection listener
      if (presenceCleanup) {
        presenceCleanup();
        presenceCleanup = null;
      }

      // Cancel any pending onDisconnect and set offline immediately
      await onDisconnect(userRef).cancel();
      await update(userRef, {
        isOnline: false,
        lastSeen: serverTimestamp(),
      });
    }
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
  const userRef = ref(db, `users/${odId}`);

  return onValue(userRef, (snapshot) => {
    if (snapshot.exists()) {
      callback({ id: odId, ...snapshot.val() } as User);
    } else {
      callback(null);
    }
  });
}
