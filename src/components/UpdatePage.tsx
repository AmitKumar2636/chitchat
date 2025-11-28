/**
 * UpdatePage - Full-page update screen shown when updates are available
 */
import { createSignal, Show } from 'solid-js';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

interface UpdatePageProps {
  version: string;
  releaseNotes?: string;
  onSkip: () => void;
}

export function UpdatePage(props: UpdatePageProps) {
  const [downloading, setDownloading] = createSignal(false);
  const [downloadProgress, setDownloadProgress] = createSignal(0);
  const [downloadedBytes, setDownloadedBytes] = createSignal(0);
  const [totalBytes, setTotalBytes] = createSignal(0);
  const [error, setError] = createSignal<string | null>(null);
  const [status, setStatus] = createSignal<'idle' | 'downloading' | 'installing'>('idle');

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async function handleUpdate() {
    try {
      setDownloading(true);
      setError(null);
      setStatus('downloading');
      setDownloadedBytes(0);
      setTotalBytes(0);

      const update = await check();
      if (!update) {
        setError('Update no longer available. Please try again later.');
        setDownloading(false);
        setStatus('idle');
        return;
      }

      let downloaded = 0;

      // Download and install
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          const data = event.data as { contentLength?: number };
          if (data.contentLength) {
            setTotalBytes(data.contentLength);
          }
        } else if (event.event === 'Progress') {
          const progress = event.data as { chunkLength: number; contentLength?: number };
          downloaded += progress.chunkLength;
          setDownloadedBytes(downloaded);

          const total = totalBytes() || progress.contentLength;
          if (total) {
            setDownloadProgress(Math.round((downloaded / total) * 100));
          }
        } else if (event.event === 'Finished') {
          setStatus('installing');
          setDownloadProgress(100);
        }
      });

      // Relaunch the app
      await relaunch();
    } catch (err) {
      console.error('Failed to install update:', err);
      setError('Failed to install update. Please try again later.');
      setDownloading(false);
      setStatus('idle');
    }
  }

  return (
    <div class="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-wa-dark-green to-wa-teal dark:from-gray-900 dark:to-gray-800 z-50">
      <div class="bg-white dark:bg-wa-dark-sidebar rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header with icon */}
        <div class="bg-wa-dark-green dark:bg-wa-dark-header px-8 py-10 text-center">
          <div class="w-20 h-20 mx-auto mb-4 bg-white/20 rounded-full flex items-center justify-center">
            <svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </div>
          <h1 class="text-2xl font-bold text-white mb-2">Update Available</h1>
          <p class="text-white/80 text-lg">Version {props.version}</p>
        </div>

        {/* Content */}
        <div class="px-8 py-6">
          <Show when={error()}>
            <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
              <p class="text-red-600 dark:text-red-400 text-sm">{error()}</p>
            </div>
          </Show>

          <Show when={!downloading()}>
            <p class="text-wa-text-secondary dark:text-wa-dark-text-secondary text-center mb-6">
              A new version of Chitchat is ready to install. Update now to get the latest features
              and improvements.
            </p>
          </Show>

          <Show when={downloading()}>
            <div class="mb-6">
              <div class="flex justify-between text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary mb-2">
                <span>{status() === 'installing' ? 'Installing...' : 'Downloading...'}</span>
                <span>{downloadProgress()}%</span>
              </div>
              <div class="bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  class="bg-wa-dark-green dark:bg-wa-teal h-full transition-all duration-300 ease-out"
                  style={{ width: `${downloadProgress()}%` }}
                />
              </div>
              <Show when={totalBytes() > 0}>
                <p class="text-xs text-wa-text-muted dark:text-wa-dark-text-muted mt-2 text-center">
                  {formatBytes(downloadedBytes())} / {formatBytes(totalBytes())}
                </p>
              </Show>
              <Show when={status() === 'installing'}>
                <p class="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary mt-4 text-center">
                  Installing update... The app will restart automatically.
                </p>
              </Show>
            </div>
          </Show>

          {/* Buttons */}
          <div class="flex flex-col gap-3">
            <button
              onClick={handleUpdate}
              disabled={downloading()}
              class="w-full px-6 py-3 bg-wa-dark-green hover:bg-wa-dark-green/90 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-wa-dark-green focus:ring-offset-2 dark:focus:ring-offset-wa-dark-sidebar"
            >
              <Show when={downloading()} fallback="Update Now">
                <div class="flex items-center justify-center gap-2">
                  <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      class="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      stroke-width="4"
                    />
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>{status() === 'installing' ? 'Installing...' : 'Downloading...'}</span>
                </div>
              </Show>
            </button>
            <button
              onClick={props.onSkip}
              disabled={downloading()}
              class="w-full px-6 py-3 text-wa-text-secondary dark:text-wa-dark-text-secondary hover:bg-gray-100 dark:hover:bg-wa-dark-sidebar-hover font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600"
            >
              Remind Me Later
            </button>
          </div>
        </div>

        {/* Footer */}
        <div class="px-8 py-4 bg-gray-50 dark:bg-wa-dark-header/50 border-t border-gray-200 dark:border-wa-dark-border">
          <p class="text-xs text-wa-text-muted dark:text-wa-dark-text-muted text-center">
            The app will restart automatically after the update is installed.
          </p>
        </div>
      </div>
    </div>
  );
}
