import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveToken,LIVE_MODEL} from '../src/walk-live-token.mjs';
test('Live credentials are single-use, short-lived and locked to transcription only',async()=>{
 let payload,endpoint,headers;const now=Date.now();
 const result=await createLiveToken({GEMINI_API_KEY:'PRIVATE_SERVER_KEY'},{now,fetcher:async(url,options)=>{endpoint=url;payload=JSON.parse(options.body);headers=options.headers;return Response.json({name:'auth_tokens/one-use-token'});}});
 assert.equal(endpoint,'https://generativelanguage.googleapis.com/v1beta/auth_tokens');assert.equal(headers['x-goog-api-key'],'PRIVATE_SERVER_KEY');
 assert.equal(payload.uses,1);assert.equal(Date.parse(payload.expireTime)-now,1800000);assert.equal(Date.parse(payload.newSessionExpireTime)-now,60000);
 assert.equal(payload.bidiGenerateContentSetup.model,'models/'+LIVE_MODEL);assert.deepEqual(payload.bidiGenerateContentSetup.generationConfig.responseModalities,['TEXT']);assert.ok(payload.bidiGenerateContentSetup.inputAudioTranscription);
 assert.equal(result.token,'auth_tokens/one-use-token');assert.equal(JSON.stringify(result).includes('PRIVATE_SERVER_KEY'),false);assert.equal(result.model,LIVE_MODEL);
});
test('Live token provider failure is bounded and never exposes provider errors',async()=>{
 await assert.rejects(()=>createLiveToken({GEMINI_API_KEY:'SYNTHETIC'},{fetcher:async()=>new Response('PRIVATE ERROR',{status:403})}),/^Error: Live transcription unavailable$/);
 await assert.rejects(()=>createLiveToken({GEMINI_API_KEY:'SYNTHETIC'},{fetcher:async()=>Response.json({name:'not-a-token'})}));
});

