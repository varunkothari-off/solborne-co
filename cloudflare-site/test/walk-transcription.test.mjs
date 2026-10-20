import test from 'node:test';
import assert from 'node:assert/strict';
import {transcribeAudio,validateAudio} from '../src/walk-transcription.mjs';
const input={consent:true,audioConsent:true,audio:btoa('RIFF'+String.fromCharCode(40,0,0,0)+'WAVE'+' '.repeat(48)),mimeType:'audio/wav',durationMs:1000};
test('audio requires separate explicit permission and bounded valid audio',()=>{
 assert.equal(validateAudio(input).mimeType,'audio/wav');
 for(const bad of [{audioConsent:false},{consent:false},{durationMs:60001},{audio:'not-base64!'},{mimeType:'text/html'},{audio:btoa('<html>not audio</html>')},{audio:'A'.repeat(4*1024*1024+4)}])assert.throws(()=>validateAudio({...input,...bad}));
});
test('transcription requests only text in the spoken language, no answer or translation',async()=>{
 let sent;const r=await transcribeAudio({GEMINI_API_KEY:'SYNTHETIC'},input,{fetcher:async(url,options)=>{sent={url,payload:JSON.parse(options.body)};return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({text:'We started in 1998.'})}]}}]}));}});
 assert.equal(r.text,'We started in 1998.');assert.ok(sent.url.includes('gemini-3.1-flash-lite'));assert.ok(sent.payload.systemInstruction.parts[0].text.includes('Do not translate'));assert.equal(sent.payload.contents[0].parts[0].inlineData.data,input.audio);assert.equal(r.audio,undefined);
});
test('provider failure and empty audio do not fabricate a transcript or leak errors',async()=>{
 await assert.rejects(()=>transcribeAudio({GEMINI_API_KEY:'SYNTHETIC'},input,{fetcher:async()=>new Response('PRIVATE_PROVIDER_ERROR',{status:500})}),/Transcription unavailable/);
 await assert.rejects(()=>transcribeAudio({GEMINI_API_KEY:'SYNTHETIC'},input,{fetcher:async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:'{"text":""}'}]}}]}))}),/No clear speech/);
});
test('overlong transcript is returned for editing, never silently truncated',async()=>{
 const text='business '.repeat(300);const r=await transcribeAudio({GEMINI_API_KEY:'SYNTHETIC'},input,{fetcher:async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({text})}]}}]}))});assert.equal(r.text,text.trim());assert.ok(r.text.length>2000);
});
