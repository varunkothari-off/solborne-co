/**
 * POST /api/walks — start a walk (anonymous). Returns the walk id (the
 * capability token for the whole pre-membership flow) and the fixed Part-1
 * questions.
 */
import type { APIRoute } from 'astro';
import { rpc } from '../../../lib/supabase';
import { json, errorResponse } from '../../../lib/api';
import { rateLimit, clientKey, tooManyRequests } from '../../../lib/rateLimit';
import { partOneQuestions } from '../../../data/walk';

import { walkDeliveryActivation } from '../../../lib/walkDeliveryConfig';
export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (request.headers.get('x-solborne-delivery') === 'website' && (!walkDeliveryActivation.projectSeparationVerified || !walkDeliveryActivation.providerCallsApproved)) return new Response(JSON.stringify({ error: 'Connected website interview is awaiting activation.' }), { status: 503, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  const rl = rateLimit(clientKey(clientAddress, request, 'walks'), 10, 60_000);
  if (!rl.ok) return tooManyRequests(rl);
  try {
    const walkId = await rpc<string>('create_walk');
    return json({ walk_id: walkId, part_one_questions: partOneQuestions }, 201);
  } catch (err) {
    return errorResponse(err);
  }
};
