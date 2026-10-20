import {readFileSync,existsSync} from 'node:fs';
import {generateReply,reviewCall,initialState} from '../src/ai-walk.mjs';
// Read only the explicit private file. Never print its contents or provider errors.
const file=process.argv[2]||'.env';
if(!existsSync(file)){console.error('Gemini check: private key file missing. Nothing activated.');process.exit(2);}
const entries=Object.fromEntries(readFileSync(file,'utf8').split(/\r?\n/).filter(l=>/^\s*(GEMINI_API_KEY|GEMINI_MODEL)\s*=/.test(l)).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^['"]|['"]$/g,'')];}));
// Google now issues authorization keys as well as legacy standard keys.
if(!/^[A-Za-z0-9_.-]{20,512}$/.test(entries.GEMINI_API_KEY||'')||/your_key|paste_here/i.test(entries.GEMINI_API_KEY)){console.error('Gemini check: usable Google key missing. Nothing activated.');process.exit(2);}
const env={...entries,GEMINI_MODEL:entries.GEMINI_MODEL||'gemini-3.1-flash-lite'};
let step='interview';
try{
 let state=initialState();
 const a=await generateReply(env,state,'Synthetic test: Example Repair Workshop repairs furniture for local households. Do not invent our address, legal operator or contact details.');
 if(a.reply.facts.businessName!=='Example Repair Workshop'||a.reply.ready||!a.reply.question||a.reply.facts.email||a.reply.facts.businessAddress)throw Error('Interview quality check failed');
 state={...state,...a.reply,messages:[{role:'user',text:'Example Repair Workshop repairs furniture for local households.'},{role:'assistant',text:a.reply.message+' '+a.reply.question}]};
 step='correction';const b=await generateReply(env,state,'Correction: we serve local cafes and restaurants, not households. We only repair wooden furniture. Ask your next question.');
 if(!/cafe|restaurant/i.test(b.reply.facts.audience||'')||!b.reply.question||b.reply.ready)throw Error('Correction check failed');
 const facts={...b.reply.facts,legalName:'Synthetic Workshop Operator',entityType:'Proprietorship',businessAddress:'Synthetic business address, India',industry:'Furniture repair',email:'public@example.test',callToAction:'Ask about a repair',services:'Wooden furniture repair',description:'Wooden furniture repairs for local cafes and restaurants.',audience:'Local cafes and restaurants',feesAndTerms:'Written quote before each job.',dataHandling:'Static email contact link only; no forms or uploads.',proofAndPermissions:'No testimonials, licences or financial outcome claims.',currentAndPlanned:'Furniture repair is current. Booking automation is not offered.'};
 step='research';const research=await reviewCall(env,facts,'research');step='marketing';const marketing=await reviewCall(env,facts,'marketing');
 console.log(JSON.stringify({ok:true,model:env.GEMINI_MODEL,interview:true,corrections:true,research:true,marketing:true,researchSourceCount:research.sources?.length||0,activated:false,syntheticOnly:true}));
}catch{console.error('Gemini check failed at '+step+': provider access or response validation failed. Nothing activated. No secrets or customer data were logged.');process.exit(1);}
