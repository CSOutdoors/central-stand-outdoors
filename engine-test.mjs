import assert from 'node:assert/strict';
import worker from '../engine/worker.js';
const origin='https://example.github.io';
const kvStore=new Map();
const env={OPENAI_API_KEY:'test-secret',APP_ORIGIN:origin,CSO_RATE_LIMIT:{async get(k){return kvStore.get(k)||null},async put(k,v){kvStore.set(k,v)}},IMAGE_MODEL:'gpt-image-2.6-sunburst'};
const oldFetch=globalThis.fetch;
let upstreamCalls=0;
globalThis.fetch=async (url,opts)=>{upstreamCalls++;assert.equal(url,'https://api.openai.com/v1/images/edits');assert.equal(opts.headers.Authorization,'Bearer test-secret');const body=opts.body;assert.equal(body.get('model'),'gpt-image-2.6-sunburst');assert.equal(body.getAll('image[]').length,2);return new Response(JSON.stringify({data:[{b64_json:'ZmFrZS1wbmc='}]}),{status:200,headers:{'Content-Type':'application/json'}})};
try {
 let r=await worker.fetch(new Request('https://worker.test/',{method:'POST',headers:{Origin:'https://evil.test'}}),env);assert.equal(r.status,403);
 r=await worker.fetch(new Request('https://worker.test/',{method:'GET',headers:{Origin:origin}}),env);assert.equal(r.status,405);
 const noKv={...env,CSO_RATE_LIMIT:undefined};r=await worker.fetch(new Request('https://worker.test/',{method:'POST',headers:{Origin:origin}}),noKv);assert.equal(r.status,503);
 const form=new FormData();form.append('image',new File([new Uint8Array([1,2,3])],'buck.jpg',{type:'image/jpeg'}));form.append('references',new File([new Uint8Array([4,5,6])],'angle.jpg',{type:'image/jpeg'}));form.append('prompt','Photorealistic digital shoulder mount preserving reference rack.');
 r=await worker.fetch(new Request('https://worker.test/',{method:'POST',headers:{Origin:origin},body:form}),env);assert.equal(r.status,200);const data=await r.json();assert.equal(data.image,'ZmFrZS1wbmc=');assert.equal(data.mimeType,'image/png');assert.equal(upstreamCalls,1);
 console.log(JSON.stringify({passed:['Rejects unauthorized browser origins','Rejects unsupported methods','Fails closed without rate-limit storage','Sends primary and secondary reference images to image edit API','Returns generated PNG without exposing provider key'],total:5},null,2));
} finally {globalThis.fetch=oldFetch;}
