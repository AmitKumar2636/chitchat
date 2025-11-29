// Login component with Kobalte + Tailwind CSS
import { createSignal, Show } from 'solid-js';
import { TextField } from '@kobalte/core/text-field';
import { Button } from '@kobalte/core/button';
import { signIn, signUp } from '../services/auth';

import { ERROR_MESSAGES, UI_LABELS } from '../constants/messages';

export function Login() {
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [displayName, setDisplayName] = createSignal('');
  const [isSignUp, setIsSignUp] = createSignal(false);

  type LoginState =
    | { status: 'idle' }
    | { status: 'submitting' }
    | { status: 'error'; message: string };

  const [loginState, setLoginState] = createSignal<LoginState>({ status: 'idle' });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setLoginState({ status: 'submitting' });

    try {
      if (isSignUp()) {
        await signUp(email(), password(), displayName());
      } else {
        await signIn(email(), password());
      }
      // Success will redirect via auth listener, no need to set state
    } catch (err) {
      const message = err instanceof Error ? err.message : ERROR_MESSAGES.AUTH_FAILED;
      setLoginState({ status: 'error', message });
    }
  }

  return (
    <main
      class="flex flex-col items-center justify-center min-h-screen p-8"
      style="background: linear-gradient(180deg, #075e54 0%, #075e54 30%, #efeae2 30%)"
    >
      <h1 class="text-4xl font-bold text-white mb-2">{UI_LABELS.APP_TITLE}</h1>
      <h2 class="text-lg text-white/85 mb-8">{isSignUp() ? UI_LABELS.CREATE_ACCOUNT : UI_LABELS.SIGN_IN}</h2>

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
            <TextField.Label class="sr-only">{UI_LABELS.DISPLAY_NAME}</TextField.Label>
            <TextField.Input
              placeholder={UI_LABELS.DISPLAY_NAME}
              autocomplete="off"
              class="w-full px-4 py-3 bg-wa-header dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-lg text-wa-text-primary dark:text-wa-dark-text-primary placeholder:text-wa-text-muted focus:outline-none focus:border-wa-teal focus:bg-white dark:focus:bg-wa-dark-sidebar transition-colors"
            />
          </TextField>
        )}

        <TextField value={email()} onChange={setEmail} required class="flex flex-col gap-1">
          <TextField.Label class="sr-only">{UI_LABELS.EMAIL}</TextField.Label>
          <TextField.Input
            type="email"
            placeholder={UI_LABELS.EMAIL}
            autocomplete="off"
            class="w-full px-4 py-3 bg-wa-header dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-lg text-wa-text-primary dark:text-wa-dark-text-primary placeholder:text-wa-text-muted focus:outline-none focus:border-wa-teal focus:bg-white dark:focus:bg-wa-dark-sidebar transition-colors"
          />
        </TextField>

        <TextField value={password()} onChange={setPassword} required class="flex flex-col gap-1">
          <TextField.Label class="sr-only">{UI_LABELS.PASSWORD}</TextField.Label>
          <TextField.Input
            type="password"
            placeholder={UI_LABELS.PASSWORD}
            autocomplete="off"
            class="w-full px-4 py-3 bg-wa-header dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-lg text-wa-text-primary dark:text-wa-dark-text-primary placeholder:text-wa-text-muted focus:outline-none focus:border-wa-teal focus:bg-white dark:focus:bg-wa-dark-sidebar transition-colors"
          />
        </TextField>

        <Show when={loginState().status === 'error'}>
          <p class="text-red-600 text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded" role="alert">
            {(loginState() as { message: string }).message}
          </p>
        </Show>

        <Button
          type="submit"
          disabled={loginState().status === 'submitting'}
          class="w-full px-4 py-3 bg-wa-teal text-white font-medium rounded-lg hover:bg-wa-dark-green disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-wa-teal focus:ring-offset-2"
        >
          {loginState().status === 'submitting' ? UI_LABELS.LOADING : isSignUp() ? UI_LABELS.SIGN_UP : UI_LABELS.SIGN_IN}
        </Button>
      </form>

      <p class="mt-4 text-wa-text-secondary dark:text-wa-dark-text-secondary bg-white dark:bg-wa-dark-sidebar p-4 rounded-lg">
        {isSignUp() ? UI_LABELS.ALREADY_HAVE_ACCOUNT : UI_LABELS.DONT_HAVE_ACCOUNT}
        <Button
          onClick={() => {
            setIsSignUp(!isSignUp());
            setLoginState({ status: 'idle' });
          }}
          class="ml-2 text-wa-teal font-medium hover:underline focus:outline-none focus:underline bg-transparent"
        >
          {isSignUp() ? UI_LABELS.SIGN_IN : UI_LABELS.SIGN_UP}
        </Button>
      </p>
    </main>
  );
}
