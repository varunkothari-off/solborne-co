/**
 * POST /api/walks/:id/answers — one spoken answer: audio in, transcript out.
 * Body: { section: 'one'|'two', index, question, audio_base64, mime }
 *   OR   { section, index, question, manual_transcript } — saves typed/edited
 *        text directly, no transcription (the walk page's "Edit" control).
 *   Add `transcribe_only: true` alongside audio_base64 to transcribe WITHOUT
 *   saving — used by the "add more by speaking" control while mid-edit; the
 *   client merges the returned text into its own not-yet-saved draft and
 *   saves the final merged text separately via manual_transcript.
 *
 * Pipeline: decode → transcribe (ElevenLabs Scribe, or the labelled stub
 * while the key is absent) → archive raw audio (only when the service-role
 * key exists, and only for a real save — never for transcribe_only or a
 * manual-text save) → store transcript via save_walk_answer. Re-recording or
 * re-saving the same question overwrites (upsert in the RPC).
 */
import type { APIRoute } from 'astro';
import { rpc, storeWalkAudio } from '../../../../lib/supabase';
import { json, errorResponse, isUuid } from '../../../../lib/api';
import { rateLimit, clientKey, tooManyRequests } from '../../../../lib/rateLimit';
import { sttProvider } from '../../../../lib/stt';

import { walkDeliveryActivation } from '../../../../lib/walkDeliveryConfig';
export const prerender = false;

// ~9 MB of audio after base64 inflation — several minutes of opus speech.
const MAX_BODY = 12_500_000;

export const POST: APIRoute = async ({ request, params, clientAddress }) => {
  if (request.headers.get('x-solborne-delivery') === 'website' && (!walkDeliveryActivation.projectSeparationVerified || !walkDeliveryActivation.providerCallsApproved)) return new Response(JSON.stringify({ error: 'Connected website interview is awaiting activation.' }), { status: 503, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  const rl = rateLimit(clientKey(clientAddress, request, 'walk-answers'), 30, 60_000);
  if (!rl.ok) return tooManyRequests(rl);
  if (!isUuid(params.id)) return json({ error: 'invalid walk id' }, 400);

  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: 'recording too large' }, 413);
  let body: {
    section?: unknown;
    index?: unknown;
    question?: unknown;
    audio_base64?: unknown;
    mime?: unknown;
    manual_transcript?: unknown;
    transcribe_only?: unknown;
  } | null;
  try {
    body = JSON.parse(raw);
  } catch {
    body = null;
  }

  const hasAudio = typeof body?.audio_base64 === 'string' && body.audio_base64.length >= 100;
  const manualTranscript =
    typeof body?.manual_transcript === 'string' ? body.manual_transcript.trim() : '';
  const transcribeOnly = body?.transcribe_only === true;

  if (
    !body ||
    (body.section !== 'one' && body.section !== 'two') ||
    typeof body.index !== 'number' ||
    body.index < 0 ||
    body.index > 19 ||
    typeof body.question !== 'string' ||
    (!hasAudio && !manualTranscript)
  ) {
    return json(
      { error: 'section, index, question and audio (or a manual transcript) are required' },
      400
    );
  }

  let audio: Buffer | null = null;
  if (hasAudio) {
    try {
      audio = Buffer.from(body.audio_base64 as string, 'base64');
    } catch {
      return json({ error: 'audio is not valid base64' }, 400);
    }
  }
  const mime = typeof body.mime === 'string' ? body.mime.slice(0, 100) : 'audio/webm';

  try {
    let transcript: string;
    let stub = false;
    if (audio) {
      const stt = sttProvider();
      transcript = await stt.transcribe(audio, mime);
      stub = stt.isStub;
    } else {
      transcript = manualTranscript;
    }

    if (transcribeOnly) return json({ transcript, stub }, 200);

    // Raw-audio archive is best-effort: never blocks the walk. Only relevant
    // for a real recording save — never for a manual-text save.
    const audioPath = audio
      ? await storeWalkAudio(params.id, body.section, body.index, audio, mime).catch(() => null)
      : null;

    await rpc('save_walk_answer', {
      p_walk_id: params.id,
      p_section: body.section,
      p_index: body.index,
      p_question: body.question.slice(0, 1000),
      p_transcript: transcript.slice(0, 20000),
      p_audio_path: audioPath,
    });

    return json({ transcript, stub }, 201);
  } catch (err) {
    return errorResponse(err);
  }
};
