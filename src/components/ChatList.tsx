/**
 * ChatList - Displays contacts/conversations using AccessibleListbox
 *
 * Features:
 * - Accessible keyboard navigation via AccessibleListbox
 * - Online/offline status indicators
 * - Typing indicators
 * - Last message preview
 * - Search/filter contacts
 */
import { Show, createMemo, createSignal } from 'solid-js';
import { Button } from '@kobalte/core/button';
import { TextField } from '@kobalte/core/text-field';
import { AccessibleListbox, type ListboxItem } from './AccessibleListbox';
import {
  chats,
  connectionState,
  currentChatId,
  selectChat,
  otherUserPresence,
} from '../stores/chats';
import { user } from '../stores/auth';
import type { Chat } from '../types';
import { UI_LABELS } from '../constants/messages';

// ============================================================================
// Types
// ============================================================================

interface Props {
  onNewChat: () => void;
}

// Extend Chat to satisfy ListboxItem interface
type ChatItem = Chat & ListboxItem;

// Derived chat info for a single chat
interface ChatDerivedInfo {
  otherName: string;
  otherId: string | null;
  isOnline: boolean;
  isTyping: boolean;
  label: string;
}

// ============================================================================
// Hooks - Reactive derived state
// ============================================================================

/**
 * Creates a memoized lookup of derived chat info.
 * This recalculates only when chats, user, or presence changes.
 */
function useChatDerivedInfo() {
  return createMemo(() => {
    const currentUser = user();
    const presence = otherUserPresence();
    const chatList = chats();

    const infoMap = new Map<string, ChatDerivedInfo>();

    for (const chat of chatList) {
      if (chat.isGroup) {
        const otherName = chat.groupName || UI_LABELS.GROUP_CHAT_DEFAULT;
        const otherId = null;
        const isOnline = false;

        const isTyping = chat.typing
          ? Object.entries(chat.typing).some(
              ([uid, typing]) => uid !== currentUser?.uid && typing === true
            )
          : false;

        let label = otherName;
        if (isTyping) label += `, ${UI_LABELS.SOMEONE_TYPING}`;
        if (chat.lastMessage) label += `, last message: ${chat.lastMessage}`;

        infoMap.set(chat.id, { otherName, otherId, isOnline, isTyping, label });
      } else {
        const participantIds = Object.keys(chat.participants || {});
        const otherId = currentUser
          ? participantIds.find((id) => id !== currentUser.uid) || null
          : null;

        const otherName = (otherId && chat.participantNames?.[otherId]) || UI_LABELS.UNKNOWN_USER;

        const isOnline = otherId ? presence[otherId]?.isOnline || false : false;

        const isTyping = otherId && chat.typing ? chat.typing[otherId] === true : false;

        let label = otherName;
        label += isOnline ? `, ${UI_LABELS.ONLINE}` : `, ${UI_LABELS.OFFLINE}`;
        if (isTyping) label += `, ${UI_LABELS.TYPING}`;
        if (chat.lastMessage) label += `, last message: ${chat.lastMessage}`;

        infoMap.set(chat.id, { otherName, otherId, isOnline, isTyping, label });
      }
    }

    return infoMap;
  });
}

// ============================================================================
// Component
// ============================================================================

export function ChatList(props: Props) {
  // Search state
  const [searchQuery, setSearchQuery] = createSignal('');

  // Create memoized derived info for all chats
  const chatInfoMap = useChatDerivedInfo();

  // Helper to get info for a specific chat (reactive through the memo)
  const getChatInfo = (chatId: string): ChatDerivedInfo => {
    return (
      chatInfoMap().get(chatId) || {
        otherName: 'Unknown',
        otherId: null,
        isOnline: false,
        isTyping: false,
        label: 'Unknown',
      }
    );
  };

  // Filter chats based on search query
  const filteredChats = createMemo(() => {
    const query = searchQuery().toLowerCase().trim();
    if (!query) return chats();

    return chats().filter((chat) => {
      const info = getChatInfo(chat.id);
      // Search by contact name or last message
      return (
        info.otherName.toLowerCase().includes(query) ||
        (chat.lastMessage?.toLowerCase().includes(query) ?? false)
      );
    });
  });

  // Convert chats to ListboxItems (they already have `id`)
  const items = (): ChatItem[] => filteredChats() as ChatItem[];

  // Handle chat selection
  const handleSelect = (chat: ChatItem) => {
    selectChat(chat.id);
  };

  // Render a single chat item
  const renderChatItem = (chat: ChatItem, _index: () => number, isActive: () => boolean) => {
    // All derived state comes from the memoized map - properly reactive
    const info = () => getChatInfo(chat.id);
    const isSelected = () => currentChatId() === chat.id;

    return (
      <div
        class={`w-full px-4 py-3 text-left border-b border-wa-border dark:border-wa-dark-border transition-colors cursor-pointer
          ${
            isSelected()
              ? 'bg-wa-teal/10 dark:bg-wa-teal/20 border-l-4 border-l-wa-teal'
              : 'hover:bg-wa-sidebar-hover dark:hover:bg-wa-dark-sidebar-hover bg-transparent border-l-4 border-l-transparent'
          }
          ${isActive() ? 'bg-wa-sidebar-active dark:bg-wa-dark-sidebar-active' : ''}`}
      >
        {/* Screen reader text */}
        <span class="sr-only">{info().label}</span>

        {/* Visual content */}
        <div class="flex items-center gap-3" aria-hidden="true">
          {/* Avatar */}
          <div class="w-12 h-12 rounded-full bg-wa-teal flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
            {info().otherName.charAt(0).toUpperCase()}
          </div>

          {/* Chat info */}
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-medium text-wa-text-primary dark:text-wa-dark-text-primary truncate">
                {info().otherName}
              </span>
              <span
                class={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${info().isOnline ? 'bg-wa-light-green' : 'bg-gray-300 dark:bg-gray-600'}`}
              />
            </div>
            <p class="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary truncate">
              <Show when={info().isTyping} fallback={chat.lastMessage || 'No messages yet'}>
                <span class="text-wa-teal italic">Typing...</span>
              </Show>
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <nav class="flex-1 flex flex-col overflow-hidden" aria-label="Chat list">
      {/* Chat list header */}
      <div class="flex items-center justify-between px-4 py-3 border-b border-wa-border dark:border-wa-dark-border">
        <h2
          id="chats-heading"
          class="text-base font-semibold text-wa-text-primary dark:text-wa-dark-text-primary"
        >
          {UI_LABELS.CHATS_HEADING}
        </h2>
        <Button
          onClick={props.onNewChat}
          aria-label="Start new chat"
          class="w-10 h-10 flex items-center justify-center rounded-full bg-wa-light-green text-white text-xl hover:bg-wa-teal transition-colors focus:outline-none focus:ring-2 focus:ring-wa-teal focus:ring-offset-2"
        >
          +
        </Button>
      </div>

      {/* Search input */}
      <div class="px-3 py-2 border-b border-wa-border dark:border-wa-dark-border">
        <TextField value={searchQuery()} onChange={setSearchQuery} class="relative">
          <TextField.Label class="sr-only">{UI_LABELS.SEARCH_PLACEHOLDER}</TextField.Label>
          {/* Search icon */}
          <svg
            class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-wa-text-secondary dark:text-wa-dark-text-secondary pointer-events-none z-10"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <TextField.Input
            placeholder={UI_LABELS.SEARCH_PLACEHOLDER}
            class="w-full pl-10 pr-10 py-2 text-sm rounded-lg bg-wa-sidebar-hover dark:bg-wa-dark-sidebar-hover text-wa-text-primary dark:text-wa-dark-text-primary placeholder:text-wa-text-secondary dark:placeholder:text-wa-dark-text-secondary border border-transparent focus:border-wa-teal focus:outline-none focus:ring-1 focus:ring-wa-teal"
          />
          {/* Clear button */}
          <Show when={searchQuery()}>
            <Button
              onClick={() => setSearchQuery('')}
              class="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-wa-text-primary dark:hover:text-wa-dark-text-primary hover:bg-wa-border dark:hover:bg-wa-dark-border transition-colors z-10"
              aria-label="Clear search"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </Button>
          </Show>
        </TextField>
      </div>

      <Show
        when={connectionState() !== 'connecting' && connectionState() !== 'idle'}
        fallback={
          <p class="p-4 text-wa-text-secondary dark:text-wa-dark-text-secondary" role="status">
            {UI_LABELS.LOADING_CHATS}
          </p>
        }
      >
        <Show
          when={connectionState() !== 'error'}
          fallback={
            <div class="p-4 text-center text-red-500 dark:text-red-400" role="alert">
              <p>Failed to load chats.</p>
              <p class="text-sm mt-1">Please check your connection.</p>
            </div>
          }
        >
          <Show
            when={chats().length > 0}
            fallback={
              <p class="p-8 text-center text-wa-text-secondary dark:text-wa-dark-text-secondary">
                {UI_LABELS.NO_CHATS}
              </p>
            }
          >
            <Show
              when={items().length > 0}
              fallback={
                <p class="p-8 text-center text-wa-text-secondary dark:text-wa-dark-text-secondary">
                  {UI_LABELS.NO_CONTACTS_MATCH} "{searchQuery()}"
                </p>
              }
            >
              <div class="flex-1 overflow-y-auto">
                <Show when={directChats().length > 0}>
                  <div class="px-4 py-2 text-xs font-semibold text-wa-text-secondary uppercase tracking-wider bg-wa-chat-bg/50 dark:bg-wa-dark-chat-bg/50 sticky top-0 z-10 backdrop-blur-sm">
                    Direct Messages
                  </div>
                  <AccessibleListbox
                    items={directChats()}
                    activeId={currentChatId()}
                    onSelect={handleSelect}
                    label="Direct Messages"
                    id="dm-list"
                    class="pb-2"
                    initialFocusLast={false}
                  >
                    {renderChatItem}
                  </AccessibleListbox>
                </Show>

                <Show when={groupChats().length > 0}>
                  <div class="px-4 py-2 text-xs font-semibold text-wa-text-secondary uppercase tracking-wider bg-wa-chat-bg/50 dark:bg-wa-dark-chat-bg/50 sticky top-0 z-10 backdrop-blur-sm">
                    Groups
                  </div>
                  <AccessibleListbox
                    items={groupChats()}
                    activeId={currentChatId()}
                    onSelect={handleSelect}
                    label="Groups"
                    id="group-list"
                    class="pb-2"
                    initialFocusLast={false}
                  >
                    {renderChatItem}
                  </AccessibleListbox>
                </Show>
              </div>
            </Show>
          </Show>
        </Show>
      </Show>
    </nav>
  );
}

export default ChatList;
