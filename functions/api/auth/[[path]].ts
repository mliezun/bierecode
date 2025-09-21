import { getAuth } from '../../../src/server/auth';
import { withForwardedFor } from '../../../src/server/request';

interface Env {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL?: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context.env);
  const request = new Request(context.request, {
    headers: withForwardedFor(context.request),
  });
  return auth.handler(request);
};
