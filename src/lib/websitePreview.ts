/** Deterministic client-local website delivery. No AI, API, storage or external dependency. */
export interface WebsiteInterview {
  businessName: string;
  description: string;
  audience: string;
  services: string;
  location: string;
  callToAction: string;
  email: string;
  phone: string;
  websiteUrl: string;
}
export type WebsiteValidation = { ok: true; value: WebsiteInterview }
  | { ok: false; errors: Record<string, string> };
export const websiteFields = {
  businessName: 120, description: 3000, audience: 800, services: 3000,
  location: 200, callToAction: 120, email: 254, phone: 40, websiteUrl: 500,
} as const;
export function validateWebsiteInterview(input: unknown): WebsiteValidation {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, errors: { form: 'Enter your business details.' } };
  const body = input as Record<string, unknown>;
  const errors: Record<string, string> = {};
  if (Object.keys(body).some((key) => !Object.prototype.hasOwnProperty.call(websiteFields, key))) errors.form = 'Unexpected business fields.';
  const value = {} as WebsiteInterview;
  for (const key of Object.keys(websiteFields) as (keyof WebsiteInterview)[]) {
    const raw = body[key] ?? '';
    if (typeof raw !== 'string') { errors[key] = 'Enter text.'; value[key] = ''; continue; }
    value[key] = raw.trim();
    if (value[key].length > websiteFields[key] || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value[key])) errors[key] = 'This field is too long or contains unsupported control characters.';
  }
  for (const key of ['businessName', 'description', 'audience', 'services', 'callToAction'] as const) {
    if (!value[key]) errors[key] = 'Please answer this question.';
  }
  if (value.email && !/^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value.email)) errors.email = 'Enter a valid public business email.';
  if (value.phone && !/^\+?[0-9][0-9 ()-]{6,20}$/.test(value.phone)) errors.phone = 'Enter a business phone with country code.';
  if (value.websiteUrl) {
    try {
      const url = new URL(value.websiteUrl);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || !url.hostname) throw new Error('unsafe link');
      value.websiteUrl = url.href;
    } catch { errors.websiteUrl = 'Use an http or https business link without embedded credentials.'; }
  }
  if (!value.email && !value.phone && !value.websiteUrl) errors.contact = 'Add at least one public business contact option.';
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}
export const escapeWebsiteText = (value: string): string => value.replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]!));
export function renderWebsite(interview: WebsiteInterview): string {
  const checked = validateWebsiteInterview(interview);
  if (!checked.ok) throw new Error('Valid public business facts are required.');
  const facts = checked.value;
  const text = escapeWebsiteText;
  const contacts = [
    facts.email ? `<a href="mailto:${text(facts.email)}" rel="noreferrer">${text(facts.email)}</a>` : '',
    facts.phone ? `<a href="tel:${text(facts.phone.replace(/[ ()-]/g, ''))}" rel="noreferrer">${text(facts.phone)}</a>` : '',
    facts.websiteUrl ? `<a href="${text(facts.websiteUrl)}" rel="noreferrer">Business link</a>` : '',
  ].filter(Boolean).join('\n');
  const serviceItems = facts.services.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    .map((line) => `<li>${text(line)}</li>`).join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>${text(facts.businessName)}</title><meta name="description" content="${text(facts.description)}">
<style>
:root{--ink:#211D18;--steel:#375562;--amber:#C1872E;--stone:#8B8274;--paper:#F1EBDD}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:1.05rem/1.7 Arial,sans-serif}
.wrap{max-width:70rem;margin:auto;padding:2rem clamp(1rem,5vw,4rem)}header{border-bottom:1px solid var(--stone)}
nav{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem}a{color:var(--steel);overflow-wrap:anywhere}
h1,h2,.brand{font-family:Georgia,serif;font-weight:500;line-height:1.15}h1{font-size:clamp(2.5rem,7vw,5rem);max-width:18ch}
h2{font-size:2rem}.brand{font-size:1.4rem}.hero{padding-block:3rem}.copy{white-space:pre-line;overflow-wrap:anywhere;max-width:65ch}
.eyebrow{font:0.8rem/1.5 monospace;color:var(--steel)}section{border-top:1px solid var(--stone);padding-block:2rem}
.cta{display:inline-block;border-radius:2rem;background:var(--ink);color:var(--paper);padding:0.8rem 1.5rem;text-decoration:none}
li{margin-block:0.7rem;white-space:pre-line;overflow-wrap:anywhere}.contacts{display:grid;gap:0.8rem}footer{border-top:1px solid var(--stone);font-size:0.9rem}
a:focus-visible{outline:3px solid var(--steel);outline-offset:4px}.point{display:inline-block;width:0.6rem;height:0.6rem;border-radius:50%;background:var(--amber)}
</style></head><body><header><div class="wrap"><nav aria-label="Website navigation"><span class="brand">${text(facts.businessName)}</span>
<a href="#contact">${text(facts.callToAction)}</a></nav></div></header>
<main class="wrap"><div class="hero"><p class="eyebrow"><span class="point" aria-hidden="true"></span> ${text(facts.businessName)}</p>
<h1>${text(facts.businessName)}</h1><p class="copy">${text(facts.description)}</p><a class="cta" href="#contact">${text(facts.callToAction)}</a></div>
<section aria-labelledby="audience"><h2 id="audience">Who we work with</h2><p class="copy">${text(facts.audience)}</p></section>
<section aria-labelledby="services"><h2 id="services">What we offer</h2><ul>${serviceItems}</ul></section>
${facts.location ? `<section aria-labelledby="location"><h2 id="location">Where we work</h2><p class="copy">${text(facts.location)}</p></section>` : ''}
<section id="contact" aria-labelledby="contact-title"><h2 id="contact-title">${text(facts.callToAction)}</h2><div class="contacts">${contacts}</div></section></main>
<footer><div class="wrap">${text(facts.businessName)}</div></footer></body></html>`;
}
export function websiteReadme(interview: WebsiteInterview): string {
  return `${interview.businessName} — your website source\n\nOpen index.html in your browser. This is a standalone static website generated from the public business facts you supplied; it contains no AI service, analytics or lead-capture backend. Review every fact and contact link before publishing.\n\nYou control the downloaded files and can edit or import them into your own repository. No GitHub repository or hosted site has been created. To use a client-owned GitHub repository, create it in your own account and import index.html. Never disclose a password or token.\n\nThese source files are delivered free. Hosting, domain registration/renewal, ongoing maintenance and future edits are separate arrangements; no lifetime hosting or maintenance promise is included. Select hosting suitable for your business and check its terms before publishing.\n\nThe optional seven-day premium AI lead pilot is not included or activated. It requires separately accepted terms, usage budget, business payment and proven auto-stop.\n`;
}
export function createWebsiteFiles(interview: WebsiteInterview): { filename: string; mimeType: string; content: string }[] {
  return [
    { filename: 'index.html', mimeType: 'text/html;charset=utf-8', content: renderWebsite(interview) },
    { filename: 'README.txt', mimeType: 'text/plain;charset=utf-8', content: websiteReadme(interview) },
  ];
}
