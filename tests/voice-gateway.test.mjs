import test from 'node:test';
import assert from 'node:assert/strict';
import {handleVoice} from '../api/voice/transcribe.js';

const env={
 AWAAZ_VOICE_ENABLED:'true',
 GNANI_API_KEY:'test-only-secret-length-12345',
 DATABASE_URL:'postgresql://not-used-in-mocked-tests',
};
const quota=(clientRemaining=4,globalRemaining=40)=>({
 clientRemaining,globalRemaining,clientLimit:4,globalLimit:40,resetAt:'2026-11-08T00:00:00.000Z'
});
function response(){
 return {headers:{},code:200,body:null,
  setHeader(key,value){this.headers[key.toLowerCase()]=value;return this},
  status(code){this.code=code;return this},
  json(body){this.body=body;return this}};
}
function validWav(){
 const count=16000,bytes=Buffer.alloc(44+count*2);
 bytes.write('RIFF',0,'ascii');bytes.writeUInt32LE(bytes.length-8,4);
 bytes.write('WAVEfmt ',8,'ascii');bytes.writeUInt32LE(16,16);
 bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);
 bytes.writeUInt32LE(16000,24);bytes.writeUInt32LE(32000,28);
 bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);
 bytes.write('data',36,'ascii');bytes.writeUInt32LE(count*2,40);
 return bytes.toString('base64');
}
function request(method='GET',overrides={}){
 return {method,headers:{origin:'https://awaazgraph.vercel.app',
  'sec-fetch-site':'same-origin','content-type':'application/json',
  'x-vercel-forwarded-for':'192.0.2.1'},...overrides};
}
const audio=validWav(),validBody={audio,language:'en-IN',consent:true};
const success={transcript:'The drain is blocked.',language:'en-IN',
 model:'prisma-v2.5',provider:'gnani'};
const opts={env,getQuota:async()=>quota(),reserve:async()=>true,
 transcribe:async()=>success};

test('GET reports bounded allowance',async()=>{
 const res=response();await handleVoice(request(),res,opts);
 assert.equal(res.code,200);assert.equal(res.body.available,true);
 assert.equal(res.body.quota.clientLimit,4);
 assert.equal(res.body.quota.globalLimit,40);
 assert.equal(res.body.quota.clientRemaining,4);
 assert.equal(res.headers['cache-control'],'no-store');
 assert.ok(!JSON.stringify(res.body).includes(env.GNANI_API_KEY));
});
test('GET reports exhausted client allowance without leaking IP',async()=>{
 const res=response();
 await handleVoice(request(),res,{...opts,getQuota:async()=>quota(0,12)});
 assert.equal(res.body.available,false);
 assert.equal(res.body.reason,'quota-client');
 assert.ok(!JSON.stringify(res.body).includes('192.0.2.1'));
});
test('GET reports site-wide exhausted allowance',async()=>{
 const res=response();
 await handleVoice(request(),res,{...opts,getQuota:async()=>quota(3,0)});
 assert.equal(res.body.available,false);assert.equal(res.body.reason,'quota-global');
});
test('GET fails closed if quota DB unavailable',async()=>{
 const res=response();
 await handleVoice(request(),res,{...opts,getQuota:async()=>{throw Error('DB timeout')}});
 assert.equal(res.body.available,false);assert.equal(res.body.reason,'quota-unavailable');
 assert.ok(!JSON.stringify(res.body).includes('DB timeout'));
});
test('GET disabled server does not touch quota DB',async()=>{
 let reads=0;const res=response();
 await handleVoice(request(),res,{...opts,env:{...env,AWAAZ_VOICE_ENABLED:'false'},
 getQuota:async()=>{reads++;return quota()}});
 assert.equal(res.body.available,false);assert.equal(reads,0);
});
test('valid consented PCM WAV is sent to Gnani adapter exactly once',async()=>{
 const res=response();let reserved=0,called=0;
 await handleVoice(request('POST',{body:validBody}),res,{
  ...opts,reserve:async()=>{reserved++;return true},
  transcribe:async({language,audio:bytes})=>{
   called++;assert.equal(language,'en-IN');
   assert.equal(bytes.subarray(0,4).toString(),'RIFF');return success}
 });
 assert.equal(res.code,200);assert.equal(res.body.transcript,'The drain is blocked.');
 assert.equal(res.body.reviewRequired,true);assert.equal(reserved,1);assert.equal(called,1);
});
test('invalid consent fails before reservation',async()=>{
 const res=response();let reserved=0;
 await handleVoice(request('POST',{body:{...validBody,consent:false}}),res,{
  ...opts,reserve:async()=>{reserved++;return true}});
 assert.equal(res.code,400);assert.equal(reserved,0);
});
test('cross-site POST fails without reservation',async()=>{
 const res=response();let reserved=0;
 await handleVoice(request('POST',{headers:{origin:'https://another.example','content-type':'application/json'},body:validBody}),res,{
  ...opts,reserve:async()=>{reserved++;return true}});
 assert.equal(res.code,403);assert.equal(reserved,0);
});
test('unsupported language fails without reservation',async()=>{
 const res=response();let reserved=0;
 await handleVoice(request('POST',{body:{...validBody,language:'fr-FR'}}),res,{
  ...opts,reserve:async()=>{reserved++;return true}});
 assert.equal(res.code,400);assert.equal(reserved,0);
});
test('denied client quota returns 429 with Retry-After and reset',async()=>{
 const res=response();let called=0;
 await handleVoice(request('POST',{body:validBody}),res,{
  ...opts,reserve:async()=>false,getQuota:async()=>quota(0,19),
  transcribe:async()=>{called++;return success}});
 assert.equal(res.code,429);assert.equal(res.body.code,'WARDLENS_DAILY_LIMIT');
 assert.equal(res.body.reason,'quota-client');assert.equal(res.body.quota.clientRemaining,0);
 assert.ok(Number(res.headers['retry-after'])>0);
 assert.match(res.body.resetAt,/T00:00:00.000Z$/);
 assert.equal(called,0);
});
test('site-wide cap never calls model',async()=>{
 const res=response();let called=0;
 await handleVoice(request('POST',{body:validBody}),res,{
  ...opts,reserve:async()=>false,getQuota:async()=>quota(2,0),
  transcribe:async()=>{called++;return success}});
 assert.equal(res.code,429);assert.equal(res.body.reason,'quota-global');assert.equal(called,0);
});
test('unknown quota lookup still fails closed',async()=>{
 const res=response();
 await handleVoice(request('POST',{body:validBody}),res,{
  ...opts,reserve:async()=>false,getQuota:async()=>{throw Error('failure')}});
 assert.equal(res.code,429);assert.equal(res.body.code,'WARDLENS_DAILY_LIMIT');
 assert.equal(res.body.quota,null);
});
