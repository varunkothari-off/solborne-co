/** Focused owner-copy assertions. AUTHORED ONLY; no local test runtime permitted. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { walk } from './walk.ts';
import { site } from './site.ts';
test('owner-approved name and mission retain the existing walk route', () => {
  assert.equal(walk.name, 'The Walk of Fame');
  assert.equal(walk.cta, 'Walk of Fame');
  assert.equal(walk.path, '/walk/');
  assert.equal(site.primaryDomain, 'solborne.in');
  assert.equal(site.outreachDomain, 'getsolborne.com');
  assert.equal(site.tagline, 'Every business deserves a webspace it owns.');
});
test('worldwide invitation describes gated conversation and free website handoff', () => {
  const page = readFileSync(new URL('../pages/walk/index.astro', import.meta.url), 'utf8');
  assert.match(page, /Businesses worldwide are welcome/);
  assert.match(page, /Connected interview activation is pending/);
  assert.match(page, /showWebsiteDelivery/);
  assert.match(page, /mode'\) !== 'local-export'/);
});