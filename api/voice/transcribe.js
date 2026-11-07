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
  if(mime==='audio/flac' && !signature.startsWith('fLaC'))throw new Gnan¶»§q«^