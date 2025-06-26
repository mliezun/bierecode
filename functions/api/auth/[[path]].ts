/**
 * Proxy all /api/auth/* requests to Better Auth.
 *
 * Cloudflare Pages does not support traditional catch-all routes,
 * so the [[path]].ts filename captures any path after /api/auth/.
 * The Better Auth handler expects the entire request object and
 * returns a response appropriate for the path.
 */
import { createAuth } from '../../../src/lib/auth-server';

export const onRequest: PagesFunction = async ({ request, env }) => {
  const auth = createAuth(env as any);
  return auth.handler(request);
};
