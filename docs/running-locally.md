# Running the Bière Code Project Locally

Follow these steps to run the site with all Cloudflare integrations (KV, D1, and BetterAuth) on your machine.

---

## 1. Clone the Repository
```bash
git clone <your-repo-url>
cd bierecode
```

## 2. Install Dependencies
```bash
npm install
```

## 3. Configure Environment Variables
Environment variables for BetterAuth are loaded from `.dev.vars` when running
locally. Copy the provided template and adjust as needed:

```bash
cp .dev.vars.example .dev.vars
```

The template ships with development-friendly values:

```bash
BETTER_AUTH_SECRET=dev-secret-change-me
BETTER_AUTH_URL=http://localhost:8788
```

If you need to override them, edit `.dev.vars` or supply your own values. For
production deploys, configure these in the Cloudflare Pages dashboard instead
of `wrangler.toml`.

For reference, the `wrangler.toml` placeholders expect values shaped like:

```toml
BETTER_AUTH_SECRET = "your-long-random-secret"
BETTER_AUTH_URL = "http://localhost:8788"
```

The file already contains placeholder bindings for `UPDATES_KV` and the D1 database.

## 4. Apply Database Migrations
The BetterAuth schema lives in `drizzle/`. Apply it to your local D1 database:
```bash
npm run db:migrate
```

## 5. Build the Site
```bash
npm run build
```

## 6. Run with Wrangler (Pages + Functions + Databases)
```bash
npm run dev:pages
```
This script pins Wrangler state to `.wrangler/state`, so you can wipe local data with `rm -rf .wrangler/state`. Wrangler serves the static build, BetterAuth (`/api/auth/*`), and all API routes in one process (default URL: <http://localhost:8788>).

## 7. Access the App
Open the URL printed by Wrangler (typically <http://localhost:8788>) and navigate to:
- `/admin` – Admin UI with BetterAuth sign-in flow.
- `/updates` – Public feed reading from Workers KV.
- `/api/updates` – API for updates (POST requires an admin session).

---

### Additional Notes
- **Creating an admin account**: use the **Create account** option on `/admin` (or POST to `/api/auth/sign-up/email`), then promote the account using `wrangler d1 execute` to set `role = 'admin'` in the `user` table.
- **Cloudflare KV Simulation**: Wrangler & Miniflare provide an in-memory KV namespace for local runs.
- **Terraform**: The `infra/` directory still provisions KV for production; no changes required for the new auth flow.

## 8. Run End-to-End Tests
To verify the full admin flow locally, run Playwright (this command builds the site, applies migrations, starts Wrangler, and runs the tests):
```bash
npm run test:e2e
```
Playwright downloads Chromium the first time it runs.
