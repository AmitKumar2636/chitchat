/**
 * UpdateChecker - Checks for app updates on mount and exposes update state
 */
import { createSignal, onMount } from 'solid-js';
import { check } from '@tauri-apps/plugin-updater';

// Global signals for update state - can be imported by other components
const [updateAvailable, setUpdateAvailable] = createSignal(false);
const [updateVersion, setUpdateVersion] = createSignal('');
const [updateDismissed, setUpdateDismissed] = createSignal(false);

// Export the signals for use in App.tsx
export { updateAvailable, updateVersion, updateDismissed };

// Function to dismiss the update (user chooses "Remind Me Later")
export function dismissUpdate() {
  setUpdateDismissed(true);
}

// Function to show the update page again (if previously dismissed)
export function showUpdatePage() {
  setUpdateDismissed(false);
}

/**
 * UpdateChecker component - renders nothing, just checks for updates on mount
 */
export function UpdateChecker() {
  onMount(async () => {
    try {
      const update = await check();
      if (update) {
        setUpdateAvailable(true);
        setUpdateVersion(update.version);
      }
    } catch (err) {
      console.error('[UpdateChecker] Failed to check for updates:', err);
      // Don't show error to user - update check failures are not critical
    }
  });

  // This component doesn't render anything - the UpdatePage is rendered by App.tsx
  return null;
}
