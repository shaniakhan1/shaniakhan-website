// No dependencies. No credentials, request bodies, or provider responses are logged.
export const ORIGINS = new Set(['https://shaniakhan.com']);
export const MAX_BYTES = 24000;
export const SCHEMAS = {
  consult: {name:120,email:254,brand:250,focus:100,why:6000,timing:250},
  'mastermind-application': {name:120,email:254,q1:4000,q2:4000,q3:4000,q4:4000,investment:120},
  'mastermind-waitlist': {name:120,email:254},
};
const REQUIRED = {consult:['name','email','focus','why'],'mastermind-application':['name','email','q1','q2','q3','q4','investment'],'mastermind-waitlist':['name','email']};
const SUBJECTS = {consult:'New advisory inquiry','mastermind-application':'New mastermind application','mastermind-waitlist':'New mastermind waitlist request'};
const LABELS = {name:'Name',email:'Email',brand:'Company / brand',focus:'Support requested',why:'Current situation and desired change',timing:'Timing',q1:'What are you building and where does it stall?',q2:'Decision sitting on for 30+ days',q3:'Business if you had confidence',q4:'Why now?',investment:'Investment readiness'};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class InputError extends Error {}
function object(x) {return x && typeof x === 'object' && !Array.isArray(x);}
export function normalize(body) {
  if (!object(body) || Object.keys(body).some(k=>!['id','type','fields','website'].includes(k)) || !UUID.test(body.id ?? '') || !Object.hasOwn(SCHEMAS,body.type) || !object(body.fields)) throw new InputError('invalid');
  if (body.website !== undefined && body.website !== '') throw new InputError('invalid');
  const schema=SCHEMAS[body.type], fields={};
  if(Object.keys(body.fields).some(k=>!Object.hasOwn(schema,k))) throw new InputError('invalid');
  for(const [key,max] of Object.entries(schema)) {
    const value=body.fields[key] ?? '';
    if(typeof value !== 'string' || value.length>max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) throw new InputError('invalid');
    fields[key]=value.trim().replace(/\r\n?/g,'\n');
  }
  if(REQUIRED[body.type].some(k=>!fields[k])) throw new InputError('invalid');
  // Deliberately conservative ASCII mailbox. Reject header injection and multiple recipients.
  fields.email=fields.email.toLowerCase();
  if(!/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(fields.email) || fields.email.includes('..') || fields.email.startsWith('.') || fields.email.split('@')[0].endsWith('.')) throw new InputError('invalid');
  return {id:body.id.toLowerCase(),type:body.type,fields};
}
export function makeMail(data) {
  return {from:'Shania Khan Website <shania@frequencyplanner.com>',to:['shania@flpmarketinggroup.com'],reply_to:data.fields.email,subject:SUBJECTS[data.type],text:`${SUBJECTS[data.type]}\nReference: ${data.id}\n\n`+Object.entries(data.fields).map(([k,v])=>`${LABELS[k]}:\n${v || '(not provided)'}`).join('\n\n')};
}
export async function digest(value) {return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function emailIdentity(email, secret) {
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('website-inquiry/email/v1:'+email)))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function readBody(req) {
  if(Number(req.headers.get('content-length') || 0)>MAX_BYTES) throw new InputError('large');
  if(!req.body) throw new InputError('invalid');
  const reader=req.body.getReader();let length=0;const chunks=[];
  let timedOut=false;const timer=setTimeout(()=>{timedOut=true;reader.cancel().catch(()=>{});},5000);
  try {for(;;){const {value,done}=await reader.read();if(timedOut)throw new InputError('invalid');if(done)break;length+=value.byteLength;if(length>MAX_BYTES){await reader.cancel();throw new InputError('large');}chunks.push(value);}}
  finally {clearTimeout(timer);reader.releaseLock();}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new InputError('invalid');}
}
export function handler(deps) {
  return async req => {
    const origin=req.headers.get('origin');const allowed=ORIGINS.has(origin);
    const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(allowed?{'Access-Control-Allow-Origin':origin}: {})};
    const reply=(status,code,retryable=false)=>new Response(JSON.stringify({success:false,code,retryable}),{status,headers:{...headers,...(retryable?{'Retry-After':'30'}:{})}});
    if(!allowed)return reply(403,'origin_not_allowed');
    if(req.method==='OPTIONS') return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Max-Age':'600'}});
    if(req.method!=='POST')return reply(405,'method_not_allowed');
    // Gateway verify_jwt remains true. Additionally allow only the existing public anon token.
    // This is NOT anti-abuse protection; the transactional quotas below provide that.
    if(!deps.anon || req.headers.get('authorization')!==`Bearer ${deps.anon}`)return reply(401,'unauthorized');
    if(req.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return reply(415,'json_required');
    if(!deps.ready)return reply(503,'unavailable',true);
    let data;
    try{data=normalize(await readBody(req));}catch(err){return reply(err instanceof InputError && err.message==='large'?413:400,'invalid_submission');}
    try {
      const payloadHash=await digest(JSON.stringify({type:data.type,fields:data.fields}));
      const identity=await emailIdentity(data.fields.email,deps.serviceKey);
      const lease=crypto.randomUUID();
      const claim=await deps.rpc('website_inquiry_claim',{p_id:data.id,p_hash:payloadHash,p_identity:identity,p_kind:data.type,p_mail:makeMail(data),p_lease:lease});
      if(claim.code==='accepted')return new Response(JSON.stringify({success:true,id:data.id}),{status:200,headers});
      if(claim.code!=='send') {
        const statuses={mismatch:409,duplicate:409,rate_limited:429,in_flight:409,review_required:409};
        return reply(statuses[claim.code]??503,claim.code,['rate_limited','in_flight'].includes(claim.code));
      }
      // Use the original stored JSON, not re-rendered content: stable across code releases.
      const sent=await deps.send(claim.mail,`website-inquiry/${data.id}`);
      if(!sent || typeof sent.id!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sent.id))return reply(503,'delivery_pending',true);
      const saved=await deps.rpc('website_inquiry_finish',{p_id:data.id,p_lease:lease,p_provider_id:sent.id});
      if(!saved.accepted)return reply(503,'delivery_pending',true);
      return new Response(JSON.stringify({success:true,id:data.id}),{status:200,headers});
    } catch {return reply(503,'delivery_pending',true);}
  };
}
