// Theme store - reactive state for dark/light mode
// Wrapped in createRoot to ensure proper signal disposal
import { createSignal, createEffect, createRoot, on } from 'solid-js';

type Theme = 'light' | 'dark' | 'system';

// Create signals within a root to ensure proper lifecycle management
const store = createRoot(() => {
  // Get initial theme from localStorage or default to 'system'
  const getInitialTheme = (): Theme => {
    if (typeof window === 'undefined') return 'system';
    const stored = localStorage.getItem('chitchat-theme') as Theme | null;
    return stored || 'system';
  };

  const [theme, setTheme] = createSignal<Theme>(getInitialTheme());

  // Computed: is dark mode actually active?
  const isDark = (): boolean => {
    const currentTheme = theme();
    if (currentTheme === 'dark') return true;
    if (currentTheme === 'light') return false;
    // System preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  };

  return { theme, setTheme, isDark };
});

const { theme, setTheme: setThemeInternal, isDark } = store;

// Apply theme to document and persist to localStorage
createRoot(() => {
  createEffect(
    on(theme, (currentTheme) => {
      // Persist to localStorage
      localStorage.setItem('chitchat-theme', currentTheme);

      // Apply dark class to document
      const dark =
        currentTheme === 'dark' ||
        (currentTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

      if (dark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    })
  );

  // Listen for system theme changes when in 'system' mode
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleSystemChange = () => {
    if (theme() === 'system') {
      // Force reactivity by re-reading the theme
      const dark = mediaQuery.matches;
      if (dark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  };

  mediaQuery.addEventListener('change', handleSystemChange);
});

// Public API
export function setTheme(newTheme: Theme) {
  setThemeInternal(newTheme);
}

export function toggleTheme() {
  const current = theme();
  if (current === 'light') {
    setThemeInternal('dark');
  } else if (current === 'dark') {
    setThemeInternal('system');
  } else {
    setThemeInternal('light');
  }
}

export function cycleTheme(): Theme {
  toggleTheme();
  return theme();
}

export { theme, isDark };
