import assert from 'node:assert/strict';
import worker from '../engine/worker-free.js';
const origin='https://example.github.io';
const store=new Map();
let calls=0;
const env={APP_ORIGIN:origin,CSO_RATE_LIMIT:{async get(k){return store.get(k)||null},async put(k,v){store.set(k,v)}},AI:{async run(model,args){calls++;assert.equal(model,'@cf/black-forest-labs/flux-2-klein-4b');assert.ok(args.multipart.body);assert.match(args.multipart.contentType,/multipart\/form-data/);return {image:'ZmFrZS1wbmc='};}}};
const oldNow=Date.now;
try {
 let r=await worker.fetch(new Request('https://worker.test/',{method:'POST',headers:{Origin:'https://evil.test'}}),env);assert.equal(r.status,403);
 r=await worker.fetch(new Request('https://worker.test/',{method:'GET',headers:{Origin:origin}}),env);assert.equal(r.status,405);
 r=await worker.fetch(new Request('https://worker.test/',{method:'POST',headers:{Origin:origin}}),{...env,CSO_RATE_LIMIT:undefined});assert.equal(r.status,503);
 const form=new FormData();form.append('image',new File([new Uint8Array([1,2,3])],'buck.jpg',{type:'image/jpeg'}));form.append('references',new File([new Uint8Array([4,5,6])],'angle.jpg',{type:'image/jpeg'}));form.append('prompt','Photorealistic digital shoulder mount preserving reference rack.');
 r=await worker.fetch(new Request('https://worker.test/',{method:'POST',headers:{Origin:origin},body:form}),env);assert.equal(r.status,200);const data=await r.json();assert.equal(data.image,'ZmFrZS1wbmc=');assert.equal(data.provider,'cloudflare-workers-ai-free');assert.equal(calls,1);
 console.log(JSON.stringify({passed:['Rejects unauthorized origins','Rejects unsupported methods','Fails closed without KV rate limiting','Calls FLUX.2 Klein through Workers AI multipart binding','Returns generated PNG and free-provider metadata'],total:5},null,2));
} finally {Date.now=oldNow;}
