/** Off-host only: parse/bundle actual Astro scripts before behavioral checks. */
import { readFileSync } from 'node:fs';
import { build } from '../validation/node_modules/esbuild/lib/main.js';
import assert from 'node:assert/strict';
const base = new URL('../validation/', import.meta.url);
for (const target of ['src/pages/walk/index.astro', 'src/components/WebsiteInterview.astro']) {
  const page = readFileSync(new URL(target, base), 'utf8');
  const scripts = [...page.matchAll(/<script>\s*([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1, `Expected one processed script: ${target}`);
  const result = await build({ stdin: { contents: scripts[0][1], resolveDir: new URL(target.slice(0, target.lastIndexOf('/') + 1), base).pathname, loader: 'ts' }, bundle: true, write: false, format: 'iife', logLevel: 'silent' });
  assert.ok(result.outputFiles[0].text.length > 0);
  console.log(`PASS: ${target} actual TypeScript parses/bundles. Astro check remains required for types.`);
}