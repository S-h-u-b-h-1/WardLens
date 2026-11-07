/* Fictional, offline showcase. Does not send network requests, use Gnani, or access location/microphone. */
(() => {
  'use strict';
  const model=window.AWAAZ_SHOWCASE_DATA;
  if(!model||model.stages?.length!==6)throw new Error('Synthetic demo-data.js is required.');
  const NS='http://www.w3.org/2000/svg';
  let step=0,selected=null;
  const rejected=new Set();
  const $=id=>document.getElementById(id);
  const node=(tag,txt,cls)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=String(txt);return e;};
  const svg=(tag,attrs={})=>{const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));return e;};
  const current=()=>{
    const s=model.stages[step];const base=s.variants[''];const possible=new Set(base.links.map(e=>e.id));
    const key=[...rejected].filter(x=>possible.has(x)).sort().join('|');
    return s.variants[key]||base;
  };
  const textRow=(label,value)=>{const p=node('div',null,'inspect-list-row');p.append(node('strong',label),node('span',value));return p;};
  const elementButton=(text,callback)=>{const b=node('button',text);b.type='button';b.addEventListener('click',callback);return b;};
  const kindLabel={
    'possible-dependency':'Possible infrastructure relationship',
    'same-issue-candidate':'Same-symptom candidate',
    'contradiction':'Conflicting reported state',
    'possible-state-change':'Possible state change'
  };
  function renderInspector(){
    const body=$('inspector-body');body.replaceChildren();
    const g=current();
    if(!selected){
      body.append(node('div','SELECT AN OBSERVATION','micro-heading'),node('h4','Inspectable evidence'),node('p','Choose a report or a dashed relationship. The original statement, sources, checks, and unanswered questions will appear here.'));
      body.append(node('div','All content is scripted and fictional. Selecting evidence does not contact a server.','card-note'));
      return;
    }
    if(selected.type==='report'){
      const r=g.nodes.find(n=>n.id===selected.id);if(!r){selected=null;return renderInspector();}
      body.append(node('div',`REVIEWED REPORT / ${r.id}`,'micro-heading'),node('h4',r.evidence.symptoms.length?r.evidence.symptoms.join(' · '):'Needs clarification'));
      body.append(node('div','This report and its service area are fictional. Source reviewed text is scripted, not a Gnani transcription.','card-note'));
      const quote=node('div',null,'quote');quote.append(node('span','ORIGINAL REVIEWED STATEMENT','micro-heading'),node('div',r.transcript));body.append(quote);
      const list=node('div',null,'inspect-list');
      list.append(textRow('Language',r.language),textRow('Fictional service area',r.zoneName),textRow('Status',r.evidence.status));
      for(const ex of r.evidence.excerpts)list.append(textRow(`Evidence: ${ex.symptom}`,`“${ex.quote}” · ${ex.method}`));
      if(!r.evidence.excerpts.length)list.append(textRow('Evidence','No supported water-infrastructure symptom; no fabricated match.'));
      body.append(list);
      return;
    }
    if(selected.type==='edge'){
      const e=g.links.find(l=>l.id===selected.id);if(!e){selected=null;return renderInspector();}
      body.append(node('div',`CANDIDATE LINK / ${e.id}`,'micro-heading'),node('h4',kindLabel[e.kind]||e.kind));
      body.append(node('div','A suggested relationship is not a verified cause, a confirmed shared asset, or an official incident.','card-note'));
      body.append(node('p',e.reason));
      const sources=node('div',null,'inspect-list');for(const s of e.sources||[]){sources.append(textRow(`${s.reportId} · ${s.symptom}`,`“${s.quote||'No exact excerpt'}”`));}
      for(const c of e.checks||[])sources.append(textRow(c.label,c.detail||c.result));
      body.append(sources);
      const actions=node('div',null,'inspector-actions');
      const rejectedNow=rejected.has(e.id);
      actions.append(elementButton(rejectedNow?'Restore candidate':'Reject suggestion',()=>{if(rejected.has(e.id))rejected.delete(e.id);else rejected.add(e.id);renderAll();}));body.append(actions);
      return;
    }
    if(selected.type==='hypothesis'){
      const h=g.hypotheses.find(x=>x.id===selected.id);if(!h){selected=null;return renderInspector();}
      body.append(node('div',`UNVERIFIED HYPOTHESIS / ${h.assetId}`,'micro-heading'),node('h4',h.headline),node('div',h.caution,'card-note'));
      for(const line of h.reasoning)body.append(node('p',line));
      const rows=node('div',null,'inspect-list');rows.append(textRow('Support',h.supportReportIds.join(', ')),textRow('Counter-evidence',h.counterReportIds.join(', ')||'None yet'),textRow('Status',h.status));
      body.append(rows);return;
    }
  }
  function renderGraph(){
    const stage=$('graph');stage.replaceChildren();
    const g=current();const nodes=g.nodes;
    const canvas=svg('svg',{viewBox:'0 0 880 485',class:'network-svg',role:'group','aria-label':'Fictional evidence reports with unverified connections'});
    const byId=new Map();const positions=[];
    for(let i=0;i<nodes.length;i++){const pos={x:(i%2===0?210:635),y:95+Math.floor(i/2)*147};byId.set(nodes[i].id,pos);positions.push(pos);}
    const hint=svg('text',{x:20,y:26,class:'node-detail'});hint.textContent='SCRIPTED REPORTS · PRECOMPUTED ENGINE OUTPUT';canvas.append(hint);
    for(const link of g.links){const a=byId.get(link.from),b=byId.get(link.to);if(!a||!b)continue;
      const group=svg('g',{role:'button',tabindex:0,'aria-label':`Inspect ${kindLabel[link.kind]||link.kind} between ${link.from} and ${link.to}`});
      const isRejected=rejected.has(link.id);const d=`M${a.x} ${a.y}L${b.x} ${b.y}`;
      group.append(svg('path',{d,class:`edge ${link.kind==='contradiction'?'conflict':'candidate'} ${isRejected?'rejected':''}`}),svg('path',{d,class:'hit-edge'}));
      const activate=()=>{selected={type:'edge',id:link.id};renderAll();};
      group.addEventListener('click',activate);group.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}});
      canvas.append(group);
    }
    for(let i=0;i<nodes.length;i++){
      const r=nodes[i],p=positions[i];const x=p.x-135,y=p.y-48;
      const group=svg('g',{class:`graph-node ${selected?.type==='report'&&selected.id===r.id?'active':''}`,role:'button',tabindex:0,'aria-label':`Inspect report ${i+1} ${r.id}`});
      group.append(svg('rect',{x,y,width:270,height:96,rx:17}));
      group.append(svg('circle',{cx:x+24,cy:y+25,r:6,class:'node-dot'}));
      const t1=svg('text',{x:x+40,y:y+30,class:'report-number'});t1.textContent=`REPORT ${String(i+1).padStart(2,'0')}`;
      const symptoms=r.evidence.symptoms.length?r.evidence.symptoms.join(' + '):'Needs clarification';
      const t2=svg('text',{x:x+17,y:y+58,class:'report-title'});t2.textContent=symptoms.length>33?symptoms.slice(0,31)+'…':symptoms;
      const t3=svg('text',{x:x+17,y:y+80,class:'report-meta'});t3.textContent=`${r.language} · ${r.zoneName?.split('·').at(-1).trim()||'Fictional area'}`;
      group.append(t1,t2,t3);
      const activate=()=>{selected={type:'report',id:r.id};renderAll();};
      group.addEventListener('click',activate);group.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}});
      canvas.append(group);
    }
    stage.append(canvas);
  }
  function renderHypothesis(){
    const g=current();const h=g.hypotheses[0];
    $('hypothesis-title').textContent=h?h.headline:'No sufficiently supported shared-asset hypothesis yet.';
    $('hypothesis-description').textContent=h?`${h.reasoning.join(' ')} ${h.caution}`:'The engine waits for source-linked, compatible observations before proposing a shared infrastructure explanation.';
    const list=$('hypothesis-questions');list.replaceChildren();
    if(h){for(const q of h.unansweredQuestions.slice(0,2))list.append(node('div',`↳ ${q}`,'question-item'));
      list.append(elementButton('Inspect working hypothesis ↗',()=>{selected={type:'hypothesis',id:h.id};renderAll();}));}
  }
  function renderAll(){
    const s=model.stages[step],g=current();
    $('stat-reports').textContent=g.stats.reports;
    $('stat-links').textContent=g.links.filter(l=>l.kind!=='contradiction'&&l.status!=='rejected-link').length;
    $('stat-contradictions').textContent=g.stats.contradictions;
    $('stat-hypotheses').textContent=g.hypotheses.length;
    $('step-count').textContent=`${step+1} / ${model.stages.length}`;
    $('stage-title').textContent=s.title;
    $('stage-description').textContent=s.text;
    $('stage-progress').style.width=`${(step+1)/model.stages.length*100}%`;
    $('prev-stage').disabled=step===0;$('next-stage').disabled=step===model.stages.length-1;
    renderGraph();renderInspector();renderHypothesis();
  }
  $('prev-stage').addEventListener('click',()=>{if(step>0){step--;selected=null;renderAll();}});
  $('next-stage').addEventListener('click',()=>{if(step<model.stages.length-1){step++;selected=null;renderAll();}});
  $('restart').addEventListener('click',()=>{step=0;selected=null;rejected.clear();renderAll();});
  renderAll();
})();
