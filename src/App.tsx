import { createSignal, Show, onMount, onCleanup, createEffect, on } from 'solid-js';
import { DropdownMenu } from '@kobalte/core/dropdown-menu';
import { getCurrentWindow } from '@tauri-apps/api/window';
import './App.css';
import { Login } from './components/Login';
import { ChatList } from './components/ChatList';
import { MessageView } from './components/MessageView';
import { NewChatDialog } from './components/NewChatDialog';
import {
  UpdateChecker,
  updateAvailable,
  updateVersion,
  updateDismissed,
  dismissUpdate,
} from './components/UpdateChecker';
import { UpdatePage } from './components/UpdatePage';
import { ThemeToggle } from './components/ThemeToggle';
import { user, loading, initAuthListener, cleanupAuthListener } from './stores/auth';
import { initChatsListener, cleanupChatsListener, cleanupMessagesListener } from './stores/chats';
import { signOut } from './services/auth';
import { initUserPresence, cleanupUserPresence } from './services/messages';
// Initialize theme on app load
import './stores/theme';

function App() {
  const [showNewChat, setShowNewChat] = createSignal(false);
  let closeUnlisten: (() => void) | null = null;

  onMount(() => {
    initAuthListener();

    // Use Tauri's onCloseRequested to properly handle window close
    // This allows us to set user offline before closing
    getCurrentWindow()
      .onCloseRequested(async (event) => {
        const currentUser = user();
        if (currentUser) {
          event.preventDefault();

          try {
            await cleanupUserPresence(currentUser.uid);
          } catch (error) {
            console.error('Failed to cleanup presence on close:', error);
          }

          await getCurrentWindow().destroy();
        }
      })
      .then((unlisten) => {
        closeUnlisten = unlisten;
      })
      .catch((err) => {
        console.error('Failed to setup close handler:', err);
      });

    // Global keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!user()) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        setShowNewChat(true);
      }

      if (e.key === 'Escape' && showNewChat()) {
        e.preventDefault();
        setShowNewChat(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    onCleanup(() => {
      if (closeUnlisten) closeUnlisten();
      document.removeEventListener('keydown', handleKeyDown);
    });
  });

  onCleanup(() => {
    cleanupAuthListener();
    cleanupChatsListener();
    cleanupMessagesListener();
  });

  // Initialize chats and presence when user logs in
  createEffect(
    on(user, (u) => {
      if (u) {
        initChatsListener(u.uid);
        // Initialize presence - Firebase handles online/offline automatically
        initUserPresence(u.uid);
      }
    })
  );

  async function handleSignOut() {
    const currentUser = user();
    if (currentUser) {
      await cleanupUserPresence(currentUser.uid);
    }
    cleanupChatsListener();
    cleanupMessagesListener();
    await signOut();
  }

  return (
    <>
      {/* Update checker - runs on mount, renders nothing */}
      <UpdateChecker />

      {/* Show update page when update is available and not dismissed */}
      <Show when={updateAvailable() && !updateDismissed()}>
        <UpdatePage version={updateVersion()} onSkip={dismissUpdate} />
      </Show>

      <Show
        when={!loading()}
        fallback={
          <div class="flex items-center justify-center h-screen bg-wa-chat-bg dark:bg-wa-dark-chat-bg">
            <p class="text-wa-text-secondary">Loading...</p>
          </div>
        }
      >
        <Show when={user()} fallback={<Login />}>
          <div class="flex h-screen bg-wa-chat-bg dark:bg-wa-dark-chat-bg">
            {/* Sidebar */}
            <aside class="w-[400px] min-w-[300px] flex flex-col bg-wa-sidebar dark:bg-wa-dark-sidebar border-r border-wa-border dark:border-wa-dark-border">
              {/* Sidebar Header */}
              <header class="flex items-center justify-between px-4 py-3 bg-wa-header dark:bg-wa-dark-header min-h-[60px]">
                <h1 class="text-xl font-semibold text-wa-dark-green">Chitchat</h1>
                <div class="flex items-center gap-2">
                  <ThemeToggle />
                  {/* User menu dropdown */}
                  <DropdownMenu>
                    <DropdownMenu.Trigger class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-wa-sidebar-hover dark:hover:bg-wa-dark-sidebar-hover transition-colors">
                      {/* Avatar */}
                      <div class="w-8 h-8 rounded-full bg-wa-teal flex items-center justify-center text-white text-sm font-semibold">
                        {(user()?.displayName || user()?.email || 'U').charAt(0).toUpperCase()}
                      </div>
                      <span class="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary max-w-[120px] truncate">
                        {user()?.displayName || user()?.email}
                      </span>
                      {/* Dropdown arrow */}
                      <svg
                        class="w-4 h-4 text-wa-text-muted"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content class="min-w-[160px] bg-white dark:bg-wa-dark-sidebar rounded-lg shadow-lg border border-wa-border dark:border-wa-dark-border py-1 z-50">
                        <DropdownMenu.Item
                          class="px-4 py-2 text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary cursor-default"
                          disabled
                        >
                          {user()?.email}
                        </DropdownMenu.Item>
                        <DropdownMenu.Separator class="h-px bg-wa-border dark:bg-wa-dark-border my-1" />
                        <DropdownMenu.Item
                          onSelect={handleSignOut}
                          class="px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-wa-sidebar-hover dark:hover:bg-wa-dark-sidebar-hover cursor-pointer flex items-center gap-2"
                        >
                          <svg
                            class="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                            />
                          </svg>
                          Sign Out
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu>
                </div>
              </header>
              <ChatList onNewChat={() => setShowNewChat(true)} />
            </aside>

            {/* Main Content */}
            <MessageView />

            <Show when={showNewChat()}>
              <NewChatDialog onClose={() => setShowNewChat(false)} />
            </Show>
          </div>
        </Show>
      </Show>
    </>
  );
}

export default App;
