import type { APIRoute } from 'astro';
import { rpc } from '../../../../lib/supabase';
import { json, isUuid, readJson } from '../../../../lib/api';
import { rateLimit, clientKey, tooManyRequests } from '../../../../lib/rateLimit';
import { researchFamePublicFacts } from '../../../../lib/llm';
import { walkDeliveryActivation } from '../../../../lib/walkDeliveryConfig';
export const prerender = false;
export const POST: APIRoute = async ({ request, params, clientAddress }) => {
  const headers = { 'cache-control': 'no-store' };
  const unavailable = () => new Response(JSON.stringify({ candidates: [], status: 'unavailable', error: 'Connected research is unavailable.' }),
    { status: 503, headers: { ...headers, 'content-type': 'application/json' } });
  if (!walkDeliveryActivation.projectSeparationVerified || !walkDeliveryActivation.providerCallsApproved) return unavailable();
  if (!isUuid(params.id)) return json({ error: 'Invalid walk.' }, 400);
  if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'Invalid origin.' }, 403);
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return json({ error: 'JSON required.' }, 415);
  const limited = rateLimit(clientKey(clientAddress, request, 'fame-research'), 3, 60_000);
  if (!limited.ok) return tooManyRequests(limited);
  const body = await readJson(request, 4000) as Record<string, unknown> | null;
  if (!body || body.researchPermission !== true || !body.contact || typeof body.contact !== 'object' || Array.isArray(body.contact)) {
    return json({ error: 'Permission for public business research is required.' }, 400);
  }
  const supplied = body.contact as Record<string, unknown>;
  if (Object.keys(body).some((key) => !['contact', 'researchPermission'].includes(key))
    || Object.keys(supplied).some((key) => !['company', 'website'].includes(key))
    || typeof supplied.company !== 'string' || typeof supplied.website !== 'string'
    || supplied.company.length > 200 || supplied.website.length > 500) return json({ error: 'Invalid public business identity.' }, 400);
  try {
    const state = await rpc<{ status: string } | null>('get_walk', { p_walk_id: params.id });
    if (!state || state.status === 'in_progress') return json({ error: 'Finish the interview first.' }, 400);
    const result = await researchFamePublicFacts({ company: supplied.company, website: supplied.website });
    const response = json(result); response.headers.set('cache-control', 'no-store'); return response;
  } catch { return unavailable(); }
};
