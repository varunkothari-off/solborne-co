/** Explicit private WB handoff tracker. No notifications or production dispatcher. */
import {isAbsolute,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {executeQuery} from './owner-queue.mjs';

const reference=/^WB-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const statuses=new Set(['awaiting_manual_review','in_review','awaiting_customer','proposal_ready','completed']);
const transitions={awaiting_manual_review:['in_review','awaiting_customer'],in_review:['awaiting_customer','proposal_ready','completed'],awaiting_customer:['in_review'],proposal_ready:['in_review','awaiting_customer','completed'],completed:[]};
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max&&!/[\x00-\x1f\x7f]/.test(value);
const millis=value=>Number.isSafeInteger(value)&&value>=0&&value<=8640000000000000;

export function listQuery(){
 return `SELECT registration_id,revision,json_extract(state_json,'$.submission.id') AS reference,COALESCE(json_extract(state_json,'$.submission.service'),'website') AS service,json_extract(state_json,'$.submission.status') AS status,COALESCE(json_extract(state_json,'$.submission.owner'),'Solborne team') AS owner,json_extract(state_json,'$.submission.nextAction') AS nextAction,json_extract(state_json,'$.submission.nextUpdateAt') AS nextUpdateAt,json_extract(state_json,'$.submission.submittedAt') AS submittedAt,json_extract(state_json,'$.submission.dueAt') AS dueAt FROM solborne_ai_walks WHERE json_valid(state_json) AND json_type(state_json,'$.submission')='object' AND json_extract(state_json,'$.submission.id') LIKE 'WB-%' ORDER BY updated_at ASC,registration_id ASC LIMIT 200`;
}

export function updateQuery(input,now=Date.now()){
 const {reference:ref,revision,expect,status,owner,nextAction,nextUpdateAt=null}=input||{};
 if(!reference.test(ref||'')||!Number.isSafeInteger(revision)||revision<0||!statuses.has(expect)||!statuses.has(status)||!text(owner,120)||!text(nextAction,500)||!millis(now)||(nextUpdateAt!==null&&(!millis(nextUpdateAt)||nextUpdateAt<=now)))throw Error('Use an exact WB reference, revision, expected status, responsible owner, next action and valid future update time.');
 if(expect!==status&&!transitions[expect].includes(status))throw Error('This handoff status transition is not supported.');
 const event=JSON.stringify({at:now,status,owner:owner.trim(),nextAction:nextAction.trim(),nextUpdateAt});
 // JSON predicates guard older or malformed rows. Preserve every other state field.
 // Retain the latest 99 events before append; a longer history cannot grow the row without bound.
 // Select the retained tail in chronological order before appending.
 const orderedHistory=`COALESCE((SELECT json_group_array(json(value)) FROM (SELECT value FROM json_each(CASE WHEN json_type(state_json,'$.submission.history')='array' THEN json_extract(state_json,'$.submission.history') ELSE '[]' END) WHERE CAST(key AS INTEGER)>=MAX(0,json_array_length(CASE WHEN json_type(state_json,'$.submission.history')='array' THEN json_extract(state_json,'$.submission.history') ELSE '[]' END)-99) ORDER BY CAST(key AS INTEGER))),'[]')`;
 return `UPDATE solborne_ai_walks SET state_json=json_set(state_json,'$.submission.status',${quote(status)},'$.submission.owner',${quote(owner.trim())},'$.submission.nextAction',${quote(nextAction.trim())},'$.submission.nextUpdateAt',${nextUpdateAt===null?'NULL':nextUpdateAt},'$.submission.updatedAt',${now},'$.submission.history',json_insert(json(${orderedHistory}),'$[#]',json(${quote(event)}))),revision=revision+1,updated_at=${now} WHERE json_valid(state_json) AND json_type(state_json,'$.submission')='object' AND json_extract(state_json,'$.submission.id')=${quote(ref)} AND revision=${revision} AND busy_until<=${now} AND json_extract(state_json,'$.submission.status')=${quote(expect)} AND (json_extract(state_json,'$.submission.status')<>${quote(status)} OR COALESCE(json_extract(state_json,'$.submission.owner'),'')<>${quote(owner.trim())} OR COALESCE(json_extract(state_json,'$.submission.nextAction'),'')<>${quote(nextAction.trim())} OR COALESCE(json_extract(state_json,'$.submission.nextUpdateAt'),-1)<>${nextUpdateAt===null?-1:nextUpdateAt}) RETURNING registration_id,revision,json_extract(state_json,'$.submission.id') AS reference,json_extract(state_json,'$.submission.status') AS status`;
}

export function parseArguments(args){
 const [action,...rest]=args;if(!['list','update'].includes(action))throw Error('Usage: walk-handoffs.mjs list|update [WB-reference] --wrangler ABSOLUTE_JS [--remote] [update options --apply].');
 const options={action,remote:false,apply:false};if(action==='update')options.reference=rest.shift();
 const fields=new Set(['--wrangler','--revision','--expect','--status','--owner','--next-action','--next-update']);
 for(let i=0;i<rest.length;i++){const option=rest[i];if(option==='--remote')options.remote=true;else if(option==='--apply')options.apply=true;else if(fields.has(option)&&rest[i+1]&&!rest[i+1].startsWith('--'))options[option.slice(2)]=rest[++i];else throw Error('Unknown or incomplete handoff option.');}
 if(!options.wrangler||!isAbsolute(options.wrangler)||!/\.(?:js|mjs|cjs)$/i.test(options.wrangler))throw Error('Provide an absolute existing Wrangler JavaScript entry point.');
 if(action==='list'){
  if(Object.keys(options).some(key=>!['action','remote','apply','wrangler'].includes(key))||options.apply)throw Error('List is read-only; update options are not accepted.');
 }else{
  if(!/^\d+$/.test(options.revision||''))throw Error('An exact expected revision is required.');
  options.revision=Number(options.revision);options.nextAction=options['next-action'];delete options['next-action'];
  if(options['next-update']!==undefined&&!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(options['next-update']))throw Error('Use an ISO update date/time with an explicit timezone.');
  options.nextUpdateAt=options['next-update']===undefined?null:Date.parse(options['next-update']);delete options['next-update'];
  updateQuery(options);
 }
 return options;
}

export function main(args=process.argv.slice(2),{query=executeQuery,clock=Date.now,write=value=>process.stdout.write(JSON.stringify(value)+'\n')}={}){
 const options=parseArguments(args),environment=options.remote?'Existing hosted D1':'Local development D1';
 if(options.action==='list'){const responses=query(listQuery(),options);write({environment,handoffs:responses[0].results});return;}
 const sql=updateQuery(options,clock());
 // Even local mutation needs an explicit apply. A dry run never invokes database access.
 if(!options.apply){write({environment,prepared:true,applied:false,reference:options.reference,expectedRevision:options.revision,status:options.status});return;}
 let rows;try{rows=query(sql,options)[0].results;}catch{throw Error('The update outcome is uncertain. Refresh the handoff list and inspect the exact reference before any retry.');}
 if(rows.length!==1||rows[0].reference!==options.reference||rows[0].revision!==options.revision+1||rows[0].status!==options.status)throw Error('No update confirmed. The reference, revision or status may be stale, unchanged or busy. Refresh the handoff list.');
 write({environment,applied:true,handoff:rows[0]});
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))try{main();}catch(error){process.stderr.write(error.message+'\n');process.exitCode=1;}
