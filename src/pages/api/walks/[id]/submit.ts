/**
 * POST /api/walks/:id/submit — Part 3's typed facts + final submit.
 * Freezes the timer server-side (duration is computed from started_at, not
 * trusted from the client) and returns the duration plus the average across
 * everyone (only once 10+ walks exist, per spec).
 */
import type { APIRoute } from 'astro';
import { rpc } from '../../../../lib/supabase';
import { json, errorResponse, isUuid, readJson } from '../../../../lib/api';
import { rateLimit, clientKey, tooManyRequests } from '../../../../lib/rateLimit';

import { walkDeliveryActivation } from '../../../../lib/walkDeliveryConfig';
export const prerender = false;

const CONTACT_KEYS = [
  'name', 'email', 'company', 'phone', 'website',
  'linkedin', 'socials', 'news', 'anything',
];

export const POST: APIRoute = async ({ request, params, clientAddress }) => {
  if (request.headers.get('x-solborne-delivery') === 'website' && (!walkDeliveryActivation.projectSeparationVerified || !walkDeliveryActivation.providerCallsApproved)) return new Response(JSON.stringify({ error: 'Connected website interview is awaiting activation.' }), { status: 503, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  const rl = rateLimit(clientKey(clientAddress, request, 'walk-submit'), 10, 60_000);
  if (!rl.ok) return tooManyRequests(rl);
  if (!isUuid(params.id)) return json({ error: 'invalid walk id' }, 400);

  const body = (await readJson(request, 16_000)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') return json({ error: 'invalid JSON body' }, 400);

  // Whitelist + trim the contact fields; the RPC enforces name+email.
  const contact: Record<string, string> = {};
  for (const key of CONTACT_KEYS) {
    const value = body[key];
    if (typeof value === 'string' && value.trim() !== '') {
      contact[key] = value.trim().slice(0, key === 'email' ? 320 : 1000);
    }
  }
  const phone = contact.phone;
  if (!phone && request.headers.get('x-solborne-delivery') !== 'website') {
    return json({ error: 'phone number is required — the screening call needs it' }, 400);
  }
  if (phone && !/^\+?[0-9][0-9 ()\-]{6,20}$/.test(phone)) {
    return json({ error: 'phone number looks wrong — include the country code' }, 400);
  }

  try {
    const result = await rpc<Record<string, unknown>>('submit_walk', {
      p_walk_id: params.id,
      p_contact: contact,
    });
    return json(result);
  } catch (err) {
    return errorResponse(err);
  }
};
