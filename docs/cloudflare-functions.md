# Cloudflare Pages Functions

Pages deploys everything under `functions/` as request handlers. The key endpoints are:

- `functions/api/auth/[...path].ts` – mounts BetterAuth so every `/api/auth/*` request uses the shared handler. It requires the `DB` D1 binding plus the `BETTER_AUTH_*` env vars defined in `wrangler.toml`.
- `functions/api/updates/index.ts` – reads public updates from Workers KV and, for authenticated managers or admins, supports full CRUD via `POST` (create), `PUT/PATCH` (update), and `DELETE`.
- `functions/api/users/index.ts` – admin-only endpoint backed by D1 for listing accounts and updating roles.
- `functions/api/demo-days/index.ts` – unchanged demo day submission endpoint.

## Environment Bindings

`wrangler.toml` defines the runtime bindings:

```toml
[[kv_namespaces]]
binding = "UPDATES_KV"

[[d1_databases]]
binding = "DB"

[vars]
BETTER_AUTH_SECRET = "..."
BETTER_AUTH_URL = "..."
```

When running locally with `wrangler pages dev`, Wrangler automatically wires KV, D1, and the environment variables using these definitions.

## Authentication Flow

The admin client exchanges credentials with `/api/auth/sign-in/email`, BetterAuth stores the session in D1, and subsequent requests include the session cookie. The update API replays the request headers to BetterAuth (`auth.api.getSession`) to ensure the user holds a privileged role (`manager` or `admin`) before accepting mutations.

BetterAuth handles cookie issuance, password hashing, refresh tokens, and exposes additional endpoints (`/api/auth/sign-out`, `/api/auth/sign-up/email`, etc.) if you want to expand the admin experience later. The new `/api/users` route builds on the same session guard to allow admins to view and adjust user roles.
