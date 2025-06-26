/**
 * AdminPage component
 * -------------------
 * Ensures the user is authenticated before rendering the AdminForm.
 * If no session exists the user is redirected to the login page.
 */
import { createSignal, onMount, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { authClient } from '../../../../lib/auth-client';
import { AdminForm } from './admin-form/admin-form';

export function AdminPage(): JSX.Element {
  const [ready, setReady] = createSignal(false);
  onMount(async () => {
    const { data } = await authClient.getSession();
    if (!data?.session) {
      window.location.href = '/login';
    } else {
      setReady(true);
    }
  });
  return <Show when={ready()} fallback={<p>Checking session...</p>}><AdminForm /></Show>;
}
