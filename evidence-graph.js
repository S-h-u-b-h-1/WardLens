// WardLens Evidence Graph — private, extractive display; no new causal inference.
const NS='http://www.w3.org/2000/svg';
const make=(tag,attrs={})=>{const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));return e;};
const caption=(parent,str,attrs={})=>{const t=make('text',attrs);t.textContent=String(str??'');parent.append(t);return t;};
const labels={'waterlogging':'Waterlogging','drainage-blocked':'Blocked drain','water-outage':'Water outage','water-restored':'Supply restored','pump-failure':'Pump failure','pump-operating':'Pump working','power-trip':'Power trip','power-loss':'Power loss','power-normal':'Power restored'};
const symptomName=r=>(r.evidence?.symptoms||[]).slice(0,2).map(k=>labels[k]||k).join(' + ')||'Needs details';
const dismissed=l=>['rejected-link','stale-rejected-link'].includes(l.status);
const conflict=l=>l.kind==='contradiction';
const hue=l=>dismissed(l)?'#9baeb3':conflict(l)?'#f0a2a1':l.kind==='possible-state-change'?'#eac287':'#91e8d5';
const clamp=(x,min,max)=>Math.min(max,Math.max(min,x));

export class EvidenceGraph {
 constructor(root,{onReport=()=>{},onLink=()=>{}}={}){
  this.root=root;this.onReport=onReport;this.onLink=onLink;
  this.nodes=[];this.links=[];this.positions=new Map();this.scale=1;this.tx=0;this.ty=0;this.drag=null;this.stage=null;
  root.setAttribute('viewBox','0 0 960 480');
  root.addEventListener('pointerdown',e=>this.down(e));
  root.addEventListener('pointermove',e=>this.move(e));
  root.addEventListener('pointerup',e=>this.up(e));
  root.addEventListener('pointercancel',()=>{this.drag=null;});
 }
 setData(nodes,links,selection={}){
  this.nodes=Array.isArray(nodes)?nodes:[];this.links=Array.isArray(links)?links:[];this.selection=selection||{};
  const ids=new Set(this.nodes.map(r=>r.id));
  for(const k of this.positions.keys())if(!ids.has(k))this.positions.delete(k);
  const n=this.nodes.length;
  this.nodes.forEach((r,i)=>{
   if(this.positions.has(r.id))return;
   let x=480,y=240;
   if(n===2){x=i===0?330:630;y=222;}
   else if(n>2){const a=-Math.PI/2+2*Math.PI*i/n,rad=Math.min(300,150+n*9);
     x=480+rad*Math.cos(a);y=235+Math.min(174,rad*.6)*Math.sin(a);}
   this.positions.set(r.id,{x,y});
  });
  this.draw();
 }
 fit(){this.scale=1;this.tx=0;this.ty=0;this.transform();}
 zoomBy(f){const next=clamp(this.scale*f,.65,2.75),cx=(480-this.tx)/this.scale,cy=(240-this.ty)/this.scale;
  this.scale=next;this.tx=480-cx*next;this.ty=240-cy*next;this.transform();}
 transform(){if(this.stage)this.stage.setAttribute('transform','translate('+this.tx+' '+this.ty+') scale('+this.scale+')');}
 down(e){
  if(e.pointerType==='mouse'&&e.button!==0)return;
  if(e.target.closest?.('[data-network-edge]'))return;
  const id=e.target.closest?.('[data-network-node]')?.getAttribute('data-network-node')||null;
  const pos=id?this.positions.get(id):null;
  this.drag={id,sx:e.clientX,sy:e.clientY,tx:this.tx,ty:this.ty,x:pos?.x,y:pos?.y,moved:false};
  try{this.root.setPointerCapture(e.pointerId);}catch{}
 }
 move(e){
  const a=this.drag;if(!a)return;
  const size=this.root.getBoundingClientRect();
  const dx=(e.clientX-a.sx)*960/Math.max(size.width,1),dy=(e.clientY-a.sy)*480/Math.max(size.height,1);
  if(Math.abs(e.clientX-a.sx)+Math.abs(e.clientY-a.sy)>6)a.moved=true;
  if(!a.moved)return;
  if(a.id&&this.positions.has(a.id)){
   const p=this.positions.get(a.id);
   p.x=clamp(a.x+dx/this.scale,65,895);p.y=clamp(a.y+dy/this.scale,65,400);
   this.updatePositions();
  }else if(!a.id){this.tx=clamp(a.tx+dx,-600,600);this.ty=clamp(a.ty+dy,-380,380);this.transform();}
 }
 up(e){const a=this.drag;if(!a)return;this.drag=null;
  try{if(this.root.hasPointerCapture(e.pointerId))this.root.releasePointerCapture(e.pointerId);}catch{}
  if(a.id&&!a.moved)this.onReport(a.id);
 }
 updatePositions(){
  if(!this.stage)return;
  for(const [id,g] of this.nodeEls){const p=this.positions.get(id);if(p)g.setAttribute('transform','translate('+p.x+' '+p.y+')');}
  for(const [l,line,hit] of this.edgeEls){const a=this.positions.get(l.from),b=this.positions.get(l.to);if(!a||!b)continue;
   const d='M '+a.x+' '+a.y+' L '+b.x+' '+b.y;line.setAttribute('d',d);hit.setAttribute('d',d);}
 }
 draw(){
  const root=this.root;root.replaceChildren();this.nodeEls=new Map();this.edgeEls=[];this.stage=null;
  const defs=make('defs'),pat=make('pattern',{id:'wl-evidence-grid',width:34,height:34,patternUnits:'userSpaceOnUse'});
  pat.append(make('circle',{cx:2,cy:2,r:1,fill:'#67aba4',opacity:.27}));defs.append(pat);root.append(defs);
  root.append(make('rect',{x:0,y:0,width:960,height:480,rx:18,fill:'#102e3c'}));
  root.append(make('rect',{x:0,y:0,width:960,height:480,rx:18,fill:'url(#wl-evidence-grid)'}));
  caption(root,'EVIDENCE NETWORK   /   BROWSER PRIVATE',{x:26,y:35,fill:'#a8cfc9','font-size':13,'font-weight':700,'letter-spacing':1.1,'pointer-events':'none'});
  if(!this.nodes.length){
   caption(root,'No observations to connect yet.',{x:480,y:228,'text-anchor':'middle',fill:'#f0f8f6','font-size':26,'font-weight':700});
   caption(root,'Create a report with a map pin to begin.',{x:480,y:267,'text-anchor':'middle',fill:'#adcbc6','font-size':17});
   return;
  }
  this.stage=make('g',{class:'network-stage'});root.append(this.stage);
  const edgeLayer=make('g'),nodeLayer=make('g');this.stage.append(edgeLayer,nodeLayer);
  for(const l of this.links){
   const a=this.positions.get(l.from),b=this.positions.get(l.to);if(!a||!b)continue;
   const d='M '+a.x+' '+a.y+' L '+b.x+' '+b.y;
   const line=make('path',{d,stroke:hue(l),'stroke-width':this.selection.type==='link'&&this.selection.id===l.id?5:3,'stroke-dasharray':dismissed(l)?'3 10':'8 8',opacity:dismissed(l)?.4:.9,fill:'none','pointer-events':'none'});
   const hit=make('path',{d,stroke:'transparent','stroke-width':26,fill:'none',class:'network-edge-hit','data-network-edge':l.id,role:'button',tabindex:0,'aria-label':'Inspect '+(conflict(l)?'conflicting':'possible')+' relationship between two reports, '+(l.distanceMeters??'unknown')+' metres apart. '+(dismissed(l)?'Dismissed.':'')});
   const title=make('title');title.textContent='Open relationship and supporting evidence';hit.append(title);
   hit.addEventListener('click',e=>{e.stopPropagation();this.onLink(l.id);});
   hit.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.onLink(l.id);}});
   edgeLayer.append(line,hit);this.edgeEls.push([l,line,hit]);
  }
  const compact=this.nodes.length>13;
  for(let i=0;i<this.nodes.length;i++){
   const r=this.nodes[i],p=this.positions.get(r.id),sel=this.selection.type==='report'&&this.selection.id===r.id;
   const unclear=r.evidence?.status==='needs-clarification'||!(r.evidence?.symptoms||[]).length;
   const rad=compact?23:31;
   const group=make('g',{class:'network-node','data-network-node':r.id,role:'button',tabindex:0,'aria-label':'Report '+(i+1)+': '+symptomName(r)+'. '+(r.language||'Unknown language')+'. Inspect source.',transform:'translate('+p.x+' '+p.y+')'});
   group.append(make('circle',{r:rad+8,fill:sel?'#25656a':'#1a4854',stroke:sel?'#bcffee':'#426977','stroke-width':sel?3:1.3}));
   group.append(make('circle',{r:rad,fill:unclear?'#657b81':'#307e78',stroke:unclear?'#bbd0ce':'#a0edda','stroke-width':2}));
   caption(group,String(i+1).padStart(2,'0'),{x:0,y:6,'text-anchor':'middle',fill:'#fff','font-size':compact?16:19,'font-weight':750,'pointer-events':'none'});
   const name=symptomName(r);
   caption(group,name.length>25?name.slice(0,22)+'…':name,{x:0,y:rad+30,'text-anchor':'middle',fill:'#f3fcf8','font-size':compact?11:13,'font-weight':700,'pointer-events':'none'});
   caption(group,r.language||'Unknown',{x:0,y:rad+46,'text-anchor':'middle',fill:'#b2cdca','font-size':11,'pointer-events':'none'});
   const title=make('title');title.textContent=(r.transcript||'Observation').slice(0,210);group.append(title);
   group.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.onReport(r.id);}});
   nodeLayer.append(group);this.nodeEls.set(r.id,group);
  }
  this.transform();
 }
}
