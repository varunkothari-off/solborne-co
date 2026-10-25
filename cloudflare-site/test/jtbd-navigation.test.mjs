import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest} from '../src/worker.mjs';

test('Walk redirect preserves allowlisted operations context and rejects arbitrary destinations',async()=>{
 const result=await handleRequest(new Request('https://solborne.in/walk.html?intent=operations&workflow=payments&next=https://evil.test'),{AI_WALK_ENABLED:'true',SITE_ORIGIN:'https://solborne.in'});
 assert.equal(result.status,302);
 assert.equal(result.headers.get('location'),'/ai-walk.html?intent=operations&workflow=payments');
 const invalid=await handleRequest(new Request('https://solborne.in/walk.html?intent=evil&workflow=secret'),{AI_WALK_ENABLED:'true',SITE_ORIGIN:'https://solborne.in'});
 assert.equal(invalid.headers.get('location'),'/ai-walk.html');
});
