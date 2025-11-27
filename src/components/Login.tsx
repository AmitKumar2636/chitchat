// Login component with Kobalte + Tailwind CSS
import { createSignal } from 'solid-js';
import { TextField } from '@kobalte/core/text-field';
import { Button } from '@kobalte/core/button';
import { signIn, signUp } from '../services/auth';
import { setAuthError, error, clearAuthError } from '../stores/auth';

export function Login() {
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [displayName, setDisplayName] = createSignal('');
  const [isSignUp, setIsSignUp] = createSignal(false);
  const [loading, setLoading] = createSignal(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    clearAuthError();
    setLoading(true);

    try {
      if (isSignUp()) {
        await signUp(email(), password(), displayName());
      } else {
        await signIn(email(), password());
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main 
      class="flex flex-col items-center justify-center min-h-screen p-8"
      style="background: linear-gradient(180deg, #075e54 0%, #075e54 30%, #efeae2 30%)"
    >
      <h1 class="text-4xl font-bold text-white mb-2">Chitchat</h1>
      <h2 class="text-lg text-white/85 mb-8">
        {isSignUp() ? 'Create Account' : 'Sign In'}
      </h2>

      <form 
        onSubmit={handleSubmit} 
        autocomplete="off"
        class="flex flex-col gap-4 w-full max-w-[360px] bg-white dark:bg-wa-dark-sidebar p-8 rounded-lg shadow-lg"
      >
        {isSignUp() && (
          <TextField 
            value={displayName()} 
            onChange={setDisplayName}
            required
            class="flex flex-col gap-1"
          >
            <TextField.Label class="sr-only">Display Name</TextField.Label>
            <TextField.Input
              placeholder="Display Name"
              autocomplete="off"
              class="w-full px-4 py-3 bg-wa-header dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-lg text-wa-text-primary dark:text-wa-dark-text-primary placeholder:text-wa-text-muted focus:outline-none focus:border-wa-teal focus:bg-white dark:focus:bg-wa-dark-sidebar transition-colors"
            />
          </TextField>
        )}
        
        <TextField 
          value={email()} 
          onChange={setEmail}
          required
          class="flex flex-col gap-1"
        >
          <TextField.Label class="sr-only">Email</TextField.Label>
          <TextField.Input
            type="email"
            placeholder="Email"
            autocomplete="off"
            class="w-full px-4 py-3 bg-wa-header dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-lg text-wa-text-primary dark:text-wa-dark-text-primary placeholder:text-wa-text-muted focus:outline-none focus:border-wa-teal focus:bg-white dark:focus:bg-wa-dark-sidebar transition-colors"
          />
        </TextField>
        
        <TextField 
          value={password()} 
          onChange={setPassword}
          required
          class="flex flex-col gap-1"
        >
          <TextField.Label class="sr-only">Password</TextField.Label>
          <TextField.Input
            type="password"
            placeholder="Password"
            autocomplete="off"
            class="w-full px-4 py-3 bg-wa-header dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-lg text-wa-text-primary dark:text-wa-dark-text-primary placeholder:text-wa-text-muted focus:outline-none focus:border-wa-teal focus:bg-white dark:focus:bg-wa-dark-sidebar transition-colors"
          />
        </TextField>

        {error() && (
          <p 
            class="text-red-600 text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded" 
            role="alert"
          >
            {error()}
          </p>
        )}

        <Button
          type="submit"
          disabled={loading()}
          class="w-full px-4 py-3 bg-wa-teal text-white font-medium rounded-lg hover:bg-wa-dark-green disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-wa-teal focus:ring-offset-2"
        >
          {loading() ? 'Loading...' : isSignUp() ? 'Sign Up' : 'Sign In'}
        </Button>
      </form>

      <p class="mt-4 text-wa-text-secondary dark:text-wa-dark-text-secondary bg-white dark:bg-wa-dark-sidebar p-4 rounded-lg">
        {isSignUp() ? 'Already have an account?' : "Don't have an account?"}
        <Button
          onClick={() => {
            setIsSignUp(!isSignUp());
            clearAuthError();
          }}
          class="ml-2 text-wa-teal font-medium hover:underline focus:outline-none focus:underline bg-transparent"
        >
          {isSignUp() ? 'Sign In' : 'Sign Up'}
        </Button>
      </p>
    </main>
  );
}
