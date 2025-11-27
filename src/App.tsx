import { createSignal, Show, onMount, onCleanup, createEffect, on } from "solid-js";
import { Button } from "@kobalte/core/button";
import "./App.css";
import { Login } from "./components/Login";
import { ChatList } from "./components/ChatList";
import { MessageView } from "./components/MessageView";
import { NewChatDialog } from "./components/NewChatDialog";
import { UpdateChecker } from "./components/UpdateChecker";
import { user, loading, initAuthListener, cleanupAuthListener } from "./stores/auth";
import { initChatsListener, cleanupChatsListener, cleanupMessagesListener } from "./stores/chats";
import { signOut } from "./services/auth";
import { updateUserPresence } from "./services/messages";

function App() {
  const [showNewChat, setShowNewChat] = createSignal(false);

  onMount(() => {
    initAuthListener();

    // Handle window close/refresh to set offline status
    const handleBeforeUnload = () => {
      const currentUser = user();
      if (currentUser) {
        updateUserPresence(currentUser.uid, false);
      }
    };

    // Handle visibility change (e.g., tab becomes hidden)
    const handleVisibilityChange = () => {
      const currentUser = user();
      if (currentUser) {
        updateUserPresence(currentUser.uid, document.visibilityState === 'visible');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    onCleanup(() => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    });
  });

  onCleanup(() => {
    cleanupAuthListener();
    cleanupChatsListener();
    cleanupMessagesListener();
  });

  // Initialize chats and presence when user logs in
  // Using on() for explicit dependency tracking
  createEffect(
    on(user, (u) => {
      if (u) {
        initChatsListener(u.uid);
        // Set user as online
        updateUserPresence(u.uid, true);
      }
    })
  );

  async function handleSignOut() {
    const currentUser = user();
    if (currentUser) {
      // Set user as offline before signing out
      await updateUserPresence(currentUser.uid, false);
    }
    cleanupChatsListener();
    cleanupMessagesListener();
    await signOut();
  }

  return (
    <Show when={!loading()} fallback={
      <div class="flex items-center justify-center h-screen bg-wa-chat-bg dark:bg-wa-dark-chat-bg">
        <p class="text-wa-text-secondary">Loading...</p>
      </div>
    }>
      <Show when={user()} fallback={<Login />}>
        <div class="flex h-screen bg-wa-chat-bg dark:bg-wa-dark-chat-bg">
          {/* Sidebar */}
          <aside class="w-[400px] min-w-[300px] flex flex-col bg-wa-sidebar dark:bg-wa-dark-sidebar border-r border-wa-border dark:border-wa-dark-border">
            {/* Sidebar Header */}
            <header class="flex items-center justify-between px-4 py-3 bg-wa-header dark:bg-wa-dark-header min-h-[60px]">
              <h1 class="text-xl font-semibold text-wa-dark-green">Chitchat</h1>
              <div class="flex items-center gap-4">
                <span class="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary">
                  {user()?.displayName || user()?.email}
                </span>
                <Button
                  onClick={handleSignOut}
                  class="px-3 py-1.5 text-sm border border-wa-teal text-wa-teal rounded hover:bg-wa-teal hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-wa-teal focus:ring-offset-2"
                >
                  Sign Out
                </Button>
              </div>
            </header>
            <ChatList onNewChat={() => setShowNewChat(true)} />
          </aside>
          
          {/* Main Content */}
          <MessageView />
          
          <Show when={showNewChat()}>
            <NewChatDialog onClose={() => setShowNewChat(false)} />
          </Show>
          
          {/* Update notification */}
          <UpdateChecker />
        </div>
      </Show>
    </Show>
  );
}

export default App;
