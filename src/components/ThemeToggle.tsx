/**
 * ThemeToggle - Accessible button to cycle through light/dark/system themes
 */
import { Button } from '@kobalte/core/button';
import { theme, cycleTheme } from '../stores/theme';

export function ThemeToggle() {
  const getIcon = () => {
    const currentTheme = theme();
    if (currentTheme === 'light') {
      // Sun icon
      return (
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      );
    } else if (currentTheme === 'dark') {
      // Moon icon
      return (
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      );
    } else {
      // System/auto icon
      return (
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      );
    }
  };

  const getLabel = () => {
    const currentTheme = theme();
    if (currentTheme === 'light') return 'Light mode. Click to switch to dark mode.';
    if (currentTheme === 'dark') return 'Dark mode. Click to switch to system mode.';
    return 'System mode. Click to switch to light mode.';
  };

  return (
    <Button
      onClick={cycleTheme}
      aria-label={getLabel()}
      title={theme() === 'light' ? 'Light' : theme() === 'dark' ? 'Dark' : 'System'}
      class="w-9 h-9 flex items-center justify-center rounded-full text-wa-text-secondary dark:text-wa-dark-text-secondary hover:bg-wa-sidebar-hover dark:hover:bg-wa-dark-sidebar-hover transition-colors focus:outline-none focus:ring-2 focus:ring-wa-teal focus:ring-offset-2"
    >
      {getIcon()}
    </Button>
  );
}
