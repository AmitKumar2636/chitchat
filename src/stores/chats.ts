// Chats store - reactive state for chat list and messages
// Wrapped in createRoot to ensure proper signal disposal
import { createSignal, createRoot } from 'solid-js';
import type { Chat, Message, User } from '../types';
import {
  subscribeToChats,
  subscribeToMessages,
  subscribeToUserPresence,
} from '../services/messages';
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
let loggedInUserId: string | null = null;

// Subscribe to user's chat list
export async function initChatsListener(userId: string) {
  cleanupChatsListener();
  setLoadingChats(true);
  loggedInUserId = userId;

  // Initialize notifications when user logs in
  await initNotifications();

  chatsUnsubscribe = subscribeToChats(userId, (newChats) => {
    const prevChats = chats(); // Current state before update

    // Check for new messages (only if we have previous state)
    if (prevChats.length > 0) {
      newChats.forEach((chat) => {
        const prevChat = prevChats.find((c) => c.id === chat.id);

        // Only notify if:
        // 1. We have a previous state for this chat
        // 2. The lastMessage actually changed
        // 3. We know who sent it (lastMessageSenderId is defined)
        // 4. It's not from the current user
        const messageChanged = prevChat && chat.lastMessage !== prevChat.lastMessage;
        const hasSenderId =
          chat.lastMessageSenderId !== undefined && chat.lastMessageSenderId !== null;
        const isFromOther = chat.lastMessageSenderId !== loggedInUserId;

        if (messageChanged && hasSenderId && isFromOther) {
          // Don't notify if viewing this chat with window visible
          if (chat.id === currentChatId() && !document.hidden) {
            return;
          }

          const senderId = chat.lastMessageSenderId;
          const senderName = senderId
            ? chat.participantNames?.[senderId] ||
              otherUserPresence()[senderId]?.displayName ||
              otherUserPresence()[senderId]?.email ||
              'Someone'
            : 'Someone';

          notifyNewMessage(senderName, chat.lastMessage);
        }
      });
    }

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
    }
  });

  // Subscribe to new users
  otherUserIds.forEach((odId) => {
    if (!presenceUnsubscribes.has(odId)) {
      const unsub = subscribeToUserPresence(odId, (user) => {
        if (user) {
          const prevUser = otherUserPresence()[odId];
          const userName = user.displayName || user.email || 'A contact';

          // Only notify about presence changes if we have a previous state
          // (to avoid notifications on initial load)
          if (prevUser !== undefined) {
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
  setOtherUserPresence({});
  loggedInUserId = null;
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
  loadingChats,
  loadingMessages,
  otherUserPresence,
};
