**NOTE:** This was @raphaeltm's experiment in vibe-coding, experimenting with CloudFlare, and experimenting with Astro. Some of this stuff is a bit chaotic because of that 😅

# Bière Code Site

Bière Code runs on [Astro](https://astro.build) with Cloudflare Pages Functions for dynamic features. Community updates are stored in Workers KV, authentication is powered by [BetterAuth](https://better-auth.com), and admin data lives in a D1 database.

## Stack
- **Astro 5** for the public site and component rendering
- **BetterAuth + Cloudflare D1** for credential & session management
- **Cloudflare Pages Functions** for `/api/*` routes (updates, demo days, auth)
- **Workers KV** for the community updates feed
- **Tailwind CSS** for styling the admin UI

## Local Development
1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Configure Wrangler**
   The repo includes a starter `wrangler.toml` with placeholders. Update the file (or environment overrides) with real IDs/secrets when connecting to Cloudflare:
   ```toml
   [vars]
   BETTER_AUTH_SECRET = "your-long-random-secret"
   BETTER_AUTH_URL = "http://localhost:8788" # set to the Pages dev URL
   ```
   The file already defines the `UPDATES_KV` binding and a D1 database named `bierecode-auth`.
3. **Run database migrations** (uses the bundled SQL files under `drizzle/`)
   ```bash
   npm run db:migrate
   ```
   For a remote environment drop the `--local` flag: `npm run db:migrate:remote`.
4. **Build the static site**
   ```bash
   npm run build
   ```
5. **Launch the full stack locally**
   ```bash
   WRANGLER_PERSIST_TO=.wrangler/state npx wrangler pages dev ./dist --persist-to .wrangler/state
   ```
   Wrangler serves the static build, the Pages Functions, BetterAuth, KV, and the D1 binding in one process (default URL: <http://localhost:8788>).

### Useful scripts
| Command | Description |
| --- | --- |
| `npm run dev` | Astro dev server for static pages only (no functions/auth) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the static build |
| `npm run db:generate` | Regenerate Drizzle schema from TypeScript definitions |
| `npm run db:migrate` | Apply migrations to the local D1 database |
| `npm run db:migrate:remote` | Apply migrations to the remote D1 database |
| `npm run test:e2e` | Run the Playwright E2E suite (starts Wrangler dev server) |

## Authentication
- All admin and API writes go through BetterAuth (`/api/auth/*`).
- Sessions are stored in D1; BetterAuth cookies are scoped to the site domain.
- The admin UI (`/admin`) is powered by a dashboard shell. Use the **Create account** toggle to register new users; accounts can hold one of three roles: *(none)*, `manager`, or `admin`. Managers can publish and edit updates, admins can additionally manage roles.
- The updates workspace supports full CRUD: create, edit, delete, review history, and jump to the public view for any entry.
- Use Wrangler to promote an account to admin. Example (local):
  ```bash
  wrangler d1 execute bierecode-auth --local \
    --command "UPDATE user SET role = 'admin' WHERE email = 'hello@bierecode.com';"
  ```

## Cloudflare Pages Functions
- `/api/auth/*` is handled by BetterAuth and requires the `DB` binding plus the auth env vars.
- `/api/updates` now trusts BetterAuth sessions (no more HTTP Basic). Authenticated managers or admins can create, update, or delete entries; `GET` remains public.
- `/api/users` exposes an admin-only API for listing accounts and updating roles.
- `/api/demo-days` continues to run with Pages Functions as before.

## Additional Docs
- [`docs/admin-ui.md`](docs/admin-ui.md) – notes on the admin experience
- [`docs/cloudflare-functions.md`](docs/cloudflare-functions.md) – Pages Functions deployment details
- [`docs/running-locally.md`](docs/running-locally.md) – step-by-step local setup, including Wrangler usage

Feel free to adapt the layout or extend the auth flow with additional BetterAuth plugins (2FA, magic links, OAuth providers, etc.).
