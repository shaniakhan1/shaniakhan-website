// Isolated transport/UI-state tests. No network requests or live mail.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('assets/lead-forms.js', 'utf8')
  .replace(/endpoint: '[^']*'/, "endpoint: 'https://local.test/inquiry'")
  .replace(/publicKey: '[^']*'/, "publicKey: 'public-test-key'")
  .replace(/timeoutMs: \d+/, 'timeoutMs: 15');
function setup(fetch, options = {}) {
  class Element {
    constructor() { this.textContent = ''; this.attrs = {}; this.disabled = false; this.style = {}; this.children = []; }
    setAttribute(k,v) { this.attrs[k] = v; }
    addEventListener(k,fn) { this[k] = fn; }
    append(...children) { this.children.push(...children); }
  }
  const link = new Element();
  const button = new Element(); button.textContent = 'Send';
  const form = new Element(); form.id = options.id || 'consult-form'; form.values = {name:'Test Name',email:'test@example.invalid',why:'Preserve this note'};
  form.querySelector = () => link; form.querySelectorAll = () => [button]; form.reportValidity = () => true; form.after = panel => { form.panel = panel; };
  const context = { window: {}, document: { createElement: () => new Element(), querySelectorAll: () => [form], addEventListener() {}, documentElement: {} }, MutationObserver: class { observe() {} }, FormData: class { constructor(f) {return Object.entries(f.values);} }, crypto: require('node:crypto').webcrypto, AbortController, setTimeout, clearTimeout, fetch };
  if (options.noCrypto) context.crypto = {};
  vm.runInNewContext(options.emailOnly ? source.replace("endpoint: 'https://local.test/inquiry'", "endpoint: ''") : source,context);
  return { form,button,link,submit:()=>context.window.LeadForms.submit(form),status:()=>form.panel.children[0].textContent };
}
test('temporary email mode prepares answers without claiming or making a send', async () => {
  let requests = 0;
  const ui = setup(async () => { requests++; }, {emailOnly:true});
  assert.equal(ui.button.textContent, 'Continue by email');
  await ui.submit();
  assert.equal(requests, 0);
  assert.match(ui.status(), /Nothing has been sent yet/);
  assert.match(ui.link.href, /^mailto:shania@flpmarketinggroup\.com\?/);
  assert.match(decodeURIComponent(ui.link.href), /Preserve this note/);
  assert.equal(ui.button.disabled, false);
});
function response(body,ok=true) {return {ok,json:async()=>body};}
for (const [name,fetch] of [
  ['HTTP failure',async()=>response({},false)],
  ['network failure',async()=>{throw Error('offline');}],
  ['JSON rejection',async()=>response({success:false})],
  ['HTML/non-JSON response',async()=>({ok:true,json:async()=>{throw Error('invalid JSON');}})],
  ['wrong receipt id',async()=>response({success:true,id:'wrong'})],
  ['timeout',()=>new Promise(()=>{})],
  ['response body timeout',async()=>({ok:true,json:()=>new Promise(()=>{})})]
]) test(name+' restores button and preserves answers',async()=>{
  const s=setup(fetch); await s.submit(); assert.match(s.status(),/could not confirm/); assert.equal(s.button.disabled,false); assert.equal(s.button.textContent,'Send'); assert.equal(s.form.values.why,'Preserve this note'); assert.equal(s.form.attrs['aria-busy'],'false');
});
test('explicit success; repeated submits do not duplicate',async()=>{
  let calls=0; const s=setup(async(_,options)=>{calls++;return response({success:true,id:JSON.parse(options.body).id});});
  await Promise.all([s.submit(),s.submit()]); await s.submit(); assert.equal(calls,1); assert.match(s.status(),/has been received/); assert.equal(s.button.textContent,'Submitted'); assert.equal(s.button.disabled,true);
});
test('uncertain retry reuses id; edited fields get new id',async()=>{
  const ids=[];const s=setup(async(_,options)=>{ids.push(JSON.parse(options.body).id);throw Error('offline');});
  await s.submit();await s.submit();s.form.values.why='Changed note';await s.submit();assert.equal(ids[0],ids[1]);assert.notEqual(ids[1],ids[2]);
});
test('fallback includes current answers safely encoded',()=>{
 const s=setup(async()=>{});s.form.values.why='A & B <script>'; const link=s.link;link.click();assert.match(decodeURIComponent(link.href),/why: A & B <script>/);assert.ok(link.href.startsWith('mailto:shania@flpmarketinggroup.com?'));
});

test('UUID unavailable restores the form instead of getting stuck',async()=>{
 const s=setup(async()=>{throw Error('must not fetch');},{noCrypto:true}); await s.submit();assert.match(s.status(),/could not confirm/);assert.equal(s.button.disabled,false);assert.equal(s.button.textContent,'Send');
});
for (const [id,type] of [['consult-form','consult'],['apply-form','mastermind-application'],['waitlist-form','mastermind-waitlist']]) test(id+' sends expected contract',async()=>{
 let sent;const s=setup(async(_,o)=>{sent=JSON.parse(o.body);return response({success:true,id:sent.id});},{id});await s.submit();assert.equal(sent.type,type);assert.equal(sent.fields.email,'test@example.invalid');assert.equal(sent.website,'');assert.ok(sent.id);assert.match(s.status(),/has been received/);
});
test('invalid form never sends',async()=>{
 let calls=0;const s=setup(async()=>{calls++;});s.form.reportValidity=()=>false;await s.submit();assert.equal(calls,0);assert.equal(s.button.disabled,false);
});
test('static forms keep visible email links and block native data submission',()=>{
 for(const path of ['consult/index.html','mastermind/apply/index.html']) {
  const html=fs.readFileSync(path,'utf8');assert.match(html,/data-lead-fallback/);assert.match(html,/onsubmit="return false"/);assert.doesNotMatch(html,/formsubmit.co/);assert.doesNotMatch(html,/_autoresponse|name="_next"/);
 }
 const bundle=fs.readFileSync('mastermind/assets/index-CkYT2Oaa.js','utf8');assert.match(bundle,/data-lead-fallback/);assert.doesNotMatch(bundle,/formsubmit.co/);
});
