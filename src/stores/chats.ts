// Chats store - reactive state for chat list and messages
// Wrapped in createRoot to ensure proper signal disposal
import { createSignal, createRoot } from 'solid-js';
import type { Chat, Message, User } from '../types';
import {
  subscribeToChats,
  subscribeToMessages,
  subscribeToUserPresence,
} from '../services/messages';
import { initNotifications, notifyNewMessage, notifyUserOnline } from '../services/notifications';

// Create signals within a root to ensure proper lifecycle management
const store = createRoot(() => {
  const [chats, setChats] = createSignal<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = createSignal<string | null>(null);
  const [currentChat, setCurrentChat] = createSignal<Chat | null>(null);
  const [messages, setMessages] = createSignal<Message[]>([]);
  const [loadingChats, setLoadingChats] = createSignal(false);
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
    loadingChats,
    setLoadingChats,
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
  loadingChats,
  setLoadingChats,
  loadingMessages,
  setLoadingMessages,
  otherUserPresence,
  setOtherUserPresence,
} = store;

let chatsUnsubscribe: (() => void) | null = null;
let messagesUnsubscribe: (() => void) | null = null;
let presenceUnsubscribes: Map<string, () => void> = new Map();
let currentUserId: string | null = null;
let isInitialMessageLoad = true;
let lastMessageCount = 0;

// Subscribe to user's chat list
export async function initChatsListener(userId: string) {
  cleanupChatsListener();
  setLoadingChats(true);
  currentUserId = userId;

  // Initialize notifications when user logs in
  await initNotifications();

  chatsUnsubscribe = subscribeToChats(userId, (newChats) => {
    setChats(newChats);
    setLoadingChats(false);

    // Update current chat if selected
    const currentId = currentChatId();
    if (currentId) {
      const updated = newChats.find((c) => c.id === currentId);
      if (updated) setCurrentChat(updated);
    }

    // Subscribe to presence for all other users in chats
    updatePresenceSubscriptions(newChats, userId);
  });
}

// Subscribe to presence for other users in chats
function updatePresenceSubscriptions(chatList: Chat[], currentUserIdParam: string) {
  const otherUserIds = new Set<string>();

  chatList.forEach((chat) => {
    chat.participants.forEach((id) => {
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
    }
  });

  // Subscribe to new users
  otherUserIds.forEach((odId) => {
    if (!presenceUnsubscribes.has(odId)) {
      const unsub = subscribeToUserPresence(odId, (user) => {
        if (user) {
          // Check if user just came online (was offline before)
          const prevUser = otherUserPresence()[odId];
          if (prevUser && !prevUser.isOnline && user.isOnline) {
            // User just came online - notify
            notifyUserOnline(user.displayName || user.email || 'A contact');
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
  setOtherUserPresence({});
}

// Subscribe to messages in a specific chat
export function selectChat(chatId: string) {
  cleanupMessagesListener();
  setCurrentChatId(chatId);
  setLoadingMessages(true);
  isInitialMessageLoad = true;
  lastMessageCount = 0;

  // Set current chat
  const chat = chats().find((c) => c.id === chatId);
  setCurrentChat(chat || null);

  messagesUnsubscribe = subscribeToMessages(chatId, (newMessages) => {
    // Check for new messages from others (not from the current user)
    if (!isInitialMessageLoad && newMessages.length > lastMessageCount) {
      // Get the new messages
      const newOnes = newMessages.slice(lastMessageCount);

      // Notify for messages not sent by current user (only when window is not focused)
      if (document.hidden) {
        newOnes.forEach((msg) => {
          if (msg.senderId !== currentUserId) {
            notifyNewMessage(msg.senderName || 'Someone', msg.text);
          }
        });
      }
    }

    lastMessageCount = newMessages.length;
    isInitialMessageLoad = false;
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
  loadingChats,
  loadingMessages,
  otherUserPresence,
};
