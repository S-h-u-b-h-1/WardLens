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
    const bod¶»§q«^