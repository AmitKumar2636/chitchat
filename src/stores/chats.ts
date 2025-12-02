// Chats store - reactive state for chat list and messages
// Wrapped in createRoot to ensure proper signal disposal
import { createSignal, createRoot } from 'solid-js';
import type { Chat, Message, User } from '../types';

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

import {
  subscribeToChats,
  subscribeToMessages,
  subscribeToUserPresence,
} from '../services/messages';
import { playMessageReceived } from '../services/sounds';
import {
  initNotifications,
  notifyNewMessage,
  notifyUserOnline,
  notifyUserOffline,
  resetNotifications,
} from '../services/notifications';

// Create signals within a root to ensure proper lifecycle management
const store = createRoot(() => {
  const [chats, setChats] = createSignal<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = createSignal<string | null>(null);
  const [currentChat, setCurrentChat] = createSignal<Chat | null>(null);
  const [messages, setMessages] = createSignal<Message[]>([]);
  const [connectionState, setConnectionState] = createSignal<ConnectionState>('idle');
  const [loadingMessages, setLoadingMessages] = createSignal(false);
  const [otherUserPresence, setOtherUserPresence] = createSignal<Record<string, User>>({});

  return {
    chats,
    setChats,
    currentChatId,
    setCurrentChatId,
    currentChat,
    setCurrentChat,
    messages,
    setMessages,
    connectionState,
    setConnectionState,
    loadingMessages,
    setLoadingMessages,
    otherUserPresence,
    setOtherUserPresence,
  };
});

// Destructure for use in this module
const {
  chats,
  setChats,
  currentChatId,
  setCurrentChatId,
  currentChat,
  setCurrentChat,
  messages,
  setMessages,
  connectionState,
  setConnectionState,
  loadingMessages,
  setLoadingMessages,
  otherUserPresence,
  setOtherUserPresence,
} = store;

let chatsUnsubscribe: (() => void) | null = null;
let messagesUnsubscribe: (() => void) | null = null;
let presenceUnsubscribes: Map<string, () => void> = new Map();
let loggedInUserId: string | null = null;

// Track notified messages and chat states to avoid duplicate notifications
let notifiedMessageTimestamps: Map<string, number> = new Map(); // chatId -> lastNotifiedTimestamp
let isInitialChatsLoad = true;

// Track presence initialization state per user
let presenceInitialStates: Set<string> = new Set(); // Set of userIds that have been loaded initially

// Subscribe to user's chat list
export async function initChatsListener(userId: string) {
  cleanupChatsListener();
  setConnectionState('connecting');
  loggedInUserId = userId;
  isInitialChatsLoad = true;
  notifiedMessageTimestamps.clear();
  presenceInitialStates.clear();

  // Initialize notifications when user logs in
  await initNotifications();

  chatsUnsubscribe = subscribeToChats(
    userId,
    (newChats) => {
      // On initial load, just record the current timestamps - don't notify
      if (isInitialChatsLoad) {
        newChats.forEach((chat) => {
          const timestamp = typeof chat.updatedAt === 'number' ? chat.updatedAt : Date.now();
          notifiedMessageTimestamps.set(chat.id, timestamp);
        });
        isInitialChatsLoad = false;
        setChats(newChats);
        setConnectionState('connected');

        // Update current chat if selected
        const currentId = currentChatId();
        if (currentId) {
          const updated = newChats.find((c) => c.id === currentId);
          if (updated) setCurrentChat(updated);
        }

        // Subscribe to presence for all other users in chats
        updatePresenceSubscriptions(newChats, userId);
        return;
      }

      // Not initial load - check for new messages
      newChats.forEach((chat) => {
        const chatTimestamp = typeof chat.updatedAt === 'number' ? chat.updatedAt : 0;
        const lastNotifiedTimestamp = notifiedMessageTimestamps.get(chat.id) || 0;

        // Only notify if:
        // 1. The chat timestamp is newer than what we last notified
        // 2. We know who sent it (lastMessageSenderId is defined)
        // 3. It's not from the current user
        // 4. Not viewing this chat with window visible
        const isNewerMessage = chatTimestamp > lastNotifiedTimestamp;
        const hasSenderId =
          chat.lastMessageSenderId !== undefined && chat.lastMessageSenderId !== null;
        const isFromOther = chat.lastMessageSenderId !== loggedInUserId;
        const isViewingChat =
          chat.id === currentChatId() && !document.hidden && document.hasFocus();

        if (isNewerMessage && hasSenderId && isFromOther && !isViewingChat && chat.lastMessage) {
          const senderId = chat.lastMessageSenderId;
          const senderName = senderId
            ? chat.participantNames?.[senderId] ||
            otherUserPresence()[senderId]?.displayName ||
            otherUserPresence()[senderId]?.email ||
            'Someone'
            : 'Someone';

          notifyNewMessage(chat.id, senderName, chat.lastMessage);

          // Update the last notified timestamp for this chat
          notifiedMessageTimestamps.set(chat.id, chatTimestamp);

          // Play sound for new message
          playMessageReceived();
        } else if (isNewerMessage) {
          // Still update the timestamp even if we didn't notify (e.g., own message or viewing chat)
          notifiedMessageTimestamps.set(chat.id, chatTimestamp);

          // Also play sound if we're viewing the chat but it's from someone else
          if (isViewingChat && isFromOther) {
            playMessageReceived();
          }
        }
      });

      setChats(newChats);
      setConnectionState('connected');

      // Update current chat if selected
      const currentId = currentChatId();
      if (currentId) {
        const updated = newChats.find((c) => c.id === currentId);
        if (updated) setCurrentChat(updated);
      }

      // Subscribe to presence for all other users in chats
      updatePresenceSubscriptions(newChats, userId);
    },
    (error) => {
      console.error('Failed to subscribe to chats:', error);
      setConnectionState('error');
    }
  );
}

// Subscribe to presence for other users in chats
function updatePresenceSubscriptions(chatList: Chat[], currentUserIdParam: string) {
  const otherUserIds = new Set<string>();

  chatList.forEach((chat) => {
    // participants is now an object { odId: true, odId2: true }
    const participantIds = Object.keys(chat.participants || {});
    participantIds.forEach((id) => {
      if (id !== currentUserIdParam) {
        otherUserIds.add(id);
      }
    });
  });

  // Unsubscribe from users no longer in chats
  presenceUnsubscribes.forEach((unsub, odId) => {
    if (!otherUserIds.has(odId)) {
      unsub();
      presenceUnsubscribes.delete(odId);
      presenceInitialStates.delete(odId);
    }
  });

  // Subscribe to new users
  otherUserIds.forEach((odId) => {
    if (!presenceUnsubscribes.has(odId)) {
      const unsub = subscribeToUserPresence(odId, (user) => {
        if (user) {
          const prevPresence = otherUserPresence();
          const prevUser = prevPresence[odId];
          const userName = user.displayName || user.email || 'A contact';

          // Check if this is the initial load for this user
          const isInitialLoad = !presenceInitialStates.has(odId);

          if (isInitialLoad) {
            // First time seeing this user - just store state, don't notify
            presenceInitialStates.add(odId);
          } else if (prevUser !== undefined) {
            // We have previous state - check for changes
            const wasOnline = prevUser.isOnline === true;
            const isNowOnline = user.isOnline === true;

            // Check if user just came online (was offline before)
            if (!wasOnline && isNowOnline) {
              notifyUserOnline(userName);
            }

            // Check if user just went offline (was online before)
            if (wasOnline && !isNowOnline) {
              notifyUserOffline(userName);
            }
          }

          setOtherUserPresence((prev) => ({ ...prev, [odId]: user }));
        }
      });
      presenceUnsubscribes.set(odId, unsub);
    }
  });
}

export function cleanupChatsListener() {
  if (chatsUnsubscribe) {
    chatsUnsubscribe();
    chatsUnsubscribe = null;
  }
  // Cleanup presence subscriptions
  presenceUnsubscribes.forEach((unsub) => unsub());
  presenceUnsubscribes.clear();
  presenceInitialStates.clear();
  setOtherUserPresence({});
  loggedInUserId = null;
  isInitialChatsLoad = true;
  notifiedMessageTimestamps.clear();
  // Reset notification state so it re-initializes on next login
  resetNotifications();
}

// Subscribe to messages in a specific chat
export function selectChat(chatId: string) {
  cleanupMessagesListener();
  setCurrentChatId(chatId);
  setLoadingMessages(true);

  // Set current chat
  const chat = chats().find((c) => c.id === chatId);
  setCurrentChat(chat || null);

  messagesUnsubscribe = subscribeToMessages(chatId, (newMessages) => {
    setMessages(newMessages);
    setLoadingMessages(false);
  });
}

export function cleanupMessagesListener() {
  if (messagesUnsubscribe) {
    messagesUnsubscribe();
    messagesUnsubscribe = null;
  }
  setMessages([]);
}

export function clearCurrentChat() {
  cleanupMessagesListener();
  setCurrentChatId(null);
  setCurrentChat(null);
}

export {
  chats,
  currentChatId,
  currentChat,
  messages,
  connectionState,
  loadingMessages,
  otherUserPresence,
  derivedContacts,
};

import { createMemo } from 'solid-js';
import { user } from './auth';
import type { Contact } from '../types';

// Derived unique contacts from existing chats
const derivedContacts = createMemo(() => {
  const currentUser = user();
  const allChats = chats();
  const contactsMap = new Map<string, Contact>();

  if (!currentUser) return [];

  allChats.forEach((chat) => {
    if (!chat.isGroup && chat.participants) {
      const otherId = Object.keys(chat.participants).find((id) => id !== currentUser.uid);
      if (otherId && chat.participantNames?.[otherId]) {
        contactsMap.set(otherId, {
          id: otherId,
          displayName: chat.participantNames[otherId],
          email: '', // Email might not be available in chat metadata
          photoURL: null,
        });
      }
    }
  });

  return Array.from(contactsMap.values());
});
