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
import { GroupInfoDialog } from './GroupInfoDialog';
import { playMessageSent } from '../services/sounds';
import { UI_LABELS } from '../constants/messages';

export function MessageView() {
  const [newMessage, setNewMessage] = createSignal('');
  const [showGroupInfo, setShowGroupInfo] = createSignal(false);

  type SendState = 'idle' | 'sending' | 'error';
  const [sendState, setSendState] = createSignal<SendState>('idle');

  const [isTyping, setIsTyping] = createSignal(false);
  let typingTimeout: ReturnType<typeof setTimeout> | null = null;
  let inputRef: HTMLInputElement | undefined;

  // Memoized other user info - recalculates only when dependencies change
  const otherUserInfo = createMemo(() => {
    const chat = currentChat();
    const currentUser = user();
    if (!chat || !currentUser) return { name: 'User', isTyping: false, isOnline: false };

    if (chat.isGroup) {
      const name = chat.groupName || UI_LABELS.GROUP_CHAT_DEFAULT;
      const isTyping = chat.typing
        ? Object.entries(chat.typing).some(
          ([uid, typing]) => uid !== currentUser.uid && typing === true
        )
        : false;
      return { name, isTyping, isOnline: false };
    }

    // participants is now an object { odId: true }
    const participantIds = Object.keys(chat.participants || {});
    const otherId = participantIds.find((id) => id !== currentUser.uid);
    if (!otherId) return { name: UI_LABELS.UNKNOWN_USER, isTyping: false, isOnline: false };

    const name = chat.participantNames?.[otherId] || UI_LABELS.UNKNOWN_USER;
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
    setSendState('sending');

    try {
      const senderName = currentUser.displayName || currentUser.email || 'Unknown';
      await sendMessage(chatId, currentUser.uid, senderName, text);
      playMessageSent();
      setNewMessage('');
      setSendState('idle');
      // Keep focus in the input field after sending
      // Use queueMicrotask for more reliable timing than setTimeout
      queueMicrotask(() => inputRef?.focus());
    } catch (err) {
      console.error('Failed to send message:', err);
      setSendState('error');
      // Reset to idle after 3 seconds so user can try again
      setTimeout(() => setSendState('idle'), 3000);
    }
  }

  return (
    <main class="flex-1 flex flex-col wa-chat-pattern">
      <Show
        when={currentChatId()}
        fallback={
          <div class="flex-1 flex flex-col items-center justify-center text-wa-text-secondary dark:text-wa-dark-text-secondary">
            <div class="text-6xl mb-4">💬</div>
            <p class="text-lg">{UI_LABELS.SELECT_CHAT_PROMPT}</p>
          </div>
        }
      >
        {/* Chat header */}
        <header class="flex items-center justify-between px-4 py-3 bg-wa-header dark:bg-wa-dark-header border-b border-wa-border dark:border-wa-dark-border min-h-[60px]">
          <div class="flex items-center gap-4">
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
                      {otherUserInfo().isOnline ? UI_LABELS.ONLINE : UI_LABELS.OFFLINE}
                    </span>
                  }
                >
                  <span class="text-wa-teal">{UI_LABELS.TYPING}</span>
                </Show>
              </span>
            </div>
          </div>

          <Show when={currentChat()?.isGroup}>
            <Button
              onClick={() => setShowGroupInfo(true)}
              class="p-2 rounded-full hover:bg-wa-sidebar-hover dark:hover:bg-wa-dark-sidebar-hover text-wa-text-secondary dark:text-wa-dark-text-secondary transition-colors"
              title="Group Info"
            >
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
              </svg>
            </Button>
          </Show>
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
            <TextField.Label class="sr-only">{UI_LABELS.TYPE_MESSAGE_PLACEHOLDER}</TextField.Label>
            <TextField.Input
              ref={(el: HTMLInputElement) => (inputRef = el)}
              placeholder={
                sendState() === 'error'
                  ? UI_LABELS.FAILED_TO_SEND
                  : UI_LABELS.TYPE_MESSAGE_PLACEHOLDER
              }
              autocomplete="off"
              class={`w-full px-4 py-3 rounded-lg border-none bg-white dark:bg-wa-dark-sidebar text-wa-text-primary dark:text-wa-dark-text-primary placeholder:text-wa-text-muted focus:outline-none focus:ring-1 focus:ring-wa-teal/50 ${sendState() === 'error' ? 'ring-2 ring-red-500' : ''}`}
            />
          </TextField>
          <Button
            type="submit"
            disabled={sendState() === 'sending' || !newMessage().trim()}
            aria-label={UI_LABELS.SEND_MESSAGE_LABEL}
            class={`w-12 h-12 rounded-full text-white flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-wa-teal focus:ring-offset-2 ${sendState() === 'error' ? 'bg-red-500 hover:bg-red-600' : 'bg-wa-teal hover:bg-wa-dark-green'} disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed`}
          >
            <Show
              when={sendState() !== 'sending'}
              fallback={
                <div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              }
            >
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path
                  fill="currentColor"
                  d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"
                />
              </svg>
            </Show>
          </Button>
        </form>
      </Show>

      {/* Group Info Dialog */}
      <Show when={showGroupInfo() && currentChat()?.isGroup && currentChat()}>
        <GroupInfoDialog
          chat={currentChat()!}
          isOpen={showGroupInfo()}
          onClose={() => setShowGroupInfo(false)}
        />
      </Show>
    </main>
  );
}
