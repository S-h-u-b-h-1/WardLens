/* Browser build of WardLens' actual deterministic engine. Generated from src/*.js. */

function sha256(input){
 const bytes=new TextEncoder().encode(String(input));
 const len=bytes.length,padded=Math.ceil((len+9)/64)*64;
 const data=new Uint8Array(padded);data.set(bytes);data[len]=128;
 const bitLen=BigInt(len)*8n;
 for(let i=0;i<8;i++)data[padded-1-i]=Number((bitLen>>BigInt(i*8))&255n);
 const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
 const H=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
 const R=(x,n)=>(x>>>n)|(x<<(32-n));
 const w=new Uint32Array(64);
 for(let offset=0;offset<padded;offset+=64){
  for(let i=0;i<16;i++){let j=offset+i*4;w[i]=((data[j]<<24)|(data[j+1]<<16)|(data[j+2]<<8)|data[j+3])>>>0;}
  for(let i=16;i<64;i++){let a=w[i-15],b=w[i-2];w[i]=(w[i-16]+(R(a,7)^R(a,18)^(a>>>3))+w[i-7]+(R(b,17)^R(b,19)^(b>>>10)))>>>0;}
  let [a,b,c,d,e,f,g,h]=H;
  for(let i=0;i<64;i++){
   let s1=R(e,6)^R(e,11)^R(e,25),ch=(e&f)^(~e&g),t1=(h+s1+ch+K[i]+w[i])>>>0;
   let s0=R(a,2)^R(a,13)^R(a,22),maj=(a&b)^(a&c)^(b&c),t2=(s0+maj)>>>0;
   h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
  }
  for(let i=0;i<8;i++)H[i]=(H[i]+[a,b,c,d,e,f,g,h][i])>>>0;
 }
 return H.map(n=>n.toString(16).padStart(8,'0')).join('');
}
function createHash(algo){if(algo!=='sha256')throw Error('Only SHA-256 is supported');let input='';return {
 update(x){input+=String(x);return this;},digest(encoding){if(encoding!=='hex')throw Error('Only hex digests supported');return sha256(input);}
};}

const __modules={"catalog":function(module,require){
/** Fictional demonstration geography. Not real geographic coordinates, complaints or infrastructure. */
const ZONES = Object.freeze({
  'shanti-nagar': { id: 'shanti-nagar', name: 'Shanti Nagar', ward: '09', label: 'Ward 09 · Shanti Nagar', x: 30, y: 36, assets: ['PUMP-W17'] },
  'mill-road': { id: 'mill-road', name: 'Mill Road', ward: '09', label: 'Ward 09 · Mill Road', x: 55, y: 62, assets: ['PUMP-W17'] },
  'lake-east': { id: 'lake-east', name: 'Lake East', ward: '10', label: 'Ward 10 · Lake East', x: 79, y: 27, assets: ['PUMP-E28'] },
  'rail-basti': { id: 'rail-basti', name: 'Rail Basti', ward: '11', label: 'Ward 11 · Rail Basti', x: 80, y: 78, assets: ['PUMP-R04'] }
});

const ASSETS = Object.freeze({
  'PUMP-W17': { id:'PUMP-W17', name:'West Pump W-17', kind:'water-pump', zones:['shanti-nagar','mill-road'], x:42, y:47 },
  'PUMP-E28': { id:'PUMP-E28', name:'East Pump E-28', kind:'water-pump', zones:['lake-east'], x:73, y:39 },
  'PUMP-R04': { id:'PUMP-R04', name:'Rail Pump R-04', kind:'water-pump', zones:['rail-basti'], x:72, y:72 }
});

const SYMPTOMS = Object.freeze({
  'water-outage': { label: 'No water supply', family:'water', polarity:'failure' },
  'water-restored': { label: 'Water supply operating', family:'water', polarity:'working' },
  'pump-failure': { label: 'Pump not working', family:'pump', polarity:'failure' },
  'pump-operating': { label: 'Pump working', family:'pump', polarity:'working' },
  'power-trip': { label: 'Motor power trip reported', family:'electricity', polarity:'failure' },
  'power-loss': { label: 'Motor voltage missing', family:'electricity', polarity:'failure' },
  'power-normal': { label: 'Motor power restored', family:'electricity', polarity:'working' },
  'waterlogging': { label: 'Standing water / waterlogging', family:'surface-water', polarity:'failure' },
  'drainage-blocked': { label: 'Drainage blocked', family:'drainage', polarity:'failure' }
});

const at = (hour) => new Date(Date.now() - (12-hour)*60*60*1000).toISOString(); // Fictional reports spaced over the last 3 hours
const report = (id, transcript, language, zoneId, hour, assetIds=[], x=null,y=null) => ({
  id, transcript, originalTranscript: transcript, language, zoneId, assetIds,
  reportedAt:at(hour), source:'synthetic-demo', transcription:{provider:'synthetic-demo',reviewed:true},
  x:x??ZONES[zoneId].x, y:y??ZONES[zoneId].y
});

function seedReports() {
  return [
    report('R-101','तीन दिन से शांति नगर में पानी नहीं आ रहा है।','hi-IN','shanti-nagar',9,[],28,33),
    report('R-102','ওয়ার্ড ৯ এর পাম্প W-17 গতকাল থেকে কাজ করছে না।','bn-IN','shanti-nagar',10,['PUMP-W17'],44,43),
    report('R-103','Ward 9 W-17 pump motor mein power trip hua hai.','hi-IN','mill-road',11,['PUMP-W17'],58,58),
    report('R-104','Lake East ward 10 mein paani nahi aa raha.','hi-IN','lake-east',12,[],80,25),
    report('R-105','West pump W-17 is working normally.','en-IN','shanti-nagar',12,['PUMP-W17'],46,41),
    report('R-106','Rail Basti mein school ke bahar traffic bahut zyada hai.','hi-IN','rail-basti',12,[],80,80)
  ];
}

const DEMO_EXPLANATION = 'All map coordinates, asset inventories, incident reports and descriptions are fictional. Relationships are hypotheses, not established causes.';

Object.assign(module.exports,{ZONES,ASSETS,SYMPTOMS,seedReports,DEMO_EXPLANATION});
},
"intelligence":function(module,require){
const {createHash}=require("node:crypto");
const {ASSETS, ZONES, SYMPTOMS}=require("./catalog.js");

const U = s => String(s??'').normalize('NFKC').toLowerCase().replace(/[–—−]/g,'-').replace(/\s+/g,' ').trim();
const WORDS = {
  failureWater: [/\b(no (?:water supply|water|supply)|not getting (?:any )?water|without water|supply (?:is )?(?:off|cut)|water (?:out|stopped|not coming)|paani nahi|pani nahi|paani nahin|pani nahin)\b/i,/पानी नहीं|पानी नही|पानी बंद|जल नहीं|पानी आ नहीं|জল আসছে না|জল নেই|পানি নেই|পানি আসছে না|পানি বন্ধ|জল সরবরাহ বন্ধ|জলের সরবরাহ বন্ধ|জল সরবরাহ নেই|পানি সরবরাহ বন্ধ/],
  workingWater: [/\b(water (?:restored|running|normal|available)|paani aa raha|pani aa raha|water supply (?:is )?(?:fine|normal))\b/i,/पानी आ रहा|पानी चालू|জল আসছে|পানি আসছে|জল স্বাভাবিক/],
  failPump: [/\bpump.{0,35}?(?:not working|not functioning|down|broken|failed|band hai|kharab hai|stopped)\b/i,/পাম্প.*(কাজ করছে না|বন্ধ|খারাপ)|पंप.*(बंद|खराब|काम नहीं)/],
  workingPump: [/\b(pump(?:(?!\bnot\b|\bfailed\b|\bbroken\b|\bdown\b).){0,35}?(?:working|operational|fine|normal)|pump chal raha|pump sahi hai)\b/i,/পাম্প(?:(?!কাজ করছে না).){0,50}(কাজ করছে|চালু আছে)|पंप.*(चालू|चल रहा|ठीक है)/],
  powerTrip: [/\b(power (?:trip|tripped|outage)|motor.*(?:trip|tripped|power.*(?:off|cut)|band)|bijli.*(?:band|nahi))\b/i,/মোটর.*(বিদ্যুৎ নেই|ট্রিপ)|बिजली.*(बंद|नहीं)|मोटर.*ट्रिप/],
  powerLoss: [/\b(?:motor.{0,35}?voltage (?:missing|absent|lost)|no (?:motor )?voltage|motor.*no power)\b/i,/মোটর.*(ভোল্টেজ নেই|বিদ্যুৎ নেই)|मोटर.*(वोल्टेज नहीं|बिजली नहीं)/],
  powerNormal: [/\b(motor power restored|power (?:is )?(?:back|restored)|motor.*power normal)\b/i,/বিদ্যুৎ ফিরে এসেছে|बिजली वापस आ गई/],
  waterlogging: [/\b(?:waterlogg(?:ed|ing)|street(?:s)? (?:is |are )?flooded|road(?:s)? (?:is |are )?flooded|standing water on (?:the )?(?:road|street)|paani bhar gaya|pani bhar gaya|paani jama ho gaya|gali mein paani bhar|road par paani bhar)\b/i,/पानी भर (?:गया|गई|गये|रहा)|पानी जमा (?:है|हो गया)|जलभराव|सड़क पर पानी भरा|बाढ़ का पानी|জল জমে (?:গেছে|আছে)|জলমগ্ন|পানি জমে (?:গেছে|আছে)|রাস্তায় জল (?:জমেছে|জমে আছে)/],
  drainageBlocked: [/\b(?:drain(?:age)? (?:is )?(?:clogged|blocked|choked)|blocked drainage|naali (?:jam|band)|nala (?:jam|band)|gutter (?:is )?(?:clogged|blocked))\b/i,/नाली (?:जाम|बंद|चोक)|नाला (?:जाम|बंद)|नाले में रुकावट|नाली अवरुद्ध|নর্দমা (?:বন্ধ|আটকে|জাম)|নালা (?:বন্ধ|আটকে|জাম)|ড্রেন (?:বন্ধ|আটকে|জাম)/]
};

// Conservative phrase extensions: broaden real-world paraphrase coverage without
// asserting anything about infrastructure causes or an unmentioned observation.
// Keep these contiguous with the actual source words so evidence spans are exact.
WORDS.failureWater.push(
  /\b(?:water supply (?:was|is|has been) (?:cut|stopped|interrupted)|(?:tap|taps) (?:has|have) (?:run dry|no water)|no (?:running |tap )?water (?:since|in|at))\b/i,
  /\b(?:paani|pani) (?:aa|a) nahi (?:raha|aaya|aya|rha)\b/i
);
WORDS.workingWater.push(
  /\b(?:paani|pani) (?:bilkul )?(?:sahi|theek|thik|normal) (?:aa|a) (?:raha|rha)(?: hai)?\b/i
);
WORDS.failPump.push(
  /\bpump.{0,38}?(?:kaam (?:bilkul )?nahi (?:kar|kr) (?:raha|rahi|rha)|nahi (?:chal|chala) (?:raha|rahi|rha))\b/i,
  /\b(?:pumping station|water pump) (?:has |had )?(?:stopped operating|ceased working)\b/i
);
WORDS.powerNormal.push(
  /\b(?:bijli|bijalee) (?:wapas|vapas) (?:aa|a) (?:gayi|gyi|gayee)(?: hai)?\b/i,
  /\b(?:electrical|electricity|electric) supply (?:has |is )?(?:returned|restored)(?: to (?:the )?motor)?\b/i
);
WORDS.waterlogging.push(
  /\b(?:(?:paani|pani) (?:jama|jamaa) (?:hai|ho (?:gaya|gya)|ho gaya hai)|(?:road|gali|lane|street) (?:pe|par|mein|me) (?:baarish ka )?(?:paani|pani) (?:jama|jamaa)|(?:rainwater|floodwater) (?:is )?(?:ankle|knee|waist) deep)\b/i,
  /(?:রাস্তার|রাস্তায়|রাস্তার মোড়ে|গলিতে|পাড়ায়).{0,35}?(?:জল|পানি) জমেছে/i
);
WORDS.drainageBlocked.push(
  /\b(?:naali|nali|nala|drain|storm drain|gutter) (?:bilkul |puri tarah |completely |fully |is completely |is fully |is )?(?:jam|band|clogged|blocked|choked)(?: ho (?:gayi|gai|gya|gaya))?\b/i,
  /(?:ড্রেন(?:টা|টি)?|নর্দমা(?:টা|টি)?)\s*(?:পুরো|একেবারে|সম্পূর্ণ)?\s*(?:আটকে গেছে|বন্ধ হয়ে গেছে|জাম হয়ে গেছে)/i
);

// Additional language-generalization forms, kept exact and conservative.
WORDS.failureWater.push(
  /\b(?:the )?taps? (?:are|is) dry\b/i,
  /\b(?:paani|pani).{0,18}?nahi (?:aa|a) (?:raha|rha)(?: hai)?\b/i
);
WORDS.workingWater.push(
  /\b(?:paani|pani).{0,32}?(?:normal|theek|thik|sahi) (?:aa|a) (?:raha|rha)(?: hai)?\b/i
);
WORDS.failPump.push(
  /\bpump.{0,35}?(?:(?:isn't|isnt|wasn't|wasnt) working|is not operational|was not operational)\b/i,
  /पंप.{0,25}?(?:बंद पड़ा|बिल्कुल बंद)/i
);
WORDS.powerNormal.push(/बिजली.{0,12}?(?:फिर से आ गई|वापस आ गई)/i);
WORDS.powerLoss.push(/\bmotor.{0,20}?voltage (?:is |was )?(?:missing|lost|absent)\b/i);
WORDS.waterlogging.push(
  /सड़क.{0,18}?पानी खड़ा है|पानी इकट्ठा (?:हो गया|है)/i,
  /\b(?:road|gali|lane|street) (?:pe|par|mein|me) (?:paani|pani) bhara hua hai\b/i
);
WORDS.drainageBlocked.push(
  /\b(?:naali|nali|nala) (?:poori|puri) tarah jam(?: ho (?:gayi|gai|gaya|gya))?\b/i,
  /\b(?:storm )?drain (?:has been|was) (?:clogged|blocked)\b/i
);

WORDS.waterlogging.push(/\b(?:roads?|streets?|lanes?)\s+(?:is|are|was|were)\s+still\s+(?:flooded|waterlogged)\b/i);

// Extract only a reported obstruction. Patterns intentionally require a bounded
// surface-drain noun and an explicit blockage adjective; never infer a cause.
WORDS.drainageBlocked.push(
  /\b(?:blocked|clogged|choked)\s+(?:storm\s+)?(?:drains?|drainage|gutters?|drainage channels?)\b/i,
  /\b(?:storm\s+)?drains?\b(?:\s+[a-z'-]+){0,9}\s+(?:is|are|was|were|has been|have been)\s+(?:still\s+|completely\s+|fully\s+|partially\s+)?(?:blocked|clogged|choked)\b/i,
  /\b(?:drainage\s+channels?|gutters?)\b(?:\s+[a-z'-]+){0,9}\s+(?:is|are|was|were|has been|have been)\s+(?:still\s+|completely\s+|fully\s+|partially\s+)?(?:blocked|clogged|choked)\b/i
);

/**
 * Transparent keyword-level extractor. It returns *candidate* symptoms, never a root cause.
 * It intentionally abstains when the report cannot be classified; do not turn abstention into a match.
 */
function extractEvidence(transcript, suppliedAssetIds=[]) {
  // Excerpts are taken from the normalized reviewed transcript, never generated text.
  const source=String(transcript??'').normalize('NFKC').replace(/\s+/g,' ').trim();
  const t=U(source);
  // A comma-separated first-hand observation must not disappear solely because
  // *another* clause speculates about a cause. Conversely, an entire hedge or
  // question contributes zero affirmative evidence. Never match across clauses.
  const hedged=/(?:\b(?:maybe|perhaps|possibly|possible|probably|i heard|i think|rumour|rumor|might be|shayad|maine suna hai|mujhe lagta hai)\b|शायद|सुना है|मुझे लगता है|মনে হয়|শুনেছি)/i;
  const leadingQuestion=/^(?:is|are|does|did|can|could|kya|क्या|কি)(?:\s|$)/i;
  const clauses=[...t.matchAll(/[^,;.!?؟？।॥،]+/gu)].map(m=>{
    const shift=m[0].length-m[0].trimStart().length;
    const value=m[0].trim();const start=m.index+shift,end=start+value.length;
    const question=leadingQuestion.test(value)||/[?؟？]/.test(t[end]||'');
    const hedge=hedged.test(value);
    return {value,start,end,question,hedge,eligible:!!value&&!question&&!hedge};
  });
  const eligible=clauses.filter(c=>c.eligible);
  const excluded=clauses.filter(c=>!c.eligible&&c.value);
  if(!eligible.length)return {symptoms:[],excerpts:[],explicitAssets:[],explicitWard:null,
    status:'needs-clarification',uncertainty:[excluded.some(c=>c.question)?'Question detected; no observational claim asserted.':'Hearsay or uncertain phrasing detected; verify with a first-hand observation.'],
    methods:['conservative-abstention-v3'],text:t};

  const symptoms=[],excerpts=[],uncertainty=[];
  if(excluded.length)uncertainty.push('Questioned or speculative clauses were excluded; only explicit observational clauses were classified.');
  const firstMatch=(patterns,symptom=null)=>{
    const hits=[];
    for(const clause of eligible)for(const re of patterns){
      const match=re.exec(clause.value);
      if(!match)continue;
      // Negation is local to the observation; do not treat “not blocked”,
      // “naali jam nahi hai”, or “no standing water” as active incidents.
      const before=clause.value.slice(Math.max(0,match.index-18),match.index);
      const after=clause.value.slice(match.index+match[0].length,match.index+match[0].length+20);
      if(symptom==='drainage-blocked' &&
        (/^\s*(?:नहीं|नही|না|নয়|nahi|nahin|not|no longer)(?:\s|$)/i.test(after) ||
         /(?:\bno longer\s*$|\bnot\s*$)/i.test(before) ||
         /\b(?:no|never|without|not)\s+(?:(?:a|any|the)\s+)?$/i.test(before)))continue;
      if(symptom==='waterlogging' &&
        /(?:\bno\s*$|\bnot\s*$|\bno longer\s*$)/i.test(before))continue;
      hits.push(Object.assign(match,{index:clause.start+match.index}));
    }
    return hits.sort((a,b)=>a.index-b.index)[0]||null;
  };
  for (const [failure,working,negative,positive] of [
    ['water-outage','water-restored',WORDS.failureWater,WORDS.workingWater],
    ['pump-failure','pump-operating',WORDS.failPump,WORDS.workingPump],
    ['power-trip','power-normal',WORDS.powerTrip,WORDS.powerNormal]
  ]) {
    const negateWater=failure==='water-outage'&&/\bno water (?:issue|problem|shortage)\b/i.test(t);
    const failureMatch=negateWater?null:firstMatch(negative), rawWorkingMatch=firstMatch(positive);
    // Negated phrases such as 'not working' / 'কাজ করছে না' contain the word 'working'.
    // A positive hit inside the negative span must NOT count as a competing state.
    const overlaps=failureMatch && rawWorkingMatch && rawWorkingMatch.index < failureMatch.index+failureMatch[0].length && failureMatch.index < rawWorkingMatch.index+rawWorkingMatch[0].length;
    const workingMatch=overlaps?null:rawWorkingMatch;
    const shiftInState=failureMatch && /(?:\b(?:but now|now working|now restored|currently working)\b|अब|এখন)/i.test(t) && /(?:working|restored|चालू|কাজ করছে)/i.test(t);
    if((failureMatch && workingMatch) || shiftInState) {
      uncertainty.push(`Both interrupted and operating states were mentioned for ${SYMPTOMS[failure].family}; clarify the current observation and its time.`);
      continue;
    }
    const match=failureMatch||workingMatch;
    if(!match)continue;
    const type=failureMatch?failure:working;
    symptoms.push(type);
    const start=match.index,end=start+match[0].length;
    excerpts.push({symptom:type,quote:source.slice(start,end),start,end,method:'matched-reviewed-transcript-v2'});
  }
  // These are observations of standing surface water or drainage obstruction, not a
  // diagnosis that one caused the other or that a water-supply outage occurred.
  for(const [symptom,patterns] of [['waterlogging',WORDS.waterlogging],['drainage-blocked',WORDS.drainageBlocked]]) {
    const match=firstMatch(patterns,symptom);
    // A previously blocked drain described as subsequently cleared is not
    // evidence of a *current* blockage. Ask about timing rather than assert.
    if(match && symptom==='drainage-blocked' &&
      /(?:अब|now|এখন).{0,25}?(?:साफ|खुल|clear|unblocked|খোলা|পরিষ্কার)/i.test(t.slice(match.index+match[0].length))){
      uncertainty.push('Drain was described as cleared later; verify its current state and observation time.');
      continue;
    }
    if(match) {const start=match.index,end=start+match[0].length;
      symptoms.push(symptom);excerpts.push({symptom,quote:source.slice(start,end),start,end,method:'matched-reviewed-transcript-v3'});}
  }
  // A measured absence of voltage is not automatically a tripped breaker.
  // Preserve the exact reported symptom rather than inventing a diagnosis.
  const voltageMatch=firstMatch(WORDS.powerLoss);
  if(voltageMatch && !symptoms.includes('power-trip') && !symptoms.includes('power-normal')) {
    const start=voltageMatch.index,end=start+voltageMatch[0].length;
    symptoms.push('power-loss');
    excerpts.push({symptom:'power-loss',quote:source.slice(start,end),start,end,method:'matched-reviewed-transcript-v2'});
  }
  const explicitAssets=new Set(suppliedAssetIds.filter(id=>id in ASSETS));
  for (const id of Object.keys(ASSETS)) {
    const suffix=id.split('-')[1];
    const regex=new RegExp(`(?:^|[^a-z0-9])(?:pump[\\s-]*)?${suffix.slice(0,1)}\\s*[- ]?\\s*${suffix.slice(1)}(?:$|[^a-z0-9])`,'i');
    if(regex.test(t)) explicitAssets.add(id);
  }
  const wardMatch=t.match(/(?:ward|वार्ड|ওয়ার্ড|ওয়ার্ড)\s*(?:no\.?\s*)?([0-9०-९০-৯]{1,2})/i);
  const nativeDigits='०१२३४५६७८९০১২৩৪৫৬৭৮৯';
  const normalizedWard=wardMatch ? wardMatch[1].split('').map(d=>nativeDigits.indexOf(d)===-1?d:String(nativeDigits.indexOf(d)%10)).join('').padStart(2,'0') : null;
  if(!symptoms.length && !uncertainty.length)uncertainty.push('No supported incident symptom could be extracted from this statement.');
  return {symptoms,excerpts,explicitAssets:[...explicitAssets],explicitWard:normalizedWard,
    status:uncertainty.length?(symptoms.length?'partially-classified':'needs-clarification'):'classified',
    uncertainty,methods:['lexicon-v3','clause-scoped-evidence-v1','explicit-asset-id'],text:t};
}

function analyseReport(r) {
  const evidence=extractEvidence(r.transcript,r.assetIds);
  const zone=ZONES[r.zoneId];
  const wardConsistent=!evidence.explicitWard||zone?.ward===evidence.explicitWard;
  const assetLocationConsistent=evidence.explicitAssets.every(id=>ASSETS[id]?.zones.includes(r.zoneId));
  if(!wardConsistent)evidence.uncertainty.push('Ward spoken in transcript does not match the selected service area.');
  if(!assetLocationConsistent)evidence.uncertainty.push('Asset mentioned is not mapped to the selected service area.');
  return {...r,evidence, zoneName:zone?.label??'Unspecified area',
    locationVerified:!!zone&&wardConsistent&&assetLocationConsistent,assetLocationConsistent,
    sourceVerified:r.transcription?.reviewed===true,
    claims:evidence.excerpts.map((match,i)=>({id:`${r.id}:claim:${i+1}`,type:match.symptom,label:SYMPTOMS[match.symptom].label,sourceReportId:r.id,
      reviewed:!!r.transcription?.reviewed,quote:match.quote,span:{start:match.start,end:match.end},method:match.method}))};
}

function closeInTime(a,b) {
  const x=Date.parse(a.reportedAt), y=Date.parse(b.reportedAt);
  return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x-y)<=48*60*60*1000;
}
function overlappingZones(a,b) { return a.zoneId && b.zoneId && a.zoneId===b.zoneId; }
function sameAsset(a,b) { return a.evidence.explicitAssets.filter(id=>b.evidence.explicitAssets.includes(id)); }
function sameServiceArea(a,b) {
  if (!a.locationVerified || !b.locationVerified) return [];
  return Object.values(ASSETS).filter(asset=>asset.zones.includes(a.zoneId) && asset.zones.includes(b.zoneId));
}
function opposite(a,b) {
  return a.evidence.symptoms.some(sa=>b.evidence.symptoms.some(sb=>SYMPTOMS[sa].family===SYMPTOMS[sb].family && SYMPTOMS[sa].polarity!==SYMPTOMS[sb].polarity));
}
function supportedDependency(a,b,service) {
  const A=new Set(a.evidence.symptoms), B=new Set(b.evidence.symptoms);
  const pair=(p,q)=>(A.has(p)&&B.has(q))||(B.has(p)&&A.has(q));
  if(pair('waterlogging','drainage-blocked') && service.length) return 'waterlogging ↔ blocked drainage (investigate, no verified cause)';
  if(pair('pump-failure','water-outage') && service.length) return 'pump-failure ↔ water-outage';
  if(pair('power-trip','pump-failure') && sameAsset(a,b).length) return 'power-trip ↔ pump-failure';
  if(pair('power-loss','pump-failure') && sameAsset(a,b).length) return 'power-loss ↔ pump-failure';
  if(pair('power-trip','water-outage') && service.length && sameAsset(a,b).length) return 'power-trip ↔ water-outage';
  if(pair('power-loss','water-outage') && service.length && sameAsset(a,b).length) return 'power-loss ↔ water-outage';
  return null;
}
const INTERESTING=new Set(['water-outage','pump-failure','power-trip','power-loss','water-restored','pump-operating','power-normal','waterlogging','drainage-blocked']);

/** Relationships are candidate explanations backed by explicit source report IDs. No causal conclusions. */
function deriveRelationship(a,b) {
  if (!a.sourceVerified || !b.sourceVerified || !a.locationVerified || !b.locationVerified) return null;
  if (!a.evidence.symptoms.length || !b.evidence.symptoms.length || !closeInTime(a,b)) return null;
  if (![...a.evidence.symptoms,...b.evidence.symptoms].some(s=>INTERESTING.has(s))) return null;
  const sharedAssets=sameAsset(a,b);
  const local=overlappingZones(a,b);
  const service=sameServiceArea(a,b);
  if(!local && !sharedAssets.length && !service.length) return null;
  // Contradictory status gets precedence. Only within the same asset/zone/served area.
  if(opposite(a,b) && (sharedAssets.length || local)) {
    return {kind:'contradiction',strength:'disputed',reason:`Opposite reported operating states for ${sharedAssets[0]||a.zoneName}. Observation times are unverified; the asset may have changed state, so request time-specific evidence.`,assetIds:sharedAssets,ruleId:'opposite-symptom-v1'};
  }
  // Don't join different statuses merely because they share a service area.
  const bothWorking=a.evidence.symptoms.every(s=>SYMPTOMS[s].polarity==='working') && b.evidence.symptoms.every(s=>SYMPTOMS[s].polarity==='working');
  if (bothWorking) return null;
  const identical=a.evidence.symptoms.find(x=>b.evidence.symptoms.includes(x));
  if (identical && (local || sharedAssets.length)) {
    return {kind:'possible-duplicate',strength:'candidate',reason:`Both reports describe “${SYMPTOMS[identical].label}” in a matching area or asset.`,assetIds:sharedAssets,ruleId:'same-symptom-v1'};
  }
  const dep=supportedDependency(a,b,service);
  if(dep) return {kind:'possible-dependency',strength:'candidate',reason:`The fictional service inventory connects ${service.map(x=>x.name).join(', ')||sharedAssets.join(', ')} to these areas; reported symptoms (${dep}) may be related, but causation is unverified.`,assetIds:[...new Set([...sharedAssets,...service.map(x=>x.id)])],ruleId:'asset-topology-v1'};
  // Same asset and distinct failure types: interesting but not necessarily causal.
  if(sharedAssets.length && a.evidence.symptoms.some(s=>SYMPTOMS[s].polarity==='failure')&&b.evidence.symptoms.some(s=>SYMPTOMS[s].polarity==='failure')) {
    return {kind:'shared-asset',strength:'candidate',reason:`Both reports explicitly mention ${sharedAssets.join(', ')} with different failure symptoms.`,assetIds:sharedAssets,ruleId:'shared-asset-v1'};
  }
  return null;
}


/**
 * A hypothesis is a question-worthy explanation, not a root-cause diagnosis.
 * Only create one when two distinct observed failure types support a catalogued asset.
 * Reports that assert normal operation are retained as counter-evidence.
 */
function relationEvidence(a,b,rel) {
  const sources=[a,b].map(r=>({reportId:r.id,zoneId:r.zoneId,receivedAt:r.reportedAt,
    excerpts:r.claims.map(c=>({claimId:c.id,type:c.type,quote:c.quote,span:c.span}))}));
  const gapMinutes=Math.round(Math.abs(Date.parse(a.reportedAt)-Date.parse(b.reportedAt))/60000);
  return {...rel,sources,checks:[
    {key:'source-review',label:'Source transcripts',result:'passed',detail:'Both source transcripts were explicitly marked reviewed.'},
    {key:'service-area',label:'Geography',result:'passed',detail:`Selected service areas: ${a.zoneName} and ${b.zoneName}. Catalog and explicit ward/asset constraints passed.`},
    {key:'received-time',label:'Receipt-time window',result:'passed',detail:`Reports were received ${gapMinutes} minutes apart (48-hour cutoff). Actual observation times are not verified.`},
    {key:'reasoning-rule',label:'Relationship rule',result:'candidate',detail:`${rel.ruleId}: ${rel.reason}`}
  ],caveats:['Receipt time does not prove that observations occurred together.','A source transcription and the fictional topology are not independent operational verification.']};
}

function fingerprint(assetId,support,counter,links) {
  // Content-addressed: changing an existing statement or the review state of a
  // supporting edge must expire any previous human hypothesis assessment.
  const sourceSignature=r=>({id:r.id,text:r.transcript,zoneId:r.zoneId,reportedAt:r.reportedAt,
    symptoms:r.evidence.symptoms,assets:r.evidence.explicitAssets,sourceReviewed:r.sourceVerified});
  const reference={assetId,support:support.map(sourceSignature).sort((a,b)=>a.id.localeCompare(b.id)),
    counter:counter.map(sourceSignature).sort((a,b)=>a.id.localeCompare(b.id)),
    dependencies:links.filter(e=>e.kind==='possible-dependency'&&e.status!=='rejected-link').map(e=>({id:e.id,status:e.status})).sort((a,b)=>a.id.localeCompare(b.id))};
  return createHash('sha256').update(JSON.stringify(reference)).digest('hex').slice(0,20);
}

/**
 * A hypothesis is a reviewable candidate for investigation, not a verified cause.
 * Rejected dependency edges may not sustain it. Review decisions are tied to an evidence fingerprint.
 */
function buildHypotheses(nodes,links,hypothesisReviews={}) {
  const result=[];
  for (const asset of Object.values(ASSETS)) {
    const scope=nodes.filter(r=>r.locationVerified && r.sourceVerified && (
      r.evidence.explicitAssets.includes(asset.id) || asset.zones.includes(r.zoneId)
    ));
    const support=scope.filter(r=>r.evidence.symptoms.some(s=>SYMPTOMS[s].polarity==='failure'));
    const counter=scope.filter(r=>r.evidence.symptoms.some(s=>SYMPTOMS[s].polarity==='working'));
    const distinctSymptoms=[...new Set(support.flatMap(r=>r.evidence.symptoms).filter(s=>SYMPTOMS[s].polarity==='failure'))];
    const explicitAsset=support.some(r=>r.evidence.explicitAssets.includes(asset.id));
    const activeDependencies=links.filter(e=>e.kind==='possible-dependency'&&e.status!=='rejected-link'&&
      support.some(r=>r.id===e.from)&&support.some(r=>r.id===e.to) && e.assetIds.includes(asset.id));
    if (!explicitAsset || distinctSymptoms.length<2 || !activeDependencies.length) continue;
    const contested=counter.length>0;
    const supportIds=support.map(r=>r.id),counterIds=counter.map(r=>r.id);
    const evidenceVersion=fingerprint(asset.id,support,counter,activeDependencies);
    const past=hypothesisReviews[`hypothesis:${asset.id}`];
    const reviewFresh=!!past && past.evidenceVersion===evidenceVersion;
    result.push({id:`hypothesis:${asset.id}`,assetId:asset.id,assetName:asset.name,
      headline:`Possible shared service disruption near ${asset.name}`,
      status:contested?'contested':'unverified',reviewStatus:reviewFresh?past.status:'needs-review',
      reviewerNote:reviewFresh?past.note:'',reviewedAt:reviewFresh?past.reviewedAt:null,
      reviewStale:!!past&&!reviewFresh,evidenceVersion,
      supportReportIds:supportIds,counterReportIds:counterIds,
      distinctSymptoms,scopeZones:asset.zones.map(id=>ZONES[id].label),
      supportingEdgeIds:activeDependencies.map(e=>e.id),
      reasoning:[
        `${support.length} reviewed reports in the fictional service area describe ${distinctSymptoms.map(s=>SYMPTOMS[s].label.toLowerCase()).join(', ')}.`,
        `At least one report explicitly names ${asset.id}.`,
        `The fictional asset catalog lists ${asset.name} as serving the relevant localities.`,
        `${activeDependencies.length} active candidate dependency link(s) connect source reports; dismissed links are excluded.`,
        'Common infrastructure is a candidate explanation, not a verified cause.'
      ],
      unansweredQuestions:contested?[
        `One report indicates ${asset.name} was operating. Were both observations made at the same time?`,
        `Can a technician check the current operating state of ${asset.id} and log the inspection time?`
      ]:[
        `Can a technician inspect ${asset.id} and record its actual status?`,
        'Were the reported symptoms observed at overlapping times?'
      ],
      alternatives:['Separate neighborhood plumbing or valve problems','A temporary supply schedule change','Inaccurate or out-of-date voice observations'],
      provenance:{ruleId:'cross-symptom-asset-hypothesis-v2',sourceReportIds:[...new Set([...support,...counter].map(r=>r.id))],
        sourceAssetId:asset.id},
      caution:'An evidence-linked working hypothesis. No verified root cause, operator inspection or municipal integration.'
    });
  }
  return result;
}

function buildGraph(reports, reviews={}, hypothesisReviews={}) {
  const nodes=reports.map(analyseReport);
  const links=[];
  for(let i=0;i<nodes.length;i++) for(let j=i+1;j<nodes.length;j++) {
    const a=nodes[i], b=nodes[j];
    const rel=deriveRelationship(a,b);
    if(!rel) continue;
    const key=[a.id,b.id].sort().join('~');
    links.push({id:`edge:${key}`,from:a.id,to:b.id,sourceReportIds:[a.id,b.id],...relationEvidence(a,b,rel),
      status:reviews[key]?.status??reviews[key]??'needs-review',
      reviewedAt:reviews[key]?.reviewedAt??null,reviewerNote:reviews[key]?.note??''});
  }
  const hypotheses=buildHypotheses(nodes,links,hypothesisReviews);
  const graph={nodes,links,hypotheses,stats:{reports:nodes.length,hypotheses:hypotheses.length,linked:links.filter(x=>x.kind!=='contradiction'&&x.status!=='rejected-link').length,
    contradictions:links.filter(x=>x.kind==='contradiction').length,
    unclassified:nodes.filter(x=>x.evidence.status==='needs-clarification').length,
    unreviewedLinks:links.filter(x=>x.status==='needs-review').length,
    unreviewedHypotheses:hypotheses.filter(x=>x.reviewStatus==='needs-review').length,
    rejectedLinks:links.filter(x=>x.status==='rejected-link').length},
    engine:{name:'AwaazGraph evidence engine',version:'0.3.0',mode:'deterministic rules',causality:'never inferred as fact'}};
  return graph;
}

function nextClarification(report) {
  const r=report.evidence?report:analyseReport(report);
  const locale=r.language==='bn-IN'?'bn-IN':r.language==='hi-IN'?'hi-IN':'en-IN';
  const catalog={
    'hi-IN':{
      location:'यह समस्या किस इलाके या वार्ड में है?',
      symptom:'कृपया बताइए, कौन सी सेवा बंद है और क्या समस्या हो रही है?',
      asset:'अगर पंप का नंबर दिख रहा है, तो कृपया बताइए। नहीं पता तो कहिए कि नहीं पता।',
      time:'क्या समस्या अभी भी जारी है? आपने इसे आखिरी बार कब देखा था?'
    },
    'bn-IN':{
      location:'এই সমস্যাটি কোন এলাকা বা ওয়ার্ডে হচ্ছে?',
      symptom:'কোন পরিষেবাটি বন্ধ আছে এবং ঠিক কী সমস্যা হচ্ছে, অনুগ্রহ করে বলবেন?',
      asset:'পাম্পের নম্বর জানা থাকলে বলুন, না জানা থাকলে সেটাও জানান।',
      time:'সমস্যাটি কি এখনও হচ্ছে? শেষ কবে নিজের চোখে দেখেছেন?'
    },
    'en-IN':{
      location:'Which locality or service area does this report concern?',
      symptom:'Which service is affected, and what exactly is not working?',
      asset:'Do you know the pump identifier? If not, please say you do not know.',
      time:'Is the issue still happening? When did you last directly observe it?'
    }
  };
  const field=!r.locationVerified?'location':!r.evidence.symptoms.length?'symptom':r.evidence.symptoms.includes('pump-failure')&&!r.evidence.explicitAssets.length?'asset':'time';
  return {text:catalog[locale][field],field,language:locale,requiresUserAction:true};
}

Object.assign(module.exports,{extractEvidence,analyseReport,deriveRelationship,buildHypotheses,buildGraph,nextClarification});
},
"temporal":function(module,require){
/**
 * Conservative hints about the ONSET of a situation, not independently confirmed
 * observation timestamps. Never promote these hints to `observedAt`, and never
 * silently compare them as exact points in time.
 */
const PATTERNS = [
  {re:/\b(?:aaj\s+)?subah\s+se\b/i, label:'Since morning', period:'morning', day:'likely-today', locale:'hi-IN'},
  {re:/\bkal\s+raat\s+se\b/i, label:'Since last night (day needs confirmation)', period:'night', day:'ambiguous-kal', locale:'hi-IN'},
  {re:/\b(?:aaj\s+)?shaam\s+se\b/i, label:'Since evening', period:'evening', day:'likely-today', locale:'hi-IN'},
  {re:/आज\s*सुबह\s*से|सुबह\s*से/g, label:'सुबह से (since morning)', period:'morning', day:'likely-today', locale:'hi-IN'},
  {re:/कल\s*रात\s*से/g, label:'कल रात से (confirm which night)', period:'night', day:'ambiguous-kal', locale:'hi-IN'},
  {re:/आज\s*शाम\s*से|शाम\s*से/g, label:'शाम से (since evening)', period:'evening', day:'likely-today', locale:'hi-IN'},
  {re:/\b(?:since\s+this\s+morning|since\s+morning|from\s+this\s+morning)\b/i, label:'Since this morning', period:'morning', day:'likely-today', locale:'en-IN'},
  {re:/\b(?:since\s+last\s+night|since\s+yesterday\s+evening)\b/i, label:'Since last night / yesterday evening', period:'night', day:'previous-day', locale:'en-IN'},
  {re:/\b(?:since\s+yesterday)\b/i, label:'Since yesterday (exact time unknown)', period:'day', day:'previous-day', locale:'en-IN'},
  {re:/\b(?:since\s+this\s+evening)\b/i, label:'Since this evening', period:'evening', day:'likely-today', locale:'en-IN'},
  {re:/\b(?:aj\s+shokal\s+theke|sokal\s+theke|shokal\s+theke)\b/i, label:'Since morning', period:'morning', day:'likely-today', locale:'bn-IN'},
  {re:/আজ\s*সকাল\s*থেকে|সকাল\s*থেকে/g, label:'আজ সকাল থেকে / since morning', period:'morning', day:'likely-today', locale:'bn-IN'},
  {re:/গত\s*রাত\s*থেকে|কাল\s*রাত\s*থেকে/g, label:'Since last night (exact time unknown)', period:'night', day:'previous-day', locale:'bn-IN'},
  {re:/গতকাল\s*থেকে|গত\s*কাল\s*থেকে/g, label:'Since yesterday (exact time unknown)', period:'day', day:'previous-day', locale:'bn-IN'},
];

const partOfDay={morning:'a broad part of the morning',evening:'a broad part of the evening',night:'night may cross midnight',day:'an unspecified part of the day'};

function localDate(iso){
  const date=new Date(iso);
  if(!Number.isFinite(date.getTime()))return null;
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
    timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function extractOnsetCue(transcript,reportedAt,hasObservationClaim=true){
  if(!hasObservationClaim || typeof transcript!=='string'||!transcript.trim())return null;
  const found=[];
  for(const {re,...meta} of PATTERNS){
    const match=new RegExp(re.source,re.flags.replace(/g/g,'')).exec(transcript);
    if(match)found.push({...meta,start:match.index,end:match.index+match[0].length,phrase:transcript.slice(match.index,match.index+match[0].length)});
  }
  if(!found.length)return null;
  found.sort((a,b)=>a.start-b.start||(b.end-b.start)-(a.end-a.start));
  // Different time expressions in one statement may refer to separate incidents.
  // We deliberately do not merge them into a fabricated single time.
  const first=found[0],multiple=found.some(x=>x!==first && x.start>=first.end && x.phrase!==first.phrase);
  return {kind:'approximate-onset',sourcePhrase:first.phrase,sourceSpan:{start:first.start,end:first.end},
    label:first.label,period:first.period,dayRelation:first.day,
    anchorLocalDate:localDate(reportedAt),timezone:'Asia/Kolkata',
    preciseTimestamp:null,verified:false,ambiguous:multiple||first.day==='ambiguous-kal',
    note:`This is a reporter's relative expression (${partOfDay[first.period]}). It does not establish an exact incident time.${multiple?' Another time expression also appears; ask which event it describes.':''}`};
}

/**
 * Comparison of two claimed operating states. Both explicit times are necessary
 * before suggesting a transition. An elapsed interval alone does not prove repair.
 */
function assessOpposingStates(a,b){
  const x=a.observedAt?Date.parse(a.observedAt):NaN,y=b.observedAt?Date.parse(b.observedAt):NaN;
  if(!Number.isFinite(x)||!Number.isFinite(y))
    return {classification:'timing-unresolved',label:'Opposing observations · timing unknown',
      detail:'At least one observation time is unknown. These reports may concern different moments; ask when each condition was observed.'};
  const diffMinutes=Math.round(Math.abs(x-y)/60000);
  if(diffMinutes>=30)return {classification:'possible-state-change',label:'Possible state change · unverified',
    detail:`The reporter-asserted observations are ${diffMinutes} minutes apart. The operating state may have changed; no repair or causal sequence is established.`,differenceMinutes:diffMinutes};
  return {classification:'overlapping-reports',label:'Conflicting reports at similar times',
    detail:`The reporter-asserted times are ${diffMinutes} minutes apart. Confirm they refer to the same equipment and precise conditions.`,differenceMinutes:diffMinutes};
}

Object.assign(module.exports,{extractOnsetCue,assessOpposingStates});
},
"geo":function(module,require){
/**
 * Unverified user-positioned reports, independent of the fictional Nandipur pilot.
 * We propose evidence leads, never causal conclusions or official incidents.
 */
const {createHash}=require("node:crypto");
const {extractEvidence}=require("./intelligence.js");
const {SYMPTOMS}=require("./catalog.js");
const {extractOnsetCue,assessOpposingStates}=require("./temporal.js");

const MAX_LAT=85.05112878; // Web Mercator viewport limit
const HOUR=60*60*1000;
const TIME_WINDOW=48*HOUR;
const MAX_AGE=30*24*HOUR;

function bad(message){const e=new Error(message);e.status=400;return e;}
function validCoordinates(lat,lon){
  return typeof lat==='number'&&Number.isFinite(lat)&&Math.abs(lat)<=MAX_LAT&&
    typeof lon==='number'&&Number.isFinite(lon)&&lon>=-180&&lon<=180;
}
function normalizeUserLocation(data){
  if(!validCoordinates(data?.lat,data?.lon))throw bad('Place a valid location pin on the real map; speech cannot determine accurate coordinates.');
  if(!['map-pin','device-geolocation'].includes(data.locationMethod))throw bad('Location must be explicitly selected on the map or via browser location permission.');
  const accuracy=data.locationAccuracyMeters;
  if(accuracy!=null&&(typeof accuracy!=='number'||!Number.isFinite(accuracy)||accuracy<0||accuracy>100000))
    throw bad('Location accuracy must be a finite, nonnegative number of meters.');
  return {lat:Math.round(data.lat*1e6)/1e6,lon:Math.round(data.lon*1e6)/1e6,
    locationMethod:data.locationMethod,locationAccuracyMeters:accuracy==null?null:Math.round(accuracy),
    locationVerified:false,locationLabel:'User-supplied map pin (not independently verified)'};
}

/** Accepted timestamps have an explicit UTC offset; never infer a timezone on the server. */
function normalizeObservationTime(value,reportedAt=new Date().toISOString()){
  if(value==null||value==='')return null; // Unknown is valid and must remain unknown.
  if(typeof value!=='string')throw bad('Observation time must be an ISO timestamp with an explicit timezone, or left unknown.');
  const m=/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)(?::(\d\d)(?:\.\d{1,3})?)?(Z|[+-]\d\d:\d\d)$/.exec(value);
  if(!m)throw bad('Observation time needs a full date, clock time and explicit timezone.');
  const [year,month,day,hour,minute,second]=m.slice(1,7).map((v,i)=>v==null&&i===5?0:Number(v));
  const off=m[7];const offHour=off==='Z'?0:Number(off.slice(1,3)),offMin=off==='Z'?0:Number(off.slice(4,6));
  if(year<2000||month<1||month>12||day<1||day>new Date(Date.UTC(year,month,0)).getUTCDate()||hour>23||minute>59||second>59||offHour>14||offMin>59||(offHour===14&&offMin!==0))
    throw bad('Observation date or time is invalid.');
  const t=Date.parse(value),received=Date.parse(reportedAt);
  if(!Number.isFinite(t)||!Number.isFinite(received)||t>received+5*60*1000)
    throw bad('Observation time cannot be more than five minutes after the report was received.');
  if(t<received-MAX_AGE)throw bad('This pilot accepts observations from the last 30 days only.');
  return new Date(t).toISOString();
}

function greatCircleMeters(a,b){
  const rad=Math.PI/180,r=6371008.8,dPhi=(b.lat-a.lat)*rad,dLambda=(b.lon-a.lon)*rad;
  const x=Math.sin(dPhi/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLambda/2)**2;
  return 2*r*Math.asin(Math.min(1,Math.sqrt(x)));
}
function temporalCheck(a,b){
  const aObservation=a.observedAt||null,bObservation=b.observedAt||null;
  const basis=aObservation&&bObservation?'reported-observation-times':'submission-time-fallback';
  const t1=Date.parse(aObservation||a.reportedAt),t2=Date.parse(bObservation||b.reportedAt);
  const difference=Number.isFinite(t1)&&Number.isFinite(t2)?Math.abs(t1-t2):Infinity;
  return {basis,compatible:difference<=TIME_WINDOW,differenceHours:Number.isFinite(difference)?Math.round(difference/HOUR*10)/10:null,
    observationTimesKnown:!!(aObservation&&bObservation)};
}
/** Keep the originating words intact: follow-up answers are never rewritten into the first statement. */
function evidenceForLocatedReport(report){
  const original=extractEvidence(report.transcript||'');
  const excerpts=original.excerpts.map(e=>({...e,source:'original-reviewed-statement',sourceId:report.id}));
  const symptoms=[...original.symptoms];
  const uncertainty=[...original.uncertainty];
  const clarifications=Array.isArray(report.clarifications)?report.clarifications:[];
  for(const c of clarifications){
    if(c.questionKind!=='symptom' && c.questionKind!=='service-link')continue;
    if(c.transcription?.reviewed!==true)continue;
    const added=extractEvidence(c.answerTranscript);
    for(const excerpt of added.excerpts){
      excerpts.push({...excerpt,source:'reviewed-follow-up-answer',sourceId:c.id,questionKind:c.questionKind});
      if(!symptoms.includes(excerpt.symptom))symptoms.push(excerpt.symptom);
    }
  }
  if(symptoms.length) {
    // A later answer may resolve an earlier missing symptom, but the initial
    // statement's uncertainty remains part of the evidence provenance.
    return {...original,symptoms,excerpts,uncertainty,
      status:uncertainty.length?'partially-classified':'classified',
      methods:[...original.methods,'source-linked-clarification-v1']};
  }
  return {...original,symptoms,excerpts,uncertainty,status:'needs-clarification'};
}
function sourceFor(node,symptom){
  const hit=node.evidence.excerpts?.find(x=>x.symptom===symptom);
  return {reportId:node.id,symptom,quote:hit?.quote||null,source:hit?.source==='reviewed-follow-up-answer'?'reviewed-clarification':'reviewed-transcript',
    sourceId:hit?.sourceId||node.id,questionKind:hit?.questionKind||null};
}
function compared(a,b){
  if(!a.evidence.symptoms.length||!b.evidence.symptoms.length)return null;
  const distance=greatCircleMeters(a,b),time=temporalCheck(a,b);
  if(distance>250||!time.compatible)return null;
  // A highly imprecise device fix is not evidence that pins were geographically close.
  if([a,b].some(n=>n.locationMethod==='device-geolocation'&&n.locationAccuracyMeters!=null&&n.locationAccuracyMeters>250))return null;
  const pairs=a.evidence.symptoms.flatMap(x=>b.evidence.symptoms.map(y=>[x,y]));
  const opposite=pairs.find(([x,y])=>SYMPTOMS[x].family===SYMPTOMS[y].family&&SYMPTOMS[x].polarity!==SYMPTOMS[y].polarity);
  const same=pairs.find(([x,y])=>x===y);
  const related=pairs.find(([x,y])=>(x==='water-outage'&&['pump-failure','power-trip','power-loss'].includes(y))||
    (y==='water-outage'&&['pump-failure','power-trip','power-loss'].includes(x))||
    (x==='waterlogging'&&y==='drainage-blocked')||(y==='waterlogging'&&x==='drainage-blocked')||
    (x==='pump-failure'&&['power-trip','power-loss'].includes(y))||
    (y==='pump-failure'&&['power-trip','power-loss'].includes(x)));
  const opposition=opposite&&distance<=100?assessOpposingStates(a,b):null;
  const kind=opposition?(opposition.classification==='possible-state-change'?'possible-state-change':'contradiction'):
    same?'nearby-same-symptom':related?'nearby-cross-symptom':null;
  if(!kind)return null;
  const pair=opposition?opposite:kind==='nearby-same-symptom'?same:related;
  const id=`GEO-${[a.id,b.id].sort().join('~')}`;
  const fingerprint=createHash('sha256').update(JSON.stringify([
    'user-pin-evidence-v4',id,kind,a.id,a.transcript,a.lat,a.lon,a.observedAt||null,a.reportedAt,a.locationAccuracyMeters||null,
    b.id,b.transcript,b.lat,b.lon,b.observedAt||null,b.reportedAt,b.locationAccuracyMeters||null,
    a.clarifications||[],b.clarifications||[]
  ])).digest('hex').slice(0,24);
  return {id,from:a.id,to:b.id,kind,distanceMeters:Math.round(distance),timeDifferenceHours:time.differenceHours,
    temporalBasis:time.basis,observationTimesKnown:time.observationTimesKnown,evidenceVersion:fingerprint,
    status:'unverified-candidate',ruleId:'user-pin-evidence-v4',temporalAssessment:opposition,
    reason:opposition?opposition.detail:
      kind==='nearby-same-symptom'?'Similar symptoms at nearby user-supplied pins; independent events remain possible.':
      'Different symptoms reported near one another; an infrastructure relationship is only a question for investigation.',
    sources:[sourceFor(a,pair[0]),sourceFor(b,pair[1])],checks:[
      {label:'Position proximity',result:'candidate',detail:`Pins are approximately ${Math.round(distance)} m apart; neither position is independently authenticated.`},
      {label:'Time compatibility',result:time.observationTimesKnown?'candidate':'unknown',detail:time.observationTimesKnown?`Reporter-stated observation times differ by ${time.differenceHours} hours.`:'At least one observation time is unknown. Receipt times are only a conservative candidate filter.'},
      {label:'Relative onset in speech',result:a.temporalCue||b.temporalCue?'candidate':'unknown',
        detail:[a,b].map(n=>n.temporalCue?`${n.id}: ${n.temporalCue.sourcePhrase} (approximate, not an exact time)`:`${n.id}: not stated`).join('; ')},
      {label:'Semantic connection',result:'candidate',detail:opposition?'Opposing operational states; neither current status nor a change of status is verified.':kind==='nearby-same-symptom'?'Similar reported symptoms.':'A possible link between distinct reported symptoms; no verified service topology.'},
      {label:'Independent verification',result:'unknown',detail:'Neither location, service-network connection nor incident cause has been independently verified.'}
    ],
    caveats:[
      time.observationTimesKnown?'Observation times are reporter-supplied and unverified.':'The time of the incident is unknown for at least one report; submission times are not observation times.',
      'Coordinates are reporter-supplied and may be wrong.',
      'Geographic closeness alone cannot establish a common cause.',
      ...(opposition?['Opposing descriptions do not establish a same-asset contradiction or a repair event.']:[])
    ]};
}
function investigationGroups(nodes,links){
  const active=links.filter(e=>!['contradiction','possible-state-change'].includes(e.kind)&&!['rejected-link','stale-rejected-link'].includes(e.status));
  const adj=new Map();
  for(const edge of active){for(const id of [edge.from,edge.to])if(!adj.has(id))adj.set(id,new Set());adj.get(edge.from).add(edge.to);adj.get(edge.to).add(edge.from);}
  const visited=new Set(),groups=[];
  for(const id of adj.keys()){
    if(visited.has(id))continue;
    const stack=[id],memberIds=[];
    while(stack.length){const cur=stack.pop();if(visited.has(cur))continue;visited.add(cur);memberIds.push(cur);stack.push(...(adj.get(cur)||[]));}
    if(memberIds.length<2)continue;
    memberIds.sort();const within=active.filter(e=>memberIds.includes(e.from)&&memberIds.includes(e.to));
    const members=nodes.filter(n=>memberIds.includes(n.id));
    const contested=links.filter(e=>['contradiction','possible-state-change'].includes(e.kind)&&memberIds.includes(e.from)&&memberIds.includes(e.to));
    const observedKnown=members.filter(n=>n.observedAt).length;
    groups.push({id:'GROUP-'+createHash('sha256').update(memberIds.join('|')).digest('hex').slice(0,10),memberIds,
      edgeIds:within.map(x=>x.id),linkCount:within.length,contestedEdgeIds:contested.map(e=>e.id),
      reviewPending:within.filter(e=>e.status==='unverified-candidate').length,
      observationTimesKnown:observedKnown,reportCount:members.length,
      symptoms:[...new Set(members.flatMap(n=>n.evidence.symptoms))],
      nextQuestion:observedKnown<members.length?'When did each reporter actually observe the issue?':
        'Does independent service-network evidence connect the affected locations?',
      status:'unverified-investigation-group',
      caveat:'This is a chain of suggested connections, not evidence that every report shares a single cause. A-B and B-C do not prove A-C.'});
  }
  return groups.sort((a,b)=>b.reportCount-a.reportCount||a.id.localeCompare(b.id));
}
function nextGeographicClarification(report){
  const lang=['hi-IN','bn-IN'].includes(report?.language)?report.language:'en-IN';
  const evidence=evidenceForLocatedReport(report);
  const symptomKnown=evidence.symptoms.length>0;
  const onset=extractOnsetCue(report?.transcript||'',report?.reportedAt,symptomKnown);
  const key=!symptomKnown?'symptom':!report?.observedAt?'observation-time':
    (report.locationMethod==='device-geolocation'&&report.locationAccuracyMeters>250)?'precise-location':'service-link';
  const templates={
    symptom:{'hi-IN':'कृपया बताएं, ठीक-ठीक क्या समस्या हुई थी?','bn-IN':'অনুগ্রহ করে বলুন, ঠিক কী সমস্যা হয়েছিল?','en-IN':'What exact problem did you observe?'},
    'observation-time':{'hi-IN':'आपने यह समस्या पहली बार कब देखी थी?','bn-IN':'আপনি প্রথম কখন সমস্যাটি লক্ষ্য করেছিলেন?','en-IN':'When did you first observe this problem?'},
    'precise-location':{'hi-IN':'क्या आप मानचित्र पर समस्या की सही जगह चुन सकते हैं?','bn-IN':'আপনি কি মানচিত্রে সমস্যার সঠিক জায়গাটি দেখাতে পারবেন?','en-IN':'Can you select a more precise location on the map?'},
    'service-link':{'hi-IN':'क्या आपको उस पंप या सेवा क्षेत्र का नाम पता है?','bn-IN':'আপনি কি সংশ্লিষ্ট পাম্প বা পরিষেবা এলাকার নাম জানেন?','en-IN':'Do you know the specific pump or service-area identifier?'}
  };
  const timeQuestion=onset?{
    'hi-IN':'आपने जो समय बताया, उसकी लगभग कितने बजे से शुरुआत हुई थी? क्या अभी भी समस्या जारी है?',
    'bn-IN':'আপনি যে সময়ের কথা বলেছেন, আনুমানিক কতটা থেকে সমস্যাটি শুরু হয়েছিল? এখনও কি চলছে?',
    'en-IN':'About what clock time did this begin, and is it still happening?'
  }[lang]:null;
  return {language:lang,kind:key,text:key==='observation-time'&&timeQuestion?timeQuestion:templates[key][lang],
    temporalCue:onset,requiresHumanAnswer:true,automaticSpeech:false};
}
/** Data from different users is intentionally not treated as officially verified. */
function buildGeographicState(reports=[],revision=0,reviews={}){
  const nodes=reports.map(saved=>{
    // Server-private retry fingerprints are never returned to the browser or public dossiers.
    const {submissionKeyHash,submissionFingerprint,...publicReport}=saved;
    const r=publicReport.clarifications?{...publicReport,
      clarifications:publicReport.clarifications.map(({submissionKeyHash,submissionFingerprint,...c})=>c)}:publicReport;
    const evidence=evidenceForLocatedReport(r);
    const firstOnset=extractOnsetCue(r.transcript,r.reportedAt,evidence.symptoms.length>0);
    const sourcedAnswer=(r.clarifications||[]).filter(c=>c.questionKind==='observation-time').map(c=>({
      sourceId:c.id,language:c.language,cue:extractOnsetCue(c.answerTranscript,r.reportedAt,evidence.symptoms.length>0)}))
      .find(x=>x.cue);
    const cue=firstOnset|| (sourcedAnswer?{...sourcedAnswer.cue,source:'reviewed-clarification',
      sourceId:sourcedAnswer.sourceId,language:sourcedAnswer.language}:null);
    return {...r,observedAt:r.observedAt??null,
    evidence,temporalCue:cue,
    sourceVerified:r.transcription?.reviewed===true};});
  const links=[];
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
    if(!nodes[i].sourceVerified||!nodes[j].sourceVerified)continue;
    const link=compared(nodes[i],nodes[j]);if(!link)continue;
    const decision=reviews[link.id];if(decision){
      const stale=decision.evidenceVersion!==link.evidenceVersion;
      link.reviewStale=stale;link.previousDecision=decision.status;
      if(stale&&decision.status==='rejected-link')link.status='stale-rejected-link';
      if(!stale){link.status=decision.status;link.reviewerNote=decision.note||'';link.reviewedAt=decision.reviewedAt;}
    }
    links.push(link);
  }
  const groups=investigationGroups(nodes,links);
  return {revision,source:'local-user-submissions',verifiedOfficialFeed:false,nodes,links,groups,
    stats:{reports:nodes.length,unverifiedLinks:links.filter(e=>['unverified-candidate','stale-rejected-link'].includes(e.status)).length,
      rejectedLinks:links.filter(e=>e.status==='rejected-link').length,groups:groups.length,
      unclear:nodes.filter(n=>!n.evidence.symptoms.length).length,unknownObservationTimes:nodes.filter(n=>!n.observedAt).length},
    warning:'Real OpenStreetMap geography; reports and their times remain user-supplied. Investigation groups represent unverified link chains, not official incidents or confirmed root causes.'};
}

Object.assign(module.exports,{validCoordinates,normalizeUserLocation,normalizeObservationTime,greatCircleMeters,evidenceForLocatedReport,nextGeographicClarification,buildGeographicState});
}};
const __cache={};function __require(name){if(name==='node:crypto')return {createHash};const key=name.replace('./','').replace('.js','');if(!__modules[key])throw Error('Unknown bundled module '+name);if(!__cache[key]){const module={exports:{}};__cache[key]=module;__modules[key](module,__require);}return __cache[key].exports;}
const __geo=__require('./geo.js'),__intel=__require('./intelligence.js');
export const {buildGeographicState,normalizeUserLocation,normalizeObservationTime,nextGeographicClarification}=__geo;
export const {extractEvidence}=__intel;
export {sha256};
