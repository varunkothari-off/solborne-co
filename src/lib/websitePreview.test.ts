/** Dependency-free tests for off-host Node24 native TypeScript; NOT run locally. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWebsiteFiles, escapeWebsiteText, renderWebsite, validateWebsiteInterview } from './websitePreview.ts';
const facts = () => ({ businessName: 'Example Works', description: 'We repair everyday things.', audience: 'Local families',
  services: 'Repairs\nAdvice', location: '', callToAction: 'Talk to us', email: 'hello@example.org', phone: '', websiteUrl: '' });
test('valid public facts produce standalone owned files and omit empty optional sections', () => {
  const result = validateWebsiteInterview(facts()); assert.equal(result.ok, true);
  const files = createWebsiteFiles(facts());
  assert.deepEqual(files.map((file) => file.filename), ['index.html', 'README.txt']);
  assert.match(files[0].content, /Example Works/); assert.match(files[0].content, /<li>Repairs<\/li>/);
  assert.doesNotMatch(files[0].content, /Where we work|<script|<form|<iframe|src=|https?:\/\//);
  assert.match(files[1].content, /No GitHub repository or hosted site has been created/);
  assert.match(files[1].content, /no lifetime hosting or maintenance promise/);
});
test('escapes text, attributes, quotes and injected markup without executing user content', () => {
  assert.equal(escapeWebsiteText(`<&"'>`), '&lt;&amp;&quot;&#39;&gt;');
  const html = renderWebsite({ ...facts(), businessName: '<img src=x onerror=alert(1)>', description: '</style><script>bad()</script>',
    services: '<a href="javascript:bad()">bad</a>\nOrdinary service' });
  assert.match(html, /&lt;img/); assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<img|<script|<a href="javascript:/);
});
test('rejects invalid objects, missing answers, all blank contacts, control characters and oversize facts', () => {
  for (const input of [null, [], '', {}, { ...facts(), businessName: '' }, { ...facts(), services: '' },
    { ...facts(), email: '' }, { ...facts(), description: 'x'.repeat(3001) },
    { ...facts(), audience: 'bad\u0000text' }, { ...facts(), businessName: 2 }, { ...facts(), secret: 'not accepted' }]) {
    assert.equal(validateWebsiteInterview(input).ok, false);
  }
});
test('rejects dangerous URLs and malformed contact values; safely handles a query-string link', () => {
  for (const websiteUrl of ['javascript:alert(1)', 'data:text/html,bad', 'file:///tmp/x', 'https://user:password@example.org/']) {
    assert.equal(validateWebsiteInterview({ ...facts(), websiteUrl }).ok, false);
  }
  assert.equal(validateWebsiteInterview({ ...facts(), email: 'x@y.org?cc=z' }).ok, false);
  assert.equal(validateWebsiteInterview({ ...facts(), phone: 'call me' }).ok, false);
  assert.match(renderWebsite({ ...facts(), websiteUrl: 'https://example.org/?a=1&b=2' }), /a=1&amp;b=2/);
});
test('supports international text and replaces edited facts', () => {
  const name = '\u0928\u092e\u0938\u094d\u0924\u0947';
  const first = createWebsiteFiles({ ...facts(), businessName: name });
  assert.ok(first[0].content.includes(name));
  const edited = createWebsiteFiles({ ...facts(), businessName: 'Edited Business' });
  assert.match(edited[0].content, /Edited Business/); assert.ok(!edited[0].content.includes(name));
});
test('rendering is deterministic, refuses invalid facts, and does not fabricate claims or pilot activation', () => {
  assert.equal(renderWebsite(facts()), renderWebsite(facts()));
  assert.throws(() => renderWebsite({ ...facts(), email: '' }));
  assert.doesNotMatch(renderWebsite(facts()), /testimonials|confidence|guarantee|paid|fame|payment/i);
  assert.match(createWebsiteFiles(facts())[1].content, /pilot is not included or activated/);
});

test('client UI keeps preview isolated, edit invalidates stale downloads, and downloads use local blobs only', () => {
  const source = readFileSync(new URL('../components/WebsiteInterview.astro', import.meta.url), 'utf8');
  assert.match(source, /does not send them to a server/);
  assert.match(source, /app-controlled persistent storage/);
  assert.match(source, /browser may restore form entries/);
  assert.doesNotMatch(source, /Refreshing or leaving clears them/);
  assert.match(source, /walkDeliveryActivation\.providerCallsApproved/);
  assert.match(source, /researchPermission: true/);
  assert.match(source, /sandbox=""/); assert.match(source, /referrerpolicy="no-referrer"/);
  assert.match(source, /files = null; downloads\.forEach/);
  assert.match(source, /frame\.removeAttribute\('srcdoc'\)/);
  assert.match(source, /URL\.createObjectURL\(new Blob/);
  assert.match(source, /link\.download = file\.filename/);
  assert.match(source, /URL\.revokeObjectURL/);
  assert.doesNotMatch(source, /XMLHttpRequest|sendBeacon|localStorage|sessionStorage|innerHTML|\.submit\(/);
});
