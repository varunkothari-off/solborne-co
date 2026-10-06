import { fetchNoRedirect } from './fetchNoRedirect';
/**
 * LLM seam for the walk — split into three independently-keyed, independently-
 * modeled stages so each can be tracked and billed separately in the
 * Anthropic console: QUESTIONS (Part 2's "right questions" from Part 1
 * transcripts), RESEARCH (web research from Part 3's typed facts), and
 * REPORT (the final synthesis of transcripts + research into the
 * preliminary audit).
 *
 * Real provider: Anthropic Claude API via plain fetch (no SDK dependency).
 * Stub while a stage's key is absent/placeholder: deterministic canned
 * output, clearly labelled, zero network calls — independently per stage.
 *
 * Env per stage (falls back left-to-right): ANTHROPIC_API_KEY_<STAGE> ->
 * ANTHROPIC_API_KEY (shared) -> stub. Model: LLM_MODEL_<STAGE> ->
 * LLM_MODEL (shared) -> claude-sonnet-5.
 *
 * Cost notes (verified 2026-07-07): claude-sonnet-5 at $2/$10 per MTok intro
 * pricing — question generation ≈ $0.01/walk, research + report combined
 * ≈ $0.15-0.40/walk (see docs/go-live-checklist.md §1a).
 */
import { fameFollowupSystem, famePreviewFollowups, famePublicResearchSystem } from './fameInterview';
import { citedBusinessFacts, publicSourceUrl, type CitedBusinessFact } from './walkDelivery';
import { walkDeliveryActivation } from './walkDeliveryConfig';
import { envVar, realEnv } from './env';
import { roadmap } from '../data/roadmap';

export interface WalkAnswerInput {
  section: string;
  question: string;
  transcript: string;
}

export interface ReportWireframe {
  label: string;
  /** Public storage URL, or a data: URI for stub previews without storage. */
  url: string;
  deviceType: string;
  stub: boolean;
}

export interface WalkReport {
  headline: string;
  sections: { title: string; body: string }[];
  matches: { slug: string; name: string; reason: string }[];
  /** Illustrative UI screens for the recommended solution (Google Stitch).
      Optional + additive — absent when the solution has no visual shape, or
      Stitch is unconfigured, or generation failed. Attached post-report. */
  wireframes?: ReportWireframe[];
  /** true when produced by the stub — surfaced in the UI. */
  stub: boolean;
}

/** The recommended solution's visual shape, for the wireframe stage. */
export type SolutionShape = 'app' | 'website' | 'none';

type Stage = 'questions' | 'research' | 'report';

/** Compact catalog context so the report maps pain to real workflows. */
function catalogContext(): string {
  const lines: string[] = [];
  for (const category of roadmap) {
    for (const item of category.items) {
      if (item.slug) lines.push(`${item.slug} | ${item.name} | ${category.name} | ${item.blurb}`);
    }
  }
  return lines.join('\n');
}

function factsFromContact(contact: Record<string, unknown>): string {
  return Object.entries(contact)
    .filter(([k, v]) => v && k !== 'email' && k !== 'phone')
    .map(([k, v]) => `${k}: ${String(v).slice(0, 500)}`)
    .join('\n');
}

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

function stageApiKey(stage: Stage): string | undefined {
  return realEnv(`ANTHROPIC_API_KEY_${stage.toUpperCase()}`) ?? realEnv('ANTHROPIC_API_KEY');
}

function stageModel(stage: Stage): string {
  return envVar(`LLM_MODEL_${stage.toUpperCase()}`) || envVar('LLM_MODEL') || 'claude-sonnet-5';
}

/** Per-stage stub check — each of the three keys is independent. */
export function isStageStub(stage: Stage): boolean {
  return !stageApiKey(stage);
}

interface AnthropicResponseContent {
  type?: string;
  text?: string;
  citations?: unknown[];
}
async function anthropicResponse(body: Record<string, unknown>, apiKey: string): Promise<{
  content: AnthropicResponseContent[]; stop_reason?: string;
}> {
  const res = await fetchNoRedirect(ANTHROPIC_URL, {
    method: 'POST', headers: { 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Anthropic request failed (${res.status}).`);
  const data = await res.json();
  if (!Array.isArray(data.content)) throw new Error('Invalid provider response.');
  return data;
}
async function anthropicCall(body: Record<string, unknown>, apiKey: string): Promise<string> {
  const data = await anthropicResponse(body, apiKey);
  return data.content.filter((block) => block.type === 'text' && block.text)
    .map((block) => block.text).join('\n').trim();
}

/** Free website research: citations stay attached, never auto-published; no audit/package gate. */
export async function researchFamePublicFacts(contact: Record<string, string>): Promise<{
  candidates: CitedBusinessFact[]; status: 'available' | 'unavailable' | 'failed' | 'no-cited-findings';
}> {
  const apiKey = stageApiKey('research');
  if (!walkDeliveryActivation.providerCallsApproved || !apiKey) return { candidates: [], status: 'unavailable' };
  const website = publicSourceUrl(contact.website);
  if (!contact.company?.trim() || !website) return { candidates: [], status: 'no-cited-findings' };
  try {
    const response = await anthropicResponse({
      model: stageModel('research'), max_tokens: 1600,
      system: famePublicResearchSystem + ' Return concise separate factual sentences with web-search citation annotations. ' +
        'Research only the supplied official business website. Do not infer business identity from private contact details.',
      messages: [{ role: 'user', content: JSON.stringify({ company: contact.company.slice(0, 200), website }) }],
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 6,
        allowed_domains: [new URL(website).hostname] }],
    }, apiKey);
    if (response.stop_reason && response.stop_reason !== 'end_turn') return { candidates: [], status: 'failed' };
    const candidates = citedBusinessFacts(response.content);
    return { candidates, status: candidates.length ? 'available' : 'no-cited-findings' };
  } catch { return { candidates: [], status: 'failed' }; }
}
/** Pull the first JSON object/array out of a model reply, tolerant of prose. */
function extractJson<T>(text: string): T {
  const start = Math.min(
    ...['{', '['].map((c) => {
      const i = text.indexOf(c);
      return i === -1 ? Number.POSITIVE_INFINITY : i;
    })
  );
  if (!Number.isFinite(start)) throw new Error('no JSON in model reply');
  // Walk back from the end to find the matching close.
  for (let end = text.length; end > start; end -= 1) {
    const candidate = text.slice(start, end).trim();
    if (!candidate.endsWith('}') && !candidate.endsWith(']')) continue;
    try {
      return JSON.parse(candidate) as T;
    } catch {
      /* keep shrinking */
    }
  }
  throw new Error('unparseable JSON in model reply');
}

// STUB fallbacks while a stage's ANTHROPIC_API_KEY_<STAGE> key is absent —
// see docs/human-steps-checklist.md step 1. Zero network calls.
function stubQuestions(answers: WalkAnswerInput[]): string[] {
  return famePreviewFollowups(answers);
}

function stubReport(answers: WalkAnswerInput[]): WalkReport {
  return {
    headline:
      'Preview report — the real, researched read switches on when the Anthropic report key is added.',
    sections: [
      {
        title: 'What we heard',
        body:
          `You answered ${answers.length} questions out loud. In preview mode we cannot ` +
          'analyse them — this placeholder proves the pipeline: your words were captured, ' +
          'transcribed, and will be read in full when generation goes live.',
      },
      {
        title: 'What the real report contains',
        body:
          'Where your hours are going, where AI genuinely fits (and where it does not), ' +
          'what we found researching you from the links you gave, and what we would verify ' +
          'next — each claim stated with its confidence, plainly.',
      },
      {
        title: 'Preliminary, by design',
        body:
          'The automated read is the start, not the verdict. The screening call and a human ' +
          'review come next — nothing reaches you as final without a person checking it.',
      },
    ],
    matches: [],
    stub: true,
  };
}

/**
 * STAGE 1 — QUESTIONS: Part 2's "right questions" from the Part 1 transcripts.
 * Keyed by ANTHROPIC_API_KEY_QUESTIONS / LLM_MODEL_QUESTIONS.
 */
export async function generateWalkQuestions(
  answers: WalkAnswerInput[]
): Promise<{ questions: string[]; stub: boolean }> {
  const apiKey = stageApiKey('questions');
  if (!apiKey) return { questions: stubQuestions(answers), stub: true };

  const transcripts = answers
    .map((a, i) => `Q${i + 1}: ${a.question}\nTHEY SAID: ${a.transcript}`)
    .join('\n\n');
  const text = await anthropicCall(
    {
      model: stageModel('questions'),
      max_tokens: 1500,
      system: fameFollowupSystem,
      messages: [{ role: 'user', content: transcripts }],
    },
    apiKey
  );
  const questions = extractJson<string[]>(text);
  if (!Array.isArray(questions) || questions.length < 1) {
    throw new Error('model returned no questions');
  }
  return { questions: questions.slice(0, 12).map((q) => String(q).slice(0, 1000)), stub: false };
}

/**
 * STAGE 2 — RESEARCH: web research on the visitor from Part 3's typed facts
 * (company, website, links). Keyed by ANTHROPIC_API_KEY_RESEARCH /
 * LLM_MODEL_RESEARCH. Never throws — returns '' when there are no facts to
 * research, the key is absent, or the call/tool fails, so the report stage
 * always proceeds (without research) rather than failing the whole walk.
 */
async function researchVisitor(
  contact: Record<string, unknown>
): Promise<{ findings: string; stub: boolean }> {
  const facts = factsFromContact(contact);
  if (!facts) return { findings: '', stub: false };

  const apiKey = stageApiKey('research');
  if (!apiKey) return { findings: '', stub: true };

  try {
    const text = await anthropicCall(
      {
        model: stageModel('research'),
        max_tokens: 1200,
        system:
          'You are the research arm for Solborne & Co., an independent AI advisory. ' +
          'Given typed facts about a visitor (company, website, links), use web search to find ' +
          'genuinely relevant, verifiable findings about their company, site, or public work — ' +
          'nothing speculative, nothing invented. Return ONLY a short plain-text brief, a few ' +
          'sentences to a couple of short paragraphs, no markdown. If you find nothing solid, ' +
          'say so plainly in one sentence.',
        messages: [{ role: 'user', content: facts }],
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 6 }],
      },
      apiKey
    );
    return { findings: text.slice(0, 4000), stub: false };
  } catch (err) {
    console.warn('[llm] research stage failed, continuing without it:', err);
    return { findings: '', stub: false };
  }
}

/**
 * STAGE 3 — REPORT: the final synthesis of transcripts + typed facts +
 * research findings into the preliminary audit. Keyed by
 * ANTHROPIC_API_KEY_REPORT / LLM_MODEL_REPORT. Runs the research stage
 * itself so callers only need one function for the whole report.
 */
export async function generateWalkReport({
  answers,
  contact,
}: {
  answers: WalkAnswerInput[];
  contact: Record<string, unknown>;
}): Promise<WalkReport> {
  const apiKey = stageApiKey('report');
  if (!apiKey) return stubReport(answers);

  const research = await researchVisitor(contact);
  const transcripts = answers
    .map((a) => `[part ${a.section}] ${a.question}\nTHEY SAID: ${a.transcript}`)
    .join('\n\n');
  const facts = factsFromContact(contact);

  const text = await anthropicCall(
    {
      model: stageModel('report'),
      max_tokens: 4000,
      system:
        'You are the preliminary-audit engine for Solborne & Co., an independent AI advisory. ' +
        'Voice: calm, plain, honest, no hype, no exclamation marks; confidence gets stated plainly, ' +
        'and what you do NOT know is stated just as plainly. Never invent facts about the person. ' +
        'You are given (1) a visitor\'s spoken answers about their work and pain, ' +
        '(2) typed facts (company, links), (3) research findings already gathered on them ' +
        '(may say nothing was found — treat that as legitimate, not a gap to fill), and ' +
        '(4) Solborne\'s workflow catalog. ' +
        'Produce a PRELIMINARY audit report as ONLY a JSON object: ' +
        '{"headline": string (one calm sentence naming their core pain in their own words), ' +
        '"sections": [{"title": string, "body": string}] (4-6 sections: what we heard; where the hours are going; ' +
        'where AI genuinely fits — and where it does not; what we found from research (omit if nothing found); ' +
        'what we would verify next), ' +
        '"matches": [{"slug": string (MUST be a slug from the catalog), "name": string, "reason": string}] (2-5 best-fit workflows)}. ' +
        'This is preliminary and automated — say so in the final section and point to the screening call as the next step. ' +
        'No markdown syntax inside strings; plain sentences.\n\nCATALOG (slug | name | category | what it does):\n' +
        catalogContext(),
      messages: [
        {
          role: 'user',
          content:
            `SPOKEN ANSWERS:\n${transcripts}\n\nTYPED FACTS:\n${facts || '(none provided)'}` +
            `\n\nRESEARCH FINDINGS:\n${research.findings || '(none — research unavailable or nothing found)'}`,
        },
      ],
    },
    apiKey
  );

  const parsed = extractJson<Omit<WalkReport, 'stub' | 'wireframes'>>(text);
  if (!parsed.headline || !Array.isArray(parsed.sections)) {
    throw new Error('model returned malformed report');
  }
  const validSlugs = new Set(
    roadmap.flatMap((c) => c.items.map((i) => i.slug)).filter(Boolean)
  );
  return {
    headline: String(parsed.headline).slice(0, 500),
    sections: parsed.sections.slice(0, 8).map((s) => ({
      title: String(s.title).slice(0, 200),
      body: String(s.body).slice(0, 5000),
    })),
    matches: (parsed.matches ?? [])
      .filter((m) => validSlugs.has(String(m.slug)))
      .slice(0, 5)
      .map((m) => ({
        slug: String(m.slug),
        name: String(m.name).slice(0, 200),
        reason: String(m.reason).slice(0, 1000),
      })),
    stub: false,
  };
}

/** Flat text summary of a report, for the cheap shape-classification call. */
function reportSummary(report: WalkReport): string {
  return [
    report.headline,
    ...report.sections.map((s) => `${s.title}: ${s.body}`),
    ...report.matches.map((m) => `${m.name}: ${m.reason}`),
  ]
    .join('\n')
    .slice(0, 4000);
}

/** Keyword heuristic fallback: does the recommended solution have a UI shape? */
function heuristicShape(report: WalkReport): SolutionShape {
  const text = reportSummary(report).toLowerCase();
  const app = /\b(mobile app|ios|android|phone app|on-the-go|native app)\b/.test(text);
  const web = /\b(website|web app|dashboard|portal|landing page|web platform|browser|admin panel|client portal)\b/.test(text);
  const backend = /\b(automation|integration|pipeline|script|backend|api|webhook|batch job|data sync|no ui|behind the scenes)\b/.test(text);
  if (app) return 'app';
  if (web) return 'website';
  // Ambiguous or backend-leaning: skip rather than force an irrelevant image.
  if (backend) return 'none';
  return 'none';
}

/**
 * WIREFRAME STAGE (classification half) — reads the finished report and
 * decides the recommended solution's visual shape. A small, cheap LLM call
 * (its own model via LLM_MODEL_WIREFRAME, defaulting to a cheap model) reusing
 * the REPORT stage key — no new billed key tier. Falls back to a keyword
 * heuristic if the key is absent or the call fails, and never throws.
 */
export async function classifySolutionShape(report: WalkReport): Promise<SolutionShape> {
  // A stub report has no real recommendation to classify, but the pipeline
  // should still be demonstrable in dev — treat it as a website so the Stitch
  // stub renders placeholder screens.
  if (report.stub) return 'website';

  const apiKey = stageApiKey('report');
  if (!apiKey) return heuristicShape(report);
  const model = envVar('LLM_MODEL_WIREFRAME') || 'claude-haiku-4-5';

  try {
    const text = await anthropicCall(
      {
        model,
        max_tokens: 8,
        system:
          'You classify what the recommended solution in an AI-advisory report would LOOK like. ' +
          'Answer with EXACTLY one word: ' +
          '"app" if the natural shape is a mobile app; ' +
          '"website" if it is a website, web app, dashboard, or portal; ' +
          '"none" if it has no clear visual shape (a backend automation, integration, or script with no UI). ' +
          'One word only, lowercase, no punctuation.',
        messages: [{ role: 'user', content: reportSummary(report) }],
      },
      apiKey
    );
    const word = text.toLowerCase().match(/app|website|none/)?.[0];
    return (word as SolutionShape) || heuristicShape(report);
  } catch (err) {
    console.warn('[llm] shape classification failed, using heuristic:', err);
    return heuristicShape(report);
  }
}
