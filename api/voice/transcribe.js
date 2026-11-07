import {createHmac} from 'node:crypto';
/** Gnani REST adapters. No demo fallback and no key is ever returned to the browser. */
const STT_URL = 'https://api.vachana.ai/stt/v3';
const TTS_URL = 'https://api.vachana.ai/api/v1/tts/inference';
const ALLOWED_STT_MODELS = new Set(['prisma-v2.5','prisma-v3.0']);
const ALLOWED_LANGUAGES = new Set(['hi-IN','bn-IN','en-IN','indic-auto','hi-IN,en-IN']);
class GnaniError extends Error {
  constructor(message,status=502) { super(message); this.name='GnaniError'; this.status=status; }
}
function keyOrThrow(key) { if(!key) throw new GnaniError('Gnani API key is not configured; no synthetic transcript has been substituted.',503); }
function abortAfter(ms) { return AbortSignal.timeout(ms); }
function mimeType(name) {
  const ext=name?.toLowerCase().split('.').pop();
  return ({wav:'audio/wav',mp3:'audio/mpeg',ogg:'audio/ogg',flac:'audio/flac',aac:'audio/aac',m4a:'audio/mp4'})[ext];
}
function validateAudio(name,buffer) {
  const mime=mimeType(name);
  if(!mime) throw new GnaniError('Unsupported audio extension. Use WAV, MP3, OGG, FLAC, AAC or M4A.',400);
  if(!buffer || buffer.length<64 || buffer.length>6_000_000) throw new GnaniError('Audio must be between 64 bytes and 6 MB.',400);
  const bytes=Buffer.from(buffer);
  const signature=bytes.toString('ascii',0,12);
  if(mime==='audio/ogg' && !signature.startsWith('OggS'))throw new GnaniError('Not an OGG recording.',400);
  if(mime==='audio/flac' && !signature.startsWith('fLaC'))throw new GnaniError('Not a FLAC recording.',400);
  if(mime==='audio/mp4' && !signature.includes('ftyp'))throw new GnaniError('Not an M4A recording.',400);
  if(mime==='audio/mpeg' && !signature.startsWith('ID3') && !(bytes[0]===0xff && (bytes[1]&0xe0)===0xe0))throw new GnaniError('Not an MP3 recording.',400);
  if(mime==='audio/aac' && !(bytes[0]===0xff && (bytes[1]&0xf0)===0xf0))throw new GnaniError('Not an AAC recording.',400);
  if(mime==='audio/wav') {
    if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE') throw new GnaniError('Not a valid RIFF/WAV file.',400);
    const rate=bytes.length>=28?bytes.readUInt32LE(24):0;
    const channels=bytes.length>=24?bytes.readUInt16LE(22):0;
    const byteRate=bytes.length>=32?bytes.readUInt32LE(28):0;
    // MIME and size validation does not guarantee WAV duration due to chunks; client clips at 25 sec.
    if(rate<8000||rate>48000||channels<1||channels>2||byteRate===0) throw new GnaniError('Invalid WAV audio parameters.',400);
    let cursor=12;
    while(cursor+8<=bytes.length) {
      const chunkSize=bytes.readUInt32LE(cursor+4), name=bytes.toString('ascii',cursor,cursor+4);
      if(name==='data' && chunkSize/byteRate>30)throw new GnaniError('WAV recording exceeds Gnani REST 30-second limit.',400);
      if(chunkSize>bytes.length || cursor+8+chunkSize>bytes.length)break;
      cursor+=8+chunkSize+(chunkSize%2);
    }
  }
  return mime;
}
async function safeError(response) {
  if(response.status===401||response.status===403) return new GnaniError('Gnani rejected the configured API key or credits (401/403).',502);
  if(response.status===429) return new GnaniError('Gnani rate-limited the request. Try again later.',503);
  if(response.status===400||response.status===422) return new GnaniError('Gnani rejected the audio or request parameters.',422);
  return new GnaniError(`Gnani API unavailable (${response.status}).`,502);
}
function validateTranscriptionRequest({fileName='clip.wav',audio,language='hi-IN',model='prisma-v2.5'}) {
  const mime=validateAudio(fileName,audio);
  if(!ALLOWED_STT_MODELS.has(model)) throw new GnaniError('Invalid Prisma model.',400);
  if(!ALLOWED_LANGUAGES.has(language)) throw new GnaniError('Unsupported language configuration.',400);
  if(model==='prisma-v2.5' && (language==='indic-auto'||language.includes(','))) throw new GnaniError('Prisma v2.5 requires one language code.',400);
  return mime;
}
async function transcribeGnani({fileName='clip.wav',audio,language='hi-IN',model='prisma-v2.5',key=process.env.GNANI_API_KEY,fetchImpl=fetch}) {
  keyOrThrow(key);
  const mime=validateTranscriptionRequest({fileName,audio,language,model});
  const form=new FormData();
  form.append('audio_file',new Blob([audio],{type:mime}),fileName);
  if(model==='prisma-v3.0') form.append('model',model);
  form.append('language_code',language);
  form.append('format','transcribe');
  let res;
  try { res=await fetchImpl(STT_URL,{method:'POST',headers:{'X-API-Key-ID':key},body:form,signal:abortAfter(45_000)}); }
  catch {throw new GnaniError('Gnani STT connection failed or timed out.',503);}
  if(!res.ok) throw await safeError(res);
  let data;
  try {data=await res.json();}catch {throw new GnaniError('Gnani returned an invalid transcription response.',502);}
  if(data?.success===false||typeof data?.transcript!=='string'||!data.transcript.trim()||data.transcript.length>1000)
    throw new GnaniError('Gnani did not return a bounded, nonempty transcript.',502);
  return {transcript:data.transcript.trim(),model:ALLOWED_STT_MODELS.has(data.model)?data.model:model,
    language:ALLOWED_LANGUAGES.has(data.detected_language_code)?data.detected_language_code:language,
    provider:'gnani',requestId:String(data.request_id??'').slice(0,100),reviewed:false};
}
function validateSynthesisRequest({text,language='hi-IN',voice='Nalini'}) {
  if(!['hi-IN','bn-IN','en-IN'].includes(language)) throw new GnaniError('Unsupported TTS language.',400);
  if(typeof text!=='string'||text.length<2||text.length>300) throw new GnaniError('TTS text must be 2–300 characters.',400);
  if(!/^[a-zA-Z]{2,30}$/.test(voice)) throw new GnaniError('Invalid TTS voice.',400);
}
async function speakGnani({text,language='hi-IN',voice='Nalini',key=process.env.GNANI_API_KEY,fetchImpl=fetch}) {
  keyOrThrow(key);
  validateSynthesisRequest({text,language,voice});
  const payload={text,model:'timbre-v2.5',voice,language,speed:1,
    audio_config:{sample_rate:48000,num_channels:1,sample_width:2,encoding:'linear_pcm',container:'wav'}};
  let res;
  try {res=await fetchImpl(TTS_URL,{method:'POST',headers:{'X-API-Key-ID':key,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:abortAfter(45_000)});}
  catch {throw new GnaniError('Gnani TTS connection failed or timed out.',503);}
  if(!res.ok) throw await safeError(res);
  const type=(res.headers.get('content-type')??'').toLowerCase();
  if(!type.startsWith('audio/')&&!type.includes('octet-stream')) throw new GnaniError('Gnani did not return binary audio.',502);
  let bytes;
  try{bytes=Buffer.from(await res.arrayBuffer());}catch {throw new GnaniError('Gnani TTS returned unreadable audio.',502);}
  if(bytes.length<44||bytes.length>8_000_000)throw new GnaniError('Unexpected size of generated audio.',502);
  if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE')
    throw new GnaniError('Gnani TTS did not return a WAV recording, despite the audio response header.',502);
  return bytes;
}

/** Fail-closed, bounded public voice request checks; no location/transcript ingestion. */


const MAX_ENCODED_BYTES = 1400000;
const MAX_AUDIO_BYTES = 1000000;
const LANGS = Object.freeze(['hi-IN','bn-IN','en-IN']);
const VOICE_ORIGIN = 'https://awaazgraph.vercel.app';
const CLIENT_DAILY_LIMIT = 4;
const GLOBAL_DAILY_LIMIT = 40;
// Four daily attempts per client, forty across the public demo. Both counts
// are enforced atomically in PostgreSQL, including requests with upstream errors.
function nextUtcReset(){
 const now=Date.now(),midnight=Math.floor(now/86400000)*86400000+86400000;
 return {resetAt:new Date(midnight).toISOString(),retryAfterSeconds:Math.max(1,Math.ceil((midnight-now)/1000))};
}
function quotaReason(quota){
 if(!quota)return 'unknown';
 if(quota.globalRemaining<=0)return 'quota-global';
 if(quota.clientRemaining<=0)return 'quota-client';
 return 'ok';
}
function quotaMessage(reason){
 return reason==='quota-global'?'WardLens voice demo is at its site-wide daily limit. Please type instead or try tomorrow.':
  reason==='quota-client'?'Your device has used its daily WardLens voice attempts. Please type instead or try tomorrow.':
  'Voice trial limit reached. Please type your report instead.';
}
function publicVoiceEnabled(env=process.env){
 return env.AWAAZ_VOICE_ENABLED==='true' && !!env.GNANI_API_KEY && !!env.DATABASE_URL;
}
function requestOriginAllowed(headers={},expected=VOICE_ORIGIN){
 const origin=String(headers.origin??'');
 const site=String(headers['sec-fetch-site']??'');
 return origin===expected && (!site||site==='same-origin');
}
function parseVoiceRequest(body){
 const obj=typeof body==='string'?JSON.parse(body):body;
 if(!obj || typeof obj!=='object' || Array.isArray(obj) || Object.keys(obj).some(k=>!['audio','language','consent'].includes(k)))throw new GnaniError('Invalid request fields.',400);
 if(obj.consent!==true)throw new GnaniError('Please consent to sending this audio to Gnani for transcription.',400);
 if(!LANGS.includes(obj.language))throw new GnaniError('Select a supported language.',400);
 const str=obj.audio;
 if(typeof str!=='string'||str.length<100||str.length>MAX_ENCODED_BYTES||str.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(str))throw new GnaniError('Invalid or oversized audio payload.',400);
 const bytes=Buffer.from(str,'base64');
 if(bytes.byteLength>MAX_AUDIO_BYTES || bytes.byteLength < 100)throw new GnaniError('Recording must be smaller than 1 MB.',413);
 validateTranscriptionRequest({fileName:'voice.wav',audio:bytes,language:obj.language,model:'prisma-v2.5'});
 // Parse RIFF chunks and verify a real, playable PCM format and length before spending credits.
 if(bytes.length<44 || bytes.toString('ascii',12,16)!=='fmt ' || bytes.readUInt16LE(20)!==1 || bytes.readUInt16LE(34)!==16)throw new GnaniError('Expected 16-bit PCM WAV audio.',400);
 if(bytes.readUInt32LE(24)!==16000 || bytes.readUInt16LE(22)!==1 || bytes.readUInt32LE(28)!==32000)throw new GnaniError('Expected 16 kHz mono WAV audio.',400);
 let cursor=12, dataLength=0;while(cursor+8<=bytes.length){const name=bytes.toString('ascii',cursor,cursor+4),size=bytes.readUInt32LE(cursor+4);
  if(cursor+8+size>bytes.length)throw new GnaniError('Incomplete WAV audio chunk.',400);
  if(name==='data')dataLength+=size;
  cursor+=8+size+(size%2);
 }
 if(dataLength<8000||dataLength>800000)throw new GnaniError('Recording must be between 0.25 and 25 seconds.',400);
 return {audio:bytes,language:obj.language};
}
function quotaIdentity(headers={},secret){
 if(typeof secret!=='string'||secret.length<12)throw new Error('Quota secret unavailable');
 // Vercel provides a client address, but the service also enforces a global limit if it is spoofed.
 const ip=String(headers['x-vercel-forwarded-for']||headers['x-forwarded-for']||headers['x-real-ip']||'unknown').split(',')[0].trim().slice(0,90);
 return createHmac('sha256',secret).update(ip).digest('hex');
}

/** Server-only Gnani Prisma adapter. Never bundle this file into browser JavaScript. */


export const config={maxDuration:60};
const json=(res,status,data)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');return res.status(status).json(data);};
export async function handleVoice(req,res,{env=process.env,reserve,transcribe=transcribeGnani,getQuota=readQuotaStatus}={}){
 if(req.method==='GET'){
  const meta={provider:'gnani-prisma-v2.5',maxSeconds:25,policy:'Short clips only; consent required. Audio is sent to Gnani, not stored by WardLens. Reports remain in browser.'};
  if(!publicVoiceEnabled(env))return json(res,200,{...meta,available:false,reason:'unconfigured'});
  try{
   const clientKey=quotaIdentity(req.headers||{},env.GNANI_API_KEY);
   const quota=await getQuota(clientKey,env),reason=quotaReason(quota);
   return json(res,200,{...meta,available:reason==='ok',reason,quota});
  }catch{
   // Do not claim that credentials alone establish usable voice availability.
   return json(res,200,{...meta,available:false,reason:'quota-unavailable'});
  }
 }
 if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
 if(!requestOriginAllowed(req.headers,env.AWAAZ_PUBLIC_ORIGIN||'https://awaazgraph.vercel.app'))return json(res,403,{error:'Only same-origin browser requests are accepted.'});
 if(String(req.headers['content-type']||'').split(';')[0]!=='application/json')return json(res,415,{error:'JSON content type required.'});
 const incomingLength=Number(req.headers['content-length']||0);if(incomingLength>1500000)return json(res,413,{error:'Recording too large.'});
 if(!publicVoiceEnabled(env))return json(res,503,{error:'Live transcription is not configured. Type your report instead.'});
 let voice;try{voice=parseVoiceRequest(req.body);}catch(error){return json(res,error instanceof SyntaxError?400:(error.status||400),{error:error instanceof SyntaxError?'Invalid request JSON.':error.message});}
 try{
  const clientKey=quotaIdentity(req.headers,env.GNANI_API_KEY);
  const permitted=await (reserve||reserveQuota)(clientKey,env);
  if(!permitted){
   let quota=null;
   try{quota=await getQuota(clientKey,env);}catch{}
   const reason=quotaReason(quota),reset=nextUtcReset();
   res.setHeader('Retry-After',String(reset.retryAfterSeconds));
   return json(res,429,{code:'WARDLENS_DAILY_LIMIT',error:quotaMessage(reason),reason,quota,resetAt:reset.resetAt});
  }
  const r=await transcribe({fileName:'voice.wav',audio:voice.audio,language:voice.language,model:'prisma-v2.5',key:env.GNANI_API_KEY});
  return json(res,200,{transcript:r.transcript,language:r.language,model:r.model,provider:'gnani',reviewRequired:true});
 }catch(error){const status=error instanceof GnaniError?error.status:503;
  const upstreamLimited=error instanceof GnaniError&&/rate-limit/i.test(error.message);
  return json(res,status,{code:upstreamLimited?'GNANI_RATE_LIMIT':'TRANSCRIPTION_UNAVAILABLE',
   error:error instanceof GnaniError?error.message:'Voice service is temporarily unavailable. Please type your report.'});}
}
async function reserveQuota(clientKey,env){
 const {neon}=await import('@neondatabase/serverless');const sql=neon(env.DATABASE_URL);
 // The DB function serializes reservations with an advisory transaction lock.
 const rows=await sql`SELECT public.awaaz_voice_reserve(CURRENT_DATE, ${clientKey}, ${CLIENT_DAILY_LIMIT}, ${GLOBAL_DAILY_LIMIT}) AS permitted`;
 return rows[0]?.permitted===true;
}
async function readQuotaStatus(clientKey,env){
 const {neon}=await import('@neondatabase/serverless');
 const sql=neon(env.DATABASE_URL);
 const rows=await sql`SELECT scope, attempts FROM public.awaaz_voice_quota
  WHERE day=CURRENT_DATE AND scope IN ('global', ${'ip:'+clientKey})`;
 let globalUsed=0,clientUsed=0;
 for(const row of rows){
  if(row.scope==='global')globalUsed=Number(row.attempts)||0;
  if(row.scope==='ip:'+clientKey)clientUsed=Number(row.attempts)||0;
 }
 return {
  clientRemaining:Math.max(0,CLIENT_DAILY_LIMIT-clientUsed),
  globalRemaining:Math.max(0,GLOBAL_DAILY_LIMIT-globalUsed),
  clientLimit:CLIENT_DAILY_LIMIT,globalLimit:GLOBAL_DAILY_LIMIT,
  resetAt:nextUtcReset().resetAt
 };
}
export default async function handler(req,res){return handleVoice(req,res);}
