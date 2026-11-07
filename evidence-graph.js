// WardLens Evidence Graph â€” private, extractive display; no new causal inference.
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
  root.addEventListener('pointermove',e=>t¶»§q«^