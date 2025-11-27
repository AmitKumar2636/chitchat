/**
 * ChatList - Displays contacts/conversations using AccessibleListbox
 * 
 * Features:
 * - Accessible keyboard navigation via AccessibleListbox
 * - Online/offline status indicators
 * - Typing indicators
 * - Last message preview
 */
import { Show, createMemo } from 'solid-js';
import { Button } from '@kobalte/core/button';
import { AccessibleListbox, type ListboxItem } from './AccessibleListbox';
import { chats, loadingChats, currentChatId, selectChat, otherUserPresence } from '../stores/chats';
import { user } from '../stores/auth';
import type { Chat } from '../types';

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
      // Calculate other participant
      const otherId = currentUser 
        ? chat.participants.find((id) => id !== currentUser.uid) || null
        : null;
      
      // Calculate name
      const otherName = (otherId && chat.participantNames?.[otherId]) || 'Unknown';
      
      // Calculate online status
      const isOnline = otherId ? (presence[otherId]?.isOnline || false) : false;
      
      // Calculate typing status
      const isTyping = otherId && chat.typing ? (chat.typing[otherId] === true) : false;
      
      // Build accessible label
      let label = otherName;
      label += isOnline ? ', online' : ', offline';
      if (isTyping) label += ', typing';
      if (chat.lastMessage) label += `, last message: ${chat.lastMessage}`;
      
      infoMap.set(chat.id, { otherName, otherId, isOnline, isTyping, label });
    }
    
    return infoMap;
  });
}

// ============================================================================
// Component
// ============================================================================

export function ChatList(props: Props) {
  // Create memoized derived info for all chats
  const chatInfoMap = useChatDerivedInfo();
  
  // Helper to get info for a specific chat (reactive through the memo)
  const getChatInfo = (chatId: string): ChatDerivedInfo => {
    return chatInfoMap().get(chatId) || { 
      otherName: 'Unknown', 
      otherId: null, 
      isOnline: false, 
      isTyping: false, 
      label: 'Unknown' 
    };
  };
  
  // Convert chats to ListboxItems (they already have `id`)
  const items = (): ChatItem[] => chats() as ChatItem[];

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
          ${isSelected() 
            ? 'bg-wa-sidebar-active dark:bg-wa-dark-sidebar-active' 
            : 'hover:bg-wa-sidebar-hover dark:hover:bg-wa-dark-sidebar-hover bg-transparent'
          }
          ${isActive() 
            ? 'ring-2 ring-wa-teal ring-inset' 
            : 'focus:ring-2 focus:ring-wa-teal focus:ring-inset'
          }`}
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
        <h2 id="chats-heading" class="text-base font-semibold text-wa-text-primary dark:text-wa-dark-text-primary">
          Chats
        </h2>
        <Button
          onClick={props.onNewChat}
          aria-label="Start new chat"
          class="w-10 h-10 flex items-center justify-center rounded-full bg-wa-light-green text-white text-xl hover:bg-wa-teal transition-colors focus:outline-none focus:ring-2 focus:ring-wa-teal focus:ring-offset-2"
        >
          +
        </Button>
      </div>

      <Show
        when={!loadingChats()}
        fallback={
          <p class="p-4 text-wa-text-secondary dark:text-wa-dark-text-secondary" role="status">
            Loading chats...
          </p>
        }
      >
        <Show
          when={chats().length > 0}
          fallback={
            <p class="p-8 text-center text-wa-text-secondary dark:text-wa-dark-text-secondary">
              No chats yet. Start a new conversation!
            </p>
          }
        >
          <AccessibleListbox
            items={items()}
            activeId={currentChatId()}
            onSelect={handleSelect}
            label="Contacts. Use arrow keys to navigate."
            id="chat-list"
            class="flex-1 overflow-y-auto"
            initialFocusLast={false}
          >
            {renderChatItem}
          </AccessibleListbox>
        </Show>
      </Show>
    </nav>
  );
}

export default ChatList;
