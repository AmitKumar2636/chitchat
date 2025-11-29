// Message view component with Kobalte + Tailwind CSS - WhatsApp style
import { createSignal, createMemo, Show, onCleanup } from 'solid-js';
import { TextField } from '@kobalte/core/text-field';
import { Button } from '@kobalte/core/button';
import {
  messages,
  loadingMessages,
  currentChatId,
  currentChat,
  otherUserPresence,
} from '../stores/chats';
import { sendMessage, setTypingStatus } from '../services/messages';
import { user } from '../stores/auth';
import { MessageList } from './MessageList';
import { playMessageSent } from '../services/sounds';

export function MessageView() {
  const [newMessage, setNewMessage] = createSignal('');
  const [sending, setSending] = createSignal(false);
  const [isTyping, setIsTyping] = createSignal(false);
  let typingTimeout: ReturnType<typeof setTimeout> | null = null;
  let inputRef: HTMLInputElement | undefined;

  // Memoized other user info - recalculates only when dependencies change
  const otherUserInfo = createMemo(() => {
    const chat = currentChat();
    const currentUser = user();
    if (!chat || !currentUser) return { name: 'User', isTyping: false, isOnline: false };

    // participants is now an object { odId: true }
    const participantIds = Object.keys(chat.participants || {});
    const otherId = participantIds.find((id) => id !== currentUser.uid);
    if (!otherId) return { name: 'User', isTyping: false, isOnline: false };

    const name = chat.participantNames?.[otherId] || 'User';
    const typing = chat.typing?.[otherId] === true;
    const presence = otherUserPresence();
    const online = presence[otherId]?.isOnline || false;

    return { name, isTyping: typing, isOnline: online };
  });

  // Cleanup typing timeout on unmount
  onCleanup(() => {
    if (typingTimeout) clearTimeout(typingTimeout);
    const chatId = currentChatId();
    const currentUser = user();
    if (chatId && currentUser) {
      setTypingStatus(chatId, currentUser.uid, false);
    }
  });

  function handleTyping() {
    const chatId = currentChatId();
    const currentUser = user();
    if (!chatId || !currentUser) return;

    if (!isTyping()) {
      setIsTyping(true);
      setTypingStatus(chatId, currentUser.uid, true);
    }

    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      setIsTyping(false);
      setTypingStatus(chatId, currentUser.uid, false);
    }, 2000);
  }

  async function handleSend(e: Event) {
    e.preventDefault();
    const text = newMessage().trim();
    const chatId = currentChatId();
    const currentUser = user();

    if (!text || !chatId || !currentUser) return;

    if (typingTimeout) clearTimeout(typingTimeout);
    setIsTyping(false);
    setSending(true);

    try {
      const senderName = currentUser.displayName || currentUser.email || 'Unknown';
      await sendMessage(chatId, currentUser.uid, senderName, text);
      playMessageSent();
      setNewMessage('');
      // Keep focus in the input field after sending
      // Use queueMicrotask for more reliable timing than setTimeout
      queueMicrotask(() => inputRef?.focus());
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  }

  return (
    <main class="flex-1 flex flex-col wa-chat-pattern">
      <Show
        when={currentChatId()}
        fallback={
          <div class="flex-1 flex flex-col items-center justify-center text-wa-text-secondary dark:text-wa-dark-text-secondary">
            <div class="text-6xl mb-4">💬</div>
            <p class="text-lg">Select a chat to start messaging</p>
          </div>
        }
      >
        {/* Chat header */}
        <header class="flex items-center gap-4 px-4 py-3 bg-wa-header dark:bg-wa-dark-header border-b border-wa-border dark:border-wa-dark-border min-h-[60px]">
          {/* Avatar */}
          <div class="w-10 h-10 rounded-full bg-wa-teal flex items-center justify-center text-white font-semibold">
            {otherUserInfo().name.charAt(0).toUpperCase()}
          </div>

          {/* User info */}
          <div class="flex flex-col">
            <h2 class="font-semibold text-wa-text-primary dark:text-wa-dark-text-primary">
              {otherUserInfo().name}
            </h2>
            <span class="text-sm">
              <Show
                when={otherUserInfo().isTyping}
                fallback={
                  <span
                    class={
                      otherUserInfo().isOnline
                        ? 'text-wa-light-green'
                        : 'text-wa-text-muted dark:text-wa-dark-text-muted'
                    }
                  >
                    {otherUserInfo().isOnline ? 'online' : 'offline'}
                  </span>
                }
              >
                <span class="text-wa-teal">typing...</span>
              </Show>
            </span>
          </div>
        </header>

        {/* Messages area with accessible navigation */}
        <MessageList
          messages={messages()}
          currentUserId={user()?.uid}
          loading={loadingMessages()}
          onEscape={() => inputRef?.focus()}
        />

        {/* Message input */}
        <form
          class="flex items-center gap-3 p-4 bg-wa-header dark:bg-wa-dark-header"
          onSubmit={handleSend}
          autocomplete="off"
        >
          <TextField
            value={newMessage()}
            onChange={(value) => {
              setNewMessage(value);
              handleTyping();
            }}
            class="flex-1"
          >
            <TextField.Label class="sr-only">Type a message</TextField.Label>
            <TextField.Input
              ref={(el: HTMLInputElement) => (inputRef = el)}
              placeholder="Type a message"
              autocomplete="off"
              class="w-full px-4 py-3 rounded-lg border-none bg-white dark:bg-wa-dark-sidebar text-wa-text-primary dark:text-wa-dark-text-primary placeholder:text-wa-text-muted focus:outline-none focus:ring-1 focus:ring-wa-teal/50"
            />
          </TextField>
          <Button
            type="submit"
            disabled={sending() || !newMessage().trim()}
            aria-label="Send message"
            class="w-12 h-12 rounded-full bg-wa-teal text-white flex items-center justify-center hover:bg-wa-dark-green disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-wa-teal focus:ring-offset-2"
          >
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path
                fill="currentColor"
                d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"
              />
            </svg>
          </Button>
        </form>
      </Show>
    </main>
  );
}
