/**
 * LoginForm component
 * -------------------
 * Presents a basic email/password login form. The form uses the
 * `authClient` from Better Auth to sign in the user. On successful
 * sign-in the user is redirected to the admin page.
 */
import { createSignal } from 'solid-js';
import type { JSX } from 'solid-js';
import { authClient } from '../../../../../lib/auth-client';

export function LoginForm(): JSX.Element {
  const [status, setStatus] = createSignal('');

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const email = form.email.value as string;
    const password = form.password.value as string;
    const { error } = await authClient.signIn.email({ email, password });
    if (error) {
      setStatus(error.message || 'Login failed');
    } else {
      window.location.href = '/admin';
    }
  };

  return (
    <form class="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label for="email" class="block text-sm font-medium">Email</label>
        <input id="email" name="email" type="email" required class="w-full border rounded-md p-2" />
      </div>
      <div>
        <label for="password" class="block text-sm font-medium">Password</label>
        <input id="password" name="password" type="password" required class="w-full border rounded-md p-2" />
      </div>
      <button type="submit" class="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md">Login</button>
      <p class="text-sm text-center">{status()}</p>
    </form>
  );
}
