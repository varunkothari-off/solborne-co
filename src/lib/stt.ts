import { fetchNoRedirect } from './fetchNoRedirect';
/**
 * Speech-to-text seam for the walk's voice answers.
 *
 * Real provider: ElevenLabs Scribe, keyed separately from the outbound-call
 * agent (ELEVENLABS_API_KEY_STT vs. ELEVENLABS_API_KEY_AGENT — see
 * src/lib/env.ts stubMode.elevenlabs for the agent side). Stub while the STT
 * key is absent or a placeholder: returns a labelled preview transcript so
 * the flow stays testable end-to-end without a key and without any network
 * call.
 *
 * (2026-07-12: briefly swapped to Wispr Flow, reverted same day — Wispr
 * Flow's Voice Interface API turned out to be invite-only with no
 * self-serve signup, a blocker discovered too late. Back on ElevenLabs
 * Scribe. If a vendor swap is considered again, verify the vendor's
 * access/signup model BEFORE writing any code.)
 */
import { realEnv } from './env';

export interface TranscriptionProvider {
  readonly name: string;
  readonly isStub: boolean;
  transcribe(audio: Buffer, mime: string): Promise<string>;
}

const elevenLabsStt: TranscriptionProvider = {
  name: 'elevenlabs-scribe',
  isStub: false,

  async transcribe(audio: Buffer, mime: string): Promise<string> {
    const apiKey = realEnv('ELEVENLABS_API_KEY_STT');
    if (!apiKey) throw new Error('ELEVENLABS_API_KEY_STT missing');
    const form = new FormData();
    form.append('model_id', 'scribe_v1');
    form.append(
      'file',
      new Blob([new Uint8Array(audio)], { type: mime || 'audio/webm' }),
      'answer.webm'
    );
    const res = await fetchNoRedirect('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: form,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`transcription failed (${res.status}): ${detail.slice(0, 300)}`);
    }
    const data = (await res.json()) as { text?: string };
    const text = (data.text ?? '').trim();
    if (!text) throw new Error('transcription returned empty text');
    return text;
  },
};

// STUB: replaced by the real ElevenLabs Scribe call once ELEVENLABS_API_KEY
// is set — see docs/human-steps-checklist.md step 2. Zero network calls.
const sttStub: TranscriptionProvider = {
  name: 'stt-stub',
  isStub: true,

  async transcribe(audio: Buffer, _mime: string): Promise<string> {
    const seconds = Math.max(1, Math.round(audio.length / 12_000));
    return (
      `[Preview transcript — real voice transcription switches on when the ` +
      `ElevenLabs STT key is added. We received about ${seconds}s of audio.]`
    );
  },
};

export function sttProvider(): TranscriptionProvider {
  // Separately-keyed from the agent/call side (ELEVENLABS_API_KEY_AGENT) so
  // each shows its own usage/credit limit in the ElevenLabs dashboard.
  return realEnv('ELEVENLABS_API_KEY_STT') ? elevenLabsStt : sttStub;
}

/**
 * Surface stub-ness of the walk's own voice pipeline (STT only) for the /walk/
 * banner. Deliberately does NOT factor in stubMode.elevenlabs (the outbound
 * screening-call agent) — that's a separate, later stage with its own
 * readiness signal; conflating the two made this banner claim "preview mode"
 * even when transcription was already fully real.
 */
export function voicePreviewMode(): boolean {
  return sttProvider().isStub;
}
