/**
 * MessageList - Displays chat messages using AccessibleListbox
 *
 * Features:
 * - Accessible keyboard navigation via AccessibleListbox
 * - Live region announcements for new messages
 * - Auto-scroll to newest message
 * - Message-specific styling (sent vs received)
 */
import { createSignal, createEffect, Show, on } from 'solid-js';
import { AccessibleListbox, type ListboxItem } from './AccessibleListbox';
import type { Message } from '../types';
import { UI_LABELS } from '../constants/messages';

// ============================================================================
// Types
// ============================================================================

interface Props {
  messages: Message[];
  currentUserId: string | undefined;
  loading: boolean;
  onEscape?: () => void;
}

// Extend Message to satisfy ListboxItem interface
type MessageItem = Message & ListboxItem;

// ============================================================================
// Utilities
// ============================================================================

function formatTimestamp(timestamp: Date | number | { toDate?: () => Date } | null): string {
  if (!timestamp) return '';

  let date: Date;
  if (typeof timestamp === 'number') {
    date = new Date(timestamp);
  } else if (typeof timestamp === 'object' && 'toDate' in timestamp && timestamp.toDate) {
    date = timestamp.toDate();
  } else {
    date = new Date(timestamp as Date);
  }

  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return (
    date.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' +
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
}

function getMessageLabel(message: Message, isSent: boolean): string {
  const sender = isSent ? UI_LABELS.YOU : message.senderName;
  const timestamp = formatTimestamp(message.timestamp);
  const timeLabel = timestamp ? `, ${timestamp}` : '';
  return `${sender}: ${message.text}${timeLabel}`;
}

// ============================================================================
// Component
// ============================================================================

export function MessageList(props: Props) {
  // Live region announcements - alternating slots for identical message handling
  const [announcement1, setAnnouncement1] = createSignal('');
  const [announcement2, setAnnouncement2] = createSignal('');
  const [useFirstSlot, setUseFirstSlot] = createSignal(true);

  // Container ref for auto-scroll
  let scrollContainerRef: HTMLDivElement | undefined;

  // Convert messages to ListboxItems (they already have `id`)
  const items = (): MessageItem[] => props.messages as MessageItem[];

  // Auto-scroll to bottom when new messages arrive
  createEffect(
    on(
      () => props.messages.length,
      () => {
        if (scrollContainerRef && props.messages.length > 0) {
          // Use requestAnimationFrame to ensure DOM has updated
          requestAnimationFrame(() => {
            scrollContainerRef!.scrollTop = scrollContainerRef!.scrollHeight;
          });
        }
      }
    )
  );

  // Announce new messages via live region
  createEffect(
    on(
      () => props.messages.length,
      (currentCount, previousCount) => {
        if (previousCount === undefined) return;

        if (currentCount > previousCount && previousCount > 0) {
          const newMessages = props.messages.slice(previousCount);
          const announcements = newMessages.map((msg) => {
            const isSent = msg.senderId === props.currentUserId;
            return getMessageLabel(msg, isSent);
          });

          const announcementText = announcements.join('. ');

          // Alternate between two live regions
          if (useFirstSlot()) {
            setAnnouncement2('');
            setAnnouncement1(announcementText);
          } else {
            setAnnouncement1('');
            setAnnouncement2(announcementText);
          }
          setUseFirstSlot(!useFirstSlot());
        }
      }
    )
  );

  // Render a single message item
  const renderMessage = (message: MessageItem, index: () => number, isActive: () => boolean) => {
    const isSent = () => message.senderId === props.currentUserId;
    const messageLabel = () => getMessageLabel(message, isSent());

    // Check if this is a continuation from the same sender
    const isFirstInGroup = () => {
      const idx = index();
      if (idx === 0) return true;
      const prevMessage = props.messages[idx - 1];
      return prevMessage.senderId !== message.senderId;
    };

    // Check if next message is from same sender (for spacing)
    const isLastInGroup = () => {
      const idx = index();
      if (idx === props.messages.length - 1) return true;
      const nextMessage = props.messages[idx + 1];
      return nextMessage.senderId !== message.senderId;
    };

    return (
      <div
        class={`w-fit max-w-[70%] px-3 py-2 rounded-lg shadow-sm transition-all
          ${isSent()
            ? 'self-end bg-wa-outgoing dark:bg-wa-dark-outgoing rounded-tr-none ml-auto'
            : 'self-start bg-wa-incoming dark:bg-wa-dark-incoming rounded-tl-none mr-auto'
          }
          ${isLastInGroup() ? 'mb-2' : 'mb-0.5'}
          ${isActive() ? 'ring-2 ring-wa-teal/50 ring-offset-1' : ''}`}
      >
        {/* Screen reader text */}
        <span class="sr-only">{messageLabel()}</span>

        {/* Visual content */}
        <div aria-hidden="true">
          <Show when={!isSent() && isFirstInGroup()}>
            <span class="text-xs font-semibold text-wa-teal block mb-0.5">
              {message.senderName}
            </span>
          </Show>
          <p class="text-wa-text-primary dark:text-wa-dark-text-primary break-words whitespace-pre-wrap">
            {message.text}
          </p>
          <time class="text-[11px] text-wa-text-secondary dark:text-wa-dark-text-secondary block text-right mt-0.5 opacity-80">
            {formatTimestamp(message.timestamp)}
          </time>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Live regions for announcements */}
      <div aria-live="polite" aria-atomic="true" class="sr-only">
        {announcement1()}
      </div>
      <div aria-live="polite" aria-atomic="true" class="sr-only">
        {announcement2()}
      </div>

      <div ref={scrollContainerRef} class="flex-1 overflow-y-auto p-4">
        <Show
          when={!props.loading}
          fallback={
            <div
              class="flex items-center justify-center h-full text-wa-text-secondary dark:text-wa-dark-text-secondary"
              role="status"
            >
              {UI_LABELS.LOADING_MESSAGES}
            </div>
          }
        >
          <Show
            when={props.messages.length > 0}
            fallback={
              <div class="flex items-center justify-center h-full text-wa-text-secondary dark:text-wa-dark-text-secondary">
                <p>{UI_LABELS.NO_MESSAGES}</p>
              </div>
            }
          >
            <AccessibleListbox
              items={items()}
              label={UI_LABELS.MESSAGE_LIST_LABEL}
              id="message-list"
              class="flex flex-col gap-1"
              initialFocusLast={true}
              onEscape={props.onEscape}
            >
              {renderMessage}
            </AccessibleListbox>
          </Show>
        </Show>
      </div>
    </>
  );
}

export default MessageList;
