/**
 * LoginForm component
 * -------------------
 * Presents a passwordless login form using Better Auth.
 * Users may request a magic link via email or authenticate through
 * GitHub OAuth. Both flows rely on Better Auth plugins configured on
 * the server and share the same session cookie handling.
 */
import { createSignal } from 'solid-js';
import type { JSX } from 'solid-js';
import { authClient } from '../../../../../lib/auth-client';

export function LoginForm(): JSX.Element {
  const [status, setStatus] = createSignal('');

  const handleMagicLink = async (e: Event) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const email = form.email.value as string;
    const { error } = await authClient.signIn.magicLink({ email });
    if (error) {
      setStatus(error.message || 'Request failed');
    } else {
      setStatus('Check your inbox for the magic link.');
    }
  };

  const handleGithub = async () => {
    const { error } = await authClient.signIn.genericOAuth({ providerId: 'github' });
    if (error) setStatus(error.message || 'GitHub sign-in failed');
  };

  return (
    <div class="flex items-center justify-center min-h-screen bg-gradient-to-br from-yellow-50 to-white">
      <form class="w-full max-w-md space-y-5 bg-white/70 backdrop-blur-md p-8 rounded-xl shadow-lg" onSubmit={handleMagicLink}>
        <h1 class="text-3xl font-bold text-center">Login</h1>
        <div>
          <label for="email" class="block text-sm font-medium">Email</label>
          <input id="email" name="email" type="email" required class="w-full border rounded-md p-2" />
        </div>
        <button type="submit" class="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md w-full">Send Magic Link</button>
        <button type="button" class="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-md w-full" onClick={handleGithub}>Sign in with GitHub</button>
        <p class="text-sm text-center">{status()}</p>
      </form>
    </div>
  );
}
