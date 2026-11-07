// WardLens browser-private investigation helpers. No network access, no claims of verification.
export const WORKSPACE_SCHEMA = 'awaazgraph.browser-workspace.v1';
export const MAX_WORKSPACE_REPORTS = 30;
export const MAX_WORKSPACE_AGE_MS = 30 * 86400000;

const clean = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase().trim();
const isVoice = node => ['gnani-reviewed','gnani-edited'].includes(node.transcription?.provider);
const isDismissed = link => ['rejected-link','stale-rejected-link'].includes(link.status);

export function investigationSummary(nodes = [], links = []) {
  const candidateLinks=links.filter(link=>!isDismissed(link));
  const unresolved=nodes.filter(node=>node.evidence?.status==='needs-clarification'||!(node.evidence?.symptoms||[]).length);
  const voiceCount=nodes.filter(isVoice).length;
  const conflicts=candidateLinks.filter(link=>link.kind==='contradiction').length;
  const unknownTime=nodes.filter(node=>!node.observedAt).length;
  const topics = new Map();
  for (const node of nodes) for (const symptom of new Set(node.evidence?.symptoms||[])) topics.set(symptom,(topics.get(symptom)||0)+1);
  const topTopics=[...topics.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,4).map(([name,count])=>({name,count}));
  let next={title:'Start with a firsthand report',body:'Speak or type one observation, review it, and place its location on the map.',action:'capture',label:'Add a report'};
  if(nodes.length && unresolved.length) next={title:`${unresolved.length} report${unresolved.length>1?'s':''} need more detail`,body:'Clarify an unclear observation before drawing conclusions from it.',action:'clarify',label:'Review missing details'};
  else if(conflicts) next={title:`${conflicts} conflicting report${conflicts>1?'s':''} need review`,body:'Compare opposing statements. A conflict is not proof that either report is wrong.',action:'conflicts',label:'Inspect conflicting evidence'};
  else if(candidateLinks.length) next={title:`${candidateLinks.length} possible connection${candidateLinks.length>1?'s':''} to inspect`,body:'Compare source quotations and time/location checks before accepting any interpretation.',action:'links',label:'Inspect connections'};
  else if(nodes.length) next={title:'Build a stronger evidence picture',body:'Add another independent observation nearby, or include the actual observation time if known.',action:'capture',label:'Add another report'};
  return {reports:nodes.length,candidates:candidateLinks.length,unclear:unresolved.length,conflicts,voiceCount,unknownTime,topics:topTopics,next};
}

export function filterInvestigation(nodes = [], links = [], options = {}) {
  const query=clean(options.query).slice(0,160);
  const filter=options.filter||'all';
  const linkIds=new Set(links.filter(link=>!isDismissed(link)).flatMap(link=>[link.from,link.to]));
  const conflictIds=new Set(links.filter(link=>link.kind==='contradiction'&&!isDismissed(link)).flatMap(link=>[link.from,link.to]));
  const matched=nodes.filter(node=>{
    const criteria=filter==='all'||
      (filter==='unclear' && (node.evidence?.status==='needs-clarification'||!(node.evidence?.symptoms||[]).length))||
      (filter==='connected' && linkIds.has(node.id))||
      (filter==='conflicts' && conflictIds.has(node.id))||
      (filter==='voice' && isVoice(node))||
      (filter==='typed' && !isVoice(node));
    if(!criteria) return false;
    return !query || clean([node.transcript,node.language,node.id,...(node.evidence?.symptoms||[])].join(' ')).includes(query);
  });
  const ids=new Set(matched.map(x=>x.id));
  return {nodes:matched,links:links.filter(link=>ids.has(link.from)&&ids.has(link.to)),total:nodes.length};
}

const allowedId = id => typeof id==='string' && /^G-[a-zA-Z0-9-]{8,45}$/.test(id);
const validTime = (value,now,canBeNull=false) => canBeNull&&value==null ||
  typeof value==='string' && Number.isFinite(Date.parse(value)) && Date.parse(value)<=now+300000 && Date.parse(value)>=now-MAX_WORKSPACE_AGE_MS;
const validText = text => typeof text==='string' && text.trim().length>=4 && text.length<=1000;
const validRevision = (r,now) => r && typeof r==='object' && !Array.isArray(r) &&
 validText(r.previousTranscript) && ['manual-reviewed','gnani-reviewed','gnani-edited'].includes(r.previousProvider) &&
 typeof r.reason==='string' && r.reason.trim().length>=8 && r.reason.length<=200 && validTime(r.changedAt,now);
const validAnswer = c => c && typeof c==='object' && !Array.isArray(c)&&
  typeof c.id==='string'&&/^C-[a-zA-Z0-9-]{8,45}$/.test(c.id)&&validText(c.answerTranscript)&&
  typeof c.question==='string'&&c.question.length<=1000&&
  ['hi-IN','bn-IN','en-IN'].includes(c.language)&&c.transcription?.reviewed===true &&
  ['manual','gnani-reviewed','gnani-edited'].includes(c.transcription.provider);
export function validatePrivateBackup(data,{now=Date.now()}={}) {
  if(!data||typeof data!=='object'||Array.isArray(data)||data.schema!==WORKSPACE_SCHEMA||!Array.isArray(data.reports)||data.reports.length>MAX_WORKSPACE_REPORTS) throw Error('Not a compatible WardLens private backup.');
  const ids=new Set();
  const reports=data.reports.map(value=>{
    if(!value||typeof value!=='object'||Array.isArray(value)||!allowedId(value.id)||ids.has(value.id)||
      !validText(value.transcript)||!['hi-IN','bn-IN','en-IN'].includes(value.language)||
      !validTime(value.reportedAt,now)||!validTime(value.observedAt,now,true)||
      !Number.isFinite(value.lat)||Math.abs(value.lat)>85.05||!Number.isFinite(value.lon)||Math.abs(value.lon)>180||
      !['map-pin','device-geolocation'].includes(value.locationMethod)||value.consentAttested!==true||
      value.transcription?.reviewed!==true||!['manual-reviewed','gnani-reviewed','gnani-edited'].includes(value.transcription.provider)||
      (value.clarifications != null && (!Array.isArray(value.clarifications)||value.clarifications.length>5||value.clarifications.some(c=>!validAnswer(c))))||
      (value.revisions != null && (!Array.isArray(value.revisions)||value.revisions.length>5||value.revisions.some(r=>!validRevision(r,now)))))
        throw Error('Backup contains an invalid, duplicate, or expired report.');
    ids.add(value.id);
    // Explicit allowlist, never preserve arbitrary keys from an untrusted file.
    return {id:value.id,transcript:value.transcript,language:value.language,lat:value.lat,lon:value.lon,
      reportedAt:value.reportedAt,observedAt:value.observedAt??null,locationMethod:value.locationMethod,
      locationAccuracyMeters:Number.isFinite(value.locationAccuracyMeters)&&value.locationAccuracyMeters>=0&&value.locationAccuracyMeters<=100000?value.locationAccuracyMeters:null,
      source:'user-browser-submission',consentAttested:true,
      transcription:{provider:value.transcription.provider,reviewed:true,model:typeof value.transcription.model==='string'?value.transcription.model.slice(0,80):null},
      revisions:(value.revisions||[]).map(r=>({previousTranscript:r.previousTranscript,previousProvider:r.previousProvider,reason:r.reason,changedAt:r.changedAt})),
      clarifications:(value.clarifications||[]).map(c=>({id:c.id,question:c.question,questionKind:typeof c.questionKind==='string'?c.questionKind.slice(0,60):null,
        answerTranscript:c.answerTranscript,language:c.language,reportedAt:validTime(c.reportedAt,now,true)?c.reportedAt:null,
        transcription:{provider:c.transcription.provider,reviewed:true,model:typeof c.transcription.model==='string'?c.transcription.model.slice(0,80):null}}))};
  });
  const reviews=Object.create(null);
  if(data.reviews!=null){
    if(typeof data.reviews!=='object'||Array.isArray(data.reviews)||Object.keys(data.reviews).length>120)throw Error('Invalid review decisions in backup.');
    for(const [id,decision] of Object.entries(data.reviews)){
      if(!/^GEO-G-[a-zA-Z0-9~-]{8,110}$/.test(id)||!decision||!['rejected-link','stale-rejected-link'].includes(decision.status)||typeof decision.evidenceVersion!=='string'||decision.evidenceVersion.length>100)
        throw Error('Invalid relationship review in backup.');
      reviews[id]={status:'rejected-link',note:'Dismissed in restored private backup; not a verification.',evidenceVersion:decision.evidenceVersion,reviewedAt:validTime(decision.reviewedAt,now,true)?decision.reviewedAt:null};
    }
  }
  return {reports,reviews};
}

export function createPrivateBackup(reports,reviews){return {schema:WORKSPACE_SCHEMA,exportedAt:new Date().toISOString(),notice:'Private browser-only, unverified reporter assertions. Contains full transcript and precise reporter-supplied coordinates. Handle securely.',reports,reviews};}

export function createRedactedBriefing(graph,now=new Date()) {
  const info=investigationSummary(graph.nodes||[],graph.links||[]);
  const day=now.toISOString().slice(0,10);
  const top=info.topics.length?info.topics.map(item=>`- ${item.name.replace(/[^\w-]/g,'')}: ${item.count} report(s)`).join('\n'):'- No classified topics yet';
  return `# WardLens | Private investigation brief\n\nGenerated: ${day} (UTC day)\n\n> Browser-local, unverified reporter statements only. NOT an official incident report or verified root-cause finding.\n\n## At a glance\n\n- Reports in this browser: ${info.reports}\n- Possible non-dismissed connections: ${info.candidates}\n- Conflicting candidates: ${info.conflicts}\n- Reports requiring clarification: ${info.unclear}\n- Reports without confirmed observation time: ${info.unknownTime}\n- Reports with Gnani-assisted transcript reviewed by a human: ${info.voiceCount}\n\n## Topics mentioned (not verified occurrences)\n\n${top}\n\n## Recommended next investigation step\n\n${info.next.title}. ${info.next.body}\n\n## Evidence boundary\n\n- Individual statements, exact quotes, personal map coordinates, and report IDs are deliberately omitted.\n- Nearby locations and compatible wording do not prove a shared cause.\n- No reports are automatically transmitted to authorities or other visitors.\n- Only the private JSON backup includes original evidence, if explicitly exported.\n`;
}

/**
 * A browser-user correction, never a new model transcription or a verified incident.
 * Keeps prior words and attribution in a private local audit trail. A corrected report
 * with existing follow-ups would change their context, so that operation is refused.
 */
export function applyReportCorrection(report,newText,reason,at=new Date().toISOString()){
 if(!report || typeof report!=='object' || !validText(newText))throw Error('Correction must be a reviewed statement of 4–1000 characters.');
 const updated=newText.trim(),why=String(reason??'').trim();
 if(updated===report.transcript.trim())throw Error('The corrected statement must differ from the saved text.');
 if(why.length<8||why.length>200)throw Error('Explain the correction in 8–200 characters.');
 if((report.clarifications||[]).length)throw Error('This report has follow-up answers. Create a new report to preserve their original context.');
 const prior=Array.isArray(report.revisions)?report.revisions:[];
 if(prior.length>=5)throw Error('Maximum five corrections per report. Create a new report.');
 if(!Number.isFinite(Date.parse(at)))throw Error('Correction timestamp is invalid.');
 const previousProvider=report.transcription?.provider||'manual-reviewed';
 const provider=previousProvider.startsWith('gnani')?'gnani-edited':'manual-reviewed';
 return {...report,transcript:updated,
  transcription:{...report.transcription,provider,reviewed:true},
  revisions:[...prior,{previousTranscript:report.transcript,previousProvider,reason:why,changedAt:at}]};
}
