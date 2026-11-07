/** Convert a consented browser recording to bounded mono PCM WAV for Gnani Prisma REST.
 * No recording persists on a server. Input decodes in-browser; target 16kHz/16-bit.
 */
export const MAX_VOICE_SECONDS = 25;
export const WAV_RATE = 16000;
export function pcmToWav(samples, sampleRate = WAV_RATE){
  if (!(samples instanceof Float32Array) || !Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 48000) throw new Error('Invalid audio samples');
  if (samples.length < sampleRate / 4 || samples.length > sampleRate * MAX_VOICE_SECONDS) throw new Error('Record between 0.25 and 25 seconds.');
  const buffer = new ArrayBuffer(44 + samples.length * 2), view = new DataView(buffer);
  const ascii = (offset, str) => {for(let i=0;i<str.length;i++) view.setUint8(offset+i,str.charCodeAt(i));};
  ascii(0,'RIFF');view.setUint32(4,36+samples.length*2,true);ascii(8,'WAVE');ascii(12,'fmt ');
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
  view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
  ascii(36,'data');view.setUint32(40,samples.length*2,true);
  for(let i=0;i<samples.length;i++){const v=Math.max(-1,Math.min(1,samples[i]));view.setInt16(44+i*2,v<0?Math.round(v*32768):Math.round(v*32767),true);}
  return new Blob([buffer],{type:'audio/wav'});
}
export async function recordingToWav(blob){
  if(!blob || blob.size<64 || blob.size>2_500_000) throw new Error('Recording is¶»§q«^