import { defineMiddleware } from 'astro:middleware';
import { getAuth } from './server/auth';
import { withForwardedFor } from './server/request';

export const onRequest = defineMiddleware(async (context, next) => {
  const runtimeEnv = context.locals.runtime?.env;

  if (runtimeEnv && 'DB' in runtimeEnv) {
    try {
      const auth = getAuth(runtimeEnv as Parameters<typeof getAuth>[0]);
      const session = await auth.api.getSession({
        headers: withForwardedFor(context.request),
      });
      context.locals.user = session?.user ?? null;
      context.locals.session = session?.session ?? null;
    } catch (error) {
      console.error('Failed to resolve BetterAuth session', error);
      context.locals.user = null;
      context.locals.session = null;
    }
  } else {
    context.locals.user = null;
    context.locals.session = null;
  }

  return next();
});
