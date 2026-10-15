import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import worker from '../dist/server/index.js';
test('fresh deployment build serves all three original fonts at their referenced URL paths', async () => {
  for (const name of ['ibm-plex-mono-latin-400-normal.woff2', 'public-sans-latin-wght-normal.woff2', 'source-serif-4-latin-wght-normal.woff2']) {
    const response = await worker.fetch(new Request('https://solborne.in/assets/fonts/' + name), {SITE_ORIGIN:'https://solborne.in'});
    assert.equal(response.status, 200, name);
    assert.equal(response.headers.get('Content-Type'), 'font/woff2');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(new URL('../public/assets/fonts/' + name, import.meta.url)));
  }
});
