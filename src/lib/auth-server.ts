import { betterAuth } from 'better-auth';
import { Kysely } from 'kysely';
import { D1Dialect } from 'kysely-d1';

/**
 * Create a Better Auth instance using a Cloudflare D1 database.
 *
 * The instance is configured with the built-in email/password
 * authentication. Cloudflare injects the `DB` binding which we pass
 * into Kysely via the D1 dialect.
 */
export function createAuth(env: { DB: D1Database }) {
  const db = new Kysely<any>({ dialect: new D1Dialect({ database: env.DB }) });
  return betterAuth({
    database: { db, type: 'sqlite' },
    emailAndPassword: { enabled: true },
  });
}
