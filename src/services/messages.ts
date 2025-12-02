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
      // Sort by timestamp (RTDB doesn't guarantee order)
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
export function subscribeToChats(
  userId: string,
  callback: (chats: Chat[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
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
      if (onError) onError(error);
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

/**
 * Creates a new group chat with multiple participants.
 *
 * @param participants - Array of objects containing participant ID and name
 * @param groupName - The name of the group chat
 * @returns Promise resolving to the new chat ID
 */
export async function createGroupChat(
  participants: { id: string; name: string }[],
  groupName: string
): Promise<string> {
  const chatsRef = ref(db, 'chats');
  const newChatRef = push(chatsRef);
  const chatId = newChatRef.key!;

  const participantsMap: Record<string, boolean> = {};
  const participantNamesMap: Record<string, string> = {};

  // Assume the first participant is the creator/owner (usually passed as first in NewChatDialog)
  // Or we should pass ownerId explicitly.
  // In NewChatDialog.tsx:
  // const participants = [
  //   { id: currentUser.uid, name: currentUserName },
  //   ...contacts.map(...)
  // ];
  // So participants[0] is the creator.
  const ownerId = participants[0]?.id;

  participants.forEach((p) => {
    participantsMap[p.id] = true;
    participantNamesMap[p.id] = p.name;
  });

  await set(newChatRef, {
    participants: participantsMap,
    participantNames: participantNamesMap,
    isGroup: true,
    groupName: groupName,
    ownerId: ownerId,
    lastMessage: 'Group created',
    updatedAt: serverTimestamp(),
    typing: {},
  });

  // Add chat to all users' userChats index
  const updates: Record<string, boolean> = {};
  participants.forEach((p) => {
    updates[`userChats/${p.id}/${chatId}`] = true;
  });
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
 * Initialize user presence system using Firebase's .info/connected.
 *
 * This sets up a listener on .info/connected which:
 * - Fires with `true` when connected to Firebase servers
 * - Fires with `false` when disconnected
 * - Automatically re-registers onDisconnect on reconnection
 *
 * Call this ONCE when user logs in. Firebase handles everything else:
 * - App crash → onDisconnect fires → user goes offline
 * - Network loss → onDisconnect fires → user goes offline
 * - Reconnect → listener re-fires → onDisconnect re-registered → user goes online
 */
export function initUserPresence(userId: string): void {
  // Clean up any existing listener
  if (presenceCleanup) {
    presenceCleanup();
    presenceCleanup = null;
  }

  const userRef = ref(db, `users/${userId}`);
  const connectedRef = ref(db, '.info/connected');

  const unsubscribe = onValue(connectedRef, (snapshot) => {
    if (snapshot.val() === false) {
      // Not connected to Firebase - do nothing, onDisconnect will handle it
      return;
    }

    // Connected! Set up onDisconnect FIRST, then set online
    onDisconnect(userRef)
      .update({
        isOnline: false,
        lastSeen: serverTimestamp(),
      })
      .then(() => {
        // Now set online
        return update(userRef, {
          isOnline: true,
          lastSeen: serverTimestamp(),
        });
      })
      .catch((error) => {
        console.error('Failed to set presence:', error);
      });
  });

  presenceCleanup = unsubscribe;
}

/**
 * Cleanup presence system and set user offline.
 * Call this when user explicitly signs out.
 */
export async function cleanupUserPresence(userId: string): Promise<void> {
  // Stop listening to connection state
  if (presenceCleanup) {
    presenceCleanup();
    presenceCleanup = null;
  }

  try {
    const userRef = ref(db, `users/${userId}`);

    // Cancel onDisconnect and set offline manually
    await onDisconnect(userRef).cancel();
    await update(userRef, {
      isOnline: false,
      lastSeen: serverTimestamp(),
    });
  } catch (error) {
    console.error('Failed to cleanup presence:', error);
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

// Rename a group
export async function renameGroup(chatId: string, newName: string): Promise<void> {
  const chatRef = ref(db, `chats/${chatId}`);
  await update(chatRef, {
    groupName: newName,
  });
}

// Add a member to a group
export async function addGroupMember(
  chatId: string,
  memberId: string,
  memberName: string
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {};
  updates[`chats/${chatId}/participants/${memberId}`] = true;
  updates[`chats/${chatId}/participantNames/${memberId}`] = memberName;
  updates[`userChats/${memberId}/${chatId}`] = true;

  await update(ref(db), updates);
}

// Remove a member from a group (kick/ban or leave)
export async function removeGroupMember(chatId: string, memberId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {};
  updates[`chats/${chatId}/participants/${memberId}`] = null;
  updates[`chats/${chatId}/participantNames/${memberId}`] = null;
  updates[`userChats/${memberId}/${chatId}`] = null;

  await update(ref(db), updates);
}
