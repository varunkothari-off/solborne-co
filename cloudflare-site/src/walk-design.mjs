import {first,run} from './db.mjs';

const textLimits={feel:500,colours:500,avoid:500,notes:1500};
const allowed=new Set([...Object.keys(textLimits),'references','motion','sketch']);
export function validateDesign(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.has(k)))throw Error('Invalid design');
 const result={};for(const [key,max] of Object.entries(textLimits)){const text=value[key]??'';if(typeof text!=='string'||text.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text))throw Error('Invalid design text');result[key]=text.trim();}
 result.motion=value.motion??'undecided';if(!['undecided','subtle','expressive','minimal'].includes(result.motion))throw Error('Invalid motion');
 const refs=value.references??[];if(!Array.isArray(refs)||refs.length>5)throw Error('Invalid references');result.references=refs.map(text=>{if(typeof text!=='string'||text.length>500)throw Error('Invalid reference');const url=new URL(text);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('Invalid reference');return url.href;});
 const strokes=value.sketch??[];if(!Array.isArray(strokes)||strokes.length>80)throw Error('Invalid sketch');let count=0;
 result.sketch=strokes.map(stroke=>{if(!Array.isArray(stroke)||!stroke.length)throw Error('Invalid stroke');count+=stroke.length;if(count>2000)throw Error('Sketch too large');return stroke.map(point=>{if(!point||typeof point!=='object'||Array.isArray(point)||Object.keys(point).some(k=>!['x','y'].includes(k))||!Number.isFinite(point.x)||!Number.isFinite(point.y)||point.x<0||point.x>1||point.y<0||point.y>1)throw Error('Invalid point');return {x:point.x,y:point.y};});});return result;
}
// Only owner-supplied text reaches the interviewer; strokes stay in the private brief.
export function designText(state){const {sketch,...text}=state.designPreferences||{};return text;}
export async function saveDesignPreferences(env,registration,input,now){
 if(!Number.isSafeInteger(input.revision)||input.revision<0)return {status:422,body:{ok:false,error:'Refresh your Walk before saving.'}};
 let designPreferences;try{designPreferences=validateDesign(input.designPreferences);}catch{return {status:422,body:{ok:false,error:'Check your design notes, links and sketch. Use up to five website links and a smaller sketch.'}};}
 await run(env,'INSERT OR IGNORE INTO solborne_ai_walks(registration_id,state_json,created_at,updated_at) VALUES(?,?,?,?)',[registration,JSON.stringify({messages:[],facts:{},businessBrief:{},ready:false}),now,now]);
 const row=await first(env,'SELECT * FROM solborne_ai_walks WHERE registration_id=?',[registration]),state=JSON.parse(row.state_json);
 if(state.submission||row.revision!==input.revision||row.busy_until>now)return {status:409,body:{ok:false,error:state.submission?'Your brief is already with our team. Email us to add a design note.':'Your Walk changed or is saving. Refresh before trying again.'}};
 const next={...state,designPreferences,review:null};
 const saved=await run(env,'UPDATE solborne_ai_walks SET state_json=?,revision=revision+1,updated_at=? WHERE registration_id=? AND revision=? AND busy_until<=?',[JSON.stringify(next),now,registration,input.revision,now]);
 if(!(saved.meta?.changes>=1))return {status:409,body:{ok:false,error:'Your Walk changed. Refresh before trying again.'}};
 return {status:200,body:{ok:true,state:next,revision:input.revision+1}};
}
