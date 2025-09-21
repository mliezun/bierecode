import { createSignal, Show, For, onMount } from 'solid-js';
import type { JSX } from 'solid-js';

interface UpdateDetailProps {
  updateId?: string | null;
}

interface UpdateRecord {
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

export function UpdateDetail(props: UpdateDetailProps): JSX.Element {
  const [update, setUpdate] = createSignal<UpdateRecord | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  onMount(async () => {
    setLoading(true);
    setError(null);
    try {
      let resolvedId = props.updateId ?? '';
      if (!resolvedId && typeof window !== 'undefined') {
        resolvedId = new URL(window.location.href).searchParams.get('id') ?? '';
      }
      if (!resolvedId) {
        setError('Missing update id parameter.');
        return;
      }

      const res = await fetch(`/api/updates?id=${encodeURIComponent(resolvedId)}`);
      if (res.status === 404) {
        setError('Update not found.');
        return;
      }
      if (!res.ok) {
        throw new Error(`Request failed with ${res.status}`);
      }
      const payload = (await res.json()) as UpdateRecord;
      setUpdate(payload);
    } catch (err) {
      console.error('Failed to load update', err);
      setError('Unable to load this update right now.');
    } finally {
      setLoading(false);
    }
  });

  return (
    <section class="min-h-screen bg-gradient-to-br from-yellow-100 via-white to-white py-16 px-6">
      <div class="max-w-3xl mx-auto space-y-8">
        <Show when={!loading()} fallback={<p class="text-center text-gray-600">Loading update…</p>}>
          <Show when={!error()} fallback={<p class="text-center text-red-600">{error()}</p>}>
            <Show when={update()}>
              {(record) => (
                <article class="rounded-3xl bg-white shadow-[0_30px_45px_-35px_rgba(17,24,39,0.4)] border border-yellow-100 overflow-hidden space-y-6 p-8">
                  <div class="space-y-4">
                    <div class="flex flex-wrap items-start justify-between gap-4">
                      <div class="space-y-3">
                        <span
                          class={`inline-flex items-center px-3 py-1 text-xs font-semibold uppercase tracking-wide rounded-full ${
                            record().type === 'event' ? 'bg-purple-100 text-purple-700' : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {record().type === 'event' ? 'Event' : 'Post'}
                        </span>
                        <h1 class="text-4xl font-bold text-gray-900">{record().title}</h1>
                      </div>
                      <div class="text-right text-xs text-gray-500 space-y-1">
                        <p>Published {formatDateTime(record().created)}</p>
                        <Show when={record().updated && record().updated !== record().created}>
                          {(updated) => <p>Updated {formatDateTime(updated())}</p>}
                        </Show>
                      </div>
                    </div>
                    <p class="text-base leading-relaxed text-gray-700 whitespace-pre-line">{record().content}</p>
                  </div>

                  <Show when={record().type === 'event' && record().event}>
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

                  <Show when={record().tags && record().tags!.length > 0}>
                    <div class="flex flex-wrap gap-2">
                      <For each={record().tags ?? []}>
                        {(tag) => (
                          <span class="text-xs uppercase tracking-wide bg-gray-100 text-gray-600 px-3 py-1 rounded-full">#{tag}</span>
                        )}
                      </For>
                    </div>
                  </Show>
                </article>
              )}
            </Show>
          </Show>
        </Show>
      </div>
    </section>
  );
}
