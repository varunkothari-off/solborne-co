import { fetchNoRedirect } from '../fetchNoRedirect';
/**
 * REAL ElevenLabs integration — in-browser WebRTC screening sessions.
 * Rewritten 2026-08-06 against the current ElevenAgents API (verified via
 * ElevenLabs' live docs: GET /v1/convai/conversation/token?agent_id=…,
 * response `{ token, conversation_id }`). The old Twilio outbound-call
 * architecture (POST /v1/convai/twilio/outbound-call + a registered phone
 * number) is gone: the customer talks to the agent live in the browser via
 * @elevenlabs/client, whenever they're ready.
 *
 * Correlation contract: the token response's conversation_id is stored on
 * the screening/call row (provider_call_id) BEFORE the token reaches the
 * browser, so the post-call webhook — whose payload is keyed on
 * conversation_id — can always be matched back to the right record.
 * Dynamic variables (booking_id, lead_name) can only be attached
 * CLIENT-side for WebRTC (startSession), so they are informational for the
 * agent, never a trust boundary.
 *
 * Uses its OWN key, ELEVENLABS_API_KEY_AGENT — deliberately separate from
 * ELEVENLABS_API_KEY_STT (src/lib/stt.ts), so each can be scoped to only the
 * ElevenLabs API permissions it actually needs (this one: ElevenAgents
 * write only) and given its own usage/credit cap in the ElevenLabs dashboard.
 *
 * Minting a real session is still gated in practice: voiceProvider() only
 * selects this module once ELEVENLABS_API_KEY_AGENT and ELEVENLABS_AGENT_ID
 * are real (see src/lib/env.ts stubMode). Until then, elevenLabsStub runs
 * instead — and the HARD RELEASE GATE from docs/wiring-checklist.md still
 * applies: don't treat this as launch-ready until one supervised real
 * browser session has been connected, talked through, and reviewed.
 */
import { requireEnv } from '../env';
import type { CreateSessionInput, WebRtcSession, VoiceProvider } from '../voice';

interface ElevenLabsTokenResponse {
  token?: string | null;
  conversation_id?: string | null;
}

export const elevenLabsReal: VoiceProvider = {
  name: 'elevenlabs',
  isStub: false,

  async createWebRtcSession(_input: CreateSessionInput): Promise<WebRtcSession> {
    const apiKey = requireEnv('ELEVENLABS_API_KEY_AGENT');
    const agentId = requireEnv('ELEVENLABS_AGENT_ID');

    const url = new URL('https://api.elevenlabs.io/v1/convai/conversation/token');
    url.searchParams.set('agent_id', agentId);

    const res = await fetchNoRedirect(url, {
      method: 'GET',
      headers: { 'xi-api-key': apiKey },
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(
        `ElevenLabs session token mint failed (${res.status}): ${detail.slice(0, 300)}`
      );
    }

    const data = (await res.json()) as ElevenLabsTokenResponse;
    if (!data.token || !data.conversation_id) {
      throw new Error('ElevenLabs token mint returned no token/conversation id');
    }
    return { token: data.token, conversationId: data.conversation_id, stub: false };
  },
};
