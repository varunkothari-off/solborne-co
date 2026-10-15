import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('actual interview page boots while disconnected without missing controls or a stuck checking state',async()=>{
 const html=readFileSync('public/ai-walk.html','utf8'),source=readFileSync('public/ai-walk.js','utf8');
 const nodes=new Map([...html.matchAll(/id="([^"]+)"/g)].map(([,id])=>[id,{textContent:'',disabled:false,checked:false,hidden:false,setAttribute(){},addEventListener(){}}]));
 const sandbox={crypto,Blob,URL,console,document:{getElementById:id=>nodes.get(id)||null},fetch:async url=>url==='/api/ai-walk/status'?new Response(JSON.stringify({ok:true,enabled:false}),{headers:{'Content-Type':'application/json'}}):new Response('{}',{status:403})};
 vm.runInNewContext(source,sandbox);
 await new Promise(resolve=>setImmediate(resolve));
 assert.match(nodes.get('ai-availability').textContent,/being configured/);
 assert.equal(nodes.get('ai-send').disabled,true);
 assert.equal(nodes.get('ai-export-brief').disabled,true);
 assert.match(html,/<div id="ai-legacy-builder" hidden>/);
});
