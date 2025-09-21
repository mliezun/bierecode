import { getAuth } from '../../../src/server/auth';
import { createDb, schema } from '../../../src/server/db';
import { withForwardedFor } from '../../../src/server/request';
import { eq } from 'drizzle-orm';

interface Env {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL?: string;
}

const ROLE_VALUES = new Set(['', 'manager', 'admin']);

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = getAuth(env);
  const session = await auth.api.getSession({
    headers: withForwardedFor(request),
  });

  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const role = (session.user as { role?: string }).role ?? 'user';
  const db = createDb(env.DB);

  if (request.method === 'GET') {
    if (role !== 'admin') {
      return new Response('Forbidden', { status: 403 });
    }

    const users = await db.query.user.findMany({
      columns: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: (users, { asc }) => asc(users.createdAt),
    });

    return new Response(JSON.stringify(users), {
      headers: { 'content-type': 'application/json' },
    });
  }

  if (request.method === 'PATCH' || request.method === 'PUT') {
    if (role !== 'admin') {
      return new Response('Forbidden', { status: 403 });
    }

    let body: { id?: string; role?: string };
    try {
      body = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    if (!body.id || body.role === undefined) {
      return new Response('Missing fields', { status: 400 });
    }

    const nextRole = body.role ?? '';
    if (!ROLE_VALUES.has(nextRole)) {
      return new Response('Invalid role', { status: 400 });
    }

    const now = Date.now();

    const result = await db
      .update(schema.user)
      .set({ role: nextRole || null, updatedAt: new Date(now) })
      .where(eq(schema.user.id, body.id))
      .returning({
        id: schema.user.id,
        name: schema.user.name,
        email: schema.user.email,
        role: schema.user.role,
        createdAt: schema.user.createdAt,
        updatedAt: schema.user.updatedAt,
      });

    if (result.length === 0) {
      return new Response('Not Found', { status: 404 });
    }

    return new Response(JSON.stringify(result[0]), {
      headers: { 'content-type': 'application/json' },
    });
  }

  return new Response('Method Not Allowed', { status: 405 });
};
