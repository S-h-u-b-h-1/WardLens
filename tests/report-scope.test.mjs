import test from 'node:test';
import assert from 'node:assert/strict';
import {assessReportScope} from '../report-scope.js';
import {extractEvidence} from '../engine.js';
const report=text=>assessReportScope(text,extractEvidence(text));

for(const text of [
 'ki yaha ki mithai bohot achhi h',
 'Yahan ki mithai bahut achhi hai',
 'The sweets here are delicious.',
 'यहाँ की मिठाई बहुत अच्छी है',
 'এই মিষ্টি খুব ভালো',
 'Hello everyone good morning',
 'This cafe makes lovely sweets',
 'The road is beautiful',
]){
 test('reject unrelated comment: '+text,()=>assert.equal(report(text).status,'out-of-scope'));
}
for(const text of [
 'There is a blocked drain near the market.',
 'There is standing water on the road.',
 'No water supply in the street.',
 'यहाँ नाली बंद हो गई है।',
 'মোড়ে ড্রেন বন্ধ হয়ে গেছে।',
 'Mithai ki dukan ke samne naali jam hai.',
 'Garbage is piling up near the bus stop.',
 'The streetlight is flickering near the school.',
]){
 test('accept possible civic issue without inventing its cause: '+text,()=>{
  const status=report(text).status;
  assert.ok(status==='relevant'||status==='needs-details',status);
 });
}
