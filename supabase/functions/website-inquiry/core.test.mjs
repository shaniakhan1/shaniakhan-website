import test from 'node:test';
import assert from 'node:assert/strict';
import {handler,normalize,makeMail,digest,emailIdentity} from './core.mjs';
const id='aabbccdd-1122-4334-8556-778899aabbcc';
const provider='01a1b19b-3202-761c-aa8d-4626d84abb56';
const input=()=>({id,type:'mastermind-waitlist',fields:{name:'Test Person',email:'TEST@example.com'},website:''});
const req=(body=input(),headers={},method='POST')=>new Request('https://example.test',{method,headers:{origin:'https://shaniakhan.com',authorization:'Bearer public','Content-Type':'application/json',...headers},...(method==='POST'?{body:JSON.stringify(body)}:{})});
const run=(overrides={})=>handler({anon:'public',serviceKey:'test-only-key',ready:true,rpc:async(name,args)=>name.endsWith('claim')?{code:'send',mail:args.p_mail}:{accepted:true},send:async()=>({id:provider}),...overrides});
test('canonical field ordering and normalization',()=>assert.deepEqual(normalize(input()).fields,{name:'Test Person',email:'test@example.com'}));
test('all three forms accepted',()=>{normalize({id,type:'consult',fields:{name:'Test',email:'a@b.co',focus:'Help',why:'Advice'}});normalize({id,type:'mastermind-application',fields:{name:'Test',email:'a@b.co',q1:'a',q2:'b',q3:'c',q4:'d',investment:'Ready'}});});
test('mail recipient/sender fixed, no html, validated reply-to',()=>{const mail=makeMail(normalize(input()));assert.deepEqual(mail.to,['shania@flpmarketinggroup.com']);assert.equal(mail.reply_to,'test@example.com');assert.equal(mail.html,undefined);});
test('reject injected fields, type, id, honeypot, missing/oversized fields',()=>{for(const b of [{...input(),type:'__proto__'},{...input(),id:'x'},{...input(),to:'other@example.com'},{...input(),website:'bot'},{...input(),fields:{name:'',email:'x@y.co'}},{...input(),fields:{name:'x'.repeat(121),email:'x@y.co'}},{...input(),fields:{name:'X',email:'x@y.co\r\nBcc:a@b.co'}},{...input(),fields:{...input().fields,other:'x'}}])assert.throws(()=>normalize(b));});
test('origin, auth, method and media type fail closed',async()=>{for(const [request,status] of [[req(input(),{origin:'https://attacker.test'}),403],[req(input(),{authorization:'Bearer wrong'}),401],[req(input(),{},'GET'),405],[req(input(),{'Content-Type':'text/plain'}),415]]) assert.equal((await run()(request)).status,status);});
test('preflight only allowed origin',async()=>{assert.equal((await run()(req(undefined,{},'OPTIONS'))).status,204);});
test('body size enforced and not persisted',async()=>{let called=false;const res=await run({rpc:async()=>{called=true;}})(req({...input(),website:'x'.repeat(25000)}));assert.equal(res.status,413);assert.equal(called,false);});
test('no send without durable claim',async()=>{let sent=false;const res=await run({rpc:async()=>{throw Error();},send:async()=>{sent=true;}})(req());assert.equal(res.status,503);assert.equal(sent,false);});
test('success requires Resend ID plus persisted acceptance',async()=>{assert.deepEqual(await (await run()(req())).json(),{success:true,id});for(const result of [{},null,{id:'not-an-id'}])assert.equal((await run({send:async()=>result})(req())).status,503);assert.equal((await run({rpc:async(name,args)=>name.endsWith('claim')?{code:'send',mail:args.p_mail}:{accepted:false}})(req())).status,503);});
test('provider and persistence uncertain failures stay retryable',async()=>{for(const override of [{send:async()=>{throw Error('timeout');}},{rpc:async(name,args)=>{if(name.endsWith('finish'))throw Error();return {code:'send',mail:args.p_mail};}}]){const res=await run(override)(req());assert.equal(res.status,503);assert.equal((await res.json()).retryable,true);}});
test('existing accepted entry does not send twice',async()=>{let sent=false;const res=await run({rpc:async()=>({code:'accepted'}),send:async()=>{sent=true;}})(req());assert.equal(res.status,200);assert.equal(sent,false);});
test('rate limits, duplicates, conflicts and aged unknown outcomes are not success',async()=>{for(const code of ['rate_limited','duplicate','mismatch','in_flight','review_required']){const res=await run({rpc:async()=>({code})})(req());assert.notEqual(res.status,200);assert.equal((await res.json()).success,false);}});
test('Resend uses stable key and stored original mail, not regenerated payload',async()=>{let seen;const original={text:'ORIGINAL'};await run({rpc:async(name)=>name.endsWith('claim')?{code:'send',mail:original}:{accepted:true},send:async(mail,key)=>{seen={mail,key};return {id:provider};}})(req());assert.deepEqual(seen,{mail:original,key:`website-inquiry/${id}`});});
test('identities are HMAC with namespace, not raw email or unkeyed hash',async()=>{const a=await emailIdentity('a@b.co','one'),b=await emailIdentity('a@b.co','two');assert.equal(a.length,64);assert.notEqual(a,b);assert.notEqual(a,await digest('a@b.co'));});
test('provider HTTP timeout includes stalled JSON response body',async()=>{
  const {createServer}=await import('node:http');const {request}=await import('./request.mjs');
  const server=createServer((req,res)=>{req.resume();res.writeHead(200,{'Content-Type':'application/json'});res.write('{"id":');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {await assert.rejects(request(`http://127.0.0.1:${server.address().port}`,{}, {},100),err=>err.name==='AbortError');}
  finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
