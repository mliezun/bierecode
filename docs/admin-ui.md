# Admin UI Design

The `/admin` page now wraps two flows:

1. **Authentication** – BetterAuth email/password sign-in handled client-side with `better-auth/solid`. Once the cookie is set, the Solid component refreshes the session and renders the dashboard.
2. **Publishing** – The existing update form posts to `/api/updates`. The API validates that the current BetterAuth session exists and that the associated user has `role = 'admin'` before writing to Workers KV.

## Goals
- **Clarity**: Keep the interface focused on content entry with minimal distractions.
- **Accessibility**: Use labels and semantic markup so screen readers can announce form fields correctly.
- **Responsiveness**: Maintain comfortable margins and spacing on both mobile and desktop screens.
- **Feedback**: Show clear status messages after signing in, submitting a post, or encountering an error.

The UI lives in `src/components/pages/admin/components/admin-form/admin-form.tsx` and relies on `src/lib/auth-client.ts` for BetterAuth client methods.

## Access & Accounts
The `/admin` route now supports both signing in and creating an account. Use the **Create account** toggle on the page to register; BetterAuth signs you in immediately, but you'll see an access restriction banner until an existing admin promotes your user (set the role via D1). Accounts can hold one of three roles:

- *(none)* – default state, can sign in but has no elevated permissions.
- `manager` – can view the dashboard and perform full CRUD on updates.
- `admin` – everything a manager can do plus user/role management.

## Dashboard Layout
The admin page uses a persistent sidebar with navigation links (currently **Updates** and **Users**). Additional tools can be slotted into this pattern later without redesigning the workspace.

## Managing Updates
Authenticated managers and admins see a dedicated workspace with:

- An updates list with quick filtering, timestamps, and action buttons.
- A prominent action bar featuring **Create update** and **Refresh** controls.
- Dedicated create/edit forms with status messaging and one-click access to the public `/updates` view.
- Ability to delete entries with confirmation prompts.

## Managing Users
Admins gain access to the **Users** section where they can review every account, inspect metadata, and adjust roles inline. Changes are persisted through the new `/api/users` endpoint and reflected immediately in the dashboard UI.
