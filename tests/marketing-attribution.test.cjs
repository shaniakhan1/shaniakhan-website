// Run with: node --test tests/marketing-attribution.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../assets/marketing-attribution.js'),'utf8');
function boot(host, privacy={}) {
 const events=[]; let config,click;
 const loc=new URL('https://'+host+'/?email=private%40example.invalid&token=secret&utm_source=instagram&utm_campaign=reset#private');
 const ctx={URL,URLSearchParams,navigator:privacy,location:loc,document:{referrer:'https://example.invalid/path?email=private#secret',addEventListener:(_,fn)=>click=fn},window:{posthog:{init:(_,c)=>config=c,capture:(event,p)=>events.push({event,...p})}}};
 vm.runInNewContext(source,ctx);
 return {events,get config(){return config;},click(href){const n=events.length;const a={href:new URL(href,loc).href,getAttribute:()=>href};click({target:{closest:()=>a}});return events.length>n?events.at(-1):null;}};
}
for(const host of ['soft60.app','www.soft60.app','shaniakhan.com','www.shaniakhan.com']){
 test(host+' excludes internal paths, hashes, www aliases, malformed and unrelated URLs',()=>{
 const b=boot(host); for(const href of ['/privacy/','/books/','#screenshots','#start','https://'+host.replace(/^www\./,'')+'/','https://www.'+host.replace(/^www\./,'')+'/','https://example.invalid','mailto:test@example.invalid','javascript:alert(1)'])assert.equal(b.click(href),null,href);
 });
 test(host+' preserves outbound intent and recognizes newsletter profile',()=>{
 const b=boot(host);
 for(const href of ['https://substack.com/@iamshaniakhan','https://substack.com/@iamshaniakhan/','https://iamshaniakhan.substack.com/'])assert.equal(b.click(href).cta_kind,'newsletter');
 assert.equal(b.click('https://substack.com/@iamshaniakhan-other'),null);
 assert.equal(b.click('https://apps.apple.com/app/id123').cta_kind,'app_download');
 assert.equal(b.click('https://play.google.com/store/apps/details?id=example').cta_kind,'app_download');
 assert.equal(b.click('https://app.frequencyplanner.com/frequency').cta_kind,'assessment');
 if(host.includes('shaniakhan')) assert.equal(b.click('https://soft60.app/').cta_kind,'app_discovery');
 });
 test(host+' removes SDK-added URLs, initial/session attribution and nested arbitrary data',()=>{
 const b=boot(host); const privateUrl='https://'+host+'/?email=private%40example.invalid&token=secret#sensitive';
 const e=b.config.before_send({event:'marketing_landing_viewed',properties:{$session_entry_url:privateUrl,$initial_current_url:privateUrl,$session_entry_referrer:privateUrl,$current_url:privateUrl,$set:{email:'private@example.invalid'},$set_once:{$initial_current_url:privateUrl},email:'private@example.invalid',utm_source:'private@example.invalid',distinct_id:'anonymous-random-id',$session_id:'random-session'}});
 const json=JSON.stringify(e); assert.ok(!/private|secret|sensitive|email|token|set_once/.test(json),json);
 assert.equal(e.properties.$current_url,'https://'+host+'/'); assert.equal(e.properties.utm_source,'instagram'); assert.equal(e.properties.referring_domain,'example.invalid');assert.equal(e.properties.distinct_id,'anonymous-random-id');assert.equal(e.properties.$session_id,'random-session');
 });
}
test('GPC and DNT prevent initialization and capture',()=>{for(const p of [{globalPrivacyControl:true},{doNotTrack:'1'}]){const b=boot('soft60.app',p);assert.equal(b.config,undefined);assert.equal(b.events.length,0);}});
test('only bounded known CTA fields pass the outgoing filter',()=>{const b=boot('soft60.app');const e=b.config.before_send({event:'marketing_cta_clicked',properties:{cta_kind:'app_download',destination:'app_store',untrusted:'secret'}});assert.equal(e.properties.cta_kind,'app_download');assert.equal(e.properties.destination,'app_store');assert.equal(e.properties.untrusted,undefined);});
