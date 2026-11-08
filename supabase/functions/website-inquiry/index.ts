import { handler } from './core.mjs';
import { request } from './request.mjs';
const url=Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const resend=Deno.env.get('RESEND_API_KEY') ?? '';
// Existing public legacy anon token. Gateway JWT verification remains enabled.
// Use the same verified public token as the website, rather than a runtime alias.
const anon="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51eGt3Z2JndXZwYW9pZ3J6cXFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NDc2ODAsImV4cCI6MjA5MDAyMzY4MH0.HWr4dykudUbTLfVntdLHKfCOJqGuKekOPz4hkYFT3K0";
Deno.serve(handler({
  anon,serviceKey,ready:!!(url&&serviceKey&&resend&&anon),
  rpc:(name:string,args:unknown)=> {
    if(!['website_inquiry_claim','website_inquiry_finish'].includes(name))throw new Error('Invalid operation');
    return request(`${url}/rest/v1/rpc/${name}`,args,{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`},3000);
  },
  send:(mail:unknown,key:string)=>request('https://api.resend.com/emails',mail,{Authorization:`Bearer ${resend}`,'Idempotency-Key':key},8000),
}));
