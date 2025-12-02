import { createSignal, Show, For, createEffect } from 'solid-js';
import { Dialog } from '@kobalte/core/dialog';
import { TextField } from '@kobalte/core/text-field';
import { Button } from '@kobalte/core/button';
import {
  renameGroup,
  addGroupMember,
  removeGroupMember,
  findUserByEmail,
} from '../services/messages';
import { user } from '../stores/auth';
import type { Chat } from '../types';
import { ERROR_MESSAGES } from '../constants/messages';

interface Props {
  chat: Chat;
  onClose: () => void;
  isOpen: boolean;
}

export function GroupInfoDialog(props: Props) {
  const [groupName, setGroupName] = createSignal(props.chat.groupName || '');
  const [newMemberEmail, setNewMemberEmail] = createSignal('');
  const [error, setError] = createSignal<string | null>(null);
  const [isProcessing, setIsProcessing] = createSignal(false);

  // Sync group name when chat prop changes
  createEffect(() => {
    setGroupName(props.chat.groupName || '');
  });

  const currentUser = user();
  const isOwner = () => !props.chat.ownerId || (currentUser && props.chat.ownerId === currentUser.uid);

  async function handleRename(e: Event) {
    e.preventDefault();
    if (!isOwner()) return;
    const name = groupName().trim();
    if (!name || name === props.chat.groupName) return;

    setIsProcessing(true);
    try {
      await renameGroup(props.chat.id, name);
    } catch (err) {
      console.error('Failed to rename group:', err);
      setError('Failed to rename group');
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleAddMember(e: Event) {
    e.preventDefault();
    if (!isOwner()) return;
    const email = newMemberEmail().trim();
    if (!email) return;

    if (email.toLowerCase() === currentUser?.email?.toLowerCase()) {
      setError(ERROR_MESSAGES.SELF_ADD_GROUP);
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const targetUser = await findUserByEmail(email);
      if (!targetUser) {
        setError(ERROR_MESSAGES.USER_NOT_FOUND);
        setIsProcessing(false);
        return;
      }

      if (props.chat.participants && props.chat.participants[targetUser.id]) {
        setError(ERROR_MESSAGES.USER_ALREADY_ADDED);
        setIsProcessing(false);
        return;
      }

      const memberName = targetUser.displayName || targetUser.email || 'Unknown';
      await addGroupMember(props.chat.id, targetUser.id, memberName);
      setNewMemberEmail('');
    } catch (err) {
      console.error('Failed to add member:', err);
      setError('Failed to add member');
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!isOwner()) return;
    if (!confirm('Are you sure you want to remove this member?')) return;

    setIsProcessing(true);
    try {
      await removeGroupMember(props.chat.id, memberId);
    } catch (err) {
      console.error('Failed to remove member:', err);
      setError('Failed to remove member');
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleLeaveGroup() {
    if (!confirm('Are you sure you want to leave this group?')) return;

    if (!currentUser) return;

    setIsProcessing(true);
    try {
      await removeGroupMember(props.chat.id, currentUser.uid);
      props.onClose();
    } catch (err) {
      console.error('Failed to leave group:', err);
      setError('Failed to leave group');
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <Dialog open={props.isOpen} onOpenChange={(open) => !open && props.onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 bg-black/50 z-50" />
        <div class="fixed inset-0 z-50 flex items-center justify-center">
          <Dialog.Content class="bg-white dark:bg-wa-dark-sidebar rounded-lg p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between mb-4">
              <Dialog.Title class="text-lg font-semibold text-wa-text-primary dark:text-wa-dark-text-primary">
                Group Info
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

            <div class="flex flex-col gap-6">
              {/* Rename Group */}
              <div class="flex gap-2 items-end">
                <TextField value={groupName()} onChange={setGroupName} disabled={!isOwner()} class="flex-1">
                    <TextField.Label class="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary mb-1 block">
                      Group Name
                    </TextField.Label>
                    <TextField.Input
                      class="w-full px-3 py-2 rounded-lg border border-wa-border dark:border-wa-dark-border bg-wa-header dark:bg-wa-dark-header text-wa-text-primary dark:text-wa-dark-text-primary focus:outline-none focus:border-wa-teal disabled:opacity-50"
                    />
                </TextField>
                <Show when={isOwner()}>
                  <Button
                      onClick={handleRename}
                      disabled={isProcessing() || !groupName() || groupName() === props.chat.groupName}
                      class="px-4 py-2 bg-wa-teal text-white rounded-lg hover:bg-wa-dark-green disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                      Save
                  </Button>
                </Show>
              </div>

              <div class="h-px bg-wa-border dark:bg-wa-dark-border" />

              {/* Add Member */}
              <Show when={isOwner()}>
                <form onSubmit={handleAddMember} class="flex flex-col gap-2">
                   <TextField value={newMemberEmail()} onChange={setNewMemberEmail} class="flex-1">
                      <TextField.Label class="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary mb-1 block">
                        Add Member
                      </TextField.Label>
                      <div class="flex gap-2">
                          <TextField.Input
                            placeholder="user@example.com"
                            class="flex-1 px-3 py-2 rounded-lg border border-wa-border dark:border-wa-dark-border bg-wa-header dark:bg-wa-dark-header text-wa-text-primary dark:text-wa-dark-text-primary focus:outline-none focus:border-wa-teal"
                          />
                          <Button
                              type="submit"
                              disabled={isProcessing() || !newMemberEmail()}
                              class="px-4 py-2 bg-wa-teal text-white rounded-lg hover:bg-wa-dark-green disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                              Add
                          </Button>
                      </div>
                  </TextField>
                  <Show when={error()}>
                      <p class="text-red-500 text-sm">{error()}</p>
                  </Show>
                </form>
              </Show>

              {/* Members List */}
              <div>
                <h3 class="text-sm font-semibold text-wa-text-secondary dark:text-wa-dark-text-secondary mb-2">Members ({Object.keys(props.chat.participants || {}).length})</h3>
                <div class="max-h-40 overflow-y-auto border border-wa-border dark:border-wa-dark-border rounded-lg">
                    <For each={Object.entries(props.chat.participantNames || {})}>
                        {([id, name]) => {
                             const isMe = id === currentUser?.uid;
                             return (
                                <div class="flex items-center justify-between px-3 py-2 hover:bg-wa-sidebar-hover dark:hover:bg-wa-dark-sidebar-hover border-b border-wa-border dark:border-wa-dark-border last:border-0">
                                    <span class="text-wa-text-primary dark:text-wa-dark-text-primary text-sm">
                                        {name} {isMe ? '(You)' : ''}
                                        {props.chat.ownerId === id ? <span class="ml-2 text-xs bg-wa-teal text-white px-1.5 py-0.5 rounded-full">Owner</span> : ''}
                                    </span>
                                    <Show when={!isMe && isOwner()}>
                                        <Button
                                            onClick={() => handleRemoveMember(id)}
                                            class="text-red-500 hover:text-red-700 text-sm"
                                            title="Remove member"
                                        >
                                            Remove
                                        </Button>
                                    </Show>
                                </div>
                             );
                        }}
                    </For>
                </div>
              </div>

              {/* Leave Group */}
              <div class="pt-2">
                <Button
                    onClick={handleLeaveGroup}
                    class="w-full py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-900 transition-colors"
                >
                    Leave Group
                </Button>
              </div>

            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  );
}
