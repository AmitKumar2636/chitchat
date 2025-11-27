/**
 * UpdateChecker - Checks for app updates and prompts user to install
 */
import { createSignal, onMount, Show } from 'solid-js';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export function UpdateChecker() {
  const [updateAvailable, setUpdateAvailable] = createSignal(false);
  const [updateVersion, setUpdateVersion] = createSignal('');
  const [downloading, setDownloading] = createSignal(false);
  const [downloadProgress, setDownloadProgress] = createSignal(0);
  const [error, setError] = createSignal<string | null>(null);

  onMount(async () => {
    try {
      console.log('[UpdateChecker] Checking for updates...');
      const update = await check();
      console.log('[UpdateChecker] Check result:', update);
      if (update) {
        console.log('[UpdateChecker] Update available:', update.version);
        setUpdateAvailable(true);
        setUpdateVersion(update.version);
      } else {
        console.log('[UpdateChecker] No update available');
      }
    } catch (err) {
      console.error('[UpdateChecker] Failed to check for updates:', err);
      // Don't show error to user - update check failures are not critical
    }
  });

  async function handleUpdate() {
    try {
      setDownloading(true);
      setError(null);
      
      const update = await check();
      if (!update) return;

      // Download and install
      await update.downloadAndInstall((event) => {
        if (event.event === 'Progress') {
          const progress = event.data as { chunkLength: number; contentLength?: number };
          if (progress.contentLength) {
            setDownloadProgress(Math.round((progress.chunkLength / progress.contentLength) * 100));
          }
        }
      });

      // Relaunch the app
      await relaunch();
    } catch (err) {
      console.error('Failed to install update:', err);
      setError('Failed to install update. Please try again later.');
      setDownloading(false);
    }
  }

  function dismissUpdate() {
    setUpdateAvailable(false);
  }

  return (
    <Show when={updateAvailable()}>
      <div 
        class="fixed bottom-4 right-4 bg-wa-dark-green text-white p-4 rounded-lg shadow-lg max-w-sm z-50"
        role="alertdialog"
        aria-labelledby="update-title"
        aria-describedby="update-desc"
      >
        <h3 id="update-title" class="font-semibold text-lg mb-2">
          Update Available
        </h3>
        <p id="update-desc" class="text-sm mb-4">
          Version {updateVersion()} is ready to install.
        </p>
        
        <Show when={error()}>
          <p class="text-red-300 text-sm mb-2">{error()}</p>
        </Show>

        <Show when={downloading()}>
          <div class="mb-4">
            <div class="bg-white/20 rounded-full h-2 overflow-hidden">
              <div 
                class="bg-white h-full transition-all duration-300"
                style={{ width: `${downloadProgress()}%` }}
              />
            </div>
            <p class="text-xs mt-1">Downloading... {downloadProgress()}%</p>
          </div>
        </Show>

        <div class="flex gap-2">
          <button
            onClick={handleUpdate}
            disabled={downloading()}
            class="flex-1 px-4 py-2 bg-white text-wa-dark-green font-medium rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-wa-dark-green"
          >
            {downloading() ? 'Installing...' : 'Update Now'}
          </button>
          <button
            onClick={dismissUpdate}
            disabled={downloading()}
            class="px-4 py-2 border border-white/50 rounded hover:bg-white/10 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-white"
            aria-label="Dismiss update notification"
          >
            Later
          </button>
        </div>
      </div>
    </Show>
  );
}
