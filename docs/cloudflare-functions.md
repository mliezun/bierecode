# Cloudflare Pages Functions

Cloudflare automatically builds any code in the `functions/` directory when you deploy through Pages. Each subdirectory corresponds to a route on your site. For example `functions/api/demo-days/index.ts` is available at `/api/demo-days`.

Use `wrangler pages dev ./dist` to run the built site locally with these functions enabled. The command compiles the TypeScript files and emulates the Pages runtime so you can send requests to your APIs without deploying first.

Terraform configures the Pages project and attaches the `UPDATES_KV` namespace automatically. Deployments reference this binding without any manual setup.

## Environment Variables

Pages Functions read credentials such as `ADMIN_USERNAME` and
`ADMIN_PASSWORD` from environment variables. Define these in your
Cloudflare Pages project settings. When running locally with
`wrangler pages dev` they come from `wrangler.toml` under the `[vars]`
section.
