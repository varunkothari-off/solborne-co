import type { PublicBusinessFactCandidate } from './fameInterview.ts';
import { validateWebsiteInterview, type WebsiteInterview } from './websitePreview.ts';
export interface CitedBusinessFact extends PublicBusinessFactCandidate { id: string; ownerConfirmed: false; }
export function publicSourceUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password
      || !url.hostname.includes('.') || /^[0-9.]+$/.test(url.hostname)
      || /^(localhost|127\.|10\.|192\.168\.)/.test(url.hostname) || url.hostname.endsWith('.local')) return null;
    return url.href;
  } catch { return null; }
}
/** Keeps provider text with its attached citation annotations; uncited suggestions never become facts. */
export function citedBusinessFacts(content: unknown): CitedBusinessFact[] {
  if (!Array.isArray(content)) return [];
  const facts: CitedBusinessFact[] = [];
  for (const item of content) {
    if (!item || item.type !== 'text' || typeof item.text !== 'string' || !item.text.trim()
      || !Array.isArray(item.citations)) continue;
    const sources: CitedBusinessFact['sources'] = [];
    for (const citation of item.citations) {
      const url = publicSourceUrl(citation?.url);
      if (citation?.type !== 'web_search_result_location' || !url
        || typeof citation.title !== 'string' || typeof citation.cited_text !== 'string') continue;
      sources.push({ url, title: citation.title.slice(0, 300), supportingPassage: citation.cited_text.slice(0, 1000) });
    }
    if (sources.length) facts.push({ id: `fact-${facts.length}`, claim: item.text.trim().slice(0, 1500), sources, ownerConfirmed: false });
  }
  return facts;
}
/** Suggestions, not approved publication. Owner must review every public field. */
export function websiteDraftFromInterview(
  contact: Record<string, string>, answers: readonly { section: string; index: number; transcript: string }[],
): WebsiteInterview {
  const opening = answers.find((answer) => answer.section === 'one' && answer.index === 0)?.transcript ?? '';
  return { businessName: contact.company ?? '', description: opening.slice(0, 3000), audience: '', services: '',
    location: '', callToAction: '', email: contact.email ?? '', phone: contact.phone ?? '',
    websiteUrl: publicSourceUrl(contact.website) ?? '' };
}
/** Explicit ID selections are required; citation/source text survives into the exported website. */
export function confirmWebsiteBrief(
  input: unknown, candidates: readonly CitedBusinessFact[], acceptedIds: readonly string[], ownerApproved: boolean,
): ReturnType<typeof validateWebsiteInterview> {
  if (ownerApproved !== true) return { ok: false, errors: { approval: 'Review and approve the public website facts first.' } };
  const validation = validateWebsiteInterview(input);
  if (!validation.ok) return validation;
  const accepted = new Set(acceptedIds);
  if (accepted.size !== acceptedIds.length || [...accepted].some((id) => !candidates.some((fact) => fact.id === id))) {
    return { ok: false, errors: { approval: 'Choose only the cited suggestions shown for this interview.' } };
  }
  const extra = candidates.filter((fact) => accepted.has(fact.id)).map((fact) =>
    `Owner-confirmed public fact: ${fact.claim}\n${fact.sources.map((source) => `Source: ${source.title} — ${source.url}`).join('\n')}`);
  return validateWebsiteInterview({ ...validation.value,
    description: [validation.value.description, ...extra].join('\n\n') });
}
