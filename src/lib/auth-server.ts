import { betterAuth } from 'better-auth';
import { magicLink, genericOAuth, github } from 'better-auth/plugins';
import { Kysely } from 'kysely';
import { D1Dialect } from 'kysely-d1';

/**
 * createAuth
 * ----------
 * Factory function that instantiates a Better Auth server bound to a
 * Cloudflare D1 database. The Pages runtime exposes the database via the `DB`
 * binding. We construct a Kysely instance using the `kysely-d1` dialect and
 * pass that into Better Auth. The server enables two plugins:
 *
 * - `magicLink` sends passwordless login links via email, removing the CPU cost
 *   of password hashing on Cloudflare Workers.
 * - `genericOAuth` with the `github` provider allows social sign-in using
 *   OAuth. Credentials come from environment variables so no secrets are kept in
 *   the repository.
 *
 * The returned object provides both an Express-style handler for requests and a
 * client API for server-side usage.
*/
export function createAuth(env: {
  DB: D1Database;
  BETTER_AUTH_SECRET?: string;
  AUTH_SECRET?: string;
  GH_CLIENT_ID?: string;
  GH_CLIENT_SECRET?: string;
}) {
  const db = new Kysely<any>({ dialect: new D1Dialect({ database: env.DB }) });
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET || env.AUTH_SECRET,
    database: { db, type: 'sqlite' },
    plugins: [
      magicLink({
        // In production you would integrate with a mail provider.
        // For this demo we simply log the link so admins can copy/paste it.
        async sendMagicLink({ email, url }) {
          console.log(`[magic-link] ${email} -> ${url}`);
        },
      }),
      genericOAuth({
        config: [
          {
            providerId: 'github',
            clientId: env.GH_CLIENT_ID ?? '',
            clientSecret: env.GH_CLIENT_SECRET ?? '',
            scopes: ['read:user', 'user:email'],
          },
        ],
      }),
    ],
    advanced: {
      // Expose the session cookie across the entire site so
      // endpoints like /api/updates can verify the logged in user.
      defaultCookieAttributes: { path: '/' },
    },
  });
}
