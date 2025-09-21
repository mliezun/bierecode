import { createEffect, createSignal, For, Match, Switch } from 'solid-js';
import type { Session, User } from 'better-auth';
import { AdminUpdates } from '../admin-form/admin-form';
import { AdminUsers } from '../users/admin-users';

interface AdminDashboardProps {
  initialSession: Session | null;
  initialUser: (User & { role?: string | null }) | null;
}

type Section = 'updates' | 'users';

type NavItem = {
  id: Section;
  label: string;
  description: string;
};

const BASE_NAV: NavItem[] = [
  {
    id: 'updates',
    label: 'Community updates',
    description: 'Publish announcements and manage past posts.',
  },
];

const USERS_NAV: NavItem = {
  id: 'users',
  label: 'Users',
  description: 'Review accounts and adjust roles.',
};

export function AdminDashboard(props: AdminDashboardProps) {
  const [session, setSession] = createSignal<Session | null>(props.initialSession);
  const [user, setUser] = createSignal<(User & { role?: string | null }) | null>(props.initialUser);
  const [active, setActive] = createSignal<Section>('updates');

  const navItems = () => {
    const items = [...BASE_NAV];
    if ((user()?.role ?? 'user') === 'admin') {
      items.push(USERS_NAV);
    }
    return items;
  };

  createEffect(() => {
    const available = navItems();
    if (!available.find((item) => item.id === active())) {
      setActive(available[0]?.id ?? 'updates');
    }
  });

  const onSessionChange = (nextSession: Session | null, nextUser: (User & { role?: string | null }) | null) => {
    setSession(nextSession);
    setUser(nextUser);
  };

  return (
    <div class="min-h-screen grid lg:grid-cols-[260px_1fr] bg-gradient-to-br from-yellow-100 via-white to-white text-gray-900">
      <aside class="bg-white/90 backdrop-blur border-r border-yellow-100">
        <div class="px-6 py-8 space-y-8">
          <div class="space-y-2">
            <div class="flex items-center gap-3">
              <div class="h-10 w-10 rounded-full bg-yellow-500 flex items-center justify-center text-white font-semibold">BC</div>
              <div>
                <p class="text-xs uppercase tracking-[0.35em] text-yellow-700 font-semibold">Dashboard</p>
                <p class="text-base font-semibold text-gray-900">Bière &amp; Code</p>
              </div>
            </div>
            <p class="text-sm text-gray-600">
              Manage community content and future tools from one place.
            </p>
          </div>

          <nav class="space-y-1">
            <For each={navItems()}>
              {(item) => (
                <button
                  type="button"
                  class={`w-full text-left px-4 py-3 rounded-xl transition-all border ${
                    active() === item.id
                      ? 'bg-yellow-500/10 border-yellow-400 text-yellow-800 font-semibold shadow-sm'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-yellow-50'
                  }`}
                  onClick={() => setActive(item.id)}
                >
                  <span class="block text-sm">{item.label}</span>
                  <span class="block text-xs text-gray-500">{item.description}</span>
                </button>
              )}
            </For>
          </nav>
        </div>
      </aside>

      <main class="relative bg-white/60 backdrop-blur">
        <div class="max-w-6xl mx-auto w-full py-12 px-6 lg:px-12 space-y-10">
          <header class="space-y-2">
            <p class="uppercase tracking-[0.35em] text-xs text-yellow-700 font-semibold">Admin console</p>
            <h1 class="text-3xl font-bold text-gray-900">{navItems().find((item) => item.id === active())?.label}</h1>
            <p class="text-sm text-gray-600 max-w-2xl">{navItems().find((item) => item.id === active())?.description}</p>
          </header>

          <section>
            <Switch>
              <Match when={active() === 'updates'}>
                <AdminUpdates
                  initialSession={session()}
                  initialUser={user()}
                  onSessionChange={onSessionChange}
                />
              </Match>
              <Match when={active() === 'users'}>
                <AdminUsers session={session()} user={user()} />
              </Match>
            </Switch>
          </section>
        </div>
      </main>
    </div>
  );
}
