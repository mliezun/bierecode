/**
 * Client-side updates list used on the `/updates` page.
 *
 * This Solid component fetches a JSON array from the `/api/updates` API route
 * and displays each entry. The component runs in the browser so that builds
 * remain fully static – no data needs to be fetched during the Astro build
 * step. Cloudflare's worker runtime throws an error when `fetch` is given a
 * relative URL server-side, so fetching is deferred until the component mounts
 * in the client. The initial HTML rendered by Astro therefore contains only a
 * loading message which is replaced once the client finishes fetching data.
 */
import { createSignal, Show, For, onMount } from 'solid-js';
import type { JSX } from 'solid-js';

interface Update {
  id: string;
  title: string;
  content: string;
  language: string;
  type: 'post' | 'event';
  tags?: string[];
  event?: { date?: string; time?: string; location?: string; duration?: string };
  created: string;
  updated?: string;
}

/**
 * Fetch updates from the API. This helper only runs in the browser because
 * Cloudflare's server runtime does not support relative URLs with `fetch`.
 */
async function fetchUpdates(): Promise<Update[]> {
  // The API lives in a Pages Function. Requests use a relative path so they
  // automatically resolve against the same domain the site is served from.
  // Browsers handle this just fine, but the Cloudflare workers runtime will
  // throw `TypeError: Failed to parse URL` during server-side rendering if we
  // attempt to call `fetch` with a relative path. By only calling this helper
  // after the component mounts we ensure it never runs in that environment.
  const res = await fetch('/api/updates');
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

/** Component showing a list of updates */
function formatDate(value: string): string {
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

export function Updates(): JSX.Element {
  const [updates, setUpdates] = createSignal<Update[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  // Load updates after the component mounts in the browser.
  onMount(async () => {
    // Since this code runs only in the browser, `fetch` can safely use the
    // relative `/api/updates` URL. Any network or parsing errors are logged
    // but not rethrown so the page continues to render.
    try {
      setError(null);
      const data = await fetchUpdates();
      setUpdates(data);
    } catch (err) {
      console.error('Failed to load updates', err);
      setError('Unable to load updates right now.');
    } finally {
      setLoading(false);
    }
  });

  // Once updates are loaded, render them using simple cards. During the initial
  // render the list shows a small loading message which is replaced as soon as
  // `updates()` resolves to an array.
  return (
    <section class="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-white py-16 px-6">
      <div class="max-w-4xl mx-auto space-y-10">
        <header class="text-center space-y-4">
          <p class="uppercase tracking-[0.35em] text-xs text-yellow-700 font-semibold">Bière & Code</p>
          <h1 class="text-4xl md:text-5xl font-bold text-gray-900">Community Updates</h1>
          <p class="text-gray-600 max-w-2xl mx-auto">
            Stay in the loop with the latest announcements, event recaps, and community highlights straight from the Bière Code crew.
          </p>
        </header>

        <Show when={!loading()} fallback={<p class="text-center text-gray-600">Chargement des updates…</p>}>
          <Show
            when={!error()}
            fallback={<p class="text-center text-red-600">{error()}</p>}
          >
            <Show when={updates().length > 0} fallback={<p class="text-center text-gray-600">Encore aucun update. Revenez bientôt 🍻</p>}>
              <div class="space-y-6">
                <For each={updates()}>
                  {(item) => (
                    <article class="rounded-3xl bg-white shadow-[0_20px_35px_-25px_rgba(17,24,39,0.35)] border border-yellow-100 overflow-hidden">
                      <a class="block p-6 md:p-8 space-y-4 hover:bg-yellow-50/40 transition" href={`/updates/detail?id=${item.id}`}>
                        <div class="flex flex-wrap items-start justify-between gap-4">
                          <div class="space-y-2">
                            <span class={`inline-flex items-center px-3 py-1 text-xs font-semibold tracking-wide uppercase rounded-full ${item.type === 'event' ? 'bg-purple-100 text-purple-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              {item.type === 'event' ? 'Event' : 'Post'}
                            </span>
                            <h2 class="text-2xl font-semibold text-gray-900">{item.title}</h2>
                          </div>
                          <div class="text-right text-xs text-gray-500 space-y-1">
                            <p>{formatDate(item.created)}</p>
                            <Show when={item.updated && item.updated !== item.created}>
                              {(updated) => <p>Updated {formatDate(updated())}</p>}
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
                      </a>
                    </article>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </Show>
      </div>
    </section>
  );
}
