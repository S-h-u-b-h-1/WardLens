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
 ¶»§q«^