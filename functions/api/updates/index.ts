import { getAuth } from '../../../src/server/auth';
import { withForwardedFor } from '../../../src/server/request';

const UPDATE_PREFIX = 'update:';

interface Update {
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
  authorId?: string;
  updated?: string;
}

function updateKey(id: string): string {
  return `${UPDATE_PREFIX}${id}`;
}

function normalizeTags(tags: unknown): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) {
    return tags
      .map((tag) => String(tag).trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeEvent(event: unknown): Update['event'] | undefined {
  if (!event || typeof event !== 'object') return undefined;
  const candidate = event as Record<string, unknown>;
  const clean = {
    date: candidate.date ? String(candidate.date) : undefined,
    time: candidate.time ? String(candidate.time) : undefined,
    location: candidate.location ? String(candidate.location) : undefined,
    duration: candidate.duration ? String(candidate.duration) : undefined,
  } as Update['event'];

  if (!clean?.date && !clean?.time && !clean?.location && !clean?.duration) {
    return undefined;
  }
  return clean;
}

async function handleGet(env: Env, url: URL): Promise<Response> {
  const id = url.searchParams.get('id');
  if (id) {
    const record = (await env.UPDATES_KV.get(updateKey(id), 'json')) as Update | null;
    if (!record) {
      return new Response('Not Found', { status: 404 });
    }
    return new Response(JSON.stringify(record), {
      headers: { 'content-type': 'application/json' },
    });
  }

  const language = url.searchParams.get('language');
  const type = url.searchParams.get('type');
  const tag = url.searchParams.get('tag');

  // filter by prefix "update:"
  const { keys } = await env.UPDATES_KV.list({ prefix: UPDATE_PREFIX });
  const items: Update[] = [];
  for (const key of keys) {
    const stored = (await env.UPDATES_KV.get(key.name, 'json')) as Update | null;
    if (!stored) continue;
    if (language && stored.language !== language) continue;
    if (type && stored.type !== type) continue;
    if (tag && !(stored.tags?.includes(tag))) continue;
    items.push(stored);
  }

  items.sort((a, b) => {
    const aCreated = a.created ? Date.parse(a.created) : 0;
    const bCreated = b.created ? Date.parse(b.created) : 0;
    return bCreated - aCreated;
  });
  return new Response(JSON.stringify(items), {
    headers: { 'content-type': 'application/json' },
  });
}

async function handlePost(request: Request, env: Env, userId: string): Promise<Response> {
  let body: Partial<Update>;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (!body.title || !body.content || !body.language || !body.type) {
    return new Response('Missing required fields', { status: 400 });
  }

  const id = crypto.randomUUID();
  const tags = normalizeTags(body.tags);
  const type = body.type as 'post' | 'event';
  const event = type === 'event' ? normalizeEvent(body.event) : undefined;

  const update: Update = {
    id,
    title: String(body.title),
    content: String(body.content),
    language: String(body.language),
    type,
    tags,
    event,
    created: new Date().toISOString(),
    authorId: userId,
  };

  await env.UPDATES_KV.put(updateKey(id), JSON.stringify(update));
  return new Response(JSON.stringify(update), {
    status: 201,
    headers: { 'content-type': 'application/json' },
  });
}

async function handlePut(request: Request, env: Env): Promise<Response> {
  let body: Partial<Update> & { id?: string };
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (!body.id) {
    return new Response('Missing id', { status: 400 });
  }

  const key = updateKey(body.id);
  const existing = (await env.UPDATES_KV.get(key, 'json')) as Update | null;
  if (!existing) {
    return new Response('Not Found', { status: 404 });
  }

  const nextType = (body.type as 'post' | 'event') ?? existing.type;
  const nextTags = body.tags !== undefined ? normalizeTags(body.tags) : existing.tags ?? [];
  const nextEvent = nextType === 'event'
    ? normalizeEvent(body.event ?? existing.event)
    : undefined;

  const update: Update = {
    ...existing,
    title: body.title !== undefined ? String(body.title) : existing.title,
    content: body.content !== undefined ? String(body.content) : existing.content,
    language: body.language !== undefined ? String(body.language) : existing.language,
    type: nextType,
    tags: nextTags,
    event: nextEvent,
    updated: new Date().toISOString(),
  };

  await env.UPDATES_KV.put(key, JSON.stringify(update));

  return new Response(JSON.stringify(update), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

async function handleDelete(request: Request, env: Env): Promise<Response> {
  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (!body.id) {
    return new Response('Missing id', { status: 400 });
  }

  const key = updateKey(body.id);
  const existing = await env.UPDATES_KV.get(key);
  if (!existing) {
    return new Response('Not Found', { status: 404 });
  }

  await env.UPDATES_KV.delete(key);
  return new Response(null, { status: 204 });
}

interface Env {
  UPDATES_KV: KVNamespace;
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL?: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === 'GET') {
    return handleGet(env, url);
  }

  const auth = getAuth(env);
  const session = await auth.api.getSession({
    headers: withForwardedFor(request),
  });

  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const role = (session.user as { role?: string }).role ?? 'user';
  const canManage = role === 'admin' || role === 'manager';

  if (!canManage) {
    return new Response('Forbidden', { status: 403 });
  }

  switch (request.method) {
    case 'POST':
      return handlePost(request, env, session.user.id);
    case 'PUT':
    case 'PATCH':
      return handlePut(request, env);
    case 'DELETE':
      return handleDelete(request, env);
    default:
      return new Response('Method Not Allowed', { status: 405 });
  }
};
