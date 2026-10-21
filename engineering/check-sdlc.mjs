import {existsSync, readFileSync, readdirSync, realpathSync, statSync} from 'node:fs';
import {dirname, isAbsolute, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Artifact consistency gate only: it cannot establish test chronology, review independence,
// licence compatibility, implementation correctness or the truth of a recorded result.
export function checkSDLC(root){
  const errors=[],checkout=realpathSync(root);
  const text=value=>typeof value==='string'&&value.trim().length>0;
  const inside=path=>{const rel=relative(checkout,path);return rel!==''&&!rel.startsWith('..')&&!isAbsolute(rel);};
  function file(path,label){
    if(!text(path)||isAbsolute(path)||/^[A-Za-z]:/.test(path)||path.split(/[\\/]/).includes('..')){
      errors.push(`${label}: use a repository-relative file path`);return null;
    }
    const target=resolve(checkout,path);
    if(!inside(target)||!existsSync(target)||!statSync(target).isFile()){
      errors.push(`${label}: missing file ${path}`);return null;
    }
    if(!inside(realpathSync(target))){errors.push(`${label}: file must stay repository-relative`);return null;}
    const content=readFileSync(target,'utf8');
    if(!content.trim()){errors.push(`${label}: empty file ${path}`);return null;}
    return content;
  }
  function json(path,label){const raw=file(path,label);if(raw===null)return null;try{return JSON.parse(raw);}catch{errors.push(`${label}: invalid JSON in ${path}`);return null;}}
  const specs=resolve(checkout,'specs');
  const features=existsSync(specs)?readdirSync(specs,{withFileTypes:true}).filter(entry=>entry.isDirectory()&&existsSync(resolve(specs,entry.name,'spec.md'))).map(entry=>entry.name):[];
  if(!features.length)errors.push('No feature specifications found under specs/');
  for(const feature of features){
    const base=`specs/${feature}`,prefix=`${feature}: `;
    const evidence=json(`${base}/verification.json`,prefix+'verification');
    if(!evidence||typeof evidence!=='object'||Array.isArray(evidence)){
      errors.push(prefix+'verification must be a JSON object');continue;
    }
    if(evidence.feature!==feature)errors.push(prefix+'feature identifier must match its directory');
    if(evidence.spec!==`${base}/spec.md`)errors.push(prefix+'spec must identify this feature specification');
    const spec=file(evidence.spec,prefix+'spec');
    file(evidence.plan,prefix+'plan');file(evidence.tasks,prefix+'tasks');
    const criteria=new Set(spec?.match(/\bAC-\d{2,}\b/g)||[]);
    if(!criteria.size)errors.push(prefix+'spec has no numbered acceptance criteria');
    const mappings=Array.isArray(evidence.acceptance)?evidence.acceptance:[];
    const seen=new Set();
    for(const mapping of mappings){
      if(!mapping||!criteria.has(mapping.id))errors.push(prefix+`unknown acceptance mapping ${mapping?.id}`);
      if(seen.has(mapping?.id))errors.push(prefix+`duplicate acceptance mapping ${mapping?.id}`);
      seen.add(mapping?.id);
      if(!Array.isArray(mapping?.tests)||!mapping.tests.length)errors.push(prefix+`${mapping?.id} needs mapped test files`);
      else for(const path of mapping.tests)file(path,prefix+`${mapping.id} test`);
    }
    for(const id of criteria)if(!seen.has(id))errors.push(prefix+`missing acceptance mapping ${id}`);
    const red=evidence.tdd?.red,green=evidence.tdd?.green;
    if(red?.result!=='failed')errors.push(prefix+'red evidence must report failed');
    if(!/^[a-f0-9]{7,64}$/.test(red?.commit||''))errors.push(prefix+'red evidence needs a commit hash');
    if(!text(red?.command))errors.push(prefix+'red evidence needs a command');
    if(!text(red?.reason))errors.push(prefix+'red evidence needs the intended failure reason');
    if(green?.result!=='passed')errors.push(prefix+'green evidence must report passed');
    if(!text(green?.command))errors.push(prefix+'green evidence needs a command');
    if(green?.commit){
      if(!/^[a-f0-9]{7,64}$/.test(green.commit))errors.push(prefix+'green commit must be a commit hash');
      if(green.commit===red?.commit)errors.push(prefix+'red and green commit snapshots must be distinct');
    }
    if(evidence.review?.status!=='passed')errors.push(prefix+'review must report passed');
    file(evidence.review?.report,prefix+'review report');
    const reuse=json(evidence.reuse?.manifest,prefix+'reuse manifest');
    const parts=Array.isArray(reuse)?reuse:reuse?.components||reuse?.sources;
    if(!Array.isArray(parts)||!parts.length)errors.push(prefix+'reuse manifest needs non-empty source entries');
    else for(const [index,part] of parts.entries()){
      const label=prefix+`reuse entry ${index+1}`;
      const source=part?.source||part?.sourceUrl||part?.url;
      try{const url=new URL(source);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error();}
      catch{errors.push(label+' needs an http(s) source URL');}
      if(!text(part?.version||part?.commit))errors.push(label+' needs a pinned version or commit');
      const licence=part?.license||part?.licence;
      if(!text(licence)||/^(?:unknown|pending|tbd)$/i.test(licence.trim()))errors.push(label+' needs a known licence');
      if(!text(part?.usage||part?.parts))errors.push(label+' needs selected parts or usage');
      if(part?.licenseFile)file(part.licenseFile,label+' licence notice');
    }
    if(!Array.isArray(evidence.limitations)||evidence.limitations.some(value=>!text(value)))errors.push(prefix+'limitations must be an array of non-empty strings');
  }
  return {features:features.length,errors};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const args=process.argv.slice(2);
    if(args.length&&!(args.length===2&&args[0]==='--root'))throw Error('Usage: node engineering/check-sdlc.mjs [--root checkout]');
    const result=checkSDLC(args[1]||resolve(dirname(fileURLToPath(import.meta.url)),'..'));
    if(result.errors.length){console.error('SDLC evidence gate failed:\n'+result.errors.map(error=>'- '+error).join('\n'));process.exitCode=1;}
    else console.log(`SDLC evidence gate passed: ${result.features} feature(s). Artifact consistency only; no claim of chronology or correctness.`);
  }catch(error){console.error('SDLC evidence gate failed: '+error.message);process.exitCode=1;}
}
