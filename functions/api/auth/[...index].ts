import { createAuth } from '../../../src/lib/auth-server';

export const onRequest: PagesFunction = async ({ request, env }) => {
  const auth = createAuth(env as any);
  return auth.handler(request);
};
