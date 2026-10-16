import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=name=>readFileSync('public/'+name,'utf8');
test('concurrent account consumers share a single identity and CSRF request',async()=>{
 let calls=0;
 const context=vm.createContext({window:{},fetch:async()=>{calls++;return {ok:true,json:async()=>({authenticated:true,csrf:'same-csrf'})};},Error});
 vm.runInContext(source('auth-session.js'),context);
 const [a,b]=await Promise.all([context.window.solborneSession(),context.window.solborneSession()]);
 assert.equal(calls,1);assert.equal(a,b);assert.equal(a.csrf,'same-csrf');
});
test('signed-in navigation signs out with the verified CSRF and redirects only on success',async()=>{
 const elements=[],entry={href:'/signin.html',textContent:'Sign in',setAttribute(name,value){this[name]=value;}},nav={querySelectorAll:()=>[],querySelector:()=>entry,append:(...items)=>elements.push(...items)};
 const session={authenticated:true,csrf:'checked-csrf'};let redirect='',payload;
 const context=vm.createContext({window:{solborneSession:async()=>session},document:{querySelector:()=>nav,createElement:()=>({setAttribute(){},addEventListener(type,fn){this.click=fn;}})},location:{pathname:'/canvas.html',replace:url=>{redirect=url;}},fetch:async(url,options)=>{payload={url,...options};return {ok:true};},URL});
 vm.runInContext(source('account-nav.js'),context);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(entry.href,'/canvas.html');assert.equal(entry['aria-current'],'page');assert.equal(elements[0].textContent,'Sign out');await elements[0].click();
 assert.equal(payload.url,'/api/auth/signout');assert.equal(JSON.parse(payload.body).csrf,session.csrf);assert.equal(redirect,'/signin.html');
});
test('private journey pages share logo, navigation and footer, and canvas keeps requested hierarchy',()=>{
 for(const name of ['signin.html','canvas.html','walk.html','versions.html','ai-walk.html']){
  const html=source(name);assert.match(html,/src="\/assets\/bearing.svg"/);assert.match(html,/id="site-nav"/);assert.match(html,/\/journey-shell.css/);assert.match(html,/\/account-nav.js/);assert.match(html,/aria-label="Footer navigation"/);
  assert.doesNotMatch(html,/href="\/#(?:approach|questions|register)"/);
 }
 const canvas=source('canvas.html');assert.match(canvas,/Take the Walk of Fame/);assert.match(canvas,/lifetime-free website/);assert.match(canvas,/class="another-business"/);assert.doesNotMatch(canvas,/<button id="signout"/);
});
