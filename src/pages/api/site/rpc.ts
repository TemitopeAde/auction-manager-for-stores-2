import type { APIRoute } from 'astro';
import { getCallerMember } from '../../../lib/server/caller';
import { errorResponse, json } from '../../../lib/server/http-response';
import { MEMBER_SITE_METHODS, PUBLIC_SITE_METHODS } from '../../../lib/server/site-methods';

type Handler = (...params: Array<unknown>) => Promise<unknown>;

/**
 * POST /api/site/rpc
 * Body: { method, args }
 *
 * Site-facing replacements for the legacy `Permissions.Anyone` and
 * `Permissions.SiteMember` web methods. Call with `httpClient.fetchWithAuth` so
 * the member's identity reaches the server.
 */
export const POST: APIRoute = async ({ request }) => {
  let body: { method?: unknown; args?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const method = typeof body.method === 'string' ? body.method : '';
  const args = Array.isArray(body.args) ? body.args : [];

  try {
    if (Object.hasOwn(PUBLIC_SITE_METHODS, method)) {
      const handler = PUBLIC_SITE_METHODS[method as keyof typeof PUBLIC_SITE_METHODS] as Handler;
      return json({ result: (await handler(...args)) ?? null });
    }

    if (Object.hasOwn(MEMBER_SITE_METHODS, method)) {
      const member = await getCallerMember();
      if (!member) {
        return json({ error: 'Sign in to continue.' }, 401);
      }
      const handler = MEMBER_SITE_METHODS[method as keyof typeof MEMBER_SITE_METHODS] as Handler;
      return json({ result: (await handler(member, ...args)) ?? null });
    }
  } catch (error) {
    console.error(`[api] site rpc ${method} failed`, error);
    return errorResponse(error, 400);
  }

  return json({ error: `Unknown site method: ${method || '(empty)'}` }, 404);
};
