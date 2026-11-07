import {recordingToWav,wavToBase64} from './audio-wav.js';
import {GeoTileMap} from './geo-map.js';
import {assessReportScope} from './report-scope.js';
import {EvidenceGraph} from './evidence-graph.js';
import {buildGeographicState,normalizeUserLocation,normalizeObservationTime,nextGeographicClarification,extractEvidence} from './engine.js';
import {investigationSummary,filterInvestigation,validatePrivateBackup,createPrivateBackup,createRedactedBriefing,applyReportCorrection} from './workspace-model.js';

// Evidence and report coordinates remain in this browser. Short audio, when explicitly
// consented, goes to the same-origin protected Gnani STT endpoint; no reports are uploaded.
const KEY='awaazgraph:browser-workspace:v1';
const uuid=()=>{if(typeof crypto.randomUUID==='function')return crypto.randomUUID();const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');};
const MAX_REPORTS=30,MAX_AGE=30*86400000;
const $=id=>document.getElementById(id);
const txt=(node,value)=>{node.textContent=String(value??'');return node;};
const el=(type,className='',value=null)=>{const node=document.createElement(type);if(className)node.className=className;if(value!=null)txt(node,value);return node;};
const human={
 'water-outage':'No water supply','water-restored':'Water supply working','pump-failure':'Pump not working',
 'pump-operating':'Pump working','power-trip':'Power interruption','power-loss':'Motor power loss',
 'power-normal':'Electricity restored','waterlogging':'Waterlogging','drainage-blocked':'Blocked drain'
};
const labelSymptom=s=>human[s]||String(s||'Unclassified').replaceAll('-',' ');
const kindLabel=k=>({
 'nearby-cross-symptom':'Different symptoms nearby','nearby-same-symptom':'Similar issues nearby',
 'possible-state-change':'Possible state change','contradiction':'Conflicting reports'
}[k]||k);
const reportDate=v=>{try{return new Date(v).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});}catch{return 'Unknown';}};
const selected={type:null,id:null};
let reports=[],reviews={},pin=null,persist=false,geoRevision=0,voice=null,voiceUrl=null,voiceTimer=null;
let current=null;
let voiceTranscript=null; // Transcript produced by Gnani; may be explicitly edited by the reporter.
let cancellingVoice=false;
let voiceAvailable=false;
let followupRecorder=null, followupTimer=null, followupStream=null, followupCancelled=false;
let activeView='report';
let mapLocationManuallyChanged=false;
let currentDeviceFix=null; // Only in this open browser tab; never sent to place-search provider.
function switchView(view,{scroll=true}={}){
 if(!['report','explore'].includes(view))return;
 activeView=view;
 for(const mode of ['report','explore']){
  const open=mode===view;
  $(`${mode}-view`).hidden=!open;
  const tab=$(`tab-${mode}`);
  tab.classList.toggle('is-selected',open);
  tab.setAttribute('aria-selected',String(open));
  tab.tabIndex=open?0:-1;
  document.querySelector(`.nav-${mode}`)?.classList.toggle('is-current',open);
 }
 if(scroll){const narrow=window.matchMedia?.('(max-width:580px)').matches;const destination=(view==='report'&&narrow)?$('voice-box'):$('workspace');destination.scrollIntoView({behavior:'smooth',block:'start'});}
}
function renderDraftPreview(){
 const host=$('draft-preview-result');host.replaceChildren();
 const statement=$('report-text').value.trim();
 if(!statement){host.append(el('span','', 'Speak or type an observation to see what can be supported by your words.'));return;}
 const result=extractEvidence(statement);
 const scope=assessReportScope(statement,result);
 if(scope.status==='out-of-scope'){
  host.append(el('strong','', 'Outside WardLens reporting scope.'),el('p','',scope.reason));return;
 }
 if(scope.status==='clarify'){
  host.append(el('strong','', 'Firsthand observation required.'),el('p','',scope.reason));return;
 }
 if(!result.symptoms.length){
  host.append(el('strong','', 'Possible civic issue — needs details.'),el('p','',scope.reason));return;
 }
 const tags=el('div','');tagged(result.symptoms,tags);host.append(tags);
 for(const excerpt of result.excerpts.slice(0,3)){
  const source=el('blockquote','',`“${excerpt.quote}”`);host.append(source);
 }
 if(result.uncertainty?.length)host.append(el('p','', 'Some wording may remain uncertain. Review the exact statement before saving.'));
}
for(const tab of document.querySelectorAll('[data-view]'))tab.addEventListener('click',()=>switchView(tab.dataset.view));
for(const link of document.querySelectorAll('[data-open-view]'))link.addEventListener('click',event=>{
 event.preventDefault();switchView(link.dataset.openView);
});
$('new-report-button').addEventListener('click',()=>switchView('report'));
// ARIA tablist keyboard navigation: Tab enters the selected tab; arrow keys switch views.
document.querySelector('.view-tabs').addEventListener('keydown',event=>{
 const keys=['ArrowLeft','ArrowRight','Home','End'];if(!keys.includes(event.key))return;
 event.preventDefault();const next=event.key==='Home'?'report':event.key==='End'?'explore':activeView==='report'?'explore':'report';
 switchView(next,{scroll:false});$(`tab-${next}`).focus();
});

function toast(message){const box=$('toast');txt(box,message);box.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>box.hidden=true,3500);}
function allowedReport(r){return r&&typeof r.id==='string'&&/^G-[a-zA-Z0-9-]{8,45}$/.test(r.id)&&
 typeof r.transcript==='string'&&r.transcript.trim().length>0&&r.transcript.length<=1000&&
 ['hi-IN','bn-IN','en-IN'].includes(r.language)&&
 typeof r.reportedAt==='string'&&Number.isFinite(Date.parse(r.reportedAt))&&Date.now()-Date.parse(r.reportedAt)<MAX_AGE&&
 Number.isFinite(r.lat)&&Math.abs(r.lat)<=85.05&&Number.isFinite(r.lon)&&Math.abs(r.lon)<=180&&
 ['map-pin','device-geolocation'].includes(r.locationMethod)&&
 r.transcription?.reviewed===true&&r.consentAttested===true&&
 (!Array.isArray(r.clarifications)||(r.clarifications.length<=5&&r.clarifications.every(c=>
 typeof c.answerTranscript==='string'&&c.answerTranscript.length<=1000&&c.transcription?.reviewed===true)))&&
 (!r.revisions||(Array.isArray(r.revisions)&&r.revisions.length<=5&&r.revisions.every(v=>
 typeof v.previousTranscript==='string'&&v.previousTranscript.length<=1000&&
 typeof v.reason==='string'&&v.reason.length>=8&&v.reason.length<=200&&
 ['manual-reviewed','gnani-reviewed','gnani-edited'].includes(v.previousProvider)&&Number.isFinite(Date.parse(v.changedAt)))));
}
function load(){try{const raw=localStorage.getItem(KEY);if(!raw)return;const item=JSON.parse(raw);
 if(item?.version!==1||!Array.isArray(item.reports)||item.reports.length>MAX_REPORTS||item.reports.some(r=>!allowedReport(r)))throw Error('Invalid stored report data');
 reports=item.reports;reviews=item.reviews&&typeof item.reviews==='object'&&!Array.isArray(item.reviews)?item.reviews:{};
 persist=true;$('remember-device').checked=true;
 }catch{try{localStorage.removeItem(KEY);}catch{}reports=[];reviews={};toast('Invalid stored data was not loaded.');}}
function persistState(){if(!persist){try{localStorage.removeItem(KEY);}catch{}return;}
 try{localStorage.setItem(KEY,JSON.stringify({version:1,reports,reviews}));}
 catch{persist=false;$('remember-device').checked=false;toast('Browser storage is unavailable. Your reports remain active in this tab only.');}
}
function state(){return buildGeographicState(reports,geoRevision,reviews);}
const map=new GeoTileMap($('live-map'),{
 onPick(pt){mapLocationManuallyChanged=true;pin={...pt,locationMethod:'map-pin',locationAccuracyMeters:null};updatePin();setMapLocationStatus('Map pin selected manually. Review the reported position before saving.');toast('Location selected. Now save your report.');$('report-text').focus({preventScroll:true});},
 onReport(id){pick('report',id);},onLink(id){pick('link',id);},onViewChange(zoom){txt($('zoom-level'),`${zoom}×`);}
});
const graph=new EvidenceGraph($('evidence-network'),{onReport(id){pick('report',id);},onLink(id){pick('link',id);}});
function updatePin(){const box=$('pin-summary');if(!pin){txt(box,'No location selected. Click “Choose on map”, then click a street position.');box.classList.remove('filled');map.setPicked(null);refreshProximity();return;}
 txt(box,`Selected pin · ${pin.lat.toFixed(5)}, ${pin.lon.toFixed(5)} · ${pin.locationMethod==='device-geolocation'?'Device position':'Map click'} (unverified)`);
 box.classList.add('filled');map.setPicked(pin);refreshProximity();
}
function pick(type,id){cancelFollowupRecording();selected.type=type;selected.id=id;switchView('explore',{scroll:false});render();$('evidence-inspector').scrollIntoView({behavior:'smooth',block:'nearest'});}
function detail(label,value){const row=el('div','detail-row');row.append(el('span','',label),el('strong','',value));return row;}
function tagged(items,container){items.forEach(value=>container.append(el('span','tag',labelSymptom(value))));}
function action(label,fn,classes='secondary'){const b=el('button',`btn small ${classes}`,label);b.type='button';b.addEventListener('click',fn);return b;}
function chosenText(report){return report.transcript.length>75?report.transcript.slice(0,75)+'…':report.transcript;}
function renderReportList(g){
 const host=$('report-list');host.replaceChildren();
 const filtered=filterInvestigation(g.nodes,g.links,{query:$('library-search').value,filter:$('library-filter').value});
 txt($('library-results-note'),`${filtered.nodes.length} of ${filtered.total} report${filtered.total===1?'':'s'} · Browser-private · Unverified`);
 if(!filtered.nodes.length){host.append(el('p','empty-state',g.nodes.length?'No reports match these filters. Change the search or show all reports.':'No reports yet. Add your first one using the form above.'));return;}
 for(let i=filtered.nodes.length-1;i>=0;i--){
  const r=filtered.nodes[i],b=el('button','report-item'+(selected.type==='report'&&selected.id===r.id?' selected':''));b.type='button';
  const number=el('span','report-num',String(g.nodes.indexOf(r)+1).padStart(2,'0')),body=el('div');
  const status=r.evidence.status==='needs-clarification'?'Needs details':r.transcription?.provider?.startsWith('gnani')?'Voice-reviewed':'Source reviewed';
  const heading=el('div','report-item-heading');heading.append(el('strong','',r.evidence.symptoms.map(labelSymptom).join(' + ')||'Needs clarification'),el('span',`mini-state ${status==='Needs details'?'needs-details':''}`,status));
  body.append(heading,el('p','',chosenText(r)),el('small','',`${r.language} · ${reportDate(r.reportedAt)} · User pin, unverified`));
  b.append(number,body);b.addEventListener('click',()=>pick('report',r.id));host.append(b);
 }
 if(filtered.links.length){host.append(el('div','subsection','POSSIBLE RELATIONSHIPS'));
  for(const link of filtered.links){const b=el('button','link-item'+(selected.type==='link'&&selected.id===link.id?' selected':''));b.type='button';
   b.append(el('span','',kindLabel(link.kind)),el('span','',link.status==='rejected-link'?'Dismissed here':`${link.distanceMeters} m · Inspect`));b.addEventListener('click',()=>pick('link',link.id));host.append(b);}
 }
}
function updateInsight(g){
 const overview=investigationSummary(g.nodes,g.links);
 txt($('insight-reports'),overview.reports);txt($('insight-links'),overview.candidates);txt($('insight-unclear'),overview.unclear);txt($('insight-voice'),overview.voiceCount);
 txt($('insight-next-title'),overview.next.title);txt($('insight-next-body'),overview.next.body);txt($('insight-next-action'),overview.next.label);
 $('insight-next-action').dataset.target=overview.next.action;
 $('export-brief').disabled=!g.nodes.length;
}
function renderReportInspector(report){const host=$('evidence-inspector');host.replaceChildren();
 host.append(el('h4','',report.evidence.symptoms.map(labelSymptom).join(' + ')||'Needs clarification'));
 const flags=el('div');tagged(report.evidence.symptoms,flags);if(report.evidence.status==='needs-clarification')flags.append(el('span','tag alert','Missing details'));
 host.append(flags,el('div','quote-card',report.transcript));
 host.append(detail('Source',report.transcription?.provider==='gnani-reviewed'?'Gnani Prisma transcription · human reviewed':report.transcription?.provider==='gnani-edited'?'Gnani-assisted · transcript edited by reporter':'Typed/reviewed by this browser user'),detail('Location',`${report.lat.toFixed(5)}, ${report.lon.toFixed(5)} · Unverified`),detail('Device proximity',['within-300m-device-estimate','within-100m-device-estimate'].includes(report.proximityVerification?.status)?('Estimated within '+(report.proximityVerification.status==='within-100m-device-estimate'?'100':'300')+' m ('+report.proximityVerification.distanceMeters+' m; GPS ±'+report.proximityVerification.gpsAccuracyMeters+' m). Not independently verified.'):'Not verified by device GPS.'),detail('Submitted',reportDate(report.reportedAt)),detail('Observed',report.observedAt?reportDate(report.observedAt):'Unknown'));
 if(report.evidence.excerpts.length){host.append(el('div','subsection','SOURCE QUOTES'));
  report.evidence.excerpts.forEach(e=>{const box=el('div','quote-card');box.append(el('span','tag',labelSymptom(e.symptom)),el('p','',`“${e.quote}”`),el('div','small-muted',e.source==='reviewed-follow-up-answer'?'Reviewed clarification':'Original reviewed statement'));host.append(box);});
 }else host.append(el('p','note','No supported symptom extracted. A clarification can supply additional evidence.'));
 if(report.clarifications?.length){host.append(el('div','subsection','CLARIFICATIONS'));
  report.clarifications.forEach(c=>{const item=el('div','quote-card');item.append(el('div','small-muted',c.transcription?.provider?.startsWith('gnani')?'Gnani-assisted · reviewed by reporter':'Typed answer · reviewed by reporter'),el('p','',c.question),el('strong','',c.answerTranscript));host.append(item);});
 }
 if(report.clarifications?.length<5 || !report.clarifications){
  const q=nextGeographicClarification(report),box=el('div','clarify-box');
  box.append(el('label','', 'Follow-up question'),el('p','',q.text));
  const input=el('textarea','clarify-input');input.id='clarify-answer';input.maxLength=1000;input.rows=3;input.placeholder='Type the reporter’s reviewed response';
  box.append(input);
  let originalVoiceAnswer=null;
  const controls=el('div','followup-voice-controls');
  const consent=el('label','checkline followup-voice-permission');
  const consentBox=el('input');consentBox.type='checkbox';consent.append(consentBox,el('span','', 'I agree to send this short answer to Gnani for transcription. Audio is not retained by WardLens.'));
  const voiceButtons=el('div','button-row');
  let latestFollowupClip=null;
  const speak=action('Record answer with Gnani',async()=>{
   if(originalVoiceAnswer&&input.value.trim()===originalVoiceAnswer.transcript)input.value='';
   originalVoiceAnswer=null;latestFollowupClip=null;retryAnswer.hidden=true;
   await recordFollowupAnswer({language:report.language,consent:consentBox,field:input,status:voiceStatus,start:speak,stop,
    onCaptured:clip=>{latestFollowupClip=clip;},onFailure:e=>{retryAnswer.hidden=isVoiceQuotaError(e)||isUpstreamRateLimit(e);},onSuccess:()=>{retryAnswer.hidden=true;}});
  });
  const stop=action('Stop & transcribe answer',()=>{if(followupRecorder?.state==='recording')followupRecorder.stop();});stop.disabled=true;
  const retryAnswer=action('Retry answer transcription',async()=>{
   if(!latestFollowupClip||!input.isConnected)return;
   if(!consentBox.checked){txt(voiceStatus,'Please confirm voice consent before retrying.');return;}
   retryAnswer.disabled=true;speak.disabled=true;
   try{
    const result=await requestGnaniTranscription(latestFollowupClip,report.language,message=>{if(input.isConnected)txt(voiceStatus,message);});
    if(!input.isConnected)return;input.value=result.transcript;
    controls.dispatchEvent(new CustomEvent('wardlens:followup-transcribed',{detail:result}));
    retryAnswer.hidden=true;txt(voiceStatus,'Follow-up transcription received. Review it before saving.');
   }catch(error){if(input.isConnected){if(isVoiceQuotaError(error)||isUpstreamRateLimit(error)){showQuotaError(error);retryAnswer.hidden=true;txt(voiceStatus,explainQuota(error));}else txt(voiceStatus,(error.message||'Transcription failed.')+' You can retry again or type your answer.');}}
   finally{retryAnswer.disabled=false;if(input.isConnected)speak.disabled=!voiceAvailable;}
  });retryAnswer.hidden=true;
  const voiceStatus=el('div','followup-voice-status',voiceAvailable?'Optional: answer by voice, then review the text.':'Voice unavailable. Type your answer instead.');voiceStatus.setAttribute('role','status');
  voiceButtons.append(speak,stop,retryAnswer);controls.append(consent,voiceButtons,voiceStatus);
  // Keep a private local copy of the verbatim model text to distinguish edits.
  input.addEventListener('input',()=>{if(originalVoiceAnswer&&input.value.trim()!==originalVoiceAnswer.transcript)txt(voiceStatus,'Edited after Gnani transcription. Your final words will be attributed to you.');});
  controls.addEventListener('wardlens:followup-transcribed',e=>{originalVoiceAnswer=e.detail;});
  box.append(controls);
  box.append(action('Save reviewed answer as evidence',()=>{
   const answer=input.value.trim();if(answer.length<4){toast('A meaningful response is required.');return;}
   if(!window.confirm('Confirm this answer was reviewed and may be used as unverified evidence?'))return;
   const saved=reports.find(r=>r.id===report.id);if(!saved)return;
   saved.clarifications??=[];if(saved.clarifications.length>=5){toast('Maximum five answers per report.');return;}
   const provider=originalVoiceAnswer?(answer===originalVoiceAnswer.transcript?'gnani-reviewed':'gnani-edited'):'manual';
   saved.clarifications.push({id:'C-'+uuid().slice(0,16),question:q.text,questionKind:q.kind,answerTranscript:answer,language:report.language,reportedAt:new Date().toISOString(),transcription:{reviewed:true,provider,model:originalVoiceAnswer?.model||null}});
   cancelFollowupRecording();geoRevision++;persistState();render();toast('Clarification saved separately. Original report preserved.');
  },'primary'));
  host.append(box);

 }
 if(report.revisions?.length){
  const log=el('div','revision-list');log.append(el('div','subsection',`CORRECTION HISTORY · ${report.revisions.length}`));
  for(const revision of [...report.revisions].reverse()){
   const old=el('div','quote-card');old.append(el('div','small-muted',`Earlier reviewed statement · ${reportDate(revision.changedAt)} · ${revision.previousProvider}`),el('p','',revision.previousTranscript),el('div','small-muted',`Reason: ${revision.reason}`));log.append(old);
  }
  host.append(log);
 }
 const buttons=el('div','inspector-actions');buttons.append(action('View pin on map',()=>{switchView('report',{scroll:false});map.setView(report.lat,report.lon,Math.max(map.zoom,15));$('live-map').scrollIntoView({behavior:'smooth',block:'center'});toast('Centred on the reporter-supplied pin.');}));
 if(!(report.clarifications?.length) && (report.revisions?.length||0)<5){
  buttons.append(action('Correct saved statement',()=>{
   if(host.querySelector('.correction-box'))return;
   const form=el('div','correction-box');
   form.append(el('label','', 'Corrected statement'));
   const input=el('textarea');input.value=report.transcript;input.maxLength=1000;input.setAttribute('aria-label','Corrected statement');form.append(input);
   form.append(el('label','', 'Why are you correcting it?'));
   const reason=el('input');reason.placeholder='Explain what changed (8–200 characters)';reason.maxLength=200;reason.setAttribute('aria-label','Correction reason');form.append(reason);
   form.append(el('p','', 'The earlier words remain in the private correction history. Possible links will be recalculated; prior dismissal decisions remain recorded.'));
   const actions=el('div','button-row');
   actions.append(action('Save correction',()=>{
    try{
     const i=reports.findIndex(r=>r.id===report.id);if(i<0)throw Error('Report not found.');
     reports[i]=applyReportCorrection(reports[i],input.value,reason.value);
     geoRevision++;persistState();render();toast('Corrected statement saved. Evidence links were recalculated.');
    }catch(error){toast(error.message||'Correction failed.');}
   },'primary'),action('Cancel',()=>form.remove()));
   form.append(actions);host.insertBefore(form,buttons);input.focus();
  }));
 }else if(report.clarifications?.length){host.append(el('p','note','This report already has follow-up answers. To avoid changing their context, create a corrected new report instead of editing the original.'));}

 buttons.append(action('Copy report ID',()=>{if(navigator.clipboard?.writeText)navigator.clipboard.writeText(report.id).then(()=>toast('Report ID copied.')).catch(()=>toast('Copy unavailable in this browser.'));else toast('Clipboard unavailable.');}));
 buttons.append(action('Delete my report',()=>{
  if(!window.confirm('Delete this report and its clarification history from this browser?'))return;
  reports=reports.filter(x=>x.id!==report.id);reviews={};selected.type=null;selected.id=null;geoRevision++;persistState();render();toast('Report deleted.');
 },'danger'));
 host.append(buttons,el('p','note','Neither this pin nor its observations have been independently verified or sent to an authority.'));
}
function renderLinkInspector(link,g){const host=$('evidence-inspector');host.replaceChildren();host.append(el('h4','',kindLabel(link.kind)),el('p','',link.reason));
 host.append(detail('Distance',`${link.distanceMeters} metres between user pins`),detail('Time comparison',link.observationTimesKnown?`${link.timeDifferenceHours} hours based on reported observations`:'Observation time unknown for at least one report'),detail('Decision',link.status));
 host.append(el('div','subsection','EXACT SOURCE QUOTES'));
 for(const s of link.sources){const r=g.nodes.find(n=>n.id===s.reportId);const box=el('div','quote-card');box.append(el('span','tag',labelSymptom(s.symptom)),el('p','',`Matched excerpt: “${s.quote??'Source quote not available'}”`),el('div','small-muted',r?`Report ${r.id} · ${r.language}`:'Source'));if(r)box.append(el('p','',`Original statement: “${r.transcript}”`));host.append(box);}
 host.append(el('div','subsection','UNCERTAINTY CHECKS'));
 for(const c of link.checks||[])host.append(detail(c.label,c.detail));
 const buttons=el('div','inspector-actions');if(link.status==='rejected-link'||link.status==='stale-rejected-link')buttons.append(action('Restore candidate',()=>{delete reviews[link.id];geoRevision++;persistState();render();toast('Your dismissal was cleared.');}));
 else buttons.append(action('Dismiss this suggestion',()=>{reviews[link.id]={status:'rejected-link',note:'Dismissed by this browser user; not an official verification.',evidenceVersion:link.evidenceVersion,reviewedAt:new Date().toISOString()};geoRevision++;persistState();render();toast('Suggestion dismissed in this browser.');},'danger'));
 buttons.append(action('View both pins on map',()=>{const a=g.nodes.find(n=>n.id===link.from),b=g.nodes.find(n=>n.id===link.to);if(a&&b){map.setView((a.lat+b.lat)/2,(a.lon+b.lon)/2,Math.max(map.zoom,15));$('live-map').scrollIntoView({behavior:'smooth',block:'center'});}}));
 host.append(buttons,el('p','note','A possible relationship is not proof of causation or shared infrastructure. Your dismissal only affects this browser.'));
}
function render(){current=state();map.setReports(current.nodes,current.links);const g=current;
 graph.setData(g.nodes,g.links,selected);
 txt($('graph-summary'),g.nodes.length+' report'+(g.nodes.length===1?'':'s')+' · '+g.links.length+' possible relationship'+(g.links.length===1?'':'s')+' (unverified)');
 txt($('count-reports'),g.stats.reports);txt($('count-links'),g.stats.unverifiedLinks);txt($('count-unclear'),g.stats.unclear);
 txt($('workspace-status'),g.nodes.length?`${g.nodes.length} report${g.nodes.length===1?'':'s'} · Browser only`:'Ready for a report');txt($('tab-report-count'),g.nodes.length);updateInsight(g);renderReportList(g);
 if(selected.type==='report'){const r=g.nodes.find(x=>x.id===selected.id);if(r)return renderReportInspector(r);}
 if(selected.type==='link'){const e=g.links.find(x=>x.id===selected.id);if(e)return renderLinkInspector(e,g);}
 selected.type=null;selected.id=null;$('evidence-inspector').replaceChildren(el('p','empty-state','Select a report or a dashed connection on the map to inspect the exact evidence and its uncertainty.'));
}
function cancelFollowupRecording(){
 followupCancelled=true;
 if(followupTimer)clearTimeout(followupTimer);followupTimer=null;
 try{if(followupRecorder?.state==='recording')followupRecorder.stop();}catch{}
 followupStream?.getTracks?.().forEach(track=>track.stop());
 followupRecorder=null;followupStream=null;
}
// A usage limit differs from a retryable transcription failure.
let voiceTrialBlocked=false;
function isVoiceQuotaError(e){return e?.apiCode==='WARDLENS_DAILY_LIMIT'||[402,429].includes(Number(e?.httpStatus))||/voice trial limit reached|daily voice (?:trial |usage |)limit|voice quota (?:reached|exceeded)|insufficient (?:voice )?credits/i.test(String(e?.message||''));}
function isUpstreamRateLimit(e){return e?.apiCode==='GNANI_RATE_LIMIT'||/Gnani rate-limited/i.test(String(e?.message||''));}
function voiceResetLabel(resetAt){
 const d=new Date(resetAt||'');
 return Number.isFinite(d.getTime())?d.toLocaleString(undefined,{hour:'numeric',minute:'2-digit',timeZoneName:'short'}):'the next daily reset';
}
function explainQuota(e){
 if(isUpstreamRateLimit(e))return 'Gnani is temporarily rate-limiting transcription. Retrying immediately will not help. Type your report or check voice availability later.';
 const reset=e?.resetAt||e?.quota?.resetAt;
 return 'WardLens voice attempts are exhausted for this UTC day. Retry will not help. Voice allowance resets at '+voiceResetLabel(reset)+'. Type your report below until then.';
}
function showQuotaError(e){
 voiceTrialBlocked=true;$('retry-voice').hidden=true;$('record-voice').disabled=true;
 txt($('voice-availability'),isUpstreamRateLimit(e)?'● Gnani busy':'● Daily voice limit');
 txt($('voice-status'),explainQuota(e));$('type-fallback').open=true;
 txt($('voice-usage'),isUpstreamRateLimit(e)?'Upstream rate-limit; use typed reporting or check again later.':'Daily voice allowance exhausted. Use typed reporting until reset.');
}
async function requestGnaniTranscription(blob,language,onStatus,externalSignal=null){
 onStatus('Preparing your short audio clip…');
 const wav=await recordingToWav(blob),audio=await wavToBase64(wav);
 onStatus('Securely transcribing with Gnani Prisma…');
 if(externalSignal?.aborted)throw new DOMException('Superseded voice note','AbortError');
 const controller=new AbortController(),forwardAbort=()=>controller.abort();
 if(externalSignal?.aborted)forwardAbort();
 else externalSignal?.addEventListener('abort',forwardAbort,{once:true});
 const deadline=setTimeout(()=>controller.abort(),55000);
 try{
  const response=await fetch('/api/voice/transcribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({audio,language,consent:true}),signal:controller.signal});
  const data=await response.json();
  if(!response.ok){const failure=new Error(data.error||('Voice service error '+response.status));failure.httpStatus=response.status;failure.apiCode=data.code;failure.resetAt=data.resetAt;failure.quota=data.quota;throw failure;}
  if(data.provider!=='gnani'||typeof data.transcript!=='string'||!data.transcript.trim())throw Error('Unexpected transcription response; no text accepted.');
  return {transcript:data.transcript.trim(),model:data.model||null,language:data.language||language};
 }finally{clearTimeout(deadline);externalSignal?.removeEventListener('abort',forwardAbort);}
}
async function recordFollowupAnswer({language,consent,field,status,start,stop,onCaptured=()=>{},onFailure=()=>{},onSuccess=()=>{}}){
 if(!voiceAvailable){txt(status,'Voice is unavailable on this deployment; type a reply instead.');return;}
 if(!consent.checked){txt(status,'Check the Gnani audio consent box before recording.');consent.focus();return;}
 if(voice?.state==='recording'||followupRecorder){txt(status,'Finish the current recording first.');return;}
 if(!window.MediaRecorder||!navigator.mediaDevices?.getUserMedia){txt(status,'Microphone is unavailable; type a reply instead.');return;}
 start.disabled=true;followupCancelled=false;
 try{
  const stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true}});
  if(followupCancelled){stream.getTracks().forEach(t=>t.stop());return;}
  followupStream=stream;
  const chunks=[],types=['audio/webm;codecs=opus','audio/mp4','audio/webm'],mime=types.find(t=>window.MediaRecorder.isTypeSupported?.(t));
  const recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);followupRecorder=recorder;
  recorder.addEventListener('dataavailable',e=>{if(e.data.size)chunks.push(e.data);});
  recorder.addEventListener('stop',async()=>{
   const canceled=followupCancelled;
   if(followupTimer)clearTimeout(followupTimer);followupTimer=null;
   stream.getTracks().forEach(t=>t.stop());followupStream=null;followupRecorder=null;stop.disabled=true;
   if(canceled)return;
   const clip=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});
   onCaptured(clip);
   try{
    if(!clip.size)throw Error('No audio was captured.');
    const transcript=await requestGnaniTranscription(clip,language,text=>txt(status,text));
    // A user may switch inspector while a response is in flight. Never write to detached fields.
    if(!field.isConnected)return;
    field.value=transcript.transcript;
    const controls=status.parentElement;
    controls?.dispatchEvent(new CustomEvent('wardlens:followup-transcribed',{detail:transcript}));
    onSuccess();txt(status,'Gnani answer received. Read and correct it before saving.');field.focus({preventScroll:true});
   }catch(error){if(field.isConnected){onFailure(error);if(isVoiceQuotaError(error)||isUpstreamRateLimit(error)){showQuotaError(error);txt(status,explainQuota(error));}else txt(status,(error.message||'Transcription failed.')+' Retry this recorded answer or type.');}}
   finally{if(field.isConnected)start.disabled=!voiceAvailable;}
  },{once:true});
  recorder.start();stop.disabled=false;txt(status,'Recording your answer… 18 seconds maximum. Stop when ready.');
  followupTimer=setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},18000);
 }catch{start.disabled=!voiceAvailable;stop.disabled=true;txt(status,'Microphone denied or unavailable. You can type a reply.');}
}
// The current note's audio stays in memory only; it is never saved to localStorage.
let latestVoiceNote=null,voiceNoteSerial=0,voiceAttemptSerial=0,activeVoiceAbort=null,voiceCaptureSerial=0,microphonePending=false;
function resetVoice(){
 ++voiceNoteSerial;++voiceAttemptSerial;
 activeVoiceAbort?.abort();activeVoiceAbort=null;latestVoiceNote=null;
 $('retry-voice').hidden=true;$('retry-voice').disabled=false;
 if(voiceTimer)clearTimeout(voiceTimer);voiceTimer=null;
 if(voiceUrl){URL.revokeObjectURL(voiceUrl);voiceUrl=null;}
 const player=$('recording-playback');player.hidden=true;player.removeAttribute('src');
}

const REPORT_RADIUS_METERS=300;
const DELHI_DEFAULT={lat:28.6139,lon:77.2090,zoom:12};
const locationValid=coords=>Number.isFinite(coords?.latitude)&&Number.isFinite(coords?.longitude)&&Math.abs(coords.latitude)<=85.0511&&Math.abs(coords.longitude)<=180;
const setMapLocationStatus=message=>txt($('map-location-status'),message);
let locationRequestInProgress=false;
const isIPhone=/iPhone|iPad|iPod/i.test(navigator.userAgent);
const retryButton=$('use-location');
function setLocationButtonBusy(busy){
 locationRequestInProgress=busy;
 retryButton.disabled=busy;
 retryButton.textContent=busy?'Locating…':'Use my location';
}
function showLocationHelp(){const help=$('location-help');if(help)help.open=true;}
function explainLocationError(error){
 switch(error?.code){
  case 1:return 'Location permission was denied. Allow location for this website and browser in iPhone Settings, then tap “Use my location” again.';
  case 2:return 'Your phone could not determine its location. Try outdoors or near a window, enable Wi-Fi/mobile data, and try again.';
  case 3:return 'Location took too long. Retry with a good signal or select a location on the map.';
  default:return 'Your browser cannot provide a device location. Use Safari or Chrome directly, review the location permissions, or choose a map pin.';
 }
}
function mapFallback(reason='Location unavailable or not permitted.'){
 if(!mapLocationManuallyChanged&&!pin)map.setView(DELHI_DEFAULT.lat,DELHI_DEFAULT.lon,DELHI_DEFAULT.zoom);
 setMapLocationStatus(reason+' Map fallback: New Delhi. It is NOT your report location; choose a pin before saving.');
 if(isIPhone)showLocationHelp();
}
function applyDeviceLocation(pos,{explicit=false}={}){
 if(!locationValid(pos?.coords)){
  if(explicit)mapFallback('The device supplied invalid coordinates.');
  else mapFallback('Device position was invalid.');
  return false;
 }
 const coords=pos.coords;
 currentDeviceFix={lat:coords.latitude,lon:coords.longitude,accuracy:Number.isFinite(coords.accuracy)?coords.accuracy:Infinity,time:Date.now()};
 if(!explicit&&(mapLocationManuallyChanged||pin)){refreshProximity();return false;}
 pin={lat:coords.latitude,lon:coords.longitude,locationMethod:'device-geolocation',locationAccuracyMeters:Number.isFinite(coords.accuracy)?coords.accuracy:null};
 map.setView(pin.lat,pin.lon,15);
 updatePin();
 const accuracy=Number.isFinite(coords.accuracy)?' (approx. ±'+Math.round(coords.accuracy)+' m)':'';
 const note=Number.isFinite(coords.accuracy)&&coords.accuracy>=200?' The GPS estimate is broad. Tap “Use my location” again for a more precise fix.':'';
 setMapLocationStatus('Your device location'+accuracy+' is selected. Review or move the pin if the issue occurred elsewhere.'+note);
 return true;
}
async function initializeDefaultLocation(){
 if(!window.isSecureContext){mapFallback('Location needs a secure HTTPS page.');return;}
 if(!navigator.geolocation){mapFallback('Geolocation is not supported by this browser.');return;}
 try{
  if(navigator.permissions?.query){
   const permission=await navigator.permissions.query({name:'geolocation'});
   if(permission.state==='denied'){
    mapFallback('Site location permission is currently blocked.');
    return;
   }
  }
 }catch{/* Some iPhone browsers do not expose permission status reliably. */}
 if(mapLocationManuallyChanged||pin)return;
 try{
  navigator.geolocation.getCurrentPosition(
   pos=>{applyDeviceLocation(pos);},
   error=>{
    if(error?.code===1)currentDeviceFix=null;
    mapFallback(explainLocationError(error));
   },
   {enableHighAccuracy:false,timeout:14000,maximumAge:60000}
  );
 }catch{mapFallback('Automatic location detection was blocked by the browser.');}
}
function requestLocationFromButton(){
 if(locationRequestInProgress)return;
 mapLocationManuallyChanged=true; // Explicit user choice always wins over pending automatic callbacks.
 if(!window.isSecureContext){mapFallback('Open this website using HTTPS to use device location.');return;}
 if(!navigator.geolocation){mapFallback('Your browser does not provide the location API.');return;}
 setLocationButtonBusy(true);
 setMapLocationStatus('Requesting your device location. Allow access when your phone prompts you…');
 const tryPrecise=Number.isFinite(currentDeviceFix?.accuracy)&&currentDeviceFix.accuracy>150;
 const acquire=(highAccuracy,allowFallback)=>{
  try{
   navigator.geolocation.getCurrentPosition(
    position=>{
     setLocationButtonBusy(false);
     if(applyDeviceLocation(position,{explicit:true}))toast('Device location acquired. Review the pin before saving.');
     else mapFallback('Location data was invalid.');
    },
    error=>{
     if(error?.code===1)currentDeviceFix=null;
     if(allowFallback&&error?.code!==1){
      setMapLocationStatus('Precise GPS is slow. Trying a lower-power location estimate…');
      acquire(false,false);
      return;
     }
     setLocationButtonBusy(false);
     mapFallback(explainLocationError(error));
    },
    {enableHighAccuracy:highAccuracy,timeout:highAccuracy?15000:18000,maximumAge:highAccuracy?0:120000}
   );
  }catch(error){
   setLocationButtonBusy(false);
   mapFallback('Your browser blocked the location request. Check the site and app permissions.');
  }
 };
 acquire(tryPrecise,tryPrecise);
}
// Respect manual user movements while a location request is pending.
for(const eventName of ['pointerdown','keydown','wheel']){
 $('live-map').addEventListener(eventName,()=>{mapLocationManuallyChanged=true;},{capture:true});
}


// Approximate device-to-report distance (WGS84 great-circle metres). GPS precision is not proof of presence.
function proximityDistanceMeters(a,b){
 const radians=v=>v*Math.PI/180;
 const deltaLat=radians(b.lat-a.lat),deltaLon=radians(b.lon-a.lon);
 const half=Math.sin(deltaLat/2)**2+Math.cos(radians(a.lat))*Math.cos(radians(b.lat))*Math.sin(deltaLon/2)**2;
 return 6371008.8*2*Math.atan2(Math.sqrt(half),Math.sqrt(Math.max(0,1-half)));
}
function proximityCheck(){
 if(!pin)return {state:'no-pin'};
 if(!currentDeviceFix||Date.now()-currentDeviceFix.time>120000)return {state:'unverified'};
 if(!Number.isFinite(currentDeviceFix.accuracy)||currentDeviceFix.accuracy<0)return {state:'unverified'};
 const distance=proximityDistanceMeters(pin,currentDeviceFix);
 const accuracy=currentDeviceFix.accuracy;
 if(distance+accuracy<=REPORT_RADIUS_METERS)return {state:'nearby',distance,accuracy};
 if(distance-accuracy>REPORT_RADIUS_METERS)return {state:'outside',distance,accuracy};
 return {state:'uncertain',distance,accuracy};
}
function refreshProximity(){
 const node=$('map-proximity');if(!node)return;
 const check=proximityCheck();
 node.dataset.proximity=check.state;
 const near=Math.round(check.distance??0),acc=Math.round(check.accuracy??0);
 if(check.state==='no-pin')txt(node,'300 m device-proximity check: select a report location first.');
 if(check.state==='nearby')txt(node,'Within ~300 m of the device location (distance '+near+' m, reported GPS accuracy ±'+acc+' m). This is a device estimate, not independently verified presence.');
 if(check.state==='outside')txt(node,'Location is outside the 300 m device radius (distance '+near+' m, GPS accuracy ±'+acc+' m). Choose a nearer report pin to save.');
 if(check.state==='uncertain')txt(node,'Cannot confidently establish the 300 m limit: '+near+' m from device, GPS accuracy ±'+acc+' m. Try “Use my location” for a fresh fix; this report remains unverified.');
 if(check.state==='unverified')txt(node,'Unable to verify proximity within 300 m (location permission denied, unavailable or fix too old). You may save only as an unverified report.');
 return check;
}
// Search is user-triggered only, with a per-page throttle and in-memory result cache.
// Third-party Photon sees the typed search term only, never live GPS or report records.
const placeCache=new Map();
let searchBusy=false,lastPlaceSearchAt=0,placeSearchSerial=0;
function setPlaceSearchStatus(message){txt($('place-search-status'),message);}
function cleanPlaceFeatures(payload){
 const features=Array.isArray(payload?.features)?payload.features:[];
 return features.slice(0,8).map(f=>{
  const coords=f?.geometry?.coordinates;
  const lon=Number(coords?.[0]),lat=Number(coords?.[1]);
  if(!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lat)>85.0511||Math.abs(lon)>180)return null;
  const p=f.properties||{};
  const address=[p.name,p.street,p.city,p.state,p.country].filter(Boolean).map(String);
  return {lat,lon,name:address[0]||'Unnamed place',details:address.slice(1).filter((s,i,all)=>all.indexOf(s)===i).join(' · ').slice(0,230)};
 }).filter(Boolean).slice(0,5);
}
function renderPlaceResults(items){
 const host=$('place-search-results');host.replaceChildren();
 for(const item of items){
  const button=document.createElement('button');button.className='place-search-result';button.type='button';
  const info=document.createElement('div'),name=document.createElement('strong'),sub=document.createElement('span'),act=document.createElement('b');
  name.textContent=item.name.slice(0,110);sub.textContent=item.details;act.className='place-search-pick';act.textContent='Select location';
  info.append(name,sub);button.append(info,act);
  button.addEventListener('click',()=>{
   mapLocationManuallyChanged=true;
   pin={lat:item.lat,lon:item.lon,locationMethod:'map-pin',locationAccuracyMeters:null};
   map.setPicking(false);map.setView(item.lat,item.lon,16);updatePin();
   setPlaceSearchStatus('Located '+item.name+'. Reporter-supplied search coordinates are approximate. Check the 100 m indicator below.');
   $('live-map').scrollIntoView({behavior:'smooth',block:'center'});
  });
  host.append(button);
 }
 if(!items.length)setPlaceSearchStatus('No matches found. Try a fuller place name or choose a point on the map.');
}
async function searchLocation(){
 const input=$('place-query'),raw=input.value.trim(),query=raw.replace(/\s+/g,' ');
 if(query.length<3||query.length>110){setPlaceSearchStatus('Enter a place or address containing 3–110 characters.');return;}
 if(searchBusy)return;
 const key=query.toLocaleLowerCase('en');
 const cached=placeCache.get(key);
 if(cached){renderPlaceResults(cached.items);setPlaceSearchStatus('Showing cached results for '+query+'. Select a place or choose a map pin.');return;}
 const now=Date.now();
 if(now-lastPlaceSearchAt<1500){setPlaceSearchStatus('Please wait a moment before searching again.');return;}
 lastPlaceSearchAt=now;searchBusy=true;const id=++placeSearchSerial;
 $('place-search-button').disabled=true;setPlaceSearchStatus('Searching places…');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8500);
 try{
  const url='https://photon.komoot.io/api/?q='+encodeURIComponent(query)+'&limit=5';
  const response=await fetch(url,{signal:controller.signal,mode:'cors',credentials:'omit',referrerPolicy:'strict-origin-when-cross-origin'});
  if(!response.ok)throw Error('Search provider returned '+response.status);
  const data=await response.json(),items=cleanPlaceFeatures(data);
  if(id!==placeSearchSerial)return;
  if(placeCache.size>=25)placeCache.delete(placeCache.keys().next().value);
  placeCache.set(key,{items,time:now});
  renderPlaceResults(items);
  if(items.length)setPlaceSearchStatus(items.length+' matching places. Select a result to put the pin on the map.');
 }catch(error){
  if(id!==placeSearchSerial)return;
  $('place-search-results').replaceChildren();
  setPlaceSearchStatus(error.name==='AbortError'?'Place search timed out. Try again or place a map pin manually.':'Place search unavailable. You can still choose a location directly on the map.');
 }finally{clearTimeout(timer);searchBusy=false;$('place-search-button').disabled=false;}
}
$('place-search-button').addEventListener('click',searchLocation);
$('place-query').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchLocation();}});

$('choose-pin').addEventListener('click',()=>{mapLocationManuallyChanged=true;switchView('report',{scroll:false});map.setPicking(true);toast('Click a position on the real map to place your report pin.');$('live-map').scrollIntoView({behavior:'smooth',block:'center'});});
$('use-location').addEventListener('click',requestLocationFromButton);
$('graph-plus').addEventListener('click',()=>graph.zoomBy(1.2));
$('graph-minus').addEventListener('click',()=>graph.zoomBy(1/1.2));
$('graph-fit').addEventListener('click',()=>graph.fit());
$('graph-show-map').addEventListener('click',()=>{switchView('report',{scroll:false});$('live-map').scrollIntoView({behavior:'smooth',block:'center'});});
for(const link of document.querySelectorAll('[data-open-graph]'))link.addEventListener('click',event=>{event.preventDefault();switchView('explore',{scroll:false});$('evidence-network-panel').scrollIntoView({behavior:'smooth',block:'start'});});
$('zoom-plus').addEventListener('click',()=>map.zoomBy(1));$('zoom-minus').addEventListener('click',()=>map.zoomBy(-1));
$('library-search').addEventListener('input',()=>renderReportList(current||state()));
$('library-filter').addEventListener('change',()=>renderReportList(current||state()));
$('insight-next-action').addEventListener('click',()=>{
 const target=$('insight-next-action').dataset.target;
 if(target==='capture'){switchView('report');$('report-form').scrollIntoView({behavior:'smooth',block:'start'});return;}
 if(target==='clarify'){const n=current.nodes.find(x=>x.evidence.status==='needs-clarification'||!x.evidence.symptoms.length);if(n)pick('report',n.id);return;}
 if(target==='conflicts'||target==='links'){const n=current.links.find(x=>x.status!=='rejected-link'&&x.status!=='stale-rejected-link'&&(target==='links'||x.kind==='contradiction'));if(n)pick('link',n.id);}
});
function downloadText(filename,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
$('export-brief').addEventListener('click',()=>{
 if(!reports.length)return toast('Add a report before creating an investigation brief.');
 downloadText('wardlens-redacted-brief.md',createRedactedBriefing(current||state()),'text/markdown;charset=utf-8');
 toast('Privacy-safe summary downloaded. It omits exact locations and original words.');
});
$('import-data').addEventListener('click',()=>$('import-file').click());
$('import-file').addEventListener('change',async e=>{
 const file=e.target.files?.[0];e.target.value='';if(!file)return;
 try{
  if(file.size>512*1024)throw Error('Backup is too large (512 KB maximum).');
  const raw=await file.text();const data=validatePrivateBackup(JSON.parse(raw));
  if(!window.confirm(`Replace the ${reports.length} report(s) in this browser with ${data.reports.length} report(s) from this private backup? Your existing unsaved reports will be lost.`))return;
  cancelFollowupRecording();reports=data.reports;reviews=data.reviews;selected.type=null;selected.id=null;geoRevision++;
  pin=null;updatePin();voiceTranscript=null;resetVoice();$('report-text').value='';$('report-consent').checked=false;
  persistState();render();renderDraftPreview();switchView('explore');
  toast(`${reports.length} report(s) restored ${persist?'on this device':'in this tab'}. No cloud data was changed.`);
 }catch(error){toast(`Backup not restored: ${error.message||'invalid JSON'}`);}
});
$('remember-device').addEventListener('change',e=>{persist=e.target.checked;if(!persist){if(window.confirm('Disable device storage and clear saved browser data?'))persistState();else {persist=true;e.target.checked=true;}}else persistState();});
$('report-form').addEventListener('submit',e=>{e.preventDefault();const problem=$('form-message');txt(problem,'');
 try{if(reports.length>=MAX_REPORTS)throw Error(`Limit ${MAX_REPORTS} reports per browser. Export or delete some first.`);
  if(!pin)throw Error('Choose a report location on the map.');
  if(!$('report-consent').checked)throw Error('Please confirm permission and review your statement.');
  const transcript=$('report-text').value.trim();if(transcript.length<4||transcript.length>1000)throw Error('Describe a meaningful observation (4–1000 characters).');
  const scope=assessReportScope(transcript,extractEvidence(transcript));
  if(scope.status==='out-of-scope'||scope.status==='clarify')throw Error(scope.reason);
  const now=new Date().toISOString();const observed=$('observed-at').value;
  const observedAt=observed?normalizeObservationTime(new Date(observed).toISOString(),now):null;
  const location=normalizeUserLocation(pin);
  const proximity=proximityCheck();
  if(proximity.state==='outside')throw Error('Report location is beyond 300 m of the device estimate. Choose a nearer pin.');
  const proximityVerification=proximity.state==='nearby'?{status:'within-300m-device-estimate',distanceMeters:Math.round(proximity.distance),gpsAccuracyMeters:Math.round(proximity.accuracy),checkedAt:now}:{status:'unverified',checkedAt:now};
  const id='G-'+uuid();
  const inferredSource=voiceTranscript?(transcript===voiceTranscript.transcript?'gnani-reviewed':'gnani-edited'):'manual-reviewed';
  reports.push({id,transcript,language:$('report-language').value,...location,reportedAt:now,observedAt,source:'user-browser-submission',consentAttested:true,proximityVerification,transcription:{provider:inferredSource,reviewed:true,model:voiceTranscript?.model||null},clarifications:[]});
  selected.type='report';selected.id=id;geoRevision++;persistState();render();switchView('explore');$('report-text').value='';$('observed-at').value='';$('report-consent').checked=false;
  pin=null;updatePin();setMapLocationStatus('Report saved. Select a new location for your next observation; the map remains centred here.');voiceTranscript=null;resetVoice();renderDraftPreview();txt($('transcript-provenance'),'Your saved report is kept in this browser.');toast('Report saved and analysed in this browser.');$('report-list').scrollIntoView({behavior:'smooth',block:'nearest'});
 }catch(error){txt(problem,error.message||'Unable to save report.');}
});
$('clear-data').addEventListener('click',()=>{if(!reports.length)return; if(!window.confirm('Permanently clear all reports, notes and WardLens browser data on this device?'))return;
 cancelFollowupRecording();reports=[];reviews={};selected.type=null;selected.id=null;pin=null;updatePin();voiceTranscript=null;resetVoice();$('report-text').value='';geoRevision++;try{localStorage.removeItem(KEY);}catch{}render();switchView('report');renderDraftPreview();toast('All browser reports cleared.');});
$('export-data').addEventListener('click',()=>{
 if(!reports.length){toast('No reports to export.');return;}
 if(!window.confirm('This PRIVATE backup includes original statements, precise coordinates, and review decisions. Only share it with someone you trust. Continue?'))return;
 downloadText('wardlens-private-evidence.json',JSON.stringify(createPrivateBackup(reports,reviews),null,2),'application/json');
});
async function refreshVoiceAvailability({preserveMessage=false}={}){
 const button=$('check-voice');if(button)button.disabled=true;
 try{
  const response=await fetch('/api/voice/transcribe',{cache:'no-store'});
  if(!response.ok)throw Error('Quota status unavailable');
  const data=await response.json();
  const quota=data.quota,reason=data.reason||'';
  voiceAvailable=data.available===true;
  voiceTrialBlocked=reason==='quota-client'||reason==='quota-global';
  const resetLabel=voiceResetLabel(quota?.resetAt);
  if(quota&&Number.isFinite(quota.clientRemaining)){
   txt($('voice-usage'),'Voice attempts left: '+quota.clientRemaining+'/'+quota.clientLimit+
    ' per visitor · '+quota.globalRemaining+'/'+quota.globalLimit+' site-wide · Resets '+resetLabel+'.');
  }else txt($('voice-usage'),data.reason==='unconfigured'?'Voice transcription is not configured.':'Voice allowance could not be checked.');
  txt($('voice-availability'),voiceAvailable?'● Gnani configured':voiceTrialBlocked?'● Voice limit reached':'● Voice unavailable');
  if(!preserveMessage||!voiceAvailable){
   const msg=voiceAvailable?'Ready to record. Each voice transcription uses a daily attempt; review the text before saving.':
    voiceTrialBlocked?'Voice allowance exhausted until '+resetLabel+'. You can type a report instead.':
    'Voice service is currently unavailable. You can type a report instead.';
   txt($('voice-status'),msg);
  }
  $('record-voice').disabled=!voiceAvailable||voiceTrialBlocked;
  if(!voiceAvailable)$('type-fallback').open=true;
 }catch{
  voiceAvailable=false;$('record-voice').disabled=true;
  txt($('voice-availability'),'● Voice unavailable');
  txt($('voice-usage'),'Could not verify voice quota. Typed reports remain available.');
  if(!preserveMessage)txt($('voice-status'),'Voice service status unavailable. Type an observation instead.');
  $('type-fallback').open=true;
 }finally{if(button)button.disabled=false;}
}
$('check-voice').addEventListener('click',()=>refreshVoiceAvailability());
// Each completed audio note starts a new transcription. An older response cannot
// replace the text of a newer note, a language recheck, or a revoked consent.
async function transcribeRecording(note){
 if(!note||latestVoiceNote?.id!==note.id)return;
 if(!$('voice-consent').checked){
  txt($('voice-status'),'Audio consent is required. Check consent and retry, or type your report.');
  $('retry-voice').hidden=false;return;
 }
 activeVoiceAbort?.abort();
 const controller=new AbortController(),attempt=++voiceAttemptSerial;
 activeVoiceAbort=controller;
 $('retry-voice').hidden=true;$('retry-voice').disabled=true;
 $('stop-voice').disabled=true;
 txt($('voice-status'),'Preparing this voice note for transcription…');
 const current=()=>latestVoiceNote?.id===note.id&&voiceAttemptSerial===attempt&&!controller.signal.aborted;
 try{
  const data=await requestGnaniTranscription(note.blob,note.language,message=>{
   if(current())txt($('voice-status'),message);
  },controller.signal);
  if(!current())return;
  voiceTranscript={transcript:data.transcript,model:data.model,language:data.language};
  $('report-text').value=data.transcript;
  $('type-fallback').open=true;renderDraftPreview();
  txt($('transcript-provenance'),'Latest recording transcribed with Gnani Prisma. Review and edit before saving.');
  txt($('voice-status'),'This voice note was transcribed. Review the text, choose your location, then save. You can record a new note anytime.');
  $('report-text').focus({preventScroll:true});
  $('type-fallback').scrollIntoView({behavior:'smooth',block:'nearest'});
  void refreshVoiceAvailability({preserveMessage:true});
 }catch(error){
  if(!current())return;
  voiceTranscript=null;
  const reason=error.name==='AbortError'?'Transcription timed out.':(error.message||'Transcription failed.');
  if(isVoiceQuotaError(error)||isUpstreamRateLimit(error)){showQuotaError(error);txt($('transcript-provenance'),'No audio transcript was accepted. Type and review your report instead.');}
  else{txt($('voice-status'),reason+' Tap Retry transcription to reuse this recording, or record a new note. No report was saved.');txt($('transcript-provenance'),'Latest recording has no accepted transcript. Retry or type your own reviewed statement.');$('retry-voice').hidden=false;$('type-fallback').open=true;}
 }finally{
  if(latestVoiceNote?.id===note.id&&voiceAttemptSerial===attempt){
   activeVoiceAbort=null;$('retry-voice').disabled=false;
   $('record-voice').disabled=!voiceAvailable||voiceTrialBlocked||microphonePending||!!voice;
  }
 }
}
function clearPreviousTranscript(){
 const previous=voiceTranscript;voiceTranscript=null;
 if(previous&&$('report-text').value.trim()===previous.transcript){
  $('report-text').value='';renderDraftPreview();
  txt($('transcript-provenance'),'Old transcript cleared. Awaiting this new voice note.');
 }else if(previous){
  txt($('transcript-provenance'),'Your edited text remains a manual draft until the new voice note is transcribed.');
 }
}
$('retry-voice').addEventListener('click',()=>{
 if(!latestVoiceNote||activeVoiceAbort||voiceTrialBlocked)return;
 if(!$('voice-consent').checked){
  txt($('voice-status'),'Please allow Gnani transcription before retrying.');$('voice-consent').focus();return;
 }
 transcribeRecording(latestVoiceNote);
});
$('report-language').addEventListener('change',()=>{
 if(!latestVoiceNote||!voiceAvailable||voiceTrialBlocked||!$('voice-consent').checked||voice?.state==='recording')return;
 clearPreviousTranscript();
 const note={...latestVoiceNote,language:$('report-language').value,id:++voiceNoteSerial};
 latestVoiceNote=note;
 transcribeRecording(note); // Changed language means a fresh request for this audio.
});
$('voice-consent').addEventListener('change',()=>{
 if($('voice-consent').checked)return;
 if(activeVoiceAbort||latestVoiceNote){
  resetVoice();voiceTranscript=null;$('record-voice').disabled=!voiceAvailable;
  txt($('voice-status'),'Consent removed: local audio discarded and pending transcription canceled.');
 }
});
$('report-text').addEventListener('input',()=>{
 renderDraftPreview();
 if(voiceTranscript)txt($('transcript-provenance'),
  $('report-text').value===voiceTranscript.transcript?'Gnani Prisma transcription · reviewed before submission.':'Edited by reporter after Gnani Prisma transcription.');
});
$('record-voice').addEventListener('click',async()=>{
 if(voiceTrialBlocked){toast('Voice trial limit reached. Please type your report.');$('type-fallback').open=true;return;}
 if(!voiceAvailable){toast('Live transcription unavailable. Please type.');return;}
 if(!$('voice-consent').checked){toast('Please consent to Gnani processing before recording.');$('voice-consent').focus();return;}
 if(!window.MediaRecorder||!navigator.mediaDevices?.getUserMedia){toast('Microphone unavailable. You can type.');$('type-fallback').open=true;return;}
 if(microphonePending||voice?.state==='recording')return;
 const capture=++voiceCaptureSerial;
 microphonePending=true;$('record-voice').disabled=true;
 txt($('voice-status'),'Opening the microphone for a new voice note…');
 let stream=null;
 try{
  stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true}});
  if(capture!==voiceCaptureSerial||cancellingVoice){stream.getTracks().forEach(t=>t.stop());return;}
  cancellingVoice=false;
  const previous=voiceTranscript;
  resetVoice();
  if(previous){voiceTranscript=previous;clearPreviousTranscript();}
  const chunks=[],types=['audio/webm;codecs=opus','audio/mp4','audio/webm'];
  const mime=types.find(t=>window.MediaRecorder.isTypeSupported?.(t));
  const recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);
  voice=recorder;
  recorder.addEventListener('dataavailable',e=>{if(e.data.size)chunks.push(e.data);});
  recorder.addEventListener('stop',async()=>{
   stream.getTracks().forEach(t=>t.stop());
   if(voiceTimer)clearTimeout(voiceTimer);voiceTimer=null;
   if(voice===recorder)voice=null;
   $('stop-voice').disabled=true;txt($('record-label'),'Tap to speak');
   if(capture!==voiceCaptureSerial||cancellingVoice)return;
   const clip=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});
   if(!clip.size){
    txt($('voice-status'),'No audio captured. Record again, or type your statement.');
    $('record-voice').disabled=!voiceAvailable||voiceTrialBlocked;return;
   }
   voiceUrl=URL.createObjectURL(clip);
   const player=$('recording-playback');player.src=voiceUrl;player.hidden=false;
   const note={blob:clip,language:$('report-language').value,id:++voiceNoteSerial};
   latestVoiceNote=note;
   $('record-voice').disabled=!voiceAvailable||voiceTrialBlocked; // Allow replacing audio even if the request is slow.
   await transcribeRecording(note);
  },{once:true});
  recorder.start();$('stop-voice').disabled=false;
  txt($('record-label'),'Recording…');
  txt($('voice-status'),'Recording a new voice note. Stop to transcribe (25 seconds maximum).');
  voiceTimer=setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},25000);
 }catch{
  try{stream?.getTracks().forEach(t=>t.stop());}catch{}
  if(capture!==voiceCaptureSerial)return;
  voice=null;$('stop-voice').disabled=true;txt($('record-label'),'Tap to speak');
  txt($('voice-status'),'Microphone access failed. Allow it and record again, or type.');
  $('type-fallback').open=true;
 }finally{
  microphonePending=false;
  if(capture===voiceCaptureSerial&&voice?.state!=='recording')$('record-voice').disabled=!voiceAvailable;
 }
});
$('stop-voice').addEventListener('click',()=>{if(voice?.state==='recording')voice.stop();});
window.addEventListener('pagehide',()=>{cancelFollowupRecording();cancellingVoice=true;voiceCaptureSerial++;if(voice?.state==='recording')voice.stop();resetVoice();});
load();render();renderDraftPreview();updatePin();switchView('report',{scroll:false});refreshVoiceAvailability();initializeDefaultLocation();
