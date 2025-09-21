import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createDb, schema } from './db';

interface AuthBindings {
  DB: D1Database;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
}

type AuthInstance = ReturnType<typeof betterAuth>;

const authCache = new WeakMap<D1Database, AuthInstance>();

export const getAuth = (env: AuthBindings) => {
  let instance = authCache.get(env.DB);
  if (instance) return instance;

  const secret = env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error('BETTER_AUTH_SECRET is not configured. Set it in wrangler.toml or environment variables.');
  }

  instance = betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret,
    database: drizzleAdapter(createDb(env.DB), { provider: 'sqlite', schema }),
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
    },
    user: {
      additionalFields: {
        role: {
          type: 'string',
          required: false,
          defaultValue: 'user',
          input: false,
        },
      },
    },
  });

  authCache.set(env.DB, instance);
  return instance;
};

export type Auth = ReturnType<typeof getAuth>;
