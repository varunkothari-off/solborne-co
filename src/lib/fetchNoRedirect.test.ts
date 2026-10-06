/** Off-host Node24; no network. A workerd runtime probe is still required. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchNoRedirect} from './fetchNoRedirect.ts';
test('all 3xx responses are rejected with one manual request and no follow-up',async()=>{
 const original=globalThis.fetch;
 try {
  for(let status=300;status<400;status++) {
   const calls:unknown[][]=[];
   globalThis.fetch=async(input,init)=>{calls.push([input,init]);return new Response(null,{status,headers:{location:'https://other.example/'}})};
   await assert.rejects(()=>fetchNoRedirect('https://approved.example/',{headers:{authorization:'synthetic'},redirect:'follow'}),/redirect refused/);
   assert.equal(calls.length,1);assert.equal((calls[0][1] as RequestInit).redirect,'manual');
  }
 } finally {globalThis.fetch=original}
});
test('nonredirect responses preserve status and body',async()=>{
 const original=globalThis.fetch;
 try {globalThis.fetch=async()=>new Response('ok',{status:200});const response=await fetchNoRedirect('https://approved.example/');assert.equal(await response.text(),'ok')}
 finally {globalThis.fetch=original}
});
