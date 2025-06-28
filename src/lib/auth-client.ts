import { createAuthClient } from 'better-auth/solid';
import { magicLinkClient, genericOAuthClient } from 'better-auth/client/plugins';

/**
 * Client instance to communicate with the Better Auth API.
 *
 * Plugins are registered for magic link authentication and generic OAuth so the
 * same client can initiate both flows from the browser.
 */
export const authClient = createAuthClient({
  plugins: [magicLinkClient(), genericOAuthClient()],
});
