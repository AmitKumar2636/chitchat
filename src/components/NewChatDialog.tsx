// New chat dialog component with Kobalte + Tailwind CSS
import { createSignal } from 'solid-js';
import { Dialog } from '@kobalte/core/dialog';
import { TextField } from '@kobalte/core/text-field';
import { Button } from '@kobalte/core/button';
import { findUserByEmail } from '../services/messages';
import { createChat } from '../services/messages';
import { user } from '../stores/auth';

interface Props {
  onClose: () => void;
}

export function NewChatDialog(props: Props) {
  const [email, setEmail] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    const emailValue = email().trim().toLowerCase();
    const currentUser = user();

    if (!emailValue || !currentUser) return;

    // Can't start chat with yourself
    if (emailValue === currentUser.email?.toLowerCase()) {
      setError("You can't start a chat with yourself");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Find user by email
      const targetUser = await findUserByEmail(emailValue);

      if (!targetUser) {
        setError('User not found. Make sure they have signed up.');
        setLoading(false);
        return;
      }

      // Get display names for both users
      const currentUserName = currentUser.displayName || currentUser.email || 'Unknown';
      const targetUserName = targetUser.displayName || targetUser.email || 'Unknown';

      // Create chat with both user names
      await createChat(currentUser.uid, targetUser.id, currentUserName, targetUserName);
      props.onClose();
    } catch (err) {
      console.error('Failed to create chat:', err);
      setError('Failed to create chat. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={true} onOpenChange={(open) => !open && props.onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 bg-black/50 z-50" />
        <div class="fixed inset-0 z-50 flex items-center justify-center">
          <Dialog.Content class="bg-white dark:bg-wa-dark-sidebar rounded-lg p-6 w-full max-w-md shadow-xl">
            <div class="flex items-center justify-between mb-4">
              <Dialog.Title class="text-lg font-semibold text-wa-text-primary dark:text-wa-dark-text-primary">
                Start New Chat
              </Dialog.Title>
              <Dialog.CloseButton class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-wa-sidebar-hover dark:hover:bg-wa-dark-sidebar-hover transition-colors focus:outline-none focus:ring-2 focus:ring-wa-teal">
                <svg viewBox="0 0 24 24" width="20" height="20" class="text-wa-text-secondary">
                  <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </Dialog.CloseButton>
            </div>
            
            <Dialog.Description class="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary mb-4">
              Enter the email of the person you want to chat with.
            </Dialog.Description>
            
            <form onSubmit={handleSubmit} autocomplete="off" class="flex flex-col gap-4">
              <TextField 
                value={email()} 
                onChange={setEmail}
                validationState={error() ? 'invalid' : 'valid'}
                required
                class="flex flex-col gap-2"
              >
                <TextField.Label class="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary">
                  Email address
                </TextField.Label>
                <TextField.Input
                  type="email"
                  placeholder="user@example.com"
                  disabled={loading()}
                  autofocus
                  autocomplete="off"
                  class="px-4 py-3 rounded-lg border border-wa-border dark:border-wa-dark-border bg-wa-header dark:bg-wa-dark-header text-wa-text-primary dark:text-wa-dark-text-primary placeholder:text-wa-text-muted focus:outline-none focus:border-wa-teal transition-colors data-[invalid]:border-red-500"
                />
                <TextField.ErrorMessage class="text-red-600 text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded">
                  {error()}
                </TextField.ErrorMessage>
              </TextField>
              
              <div class="flex justify-end gap-3 mt-2">
                <Button
                  onClick={props.onClose}
                  disabled={loading()}
                  class="px-4 py-2 rounded-lg border border-wa-border dark:border-wa-dark-border text-wa-text-secondary dark:text-wa-dark-text-secondary hover:bg-wa-sidebar-hover dark:hover:bg-wa-dark-sidebar-hover bg-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-wa-teal focus:ring-offset-2"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading() || !email().trim()}
                  class="px-4 py-2 rounded-lg bg-wa-teal text-white font-medium hover:bg-wa-dark-green disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-wa-teal focus:ring-offset-2"
                >
                  {loading() ? 'Creating...' : 'Start Chat'}
                </Button>
              </div>
            </form>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  );
}
