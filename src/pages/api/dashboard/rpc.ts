import type { APIRoute } from 'astro';
import { DASHBOARD_METHODS, type DashboardMethodName } from '../../../lib/server/dashboard-methods';
import { isCallerWixUser } from '../../../lib/server/caller';
import { errorResponse, json } from '../../../lib/server/http-response';

/**
 * POST /api/dashboard/rpc
 * Body: { method, args }
 *
 * Replaces the legacy `Permissions.Admin` web methods: only Wix users (site
 * owners and collaborators, calling from the dashboard with
 * `httpClient.fetchWithAuth`) may call these methods.
 */
export const POST: APIRoute = async ({ request }) => {
  if (!(await isCallerWixUser())) {
    return json({ error: 'Only site collaborators can manage auctions.' }, 403);
  }

  let body: { method?: unknown; args?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const method = typeof body.method === 'string' ? body.method : '';
  if (!Object.hasOwn(DASHBOARD_METHODS, method)) {
    return json({ error: `Unknown dashboard method: ${method || '(empty)'}` }, 404);
  }
  const args = Array.isArray(body.args) ? body.args : [];

  try {
    const handler = DASHBOARD_METHODS[method as DashboardMethodName] as (...params: Array<unknown>) => Promise<unknown>;
    return json({ result: (await handler(...args)) ?? null });
  } catch (error) {
    console.error(`[api] dashboard rpc ${method} failed`, error);
    return errorResponse(error, 400);
  }
};
