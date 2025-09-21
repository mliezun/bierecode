import { createEffect, createSignal, For, Match, Show, Switch, onMount } from 'solid-js';
import type { JSX } from 'solid-js';
import type { Session, User } from 'better-auth';
import { authClient } from '@/lib/auth-client';

interface UpdatePayload {
  title: string;
  content: string;
  language: string;
  type: 'post' | 'event';
  tags?: string;
  eventDate?: string;
  eventTime?: string;
  location?: string;
  duration?: string;
}

interface AdminSession {
  session: Session;
  user: User & { role?: string | null };
}

interface AdminUpdatesProps {
  initialSession: Session | null;
  initialUser: (User & { role?: string | null }) | null;
  onSessionChange?: (session: Session | null, user: (User & { role?: string | null }) | null) => void;
}

interface AdminUpdate {
  id: string;
  title: string;
  content: string;
  language: string;
  type: 'post' | 'event';
  tags?: string[];
  event?: {
    date?: string;
    time?: string;
    location?: string;
    duration?: string;
  };
  created: string;
  updated?: string;
  authorId?: string;
}

type UpdatesView = { mode: 'list' } | { mode: 'create' } | { mode: 'edit'; id: string };

type FeedbackTone = 'success' | 'error' | 'info';

interface FormState {
  title: string;
  content: string;
  language: string;
  type: 'post' | 'event';
  tags: string;
  eventDate: string;
  eventTime: string;
  location: string;
  duration: string;
}

const defaultFormState = (): FormState => ({
  title: '',
  content: '',
  language: 'en',
  type: 'post',
  tags: '',
  eventDate: '',
  eventTime: '',
  location: '',
  duration: '',
});

const formStateFromUpdate = (update: AdminUpdate): FormState => ({
  title: update.title,
  content: update.content,
  language: update.language,
  type: update.type,
  tags: (update.tags ?? []).join(', '),
  eventDate: update.event?.date ?? '',
  eventTime: update.event?.time ?? '',
  location: update.event?.location ?? '',
  duration: update.event?.duration ?? '',
});

/** Collect form values into a payload object */
function readForm(form: HTMLFormElement): UpdatePayload {
  const formData = new FormData(form);
  return {
    title: formData.get('title') as string,
    content: formData.get('content') as string,
    language: formData.get('language') as string,
    type: formData.get('type') as 'post' | 'event',
    tags: formData.get('tags') as string,
    eventDate: formData.get('eventDate') as string,
    eventTime: formData.get('eventTime') as string,
    location: formData.get('location') as string,
    duration: formData.get('duration') as string,
  };
}

/** Build the JSON body expected by the API */
function buildBody(payload: UpdatePayload): Record<string, unknown> {
  const body: Record<string, unknown> = {
    title: payload.title,
    content: payload.content,
    language: payload.language,
    type: payload.type,
    tags: payload.tags?.split(',').map((t) => t.trim()).filter(Boolean),
  };
  if (payload.type === 'event') {
    body.event = {
      date: payload.eventDate,
      time: payload.eventTime,
      location: payload.location,
      duration: payload.duration,
    };
  }
  return body;
}

function extractSession(result: unknown): AdminSession | null {
  if (!result || typeof result !== 'object') return null;
  if ('data' in (result as Record<string, unknown>)) {
    const nested = (result as { data?: unknown }).data;
    return extractSession(nested ?? null);
  }
  if ('session' in (result as Record<string, unknown>) && 'user' in (result as Record<string, unknown>)) {
    return result as AdminSession;
  }
  return null;
}

const formatDateTime = (value: string | undefined) => {
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
};

const isPrivileged = (user: (User & { role?: string | null }) | null) => {
  const role = user?.role ?? 'user';
  return role === 'admin' || role === 'manager';
};

const isAdmin = (user: (User & { role?: string | null }) | null) => (user?.role ?? 'user') === 'admin';

export function AdminUpdates(props: AdminUpdatesProps): JSX.Element {
  const [session, setSession] = createSignal<Session | null>(props.initialSession);
  const [user, setUser] = createSignal<(User & { role?: string | null }) | null>(props.initialUser);
  const [view, setView] = createSignal<UpdatesView>({ mode: 'list' });
  const [updates, setUpdates] = createSignal<AdminUpdate[]>([]);
  const [loadingUpdates, setLoadingUpdates] = createSignal(false);
  const [updatesError, setUpdatesError] = createSignal<string | null>(null);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [isAuthPending, setIsAuthPending] = createSignal(false);
  const [authError, setAuthError] = createSignal<string | null>(null);
  const [authNotice, setAuthNotice] = createSignal<string | null>(null);
  const [authMode, setAuthMode] = createSignal<'signin' | 'signup'>('signin');
  const [feedback, setFeedback] = createSignal<{ message: string; tone: FeedbackTone } | null>(null);
  const [formError, setFormError] = createSignal<string | null>(null);
  const [currentType, setCurrentType] = createSignal<'post' | 'event'>('post');
  const [editingId, setEditingId] = createSignal<string | null>(null);
  let formRef: HTMLFormElement | undefined;

  const emitSession = (nextSession: Session | null, nextUser: (User & { role?: string | null }) | null) => {
    setSession(nextSession);
    setUser(nextUser);
    props.onSessionChange?.(nextSession, nextUser);
  };

  const applyFormState = (state: FormState) => {
    setCurrentType(state.type);
    setTimeout(() => {
      const form = formRef;
      if (!form) return;

      const assign = (name: string, value: string) => {
        const element = form.elements.namedItem(name);
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
          element.value = value;
        }
      };

      assign('title', state.title);
      assign('content', state.content);
      assign('language', state.language);
      assign('type', state.type);
      assign('tags', state.tags);
      assign('eventDate', state.eventDate);
      assign('eventTime', state.eventTime);
      assign('location', state.location);
      assign('duration', state.duration);
    }, 0);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormError(null);
    applyFormState(defaultFormState());
  };

  const loadUpdates = async () => {
    if (!isPrivileged(user())) {
      setUpdates([]);
      return;
    }

    setLoadingUpdates(true);
    setUpdatesError(null);
    try {
      const res = await fetch('/api/updates');
      if (!res.ok) throw new Error(`Request failed with ${res.status}`);
      const data = (await res.json()) as AdminUpdate[];
      setUpdates(data);
    } catch (error) {
      console.error('Failed to load updates', error);
      setUpdatesError('Unable to load updates. Please try again.');
    } finally {
      setLoadingUpdates(false);
    }
  };

  const refreshSession = async () => {
    try {
      const result = await authClient.getSession();
      const payload = extractSession(result);
      emitSession(payload?.session ?? null, payload?.user ?? null);
      if (payload?.user && isPrivileged(payload.user)) {
        await loadUpdates();
      } else {
        setUpdates([]);
      }
      return payload;
    } catch (error) {
      console.error('Failed to refresh session', error);
      emitSession(null, null);
      return null;
    }
  };

  onMount(() => {
    if (isPrivileged(user())) {
      void loadUpdates();
    } else {
      void refreshSession();
    }
  });

  createEffect(() => {
    if (view().mode !== 'list' && !isPrivileged(user())) {
      setView({ mode: 'list' });
    }
  });

  createEffect(() => {
    const currentView = view();
    const currentUpdates = updates();

    if (currentView.mode === 'create') {
      applyFormState(defaultFormState());
    } else if (currentView.mode === 'edit') {
      const target = currentUpdates.find((entry) => entry.id === currentView.id);
      if (target) {
        applyFormState(formStateFromUpdate(target));
      }
    }
  });

  const switchAuthMode = (mode: 'signin' | 'signup') => {
    setAuthMode(mode);
    setAuthError(null);
    setAuthNotice(null);
  };

  const showFeedback = (message: string, tone: FeedbackTone = 'success') => {
    setFeedback({ message, tone });
    setTimeout(() => {
      setFeedback((current) => (current?.message === message ? null : current));
    }, 4000);
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const form = e.currentTarget as HTMLFormElement;
      const payload = readForm(form);
      const body = buildBody(payload);
      const updateId = editingId();
      const method = updateId ? 'PUT' : 'POST';
      const res = await fetch('/api/updates', {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateId ? { id: updateId, ...body } : body),
      });

      if (res.ok) {
        showFeedback(updateId ? 'Update saved successfully.' : 'Update posted successfully.');
        resetForm();
        setView({ mode: 'list' });
        await loadUpdates();
      } else if (res.status === 401) {
        showFeedback('Session expired. Please sign in again.', 'info');
        await refreshSession();
      } else if (res.status === 403) {
        setFormError('You do not have permission to publish updates.');
      } else {
        const message = await res.text();
        setFormError(message || `Error: ${res.status}`);
      }
    } catch (error) {
      console.error('Failed to submit update', error);
      setFormError('Unexpected error while submitting update.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignIn = async (e: Event) => {
    e.preventDefault();
    setAuthError(null);
    setAuthNotice(null);
    setIsAuthPending(true);

    try {
      const form = e.currentTarget as HTMLFormElement;
      const email = (form.elements.namedItem('email') as HTMLInputElement | null)?.value ?? '';
      const password = (form.elements.namedItem('password') as HTMLInputElement | null)?.value ?? '';
      if (!email || !password) {
        setAuthError('Email and password are required.');
        return;
      }

      await authClient.signIn.email({ email, password });
      const payload = await refreshSession();
      if (!payload) {
        setAuthError('Unable to determine session.');
        return;
      }
      if (!isPrivileged(payload.user)) {
        setAuthNotice('Signed in. Ask an admin to grant you access to updates.');
      }
      form.reset();
    } catch (error) {
      console.error('Failed to sign in', error);
      setAuthError('Unable to sign in. Please try again.');
    } finally {
      setIsAuthPending(false);
    }
  };

  const handleSignUp = async (e: Event) => {
    e.preventDefault();
    setAuthError(null);
    setAuthNotice(null);
    setIsAuthPending(true);

    try {
      const form = e.currentTarget as HTMLFormElement;
      const name = (form.elements.namedItem('name') as HTMLInputElement | null)?.value.trim() ?? '';
      const email = (form.elements.namedItem('email') as HTMLInputElement | null)?.value ?? '';
      const password = (form.elements.namedItem('password') as HTMLInputElement | null)?.value ?? '';
      const confirm = (form.elements.namedItem('confirm') as HTMLInputElement | null)?.value ?? '';

      if (!name || !email || !password) {
        setAuthError('Name, email, and password are required.');
        return;
      }

      if (password !== confirm) {
        setAuthError('Passwords do not match.');
        return;
      }

      await authClient.signUp.email({ email, password, name });
      const payload = await refreshSession();
      if (payload && isPrivileged(payload.user)) {
        setAuthNotice('Account created. You are signed in.');
      } else {
        setAuthNotice('Account created. Ask an admin to promote your account before publishing.');
        setAuthMode('signin');
      }

      form.reset();
    } catch (error) {
      console.error('Failed to sign up', error);
      setAuthError('Unable to create account. Please try again.');
    } finally {
      setIsAuthPending(false);
    }
  };

  const handleSignOut = async () => {
    setIsAuthPending(true);
    try {
      await authClient.signOut();
    } catch (error) {
      console.error('Failed to sign out', error);
    } finally {
      emitSession(null, null);
      setAuthNotice(null);
      setAuthMode('signin');
      resetForm();
      setUpdates([]);
      setView({ mode: 'list' });
      setIsAuthPending(false);
    }
  };

  const startCreate = () => {
    setEditingId(null);
    setFormError(null);
    setFeedback(null);
    setView({ mode: 'create' });
    applyFormState(defaultFormState());
  };

  const startEdit = (item: AdminUpdate) => {
    setEditingId(item.id);
    setFormError(null);
     setFeedback(null);
    setView({ mode: 'edit', id: item.id });
    applyFormState(formStateFromUpdate(item));
  };

  const handleDelete = async (id: string) => {
    const confirmation = window.confirm('Delete this update? This action cannot be undone.');
    if (!confirmation) return;

    try {
      const res = await fetch('/api/updates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (res.status === 204) {
        setUpdates((all) => all.filter((item) => item.id !== id));
        if (editingId() === id) {
          resetForm();
          setView({ mode: 'list' });
        }
        showFeedback('Update deleted successfully.');
        await loadUpdates();
      } else if (res.status === 401) {
        showFeedback('Session expired. Please sign in again.', 'info');
        await refreshSession();
      } else {
        const message = await res.text();
        setFormError(message || 'Failed to delete update.');
      }
    } catch (error) {
      console.error('Failed to delete update', error);
      setFormError('Unexpected error while deleting update.');
    }
  };

  const publicLink = () => (editingId() ? `/updates/detail?id=${editingId()}` : '/updates');

  const renderAuthForms = () => (
    <div class="max-w-md mx-auto">
      <Show
        when={authMode() === 'signin'}
        fallback={
          <form class="bg-white/80 backdrop-blur-md p-8 rounded-xl shadow space-y-5" onSubmit={handleSignUp}>
            <h1 class="text-3xl font-bold text-center">Create Admin Account</h1>
            <p class="text-sm text-gray-600 text-center">
              We’ll automatically sign you in, but an existing admin must grant publish access.
            </p>
            <div class="space-y-1">
              <label class="block text-sm font-medium" for="name">Name</label>
              <input id="name" name="name" type="text" class="w-full border rounded-md p-2" required />
            </div>
            <div class="space-y-1">
              <label class="block text-sm font-medium" for="email">Email</label>
              <input id="email" name="email" type="email" class="w-full border rounded-md p-2" required />
            </div>
            <div class="space-y-1">
              <label class="block text-sm font-medium" for="password">Password</label>
              <input id="password" name="password" type="password" minlength="8" class="w-full border rounded-md p-2" required />
            </div>
            <div class="space-y-1">
              <label class="block text-sm font-medium" for="confirm">Confirm password</label>
              <input id="confirm" name="confirm" type="password" minlength="8" class="w-full border rounded-md p-2" required />
            </div>
            <button
              type="submit"
              class="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md w-full disabled:opacity-60"
              disabled={isAuthPending()}
            >
              {isAuthPending() ? 'Creating account…' : 'Create account'}
            </button>
            <Show when={authError()}>
              <p class="text-sm text-center text-red-600">{authError()}</p>
            </Show>
            <Show when={authNotice()}>
              <p class="text-sm text-center text-green-600">{authNotice()}</p>
            </Show>
            <p class="text-sm text-center text-gray-600">
              Already have an account?
              <button type="button" class="ml-1 text-yellow-700 hover:text-yellow-800" onClick={() => switchAuthMode('signin')}>
                Sign in
              </button>
            </p>
          </form>
        }
      >
        <form class="bg-white/80 backdrop-blur-md p-8 rounded-xl shadow space-y-5" onSubmit={handleSignIn}>
          <h1 class="text-3xl font-bold text-center">Admin Sign In</h1>
          <p class="text-sm text-gray-600 text-center">
            Use your Bière Code admin credentials to publish updates.
          </p>
          <div class="space-y-1">
            <label class="block text-sm font-medium" for="email">Email</label>
            <input id="email" name="email" type="email" class="w-full border rounded-md p-2" required />
          </div>
          <div class="space-y-1">
            <label class="block text-sm font-medium" for="password">Password</label>
            <input id="password" name="password" type="password" class="w-full border rounded-md p-2" required />
          </div>
          <button
            type="submit"
            class="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md w-full disabled:opacity-60"
            disabled={isAuthPending()}
          >
            {isAuthPending() ? 'Signing in…' : 'Sign in'}
          </button>
          <Show when={authError()}>
            <p class="text-sm text-center text-red-600">{authError()}</p>
          </Show>
          <Show when={authNotice()}>
            <p class="text-sm text-center text-green-600">{authNotice()}</p>
          </Show>
          <p class="text-sm text-center text-gray-600">
            Don’t have an account?
            <button type="button" class="ml-1 text-yellow-700 hover:text-yellow-800" onClick={() => switchAuthMode('signup')}>
              Create one
            </button>
          </p>
        </form>
      </Show>
    </div>
  );

  const renderRestricted = () => (
    <div class="bg-white/80 backdrop-blur-md p-8 rounded-xl shadow text-center space-y-4 max-w-xl mx-auto">
      <h1 class="text-2xl font-semibold">Access restricted</h1>
      <p class="text-gray-600">Your account does not have permission to publish updates.</p>
      <Show when={authNotice()}>
        <p class="text-sm text-gray-600">{authNotice()}</p>
      </Show>
      <p class="text-xs text-gray-500">
        Ask an existing admin to promote your account (e.g. <code>wrangler d1 execute … SET role = 'manager'</code>).
      </p>
      <button
        class="text-sm text-yellow-700 hover:text-yellow-800 disabled:opacity-60"
        onClick={handleSignOut}
        disabled={isAuthPending()}
      >
        Sign out
      </button>
    </div>
  );

  const renderListView = () => (
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-xl font-semibold text-gray-900">All updates</h2>
          <p class="text-sm text-gray-600">Publish announcements and revisit past stories.</p>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            class="px-4 py-2 rounded-md border border-yellow-300 text-yellow-800 text-sm hover:bg-yellow-100 transition"
            onClick={() => void loadUpdates()}
            disabled={loadingUpdates()}
          >
            {loadingUpdates() ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            type="button"
            class="px-4 py-2 rounded-md bg-yellow-500 text-white text-sm font-semibold shadow hover:bg-yellow-600 transition"
            onClick={startCreate}
          >
            Create update
          </button>
        </div>
      </div>

      <Show when={feedback()}>
        {(fb) => (
          <div
            class={`px-4 py-3 rounded-xl text-sm border ${
              fb().tone === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : fb().tone === 'error'
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-yellow-50 border-yellow-200 text-yellow-800'
            }`}
          >
            {fb().message}
          </div>
        )}
      </Show>

      <Show when={!loadingUpdates()} fallback={<p class="text-sm text-gray-500">Loading updates…</p>}>
        <Show when={!updatesError()} fallback={<p class="text-sm text-red-600">{updatesError()}</p>}>
          <Show when={updates().length > 0} fallback={<p class="text-sm text-gray-600">Encore aucun update. Revenez bientôt 🍻</p>}>
            <div class="space-y-4">
              <For each={updates()}>
                {(item) => (
                  <article
                    id={`update-${item.id}`}
                    class="rounded-3xl bg-white shadow-[0_20px_35px_-25px_rgba(17,24,39,0.35)] border border-yellow-100 overflow-hidden cursor-pointer"
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest('button')) return;
                      startEdit(item);
                    }}
                  >
                    <div class="p-6 md:p-8 space-y-4">
                      <div class="flex flex-wrap items-start justify-between gap-4">
                        <div class="space-y-2">
                          <span
                            class={`inline-flex items-center px-3 py-1 text-xs font-semibold tracking-wide uppercase rounded-full ${
                              item.type === 'event' ? 'bg-purple-100 text-purple-700' : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {item.type === 'event' ? 'Event' : 'Post'}
                          </span>
                          <h3 class="text-2xl font-semibold text-gray-900">{item.title}</h3>
                        </div>
                        <div class="text-right text-xs text-gray-500 space-y-1">
                          <p>{formatDateTime(item.created)}</p>
                          <Show when={item.updated && item.updated !== item.created}>
                            {(updated) => <p>Updated {formatDateTime(updated())}</p>}
                          </Show>
                        </div>
                      </div>
                      <p class="text-base text-gray-700 leading-relaxed whitespace-pre-line">{item.content}</p>
                      <Show when={item.type === 'event' && item.event}>
                        {(ev) => (
                          <div class="bg-yellow-50 border border-yellow-100 text-yellow-900 text-sm rounded-2xl px-4 py-3 space-y-1">
                            <Show when={ev().date || ev().time}>
                              <p>
                                <strong class="font-semibold">When:</strong> {[ev().date, ev().time].filter(Boolean).join(' • ')}
                              </p>
                            </Show>
                            <Show when={ev().location}>
                              <p>
                                <strong class="font-semibold">Where:</strong> {ev().location}
                              </p>
                            </Show>
                            <Show when={ev().duration}>
                              <p>
                                <strong class="font-semibold">Duration:</strong> {ev().duration}
                              </p>
                            </Show>
                          </div>
                        )}
                      </Show>
                      <Show when={item.tags && item.tags.length > 0}>
                        <div class="flex flex-wrap gap-2 pt-1">
                          <For each={item.tags ?? []}>
                            {(tag) => (
                              <span class="text-xs uppercase tracking-wide bg-gray-100 text-gray-600 px-3 py-1 rounded-full">#{tag}</span>
                            )}
                          </For>
                        </div>
                      </Show>
                      <div class="flex gap-3 pt-2">
                        <button
                          type="button"
                          class="px-3 py-2 rounded-md text-sm bg-yellow-500 text-white hover:bg-yellow-600 transition disabled:opacity-50"
                          onClick={() => startEdit(item)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          class="px-3 py-2 rounded-md text-sm border border-red-200 text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                          onClick={() => handleDelete(item.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </Show>
    </div>
  );

  const renderFormView = () => (
    <form
      ref={(el) => {
        formRef = el;
      }}
      class="space-y-5 bg-white/70 backdrop-blur-md p-8 rounded-xl shadow-lg"
      onSubmit={handleSubmit}
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">
            {view().mode === 'edit' ? 'Edit update' : 'Create update'}
          </h1>
          <p class="text-sm text-gray-600">
            {view().mode === 'edit' ? 'Update the content below and save your changes.' : 'Share the latest news with the community.'}
          </p>
        </div>
        <div class="flex items-center gap-3">
          <Show when={view().mode === 'edit'}>
            <a
              class="text-sm text-yellow-700 hover:text-yellow-800"
              href={publicLink()}
              target="_blank"
              rel="noopener noreferrer"
            >
              View public page ↗
            </a>
          </Show>
          <button
            type="button"
            class="px-3 py-2 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-100"
            onClick={() => {
              resetForm();
              setView({ mode: 'list' });
            }}
          >
            Back to updates
          </button>
        </div>
      </div>

      <Show when={formError()}>
        <p class="text-sm text-red-600">{formError()}</p>
      </Show>

      <div class="space-y-1">
        <label class="block text-sm font-medium" for="title">Title</label>
        <input id="title" name="title" type="text" class="w-full border rounded-md p-2" required />
      </div>
      <div class="space-y-1">
        <label class="block text-sm font-medium" for="content">Content</label>
        <textarea id="content" name="content" rows={5} class="w-full border rounded-md p-2" required></textarea>
      </div>
      <div class="grid md:grid-cols-2 gap-4">
        <div class="space-y-1">
          <label class="block text-sm font-medium" for="language">Language</label>
          <select id="language" name="language" class="w-full border rounded-md p-2" required>
            <option value="en">English</option>
            <option value="fr">French</option>
          </select>
        </div>
        <div class="space-y-1">
          <label class="block text-sm font-medium" for="type">Type</label>
          <select
            id="type"
            name="type"
            class="w-full border rounded-md p-2"
            required
            onInput={(event) => setCurrentType((event.currentTarget as HTMLSelectElement).value as 'post' | 'event')}
          >
            <option value="post">Post</option>
            <option value="event">Event</option>
          </select>
        </div>
      </div>
      <div class="space-y-1">
        <label class="block text-sm font-medium" for="tags">Tags</label>
        <input id="tags" name="tags" type="text" placeholder="Comma separated" class="w-full border rounded-md p-2" />
      </div>
      <Show when={currentType() === 'event'}>
        <fieldset class="border p-4 rounded-md space-y-2">
          <legend class="font-semibold text-sm">Event details</legend>
          <input name="eventDate" type="date" class="w-full border rounded-md p-2" />
          <input name="eventTime" type="time" class="w-full border rounded-md p-2" />
          <input name="location" type="text" placeholder="Location" class="w-full border rounded-md p-2" />
          <input name="duration" type="text" placeholder="Duration" class="w-full border rounded-md p-2" />
        </fieldset>
      </Show>
      <button
        type="submit"
        class="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md disabled:opacity-60"
        disabled={isSubmitting()}
      >
        {isSubmitting()
          ? view().mode === 'edit'
            ? 'Saving…'
            : 'Submitting…'
          : view().mode === 'edit'
            ? 'Save changes'
            : 'Submit update'}
      </button>
    </form>
  );

  return (
    <div class="space-y-8">
      <Show when={session() && isPrivileged(user())} fallback={<Switch>
        <Match when={!session()}>{renderAuthForms()}</Match>
        <Match when={session() && !isPrivileged(user())}>{renderRestricted()}</Match>
      </Switch>}>
        <Show when={feedback()}>
          {(fb) => (
            <div
              class={`px-4 py-3 rounded-xl text-sm border ${
                fb().tone === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : fb().tone === 'error'
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : 'bg-yellow-50 border-yellow-200 text-yellow-800'
              }`}
            >
              {fb().message}
            </div>
          )}
        </Show>
        <Switch>
          <Match when={view().mode === 'list'}>{renderListView()}</Match>
          <Match when={view().mode !== 'list'}>{renderFormView()}</Match>
        </Switch>
      </Show>
    </div>
  );
}
