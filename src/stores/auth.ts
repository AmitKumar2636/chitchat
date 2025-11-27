// Auth store - reactive state for authentication
// Wrapped in createRoot to ensure proper signal disposal
import { createSignal, createRoot } from 'solid-js';
import { onAuthChange, type AuthUser } from '../services/auth';

// Create signals within a root to ensure proper lifecycle management
const { user, loading, error, setUser, setLoading, setError } = createRoot(() => {
  const [user, setUser] = createSignal<AuthUser | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  return { user, loading, error, setUser, setLoading, setError };
});

// Initialize auth listener
let unsubscribe: (() => void) | null = null;

export function initAuthListener() {
  if (unsubscribe) return; // Already initialized

  unsubscribe = onAuthChange((authUser) => {
    setUser(authUser);
    setLoading(false);
  });
}

export function cleanupAuthListener() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}

export function setAuthError(err: string | null) {
  setError(err);
}

export function clearAuthError() {
  setError(null);
}

export { user, loading, error };
