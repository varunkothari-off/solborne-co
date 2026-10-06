/** Dependency-free off-host tests; not executed locally. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fameFollowupSystem, famePreviewFollowups, famePublicResearchSystem } from './fameInterview.ts';
test('follow-up prompt recovers story, strengths, customer value and proof without paid screening', () => {
  for(const word of ['business story','strengths','customer value','evidence','not instructions']) assert.ok(fameFollowupSystem.includes(word));
  assert.match(fameFollowupSystem,/Do not promise fame or invent achievements/);
  assert.match(fameFollowupSystem,/As many or as few as are genuinely right/);
  assert.match(fameFollowupSystem,/3 if 3 are right, 9 if 9 are right/);
  assert.match(fameFollowupSystem,/Do not introduce payment or screening as a condition/);
});
test('preview follow-ups stay deterministic, grounded and ask permission for public proof', () => {
  const answers=[{transcript:'We make repairable tools'}];
  const questions=famePreviewFollowups(answers);
  assert.deepEqual(questions,famePreviewFollowups(answers));
  assert.match(questions[0],/We make repairable tools/);
  assert.match(questions.join(' '),/comfortable|leave unpublished/);
  assert.doesNotMatch(questions.join(' '),/pay to never|reclaimed time|dread/);
  assert.equal(famePreviewFollowups([]).length,4);
});
test('future public enrichment requires citations and confirmation; first-layer copy is fame-oriented', () => {
  assert.match(famePublicResearchSystem,/source URL, source title and supporting passage/);
  assert.match(famePublicResearchSystem,/explicit owner confirmation before website use/);
  const copy=readFileSync(new URL('../data/walk.ts',import.meta.url),'utf8');
  assert.match(copy,/business story/); assert.match(copy,/public proof/);
  assert.doesNotMatch(copy,/What part of your work do you dread/);
});
