import { createSignal, Show, For } from 'solid-js';
import { Dialog } from '@kobalte/core/dialog';
import { TextField } from '@kobalte/core/text-field';
import { Button } from '@kobalte/core/button';
import { Tabs } from '@kobalte/core/tabs';
import { Checkbox } from '@kobalte/core/checkbox';
import { findUserByEmail, createChat, createGroupChat } from '../services/messages';
import { user } from '../stores/auth';
import { derivedContacts } from '../stores/chats';
import type { Contact } from '../types';
import { ERROR_MESSAGES, UI_LABELS } from '../constants/messages';

interface Props {
  onClose: () => void;
}

type CreateChatState =
  | { status: 'idle' }
  | { status: 'creating' }
  | { status: 'error'; message: string };

export function NewChatDialog(props: Props) {
  const [email, setEmail] = createSignal('');
  const [groupName, setGroupName] = createSignal('');
  const [selectedContacts, setSelectedContacts] = createSignal<Contact[]>([]);
  const [state, setState] = createSignal<CreateChatState>({ status: 'idle' });

  // ... (handlers remain the same)

  async function handleDirectSubmit(e: Event) {
    e.preventDefault();
    const emailValue = email().trim().toLowerCase();
    const currentUser = user();

    if (!emailValue || !currentUser) return;

    if (emailValue === currentUser.email?.toLowerCase()) {
      setState({ status: 'error', message: ERROR_MESSAGES.SELF_CHAT });
      return;
    }

    setState({ status: 'creating' });

    try {
      const targetUser = await findUserByEmail(emailValue);

      if (!targetUser) {
        setState({ status: 'error', message: ERROR_MESSAGES.USER_NOT_FOUND });
        return;
      }

      const currentUserName = currentUser.displayName || currentUser.email || 'Unknown';
      const targetUserName = targetUser.displayName || targetUser.email || 'Unknown';

      await createChat(currentUser.uid, targetUser.id, currentUserName, targetUserName);
      props.onClose();
    } catch (err) {
      console.error('Failed to create chat:', err);
      setState({ status: 'error', message: ERROR_MESSAGES.CREATE_CHAT_FAILED });
    }
  }

  // ... (other handlers)

  async function handleAddUserToGroup(e: Event) {
    e.preventDefault();
    const emailValue = email().trim().toLowerCase();
    const currentUser = user();

    if (!emailValue || !currentUser) return;

    if (emailValue === currentUser.email?.toLowerCase()) {
      setState({ status: 'error', message: ERROR_MESSAGES.SELF_ADD_GROUP });
      return;
    }

    if (selectedContacts().some((c) => c.email?.toLowerCase() === emailValue)) {
      setState({ status: 'error', message: ERROR_MESSAGES.USER_ALREADY_ADDED });
      return;
    }

    setState({ status: 'creating' });

    try {
      const targetUser = await findUserByEmail(emailValue);

      if (!targetUser) {
        setState({ status: 'error', message: ERROR_MESSAGES.USER_NOT_FOUND_SHORT });
      } else {
        // Convert User to Contact
        const contact: Contact = {
          id: targetUser.id,
          email: targetUser.email,
          displayName: targetUser.displayName,
          photoURL: null,
        };
        setSelectedContacts([...selectedContacts(), contact]);
        setEmail(''); // Clear input
        setState({ status: 'idle' });
      }
    } catch (err) {
      console.error('Failed to find user:', err);
      setState({ status: 'error', message: ERROR_MESSAGES.FIND_USER_FAILED });
    }
  }

  function toggleContactSelection(contact: Contact, checked: boolean) {
    if (checked) {
      if (!selectedContacts().some((c) => c.id === contact.id)) {
        setSelectedContacts([...selectedContacts(), contact]);
      }
    } else {
      setSelectedContacts(selectedContacts().filter((c) => c.id !== contact.id));
    }
  }

  async function handleCreateGroup() {
    const currentUser = user();
    const name = groupName().trim();
    const contacts = selectedContacts();

    if (!currentUser || !name || contacts.length === 0) return;

    setState({ status: 'creating' });

    try {
      const currentUserName = currentUser.displayName || currentUser.email || 'Unknown';

      const participants = [
        { id: currentUser.uid, name: currentUserName },
        ...contacts.map((c) => ({
          id: c.id,
          name: c.displayName || c.email || 'Unknown',
        })),
      ];

      await createGroupChat(participants, name);
      props.onClose();
    } catch (err) {
      console.error('Failed to create group:', err);
      setState({ status: 'error', message: ERROR_MESSAGES.CREATE_GROUP_FAILED });
    }
  }

  function removeContact(contactId: string) {
    setSelectedContacts(selectedContacts().filter((c) => c.id !== contactId));
  }

  const isLoading = () => state().status === 'creating';
  const errorMessage = () => (state().status === 'error' ? (state() as { message: string }).message : null);

  return (
    <Dialog open={true} onOpenChange={(open) => !open && props.onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 bg-black/50 z-50" />
        <div class="fixed inset-0 z-50 flex items-center justify-center">
          <Dialog.Content class="bg-white dark:bg-wa-dark-sidebar rounded-lg p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between mb-4">
              <Dialog.Title class="text-lg font-semibold text-wa-text-primary dark:text-wa-dark-text-primary">
                {UI_LABELS.START_NEW_CHAT}
              </Dialog.Title>
              <Dialog.CloseButton class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-wa-sidebar-hover dark:hover:bg-wa-dark-sidebar-hover transition-colors focus:outline-none focus:ring-2 focus:ring-wa-teal">
                <svg viewBox="0 0 24 24" width="20" height="20" class="text-wa-text-secondary">
                  <path
                    fill="currentColor"
                    d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                  />
                </svg>
              </Dialog.CloseButton>
            </div>

            <Tabs defaultValue="direct" class="w-full">
              <Tabs.List class="flex gap-2 mb-6 p-1 bg-wa-sidebar-hover dark:bg-wa-dark-sidebar-hover rounded-lg">
                <Tabs.Trigger
                  value="direct"
                  class="flex-1 py-1.5 text-sm font-medium rounded-md transition-colors text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-wa-text-primary data-[selected]:bg-white dark:data-[selected]:bg-wa-dark-header data-[selected]:text-wa-teal data-[selected]:shadow-sm focus:outline-none focus:ring-2 focus:ring-wa-teal"
                >
                  {UI_LABELS.DIRECT_MESSAGE}
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="group"
                  class="flex-1 py-1.5 text-sm font-medium rounded-md transition-colors text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-wa-text-primary data-[selected]:bg-white dark:data-[selected]:bg-wa-dark-header data-[selected]:text-wa-teal data-[selected]:shadow-sm focus:outline-none focus:ring-2 focus:ring-wa-teal"
                >
                  {UI_LABELS.GROUP_CHAT}
                </Tabs.Trigger>
              </Tabs.List>

              <Tabs.Content value="direct" class="focus:outline-none">
                <Dialog.Description class="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary mb-4">
                  Enter the email of the person you want to chat with.
                </Dialog.Description>

                <form onSubmit={handleDirectSubmit} autocomplete="off" class="flex flex-col gap-4">
                  <TextField
                    value={email()}
                    onChange={setEmail}
                    validationState={errorMessage() ? 'invalid' : 'valid'}
                    required
                    class="flex flex-col gap-2"
                  >
                    <TextField.Label class="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary">
                      {UI_LABELS.EMAIL}
                    </TextField.Label>
                    <TextField.Input
                      type="email"
                      placeholder={UI_LABELS.EMAIL_PLACEHOLDER}
                      disabled={isLoading()}
                      autofocus
                      autocomplete="off"
                      class="px-4 py-3 rounded-lg border border-wa-border dark:border-wa-dark-border bg-wa-header dark:bg-wa-dark-header text-wa-text-primary dark:text-wa-dark-text-primary placeholder:text-wa-text-muted focus:outline-none focus:border-wa-teal transition-colors data-[invalid]:border-red-500"
                    />
                    <Show when={errorMessage()}>
                      <TextField.ErrorMessage class="text-red-600 text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded">
                        {errorMessage()}
                      </TextField.ErrorMessage>
                    </Show>
                  </TextField>

                  <div class="flex justify-end gap-3 mt-2">
                    <Button
                      onClick={props.onClose}
                      disabled={isLoading()}
                      class="px-4 py-2 rounded-lg border border-wa-border dark:border-wa-dark-border text-wa-text-secondary dark:text-wa-dark-text-secondary hover:bg-wa-sidebar-hover dark:hover:bg-wa-dark-sidebar-hover bg-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-wa-teal focus:ring-offset-2"
                    >
                      {UI_LABELS.CANCEL}
                    </Button>
                    <Button
                      type="submit"
                      disabled={isLoading() || !email().trim()}
                      class="px-4 py-2 rounded-lg bg-wa-teal text-white font-medium hover:bg-wa-dark-green disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-wa-teal focus:ring-offset-2"
                    >
                      {isLoading() ? UI_LABELS.CREATING : UI_LABELS.START_CHAT}
                    </Button>
                  </div>
                </form>
              </Tabs.Content>

              <Tabs.Content value="group" class="focus:outline-none">
                <div class="flex flex-col gap-4">
                  <TextField value={groupName()} onChange={setGroupName} class="flex flex-col gap-2">
                    <TextField.Label class="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary">
                      Group Name
                    </TextField.Label>
                    <TextField.Input
                      placeholder={UI_LABELS.GROUP_NAME_PLACEHOLDER}
                      disabled={isLoading()}
                      class="px-4 py-3 rounded-lg border border-wa-border dark:border-wa-dark-border bg-wa-header dark:bg-wa-dark-header text-wa-text-primary dark:text-wa-dark-text-primary placeholder:text-wa-text-muted focus:outline-none focus:border-wa-teal transition-colors"
                    />
                  </TextField>

                  {/* Existing Contacts Selection */}
                  <Show when={derivedContacts().length > 0}>
                    <div class="flex flex-col gap-2">
                      <span id="contacts-selection-label" class="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary">
                        {UI_LABELS.SELECT_FROM_CONTACTS}
                      </span>
                      <div
                        role="group"
                        aria-labelledby="contacts-selection-label"
                        class="max-h-[150px] overflow-y-auto border border-wa-border dark:border-wa-dark-border rounded-lg p-2 bg-wa-header dark:bg-wa-dark-header"
                      >
                        <For each={derivedContacts()}>
                          {(contact) => (
                            <Checkbox
                              checked={selectedContacts().some((c) => c.id === contact.id)}
                              onChange={(checked) => toggleContactSelection(contact, checked)}
                              class="flex items-center gap-2 p-2 hover:bg-wa-sidebar-hover dark:hover:bg-wa-dark-sidebar-hover rounded cursor-pointer"
                            >
                              <Checkbox.Input class="sr-only" />
                              <Checkbox.Control class="w-5 h-5 rounded border border-wa-text-secondary flex items-center justify-center data-[checked]:bg-wa-teal data-[checked]:border-wa-teal">
                                <Checkbox.Indicator>
                                  <svg viewBox="0 0 24 24" width="16" height="16" class="text-white">
                                    <path
                                      fill="currentColor"
                                      d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
                                    />
                                  </svg>
                                </Checkbox.Indicator>
                              </Checkbox.Control>
                              <Checkbox.Label class="text-sm text-wa-text-primary dark:text-wa-dark-text-primary">
                                {contact.displayName}
                              </Checkbox.Label>
                            </Checkbox>
                          )}
                        </For>
                      </div>
                    </div>
                  </Show>

                  <form onSubmit={handleAddUserToGroup} class="flex flex-col gap-2">
                    <TextField
                      value={email()}
                      onChange={setEmail}
                      validationState={errorMessage() ? 'invalid' : 'valid'}
                      class="flex flex-col gap-2"
                    >
                      <TextField.Label class="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary">
                        {UI_LABELS.ADD_MEMBERS_LABEL}
                      </TextField.Label>
                      <div class="flex gap-2">
                        <TextField.Input
                          type="email"
                          placeholder={UI_LABELS.EMAIL_PLACEHOLDER}
                          disabled={isLoading()}
                          class="flex-1 px-4 py-3 rounded-lg border border-wa-border dark:border-wa-dark-border bg-wa-header dark:bg-wa-dark-header text-wa-text-primary dark:text-wa-dark-text-primary placeholder:text-wa-text-muted focus:outline-none focus:border-wa-teal transition-colors data-[invalid]:border-red-500"
                        />
                        <Button
                          type="submit"
                          disabled={isLoading() || !email().trim()}
                          class="px-4 py-2 rounded-lg bg-wa-sidebar-hover dark:bg-wa-dark-sidebar-hover text-wa-teal font-medium hover:bg-wa-border dark:hover:bg-wa-dark-border disabled:opacity-50 transition-colors"
                        >
                          {UI_LABELS.ADD}
                        </Button>
                      </div>
                      <Show when={errorMessage()}>
                        <TextField.ErrorMessage class="text-red-600 text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded">
                          {errorMessage()}
                        </TextField.ErrorMessage>
                      </Show>
                    </TextField>
                  </form>

                  <div class="flex flex-wrap gap-2 min-h-[50px] p-2 rounded-lg border border-wa-border dark:border-wa-dark-border bg-wa-header dark:bg-wa-dark-header">
                    <Show when={selectedContacts().length === 0}>
                      <span class="text-sm text-wa-text-muted italic p-1">
                        {UI_LABELS.NO_MEMBERS}
                      </span>
                    </Show>
                    <For each={selectedContacts()}>
                      {(c) => (
                        <div class="flex items-center gap-1 pl-3 pr-1 py-1 rounded-full bg-wa-teal/10 text-wa-teal text-sm">
                          <span>{c.displayName || c.email}</span>
                          <button
                            onClick={() => removeContact(c.id)}
                            class="p-1 hover:bg-wa-teal/20 rounded-full transition-colors"
                          >
                            <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
                              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </For>
                  </div>

                  <div class="flex justify-end gap-3 mt-4">
                    <Button
                      onClick={props.onClose}
                      disabled={isLoading()}
                      class="px-4 py-2 rounded-lg border border-wa-border dark:border-wa-dark-border text-wa-text-secondary dark:text-wa-dark-text-secondary hover:bg-wa-sidebar-hover dark:hover:bg-wa-dark-sidebar-hover bg-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-wa-teal focus:ring-offset-2"
                    >
                      {UI_LABELS.CANCEL}
                    </Button>
                    <Button
                      onClick={handleCreateGroup}
                      disabled={isLoading() || !groupName().trim() || selectedContacts().length === 0}
                      class="px-4 py-2 rounded-lg bg-wa-teal text-white font-medium hover:bg-wa-dark-green disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-wa-teal focus:ring-offset-2"
                    >
                      {isLoading() ? UI_LABELS.CREATING : UI_LABELS.CREATE_GROUP}
                    </Button>
                  </div>
                </div>
              </Tabs.Content>
            </Tabs>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  );
}
