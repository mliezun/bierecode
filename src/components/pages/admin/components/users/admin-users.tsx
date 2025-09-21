import { For, Show, createSignal, onMount } from 'solid-js';
import type { Session, User } from 'better-auth';

interface AdminUsersProps {
  session: Session | null;
  user: (User & { role?: string | null }) | null;
}

interface AdminAccount {
  id: string;
  name: string;
  email: string;
  role: string | null;
  createdAt: string;
  updatedAt: string;
}

const ROLE_OPTIONS: Array<{ value: string; label: string; description: string }> = [
  { value: '', label: 'No role', description: 'Can sign in but has no admin permissions.' },
  { value: 'manager', label: 'Manager', description: 'Can create and edit community updates.' },
  { value: 'admin', label: 'Admin', description: 'Full access including role management.' },
];

export function AdminUsers(_props: AdminUsersProps) {
  const [users, setUsers] = createSignal<AdminAccount[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [saving, setSaving] = createSignal<string | null>(null);
  const [feedback, setFeedback] = createSignal<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error(`Request failed with ${res.status}`);
      const data = (await res.json()) as AdminAccount[];
      setUsers(data);
    } catch (err) {
      console.error('Failed to fetch users', err);
      setError('Unable to load users at the moment.');
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (id: string, role: string) => {
    setSaving(id);
    setFeedback(null);
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, role }),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = (await res.json()) as AdminAccount;
      setUsers((current) => current.map((account) => (account.id === id ? updated : account)));
      setFeedback('User role updated successfully.');
    } catch (err) {
      console.error('Failed to update user role', err);
      setFeedback('Unable to update role. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  onMount(() => {
    void loadUsers();
  });

  return (
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-xl font-semibold text-gray-900">Team members</h2>
          <p class="text-sm text-gray-600">Invite collaborators and manage access levels.</p>
        </div>
        <button
          type="button"
          class="px-3 py-2 rounded-md border border-yellow-300 text-yellow-800 text-sm hover:bg-yellow-100 transition"
          onClick={() => void loadUsers()}
          disabled={loading()}
        >
          {loading() ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <Show when={feedback()}>
        <p class="text-sm text-emerald-600">{feedback()}</p>
      </Show>
      <Show when={error()}>
        <p class="text-sm text-red-600">{error()}</p>
      </Show>

      <div class="overflow-hidden rounded-2xl border border-yellow-100 bg-white shadow-sm">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-yellow-100">
            <thead class="bg-yellow-50/80 text-xs uppercase tracking-wide text-yellow-700">
              <tr>
                <th scope="col" class="px-6 py-3 text-left font-semibold">Name</th>
                <th scope="col" class="px-6 py-3 text-left font-semibold">Email</th>
                <th scope="col" class="px-6 py-3 text-left font-semibold">Role</th>
                <th scope="col" class="px-6 py-3 text-left font-semibold">Last updated</th>
                <th scope="col" class="px-6 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-yellow-50 text-sm text-gray-700">
              <For each={users()}>
                {(account) => (
                  <tr class="hover:bg-yellow-50/60">
                    <td class="px-6 py-4">
                      <p class="font-semibold text-gray-900">{account.name ?? 'Unnamed user'}</p>
                    </td>
                    <td class="px-6 py-4">
                      <p class="text-gray-600">{account.email}</p>
                    </td>
                    <td class="px-6 py-4">
                      <div class="space-y-1">
                        <select
                          class="w-full border border-yellow-200 rounded-lg px-3 py-2 text-sm"
                          value={account.role ?? ''}
                          onChange={(event) => updateRole(account.id, event.currentTarget.value)}
                          disabled={saving() === account.id}
                        >
                          <For each={ROLE_OPTIONS}>
                            {(option) => (
                              <option value={option.value}>{option.label}</option>
                            )}
                          </For>
                        </select>
                        <p class="text-xs text-gray-500">
                          {ROLE_OPTIONS.find((option) => option.value === (account.role ?? ''))?.description ?? ROLE_OPTIONS[0].description}
                        </p>
                      </div>
                    </td>
                    <td class="px-6 py-4 text-xs text-gray-500">
                      {formatDateTime(account.updatedAt)}
                    </td>
                    <td class="px-6 py-4 text-right text-xs text-gray-400">
                      ID {account.id}
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}
